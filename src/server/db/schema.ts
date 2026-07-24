import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// 时间戳默认值（sqlite 存 unix 秒）
const now = () => sql`(unixepoch())`;

// ----------------------------------------------------------------------------
// 内容表
// ----------------------------------------------------------------------------

export const dynasties = sqliteTable("dynasties", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  pinyin: text("pinyin").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
});

export const authors = sqliteTable("authors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  pinyin: text("pinyin").notNull(),
  slug: text("slug").notNull().unique(),
  birthDate: integer("birthDate", { mode: "timestamp" }),
  deathDate: integer("deathDate", { mode: "timestamp" }),
  introduce: text("introduce"),
  // sqlite 无标量数组，存 JSON
  epithets: text("epithets", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  style: text("style"),
  visits: integer("visits").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
  dynastyId: text("dynastyId")
    .notNull()
    .references(() => dynasties.id),
});

export const tags = sqliteTable("tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type"),
  introduce: text("introduce"),
  visits: integer("visits").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
});

export const cards = sqliteTable(
  "cards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    content: text("content").notNull(),
    template: text("template").notNull().default("ink"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(now()),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(now())
      .$onUpdate(() => new Date()),
    poemId: text("poemId")
      .notNull()
      .references(() => poems.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("cards_poemId_createdAt_idx").on(table.poemId, table.createdAt),
  ],
);

export const contentSyncState = sqliteTable("content_sync_state", {
  source: text("source").primaryKey(),
  revision: text("revision").notNull(),
  syncedAt: integer("syncedAt", { mode: "timestamp" }).notNull().default(now()),
  details: text("details").notNull(),
});

export const poems = sqliteTable("poems", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  titleSlug: text("titleSlug").notNull(),
  titlePinyin: text("titlePinyin").notNull(),
  // sqlite 无标量数组，存 JSON
  paragraphs: text("paragraphs", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  paragraphsPinyin: text("paragraphsPinyin", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  // 注解，任意 JSON
  annotation: text("annotation", { mode: "json" }),
  translation: text("translation").notNull().default(""),
  appreciation: text("appreciation").notNull().default(""),
  isOrderliness: integer("isOrderliness", { mode: "boolean" })
    .notNull()
    .default(false),
  searchText: text("searchText"),
  visits: integer("visits").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  authorId: text("authorId")
    .notNull()
    .references(() => authors.id),
  dynastyId: text("dynastyId").references(() => dynasties.id),
});

// m2m 结点表（Drizzle 无隐式多对多，需显式）
export const poemsToTags = sqliteTable(
  "poems_to_tags",
  {
    poemId: text("poemId")
      .notNull()
      .references(() => poems.id, { onDelete: "cascade" }),
    tagId: text("tagId")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.poemId, t.tagId] })],
);

// ----------------------------------------------------------------------------
// 关系
// ----------------------------------------------------------------------------

export const dynastiesRelations = relations(dynasties, ({ many }) => ({
  authors: many(authors),
  poems: many(poems),
}));

export const authorsRelations = relations(authors, ({ one, many }) => ({
  dynasty: one(dynasties, {
    fields: [authors.dynastyId],
    references: [dynasties.id],
  }),
  poems: many(poems),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  poemsToTags: many(poemsToTags),
}));

export const poemsRelations = relations(poems, ({ one, many }) => ({
  author: one(authors, {
    fields: [poems.authorId],
    references: [authors.id],
  }),
  dynasty: one(dynasties, {
    fields: [poems.dynastyId],
    references: [dynasties.id],
  }),
  poemsToTags: many(poemsToTags),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  poem: one(poems, {
    fields: [cards.poemId],
    references: [poems.id],
  }),
}));

export const poemsToTagsRelations = relations(poemsToTags, ({ one }) => ({
  poem: one(poems, {
    fields: [poemsToTags.poemId],
    references: [poems.id],
  }),
  tag: one(tags, {
    fields: [poemsToTags.tagId],
    references: [tags.id],
  }),
}));

// ----------------------------------------------------------------------------
// better-auth 表（对齐 prisma/better-auth.prisma + admin plugin 字段）
// ----------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("banReason"),
  banExpires: integer("banExpires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(now()),
});

// 便捷类型
export type Poem = typeof poems.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Dynasty = typeof dynasties.$inferSelect;
