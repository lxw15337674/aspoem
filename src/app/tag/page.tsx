import { permanentRedirect } from "next/navigation";

export default function LegacyTagsPage() {
  permanentRedirect("/tags");
}
