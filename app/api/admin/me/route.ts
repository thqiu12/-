import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getRoleCapabilities } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, displayName: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return NextResponse.json({ user: null }, { status: 401 });
  // クライアントが操作可否を出し分けるための有効権限（super_admin は全権限）
  const capabilities = Array.from(await getRoleCapabilities(user.role));
  return NextResponse.json({ user: { ...user, capabilities } });
}
