import { CiPaiMingPageContent } from "./ci-pai-ming-page";

export const revalidate = 600;
export const metadata = { title: "词牌名" };

export default function CiPaiMingPage() {
  return <CiPaiMingPageContent page={1} />;
}
