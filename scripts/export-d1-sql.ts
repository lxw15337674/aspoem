import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.env.SQLITE_PATH ?? "./seed.db");
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

// FK 顺序
const tables = ["dynasties", "tags", "authors", "poems", "poems_to_tags"];
const out: string[] = [];
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM ${t}`).all() as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) continue;
  const cols = Object.keys(rows[0]!);
  const colList = cols.map((c) => `"${c}"`).join(",");
  for (const r of rows) {
    const vals = cols.map((c) => lit(r[c])).join(",");
    out.push(`INSERT OR IGNORE INTO ${t} (${colList}) VALUES (${vals});`);
  }
  console.error(`${t}: ${rows.length} 行`);
}
writeFileSync("seed-data.sql", out.join("\n"));
console.error(`写出 ${out.length} 条 INSERT → seed-data.sql`);
