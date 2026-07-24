import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicApi as api } from "@/trpc/server";

export async function CiPaiMingPageContent({ page }: { page: number }) {
  const { data: tags, hasNext } = await api.tag.listCiPaiMing({ page });
  if (page > 1 && tags.length === 0) notFound();

  const previousHref = page === 2 ? "/ci-pai-ming" : `/ci-pai-ming/${page - 1}`;
  const nextHref = `/ci-pai-ming/${page + 1}`;

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
              prefetch={false}
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
      <nav
        aria-label="词牌分页"
        className="mt-8 flex min-h-10 items-center justify-between"
      >
        {page > 1 ? (
          <Link
            className="flex items-center gap-2 text-sm hover:underline"
            href={previousHref}
            prefetch={false}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            上一页
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link
            className="flex items-center gap-2 text-sm hover:underline"
            href={nextHref}
            prefetch={false}
          >
            下一页
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </nav>
    </main>
  );
}
