/**
 * Vitest 共通セットアップ
 *
 * 重要: Prisma は .env を自動ロードするので、テスト DB は /tmp に絶対パスで配置して
 * 本番 .env (DATABASE_URL=file:./prisma/data.db) との衝突を完全に避ける。
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { beforeAll, afterAll } from "vitest";

// ---- 環境変数を確実に上書き ----
const TEST_DB_PATH = "/tmp/senmon-vitest.db";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
process.env.SESSION_SECRET = "test-session-secret-32chars-1234567890abcdef";
process.env.CSRF_SECRET = "test-csrf-secret-32chars-1234567890abcdef";
process.env.UPLOAD_DIR = "/tmp/senmon-test-uploads";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

beforeAll(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  mkdirSync(process.env.UPLOAD_DIR!, { recursive: true });

  // env を明示的に渡して prisma db push 実行。
  // ※ Prisma は dotenv で .env を読むが、既に process.env にあるキーは上書きしない仕様。
  //    /tmp の絶対パスなら schema.prisma 相対解決も影響しない。
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
  });
});

afterAll(() => {
  if (process.env.TEST_CLEANUP === "1" && existsSync(TEST_DB_PATH)) {
    try { unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  }
});
