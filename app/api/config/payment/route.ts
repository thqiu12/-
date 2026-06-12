import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 受験料の振込先。?schoolKey= があれば、その学校の受付中コホートに設定された
// examFeeBankInfo（選考管理で入力）を優先して返す。未設定なら環境変数の既定値。
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolKey = searchParams.get("schoolKey");

  let bankInfoText: string | null = null;
  // 全体共通の支払い設定（支払い設定ページ）：受験料・学費の振込先＋QR
  let examFee: { bankInfo: string; qr: string | null } = { bankInfo: "", qr: null };
  let tuition: { bankInfo: string; qr: string | null } = { bankInfo: "", qr: null };
  try {
    const cohorts = await prisma.cohort.findMany({
      where: schoolKey
        ? { status: "受付中", OR: [{ schoolKey }, { schoolKey: null }] }
        : { status: "受付中" },
      select: { schoolKey: true, examFeeBankInfo: true },
    });
    const specific = cohorts.find((c) => c.schoolKey === schoolKey && c.examFeeBankInfo);
    const global = cohorts.find((c) => !c.schoolKey && c.examFeeBankInfo);
    bankInfoText = (specific?.examFeeBankInfo || global?.examFeeBankInfo) ?? null;

    const row = await prisma.systemSetting.findUnique({ where: { key: "payment_config" } });
    if (row) {
      const cfg = JSON.parse(row.value);
      if (cfg?.examFee) examFee = { bankInfo: String(cfg.examFee.bankInfo || ""), qr: cfg.examFee.qr || null };
      if (cfg?.tuition) tuition = { bankInfo: String(cfg.tuition.bankInfo || ""), qr: cfg.tuition.qr || null };
    }
  } catch {
    /* DB未接続などのときは環境変数の既定値にフォールバック */
  }

  return NextResponse.json({
    bankName: process.env.PAYMENT_BANK_NAME || "三菱UFJ銀行 新宿支店",
    accountType: process.env.PAYMENT_ACCOUNT_TYPE || "普通",
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "1234567",
    accountHolder: process.env.PAYMENT_ACCOUNT_HOLDER || "（ザ）ハバガクエン",
    deadline: process.env.PAYMENT_DEADLINE || "出願後7日以内",
    // 受験料の振込先テキスト：支払い設定 > 選考管理(#7) の順で優先
    bankInfoText: examFee.bankInfo || bankInfoText,
    examFeeQr: examFee.qr,        // 受験料のQR（data URI）
    tuitionBankInfo: tuition.bankInfo || null, // 学費の振込先テキスト
    tuitionQr: tuition.qr,        // 学費のQR（data URI）
  });
}
