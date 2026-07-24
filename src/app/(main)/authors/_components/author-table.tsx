"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadMoreControl } from "@/components/public/load-more-control";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";

interface Author {
  id: string;
  name: string;
  slug: string;
  introduce?: string | null;
  dynasty: {
    name: string;
    slug: string;
  };
  _count: {
    poems: number;
  };
}

interface AuthorTableProps {
  authors: Author[];
  dynastySlug?: string;
  nextCursor?: string;
}

export function AuthorTable({
  authors,
  dynastySlug,
  nextCursor,
}: AuthorTableProps) {
  const [cursor, setCursor] = useState<string>();
  const [loadedAuthors, setLoadedAuthors] = useState<Author[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState(nextCursor);
  const processedAt = useRef(0);
  const query = api.author.getList.useQuery(
    { cursor, dynastySlug, limit: 24 },
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
    setLoadedAuthors((items) => [...items, ...query.data.items]);
    setNextPageCursor(query.data.nextCursor);
    setCursor(undefined);
  }, [cursor, query.data, query.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (nextPageCursor) setCursor(nextPageCursor);
  }, [nextPageCursor]);
  const allAuthors = [...authors, ...loadedAuthors];

  return (
    <div className="space-y-12">
      <ScrollArea className="lg:h-[60vh] h-full w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/5">作者</TableHead>
              <TableHead className="w-1/5">朝代</TableHead>
              <TableHead className="w-1/5 text-center">作品数量</TableHead>
              <TableHead className="w-2/5 text-right">简介</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {allAuthors.map((author) => (
              <TableRow key={author.id}>
                <TableCell>
                  <Link
                    href={`/authors/detail/${author.slug}`}
                    prefetch={false}
                  >
                    {author.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/authors/dynasty/${author.dynasty.slug}`}
                    prefetch={false}
                  >
                    {author.dynasty.name}
                  </Link>
                </TableCell>
                <TableCell className="text-center w-20">
                  {author._count.poems}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  <div className="truncate">
                    {author.introduce || "暂无简介"}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <LoadMoreControl
        hasNext={!!nextPageCursor}
        isFetching={query.isFetching}
        onLoadMore={loadMore}
      />
    </div>
  );
}
