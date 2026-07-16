import type { TRPCRouterRecord } from "@trpc/server";
import { count, desc, eq, lte } from "drizzle-orm";
import z from "zod";
import { dynasties, poems } from "@/server/db/schema";
import { publicProcedure } from "../../trpc";
import {
  keysetOrder,
  keysetWhere,
  listColumns,
  listWith,
  mapTags,
} from "./_helpers";

export type ApiPoemListItems = Awaited<
  ReturnType<typeof poemDiscoverRouter.getHotList>
>["items"];

export const poemDiscoverRouter = {
  getHotList: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // cursor 为 poem id
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const rows = await ctx.db.query.poems.findMany({
        columns: listColumns,
        with: listWith,
        where: await keysetWhere(ctx.db, cursor, "visits"),
        orderBy: keysetOrder("visits"),
        limit: limit + 1,
      });
      const items = rows.map(mapTags);

      let nextCursor: typeof cursor;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }

      return { items, nextCursor };
    }),

  getLatestList: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const rows = await ctx.db.query.poems.findMany({
        columns: listColumns,
        with: listWith,
        where: await keysetWhere(ctx.db, cursor, "updatedAt"),
        orderBy: keysetOrder("updatedAt"),
        limit: limit + 1,
      });
      const items = rows.map(mapTags);

      let nextCursor: typeof cursor;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }

      return { items, nextCursor };
    }),

  getLatestListByDynasty: publicProcedure
    .input(
      z.object({
        dynastySlug: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { dynastySlug, limit, cursor } = input;

      const dynastyRow = await ctx.db.query.dynasties.findFirst({
        columns: { id: true, name: true, slug: true, pinyin: true },
        where: eq(dynasties.slug, dynastySlug),
      });

      if (!dynastyRow) {
        throw new Error("朝代不存在");
      }

      const poemsCount = await ctx.db.$count(
        poems,
        eq(poems.dynastyId, dynastyRow.id),
      );

      const base = eq(poems.dynastyId, dynastyRow.id);
      const rows = await ctx.db.query.poems.findMany({
        columns: listColumns,
        with: listWith,
        where: await keysetWhere(ctx.db, cursor, "createdAt", base),
        orderBy: keysetOrder("createdAt"),
        limit: limit + 1,
      });
      const items = rows.map(mapTags);

      let nextCursor: typeof cursor;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }

      const { id: _id, ...dynasty } = dynastyRow;
      return {
        items,
        nextCursor,
        dynasty: { ...dynasty, _count: { poems: poemsCount } },
      };
    }),

  getRecommendedList: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // cursor 为 poem id
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const rows = await ctx.db.query.poems.findMany({
        columns: listColumns,
        with: listWith,
        where: cursor ? lte(poems.id, cursor) : undefined,
        orderBy: [desc(poems.id)],
        limit: limit + 1,
      });
      const items = rows.map(mapTags);

      let nextCursor: typeof cursor;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }

      return { items, nextCursor };
    }),

  getRandom: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select({ total: count() }).from(poems);
    const total = row?.total ?? 0;

    if (total === 0) {
      return null;
    }

    const randomOffset = Math.floor(Math.random() * total);

    const poem = await ctx.db.query.poems.findFirst({
      columns: listColumns,
      with: listWith,
      offset: randomOffset,
    });

    return poem ? mapTags(poem) : null;
  }),
} satisfies TRPCRouterRecord;
