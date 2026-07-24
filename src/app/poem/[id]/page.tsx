import { notFound, permanentRedirect } from "next/navigation";
import { api } from "@/trpc/server";

export default async function LegacyPoemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poem = await api.poem.findDetail({ id }).catch(() => null);
  if (!poem) notFound();
  permanentRedirect(`/poems/detail/${poem.slug}`);
}
