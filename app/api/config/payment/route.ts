import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    bankName: process.env.PAYMENT_BANK_NAME || "三菱UFJ銀行 新宿支店",
    accountType: process.env.PAYMENT_ACCOUNT_TYPE || "普通",
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "1234567",
    accountHolder: process.env.PAYMENT_ACCOUNT_HOLDER || "（ザ）ハバガクエン",
    deadline: process.env.PAYMENT_DEADLINE || "出願後7日以内",
  });
}
