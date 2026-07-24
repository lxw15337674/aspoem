import { notFound, permanentRedirect } from "next/navigation";
import { publicApi as api } from "@/trpc/server";

export default async function LegacyAuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const author = await api.author.findSlugById({ id });
  if (!author) notFound();
  permanentRedirect(`/authors/detail/${author.slug}`);
}
