import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";

export default async function LocaleLegacyPage({
  params,
}: {
  params: Promise<{ lang: string; path: string[] }>;
}) {
  const { lang, path } = await params;
  if (!isLocale(lang)) notFound();

  const [resource, id] = path;
  if (resource === "poem" && id) permanentRedirect(`/poem/${id}`);
  if (resource === "author" && id) permanentRedirect(`/author/${id}`);
  if (resource === "tag" && id) permanentRedirect(`/tag/${id}`);
  if (resource === "ci-pai-ming") permanentRedirect("/ci-pai-ming");
  notFound();
}
