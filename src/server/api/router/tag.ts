import type { TRPCRouterRecord } from "@trpc/server";
import { and, asc, count, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import {
  authors,
  dynasties,
  poems,
  poemsToTags,
  tags,
} from "@/server/db/schema";
import { publicProcedure } from "../trpc";

const ciPaiMingPageSize = 12;
const tagPoemPageSize = 48;
const tagPageSize = 24;

const tagList = (type?: string) =>
  publicProcedure.query(async ({ ctx }) => {
    const where = type ? eq(tags.type, type) : undefined;
    return ctx.db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        type: tags.type,
        introduce: tags.introduce,
        poemsCount: count(poemsToTags.poemId),
      })
      .from(tags)
      .leftJoin(poemsToTags, eq(tags.id, poemsToTags.tagId))
      .where(where)
      .groupBy(tags.id)
      .orderBy(desc(count(poemsToTags.poemId)), asc(tags.name));
  });

export const tagRouter = {
  list: tagList(),
  listNonCiPai: publicProcedure
    .input(
      z.object({
        cursor: z.number().int().min(1).optional(),
        limit: z.number().min(1).max(100).default(tagPageSize),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = input.cursor ?? 1;
      const rows = await ctx.db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          type: tags.type,
          introduce: tags.introduce,
          poemsCount: count(poemsToTags.poemId),
        })
        .from(tags)
        .leftJoin(poemsToTags, eq(tags.id, poemsToTags.tagId))
        .where(or(isNull(tags.type), ne(tags.type, "词牌名")))
        .groupBy(tags.id)
        .orderBy(desc(count(poemsToTags.poemId)), asc(tags.name))
        .limit(input.limit + 1)
        .offset((page - 1) * input.limit);
      const items = rows.slice(0, input.limit);

      return {
        items,
        nextCursor: rows.length > input.limit ? page + 1 : undefined,
      };
    }),
  listCiPaiMing: publicProcedure
    .input(z.object({ page: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          introduce: tags.introduce,
          poemsCount: count(poemsToTags.poemId),
        })
        .from(tags)
        .leftJoin(poemsToTags, eq(tags.id, poemsToTags.tagId))
        .where(eq(tags.type, "词牌名"))
        .groupBy(tags.id)
        .orderBy(desc(count(poemsToTags.poemId)), asc(tags.name))
        .limit(ciPaiMingPageSize + 1)
        .offset((input.page - 1) * ciPaiMingPageSize);

      return {
        data: rows.slice(0, ciPaiMingPageSize),
        hasNext: rows.length > ciPaiMingPageSize,
      };
    }),
  ciPaiMingPageCount: publicProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db
      .select({ count: count() })
      .from(tags)
      .where(eq(tags.type, "词牌名"));

    return Math.ceil((result?.count ?? 0) / ciPaiMingPageSize);
  }),
  findBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const tag = await ctx.db.query.tags.findFirst({
        where: eq(tags.slug, input.slug),
        columns: {
          id: true,
          name: true,
          slug: true,
          type: true,
          introduce: true,
        },
      });
      if (!tag) return null;

      const [result] = await ctx.db
        .select({ count: count() })
        .from(poemsToTags)
        .where(eq(poemsToTags.tagId, tag.id));

      return { tag, poemsCount: result?.count ?? 0 };
    }),
  listPoemsByTag: publicProcedure
    .input(
      z.object({
        tagId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(tagPoemPageSize),
      }),
    )
    .query(async ({ ctx, input }) => {
      let where = eq(poemsToTags.tagId, input.tagId);
      if (input.cursor) {
        const [cursor] = await ctx.db
          .select({
            id: poems.id,
            authorName: authors.name,
            poemTitle: poems.title,
          })
          .from(poems)
          .innerJoin(authors, eq(poems.authorId, authors.id))
          .where(eq(poems.id, input.cursor))
          .limit(1);
        if (cursor) {
          where = and(
            where,
            or(
              gt(authors.name, cursor.authorName),
              and(
                eq(authors.name, cursor.authorName),
                or(
                  gt(poems.title, cursor.poemTitle),
                  and(
                    eq(poems.title, cursor.poemTitle),
                    gt(poems.id, cursor.id),
                  ),
                ),
              ),
            ),
          )!;
        }
      }

      const rows = await ctx.db
        .select({
          poemId: poems.id,
          authorName: authors.name,
          authorSlug: authors.slug,
          dynastyName: dynasties.name,
          poemTitle: poems.title,
          poemSlug: poems.slug,
        })
        .from(poemsToTags)
        .innerJoin(poems, eq(poemsToTags.poemId, poems.id))
        .innerJoin(authors, eq(poems.authorId, authors.id))
        .leftJoin(dynasties, eq(authors.dynastyId, dynasties.id))
        .where(where)
        .orderBy(asc(authors.name), asc(poems.title), asc(poems.id))
        .limit(input.limit + 1);
      const items = rows.slice();
      const nextCursor =
        items.length > input.limit ? items.pop()?.poemId : undefined;

      return {
        items,
        nextCursor,
      };
    }),
  findSlugById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.db.query.tags.findFirst({
        columns: { slug: true },
        where: eq(tags.id, input.id),
      }),
    ),
  sitemap: publicProcedure.query(async ({ ctx }) =>
    ctx.db.query.tags.findMany({
      columns: { slug: true, updatedAt: true },
      orderBy: [asc(tags.name)],
    }),
  ),
} satisfies TRPCRouterRecord;
