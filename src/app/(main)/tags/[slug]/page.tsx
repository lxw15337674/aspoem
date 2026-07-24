import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicApi as api } from "@/trpc/server";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await api.tag.findBySlug({ slug: params.slug });
  if (!data) return { title: "标签不存在" };
  return {
    title: `${data.tag.name}诗词`,
    description: `${data.tag.type || "标签"}「${data.tag.name}」共收录 ${data.items.length} 首作品。`,
  };
}

export default async function TagDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await api.tag.findBySlug({ slug: params.slug });
  if (!data) notFound();
  const byAuthor = new Map<string, (typeof data.items)[number][]>();
  for (const item of data.items) {
    byAuthor.set(item.authorSlug, [
      ...(byAuthor.get(item.authorSlug) ?? []),
      item,
    ]);
  }

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <Link
        className="text-sm text-muted-foreground hover:underline"
        href="/tags"
      >
        标签
      </Link>
      <header className="mt-5 border-b pb-6">
        <p className="text-sm text-muted-foreground">
          {data.tag.type || "其他"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{data.tag.name}</h1>
        {data.tag.introduce && (
          <p className="mt-4 max-w-2xl text-muted-foreground">
            {data.tag.introduce}
          </p>
        )}
      </header>
      <p className="mt-6 text-sm text-muted-foreground">
        收录 {data.items.length} 首作品
      </p>
      <div className="mt-8 space-y-8">
        {[...byAuthor.values()].map((items) => {
          const first = items[0]!;
          return (
            <section key={first.authorSlug}>
              <h2 className="font-semibold">
                <Link
                  className="hover:underline"
                  href={`/authors/detail/${first.authorSlug}`}
                >
                  {first.dynastyName ? `${first.dynastyName} · ` : ""}
                  {first.authorName}
                </Link>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {items.map((item) => (
                  <Link
                    className="border px-3 py-2 text-sm hover:bg-accent"
                    href={`/poems/detail/${item.poemSlug}`}
                    key={item.poemSlug}
                  >
                    {item.poemTitle}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
