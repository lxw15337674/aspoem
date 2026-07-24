import Link from "next/link";
import type { ApiPoemRelated } from "@/server/api/router/poem";

function RelatedGroup({
  items,
  title,
}: {
  items: ApiPoemRelated["sameAuthor"];
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-3 divide-y border-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              className="flex items-center justify-between gap-4 py-3 hover:text-primary"
              href={`/poems/detail/${item.slug}`}
            >
              <span>{item.title}</span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {item.dynastyName ? `${item.dynastyName} ` : ""}
                {item.authorName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RelatedPoems({ related }: { related: ApiPoemRelated }) {
  if (related.sameAuthor.length === 0 && related.sameTags.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="text-xl font-semibold">更多探索</h2>
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <RelatedGroup items={related.sameAuthor} title="同作者作品" />
        <RelatedGroup items={related.sameTags} title="同标签作品" />
      </div>
    </section>
  );
}
