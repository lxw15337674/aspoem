import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// 流式导出 seed.db → 分片 SQL（seed-data-000.sql ...），多行 INSERT，保 FK 顺序。
// 全量数据用；单文件太大 d1 execute 会超限。
const db = new DatabaseSync(process.env.SQLITE_PATH ?? "./seed.db");
const ROWS_PER_FILE = Number(process.env.ROWS_PER_FILE ?? 50000);
const ROWS_PER_INSERT = Number(process.env.ROWS_PER_INSERT ?? 100);

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

// D1 单语句有大小上限（实测 ~20KB 安全）。超限行截断最长的文本列（避开 key/fk）。
const MAX_STMT = Number(process.env.MAX_STMT ?? 20000);
const SKIP_COLS = new Set([
  "id",
  "slug",
  "authorId",
  "dynastyId",
  "poemId",
  "tagId",
  "createdAt",
  "updatedAt",
]);
function capRow(cols: string[], row: Record<string, unknown>) {
  let line = cols.map((c) => lit(row[c])).join(",");
  let guard = 0;
  while (line.length > MAX_STMT && guard++ < 20) {
    // 找最长字符串列
    let longest = "";
    let longestLen = 0;
    for (const c of cols) {
      if (SKIP_COLS.has(c)) continue;
      const v = row[c];
      if (typeof v === "string" && v.length > longestLen) {
        longest = c;
        longestLen = v.length;
      }
    }
    if (!longest) break;
    const over = line.length - MAX_STMT;
    row[longest] = (row[longest] as string).slice(
      0,
      Math.max(0, longestLen - over - 100),
    );
    line = cols.map((c) => lit(row[c])).join(",");
  }
  return line;
}

// FK 顺序：dynasty → tag → author → poem → junction
const tables = ["dynasties", "tags", "authors", "poems", "poems_to_tags"];

let fileIdx = 0;
let buf: string[] = [];
let rowsInFile = 0;

function flush() {
  if (buf.length === 0) return;
  const name = `seed-data-${String(fileIdx).padStart(3, "0")}.sql`;
  writeFileSync(name, buf.join("\n"));
  console.error(`写 ${name} (${rowsInFile} 行)`);
  buf = [];
  rowsInFile = 0;
  fileIdx++;
}

for (const t of tables) {
  const first = db.prepare(`SELECT * FROM ${t} LIMIT 1`).get() as
    | Record<string, unknown>
    | undefined;
  if (!first) continue;
  const cols = Object.keys(first);
  const colList = cols.map((c) => `"${c}"`).join(",");

  let batch: string[] = [];
  const emit = () => {
    if (batch.length === 0) return;
    buf.push(
      `INSERT OR IGNORE INTO ${t} (${colList}) VALUES ${batch.join(",")};`,
    );
    rowsInFile += batch.length;
    batch = [];
    if (rowsInFile >= ROWS_PER_FILE) flush();
  };

  let total = 0;
  for (const r of db.prepare(`SELECT * FROM ${t}`).iterate()) {
    const row = r as Record<string, unknown>;
    batch.push(`(${capRow(cols, row)})`);
    total++;
    if (batch.length >= ROWS_PER_INSERT) emit();
  }
  emit(); // 表尾余量
  // 表边界不跨表拼 INSERT（emit 已清 batch）
  console.error(`${t}: ${total} 行`);
}
flush();
console.error(`完成，共 ${fileIdx} 个文件`);
