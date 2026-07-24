import { publicApi as api } from "@/trpc/server";
import { AuthorTable } from "./_components/author-table";

// ISR：读页缓存，降 D1 读压
export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{
    dynasty?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const dynastySlug = params.dynasty;
  const result = await api.author.getList({ limit: 24, dynastySlug });

  return (
    <>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl mb-4">
          {dynastySlug
            ? `${result.items[0]?.dynasty.name}朝代诗人`
            : "诗人作者"}
        </h1>
        <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
          {dynastySlug
            ? `${result.items[0]?.dynasty.name}朝代诗人作者，探索他们的文学成就`
            : "探索历代文人墨客，品味千年诗词文化"}
        </p>
      </div>

      <AuthorTable
        authors={result.items}
        dynastySlug={dynastySlug}
        nextCursor={result.nextCursor}
      />
    </>
  );
}

// 生成页面元数据
export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams;
  const dynastySlug = params.dynasty;

  if (dynastySlug) {
    try {
      const result = await api.author.getList({ limit: 1, dynastySlug });
      const dynastyName = result.items[0]?.dynasty.name;

      return {
        title: `${dynastyName}朝代诗人列表`,
        description: `探索${dynastyName}朝代的诗人作者，品味千年诗词文化`,
      };
    } catch {
      return {
        title: "朝代不存在",
      };
    }
  }

  return {
    title: "诗人作者",
    description: "探索历代文人墨客，品味千年诗词文化",
  };
}
