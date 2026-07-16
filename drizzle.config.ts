import { defineConfig } from "drizzle-kit";

// D1 = sqlite。生成的 SQL 用 `wrangler d1 migrations apply` 应用。
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle/migrations",
});
