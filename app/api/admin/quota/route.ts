import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin as checkAdmin } from "@/lib/auth";
import { QuotaSchema } from "@/lib/schemas";
import { resolveSchoolFk } from "@/lib/school-fk";

// GET: 定員統計一覧
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!checkAdmin(session)) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    // 定員レコード一覧
    const quotas = await prisma.enrollmentQuota.findMany({
      orderBy: [{ schoolName: "asc" }, { enrollmentYear: "desc" }, { department: "asc" }],
    });

    // 合格者数 / 出願中数を FK で集計（schoolName 文字列に依存しない）
    const acceptedByFk = await prisma.applicationSchool.groupBy({
      by: ["applySchoolId", "applyDepartmentId", "enrollmentYear"],
      where: { result: "合格", applySchoolId: { not: null }, applyDepartmentId: { not: null } },
      _count: { id: true },
    });
    const pendingByFk = await prisma.applicationSchool.groupBy({
      by: ["applySchoolId", "applyDepartmentId", "enrollmentYear"],
      where: {
        applySchoolId: { not: null },
        applyDepartmentId: { not: null },
        OR: [{ result: null }, { result: "保留" }],
      },
      _count: { id: true },
    });

    const fkKey = (sid: string | null, did: string | null, year: string) =>
      `${sid ?? ""}__${did ?? ""}__${year}`;

    const acceptedMap = new Map<string, number>();
    for (const a of acceptedByFk) {
      acceptedMap.set(fkKey(a.applySchoolId, a.applyDepartmentId, a.enrollmentYear), a._count.id);
    }
    const pendingMap = new Map<string, number>();
    for (const a of pendingByFk) {
      pendingMap.set(fkKey(a.applySchoolId, a.applyDepartmentId, a.enrollmentYear), a._count.id);
    }

    const result = quotas.map((q) => {
      const k = fkKey(q.applySchoolId, q.applyDepartmentId, q.enrollmentYear);
      const accepted = acceptedMap.get(k) ?? 0;
      const pending = pendingMap.get(k) ?? 0;
      const remaining = q.quota - accepted;
      const fillRate = q.quota > 0 ? Math.round((accepted / q.quota) * 100) : 0;
      return {
        id: q.id,
        schoolName: q.schoolName,
        department: q.department,
        enrollmentYear: q.enrollmentYear,
        applySchoolId: q.applySchoolId,
        applyDepartmentId: q.applyDepartmentId,
        quota: q.quota,
        accepted,
        pending,
        remaining,
        fillRate,
        memo: q.memo,
      };
    });

    // 定員未設定だが合格者がいる組み合わせを「定員=0」で追加表示
    const quotaSet = new Set(
      quotas.map((q) => fkKey(q.applySchoolId, q.applyDepartmentId, q.enrollmentYear)),
    );
    const orphanAccepted = acceptedByFk.filter(
      (a) => !quotaSet.has(fkKey(a.applySchoolId, a.applyDepartmentId, a.enrollmentYear)),
    );
    if (orphanAccepted.length > 0) {
      const labels = await prisma.applyDepartment.findMany({
        where: { id: { in: orphanAccepted.map((a) => a.applyDepartmentId!).filter(Boolean) } },
        include: { applySchool: { select: { name: true } } },
      });
      const labelMap = new Map(labels.map((d) => [d.id, { school: d.applySchool.name, dept: d.name }]));
      for (const a of orphanAccepted) {
        const lbl = labelMap.get(a.applyDepartmentId!) ?? { school: "(不明)", dept: "(不明)" };
        const k = fkKey(a.applySchoolId, a.applyDepartmentId, a.enrollmentYear);
        result.push({
          id: `unset-${k}`,
          schoolName: lbl.school,
          department: lbl.dept,
          enrollmentYear: a.enrollmentYear,
          applySchoolId: a.applySchoolId,
          applyDepartmentId: a.applyDepartmentId,
          quota: 0,
          accepted: a._count.id,
          pending: pendingMap.get(k) ?? 0,
          remaining: -1,
          fillRate: -1,
          memo: null,
        });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST: 定員設定の追加・更新
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!checkAdmin(session)) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const parsed = QuotaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { schoolName, department, enrollmentYear, quota, memo } = parsed.data;
    const fk = await resolveSchoolFk({ schoolName, department });
    const q = await prisma.enrollmentQuota.upsert({
      where: { schoolName_department_enrollmentYear: { schoolName, department, enrollmentYear } },
      update: {
        quota, memo: memo ?? null,
        applySchoolId: fk.applySchoolId,
        applyDepartmentId: fk.applyDepartmentId,
      },
      create: {
        schoolName: fk.schoolName || schoolName,
        department: fk.department || department,
        enrollmentYear,
        quota,
        memo: memo ?? null,
        applySchoolId: fk.applySchoolId,
        applyDepartmentId: fk.applyDepartmentId,
      },
    });
    return NextResponse.json(q, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// DELETE: 定員設定削除
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!checkAdmin(session)) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    await prisma.enrollmentQuota.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
