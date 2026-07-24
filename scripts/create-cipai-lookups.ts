import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCiPaiSources } from "./lib/cipai-source";

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

const poetryDir = process.env.CI_POETRY_DIR ?? "../chinese-poetry";
const outputDir = process.env.IMPORT_OUTPUT_DIR ?? "./tmp/cipai-sync";
const lookupBatchSize = Number(process.env.LOOKUP_BATCH_SIZE ?? 400);

if (!Number.isInteger(lookupBatchSize) || lookupBatchSize < 1) {
  throw new Error("LOOKUP_BATCH_SIZE must be a positive integer");
}

const source = loadCiPaiSources(poetryDir);
const slugs = [...new Set(source.records.map((record) => record.slug))].sort();
const lookupDir = join(outputDir, "poem-lookups");
const lookupFiles: string[] = [];
mkdirSync(lookupDir, { recursive: true });
for (let index = 0; index < slugs.length; index += lookupBatchSize) {
  const batch = slugs.slice(index, index + lookupBatchSize);
  const file = `lookup-${String(lookupFiles.length).padStart(4, "0")}.sql`;
  writeFileSync(
    join(lookupDir, file),
    `SELECT id, slug, title FROM poems WHERE slug IN (${batch.map(sql).join(", ")});\n`,
  );
  lookupFiles.push(file);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "lookup-files.txt"),
  `${lookupFiles.join("\n")}\n`,
);
writeFileSync(
  join(outputDir, "lookup-plan.json"),
  `${JSON.stringify(
    {
      sourceFiles: source.files,
      sourceRecords: source.records.length,
      invalidSourceRecords: source.invalidRecords,
      uniquePoemSlugs: slugs.length,
      lookupStatements: lookupFiles.length,
    },
    null,
    2,
  )}\n`,
);
