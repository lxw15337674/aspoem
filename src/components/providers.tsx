"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/trpc/react";

// nextjs-toploader 在 vinext SSR 下会崩，仅客户端挂载
const NextTopLoader = dynamic(() => import("nextjs-toploader"), { ssr: false });

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname change triggers scroll reset
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <TRPCReactProvider>
      {children}

      <Toaster richColors position="top-right" />
      <NextTopLoader />
    </TRPCReactProvider>
  );
};
