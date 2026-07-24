"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadMoreControl } from "@/components/public/load-more-control";
import { api } from "@/trpc/react";

type TagPoem = {
  poemId: string;
  authorName: string;
  authorSlug: string;
  dynastyName: string | null;
  poemTitle: string;
  poemSlug: string;
};

function TagPoemGroups({ items }: { items: TagPoem[] }) {
  const byAuthor = new Map<string, TagPoem[]>();
  for (const item of items) {
    const authorItems = byAuthor.get(item.authorSlug);
    if (authorItems) authorItems.push(item);
    else byAuthor.set(item.authorSlug, [item]);
  }

  return [...byAuthor.values()].map((authorItems) => {
    const first = authorItems[0]!;
    return (
      <section key={first.authorSlug}>
        <h2 className="font-semibold">
          <Link
            className="hover:underline"
            href={`/authors/detail/${first.authorSlug}`}
            prefetch={false}
          >
            {first.dynastyName ? `${first.dynastyName} · ` : ""}
            {first.authorName}
          </Link>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {authorItems.map((item) => (
            <Link
              className="border px-3 py-2 text-sm hover:bg-accent"
              href={`/poems/detail/${item.poemSlug}`}
              key={item.poemId}
              prefetch={false}
            >
              {item.poemTitle}
            </Link>
          ))}
        </div>
      </section>
    );
  });
}

export function TagPoemLoadMore({
  tagId,
  nextCursor,
}: {
  tagId: string;
  nextCursor?: string;
}) {
  const [cursor, setCursor] = useState<string>();
  const [items, setItems] = useState<TagPoem[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState(nextCursor);
  const processedAt = useRef(0);
  const query = api.tag.listPoemsByTag.useQuery(
    { cursor, tagId, limit: 48 },
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
    setItems((poems) => [...poems, ...query.data.items]);
    setNextPageCursor(query.data.nextCursor);
    setCursor(undefined);
  }, [cursor, query.data, query.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (nextPageCursor) setCursor(nextPageCursor);
  }, [nextPageCursor]);

  return (
    <section className="mt-8 space-y-8">
      <TagPoemGroups items={items} />
      <LoadMoreControl
        hasNext={!!nextPageCursor}
        isFetching={query.isFetching}
        onLoadMore={loadMore}
      />
    </section>
  );
}
