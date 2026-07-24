import { notFound, permanentRedirect } from "next/navigation";
import { publicApi as api } from "@/trpc/server";

export default async function LegacyTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tag = await api.tag.findSlugById({ id });
  if (!tag) notFound();
  permanentRedirect(`/tags/${tag.slug}`);
}
