import { asc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { dynasties } from "@/server/db/schema";
import { protectedProcedure } from "../../trpc";

export const protectedDynastyRouter = {
  // Get all dynasties list
  getList: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.dynasties.findMany({
      orderBy: [asc(dynasties.createdAt)],
      limit: 100,
    });

    return {
      items,
      total: items.length,
    };
  }),
} satisfies TRPCRouterRecord;
