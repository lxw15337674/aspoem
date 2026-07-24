import type { TRPCRouterRecord } from "@trpc/server";
import { asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  authors,
  dynasties,
  poems,
  poemsToTags,
  tags,
} from "@/server/db/schema";
import { publicProcedure } from "../trpc";

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
  listCiPaiMing: tagList("词牌名"),
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

      const items = await ctx.db
        .select({
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
        .where(eq(poemsToTags.tagId, tag.id))
        .orderBy(asc(authors.name), asc(poems.title));

      return { tag, items };
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
