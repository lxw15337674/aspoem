import { QuoteIcon } from "lucide-react";
import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { publicApi as api } from "@/trpc/server";

export default async function Page() {
  const cards = await api.card.list({ limit: 24 });

  if (cards.length === 0) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            className="group min-h-80 border bg-card p-6 transition-colors hover:bg-accent"
            href={`/poems/detail/${card.poem.slug}`}
            key={card.id}
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
    </div>
  );
}
