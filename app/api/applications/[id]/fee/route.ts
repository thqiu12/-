import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 選考料の支払いステータスは管理者のみ変更可能
    const session = await getSession(request);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { examFeeStatus, examFeeAmount, examFeeReceiptUrl, examFeeNote } = body;

    const updated = await prisma.application.update({
      where: { id: params.id },
      data: {
        ...(examFeeStatus !== undefined && { examFeeStatus }),
        ...(examFeeAmount !== undefined && { examFeeAmount }),
        ...(examFeeReceiptUrl !== undefined && { examFeeReceiptUrl }),
        ...(examFeeNote !== undefined && { examFeeNote }),
      },
      select: { id: true, examFeeStatus: true, examFeeAmount: true, examFeeReceiptUrl: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
