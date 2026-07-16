// tsx scripts/update-db-make-search-index.ts

import { eq } from "drizzle-orm";
import { convert } from "pinyin-pro";
import { poems } from "@/server/db/schema";
import { db } from "./db";

async function main() {
  console.log("开始更新搜索索引...");

  // 1. 查询数据
  const list = await db.query.poems.findMany({
    offset: 100000,
    columns: {
      id: true,
      title: true,
      titlePinyin: true,
    },
    with: {
      author: {
        columns: { name: true, pinyin: true },
        with: { dynasty: { columns: { name: true, pinyin: true } } },
      },
    },
  });

  console.log(`找到 ${list.length} 条需要更新的数据`);

  // 分批处理，避免一次性更新太多
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(list.length / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, list.length);
    const batch = list.slice(start, end);

    // 批量更新
    await Promise.all(
      batch.map(async (poem) => {
        // 处理标题拼音
        const titlePinyinWithoutTone = convert(poem.titlePinyin, {
          format: "toneNone",
        });

        // 处理作者拼音
        const authorPinyinWithoutTone = convert(poem.author.pinyin, {
          format: "toneNone",
        });

        // 处理朝代拼音
        const dynastyPinyinWithoutTone = convert(poem.author.dynasty?.pinyin, {
          format: "toneNone",
        });

        // 组合成搜索文本
        const searchText = [
          poem.author.name, // 作者名
          authorPinyinWithoutTone, // 作者拼音（无声调）
          poem.author.dynasty?.name || "", // 朝代名
          dynastyPinyinWithoutTone, // 朝代拼音（无声调）
          poem.title, // 标题
          titlePinyinWithoutTone, // 标题拼音（无声调）
        ]
          .filter(Boolean) // 过滤空值
          .join(" ");

        // 3. 更新数据库
        await db
          .update(poems)
          .set({ searchText: searchText.replace(/\s+/g, " ").trim() })
          .where(eq(poems.id, poem.id));
      }),
    );

    console.log(
      `已处理 ${end}/${list.length} (${((end / list.length) * 100).toFixed(1)}%)`,
    );
  }

  console.log("搜索索引更新完成！");
}

main().catch((e) => {
  console.error("更新失败:", e);
  process.exit(1);
});
