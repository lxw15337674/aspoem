import type { MetadataRoute } from "next";
import { env } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = env.BETTER_AUTH_URL ?? "https://aspoem.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/login", "/sign-up"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
