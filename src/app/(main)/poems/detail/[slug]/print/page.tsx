import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { PrintAction } from "./_components/print-action";

export default async function PrintPoemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const poem = await api.poem.findDetail({ slug }).catch(() => null);
  if (!poem) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 print:max-w-none print:px-0">
      <style>{`@media print { header { display: none !important; } body { background: white !important; } }`}</style>
      <div className="mb-10 flex items-center justify-between border-b pb-5 print:hidden">
        <p className="text-sm text-muted-foreground">打印预览</p>
        <PrintAction />
      </div>
      <article className="font-serif text-lg leading-9">
        <header className="border-b pb-8 text-center">
          <h1 className="text-3xl font-semibold">《{poem.title}》</h1>
          <p className="mt-3 text-muted-foreground">
            {poem.dynasty?.name ?? ""} {poem.author.name}
          </p>
        </header>
        <p className="mt-10 whitespace-pre-wrap text-center">
          {poem.paragraphs.join("\n")}
        </p>
        {poem.translation && (
          <section className="mt-12 border-t pt-6 font-sans text-base leading-8">
            <h2 className="font-semibold">译文</h2>
            <p className="mt-3 whitespace-pre-wrap">{poem.translation}</p>
          </section>
        )}
        {poem.annotation && Object.keys(poem.annotation).length > 0 && (
          <section className="mt-8 border-t pt-6 font-sans text-base leading-8">
            <h2 className="font-semibold">注释</h2>
            <ul className="mt-3 list-disc pl-5">
              {Object.entries(poem.annotation).map(([term, explanation]) => (
                <li key={term}>
                  {term}：{explanation}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
