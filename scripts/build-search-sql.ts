import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { convert } from "pinyin-pro";

// 从 seed.db 生成 searchText 的 UPDATE 语句（分片），灌远程 D1。
// searchText = 作者名 + 作者拼音(无调) + 朝代 + 朝代拼音(无调) + 标题 + 标题拼音(无调) + 正文
const db = new DatabaseSync(process.env.SQLITE_PATH ?? "./seed.db");
const ROWS_PER_FILE = Number(process.env.ROWS_PER_FILE ?? 40000);
const MAX_STMT = Number(process.env.MAX_STMT ?? 15000);

const sq = (s: string) => s.replace(/'/g, "''");
const noTone = (s: string | null | undefined) =>
  s ? convert(s, { format: "toneNone" }) : "";

let fileIdx = 0;
let buf: string[] = [];
let rows = 0;
function flush() {
  if (!buf.length) return;
  const name = `seed-search-${String(fileIdx).padStart(3, "0")}.sql`;
  writeFileSync(name, buf.join("\n"));
  console.error(`写 ${name} (${rows} 行)`);
  buf = [];
  rows = 0;
  fileIdx++;
}

const q = db.prepare(
  `SELECT p.id id, p.title title, p.titlePinyin tp, p.paragraphs para,
          a.name an, a.pinyin ap, d.name dn, d.pinyin dp
   FROM poems p
   JOIN authors a ON p.authorId = a.id
   LEFT JOIN dynasties d ON p.dynastyId = d.id`,
);

let total = 0;
for (const r of q.iterate()) {
  const row = r as Record<string, string | null>;
  let body = "";
  try {
    body = (JSON.parse(row.para ?? "[]") as string[]).join("");
  } catch {
    body = "";
  }
  let searchText = [
    row.an,
    noTone(row.ap),
    row.dn ?? "",
    noTone(row.dp),
    row.title,
    noTone(row.tp),
    body,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // 单语句上限：超了截断 searchText
  let stmt = `UPDATE poems SET searchText='${sq(searchText)}' WHERE id='${row.id}';`;
  if (stmt.length > MAX_STMT) {
    searchText = searchText.slice(0, MAX_STMT - 200);
    stmt = `UPDATE poems SET searchText='${sq(searchText)}' WHERE id='${row.id}';`;
  }
  buf.push(stmt);
  rows++;
  total++;
  if (rows >= ROWS_PER_FILE) flush();
}
flush();
console.error(`完成，${total} 行，${fileIdx} 个文件`);
