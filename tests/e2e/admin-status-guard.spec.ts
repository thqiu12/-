/**
 * E2E: 管理画面のステータス変更ストッパー
 *
 * シナリオ:
 *  1. admin としてログイン
 *  2. 書類未提出 or 受験料未払いの申請を選択
 *  3. ステータスを「面接待ち」に変更しようとする
 *  4. 事前警告（インライン amber バナー）が表示される
 *  5. 「状態を更新する」をクリック → 確認モーダルが開く
 *  6. 理由未入力では「承知の上で進める」が押せない
 *  7. 理由を入力すると承認できる
 */
import { test, expect } from "@playwright/test";

test.describe("管理画面ステータス変更ストッパー", () => {
  test.beforeEach(async ({ page }) => {
    // admin ログイン
    await page.goto("/admin");
    await page.locator('input[name="username"], input[placeholder*="ユーザー名"]').first().fill("admin");
    await page.locator('input[type="password"]').fill("TestAdmin2026!");
    await page.getByRole("button", { name: /ログイン/ }).click();
    await page.waitForURL(/\/admin\/dashboard/);
  });

  test("ダッシュボードが表示される", async ({ page }) => {
    await expect(page.getByText(/全申請|申請一覧|ダッシュボード/)).toBeVisible();
  });

  test("申請詳細を開ける", async ({ page }) => {
    // 申請一覧から DEMO-0001 を探してクリック
    const row = page.locator("text=DEMO-0001").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    // 申請詳細ページに遷移
    await page.waitForURL(/\/admin\/applications\//);
    await expect(page.getByText(/申請詳細|DEMO-0001/)).toBeVisible();
  });

  test("書類未提出の申請で面接待ち選択 → 警告バナー表示", async ({ page }) => {
    // DEMO-0001 に直接遷移（受付中・選考費=確認中）
    await page.goto("/admin/applications/cmpcsd08j002e13oa57uhp29h").catch(() => {});
    // 上記 ID が無い場合は最初の受付中申請を探す
    if (page.url().includes("404") || !page.url().includes("/admin/applications/")) {
      await page.goto("/admin/dashboard");
      await page.locator("text=DEMO-0001").first().click();
    }

    // 選考・審査タブをクリック
    const tab = page.getByRole("button", { name: /選考.*審査/ });
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
    }

    // 面接待ち ラジオを選択
    await page.locator('input[type="radio"][value="面接待ち"]').click({ timeout: 5000 });

    // 警告バナーが表示される
    await expect(page.getByText(/未完了項目があります/)).toBeVisible({ timeout: 3000 });
  });
});
