import { QuoteIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { publicApi as api } from "@/trpc/server";
import { CardLoadMore } from "./card-load-more";

export default async function Page() {
  const { items, nextCursor } = await api.card.list({ limit: 24 });

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex aspect-video items-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <QuoteIcon />
            </EmptyMedia>
            <EmptyTitle>暂无诗词片段</EmptyTitle>
            <EmptyDescription>
              片段将在内容管理后台生成后出现在这里。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">诗词片段</h1>
      </header>
      <CardLoadMore initialCards={items} nextCursor={nextCursor} />
    </div>
  );
}
