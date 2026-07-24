import { notFound } from "next/navigation";
import { publicApi as api } from "@/trpc/server";
import { AuthorTable } from "../../_components/author-table";

// ISR：读页缓存，降 D1 读压
export const revalidate = 600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await api.author.getList({ limit: 24, dynastySlug: slug });

  // 如果没有找到作者，返回404
  if (result.items.length === 0) {
    notFound();
  }

  const dynasty = result.items[0]?.dynasty;

  return (
    <>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl mb-4">
          [{dynasty?.name}
          {dynasty?.name.length === 1 ? "朝" : ""}] 诗人
        </h1>
        <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
          [{dynasty?.name}
          {dynasty?.name.length === 1 ? "朝" : ""}] 诗人作者，探索他们的文学成就
        </p>
      </div>

      <AuthorTable
        authors={result.items}
        dynastySlug={slug}
        nextCursor={result.nextCursor}
      />
    </>
  );
}

// 生成页面元数据
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;

  const result = await api.author.getList({ limit: 1, dynastySlug: slug });
  const dynasty = result.items[0]?.dynasty;

  if (!dynasty) {
    return {
      title: "朝代不存在",
    };
  }

  return {
    title: `${dynasty.name}朝代诗人列表`,
    description: `探索${dynasty.name}朝代的诗人作者，品味千年诗词文化`,
  };
}
