"use client";

import { SaveIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

export default function TagsManagementPage() {
  const tags = api.protectedContent.listTags.useQuery();
  const updateTag = api.protectedContent.updateTag.useMutation({
    onSuccess: async () => tags.refetch(),
  });

  return (
    <main className="mx-auto w-full max-w-5xl py-8">
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">内容管理</p>
        <h1 className="mt-2 text-2xl font-semibold">标签与词牌</h1>
      </header>
      <div className="mt-6 space-y-3">
        {tags.data?.map((tag) => (
          <TagRow key={tag.id} onSave={updateTag.mutateAsync} tag={tag} />
        ))}
      </div>
    </main>
  );
}

function TagRow({
  onSave,
  tag,
}: {
  onSave: (input: {
    id: string;
    type: string | null;
    introduce: string | null;
  }) => Promise<unknown>;
  tag: {
    id: string;
    name: string;
    type: string | null;
    introduce: string | null;
    poemsCount: number;
  };
}) {
  const [type, setType] = useState(tag.type ?? "");
  const [introduce, setIntroduce] = useState(tag.introduce ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <section className="grid gap-3 border p-4 md:grid-cols-[minmax(10rem,1fr)_10rem_minmax(16rem,2fr)_auto] md:items-center">
      <div>
        <p className="font-medium">{tag.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tag.poemsCount} 首作品
        </p>
      </div>
      <Input
        onChange={(event) => setType(event.target.value)}
        placeholder="分类"
        value={type}
      />
      <Textarea
        className="min-h-9"
        onChange={(event) => setIntroduce(event.target.value)}
        placeholder="简介"
        rows={1}
        value={introduce}
      />
      <Button
        aria-label={`保存 ${tag.name}`}
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              id: tag.id,
              type: type || null,
              introduce: introduce || null,
            });
          } finally {
            setSaving(false);
          }
        }}
        size="icon"
        variant="outline"
      >
        <SaveIcon />
      </Button>
    </section>
  );
}
