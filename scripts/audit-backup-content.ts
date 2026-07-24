import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

type Counts = Record<string, number>;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (path.endsWith(".md")) files.push(path);
  }
  return files;
}

function bump(counts: Counts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function normalizedText(value: string | undefined | null) {
  return (value ?? "").trim();
}

function normalizedParagraphs(value: string[]) {
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function parseAnnotation(value: string | null) {
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

function annotationKey(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.entries(value)
      .filter(([key, content]) => key.trim() && String(content).trim())
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function equalsParagraphs(target: string, source: string[]) {
  try {
    const parsed: unknown = JSON.parse(target);
    return (
      Array.isArray(parsed) &&
      normalizedParagraphs(
        parsed.filter((item): item is string => typeof item === "string"),
      ) === normalizedParagraphs(source)
    );
  } catch {
    return false;
  }
}

const poemsDir = process.env.POEMS_DIR ?? "../aspoem-backup/poems";
const sqlitePath = process.env.SQLITE_PATH ?? "./seed.db";
const reportPath =
  process.env.AUDIT_OUTPUT ?? "./tmp/backup-content-audit.json";
const auditLimit = process.env.AUDIT_LIMIT
  ? Number(process.env.AUDIT_LIMIT)
  : undefined;

const db = new DatabaseSync(sqlitePath, { readOnly: true });
const targetBySlug = db.prepare(
  `SELECT id, slug, paragraphs, paragraphsPinyin, annotation, translation, appreciation
   FROM poems WHERE slug = ?`,
);
const targetTagNames = new Set(
  (db.prepare("SELECT name FROM tags").all() as { name: string }[]).map(
    (tag) => tag.name,
  ),
);
const targetTagLinks = db.prepare(
  `SELECT 1 FROM poems_to_tags WHERE poemId = ? AND tagId =
     (SELECT id FROM tags WHERE name = ?) LIMIT 1`,
);

const report = {
  source: {
    availableFiles: 0,
    files: 0,
    parsed: 0,
    invalid: 0,
    duplicateIds: 0,
    withTranslation: 0,
    withAnnotation: 0,
    withAppreciation: 0,
    withTags: 0,
  },
  target: { matched: 0, missing: 0 },
  candidates: {
    paragraphs: 0,
    paragraphsPinyin: 0,
    annotation: 0,
    translation: 0,
    appreciation: 0,
    tags: 0,
    newTags: 0,
  },
  conflicts: {
    paragraphs: 0,
    paragraphsPinyin: 0,
    annotation: 0,
    translation: 0,
    appreciation: 0,
  },
  samples: {
    invalid: [] as string[],
    duplicateIds: [] as string[],
    missing: [] as string[],
    conflicts: [] as { slug: string; fields: string[] }[],
    newTags: [] as string[],
  },
};

const seenSlugs = new Set<string>();
const allFiles = walk(poemsDir);
const files = Number.isFinite(auditLimit)
  ? allFiles.slice(0, Math.max(0, auditLimit))
  : allFiles;
report.source.availableFiles = allFiles.length;
report.source.files = files.length;

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
    if (seenSlugs.has(source.id)) {
      report.source.duplicateIds++;
      if (report.samples.duplicateIds.length < 50)
        report.samples.duplicateIds.push(file);
      continue;
    }
    seenSlugs.add(source.id);
    report.source.parsed++;

    const sourceAnnotation =
      source.annotation && typeof source.annotation === "object"
        ? (source.annotation as Record<string, unknown>)
        : {};
    const sourceHasAnnotation = hasAnnotation(sourceAnnotation);
    const sourceHasTranslation = Boolean(normalizedText(source.translation));
    const sourceHasAppreciation = Boolean(normalizedText(source.appreciation));
    if (sourceHasAnnotation) report.source.withAnnotation++;
    if (sourceHasTranslation) report.source.withTranslation++;
    if (sourceHasAppreciation) report.source.withAppreciation++;
    if (source.tags.length) report.source.withTags++;

    const target = targetBySlug.get(source.id) as TargetPoem | undefined;
    if (!target) {
      report.target.missing++;
      if (report.samples.missing.length < 50)
        report.samples.missing.push(source.id);
      continue;
    }
    report.target.matched++;

    const conflictFields: string[] = [];
    const compare = (
      field: keyof typeof report.candidates & keyof typeof report.conflicts,
      sourceValue: string | boolean,
      targetHasValue: boolean,
      equal: boolean,
    ) => {
      if (!sourceValue) return;
      if (!targetHasValue) bump(report.candidates, field);
      else if (!equal) {
        bump(report.conflicts, field);
        conflictFields.push(field);
      }
    };

    const targetParagraphs = equalsParagraphs(
      target.paragraphs,
      source.paragraphs,
    );
    compare(
      "paragraphs",
      source.paragraphs.length > 0,
      normalizedText(target.paragraphs) !== "[]",
      targetParagraphs,
    );
    compare(
      "paragraphsPinyin",
      source.paragraphsPinyin.length > 0,
      normalizedText(target.paragraphsPinyin) !== "[]",
      equalsParagraphs(target.paragraphsPinyin, source.paragraphsPinyin),
    );

    const targetAnnotation = parseAnnotation(target.annotation);
    compare(
      "annotation",
      sourceHasAnnotation,
      hasAnnotation(targetAnnotation),
      annotationKey(targetAnnotation) === annotationKey(sourceAnnotation),
    );
    compare(
      "translation",
      sourceHasTranslation,
      Boolean(normalizedText(target.translation)),
      normalizedText(target.translation) === normalizedText(source.translation),
    );
    compare(
      "appreciation",
      sourceHasAppreciation,
      Boolean(normalizedText(target.appreciation)),
      normalizedText(target.appreciation) ===
        normalizedText(source.appreciation),
    );

    for (const tag of source.tags.filter((item) => item.trim())) {
      if (!targetTagNames.has(tag)) {
        report.candidates.newTags++;
        if (
          report.samples.newTags.length < 50 &&
          !report.samples.newTags.includes(tag)
        ) {
          report.samples.newTags.push(tag);
        }
        continue;
      }
      if (!targetTagLinks.get(target.id, tag)) report.candidates.tags++;
    }
    if (conflictFields.length && report.samples.conflicts.length < 50) {
      report.samples.conflicts.push({
        slug: source.id,
        fields: conflictFields,
      });
    }
  } catch {
    report.source.invalid++;
    if (report.samples.invalid.length < 50) report.samples.invalid.push(file);
  }

  if ((index + 1) % 5000 === 0) {
    console.log(`audited ${index + 1}/${files.length}`);
  }
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
