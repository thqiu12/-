import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";

// 申請者が自己申告できるステータス（「振込済み」「確認済み」「免除」の確定は管理者のみ）
const STUDENT_SELF_REPORT_STATUS = new Set(["確認中", "未払い"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!application) {
      return NextResponse.json({ error: "出願が見つかりません" }, { status: 404 });
    }

    const session = await getSession(request);
    const admin = isAdmin(session);

    const body = await request.json();
    const { examFeeStatus, examFeeAmount, examFeeReceiptUrl, examFeeNote } = body;

    const data: Record<string, unknown> = {};

    if (admin) {
      // 管理者は全フィールドを設定可能（支払い確定を含む）
      if (examFeeStatus !== undefined) data.examFeeStatus = examFeeStatus;
      if (examFeeAmount !== undefined) data.examFeeAmount = examFeeAmount;
      if (examFeeReceiptUrl !== undefined) data.examFeeReceiptUrl = examFeeReceiptUrl;
      if (examFeeNote !== undefined) data.examFeeNote = examFeeNote;
    } else {
      // 申請者（推測不能な applicationId を保持＝本人）：自己申告のみ。
      // 「確認済み」等の確定ステータスや管理メモは設定できない。
      if (examFeeStatus !== undefined) {
        if (!STUDENT_SELF_REPORT_STATUS.has(examFeeStatus)) {
          return NextResponse.json(
            { error: "この支払いステータスは設定できません" },
            { status: 403 }
          );
        }
        data.examFeeStatus = examFeeStatus;
      }
      if (examFeeAmount !== undefined) data.examFeeAmount = examFeeAmount;
      if (examFeeReceiptUrl !== undefined) data.examFeeReceiptUrl = examFeeReceiptUrl;
    }

    const updated = await prisma.application.update({
      where: { id: params.id },
      data,
      select: { id: true, examFeeStatus: true, examFeeAmount: true, examFeeReceiptUrl: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/applications/[id]/fee error:", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
