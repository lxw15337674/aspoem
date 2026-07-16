import { betterAuth } from "better-auth";

import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { headers } from "next/headers";
import { cache } from "react";

import { env } from "@/env";

import { db } from "../db";
import { account, session, user, verification } from "../db/schema";

import "server-only";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true },
  plugins: [admin()],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/sign-up")) {
        return;
      }

      const newSession = ctx.context.newSession;
      if (!newSession?.user) {
        return;
      }

      const { email, id } = newSession.user;
      if (email === env.ADMIN_EMAIL) {
        ctx.context.adapter.update({
          model: "user",
          where: [{ field: "id", value: id }],
          update: {
            role: "admin",
          },
        });
      }
    }),
  },
});

export type Auth = typeof auth;
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
