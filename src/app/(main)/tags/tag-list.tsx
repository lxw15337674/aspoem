"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadMoreControl } from "@/components/public/load-more-control";
import { api } from "@/trpc/react";

type Tag = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  poemsCount: number;
};

export function TagList({
  initialTags,
  nextCursor,
}: {
  initialTags: Tag[];
  nextCursor?: number;
}) {
  const [cursor, setCursor] = useState<number>();
  const [loadedTags, setLoadedTags] = useState<Tag[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState(nextCursor);
  const processedAt = useRef(0);
  const query = api.tag.listNonCiPai.useQuery(
    { cursor, limit: 24 },
    { enabled: cursor !== undefined },
  );

  useEffect(() => {
    if (
      cursor === undefined ||
      !query.data ||
      query.dataUpdatedAt === processedAt.current
    ) {
      return;
    }

    processedAt.current = query.dataUpdatedAt;
    setLoadedTags((items) => [...items, ...query.data.items]);
    setNextPageCursor(query.data.nextCursor);
    setCursor(undefined);
  }, [cursor, query.data, query.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (nextPageCursor !== undefined) setCursor(nextPageCursor);
  }, [nextPageCursor]);
  const tags = [...initialTags, ...loadedTags];
  const groups = new Map<string, Tag[]>();
  for (const tag of tags) {
    const type = tag.type || "其他";
    const items = groups.get(type);
    if (items) items.push(tag);
    else groups.set(type, [tag]);
  }

  return (
    <>
      <div className="space-y-10">
        {[...groups].map(([type, items]) => (
          <section key={type}>
            <h2 className="mb-4 text-lg font-semibold">{type}</h2>
            <div className="flex flex-wrap gap-2">
              {items.map((tag) => (
                <Link
                  className="border px-3 py-2 text-sm transition-colors hover:bg-accent"
                  href={`/tags/${tag.slug}`}
                  key={tag.id}
                  prefetch={false}
                >
                  {tag.name}
                  <span className="ml-2 text-muted-foreground">
                    {tag.poemsCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <LoadMoreControl
        hasNext={nextPageCursor !== undefined}
        isFetching={query.isFetching}
        onLoadMore={loadMore}
      />
    </>
  );
}
