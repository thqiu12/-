/**
 * lib/permissions.ts の単体テスト。
 * ロール権限マトリクスの既定値・super_admin 常時許可・account.manage 固定 を検証。
 * （DBに role_permissions 未設定の状態＝デフォルト適用 を前提）
 */
import { describe, it, expect } from "vitest";
import {
  hasCapability,
  getRoleCapabilities,
  DEFAULT_ROLE_CAPS,
  SUPERADMIN_ONLY,
  ALL_CAPS,
  type CapabilityDef,
  CAPABILITIES,
} from "@/lib/permissions";
import type { AdminSession } from "@/lib/auth";

const sess = (role: string): AdminSession => ({ userId: "u1", role: role as AdminSession["role"], isValid: true });

describe("権限マトリクス（デフォルト）", () => {
  it("super_admin は常に全権限（account.manage 含む）", async () => {
    for (const c of ALL_CAPS) {
      expect(await hasCapability(sess("super_admin"), c)).toBe(true);
    }
  });

  it("account.manage は super_admin 専用（admin でも false）", async () => {
    expect(SUPERADMIN_ONLY).toContain("account.manage");
    expect(await hasCapability(sess("admin"), "account.manage")).toBe(false);
    expect(await hasCapability(sess("sales"), "account.manage")).toBe(false);
    expect(await hasCapability(sess("super_admin"), "account.manage")).toBe(true);
  });

  it("admin の既定は account.manage 以外すべて許可", async () => {
    expect(await hasCapability(sess("admin"), "result.decide")).toBe(true);
    expect(await hasCapability(sess("admin"), "form.edit")).toBe(true);
    expect(await hasCapability(sess("admin"), "cohort.manage")).toBe(true);
  });

  it("sales の既定はフォーム編集・選考操作 不可、合否決定・通知は可", async () => {
    expect(await hasCapability(sess("sales"), "result.decide")).toBe(true);
    expect(await hasCapability(sess("sales"), "notification.send")).toBe(true);
    expect(await hasCapability(sess("sales"), "form.edit")).toBe(false);
    expect(await hasCapability(sess("sales"), "cohort.manage")).toBe(false);
  });

  it("interviewer の既定は空（ゲート操作不可）", async () => {
    const caps = await getRoleCapabilities("interviewer");
    expect(caps.size).toBe(0);
    expect(await hasCapability(sess("interviewer"), "result.decide")).toBe(false);
  });

  it("未ログインは全て false", async () => {
    expect(await hasCapability(null, "result.decide")).toBe(false);
  });

  it("CAPABILITIES は10項目・各項目に必要フィールド", () => {
    expect(CAPABILITIES.length).toBe(10);
    CAPABILITIES.forEach((c: CapabilityDef) => {
      expect(c.key && c.label && c.group && c.desc).toBeTruthy();
    });
    // デフォルトは既知 cap のみ
    for (const r of Object.keys(DEFAULT_ROLE_CAPS)) {
      DEFAULT_ROLE_CAPS[r].forEach((c) => expect(ALL_CAPS).toContain(c));
    }
  });
});
