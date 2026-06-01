import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, createSessionToken } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";

const isProd = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  // ブルートフォース対策：IP単位で15分に10回まで
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "ログイン試行回数が多すぎます。15分後に再試行してください" }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });
    }

    // DBからユーザー取得
    const user = await prisma.adminUser.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    }

    // 最終ログイン日時を更新（旧SHA256ハッシュは scrypt へ自動移行）
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(needsRehash ? { passwordHash: await hashPassword(password) } : {}),
      },
    });

    const token = createSessionToken(user.id, user.role);
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    });

    response.cookies.set({
      name: "admin_token",
      value: token,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    // ロール情報もCookieに（フロント参照用・署名なし）
    response.cookies.set({
      name: "admin_role",
      value: user.role,
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    response.cookies.set({
      name: "admin_display_name",
      value: Buffer.from(user.displayName).toString("base64"),
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("POST /api/admin/login error:", error);
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  ["admin_token", "admin_role", "admin_display_name"].forEach(name => {
    response.cookies.set({ name, value: "", httpOnly: false, secure: false, sameSite: "lax", maxAge: 0, path: "/" });
  });
  return response;
}
