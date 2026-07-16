import { count } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { authors, dynasties, poems } from "@/server/db/schema";
import { publicProcedure } from "../trpc";

export const dynastyRouter = {
  getPoemsCount: publicProcedure.query(async ({ ctx }) => {
    const [list, counts] = await Promise.all([
      ctx.db.query.dynasties.findMany({
        columns: { id: true, name: true, slug: true, pinyin: true },
      }),
      ctx.db
        .select({ dynastyId: poems.dynastyId, c: count() })
        .from(poems)
        .groupBy(poems.dynastyId),
    ]);

    const countMap = new Map(counts.map((r) => [r.dynastyId, r.c]));

    return list.map(({ id, ...d }) => ({
      ...d,
      _count: { poems: countMap.get(id) ?? 0 },
    }));
  }),

  getAuthorsCount: publicProcedure.query(async ({ ctx }) => {
    const [list, counts] = await Promise.all([
      ctx.db.query.dynasties.findMany({
        columns: { id: true, name: true, slug: true, pinyin: true },
      }),
      ctx.db
        .select({ dynastyId: authors.dynastyId, c: count() })
        .from(authors)
        .groupBy(authors.dynastyId),
    ]);

    const countMap = new Map(counts.map((r) => [r.dynastyId, r.c]));

    return list.map(({ id, ...d }) => ({
      ...d,
      _count: { authors: countMap.get(id) ?? 0 },
    }));
  }),
} satisfies TRPCRouterRecord;
