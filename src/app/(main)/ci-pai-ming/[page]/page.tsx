import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CiPaiMingPageContent } from "../ci-pai-ming-page";

export const revalidate = 600;

function getPage(value: string) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 2) notFound();
  return page;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page: value } = await params;
  const page = getPage(value);

  return {
    title: `词牌名 第 ${page} 页`,
    alternates: { canonical: `/ci-pai-ming/${page}` },
  };
}

export default async function CiPaiMingPaginationPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: value } = await params;
  return <CiPaiMingPageContent page={getPage(value)} />;
}
