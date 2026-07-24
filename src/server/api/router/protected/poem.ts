import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { authors, poems } from "@/server/db/schema";
import { adminProcedure } from "../../trpc";

export const protectedPoemRouter = {
  // Get paginated poems list
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        keyword: z.string().optional(),
        authorId: z.string().optional(),
        dynastyIds: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, keyword, authorId, dynastyIds } = input;

      const conds: SQL[] = [];

      if (keyword) {
        const kw = or(
          like(poems.title, `%${keyword}%`),
          like(poems.searchText, `%${keyword}%`),
        );
        if (kw) conds.push(kw);
      }

      if (authorId) {
        conds.push(eq(poems.authorId, authorId));
      }

      if (dynastyIds && dynastyIds.length > 0) {
        conds.push(
          inArray(
            poems.authorId,
            ctx.db
              .select({ id: authors.id })
              .from(authors)
              .where(inArray(authors.dynastyId, dynastyIds)),
          ),
        );
      }

      const where = conds.length ? and(...conds) : undefined;
      const skip = (page - 1) * pageSize;

      const [[totalRow], rows] = await Promise.all([
        ctx.db.select({ c: count() }).from(poems).where(where),
        ctx.db.query.poems.findMany({
          where,
          offset: skip,
          limit: pageSize,
          orderBy: [desc(poems.createdAt)],
          with: {
            dynasty: true,
            author: true,
            poemsToTags: { columns: {}, with: { tag: true } },
          },
        }),
      ]);

      const total = totalRow?.c ?? 0;
      const items = rows.map(({ poemsToTags, ...p }) => ({
        ...p,
        tags: poemsToTags.map((x) => x.tag),
      }));

      const totalPages = Math.ceil(total / pageSize);

      return {
        items,
        page,
        pageSize,
        total,
        pageCount: totalPages,
      };
    }),
} satisfies TRPCRouterRecord;
