import type { TRPCRouterRecord } from "@trpc/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { cards } from "@/server/db/schema";
import { publicProcedure } from "../trpc";

export const cardRouter = {
  list: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(60).default(24) }))
    .query(({ ctx, input }) =>
      ctx.db.query.cards.findMany({
        columns: { id: true, content: true, template: true },
        with: {
          poem: {
            columns: { slug: true, title: true },
            with: { author: { columns: { name: true } } },
          },
        },
        orderBy: [desc(cards.createdAt)],
        limit: input.limit,
      }),
    ),
} satisfies TRPCRouterRecord;
