// node 侧 Drizzle 客户端（脚本用），走 Node 内置 node:sqlite（免装原生 better-sqlite3）
// 需 --experimental-sqlite：脚本经 NODE_OPTIONS 传入
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/server/db/schema";

// 默认指向 miniflare 本地 D1（dev / wrangler 读的同一份）
// 可用 SQLITE_PATH 覆盖
function resolveDbPath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;

  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith(".sqlite") && !f.includes("metadata"),
    );
  } catch {
    // 目录不存在
  }
  if (files.length === 0) {
    throw new Error(
      "本地 D1 未初始化。先跑：pnpm exec wrangler d1 migrations apply aspoem --local",
    );
  }
  return join(dir, files[0]!);
}

// node:sqlite 的 StatementSync 无 better-sqlite3 的 .raw()，drizzle 驱动需要它。
// 包装成 better-sqlite3 兼容接口（drizzle 全程走 raw-array 模式）。
function betterSqlite3Compat(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      let rawMode = false;
      const toArray = (row: unknown) =>
        row == null ? row : Object.values(row as Record<string, unknown>);
      return {
        raw(on = true) {
          rawMode = on;
          return this;
        },
        all(...params: unknown[]) {
          const rows = stmt.all(...(params as never[]));
          return rawMode ? rows.map(toArray) : rows;
        },
        get(...params: unknown[]) {
          const row = stmt.get(...(params as never[]));
          return rawMode ? toArray(row) : row;
        },
        run(...params: unknown[]) {
          const info = stmt.run(...(params as never[]));
          return {
            changes: Number(info.changes),
            lastInsertRowid: info.lastInsertRowid,
          };
        },
        values(...params: unknown[]) {
          return stmt.all(...(params as never[])).map(toArray);
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

const raw = new DatabaseSync(resolveDbPath());
// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 兼容包装
export const db = drizzle(betterSqlite3Compat(raw) as any, { schema });
export type NodeDB = typeof db;
