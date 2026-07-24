import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createId } from "@paralleldrive/cuid2";
import CompleteDict from "@pinyin-pro/data/complete";
import { Converter } from "opencc-js";
import { addDict, pinyin } from "pinyin-pro";
import slugify from "slugify";

type SourcePoem = {
  author?: unknown;
  rhythmic?: unknown;
};

type TargetPoem = {
  id: string;
  slug: string;
  title: string;
  author: string;
};

type TargetTag = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
};

type CiPai = {
  name: string;
  author: string;
  slug: string;
  sourceFile: string;
};

addDict(CompleteDict);
const toSimplified = Converter({ from: "tw", to: "cn" });

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function poemSlug(author: string, title: string) {
  const slug = (value: string) =>
    slugify(
      pinyin(value, { toneType: "none" }).replace(/\s+/g, "-").toLowerCase(),
    );
  return `${slug(author)}-${slug(title)}`;
}

function tagSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function sql(value: string | number) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonFiles(directory: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => join(directory, file));
}

const poetryDir = process.env.CI_POETRY_DIR ?? "../chinese-poetry";
const sqlitePath = process.env.SQLITE_PATH ?? "./seed.db";
const outputDir = process.env.IMPORT_OUTPUT_DIR ?? "./tmp/cipai-import";
const statementsPerFile = Number(process.env.STATEMENTS_PER_FILE ?? 1000);
const rebuildCiPai = process.env.REBUILD_CIPAI === "1";

if (!Number.isInteger(statementsPerFile) || statementsPerFile < 1) {
  throw new Error("STATEMENTS_PER_FILE must be a positive integer");
}

const sourceFiles = [
  ...jsonFiles(join(poetryDir, "宋词")).filter((file) =>
    /ci\.song\.\d+\.json$/.test(file),
  ),
  ...jsonFiles(join(poetryDir, "五代诗词", "huajianji")),
];

const sourcePoems: CiPai[] = [];
let invalidSourceRecords = 0;
for (const file of sourceFiles) {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    invalidSourceRecords++;
    continue;
  }

  for (const raw of parsed as SourcePoem[]) {
    const author = text(raw.author);
    const name = text(raw.rhythmic);
    if (!author || !name) {
      invalidSourceRecords++;
      continue;
    }
    sourcePoems.push({
      name,
      author,
      slug: poemSlug(author, name),
      sourceFile: file,
    });
  }
}

const db = new DatabaseSync(sqlitePath, { readOnly: true });
const poemBySlug = db.prepare(
  `SELECT poems.id, poems.slug, poems.title, authors.name AS author
   FROM poems JOIN authors ON authors.id = poems.authorId
   WHERE poems.slug = ?`,
);
const tagColumns = db.prepare("PRAGMA table_info(tags)").all() as Array<{
  name: string;
}>;
const hasTagType = tagColumns.some((column) => column.name === "type");
const tagRows = db
  .prepare(
    `SELECT id, name, slug, ${hasTagType ? "type" : "NULL AS type"} FROM tags`,
  )
  .all() as TargetTag[];
const tagsByName = new Map(tagRows.map((tag) => [tag.name, tag]));
const tagSlugs = new Map(tagRows.map((tag) => [tag.slug, tag]));
const hasTagLink = db.prepare(
  "SELECT 1 FROM poems_to_tags WHERE poemId = ? AND tagId = ? LIMIT 1",
);

const plan = {
  rebuildCiPai,
  source: {
    files: sourceFiles.length,
    records: sourcePoems.length,
    invalidRecords: invalidSourceRecords,
  },
  matches: {
    exactPoems: 0,
    scriptVariantTitles: 0,
    existingLinks: 0,
    newLinks: 0,
    uniqueCiPai: 0,
    newTags: 0,
    typedExistingTags: 0,
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
  const file = `cipai-${String(fileIndex).padStart(4, "0")}.sql`;
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
if (rebuildCiPai) {
  const cleanupFile = "remove-current-cipai.sql";
  writeFileSync(
    join(outputDir, cleanupFile),
    "DELETE FROM poems_to_tags WHERE tagId IN (SELECT id FROM tags WHERE type = '词牌名');\nDELETE FROM tags WHERE type = '词牌名';\n",
  );
  outputFiles.push(cleanupFile);
}
const linkedPoemTag = new Set<string>();
const rebuiltTagIds = new Set<string>();
const acceptedCiPai = new Set<string>();

for (const source of sourcePoems) {
  const target = poemBySlug.get(source.slug) as TargetPoem | undefined;
  if (!target) {
    plan.excluded.missingPoem++;
    if (plan.samples.missingPoem.length < 50)
      plan.samples.missingPoem.push(source.slug);
    continue;
  }
  if (toSimplified(target.title) !== toSimplified(source.name)) {
    plan.excluded.titleMismatch++;
    if (plan.samples.titleMismatch.length < 50) {
      plan.samples.titleMismatch.push({
        slug: source.slug,
        sourceTitle: source.name,
        targetTitle: target.title,
      });
    }
    continue;
  }

  const ciPaiName = toSimplified(source.name);
  if (target.title !== source.name) plan.matches.scriptVariantTitles++;

  let tag = tagsByName.get(ciPaiName);
  if (!tag) {
    const slug = tagSlug(ciPaiName);
    const conflictingTag = tagSlugs.get(slug);
    if (conflictingTag) {
      plan.excluded.tagSlugConflict++;
      if (plan.samples.tagSlugConflict.length < 50) {
        plan.samples.tagSlugConflict.push(ciPaiName);
      }
      continue;
    }
    tag = { id: createId(), name: ciPaiName, slug, type: "词牌名" };
    tagsByName.set(tag.name, tag);
    tagSlugs.set(tag.slug, tag);
    rebuiltTagIds.add(tag.id);
    emit(
      `INSERT INTO tags (id, name, slug, type, visits, createdAt, updatedAt) VALUES (${sql(tag.id)}, ${sql(tag.name)}, ${sql(tag.slug)}, '词牌名', 0, unixepoch(), unixepoch());`,
    );
    plan.matches.newTags++;
  } else if (tag.type && tag.type !== "词牌名") {
    plan.excluded.tagTypeConflict++;
    if (plan.samples.tagTypeConflict.length < 50) {
      plan.samples.tagTypeConflict.push({ name: tag.name, type: tag.type });
    }
    continue;
  } else if (rebuildCiPai && !rebuiltTagIds.has(tag.id)) {
    emit(
      `INSERT OR IGNORE INTO tags (id, name, slug, type, visits, createdAt, updatedAt) VALUES (${sql(tag.id)}, ${sql(tag.name)}, ${sql(tag.slug)}, '词牌名', 0, unixepoch(), unixepoch());`,
    );
    tag.type = "词牌名";
    rebuiltTagIds.add(tag.id);
    plan.matches.typedExistingTags++;
  } else if (tag.type !== "词牌名") {
    emit(
      `UPDATE tags SET type = '词牌名', updatedAt = unixepoch() WHERE id = ${sql(tag.id)} AND (type IS NULL OR type = '');`,
    );
    tag.type = "词牌名";
    plan.matches.typedExistingTags++;
  }

  acceptedCiPai.add(tag.name);
  plan.matches.exactPoems++;
  const key = `${target.id}:${tag.id}`;
  if (!linkedPoemTag.has(key)) {
    linkedPoemTag.add(key);
    if (!rebuildCiPai && hasTagLink.get(target.id, tag.id)) {
      plan.matches.existingLinks++;
    } else {
      emit(
        `INSERT OR IGNORE INTO poems_to_tags (poemId, tagId) VALUES (${sql(target.id)}, ${sql(tag.id)});`,
      );
      plan.matches.newLinks++;
    }
  }
}

plan.matches.uniqueCiPai = acceptedCiPai.size;
flush();
writeFileSync(
  join(outputDir, "plan.json"),
  `${JSON.stringify({ ...plan, outputFiles }, null, 2)}\n`,
);
console.log(JSON.stringify({ ...plan, outputFiles }, null, 2));
