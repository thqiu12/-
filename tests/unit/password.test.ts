/**
 * lib/password.ts の単体テスト。
 * - bcrypt の hash / verify
 * - legacy SHA-256 ハッシュとの互換（passwordVersion=1）
 * - 不正パスワードを拒否
 */
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  PWD_VERSION_BCRYPT,
  PWD_VERSION_LEGACY,
} from "@/lib/password";

describe("lib/password", () => {
  it("hashPassword は bcrypt ハッシュ（$2 で始まる）を返す", async () => {
    const hash = await hashPassword("MyPass123!");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it("同じ平文でも毎回違うハッシュになる（salt が異なる）", async () => {
    const h1 = await hashPassword("password");
    const h2 = await hashPassword("password");
    expect(h1).not.toBe(h2);
  });

  it("verifyPassword は正しいパスワードを true で返す", async () => {
    const hash = await hashPassword("CorrectPass!");
    expect(await verifyPassword("CorrectPass!", hash, PWD_VERSION_BCRYPT)).toBe(true);
  });

  it("verifyPassword は間違ったパスワードを false で返す", async () => {
    const hash = await hashPassword("RightOne");
    expect(await verifyPassword("WrongOne", hash, PWD_VERSION_BCRYPT)).toBe(false);
  });

  it("legacy (SHA-256) ハッシュも version=1 で検証できる（後方互換）", async () => {
    // SHA-256 + LEGACY_SALT は固定ハッシュなので直接検証
    const crypto = await import("node:crypto");
    const legacyHash = crypto
      .createHash("sha256")
      .update("legacypass" + "senmon-salt-2024")
      .digest("hex");

    expect(await verifyPassword("legacypass", legacyHash, PWD_VERSION_LEGACY)).toBe(true);
    expect(await verifyPassword("wrong", legacyHash, PWD_VERSION_LEGACY)).toBe(false);
  });

  it("bcrypt ハッシュに対して version=1 を渡しても、$2 prefix で自動的に bcrypt 検証になる", async () => {
    const hash = await hashPassword("MixedVersion");
    // version=1 でも prefix から bcrypt と判定される
    expect(await verifyPassword("MixedVersion", hash, PWD_VERSION_LEGACY)).toBe(true);
  });

  it("空パスワードを拒否する（実際には schema で防ぐが、ライブラリも安全に動作）", async () => {
    const hash = await hashPassword("real-pass");
    expect(await verifyPassword("", hash, PWD_VERSION_BCRYPT)).toBe(false);
  });
});
