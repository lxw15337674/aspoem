import { and, desc, eq, lt, lte, or, type SQL } from "drizzle-orm";
import type { DB } from "@/server/db";
import { poems } from "@/server/db/schema";

// 列表页公共列 + 关系（对齐旧 Prisma listSelect / findDetail）
export const listColumns = {
  id: true,
  slug: true,
  title: true,
  titleSlug: true,
  titlePinyin: true,
  paragraphs: true,
  visits: true,
  createdAt: true,
} as const;

export const listWith = {
  author: {
    columns: { name: true, slug: true },
    with: { dynasty: { columns: { name: true, slug: true } } },
  },
  poemsToTags: {
    columns: {},
    with: { tag: { columns: { name: true, slug: true } } },
  },
} as const;

// 把 Drizzle 的 poemsToTags:[{tag}] 摊平成旧的 tags:[{name,slug}]
export function mapTags<
  T extends { poemsToTags: { tag: { name: string; slug: string } }[] },
>(p: T): Omit<T, "poemsToTags"> & { tags: { name: string; slug: string }[] } {
  const { poemsToTags, ...rest } = p;
  return { ...rest, tags: poemsToTags.map((x) => x.tag) };
}

// keyset 分页：cursor 为上一页多取的那一行 id，含义与旧 Prisma cursor（inclusive）一致
// 排序 [col desc, id desc]：取「(col,id) <= (cursor.col, cursor.id)」的行
export async function keysetWhere(
  db: DB,
  cursor: string | undefined,
  col: "visits" | "updatedAt" | "createdAt",
  extra?: SQL,
): Promise<SQL | undefined> {
  if (!cursor) return extra;
  const row = await db.query.poems.findFirst({
    columns: { id: true, visits: true, updatedAt: true, createdAt: true },
    where: eq(poems.id, cursor),
  });
  if (!row) return extra;
  const column = poems[col];
  const value = row[col] as never;
  const cond = or(
    lt(column, value),
    and(eq(column, value), lte(poems.id, cursor)),
  );
  return extra && cond ? and(extra, cond) : (cond ?? extra);
}

export function keysetOrder(col: "visits" | "updatedAt" | "createdAt") {
  return [desc(poems[col]), desc(poems.id)];
}
