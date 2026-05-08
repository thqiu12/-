import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 現在受付中の選考バッチを返す（学校別）
export async function GET() {
  try {
    const now = new Date();
    const cohorts = await prisma.cohort.findMany({
      where: { status: "受付中" },
      select: {
        id: true,
        name: true,
        year: true,
        round: true,
        schoolKey: true,
        acceptStart: true,
        acceptEnd: true,
        examDate: true,
        deadline: true,
      },
      orderBy: [{ schoolKey: "asc" }, { round: "asc" }],
    });

    // 受付期間フィルタ（acceptStart/acceptEnd が設定されている場合のみ）
    const active = cohorts.filter(c => {
      if (c.acceptStart && new Date(c.acceptStart) > now) return false;
      if (c.acceptEnd && new Date(c.acceptEnd) < now) return false;
      return true;
    });

    return NextResponse.json(active);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
