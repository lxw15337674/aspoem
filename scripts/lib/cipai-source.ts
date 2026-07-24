import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import CompleteDict from "@pinyin-pro/data/complete";
import { addDict, pinyin } from "pinyin-pro";
import slugify from "slugify";

type SourcePoem = {
  author?: unknown;
  rhythmic?: unknown;
};

export type CiPaiSource = {
  author: string;
  name: string;
  slug: string;
};

addDict(CompleteDict);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textSlug(value: string) {
  return slugify(
    pinyin(value, { toneType: "none" }).replace(/\s+/g, "-").toLowerCase(),
  );
}

function jsonFiles(directory: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => join(directory, file));
}

export function loadCiPaiSources(poetryDir: string) {
  const sourceFiles = [
    ...jsonFiles(join(poetryDir, "宋词")).filter((file) =>
      /ci\.song\.\d+\.json$/.test(file),
    ),
    ...jsonFiles(join(poetryDir, "五代诗词", "huajianji")),
  ];
  const records: CiPaiSource[] = [];
  let invalidRecords = 0;

  for (const file of sourceFiles) {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) {
      invalidRecords++;
      continue;
    }

    for (const raw of parsed as SourcePoem[]) {
      const author = text(raw.author);
      const name = text(raw.rhythmic);
      if (!author || !name) {
        invalidRecords++;
        continue;
      }
      records.push({
        author,
        name,
        slug: `${textSlug(author)}-${textSlug(name)}`,
      });
    }
  }

  return { files: sourceFiles.length, invalidRecords, records };
}
