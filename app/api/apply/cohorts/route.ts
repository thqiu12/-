import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 現在受付中の選考バッチを返す
// ?schoolKey=xxx を渡すと: 当該校 + 全校共通(schoolKey=null) のみ返す
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolKey = searchParams.get("schoolKey");
    const now = new Date();

    const where: Prisma.CohortWhereInput = { status: "受付中" };
    if (schoolKey) {
      where.OR = [{ schoolKey }, { schoolKey: null }];
    }

    const cohorts = await prisma.cohort.findMany({
      where,
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

    const active = cohorts.filter((c) => {
      if (c.acceptStart && new Date(c.acceptStart) > now) return false;
      if (c.acceptEnd && new Date(c.acceptEnd) < now) return false;
      return true;
    });

    return NextResponse.json(active);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
