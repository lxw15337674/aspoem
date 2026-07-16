import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import {
  filterPoemFiles,
  type HeadCommit,
  handleDeletedFiles,
  syncFiles,
  verifyGithubSignature,
} from "@/lib/webhook-sync";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256");
  const eventName = request.headers.get("x-github-event");
  const id = request.headers.get("x-github-delivery");
  const payload = await request.text();

  if (!signature || !eventName || !id) {
    return NextResponse.json(
      { error: "Missing required GitHub webhook headers" },
      { status: 400 },
    );
  }

  // 生产校验签名（WebCrypto HMAC）
  if (env.NODE_ENV === "production") {
    const ok = await verifyGithubSignature(
      env.GITHUB_WEBHOOK_SECRET,
      payload,
      signature,
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const { head_commit } = JSON.parse(payload) as { head_commit?: HeadCommit };
  const added = head_commit?.added ?? [];
  const modified = head_commit?.modified ?? [];
  const removed = head_commit?.removed ?? [];

  const filesToProcess = filterPoemFiles([...added, ...modified]);

  // 删除
  const deleted =
    removed.length > 0 ? await handleDeletedFiles(db, removed) : 0;

  // 新增/修改：直接在本次调用内同步（getContent → parse → 写 D1）。
  // 说明：vinext beta 的 after() 在 Workers 不执行；Worker 自我 fetch 到同 Worker
  // 的 /process 不可靠，故不走扇出，直接 inline。日常 push（几文件）单次调用足够
  // （每文件 ~8 子请求，1000 上限内可处理约百来文件）。超大批量导入请用本地 seed 脚本。
  const result = await syncFiles(db, filesToProcess);

  return NextResponse.json({
    message: "Webhook processed",
    ...result,
    deleted,
  });
}
