import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { logError } from "@/lib/logger";
import {
  CAPABILITIES,
  MANAGEABLE_ROLES,
  SUPERADMIN_ONLY,
  ALL_CAPS,
  DEFAULT_ROLE_CAPS,
  getMatrix,
  saveMatrix,
} from "@/lib/permissions";

// 権限マトリクスの参照/更新は超管理者のみ。
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  try {
    const matrix = await getMatrix();
    return NextResponse.json({
      capabilities: CAPABILITIES,
      roles: MANAGEABLE_ROLES,
      superadminOnly: SUPERADMIN_ONLY,
      defaults: DEFAULT_ROLE_CAPS,
      matrix,
    });
  } catch (e) {
    logError("GET /api/admin/permissions", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const incoming = body?.matrix;
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "matrix が不正です" }, { status: 400 });
    }
    // 正規化: 既知ロール × 既知cap のみ受理
    const matrix: Record<string, string[]> = {};
    for (const r of MANAGEABLE_ROLES) {
      const list = Array.isArray(incoming[r]) ? incoming[r] : [];
      matrix[r] = ALL_CAPS.filter((c) => list.includes(c));
    }
    await saveMatrix(matrix, session?.userId ?? null);
    return NextResponse.json({ success: true, matrix: await getMatrix() });
  } catch (e) {
    logError("PUT /api/admin/permissions", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
