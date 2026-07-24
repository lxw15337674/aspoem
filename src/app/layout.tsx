import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { env } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL ?? "https://aspoem.com"),
  title: {
    default: "ASPOEM - 中文诗词阅读网站",
    template: "%s | ASPOEM",
  },
  description:
    "ASPOEM 是一个专注于中文古诗词的在线阅读平台，提供免费打印、拼音标注、详细注释、译文和赏析，让每个人都能轻松阅读中国古典诗词。",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "ASPOEM",
  },
  twitter: { card: "summary_large_image" },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>

        {env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && (
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
        )}
      </body>
    </html>
  );
}
