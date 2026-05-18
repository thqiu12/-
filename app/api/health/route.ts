import { NextResponse } from "next/server";

// 軽量ヘルスチェック。nginx upstream の健全性確認・PM2 起動確認に使う。
// DB クエリは敢えて省略 — DB ダウン時もアプリが reachable であることを示す目的。
// より詳細な readiness が必要なら /api/health?deep=1 を実装する。
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
