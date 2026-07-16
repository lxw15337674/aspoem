// 读取 poems.paragraphs 判断是否是 isOrderliness
// 执行 tsx scripts/update-db-is-orderliness.ts [作者目录]

import { inArray } from "drizzle-orm";
import { isOrderliness } from "@/lib/utils";
import { poems } from "@/server/db/schema";
import { db } from "./db";

async function updateDbIsOrderliness() {
  const all = await db.query.poems.findMany();

  const orderlinessPoems = all.filter((poem) =>
    isOrderliness(poem.paragraphs as string[]),
  );

  console.log(`Found ${orderlinessPoems.length} orderliness poems`);

  // 分批处理，每次处理 1000 条
  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(orderlinessPoems.length / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, orderlinessPoems.length);
    const batch = orderlinessPoems.slice(start, end);

    await db
      .update(poems)
      .set({ isOrderliness: true })
      .where(
        inArray(
          poems.id,
          batch.map((p) => p.id),
        ),
      );

    console.log(
      `Processed batch ${i + 1}/${totalBatches} (${end}/${orderlinessPoems.length})`,
    );
  }

  console.log("Done!");
}

updateDbIsOrderliness().catch((e) => {
  console.error(e);
});
