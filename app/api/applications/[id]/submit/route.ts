import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/applications/:id/submit
// 学生が出願を最終提出（書類待ち → 受付中）するためのエンドポイント
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });

    if (!application) {
      return NextResponse.json({ error: "出願が見つかりません" }, { status: 404 });
    }

    if (application.status !== "書類待ち") {
      return NextResponse.json(
        { error: `この出願はすでに「${application.status}」の状態です` },
        { status: 400 }
      );
    }

    const updated = await prisma.application.update({
      where: { id: params.id },
      data: { status: "受付中" },
      select: { id: true, applicationNo: true, status: true },
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error("POST /api/applications/[id]/submit error:", error);
    return NextResponse.json({ error: "提出に失敗しました" }, { status: 500 });
  }
}
