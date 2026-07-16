# ASPOEM 部署手册（Cloudflare Workers + D1）

本项目已从 Next.js/Prisma/Postgres 迁移到 **vinext + Drizzle + Cloudflare D1**，部署到 Cloudflare Workers。

技术栈：

- 运行时：vinext（Vite 版 Next.js）on Cloudflare Workers
- 数据库：Cloudflare D1（SQLite），Drizzle ORM
- 缓存：KV（vinext data cache）+ Workers Cache（CDN）
- 认证：better-auth（D1 存储）
- 内容同步：GitHub webhook（`meetqy/aspoem-backup` 的 `poems/*.md` → D1）

---

## 0. 前置

- Node ≥ 22.20（本机跑脚本需 Node 24 的内置 `node:sqlite`）
- pnpm ≥ 10.15
- 一个 Cloudflare 账号（**Workers 付费计划**，webhook 大批量同步依赖 300s CPU）
- 本机装好依赖：`pnpm install`

---

## 1. 登录 Cloudflare

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami   # 确认已登录
```

CI 场景改用环境变量：`CLOUDFLARE_API_TOKEN`（Edit Workers 模板）+ `CLOUDFLARE_ACCOUNT_ID`。

---

## 2. 创建 D1 与 KV，回填 `wrangler.jsonc`

```bash
# 创建 D1
pnpm exec wrangler d1 create aspoem
# 输出里的 database_id 填进 wrangler.jsonc 的 d1_databases[0].database_id

# 创建 KV（vinext 缓存用）
pnpm exec wrangler kv namespace create VINEXT_KV_CACHE
# 输出里的 id 填进 wrangler.jsonc 的 kv_namespaces[0].id
```

`wrangler.jsonc` 需要把两处占位符替换成真实 id：

```jsonc
{
  "kv_namespaces": [{ "binding": "VINEXT_KV_CACHE", "id": "<真实 KV id>" }],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "aspoem",
      "database_id": "<真实 D1 id>",
      "migrations_dir": "drizzle/migrations",
    },
  ],
}
```

> `name`（Worker 名，默认 `basic-template`）可按需改；改了记得后续命令里的域名也随之变。

---

## 3. 应用数据库迁移到远程 D1

```bash
pnpm exec wrangler d1 migrations apply aspoem --remote
```

迁移文件是手写的 `drizzle/migrations/0000_init.sql`（8 张表 + m2m 结点表 + auth 表）。

> 本地开发时用 `--local` 代替 `--remote`（写入 `.wrangler/state` 的本地 sqlite）。

---

## 4. 配置 Secrets

app 运行时需要以下密钥（通过 wrangler secret 注入，**不要**写进 wrangler.jsonc）：

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET     # openssl rand -base64 32 生成
pnpm exec wrangler secret put GITHUB_TOKEN           # 有 aspoem-backup 读权限的 PAT
pnpm exec wrangler secret put GITHUB_WEBHOOK_SECRET  # 与 GitHub webhook 配置一致
pnpm exec wrangler secret put ADMIN_EMAIL            # 管理员邮箱（sign-up 后自动提权 admin）
```

可选：

```bash
# Google Analytics（NEXT_PUBLIC_ 前缀是构建期变量，见下）
```

> `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` 是客户端变量，构建期注入。要用就在 `pnpm build:vinext` 前 `export NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=...`，或写进部署环境的构建变量。
>
> 注意：`DATABASE_URL` 已不再需要（app 用 D1 binding，`env.js` 已移除该校验）。

---

## 5. 灌数据到远程 D1

数据真源是 markdown 仓库 `meetqy/aspoem-backup` 的 `poems/*.md`。二选一：

### 方式 A：本地 seed → SQL 导入（node 脚本，无需 sqlite3 CLI）

内容仓库 `meetqy/aspoem-backup` 有 **~32 万首**诗，全量 seed 是长任务（本地约 85 分钟 + 远程分块导入）。可先用 `SEED_LIMIT` 灌子集验证。

```bash
# 1. 克隆内容仓库到上级目录
git clone --depth 1 https://github.com/meetqy/aspoem-backup ../aspoem-backup

# 2. 建 seed.db 并套用迁移（node:sqlite，无需 sqlite3 CLI）
NODE_OPTIONS=--experimental-sqlite node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; import {readFileSync} from 'node:fs'; new DatabaseSync('./seed.db').exec(readFileSync('drizzle/migrations/0000_init.sql','utf8'));"

# 3. seed 到 seed.db（SEED_LIMIT 不设=全量；设了=前 N 首）
SQLITE_PATH=./seed.db SEED_LIMIT=500 NODE_OPTIONS=--experimental-sqlite pnpm exec tsx scripts/seed-from-markdown.ts

# 4. 导出 INSERT 语句（node 脚本）
SQLITE_PATH=./seed.db NODE_OPTIONS=--experimental-sqlite pnpm exec tsx scripts/export-d1-sql.ts

# 5. 导入远程 D1
pnpm exec wrangler d1 execute aspoem --remote --file=seed-data.sql
```

> 全量（去掉 `SEED_LIMIT`）导出的 `seed-data.sql` 会很大（数百 MB），单次 `d1 execute --file` 可能超限。届时把 `export-d1-sql.ts` 改成按 table/行数分片输出多个 `.sql`，逐个 `--file` 导入。

### 方式 B：靠 webhook 全量同步（无需 sqlite3）

先完成第 6、7 步部署 + 配好 GitHub webhook，然后在 `aspoem-backup` 仓库做一次含少量文件的 push，webhook 会同步进远程 D1。

> **注意**：webhook 是**单次调用内 inline 同步**（不走 Queues/扇出——vinext beta 的 `after()` 不执行、Worker 自我 fetch 不可靠）。单次调用受 1000 子请求上限，每文件约 8 子请求 → 一次 push 处理约 **≤100 文件**安全。**全量首次灌库请用方式 A 的本地 seed**，不要靠一次巨型 push。

---

## 6. 构建 + 部署

```bash
pnpm build:vinext        # 产出 dist/（含 dist/server/wrangler.json）
pnpm deploy:vinext       # = vinext-cloudflare deploy --config dist/server/wrangler.json
```

部署成功后拿到 Worker 域名，形如 `https://basic-template.<account>.workers.dev`（或绑定的自定义域名）。

---

## 7. 配置 GitHub Webhook

在 `meetqy/aspoem-backup` 仓库 → Settings → Webhooks → Add webhook：

- **Payload URL**：`https://<你的-worker-域名>/api/webhook`
- **Content type**：`application/json`
- **Secret**：与第 4 步 `GITHUB_WEBHOOK_SECRET` 一致
- **Events**：仅 `push`

签名用 WebCrypto HMAC-SHA256 校验（`x-hub-signature-256`），仅在 `NODE_ENV=production` 时强制。

---

## 8. 验证

```bash
# 页面
curl -I https://<域名>/                 # 首页
curl -s https://<域名>/poems | grep -o '<title>[^<]*'
curl -s https://<域名>/authors | head -c 200

# tRPC 读接口（应 200 + JSON）
curl -s "https://<域名>/api/trpc/dynasty.getPoemsCount?batch=1&input=%7B%7D"

# webhook 内部端点鉴权（应 401）
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<域名>/api/webhook/process
```

手动过一遍：首页 / 诗词列表 / 诗词详情 / 搜索 / 作者页 / 登录 / dashboard 编辑 / 触发一次 push 看 webhook 同步。

---

## 9. 本地开发速查

```bash
pnpm dev:vinext                                   # 本地 dev（miniflare，端口 3001）
pnpm exec wrangler d1 migrations apply aspoem --local
NODE_OPTIONS=--experimental-sqlite pnpm gen:db    # seed 本地 D1（需 ../aspoem-backup）
pnpm build:vinext && pnpm start:vinext            # 本地跑生产构建（wrangler dev on dist）
```

维护脚本（都需 `NODE_OPTIONS=--experimental-sqlite`，默认作用于本地 miniflare D1；用 `SQLITE_PATH` 指向其他文件）：

```bash
NODE_OPTIONS=--experimental-sqlite pnpm exec tsx scripts/update-db-make-search-index.ts
NODE_OPTIONS=--experimental-sqlite pnpm exec tsx scripts/update-db-is-orderliness.ts
```

---

## 10. 排错

| 症状                                                | 原因 / 处理                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Worker 启动报缺 env                                 | 第 4 步 secrets 没配全（`GITHUB_TOKEN`/`GITHUB_WEBHOOK_SECRET` 是必填）                                                     |
| 读页 500，tRPC 报 `Failed query: ... no such table` | 远程 D1 没跑迁移（第 3 步）或 id 填错                                                                                       |
| `nodejs_compat` 相关运行时错误                      | 确认 `wrangler.jsonc` 有 `compatibility_flags: ["nodejs_compat"]` 且 `compatibility_date` 够新（当前 2026-07-15）           |
| 登录/session 跨域异常                               | 在 `src/server/auth/index.ts` 的 `betterAuth({...})` 加 `baseURL: "https://<域名>"` 和 `trustedOrigins: ["https://<域名>"]` |
| 脚本报 `this.stmt.raw is not a function`            | 没加 `NODE_OPTIONS=--experimental-sqlite`（`scripts/db.ts` 依赖 Node 内置 `node:sqlite`）                                   |
| 脚本报本地 D1 未初始化                              | 先 `wrangler d1 migrations apply aspoem --local`，或用 `SQLITE_PATH` 指向已有 sqlite                                        |
| webhook 收到但没同步                                | 检查 `GITHUB_TOKEN` 有 `aspoem-backup` 读权限（未认证限流 60/时）；`wrangler tail` 看 `/api/webhook` 报错                   |
| 大批量 push（>100 文件）部分失败                    | 单次调用撞 1000 子请求上限；改用本地 seed 脚本，或把该 push 拆小                                                            |
| 详情页访问量不涨                                    | 详情页 `/poems/detail/:slug` 是动态渲染（visits 每次自增）；列表页是 ISR（600s 缓存），符合预期                             |

实时日志：

```bash
pnpm exec wrangler tail
```

---

## 11. 回滚

```bash
pnpm exec wrangler deployments list
pnpm exec wrangler rollback [deployment-id]
```

---

## 附：关键文件

- `wrangler.jsonc` — Worker 配置（D1/KV binding、compat flags）
- `vite.config.ts` — vinext + cloudflare 插件、zod dedupe、缓存适配器
- `src/server/db/schema.ts` — Drizzle schema（单一事实源）
- `drizzle/migrations/0000_init.sql` — D1 建表 SQL
- `src/server/db.ts` — Workers D1 客户端；`scripts/db.ts` — node 脚本客户端
- `src/app/api/webhook/{route,process/route}.ts` — 内容同步写路径
- `src/trpc/server.tsx` — `api`（含 session）/ `publicApi`（读页缓存用）
