import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";

export default defineConfig({
  // 强制 zod 单实例（better-auth 需 v4 的 .meta()，避免被去重到残留 v3）
  resolve: { dedupe: ["zod"] },
  // vinext 提示：client 组件依赖优化不一致，排除以稳定 RSC/client 边界
  optimizeDeps: {
    exclude: [
      "@tanstack/react-query",
      "@trpc/react-query",
      "@trpc/client",
      "nextjs-toploader",
      "sonner",
    ],
  },
  plugins: [
    vinext({
      cache: { data: kvDataAdapter(), cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
