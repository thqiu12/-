import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { FeePatchSchema } from "@/lib/schemas";
import { logError } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const parsed = FeePatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await prisma.application.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, examFeeStatus: true, examFeeAmount: true, examFeeReceiptUrl: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    logError("PATCH /api/applications/[id]/fee", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
