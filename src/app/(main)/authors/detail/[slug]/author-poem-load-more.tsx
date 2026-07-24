"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadMoreControl } from "@/components/public/load-more-control";
import { api } from "@/trpc/react";

type AuthorPoem = { id: string; slug: string; title: string };

export function AuthorPoemLoadMore({
  authorId,
  nextCursor,
}: {
  authorId: string;
  nextCursor?: string;
}) {
  const [cursor, setCursor] = useState<string>();
  const [poems, setPoems] = useState<AuthorPoem[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState(nextCursor);
  const processedAt = useRef(0);
  const query = api.author.listPoems.useQuery(
    { authorId, cursor, limit: 48 },
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
    setPoems((items) => [...items, ...query.data.items]);
    setNextPageCursor(query.data.nextCursor);
    setCursor(undefined);
  }, [cursor, query.data, query.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (nextPageCursor) setCursor(nextPageCursor);
  }, [nextPageCursor]);

  return (
    <section>
      <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3">
        {poems.map((poem) => (
          <Link
            className="line-clamp-1 hover:underline"
            href={`/poems/detail/${poem.slug}`}
            key={poem.id}
            prefetch={false}
          >
            {poem.title}
          </Link>
        ))}
      </div>
      <LoadMoreControl
        hasNext={!!nextPageCursor}
        isFetching={query.isFetching}
        onLoadMore={loadMore}
      />
    </section>
  );
}
