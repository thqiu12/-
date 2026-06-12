import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isCoreAdmin } from "@/lib/auth";

// 受験料・学費の支払い設定（全体共通）。QRはデータURIで保存（画像配信不要・デプロイ安全）。
const KEY = "payment_config";

interface PayMethod { bankInfo: string; qr: string | null }
interface PaymentConfig { examFee: PayMethod; tuition: PayMethod }
const EMPTY: PaymentConfig = { examFee: { bankInfo: "", qr: null }, tuition: { bankInfo: "", qr: null } };

// QR は data:image/... のみ許可、~600KBまで（巨大画像でDBを膨らませない）
function sanitizeQr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!v.startsWith("data:image/")) return null;
  if (v.length > 800_000) return null;
  return v;
}
function sanitizeMethod(m: unknown): PayMethod {
  const o = (m ?? {}) as Record<string, unknown>;
  return { bankInfo: String(o.bankInfo ?? "").slice(0, 2000), qr: sanitizeQr(o.qr) };
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isCoreAdmin(session)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  let cfg: PaymentConfig = EMPTY;
  if (row) { try { cfg = { ...EMPTY, ...JSON.parse(row.value) }; } catch { /* ignore */ } }
  return NextResponse.json(cfg);
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isCoreAdmin(session)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const cfg: PaymentConfig = {
    examFee: sanitizeMethod(body?.examFee),
    tuition: sanitizeMethod(body?.tuition),
  };
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(cfg), updatedBy: session.userId },
    create: { key: KEY, value: JSON.stringify(cfg), updatedBy: session.userId },
  });
  return NextResponse.json({ ok: true });
}
