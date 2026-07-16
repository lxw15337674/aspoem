import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./db/schema";

// Workers + 本地 miniflare 同走 D1 binding（wrangler.jsonc 的 d1_databases binding=DB）
export const db = drizzle(env.DB, { schema });

export type DB = typeof db;
export { schema };
