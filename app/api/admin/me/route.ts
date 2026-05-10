import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, displayName: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
