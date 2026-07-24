"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadMoreControl } from "@/components/public/load-more-control";
import { api } from "@/trpc/react";

type Card = {
  id: string;
  content: string;
  poem: {
    slug: string;
    title: string;
    author: { name: string };
  };
};

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <Link
          className="group min-h-80 border bg-card p-6 transition-colors hover:bg-accent"
          href={`/poems/detail/${card.poem.slug}`}
          key={card.id}
          prefetch={false}
        >
          <blockquote className="font-serif text-2xl leading-relaxed">
            {card.content}
          </blockquote>
          <p className="mt-8 text-sm text-muted-foreground">
            {card.poem.author.name}《{card.poem.title}》
          </p>
        </Link>
      ))}
    </div>
  );
}

export function CardLoadMore({
  initialCards,
  nextCursor,
}: {
  initialCards: Card[];
  nextCursor?: string;
}) {
  const [cursor, setCursor] = useState<string>();
  const [loadedCards, setLoadedCards] = useState<Card[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState(nextCursor);
  const processedAt = useRef(0);
  const query = api.card.list.useQuery(
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
    setLoadedCards((items) => [...items, ...query.data.items]);
    setNextPageCursor(query.data.nextCursor);
    setCursor(undefined);
  }, [cursor, query.data, query.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (nextPageCursor) setCursor(nextPageCursor);
  }, [nextPageCursor]);
  const cards = [...initialCards, ...loadedCards];

  return (
    <>
      <CardGrid cards={cards} />
      <LoadMoreControl
        hasNext={!!nextPageCursor}
        isFetching={query.isFetching}
        onLoadMore={loadMore}
      />
    </>
  );
}
