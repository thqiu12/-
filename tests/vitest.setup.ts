/**
 * Vitest 共通セットアップ
 *
 * 戦略:
 *  - テスト DB は /tmp に「プロセス ID 付き」のユニークパスで配置
 *    → 並列実行・CI の事前 db push step との衝突を完全に避ける
 *  - .env (DATABASE_URL=file:./prisma/data.db) の影響も受けない
 *  - 各テストファイルの beforeAll で実行されるが、同一プロセス内なので
 *    最初の 1 回だけ DB 構築（既に通った場合はスキップ）
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { beforeAll, afterAll } from "vitest";

// ---- プロセスごとにユニークな DB パス ----
// 同じプロセス内では同一インスタンス、別プロセス／別ワーカーなら別 DB。
const TEST_DB_PATH = `/tmp/senmon-vitest-${process.pid}.db`;

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
process.env.SESSION_SECRET = "test-session-secret-32chars-1234567890abcdef";
process.env.CSRF_SECRET = "test-csrf-secret-32chars-1234567890abcdef";
process.env.UPLOAD_DIR = "/tmp/senmon-test-uploads";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

// 同一プロセス内で db push を 1 回しか走らせないためのフラグ
// (vitest.setup.ts が複数の test file で beforeAll を呼ぶ場合の重複を防ぐ)
let dbPushed = false;

beforeAll(() => {
  if (dbPushed) return;

  // 古い DB ファイルが残っていれば削除（前回失敗の名残対策）
  if (existsSync(TEST_DB_PATH)) {
    try { unlinkSync(TEST_DB_PATH); } catch { /* fall through, prisma will overwrite */ }
  }
  mkdirSync(process.env.UPLOAD_DIR!, { recursive: true });

  // env を明示的に渡して prisma db push 実行
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
  });

  dbPushed = true;
});

afterAll(() => {
  // 既定では削除しない（デバッグ用に残す）。明示クリーンアップしたい時のみ。
  if (process.env.TEST_CLEANUP === "1" && existsSync(TEST_DB_PATH)) {
    try { unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  }
});
