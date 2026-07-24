"use client";

import { Button } from "@/components/ui/button";

export function LoadMoreControl({
  hasNext,
  isFetching,
  onLoadMore,
}: {
  hasNext: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}) {
  if (!hasNext) return null;

  return (
    <div className="mt-10 flex justify-center">
      <Button
        disabled={isFetching}
        onClick={onLoadMore}
        size="lg"
        variant="secondary"
      >
        {isFetching ? "加载中..." : "加载更多"}
      </Button>
    </div>
  );
}
