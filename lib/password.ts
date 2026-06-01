import crypto from "crypto";
import { promisify } from "util";

// scrypt は Node 組み込み。追加依存なしで「遅いKDF」によるパスワード保護を実現する。
const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

// ---- 旧形式（SHA256 + 固定ソルト）との後方互換 ----
// 既存アカウントがログインできなくならないよう、旧ハッシュも検証できるようにする。
// 旧ハッシュで成功した場合は needsRehash=true を返し、呼び出し側で新形式へ移行する。
const LEGACY_SALT = "senmon-salt-2024";

function legacyHash(pwd: string): string {
  return crypto.createHash("sha256").update(pwd + LEGACY_SALT).digest("hex");
}

function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** 新規パスワードを scrypt でハッシュ化（形式: scrypt$<salt>$<hash>）。 */
export async function hashPassword(pwd: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pwd, salt, KEYLEN)).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * パスワードを検証する。
 * - 旧 SHA256 ハッシュにも対応（成功時 needsRehash=true）。
 * - すべて定数時間比較。
 */
export async function verifyPassword(
  pwd: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!stored) return { valid: false, needsRehash: false };

  if (isLegacyHash(stored)) {
    const valid = safeEqual(legacyHash(pwd), stored);
    return { valid, needsRehash: valid };
  }

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return { valid: false, needsRehash: false };
  }
  const [, salt, hash] = parts;
  const derived = (await scryptAsync(pwd, salt, KEYLEN)).toString("hex");
  return { valid: safeEqual(derived, hash), needsRehash: false };
}
