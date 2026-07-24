import type { TRPCRouterRecord } from "@trpc/server";
import { asc } from "drizzle-orm";
import { dynasties } from "@/server/db/schema";
import { adminProcedure } from "../../trpc";

export const protectedDynastyRouter = {
  // Get all dynasties list
  getList: adminProcedure.query(async ({ ctx }) => {
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
