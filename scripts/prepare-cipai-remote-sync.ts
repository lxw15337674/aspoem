import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { Converter } from "opencc-js";
import { loadCiPaiSources } from "./lib/cipai-source";

type RemotePoem = { id: string; slug: string; title: string };
type RemoteTag = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
};
type RemoteLink = { poemId: string; tagId: string };
type D1Envelope = { results?: unknown };

const toSimplified = Converter({ from: "tw", to: "cn" });

function sql(value: string | number) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function tagSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function rowsFrom(file: string) {
  const files = statSync(file).isDirectory()
    ? readdirSync(file)
        .filter((name) => name.endsWith(".json"))
        .sort()
        .map((name) => join(file, name))
    : [file];
  return files.flatMap((input) => {
    const parsed: unknown = JSON.parse(readFileSync(input, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error(`${input} is not D1 JSON output`);
    }
    return parsed.flatMap((entry) => {
      const envelope = entry as D1Envelope;
      return Array.isArray(envelope.results) ? envelope.results : [];
    });
  });
}

const poetryDir = process.env.CI_POETRY_DIR ?? "../chinese-poetry";
const outputDir = process.env.IMPORT_OUTPUT_DIR ?? "./tmp/cipai-sync";
const remotePoemsFile =
  process.env.REMOTE_POEMS_FILE ?? join(outputDir, "remote-poems");
const remoteTagsFile =
  process.env.REMOTE_TAGS_FILE ?? join(outputDir, "remote-tags.json");
const remoteLinksFile =
  process.env.REMOTE_LINKS_FILE ?? join(outputDir, "remote-links.json");
const sourceRevision = process.env.SOURCE_REVISION;
const statementsPerFile = Number(process.env.STATEMENTS_PER_FILE ?? 1000);

if (!sourceRevision) throw new Error("SOURCE_REVISION is required");
if (!Number.isInteger(statementsPerFile) || statementsPerFile < 1) {
  throw new Error("STATEMENTS_PER_FILE must be a positive integer");
}

const source = loadCiPaiSources(poetryDir);
const poemsBySlug = new Map(
  (rowsFrom(remotePoemsFile) as RemotePoem[]).map((poem) => [poem.slug, poem]),
);
const tags = rowsFrom(remoteTagsFile) as RemoteTag[];
const links = rowsFrom(remoteLinksFile) as RemoteLink[];
const tagsByName = new Map(tags.map((tag) => [tag.name, tag]));
const tagsBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
const existingLinks = new Set(
  links.map((link) => `${link.poemId}:${link.tagId}`),
);

const plan = {
  sourceRevision,
  source: {
    files: source.files,
    records: source.records.length,
    invalidRecords: source.invalidRecords,
  },
  remote: {
    poems: poemsBySlug.size,
    tags: tags.length,
    ciPaiLinks: links.length,
  },
  changes: {
    newTags: 0,
    typedExistingTags: 0,
    newLinks: 0,
  },
  excluded: {
    missingPoem: 0,
    titleMismatch: 0,
    tagSlugConflict: 0,
    tagTypeConflict: 0,
  },
  samples: {
    missingPoem: [] as string[],
    titleMismatch: [] as Array<{
      slug: string;
      sourceTitle: string;
      targetTitle: string;
    }>,
    tagSlugConflict: [] as string[],
    tagTypeConflict: [] as Array<{ name: string; type: string }>,
  },
};

let fileIndex = 0;
let statements: string[] = [];
const outputFiles: string[] = [];
const flush = () => {
  if (!statements.length) return;
  const file = `cipai-sync-${String(fileIndex).padStart(4, "0")}.sql`;
  writeFileSync(join(outputDir, file), `${statements.join("\n")}\n`);
  outputFiles.push(file);
  fileIndex++;
  statements = [];
};
const emit = (statement: string) => {
  statements.push(statement);
  if (statements.length >= statementsPerFile) flush();
};

mkdirSync(outputDir, { recursive: true });
const plannedLinks = new Set<string>();
for (const record of source.records) {
  const poem = poemsBySlug.get(record.slug);
  if (!poem) {
    plan.excluded.missingPoem++;
    if (plan.samples.missingPoem.length < 50) {
      plan.samples.missingPoem.push(record.slug);
    }
    continue;
  }
  if (toSimplified(poem.title) !== toSimplified(record.name)) {
    plan.excluded.titleMismatch++;
    if (plan.samples.titleMismatch.length < 50) {
      plan.samples.titleMismatch.push({
        slug: record.slug,
        sourceTitle: record.name,
        targetTitle: poem.title,
      });
    }
    continue;
  }

  const name = toSimplified(record.name);
  let tag = tagsByName.get(name);
  if (!tag) {
    const slug = tagSlug(name);
    const conflictingTag = tagsBySlug.get(slug);
    if (conflictingTag) {
      plan.excluded.tagSlugConflict++;
      if (plan.samples.tagSlugConflict.length < 50) {
        plan.samples.tagSlugConflict.push(name);
      }
      continue;
    }
    tag = { id: createId(), name, slug, type: "词牌名" };
    tagsByName.set(tag.name, tag);
    tagsBySlug.set(tag.slug, tag);
    emit(
      `INSERT INTO tags (id, name, slug, type, visits, createdAt, updatedAt) VALUES (${sql(tag.id)}, ${sql(tag.name)}, ${sql(tag.slug)}, '词牌名', 0, unixepoch(), unixepoch());`,
    );
    plan.changes.newTags++;
  } else if (tag.type && tag.type !== "词牌名") {
    plan.excluded.tagTypeConflict++;
    if (plan.samples.tagTypeConflict.length < 50) {
      plan.samples.tagTypeConflict.push({ name: tag.name, type: tag.type });
    }
    continue;
  } else if (tag.type !== "词牌名") {
    emit(
      `UPDATE tags SET type = '词牌名', updatedAt = unixepoch() WHERE id = ${sql(tag.id)} AND (type IS NULL OR type = '');`,
    );
    tag.type = "词牌名";
    plan.changes.typedExistingTags++;
  }

  const key = `${poem.id}:${tag.id}`;
  if (!plannedLinks.has(key) && !existingLinks.has(key)) {
    plannedLinks.add(key);
    emit(
      `INSERT OR IGNORE INTO poems_to_tags (poemId, tagId) VALUES (${sql(poem.id)}, ${sql(tag.id)});`,
    );
    plan.changes.newLinks++;
  }
}

const hasHardConflicts =
  plan.excluded.tagSlugConflict > 0 || plan.excluded.tagTypeConflict > 0;
const result = { ...plan, hasHardConflicts, outputFiles };
if (!hasHardConflicts) {
  emit(
    `INSERT INTO content_sync_state (source, revision, syncedAt, details) VALUES ('chinese-poetry/ci-pai-ming', ${sql(sourceRevision)}, unixepoch(), ${sql(JSON.stringify(result))}) ON CONFLICT(source) DO UPDATE SET revision = excluded.revision, syncedAt = excluded.syncedAt, details = excluded.details;`,
  );
}
flush();

writeFileSync(
  join(outputDir, "plan.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
writeFileSync(
  join(outputDir, "apply-files.txt"),
  `${outputFiles.join("\n")}\n`,
);
console.log(JSON.stringify(result, null, 2));

if (hasHardConflicts) process.exitCode = 1;
