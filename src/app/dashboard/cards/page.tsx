"use client";

import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

export default function CardsManagementPage() {
  const [query, setQuery] = useState("");
  const [poemId, setPoemId] = useState("");
  const [poemLabel, setPoemLabel] = useState("");
  const [content, setContent] = useState("");
  const cards = api.protectedContent.listCards.useQuery();
  const poems = api.poem.search.useQuery(
    { keyword: query },
    { enabled: query.trim().length > 0 },
  );
  const createCard = api.protectedContent.createCard.useMutation({
    onSuccess: async () => {
      setContent("");
      setPoemId("");
      setPoemLabel("");
      await cards.refetch();
    },
  });
  const deleteCard = api.protectedContent.deleteCard.useMutation({
    onSuccess: async () => cards.refetch(),
  });

  return (
    <main className="mx-auto w-full max-w-4xl py-8">
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">内容管理</p>
        <h1 className="mt-2 text-2xl font-semibold">片段</h1>
      </header>
      <form
        className="mt-8 space-y-3 border p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (poemId) void createCard.mutateAsync({ poemId, content });
        }}
      >
        <Input
          onChange={(event) => {
            setQuery(event.target.value);
            setPoemLabel(event.target.value);
          }}
          placeholder="搜索并选择诗词"
          value={poemLabel}
        />
        {query && !poemId && (
          <div className="max-h-48 overflow-y-auto border">
            {poems.data?.map((poem) => (
              <button
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                key={poem.id}
                onClick={() => {
                  setPoemId(poem.id);
                  setPoemLabel(`《${poem.title}》 ${poem.author.name}`);
                  setQuery("");
                }}
                type="button"
              >
                <span>《{poem.title}》</span>
                <span className="text-muted-foreground">
                  {poem.author.name}
                </span>
              </button>
            ))}
          </div>
        )}
        <Textarea
          onChange={(event) => setContent(event.target.value)}
          placeholder="片段正文"
          required
          rows={4}
          value={content}
        />
        <div className="flex justify-end">
          <Button disabled={!poemId || createCard.isPending} type="submit">
            创建片段
          </Button>
        </div>
      </form>
      <div className="mt-8 space-y-3">
        {cards.data?.map((card) => (
          <article
            className="flex items-start justify-between gap-4 border p-4"
            key={card.id}
          >
            <div>
              <Link
                className="font-medium hover:underline"
                href={`/poems/detail/${card.poemSlug}`}
              >
                《{card.poemTitle}》
              </Link>
              <p className="mt-3 whitespace-pre-wrap text-sm">{card.content}</p>
            </div>
            <Button
              aria-label={`删除 ${card.poemTitle} 片段`}
              onClick={() => deleteCard.mutate({ id: card.id })}
              size="icon"
              variant="ghost"
            >
              <TrashIcon />
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}
