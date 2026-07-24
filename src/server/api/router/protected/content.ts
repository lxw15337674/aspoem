import type { TRPCRouterRecord } from "@trpc/server";
import { count, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { authors, cards, poems, poemsToTags, tags } from "@/server/db/schema";
import { adminProcedure } from "../../trpc";

const poemInput = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(240),
  titleSlug: z.string().min(1).max(240),
  titlePinyin: z.string().min(1).max(500),
  paragraphs: z.array(z.string().min(1)).min(1),
  paragraphsPinyin: z.array(z.string()).default([]),
  translation: z.string().default(""),
  annotation: z.record(z.string(), z.string()).nullable().default(null),
  appreciation: z.string().default(""),
  isOrderliness: z.boolean().default(false),
  authorId: z.string().min(1),
  tagIds: z.array(z.string()).default([]),
});

function searchText(input: z.infer<typeof poemInput>) {
  return [input.title, input.paragraphs.join("\n"), input.translation]
    .filter(Boolean)
    .join("\n");
}

export const protectedContentRouter = {
  getOverview: adminProcedure.query(async ({ ctx }) => {
    const [[poemCount], [authorCount], [tagCount], [cardCount]] =
      await Promise.all([
        ctx.db.select({ value: count() }).from(poems),
        ctx.db.select({ value: count() }).from(authors),
        ctx.db.select({ value: count() }).from(tags),
        ctx.db.select({ value: count() }).from(cards),
      ]);

    return {
      poems: poemCount?.value ?? 0,
      authors: authorCount?.value ?? 0,
      tags: tagCount?.value ?? 0,
      cards: cardCount?.value ?? 0,
    };
  }),

  findAuthors: adminProcedure
    .input(z.object({ query: z.string().trim().max(80).default("") }))
    .query(async ({ ctx, input }) =>
      ctx.db.query.authors.findMany({
        columns: { id: true, name: true, slug: true, dynastyId: true },
        where: input.query ? like(authors.name, `%${input.query}%`) : undefined,
        orderBy: [desc(authors.visits), authors.name],
        limit: 100,
        with: { dynasty: { columns: { name: true } } },
      }),
    ),

  getPoem: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const poem = await ctx.db.query.poems.findFirst({
        where: eq(poems.id, input.id),
        with: {
          author: { columns: { id: true, name: true, dynastyId: true } },
          poemsToTags: { columns: {}, with: { tag: true } },
        },
      });
      if (!poem) return null;
      return { ...poem, tagIds: poem.poemsToTags.map((item) => item.tag.id) };
    }),

  createPoem: adminProcedure
    .input(poemInput)
    .mutation(async ({ ctx, input }) => {
      const author = await ctx.db.query.authors.findFirst({
        columns: { dynastyId: true },
        where: eq(authors.id, input.authorId),
      });
      if (!author) throw new Error("Author not found");

      const { tagIds, ...data } = input;
      const [poem] = await ctx.db
        .insert(poems)
        .values({
          ...data,
          dynastyId: author.dynastyId,
          searchText: searchText(input),
        })
        .returning({ id: poems.id });

      if (!poem) throw new Error("Poem creation failed");
      const uniqueTagIds = [...new Set(tagIds)];
      if (uniqueTagIds.length) {
        await ctx.db
          .insert(poemsToTags)
          .values(uniqueTagIds.map((tagId) => ({ poemId: poem.id, tagId })));
      }
      return poem;
    }),

  updatePoem: adminProcedure
    .input(z.object({ id: z.string(), data: poemInput }))
    .mutation(async ({ ctx, input }) => {
      const author = await ctx.db.query.authors.findFirst({
        columns: { dynastyId: true },
        where: eq(authors.id, input.data.authorId),
      });
      if (!author) throw new Error("Author not found");

      const { tagIds, ...data } = input.data;
      await ctx.db
        .update(poems)
        .set({
          ...data,
          dynastyId: author.dynastyId,
          searchText: searchText(input.data),
        })
        .where(eq(poems.id, input.id));
      await ctx.db.delete(poemsToTags).where(eq(poemsToTags.poemId, input.id));
      const uniqueTagIds = [...new Set(tagIds)];
      if (uniqueTagIds.length) {
        await ctx.db
          .insert(poemsToTags)
          .values(uniqueTagIds.map((tagId) => ({ poemId: input.id, tagId })));
      }
      return { id: input.id };
    }),

  deletePoems: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(poems).where(inArray(poems.id, input.ids)),
    ),

  listTags: adminProcedure.query(async ({ ctx }) =>
    ctx.db
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
      .groupBy(tags.id)
      .orderBy(desc(count(poemsToTags.poemId)), tags.name),
  ),

  updateTag: adminProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.string().trim().max(50).nullable(),
        introduce: z.string().trim().max(2000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tags)
        .set({ type: input.type || null, introduce: input.introduce || null })
        .where(eq(tags.id, input.id));
      return { id: input.id };
    }),

  listCards: adminProcedure.query(async ({ ctx }) =>
    ctx.db
      .select({
        id: cards.id,
        content: cards.content,
        template: cards.template,
        poemTitle: poems.title,
        poemSlug: poems.slug,
      })
      .from(cards)
      .innerJoin(poems, eq(cards.poemId, poems.id))
      .orderBy(desc(cards.createdAt)),
  ),

  createCard: adminProcedure
    .input(
      z.object({
        poemId: z.string(),
        content: z.string().trim().min(1).max(1000),
        template: z.string().trim().min(1).max(40).default("ink"),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(cards).values(input).returning({ id: cards.id }),
    ),

  deleteCard: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(cards).where(eq(cards.id, input.id)),
    ),
} satisfies TRPCRouterRecord;
