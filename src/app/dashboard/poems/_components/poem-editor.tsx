"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

type EditorState = {
  title: string;
  slug: string;
  titleSlug: string;
  titlePinyin: string;
  paragraphs: string;
  paragraphsPinyin: string;
  translation: string;
  annotation: string;
  appreciation: string;
  authorId: string;
  tagIds: string[];
  isOrderliness: boolean;
};

const emptyState: EditorState = {
  title: "",
  slug: "",
  titleSlug: "",
  titlePinyin: "",
  paragraphs: "",
  paragraphsPinyin: "",
  translation: "",
  annotation: "",
  appreciation: "",
  authorId: "",
  tagIds: [],
  isOrderliness: false,
};

export function PoemEditor({ poemId }: { poemId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<EditorState>(emptyState);
  const [authorQuery, setAuthorQuery] = useState("");
  const [error, setError] = useState("");
  const poemQuery = api.protectedContent.getPoem.useQuery(
    { id: poemId ?? "" },
    { enabled: Boolean(poemId) },
  );
  const authorsQuery = api.protectedContent.findAuthors.useQuery({
    query: authorQuery,
  });
  const tagsQuery = api.protectedContent.listTags.useQuery();
  const createPoem = api.protectedContent.createPoem.useMutation();
  const updatePoem = api.protectedContent.updatePoem.useMutation();

  useEffect(() => {
    const poem = poemQuery.data;
    if (!poem) return;
    setForm({
      title: poem.title,
      slug: poem.slug,
      titleSlug: poem.titleSlug,
      titlePinyin: poem.titlePinyin,
      paragraphs: poem.paragraphs.join("\n"),
      paragraphsPinyin: poem.paragraphsPinyin.join("\n"),
      translation: poem.translation,
      annotation: poem.annotation
        ? JSON.stringify(poem.annotation, null, 2)
        : "",
      appreciation: poem.appreciation,
      authorId: poem.authorId,
      tagIds: poem.tagIds,
      isOrderliness: poem.isOrderliness,
    });
    setAuthorQuery(poem.author.name);
  }, [poemQuery.data]);

  const selectedAuthor = authorsQuery.data?.find(
    (author) => author.id === form.authorId,
  );

  function setValue<Key extends keyof EditorState>(
    key: Key,
    value: EditorState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((item) => item !== tagId)
        : [...current.tagIds, tagId],
    }));
  }

  async function save() {
    setError("");
    let annotation: Record<string, string> | null = null;
    try {
      annotation = form.annotation.trim()
        ? (JSON.parse(form.annotation) as Record<string, string>)
        : null;
    } catch {
      setError("注释必须是有效的 JSON 对象。");
      return;
    }

    const data = {
      title: form.title,
      slug: form.slug,
      titleSlug: form.titleSlug,
      titlePinyin: form.titlePinyin,
      paragraphs: form.paragraphs.split("\n").filter(Boolean),
      paragraphsPinyin: form.paragraphsPinyin.split("\n").filter(Boolean),
      translation: form.translation,
      annotation,
      appreciation: form.appreciation,
      authorId: form.authorId,
      tagIds: form.tagIds,
      isOrderliness: form.isOrderliness,
    };

    try {
      if (poemId) {
        await updatePoem.mutateAsync({ id: poemId, data });
      } else {
        await createPoem.mutateAsync(data);
      }
      router.push("/dashboard/poems/list");
      router.refresh();
    } catch {
      setError("保存失败，请检查必填字段、链接和标签。\n");
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-4xl space-y-8 py-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">内容管理</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {poemId ? "编辑诗词" : "新建诗词"}
        </h1>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="标题">
          <Input
            required
            value={form.title}
            onChange={(event) => setValue("title", event.target.value)}
          />
        </Field>
        <Field label="链接标识">
          <Input
            required
            value={form.slug}
            onChange={(event) => setValue("slug", event.target.value)}
          />
        </Field>
        <Field label="标题拼音">
          <Input
            required
            value={form.titlePinyin}
            onChange={(event) => setValue("titlePinyin", event.target.value)}
          />
        </Field>
        <Field label="文件标识">
          <Input
            required
            value={form.titleSlug}
            onChange={(event) => setValue("titleSlug", event.target.value)}
          />
        </Field>
      </div>
      <Field label="作者">
        <Input
          value={authorQuery}
          onChange={(event) => setAuthorQuery(event.target.value)}
          placeholder="搜索并选择作者"
        />
        <div className="mt-2 max-h-40 overflow-y-auto border">
          {authorsQuery.data?.map((author) => (
            <button
              className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              key={author.id}
              onClick={() => {
                setValue("authorId", author.id);
                setAuthorQuery(author.name);
              }}
              type="button"
            >
              <span>{author.name}</span>
              <span className="text-muted-foreground">
                {author.dynasty?.name ?? ""}
              </span>
            </button>
          ))}
        </div>
        {selectedAuthor && (
          <p className="mt-2 text-sm text-muted-foreground">
            已选择：{selectedAuthor.name}
          </p>
        )}
      </Field>
      <Field label="正文（每段一行)">
        <Textarea
          required
          rows={8}
          value={form.paragraphs}
          onChange={(event) => setValue("paragraphs", event.target.value)}
        />
      </Field>
      <Field label="正文拼音（每段一行）">
        <Textarea
          rows={5}
          value={form.paragraphsPinyin}
          onChange={(event) => setValue("paragraphsPinyin", event.target.value)}
        />
      </Field>
      <Field label="译文">
        <Textarea
          rows={6}
          value={form.translation}
          onChange={(event) => setValue("translation", event.target.value)}
        />
      </Field>
      <Field label="注释（JSON 对象）">
        <Textarea
          className="font-mono text-sm"
          rows={6}
          value={form.annotation}
          onChange={(event) => setValue("annotation", event.target.value)}
        />
      </Field>
      <Field label="赏析">
        <Textarea
          rows={8}
          value={form.appreciation}
          onChange={(event) => setValue("appreciation", event.target.value)}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={form.isOrderliness}
          id="is-orderliness"
          onCheckedChange={(value) => setValue("isOrderliness", value === true)}
        />
        <Label htmlFor="is-orderliness">格律诗排版</Label>
      </div>
      <Field label="标签">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {tagsQuery.data?.map((tag) => (
            <label
              className="flex items-center gap-2 border px-3 py-2 text-sm"
              htmlFor={`tag-${tag.id}`}
              key={tag.id}
            >
              <Checkbox
                checked={form.tagIds.includes(tag.id)}
                id={`tag-${tag.id}`}
                onCheckedChange={() => toggleTag(tag.id)}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </Field>
      {error && (
        <p className="border border-destructive/50 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t pt-6">
        <Button onClick={() => router.back()} type="button" variant="outline">
          取消
        </Button>
        <Button
          disabled={createPoem.isPending || updatePoem.isPending}
          type="submit"
        >
          保存
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
