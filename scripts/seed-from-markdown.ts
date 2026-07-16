import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownToJson } from "@/lib/ast-markdown";
import { syncPoemToDatabase } from "@/lib/sync-poem-to-db";
import type { DB } from "@/server/db";
import { db } from "./db";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

// SEED_LIMIT 不设 = 全量；设了 = 只 seed 前 N（子集/测试）
const N = process.env.SEED_LIMIT ? Number(process.env.SEED_LIMIT) : Infinity;
const DIR = process.env.POEMS_DIR ?? "../aspoem-backup/poems";
console.log("扫描文件...");
const all = walk(DIR);
const files = Number.isFinite(N) ? all.slice(0, N) : all;
console.log(`总 ${all.length}，seed ${files.length}`);

let ok = 0,
  fail = 0;
const t0 = Date.now();
for (const f of files) {
  try {
    const data = await parseMarkdownToJson(readFileSync(f, "utf-8"));
    await syncPoemToDatabase(db as unknown as DB, data);
    ok++;
  } catch (_e) {
    fail++;
  }
  if ((ok + fail) % 100 === 0)
    console.log(`${ok + fail}/${files.length} (ok=${ok} fail=${fail})`);
}
console.log(
  `done ok=${ok} fail=${fail} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
