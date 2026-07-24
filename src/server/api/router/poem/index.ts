import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import z from "zod";
import { authors, dynasties, poems, poemsToTags } from "@/server/db/schema";
import { publicProcedure } from "../../trpc";
import { mapTags } from "./_helpers";

export * from "./discover";

export type ApiPoemFindDetail = Awaited<
  ReturnType<typeof poemRouter.findDetail>
>;
export type ApiPoemRelated = Awaited<ReturnType<typeof poemRouter.findRelated>>;

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

  findRelated: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [poem] = await ctx.db
        .select({ authorId: poems.authorId })
        .from(poems)
        .where(eq(poems.id, input.id))
        .limit(1);

      if (!poem) {
        throw new Error("Poem not found");
      }

      const selectRelated = {
        id: poems.id,
        slug: poems.slug,
        title: poems.title,
        authorName: authors.name,
        authorSlug: authors.slug,
        dynastyName: dynasties.name,
      };

      const [sameAuthor, poemTags] = await Promise.all([
        ctx.db
          .select(selectRelated)
          .from(poems)
          .innerJoin(authors, eq(poems.authorId, authors.id))
          .leftJoin(dynasties, eq(poems.dynastyId, dynasties.id))
          .where(and(eq(poems.authorId, poem.authorId), ne(poems.id, input.id)))
          .orderBy(desc(poems.visits), desc(poems.updatedAt))
          .limit(4),
        ctx.db
          .select({ tagId: poemsToTags.tagId })
          .from(poemsToTags)
          .where(eq(poemsToTags.poemId, input.id)),
      ]);

      const tagIds = poemTags.map((tag) => tag.tagId);
      if (tagIds.length === 0) {
        return { sameAuthor, sameTags: [] };
      }

      const sameAuthorIds = new Set(sameAuthor.map((item) => item.id));
      const sameTags = await ctx.db
        .select({ ...selectRelated, sharedTagCount: count(poemsToTags.tagId) })
        .from(poemsToTags)
        .innerJoin(poems, eq(poemsToTags.poemId, poems.id))
        .innerJoin(authors, eq(poems.authorId, authors.id))
        .leftJoin(dynasties, eq(poems.dynastyId, dynasties.id))
        .where(and(inArray(poemsToTags.tagId, tagIds), ne(poems.id, input.id)))
        .groupBy(poems.id)
        .orderBy(desc(count(poemsToTags.tagId)), desc(poems.visits))
        .limit(8);

      return {
        sameAuthor,
        sameTags: sameTags
          .filter((item) => !sameAuthorIds.has(item.id))
          .slice(0, 4),
      };
    }),

  sitemap: publicProcedure
    .input(
      z.object({
        offset: z.number().min(0).default(0),
        limit: z.number().min(1).max(25_000).default(25_000),
      }),
    )
    .query(async ({ ctx, input }) =>
      ctx.db.query.poems.findMany({
        columns: { slug: true, updatedAt: true },
        orderBy: [desc(poems.updatedAt), desc(poems.id)],
        offset: input.offset,
        limit: input.limit,
      }),
    ),

  sitemapCount: publicProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db.select({ value: count() }).from(poems);
    return result?.value ?? 0;
  }),
} satisfies TRPCRouterRecord;
