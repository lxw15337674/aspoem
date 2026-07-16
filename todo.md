# Cloudflare 迁移清单

目标：aspoem 迁到 Cloudflare。Next.js → vinext，Postgres → D1，部署 Workers。保留 webhook 自动同步。暂不管 CI。

## 决策

- **运行时**：vinext（Cloudflare 的 Vite 版 Next.js 重实现，同 API 面）+ Cloudflare Workers。beta，需实测。
- **DB**：D1（SQLite）+ **Drizzle ORM**（`drizzle-orm/d1`）。read-heavy 契合，成本低，Drizzle 原生贴 D1。
- **ORM 决策**：弃 Prisma 改 **Drizzle**。8 表（4 内容 + 4 auth）、47 查询点、7 脚本、m2m Poem↔Tag 需重写。
- **读路径**：ISR + KV 缓存。
- **写路径**：webhook 验签入队 → Cloudflare Queues consumer 分片写 D1（批量 push 会超 1000 subrequest 墙，必须分片）。
- **webhook**：保留。源仓库 `meetqy/aspoem-backup`，push 同步 `poems/*.md` 进库。

## 关键事实

- 无 `generateStaticParams` → 没用 SSG，vinext 无构建预渲染的短板对本项目无影响。
- 搜索是 `searchText: { contains }`（SQL LIKE），非 Postgres 全文检索 → D1 LIKE 直接兼容，无需 FTS5。
- `String[]`/`Json` 引用面小（~4 处）。
- push 规模两极：日常 1-4 首，批量导入 62/69/73/86/100/207 首。每首 ~7-11 次 D1 操作 → 207 首 ≈ 1650 subrequests，超 1000 付费墙。
- Workers 付费：CPU 可提到 300s，含 Queues（1M 操作/月免费额度覆盖）。

---

## 阶段 0：vinext 兼容 spike（闸门）✅ 通过

- [x] 新分支 `feat/cf-migration`
- [x] `vinext check`：98% 兼容，0 issue，better-auth ✓，10/10 库兼容
- [x] `vinext init --platform=cloudflare`（workers-cache + kv + none）→ 生成 vite.config.ts / wrangler.jsonc
- [x] 装齐 deps：vinext / @vinext/cloudflare / react-server-dom-webpack / vite / @cloudflare/vite-plugin / @vitejs/plugin-react / @vitejs/plugin-rsc / wrangler
- [x] `vinext build` 成功：16 路由 + auth/trpc/webhook 三 handler 全编译，RSC/client/SSR 四环境通过
- [ ] **DB 运行时验证延后到阶段 2**（Workers 跑不了原生 Prisma TCP，需 D1 adapter 后才能真跑 tRPC 读）
- 结论：编译闸通过，继续

### 待办小项（spike 中发现）

- `postinstall` 的 `format:db` 会卡 env 校验；已建本地 `.env`（dummy）。迁移收尾时评估 postinstall 是否保留
- peer 警告（react 19.2.0 vs 19.2.6、better-auth vs next16、trpc 11.5.1 vs 11.6）非阻塞
- pnpm 需 approve/rebuild `esbuild`/`workerd`/`@tailwindcss/oxide`（已 rebuild）；建议写进 package.json `pnpm.onlyBuiltDependencies`
- `next/font/google` partial（CDN 加载），收尾时确认字体正常

## ✅ 阶段 1+2+2.5 完成：dev + 生产（真 Workers 运行时）全通

端到端验证（`vinext build` + `wrangler dev` on dist）：

- `/poems`、`/authors`、`/poems/hot` 渲染 D1 数据（李白/静夜思/思乡）
- `/login`、`/dashboard` 200
- tRPC API 200，含 `_count` 映射、keyset 分页、search like
- better-auth 加载正常

### 迁移中发现并修复的坑

1. **zod v3/v4 冲突**：better-auth 1.3 需 `zod ^4.1.5` 的 `.meta()`，但 Vite 把 zod 去重到残留 v3.25 → 全页 500。修：app 升 `zod@4.1.9` + `vite.config resolve.dedupe:["zod"]` + `trpc.ts` 的 `zod/v4` 改 `zod`。
2. **nextjs-toploader SSR 崩**：vinext SSR 下渲染即 500（访问 window/document）。修：`providers.tsx` 用 `next/dynamic(..., {ssr:false})` 仅客户端挂载。
3. **drizzle-kit/orm 版本仲裁乱**（1.0-rc 线 vs latest 标签滞后）：放弃 `drizzle-kit generate`，手写基线迁移 `drizzle/migrations/0000_init.sql`，`wrangler d1 migrations apply` 应用。
4. **本地 D1 persist 路径**：`vinext dev`（miniflare）与 `wrangler dev --config dist/...` 用不同 D1 实例，各自需 apply 迁移 + seed。
5. `next/font/google` partial（vinext 标）实测不影响，保留。

---

## 阶段 1：Drizzle schema（替 Prisma）

- [ ] 装 `drizzle-orm` + `drizzle-kit`（dev）+ `@paralleldrive/cuid2`
- [x] 写 `src/server/db/schema.ts`（内容 4 表 + `poemsToTags` 结点表 + auth 4 表，auth 手写对齐 better-auth.prisma）
- [x] 数组→`text({mode:'json'})`，bool→`integer boolean`，日期→`integer timestamp`，cuid→`$defaultFn(createId)`
- [x] 写 `relations()`
- [x] `searchText` 搜索改 Drizzle `like()`
- [x] **收尾清理完成**：删 `prisma/` 目录、`@prisma/client`、`prisma`、`@auth/prisma-adapter`；package.json scripts 改 drizzle/wrangler；删 postinstall（原跑 prisma generate + format:db）；build 改 `vinext build`。build 通过

## 阶段 2：Drizzle client + D1 binding ✅

- [x] `src/server/db.ts`：`drizzle(env.DB, { schema })`（`cloudflare:workers`）
- [x] wrangler 配 D1 binding（binding=`DB`，database_id 占位待部署填）
- [x] 手写 `drizzle/migrations/0000_init.sql` → `wrangler d1 migrations apply --local`（drizzle-kit 版本坑，改手写）
- [x] `better-auth`：`drizzleAdapter(db, {provider:'sqlite', schema})`
- [x] tRPC 读路径连本地 D1 冒烟（dev + 生产均通）

## 阶段 2.5：重写查询点 ✅（app 侧）

- [x] tRPC routers：`author.ts`、`dynasty.ts`、`poem/index.ts`、`poem/discover.ts`、`protected/poem.ts`、`protected/dynasty.ts`（keyset 分页 + `_count` 分组统计 + `_helpers.ts`）
- [x] 写路径：`lib/sync-poem-to-db.ts`（手动 m2m upsert + 关联重置）
- [x] `webhoook.ts` 删除逻辑、`ast-markdown.ts`/`columns.tsx` 类型改 schema 推断
- [x] **脚本全转完**（7 个）：`poems-to-db`、`format-db/*`（delete-without-content/sync-poem-dynasty/migrate-dai-xu）、`update-db-is-orderliness`、`update-db-make-search-index`、`rank.ts`
  - node 侧 `scripts/db.ts`：Node 内置 `node:sqlite`（免装 better-sqlite3）+ drizzle `better-sqlite3` 驱动 + 自写 `.raw()` shim，指向 miniflare 本地 D1
  - `syncPoemToDatabase(db, data)` 重构收 db 参数（webhook 传 Workers D1，脚本传 node db）
  - 实测：orderliness 脚本 + syncPoemToDatabase 写入（insert + m2m + 复用标签/朝代）全通
  - 跑法：`NODE_OPTIONS=--experimental-sqlite pnpm gen:db`（seed 需 `../aspoem-backup/poems`）

## 阶段 3：灌数据（~~Postgres ETL~~ → markdown 仓库 seed）

**修正**：没有真实 Postgres。数据真源 = markdown 仓库 `meetqy/aspoem-backup`（`poems/*.md`）。
无需 Postgres ETL，灌库 = 跑已转好的 `gen:db`（读 markdown → syncPoemToDatabase → D1）。

- 本地：`git clone` 仓库到 `../aspoem-backup` → `pnpm exec wrangler d1 migrations apply aspoem --local` → `NODE_OPTIONS=--experimental-sqlite pnpm gen:db`
- 远程 D1：部署后由 webhook 真实 push 同步，或 seed 到 local.db 后 `wrangler d1` 导入
- 脚本已就绪（阶段 2.5 转好并测过），仅需仓库 + 执行

### ~~旧 ETL 计划（作废）~~

- ~~读 Postgres 全量、转换数组/日期/bool、导入 D1~~
- [ ] 导入 D1（外键顺序 dynasty→author→tag→poem→poemsToTags）
- [ ] 校验：条数、抽样字段、搜索 like、m2m 标签

## 阶段 4：vinext 全量接入

- [ ] 逐路由迁移剩余页面（dashboard/games/quotes/ai-generator）
- [ ] `next.config.js` → vinext 配置
- [ ] `next/*` 导入检查覆盖（image 优化改 CF image binding）
- [ ] `visits` 自增：保持 D1 直写，标记可选优化（挪 KV）

## 阶段 5：Webhook 写路径 ✅（自扇出，非 Queues）

**关键决策**：vinext beta 不支持自定义 Worker handler（main 固定 `vinext/server/fetch-handler`，只导出 fetch），Queue consumer 需自定义入口 → 放弃 Queues，改 **vinext 兼容的自扇出**。

- [x] `src/lib/webhook-sync.ts`：WebCrypto HMAC 验签（对照 node crypto 完全一致）；`atob`+TextDecoder 解 base64（无 Buffer）；`syncFiles`/`handleDeletedFiles`/`chunk`
- [x] `src/app/api/webhook/route.ts`：验签 → 立即 200 → `after()`（vinext next/server 已导出）里删除 + 分块扇出
- [x] `src/app/api/webhook/process/route.ts`：内部端点，`x-internal-secret` 校验，每块 ≤20 文件（≈160 subrequest，安全），独立 Worker 调用各有 1000 预算
- [x] 删旧 tRPC `webhoook.ts` router + 从 root 移除 + 删 `@octokit/webhooks` 依赖（换 WebCrypto）
- [x] 实测：webhook 200 `{queued,removed}`；/process 401 无密钥、200 带密钥；`after()` 扇出真打到 /process；Octokit 在 workerd 发起真实 GitHub 调用（占位 token 得 401，逻辑路径证）
- [ ] **待真实部署验证**：真 GITHUB_TOKEN 下的拉取+解码+写库（syncPoemToDatabase 已独立测过）
- 备注：207 文件 → 11 块 × 独立请求，避开 1000 subrequest 墙。无 Queues 的自动重试/DLQ，如需可在扇出循环加重试

## 阶段 6：读路径缓存 ✅

**根因**：tRPC server caller 的 `createTRPCContext` 调 `getSession` 读 `headers()` → 所有用 `api` 的页面变 dynamic，无法缓存。

- [x] `src/trpc/server.tsx` 加 `publicApi`：无 session context（不读 headers），公开读页用它
- [x] 6 读页改 `import { publicApi as api }` + `export const revalidate = 600`：`/poems`、`/poems/hot`、`/poems/dynasty/:slug`、`/authors`、`/authors/detail/:slug`、`/authors/dynasty/:slug`
- [x] 对应 2 layout（authors/poems-list）也换 publicApi（否则 layout 读 headers 仍强制 dynamic）
- [x] build 验证：6 页 → **◐ ISR (600s)**；`/poems/detail`（visits 写）保持 ƒ Dynamic；`/random` dynamic
- [x] dev 实测：ISR 页 200 + 数据正确（publicApi 无 session 返对数据）
- vinext init 已挂 KV data cache + workers-cache CDN（vite.config）
- 备注：detail 页缓存需先把 visits 挪客户端 beacon（现留 dynamic 保计数准）

## 阶段 7：密钥 / 环境 ✅（代码侧）

- [x] `env.js`：移除 `DATABASE_URL`（app 用 D1 binding，脚本用 `SQLITE_PATH`），build 通过
- [x] secrets 清单 + 配置命令写进 `DEPLOY.md`（`BETTER_AUTH_SECRET`/`GITHUB_TOKEN`/`GITHUB_WEBHOOK_SECRET`/`ADMIN_EMAIL`）
- [ ] `better-auth` baseURL/trustedOrigins：默认从请求推断；跨域登录若异常再加（DEPLOY 排错表已注明）

## 阶段 8：部署 + 验证 ✅ 已上线

**线上**：https://aspoem.404174262.workers.dev（account 5697c41d…，D1 `aspoem` APAC）
（Worker 已从 `basic-template` 改名 `aspoem`；旧 worker 已删。**教训**：新 worker 首次部署前必须先 `wrangler secret put` 设齐 secrets，否则部署时 env.js 校验失败 `Invalid environment variables [10021]`）

- [x] 建远程 D1（`d45780b8-…`）+ KV（`f7a24b71…`），回填 `wrangler.jsonc`
- [x] `wrangler d1 migrations apply aspoem --remote`（17 命令，8 表）
- [x] 配 secrets：`BETTER_AUTH_SECRET`/`GITHUB_WEBHOOK_SECRET`（生成）/`ADMIN_EMAIL`(qq 邮箱)；`GITHUB_TOKEN` **占位待换**
- [x] `pnpm build:vinext && pnpm deploy:vinext` 成功
- [x] 灌 **500 首子集**（脚本 `seed-from-markdown.ts` → `export-d1-sql.ts` → `d1 execute --remote --file`）；验证 tRPC 返 元11/宋480/唐9，页面渲染
- [x] 端到端验证：`/` 307、`/login`/`/poems`/`/authors`/`/poems/hot`/`/dashboard` 全 200
- [x] 真实 `GITHUB_TOKEN` 已配；**webhook 端到端验证通过**（签名验证 + getContent + 写 D1，总数 501→502，详情页渲染 `臨潁道中值雨 宋 畢仲游`）
  - **webhook 改 inline 同步**：vinext beta 的 `after()` 不执行 + Worker 自我 fetch 到 /process 不可靠（`dispatched` 但没写）→ 去扇出，`route.ts` 直接 `await syncFiles`。单次调用 ≤~100 文件安全
- [ ] GitHub webhook 后台配 URL `/api/webhook` + secret（= wrangler 里设的 `GITHUB_WEBHOOK_SECRET`，Payload URL 指向线上）
- [ ] **全量 seed**（~32 万首，长任务）：`seed-from-markdown.ts` 去 `SEED_LIMIT`，export 分片 `d1 execute` 逐个导入
- ⚠️ token 已在对话出现，建议 revoke 重生成

---

## 依赖闸

- 阶段 0 不过 → 全盘暂停（vinext beta 是最大变量）
- 阶段 2 依赖阶段 1
- 阶段 3 依赖阶段 1+2
- 阶段 5 依赖阶段 2

## 来源

- https://github.com/cloudflare/vinext
- https://vinext.io/
- https://opennext.js.org/cloudflare
