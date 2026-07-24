"use client";

import { BookOpenIcon, QuoteIcon, TagsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";

const destinations = [
  {
    key: "poems",
    label: "诗词",
    href: "/dashboard/poems/list",
    icon: BookOpenIcon,
  },
  { key: "authors", label: "诗人", href: "/authors", icon: UsersIcon },
  { key: "tags", label: "标签", href: "/dashboard/tags", icon: TagsIcon },
  { key: "cards", label: "片段", href: "/dashboard/cards", icon: QuoteIcon },
] as const;

export default function DashboardPage() {
  const { data, isLoading } = api.protectedContent.getOverview.useQuery();

  return (
    <main className="mx-auto w-full max-w-5xl py-8">
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">内容管理</p>
        <h1 className="mt-2 text-2xl font-semibold">资料库概览</h1>
      </header>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className="border p-5 transition-colors hover:bg-accent"
              href={item.href}
              key={item.key}
            >
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-8 text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">
                {isLoading ? "--" : data?.[item.key].toLocaleString()}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
