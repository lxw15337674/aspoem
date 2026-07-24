import { publicApi as api } from "@/trpc/server";
import { TagList } from "./tag-list";

export const revalidate = 600;

export default async function TagsPage() {
  const { items, nextCursor } = await api.tag.listNonCiPai({ limit: 24 });

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <header className="mb-10 border-b pb-6">
        <p className="text-sm text-muted-foreground">诗词索引</p>
        <h1 className="mt-2 text-3xl font-semibold">标签</h1>
      </header>
      <TagList initialTags={items} nextCursor={nextCursor} />
    </main>
  );
}
