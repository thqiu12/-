/**
 * 基本情報変更申請の許可フィールド一覧の単体テスト。
 * - 不正なフィールドは含まれない（schoolName 等の進行管理フィールドは除外）
 * - 必要なフィールドは含まれる
 * - select 型には選択肢が定義されている
 */
import { describe, it, expect } from "vitest";
import { ALLOWED_FIELDS } from "@/lib/change-request-fields";

describe("ALLOWED_FIELDS for change requests", () => {
  it("基本情報の主要フィールドが含まれている", () => {
    expect(ALLOWED_FIELDS.lastName).toBeDefined();
    expect(ALLOWED_FIELDS.firstName).toBeDefined();
    expect(ALLOWED_FIELDS.phone).toBeDefined();
    expect(ALLOWED_FIELDS.email).toBeDefined();
    expect(ALLOWED_FIELDS.address).toBeDefined();
    expect(ALLOWED_FIELDS.postalCode).toBeDefined();
  });

  it("進行管理用フィールドは含まれていない（変更不可）", () => {
    // 志望校・ステータス・選考費等は学生が直接申請できてはいけない
    expect(ALLOWED_FIELDS.schoolName).toBeUndefined();
    expect(ALLOWED_FIELDS.department).toBeUndefined();
    expect(ALLOWED_FIELDS.status).toBeUndefined();
    expect(ALLOWED_FIELDS.examMode).toBeUndefined();
    expect(ALLOWED_FIELDS.examFeeStatus).toBeUndefined();
    expect(ALLOWED_FIELDS.applicationNo).toBeUndefined();
  });

  it("select 型のフィールドには options が定義されている", () => {
    for (const [key, def] of Object.entries(ALLOWED_FIELDS)) {
      if (def.type === "select") {
        expect(def.options, `${key} should have options`).toBeDefined();
        expect(def.options!.length, `${key}.options should be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it("性別の選択肢が正しい", () => {
    expect(ALLOWED_FIELDS.gender.options).toEqual(["男性", "女性", "その他"]);
  });

  it("日本語レベルに JLPT 5 段階 + なし がある", () => {
    const opts = ALLOWED_FIELDS.japaneseLevel.options!;
    expect(opts).toContain("N1");
    expect(opts).toContain("N5");
    expect(opts).toContain("なし");
  });

  it("ラベルは日本語で定義されている", () => {
    expect(ALLOWED_FIELDS.lastName.label).toBe("姓");
    expect(ALLOWED_FIELDS.phone.label).toBe("電話番号");
    expect(ALLOWED_FIELDS.email.label).toBe("メールアドレス");
  });
});
