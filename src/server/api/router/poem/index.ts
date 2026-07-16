import type { TRPCRouterRecord } from "@trpc/server";
import { eq, like, sql } from "drizzle-orm";
import z from "zod";
import { poems } from "@/server/db/schema";
import { publicProcedure } from "../../trpc";
import { mapTags } from "./_helpers";

export * from "./discover";

export type ApiPoemFindDetail = Awaited<
  ReturnType<typeof poemRouter.findDetail>
>;

export const poemRouter = {
  findDetail: publicProcedure
    .input(
      z
        .object({
          id: z.string().optional(),
          slug: z.string().optional(),
        })
        .refine((data) => (data.id && !data.slug) || (!data.id && data.slug), {
          message: "Provide either id or slug, not both",
          path: ["id", "slug"],
        }),
    )
    .query(async ({ ctx, input }) => {
      const { id, slug } = input;

      const row = await ctx.db.query.poems.findFirst({
        where: id ? eq(poems.id, id) : eq(poems.slug, slug!),
        columns: {
          id: true,
          slug: true,
          title: true,
          titleSlug: true,
          titlePinyin: true,
          paragraphs: true,
          paragraphsPinyin: true,
          visits: true,
          createdAt: true,
          annotation: true,
          appreciation: true,
          translation: true,
          isOrderliness: true,
          updatedAt: true,
        },
        with: {
          dynasty: true,
          author: true,
          poemsToTags: {
            columns: {},
            with: { tag: { columns: { name: true, slug: true } } },
          },
        },
      });

      if (!row) {
        throw new Error("Poem not found");
      }

      const poem = mapTags(row);

      await ctx.db
        .update(poems)
        .set({ visits: sql`${poems.visits} + 1` })
        .where(eq(poems.id, poem.id));

      return poem;
    }),

  search: publicProcedure
    .input(
      z.object({
        keyword: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { keyword } = input;

      const poemsResult = await ctx.db.query.poems.findMany({
        where: like(poems.searchText, `%${keyword}%`),
        limit: 20,
        columns: { id: true, slug: true, title: true },
        with: {
          author: {
            columns: { name: true, slug: true },
            with: { dynasty: { columns: { name: true, slug: true } } },
          },
        },
      });

      return poemsResult;
    }),
} satisfies TRPCRouterRecord;
