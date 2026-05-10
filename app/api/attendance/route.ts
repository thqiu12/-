import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { AttendanceRecordsSchema } from "@/lib/schemas";
import { logError } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!isAdmin(session)) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const date = searchParams.get("date");
    const month = searchParams.get("month");
    const timetableSlotId = searchParams.get("timetableSlotId");

    const where: Prisma.AttendanceWhereInput = {};
    if (studentId) where.studentId = studentId;
    if (subjectId) where.subjectId = subjectId;
    if (timetableSlotId) where.timetableSlotId = timetableSlotId;
    if (date) where.date = date;
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "monthは YYYY-MM 形式で指定してください" }, { status: 400 });
      }
      where.date = { startsWith: month };
    }
    if (classId) where.student = { classId };

    const records = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        student: { select: { id: true, studentNo: true, lastName: true, firstName: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
      take: 1000,
    });
    return NextResponse.json(records);
  } catch (e) {
    logError("GET /api/attendance", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!isAdmin(session)) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  try {
    const parsed = AttendanceRecordsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const ops = parsed.data.records.map((r) =>
      prisma.attendance.upsert({
        where: {
          studentId_timetableSlotId_date: {
            studentId: r.studentId,
            timetableSlotId: r.timetableSlotId || "",
            date: r.date,
          },
        },
        create: {
          studentId: r.studentId,
          subjectId: r.subjectId,
          timetableSlotId: r.timetableSlotId || null,
          teacherId: r.teacherId || null,
          date: r.date,
          status: r.status,
          note: r.note || null,
        },
        update: {
          status: r.status,
          note: r.note || null,
          teacherId: r.teacherId || null,
        },
      }),
    );
    const records = await prisma.$transaction(ops);
    return NextResponse.json({ success: true, count: records.length, records });
  } catch (e) {
    logError("POST /api/attendance", e);
    return NextResponse.json({ error: "出席記録の保存に失敗しました" }, { status: 500 });
  }
}
