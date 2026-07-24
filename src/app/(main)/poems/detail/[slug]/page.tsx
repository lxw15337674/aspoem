import Link from "next/link";
import { cache } from "react";
import { PoemTypography } from "@/components/poem-typography";
import { Button } from "@/components/ui/button";
import { SidebarContent, SidebarProvider } from "@/components/ui/sidebar";
import { api } from "@/trpc/server";
import { PoemTools } from "./_components/poem-tools";
import { RelatedPoems } from "./_components/related-poems";
import { SidebarRight } from "./_components/sidebar-right";

const getPoem = cache((slug: string) => api.poem.findDetail({ slug }));

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const poem = await getPoem(slug);

  return {
    title: `${poem.title} ${poem.dynasty?.name} ${poem.author.name} 拼音、注解、译文、赏析、打印`,
    description: `《${poem.title}》是${poem.dynasty?.name} ${poem.author.name}的作品，提供拼音、注解、译文、赏析、打印等内容，方便阅读。`,
    openGraph: {
      images: [`/poems/detail/${poem.slug}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/poems/detail/${poem.slug}/opengraph-image`],
    },
  };
};

export default async function PoemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const poem = await getPoem(slug);
  const related = await api.poem.findRelated({ id: poem.id });

  return (
    <div className="flex flex-col flex-1">
      <SidebarProvider className="relative container-wrapper">
        <SidebarContent className="pb-12">
          <PoemTypography poem={poem} />

          <div className="max-w-screen-md w-full mx-auto">
            <div className="flex gap-2 flex-wrap">
              {poem.tags.map((tag) => (
                <Button asChild key={tag.slug} variant="secondary">
                  <Link href={`/tags/${tag.slug}`}>{tag.name}</Link>
                </Button>
              ))}
            </div>

            <section className="prose font-sans max-w-none mt-8">
              {poem.translation && (
                <>
                  <h2>译文</h2>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: poem.translation.replaceAll("\n", "<br/>"),
                    }}
                  />
                </>
              )}

              {poem.annotation && (
                <>
                  <h2>注解</h2>
                  <ul>
                    {Object.entries(poem.annotation || {}).map(
                      ([key, value]) => (
                        <li key={key}>
                          {key}：{value}
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {poem.appreciation && (
                <>
                  <h2>解析</h2>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: poem.appreciation.replaceAll("\n", "<br/>"),
                    }}
                  />
                </>
              )}

              <div className="not-prose mt-8 border-t pt-5">
                <PoemTools poem={poem} />
              </div>

              <hr className="mb-4" />
              <p className="text-muted-foreground text-right text-sm">
                最后更新：
                <time suppressHydrationWarning>
                  {new Date(poem.updatedAt).toLocaleString("zh-CN")}
                </time>
              </p>
            </section>

            <RelatedPoems related={related} />
          </div>
        </SidebarContent>

        <SidebarRight poem={poem} />
      </SidebarProvider>
    </div>
  );
}
