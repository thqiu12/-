/**
 * lib/schemas.ts の単体テスト — 主要 Zod スキーマの境界条件
 *
 * カバー範囲:
 *  - ApplicationCreateSchema (出願データ作成)
 *  - AdminLoginSchema (管理者ログイン)
 *  - ChangeRequestCreateSchema (基本情報変更申請)
 *  - NotificationSchema (試験案内メール)
 */
import { describe, it, expect } from "vitest";
import {
  ApplicationCreateSchema,
  AdminLoginSchema,
  ChangeRequestCreateSchema,
  NotificationSchema,
} from "@/lib/schemas";

describe("ApplicationCreateSchema", () => {
  const validApp = {
    lastName: "山田", firstName: "太郎",
    lastNameKana: "ヤマダ", firstNameKana: "タロウ",
    birthDate: "2000-04-01",
    gender: "男性",
    nationality: "日本",
    japaneseLevel: "N1",
    schoolName: "中央ゼミナール",
    department: "大学受験科",
    enrollmentYear: "2026",
    enrollmentMonth: "4",
    lastSchoolName: "ABC 高校",
    lastSchoolCountry: "日本",
    lastSchoolGraduate: "卒業",
    applicationReason: "あ".repeat(300),
    phone: "090-1234-5678",
    email: "taro@example.com",
    postalCode: "1234567",
    prefecture: "東京都",
    city: "新宿区",
    address: "1-2-3",
  };

  it("正常な出願データを受理する", () => {
    const result = ApplicationCreateSchema.safeParse(validApp);
    expect(result.success).toBe(true);
  });

  it("メールアドレス不正で reject", () => {
    const r = ApplicationCreateSchema.safeParse({ ...validApp, email: "not-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it("姓が空文字で reject", () => {
    const r = ApplicationCreateSchema.safeParse({ ...validApp, lastName: "" });
    expect(r.success).toBe(false);
  });

  it("志望動機が短すぎる場合（300字未満）でも schema 自体は通す（UI 側で別途チェック）", () => {
    // schemas.ts の str() は default("") + max() のみで min がない
    const r = ApplicationCreateSchema.safeParse({ ...validApp, applicationReason: "短い" });
    // schema レベルでは受理（min 制約なし）
    expect(r.success).toBe(true);
  });
});

describe("AdminLoginSchema", () => {
  it("正常なユーザー名・パスワードを受理", () => {
    const r = AdminLoginSchema.safeParse({ username: "admin", password: "Pass1234!" });
    expect(r.success).toBe(true);
  });

  it("ユーザー名が空で reject", () => {
    const r = AdminLoginSchema.safeParse({ username: "", password: "x" });
    expect(r.success).toBe(false);
  });

  it("パスワードが空で reject", () => {
    const r = AdminLoginSchema.safeParse({ username: "admin", password: "" });
    expect(r.success).toBe(false);
  });

  it("超長いパスワード（>200）で reject", () => {
    const r = AdminLoginSchema.safeParse({
      username: "admin",
      password: "x".repeat(201),
    });
    expect(r.success).toBe(false);
  });
});

describe("ChangeRequestCreateSchema", () => {
  it("最小構成（fieldKey + newValue）で受理", () => {
    const r = ChangeRequestCreateSchema.safeParse({
      fieldKey: "phone",
      newValue: "090-9999-9999",
    });
    expect(r.success).toBe(true);
  });

  it("理由付きで受理", () => {
    const r = ChangeRequestCreateSchema.safeParse({
      fieldKey: "address",
      newValue: "新住所",
      reason: "引っ越したため",
    });
    expect(r.success).toBe(true);
  });

  it("newValue が空で reject", () => {
    const r = ChangeRequestCreateSchema.safeParse({
      fieldKey: "phone",
      newValue: "",
    });
    expect(r.success).toBe(false);
  });

  it("fieldKey が 40 文字超で reject", () => {
    const r = ChangeRequestCreateSchema.safeParse({
      fieldKey: "x".repeat(41),
      newValue: "value",
    });
    expect(r.success).toBe(false);
  });

  it("学生送信時の applicationNo + email を受理", () => {
    const r = ChangeRequestCreateSchema.safeParse({
      fieldKey: "phone",
      newValue: "090-1111-2222",
      applicationNo: "DEMO-0001",
      email: "demo@example.com",
    });
    expect(r.success).toBe(true);
  });
});

describe("NotificationSchema (interview)", () => {
  const base = {
    type: "interview" as const,
    to: "applicant@example.com",
    applicantName: "山田 太郎",
    applicationNo: "DEMO-0001",
  };

  it("最小構成（type + to + applicantName + applicationNo）で受理", () => {
    const r = NotificationSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("面接日程＋筆記情報あり構成で受理", () => {
    const r = NotificationSchema.safeParse({
      ...base,
      interviewDate: "2026-06-15",
      interviewTime: "10:00",
      interviewPlace: "本館3F",
      schoolName: "中央ゼミナール",
      department: "大学受験科",
      priorityLabel: "第1志望",
      writtenExamDate: "2026-06-15",
      writtenExamTime: "09:00",
      writtenExamExempted: false,
    });
    expect(r.success).toBe(true);
  });

  it("writtenExamExempted=true で日程フィールド省略でも受理", () => {
    const r = NotificationSchema.safeParse({
      ...base,
      writtenExamExempted: true,
    });
    expect(r.success).toBe(true);
  });

  it("type が enum 外で reject", () => {
    const r = NotificationSchema.safeParse({ ...base, type: "invalid" });
    expect(r.success).toBe(false);
  });

  it("to が不正なメール形式で reject", () => {
    const r = NotificationSchema.safeParse({ ...base, to: "not-email" });
    expect(r.success).toBe(false);
  });
});
