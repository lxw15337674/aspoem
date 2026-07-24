import Link from "next/link";
import { publicApi as api } from "@/trpc/server";

export const revalidate = 600;

export default async function TagsPage() {
  const tags = await api.tag.list();
  const groups = new Map<string, (typeof tags)[number][]>();
  for (const tag of tags) {
    const type = tag.type || "其他";
    groups.set(type, [...(groups.get(type) ?? []), tag]);
  }

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <header className="mb-10 border-b pb-6">
        <p className="text-sm text-muted-foreground">诗词索引</p>
        <h1 className="mt-2 text-3xl font-semibold">标签</h1>
      </header>
      <div className="space-y-10">
        {[...groups].map(([type, items]) => (
          <section key={type}>
            <h2 className="mb-4 text-lg font-semibold">{type}</h2>
            <div className="flex flex-wrap gap-2">
              {items.map((tag) => (
                <Link
                  className="border px-3 py-2 text-sm transition-colors hover:bg-accent"
                  href={`/tags/${tag.slug}`}
                  key={tag.id}
                >
                  {tag.name}
                  <span className="ml-2 text-muted-foreground">
                    {tag.poemsCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
