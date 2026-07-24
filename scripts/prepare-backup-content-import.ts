import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createId } from "@paralleldrive/cuid2";
import { parseMarkdownToJson } from "@/lib/ast-markdown";

type TargetPoem = {
  id: string;
  slug: string;
  paragraphs: string;
  paragraphsPinyin: string;
  annotation: string | null;
  translation: string;
  appreciation: string;
};

type TargetTag = { id: string; name: string; slug: string };

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (path.endsWith(".md")) files.push(path);
  }
  return files;
}

function text(value: string | undefined | null) {
  return (value ?? "").trim();
}

function paragraphs(value: string[]) {
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseJsonArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function annotation(value: string | null) {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function hasAnnotation(value: Record<string, unknown>) {
  return Object.entries(value).some(
    ([key, content]) => key.trim() && String(content).trim(),
  );
}

function sql(value: string | number) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function tagSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

const poemsDir = process.env.POEMS_DIR ?? "../aspoem-backup/poems";
const sqlitePath = process.env.SQLITE_PATH ?? "./seed.db";
const outputDir =
  process.env.IMPORT_OUTPUT_DIR ?? "./tmp/backup-content-import";
const statementsPerFile = Number(process.env.STATEMENTS_PER_FILE ?? 1000);
const importLimit = process.env.IMPORT_LIMIT
  ? Number(process.env.IMPORT_LIMIT)
  : undefined;

if (!Number.isInteger(statementsPerFile) || statementsPerFile < 1) {
  throw new Error("STATEMENTS_PER_FILE must be a positive integer");
}

mkdirSync(outputDir, { recursive: true });

const db = new DatabaseSync(sqlitePath, { readOnly: true });
const poemBySlug = db.prepare(
  `SELECT id, slug, paragraphs, paragraphsPinyin, annotation, translation, appreciation
   FROM poems WHERE slug = ?`,
);
const tagsByName = new Map(
  (db.prepare("SELECT id, name, slug FROM tags").all() as TargetTag[]).map(
    (tag) => [tag.name, tag],
  ),
);
const usedTagSlugs = new Set([...tagsByName.values()].map((tag) => tag.slug));
const hasTagLink = db.prepare(
  "SELECT 1 FROM poems_to_tags WHERE poemId = ? AND tagId = ? LIMIT 1",
);

let fileIndex = 0;
let statements: string[] = [];
const outputFiles: string[] = [];
const flush = () => {
  if (!statements.length) return;
  const file = `backup-content-${String(fileIndex).padStart(4, "0")}.sql`;
  writeFileSync(join(outputDir, file), `${statements.join("\n")}\n`);
  outputFiles.push(file);
  fileIndex++;
  statements = [];
};
const emit = (statement: string) => {
  statements.push(statement);
  if (statements.length >= statementsPerFile) flush();
};

const plan = {
  sourceFiles: 0,
  parsed: 0,
  invalid: 0,
  duplicateIds: 0,
  missingPoems: 0,
  updates: {
    paragraphs: 0,
    paragraphsPinyin: 0,
    annotation: 0,
    translation: 0,
    appreciation: 0,
    tagLinks: 0,
    newTags: 0,
  },
  conflicts: {
    paragraphs: 0,
    paragraphsPinyin: 0,
    annotation: 0,
    translation: 0,
    appreciation: 0,
    tagSlug: 0,
  },
  samples: {
    missingPoems: [] as string[],
    tagSlugConflicts: [] as string[],
  },
};

const seen = new Set<string>();
const allFiles = walk(poemsDir);
const files = Number.isFinite(importLimit)
  ? allFiles.slice(0, Math.max(0, importLimit))
  : allFiles;
plan.sourceFiles = files.length;

for (const [index, file] of files.entries()) {
  try {
    const source = await parseMarkdownToJson(readFileSync(file, "utf8"));
    if (
      !source.id ||
      !source.title ||
      !source.authorSlug ||
      !source.dynastySlug
    ) {
      throw new Error("required frontmatter is missing");
    }
    if (seen.has(source.id)) {
      plan.duplicateIds++;
      continue;
    }
    seen.add(source.id);
    plan.parsed++;

    const target = poemBySlug.get(source.id) as TargetPoem | undefined;
    if (!target) {
      plan.missingPoems++;
      if (plan.samples.missingPoems.length < 50) {
        plan.samples.missingPoems.push(source.id);
      }
      continue;
    }

    const sourceParagraphs = paragraphs(source.paragraphs);
    const sourcePinyin = paragraphs(source.paragraphsPinyin);
    const targetParagraphs = paragraphs(parseJsonArray(target.paragraphs));
    const targetPinyin = paragraphs(parseJsonArray(target.paragraphsPinyin));
    const sourceAnnotation =
      source.annotation && typeof source.annotation === "object"
        ? (source.annotation as Record<string, unknown>)
        : {};
    const targetAnnotation = annotation(target.annotation);

    if (sourceParagraphs.length) {
      if (!targetParagraphs.length) {
        emit(
          `UPDATE poems SET paragraphs = ${sql(JSON.stringify(sourceParagraphs))} WHERE slug = ${sql(source.id)} AND (paragraphs IS NULL OR trim(paragraphs) = '' OR trim(paragraphs) = '[]');`,
        );
        plan.updates.paragraphs++;
      } else if (sourceParagraphs.join("\n") !== targetParagraphs.join("\n")) {
        plan.conflicts.paragraphs++;
      }
    }
    if (sourcePinyin.length) {
      if (!targetPinyin.length) {
        emit(
          `UPDATE poems SET paragraphsPinyin = ${sql(JSON.stringify(sourcePinyin))} WHERE slug = ${sql(source.id)} AND (paragraphsPinyin IS NULL OR trim(paragraphsPinyin) = '' OR trim(paragraphsPinyin) = '[]');`,
        );
        plan.updates.paragraphsPinyin++;
      } else if (sourcePinyin.join("\n") !== targetPinyin.join("\n")) {
        plan.conflicts.paragraphsPinyin++;
      }
    }
    if (hasAnnotation(sourceAnnotation)) {
      if (!hasAnnotation(targetAnnotation)) {
        emit(
          `UPDATE poems SET annotation = ${sql(JSON.stringify(sourceAnnotation))} WHERE slug = ${sql(source.id)} AND (annotation IS NULL OR trim(annotation) = '' OR trim(annotation) = '{}');`,
        );
        plan.updates.annotation++;
      } else if (
        JSON.stringify(sourceAnnotation) !== JSON.stringify(targetAnnotation)
      ) {
        plan.conflicts.annotation++;
      }
    }
    if (text(source.translation)) {
      if (!text(target.translation)) {
        emit(
          `UPDATE poems SET translation = ${sql(source.translation!)} WHERE slug = ${sql(source.id)} AND trim(translation) = '';`,
        );
        plan.updates.translation++;
      } else if (text(source.translation) !== text(target.translation)) {
        plan.conflicts.translation++;
      }
    }
    if (text(source.appreciation)) {
      if (!text(target.appreciation)) {
        emit(
          `UPDATE poems SET appreciation = ${sql(source.appreciation!)} WHERE slug = ${sql(source.id)} AND trim(appreciation) = '';`,
        );
        plan.updates.appreciation++;
      } else if (text(source.appreciation) !== text(target.appreciation)) {
        plan.conflicts.appreciation++;
      }
    }

    for (const name of source.tags.map((item) => item.trim()).filter(Boolean)) {
      let tag = tagsByName.get(name);
      if (!tag) {
        const slug = tagSlug(name);
        if (usedTagSlugs.has(slug)) {
          plan.conflicts.tagSlug++;
          if (plan.samples.tagSlugConflicts.length < 50) {
            plan.samples.tagSlugConflicts.push(name);
          }
          continue;
        }
        tag = { id: createId(), name, slug };
        tagsByName.set(name, tag);
        usedTagSlugs.add(slug);
        emit(
          `INSERT OR IGNORE INTO tags (id, name, slug, visits, createdAt, updatedAt) VALUES (${sql(tag.id)}, ${sql(tag.name)}, ${sql(tag.slug)}, 0, unixepoch(), unixepoch());`,
        );
        plan.updates.newTags++;
      }
      if (!hasTagLink.get(target.id, tag.id)) {
        emit(
          `INSERT OR IGNORE INTO poems_to_tags (poemId, tagId) VALUES (${sql(target.id)}, ${sql(tag.id)});`,
        );
        plan.updates.tagLinks++;
      }
    }
  } catch {
    plan.invalid++;
  }
  if ((index + 1) % 5000 === 0)
    console.log(`prepared ${index + 1}/${files.length}`);
}

flush();
writeFileSync(
  join(outputDir, "plan.json"),
  `${JSON.stringify(plan, null, 2)}\n`,
);
console.log(JSON.stringify({ ...plan, outputFiles }, null, 2));
