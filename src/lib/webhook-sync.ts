import { Octokit } from "@octokit/rest";
import { inArray } from "drizzle-orm";
import { env } from "@/env";
import type { DB } from "@/server/db";
import { poems } from "@/server/db/schema";
import { parseMarkdownToJson } from "./ast-markdown";
import { syncPoemToDatabase } from "./sync-poem-to-db";

export const WEBHOOK_CONFIG = {
  // 每个 /process 请求处理的文件数（控每次 Worker 调用的 subrequest 远低于 1000）
  CHUNK_SIZE: 20,
  POEM_PATH_PREFIX: "poems/",
  GITHUB: {
    OWNER: "meetqy",
    REPO: "aspoem-backup",
    REF: "main",
  },
} as const;

export type HeadCommit = {
  added: string[];
  removed: string[];
  modified: string[];
};

const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

// ---- 签名校验（WebCrypto HMAC-SHA256，替代 node crypto / @octokit/webhooks）----

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyGithubSignature(
  secret: string,
  payload: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = `sha256=${[...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
  return timingSafeEqual(expected, signature);
}

// ---- 文件工具 ----

export function extractSlug(filePath: string): string {
  return filePath
    .replace(WEBHOOK_CONFIG.POEM_PATH_PREFIX, "")
    .replace(".md", "")
    .replace(/\//g, "-");
}

export function filterPoemFiles(files: string[]): string[] {
  return files.filter((f) => f.startsWith(WEBHOOK_CONFIG.POEM_PATH_PREFIX));
}

// 无 Buffer 的 base64 → utf8（Workers 无 node Buffer）
function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function fetchFileContent(filePath: string): Promise<string> {
  const { data } = await octokit.rest.repos.getContent({
    owner: WEBHOOK_CONFIG.GITHUB.OWNER,
    repo: WEBHOOK_CONFIG.GITHUB.REPO,
    path: filePath,
    ref: WEBHOOK_CONFIG.GITHUB.REF,
  });

  if (!("content" in data) || data.type !== "file") {
    throw new Error("Not a file or content not found");
  }

  return decodeBase64Utf8(data.content);
}

// ---- 同步 ----

// 删除：结点表 FK onDelete cascade，删诗词自动清关联
export async function handleDeletedFiles(
  db: DB,
  files: string[],
): Promise<number> {
  const poemFiles = filterPoemFiles(files);
  if (poemFiles.length === 0) return 0;
  const slugs = poemFiles.map(extractSlug);
  await db.delete(poems).where(inArray(poems.slug, slugs));
  return poemFiles.length;
}

export interface SyncResult {
  total: number;
  success: number;
  failed: number;
}

// 处理一批文件（getContent → parse → 写 D1），供 /process 端点调用
export async function syncFiles(db: DB, files: string[]): Promise<SyncResult> {
  let success = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const markdown = await fetchFileContent(filePath);
      const poemData = await parseMarkdownToJson(markdown);
      await syncPoemToDatabase(db, poemData);
      success++;
    } catch (error) {
      failed++;
      console.error(`Failed to process file: ${filePath}`, error);
    }
  }

  return { total: files.length, success, failed };
}

// 分块
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
