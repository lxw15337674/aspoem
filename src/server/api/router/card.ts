import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, lt, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { cards } from "@/server/db/schema";
import { publicProcedure } from "../trpc";

export const cardRouter = {
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(60).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      let where: SQL | undefined;
      if (input.cursor) {
        const cursor = await ctx.db.query.cards.findFirst({
          columns: { id: true, createdAt: true },
          where: eq(cards.id, input.cursor),
        });
        if (cursor) {
          where = or(
            lt(cards.createdAt, cursor.createdAt),
            and(
              eq(cards.createdAt, cursor.createdAt),
              lte(cards.id, cursor.id),
            ),
          );
        }
      }

      const rows = await ctx.db.query.cards.findMany({
        columns: { id: true, content: true, template: true },
        with: {
          poem: {
            columns: { slug: true, title: true },
            with: { author: { columns: { name: true } } },
          },
        },
        where,
        orderBy: [desc(cards.createdAt), desc(cards.id)],
        limit: input.limit + 1,
      });
      const items = rows.slice();
      const nextCursor =
        items.length > input.limit ? items.pop()?.id : undefined;

      return { items, nextCursor };
    }),
} satisfies TRPCRouterRecord;
