import { count, inArray } from "drizzle-orm";
import { authors, dynasties, poems } from "@/server/db/schema";
import { db } from "../db";

export async function deleteDynastiesWithoutContent() {
  console.log("开始查找没有内容的朝代...");

  // 查询所有朝代
  const list = await db.query.dynasties.findMany({
    columns: { id: true, name: true },
  });

  // 各朝代诗词 / 作者数量（分组统计）
  const [poemCounts, authorCounts] = await Promise.all([
    db
      .select({ dynastyId: poems.dynastyId, c: count() })
      .from(poems)
      .groupBy(poems.dynastyId),
    db
      .select({ dynastyId: authors.dynastyId, c: count() })
      .from(authors)
      .groupBy(authors.dynastyId),
  ]);
  const poemMap = new Map(poemCounts.map((r) => [r.dynastyId, r.c]));
  const authorMap = new Map(authorCounts.map((r) => [r.dynastyId, r.c]));

  // 筛选出没有诗词和作者的朝代
  const emptyDynasties = list.filter(
    (d) => (poemMap.get(d.id) ?? 0) === 0 && (authorMap.get(d.id) ?? 0) === 0,
  );

  console.log(`找到 ${emptyDynasties.length} 个没有内容的朝代`);

  if (emptyDynasties.length === 0) {
    console.log("没有需要删除的朝代");
    return;
  }

  // 显示将要删除的朝代
  console.log("\n将要删除的朝代：");
  emptyDynasties.forEach((dynasty, index) => {
    console.log(`${index + 1}. ${dynasty.name} (ID: ${dynasty.id})`);
  });

  // 删除这些朝代
  await db.delete(dynasties).where(
    inArray(
      dynasties.id,
      emptyDynasties.map((d) => d.id),
    ),
  );

  console.log(`\n成功删除 ${emptyDynasties.length} 个朝代`);
}
