import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";
import type { AppRouter } from "@/server/api/root";
import { createCaller } from "@/server/api/root";

import { createTRPCContext } from "@/server/api/trpc";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { createQueryClient } from "./query-client";

import "server-only";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
    auth,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);

/**
 * 公开读页专用 caller：不读 headers()/session，页面因此可静态化 + ISR。
 * 只调用 public 过程（不含 protected）。登录态由客户端渲染，服务端内容无需 session。
 */
const createPublicContext = cache(async () => ({
  authApi: auth.api,
  session: null,
  db,
  headers: new Headers(),
  auth,
}));

export const publicApi = createCaller(createPublicContext);
