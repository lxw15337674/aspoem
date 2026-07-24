import { authRouter } from "./router/auth";
import { authorRouter } from "./router/author";
import { cardRouter } from "./router/card";
import { dynastyRouter } from "./router/dynasty";
import { poemDiscoverRouter, poemRouter } from "./router/poem";
import { protectedContentRouter } from "./router/protected/content";
import { protectedDynastyRouter } from "./router/protected/dynasty";
import { protectedPoemRouter } from "./router/protected/poem";
import { tagRouter } from "./router/tag";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  poem: {
    ...poemDiscoverRouter,
    ...poemRouter,
  },
  dynasty: dynastyRouter,
  author: authorRouter,
  card: cardRouter,
  tag: tagRouter,
  protectedPoem: protectedPoemRouter,
  protectedDynasty: protectedDynastyRouter,
  protectedContent: protectedContentRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
