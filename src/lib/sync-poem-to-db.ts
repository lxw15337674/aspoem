import { eq } from "drizzle-orm";
import type { DB } from "@/server/db";
import {
  authors,
  dynasties,
  poems,
  poemsToTags,
  tags,
} from "@/server/db/schema";
import { isOrderliness } from "./utils";

export interface PoemData {
  // Frontmatter 字段
  id: string;
  title: string;
  titlePinyin: string;
  titleSlug: string;
  author: string;
  authorPinyin: string;
  authorSlug: string;
  dynasty: string;
  dynastyPinyin: string;
  dynastySlug: string;
  tags: string[];

  // 内容字段
  paragraphs: string[];
  paragraphsPinyin: string[];
  annotation?: unknown;
  translation?: string;
  appreciation?: string;
}

const tagSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

// 同步诗词数据到数据库（db 由调用方注入：webhook 传 Workers D1，脚本传 node sqlite）
export async function syncPoemToDatabase(db: DB, poemData: PoemData) {
  // 1. 创建或查找朝代
  let dynasty = await db.query.dynasties.findFirst({
    where: eq(dynasties.slug, poemData.dynastySlug),
  });

  if (!dynasty) {
    [dynasty] = await db
      .insert(dynasties)
      .values({
        name: poemData.dynasty,
        pinyin: poemData.dynastyPinyin,
        slug: poemData.dynastySlug,
      })
      .returning();
  }

  // 2. 创建或查找作者
  let author = await db.query.authors.findFirst({
    where: eq(authors.slug, poemData.authorSlug),
  });

  if (!author) {
    [author] = await db
      .insert(authors)
      .values({
        name: poemData.author,
        pinyin: poemData.authorPinyin,
        slug: poemData.authorSlug,
        dynastyId: dynasty!.id,
      })
      .returning();
  } else {
    // 更新作者
    await db
      .update(authors)
      .set({
        name: poemData.author,
        pinyin: poemData.authorPinyin,
        slug: poemData.authorSlug,
        dynastyId: dynasty!.id,
      })
      .where(eq(authors.id, author.id));
  }

  // 3. 处理标签，收集 id
  const tagIds: string[] = [];
  for (const tagName of poemData.tags) {
    if (!tagName) continue;
    const slug = tagSlug(tagName);

    let tag = await db.query.tags.findFirst({
      where: eq(tags.slug, slug),
    });

    if (!tag) {
      [tag] = await db.insert(tags).values({ name: tagName, slug }).returning();
    }

    tagIds.push(tag!.id);
  }

  // 4. 检查诗词是否已存在
  const existingPoem = await db.query.poems.findFirst({
    columns: { id: true },
    where: eq(poems.slug, poemData.id),
  });

  const poemDBData = {
    title: poemData.title,
    slug: poemData.id,
    titlePinyin: poemData.titlePinyin,
    titleSlug: poemData.titleSlug,
    paragraphs: poemData.paragraphs,
    paragraphsPinyin: poemData.paragraphsPinyin,
    annotation: poemData.annotation ?? null,
    translation: poemData.translation || "",
    appreciation: poemData.appreciation || "",
    authorId: author!.id,
    dynastyId: dynasty!.id,
    isOrderliness: isOrderliness(poemData.paragraphs),
    updatedAt: new Date(),
  };

  let poemId: string;

  if (existingPoem) {
    // 更新现有诗词
    await db.update(poems).set(poemDBData).where(eq(poems.id, existingPoem.id));
    poemId = existingPoem.id;

    // set 语义：重置多对多关系
    await db.delete(poemsToTags).where(eq(poemsToTags.poemId, poemId));
  } else {
    // 创建新诗词
    const [created] = await db
      .insert(poems)
      .values(poemDBData)
      .returning({ id: poems.id });
    poemId = created!.id;
  }

  // 建立标签关联
  if (tagIds.length > 0) {
    await db
      .insert(poemsToTags)
      .values(tagIds.map((tagId) => ({ poemId, tagId })))
      .onConflictDoNothing();
  }
}
