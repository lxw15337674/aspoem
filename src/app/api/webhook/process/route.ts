import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { syncFiles } from "@/lib/webhook-sync";

// 内部端点：由 /api/webhook 扇出调用，处理一块文件。每个请求是独立 Worker 调用。
export async function POST(request: NextRequest) {
  // 内部密钥校验，防止被外部触发任意 GitHub 拉取
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { files } = (await request.json()) as { files: string[] };
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ message: "No files" });
  }

  const result = await syncFiles(db, files);
  return NextResponse.json(result);
}
