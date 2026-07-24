"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/i18n/provider";
import { TRPCReactProvider } from "@/trpc/react";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname change triggers scroll reset
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LocaleProvider>
        <TRPCReactProvider>
          {children}

          <Toaster richColors position="top-right" />
        </TRPCReactProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
};
