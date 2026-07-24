"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function Menu({ className }: { className?: string }) {
  const { dictionary } = useLocale();
  const menuItems = [
    { href: "/poems", label: dictionary.menu.poem },
    { href: "/authors", label: dictionary.menu.author },
    { href: "/ci-pai-ming", label: dictionary.menu.ci_pai_ming },
    { href: "/tags", label: dictionary.menu.tag },
    { href: "/quotes", label: dictionary.menu.fragment },
  ];

  return (
    <NavigationMenu className={cn("w-full", className)}>
      <NavigationMenuList className="flex-wrap">
        {menuItems.map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <Link href={item.href}>{item.label}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
