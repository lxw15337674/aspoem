import { and, count, eq } from "drizzle-orm";
import { authors, dynasties, poems } from "@/server/db/schema";
import { db } from "../db";

export async function migrateDaiXuToSong() {
  console.log("开始迁移戴栩数据...");

  // 查找唐朝
  const tangDynasty = await db.query.dynasties.findFirst({
    where: eq(dynasties.name, "唐"),
  });

  if (!tangDynasty) {
    console.error("未找到唐朝数据");
    return;
  }

  // 查找宋朝
  const songDynasty = await db.query.dynasties.findFirst({
    where: eq(dynasties.name, "宋"),
  });

  if (!songDynasty) {
    console.error("未找到宋朝数据");
    return;
  }

  // 查找唐代戴栩
  const tangDaiXu = await db.query.authors.findFirst({
    where: and(eq(authors.name, "戴栩"), eq(authors.dynastyId, tangDynasty.id)),
  });

  if (!tangDaiXu) {
    console.log("未找到唐代戴栩");
    return;
  }

  const tangPoemCount = await db.$count(
    poems,
    eq(poems.authorId, tangDaiXu.id),
  );
  console.log(`找到唐代戴栩，共有 ${tangPoemCount} 首诗词`);

  // 查找或创建宋代戴栩
  let songDaiXu = await db.query.authors.findFirst({
    where: and(eq(authors.name, "戴栩"), eq(authors.dynastyId, songDynasty.id)),
  });

  if (!songDaiXu) {
    console.log("创建宋代戴栩作者...");
    [songDaiXu] = await db
      .insert(authors)
      .values({
        name: tangDaiXu.name,
        pinyin: tangDaiXu.pinyin,
        dynastyId: songDynasty.id,
        introduce: tangDaiXu.introduce,
        slug: tangDaiXu.slug,
      })
      .returning();
    console.log("✓ 已创建宋代戴栩");
  } else {
    console.log("宋代戴栩已存在");
  }

  // 更新所有唐代戴栩的诗词
  await db
    .update(poems)
    .set({ authorId: songDaiXu!.id, dynastyId: songDynasty.id })
    .where(eq(poems.authorId, tangDaiXu.id));

  console.log(`✓ 已更新 ${tangPoemCount} 首诗词`);

  // 删除唐代戴栩（如果没有诗词了）
  const [remaining] = await db
    .select({ c: count() })
    .from(poems)
    .where(eq(poems.authorId, tangDaiXu.id));

  if ((remaining?.c ?? 0) === 0) {
    await db.delete(authors).where(eq(authors.id, tangDaiXu.id));
    console.log("✓ 已删除唐代戴栩");
  }

  console.log("迁移完成！");
}
