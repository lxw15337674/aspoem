import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicApi as api } from "@/trpc/server";
import { TagPoemLoadMore } from "./tag-poem-load-more";

export const revalidate = 600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await api.tag.findBySlug({ slug });
  if (!data) return { title: "标签不存在" };

  return {
    title: `${data.tag.name}诗词`,
    description: `${data.tag.type || "标签"}「${data.tag.name}」共收录 ${data.poemsCount} 首作品。`,
  };
}

export default async function TagDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await api.tag.findBySlug({ slug });
  if (!data) notFound();

  const { items, nextCursor } = await api.tag.listPoemsByTag({
    tagId: data.tag.id,
    limit: 48,
  });

  const byAuthor = new Map<string, (typeof items)[number][]>();
  for (const item of items) {
    const authorItems = byAuthor.get(item.authorSlug);
    if (authorItems) authorItems.push(item);
    else byAuthor.set(item.authorSlug, [item]);
  }

  const parentHref = data.tag.type === "词牌名" ? "/ci-pai-ming" : "/tags";

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <Link
        className="text-sm text-muted-foreground hover:underline"
        href={parentHref}
        prefetch={false}
      >
        {data.tag.type || "标签"}
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
        收录 {data.poemsCount} 首作品
      </p>
      <div className="mt-8 space-y-8">
        {[...byAuthor.values()].map((authorItems) => {
          const first = authorItems[0]!;
          return (
            <section key={first.authorSlug}>
              <h2 className="font-semibold">
                <Link
                  className="hover:underline"
                  href={`/authors/detail/${first.authorSlug}`}
                  prefetch={false}
                >
                  {first.dynastyName ? `${first.dynastyName} · ` : ""}
                  {first.authorName}
                </Link>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {authorItems.map((item) => (
                  <Link
                    className="border px-3 py-2 text-sm hover:bg-accent"
                    href={`/poems/detail/${item.poemSlug}`}
                    key={item.poemSlug}
                    prefetch={false}
                  >
                    {item.poemTitle}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <TagPoemLoadMore tagId={data.tag.id} nextCursor={nextCursor} />
    </main>
  );
}
