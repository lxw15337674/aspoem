import { env } from "@/env";
import { publicApi as api } from "@/trpc/server";

const poemChunkSize = 25_000;
const siteUrl = env.BETTER_AUTH_URL ?? "https://aspoem.com";

function xmlResponse(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

function sitemapUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");
  const [poemCount, ciPaiMingPageCount] = await Promise.all([
    api.poem.sitemapCount(),
    api.tag.ciPaiMingPageCount(),
  ]);
  const pageCount = Math.max(1, Math.ceil(poemCount / poemChunkSize));

  if (pageValue === null) {
    const items = Array.from({ length: pageCount }, (_, page) => {
      const loc = sitemapUrl(`/sitemap.xml?page=${page}`);
      return `<sitemap><loc>${loc}</loc></sitemap>`;
    }).join("");
    return xmlResponse(
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`,
    );
  }

  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 0 || page >= pageCount) {
    return new Response("Not found", { status: 404 });
  }

  const [poems, authors, tags] = await Promise.all([
    api.poem.sitemap({ offset: page * poemChunkSize, limit: poemChunkSize }),
    page === pageCount - 1 ? api.author.sitemap() : [],
    page === pageCount - 1 ? api.tag.sitemap() : [],
  ]);
  const staticUrls =
    page === 0
      ? [
          "/poems",
          "/authors",
          "/tags",
          "/ci-pai-ming",
          "/quotes",
          ...Array.from(
            { length: Math.max(0, ciPaiMingPageCount - 1) },
            (_, index) => `/ci-pai-ming/${index + 2}`,
          ),
        ]
      : [];
  const entries = [
    ...staticUrls.map((path) => ({
      url: sitemapUrl(path),
      updatedAt: undefined,
    })),
    ...poems.map((poem) => ({
      url: sitemapUrl(`/poems/detail/${poem.slug}`),
      updatedAt: poem.updatedAt,
    })),
    ...authors.map((author) => ({
      url: sitemapUrl(`/authors/detail/${author.slug}`),
      updatedAt: author.updatedAt,
    })),
    ...tags.map((tag) => ({
      url: sitemapUrl(`/tags/${tag.slug}`),
      updatedAt: tag.updatedAt,
    })),
  ]
    .map(
      ({ url: entryUrl, updatedAt }) =>
        `<url><loc>${entryUrl}</loc>${updatedAt ? `<lastmod>${updatedAt.toISOString()}</lastmod>` : ""}</url>`,
    )
    .join("");

  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
  );
}
