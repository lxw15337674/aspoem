import type { TRPCRouterRecord } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { authors, dynasties, poems } from "@/server/db/schema";
import { publicProcedure } from "../trpc";

// 一次分组查询算出每个作者的诗词数，避免 N+1
async function poemCountByAuthor(
  db: typeof import("@/server/db")["db"],
  authorIds: string[],
) {
  if (authorIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ authorId: poems.authorId, c: count() })
    .from(poems)
    .where(inArray(poems.authorId, authorIds))
    .groupBy(poems.authorId);
  return new Map(rows.map((r) => [r.authorId, r.c]));
}

const authorListColumns = {
  id: true,
  name: true,
  slug: true,
  introduce: true,
} as const;

const authorListWith = {
  dynasty: { columns: { name: true, slug: true } },
} as const;

const authorPageSize = 24;
const authorPoemPageSize = 48;

export const authorRouter = {
  // cursor分页接口
  getList: publicProcedure
    .input(
      z.object({
        dynastySlug: z.string().optional(),
        limit: z.number().min(1).max(100).default(authorPageSize),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { dynastySlug, limit, cursor } = input;

      let dynastyId: string | undefined;
      if (dynastySlug) {
        const d = await ctx.db.query.dynasties.findFirst({
          columns: { id: true },
          where: eq(dynasties.slug, dynastySlug),
        });
        dynastyId = d?.id ?? "__none__"; // 不存在则匹配空集
      }

      let where = dynastyId ? eq(authors.dynastyId, dynastyId) : undefined;
      if (cursor) {
        const c = await ctx.db.query.authors.findFirst({
          columns: { id: true, name: true },
          where: eq(authors.id, cursor),
        });
        if (c) {
          const keyset = or(
            gt(authors.name, c.name),
            and(eq(authors.name, c.name), gte(authors.id, cursor)),
          );
          where = where && keyset ? and(where, keyset) : (keyset ?? where);
        }
      }

      const rows = await ctx.db.query.authors.findMany({
        columns: authorListColumns,
        with: authorListWith,
        where,
        orderBy: [asc(authors.name), asc(authors.id)],
        limit: limit + 1,
      });

      let nextCursor: typeof cursor | undefined;
      if (rows.length > limit) {
        nextCursor = rows.pop()!.id;
      }

      const countMap = await poemCountByAuthor(
        ctx.db,
        rows.map((r) => r.id),
      );

      const items = rows.map((r) => ({
        ...r,
        _count: { poems: countMap.get(r.id) ?? 0 },
      }));

      return { items, nextCursor };
    }),

  // page分页接口
  getPagedList: publicProcedure
    .input(
      z.object({
        dynastySlug: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(24),
        page: z.number().min(1).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { dynastySlug, pageSize, page } = input;
      const skip = (page - 1) * pageSize;

      let dynastyId: string | undefined;
      if (dynastySlug) {
        const d = await ctx.db.query.dynasties.findFirst({
          columns: { id: true },
          where: eq(dynasties.slug, dynastySlug),
        });
        dynastyId = d?.id ?? "__none__";
      }
      const where = dynastyId ? eq(authors.dynastyId, dynastyId) : undefined;

      const [rows, [totalRow]] = await Promise.all([
        ctx.db.query.authors.findMany({
          columns: authorListColumns,
          with: authorListWith,
          where,
          orderBy: [asc(authors.name), asc(authors.id)],
          limit: pageSize,
          offset: skip,
        }),
        ctx.db.select({ c: count() }).from(authors).where(where),
      ]);

      const total = totalRow?.c ?? 0;

      const countMap = await poemCountByAuthor(
        ctx.db,
        rows.map((r) => r.id),
      );
      const items = rows.map((r) => ({
        ...r,
        _count: { poems: countMap.get(r.id) ?? 0 },
      }));

      const totalPages = Math.ceil(total / pageSize);

      return { items, pageSize, page, totalPages, total };
    }),

  findBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { slug } = input;

      const row = await ctx.db.query.authors.findFirst({
        where: eq(authors.slug, slug),
        columns: {
          id: true,
          name: true,
          slug: true,
          introduce: true,
          birthDate: true,
          deathDate: true,
        },
        with: { dynasty: { columns: { name: true, slug: true } } },
      });

      if (!row) return null;

      const [result] = await ctx.db
        .select({ count: count() })
        .from(poems)
        .where(eq(poems.authorId, row.id));

      return { ...row, _count: { poems: result?.count ?? 0 } };
    }),
  listPoems: publicProcedure
    .input(
      z.object({
        authorId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(authorPoemPageSize),
      }),
    )
    .query(async ({ ctx, input }) => {
      let where = eq(poems.authorId, input.authorId);
      if (input.cursor) {
        const cursor = await ctx.db.query.poems.findFirst({
          columns: { id: true, authorId: true, createdAt: true },
          where: eq(poems.id, input.cursor),
        });
        if (cursor?.authorId === input.authorId) {
          where = and(
            where,
            or(
              lt(poems.createdAt, cursor.createdAt),
              and(
                eq(poems.createdAt, cursor.createdAt),
                lte(poems.id, cursor.id),
              ),
            ),
          )!;
        }
      }

      const rows = await ctx.db.query.poems.findMany({
        columns: { id: true, slug: true, title: true },
        where,
        orderBy: [desc(poems.createdAt), desc(poems.id)],
        limit: input.limit + 1,
      });
      const items = rows.slice();
      const nextCursor =
        items.length > input.limit ? items.pop()?.id : undefined;

      return {
        items,
        nextCursor,
      };
    }),

  findSlugById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.db.query.authors.findFirst({
        columns: { slug: true },
        where: eq(authors.id, input.id),
      }),
    ),

  sitemap: publicProcedure.query(async ({ ctx }) =>
    ctx.db.query.authors.findMany({
      columns: { slug: true, updatedAt: true },
      orderBy: [asc(authors.name), asc(authors.id)],
    }),
  ),
} satisfies TRPCRouterRecord;
