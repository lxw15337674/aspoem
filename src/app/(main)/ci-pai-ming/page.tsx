import Link from "next/link";
import { publicApi as api } from "@/trpc/server";

export const revalidate = 600;

export default async function CiPaiMingPage() {
  const tags = await api.tag.listCiPaiMing();
  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <header className="mb-10 border-b pb-6">
        <p className="text-sm text-muted-foreground">诗词索引</p>
        <h1 className="mt-2 text-3xl font-semibold">词牌名</h1>
      </header>
      {tags.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Link
              className="border p-4 hover:bg-accent"
              href={`/tags/${tag.slug}`}
              key={tag.id}
            >
              <div className="font-semibold">{tag.name}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {tag.introduce || `${tag.poemsCount} 首作品`}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">暂无已分类的词牌名。</p>
      )}
    </main>
  );
}
