import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { z } from "zod";

const DocumentReviewSchema = z.object({
  status: z.enum(["提出済", "確認済", "差し戻し"]),
  rejectReason: z.string().max(1000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const parsed = DocumentReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { status, rejectReason } = parsed.data;
    // 「差し戻し」には理由が必須
    if (status === "差し戻し" && !rejectReason?.trim()) {
      return NextResponse.json(
        { error: "差し戻しには理由が必要です" },
        { status: 400 },
      );
    }
    const reviewer = session
      ? await prisma.adminUser.findUnique({
          where: { id: session.userId },
          select: { displayName: true, username: true },
        })
      : null;
    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        status,
        rejectReason: status === "差し戻し" ? rejectReason : null,
        reviewedAt: new Date(),
        reviewedBy: reviewer?.displayName || reviewer?.username || "管理者",
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    logError("PATCH /api/documents/[id]", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
