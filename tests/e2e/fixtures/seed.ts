/**
 * Playwright テスト用のシードヘルパー。
 *
 * - 初回テスト前に admin ユーザーとデモデータを作る
 * - 各テストはこのデータを前提に動く
 */
import { execSync } from "node:child_process";

export function seedTestData() {
  // tsx で seed + demo-seed を実行（同期）。
  // PLAYWRIGHT_TEST=1 を渡すと、必要であればテスト固有のデータを追加するフックを残せる。
  execSync("npx tsx prisma/seed.ts", {
    stdio: "pipe",
    env: { ...process.env, SEED_ADMIN_PASSWORD: "TestAdmin2026!" },
  });
  execSync("npx tsx prisma/demo-seed.ts", {
    stdio: "pipe",
    env: { ...process.env, SEED_DEMO: "1" },
  });
}
