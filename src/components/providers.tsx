"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { Toaster } from "sonner";
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
      <TRPCReactProvider>
        {children}

        <Toaster richColors position="top-right" />
      </TRPCReactProvider>
    </ThemeProvider>
  );
};
