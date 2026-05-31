/**
 * E2E: 管理画面のステータス変更ストッパー（完全実装）
 *
 * data-testid を利用した安定 selector。
 * カバー範囲:
 *  - admin ログインできる
 *  - ダッシュボード表示
 *  - 申請詳細を開ける
 *  - 書類未提出/受験料未払いの申請で「面接待ち」選択 → 警告バナー
 *  - 「状態を更新する」クリック → 確認モーダル開く
 *  - 理由入力で「承知の上で進める」が有効化
 */
import { test, expect } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByTestId("admin-login-username").fill("admin");
  await page.getByTestId("admin-login-password").fill("TestAdmin2026!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
}

test.describe("管理画面ステータス変更ストッパー", () => {
  test("admin ログイン → ダッシュボード表示", async ({ page }) => {
    await loginAsAdmin(page);
    // ダッシュボードのいずれかの要素が表示される
    await expect(
      page.getByText(/全申請|ダッシュボード|出願|申請一覧|管理者/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("申請一覧から DEMO-0001 を開ける", async ({ page }) => {
    await loginAsAdmin(page);
    const row = page.getByTestId("app-row-DEMO-0001");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await page.waitForURL(/\/admin\/applications\/[a-z0-9]+/, { timeout: 10_000 });
    await expect(page.getByText("DEMO-0001").first()).toBeVisible();
  });

  test("書類未提出の申請で『面接待ち』選択 → 警告バナー表示", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByTestId("app-row-DEMO-0001").click();
    await page.waitForURL(/\/admin\/applications\/[a-z0-9]+/);

    // 選考・審査タブ
    // 選考・審査タブに切り替え (デフォルトは "basic" タブ)
    await page.getByTestId("tab-screening").click();

    // タブ切り替え後にラジオが表示されるのを待つ
    const radio = page.getByTestId("status-radio-面接待ち");
    await expect(radio).toBeVisible({ timeout: 5_000 });
    await radio.check({ timeout: 5_000 });

    // 警告バナー表示
    await expect(page.getByText(/未完了項目があります/).first()).toBeVisible({ timeout: 3_000 });
  });

  test("『状態を更新する』クリック → 確認モーダル + 理由必須", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByTestId("app-row-DEMO-0001").click();
    await page.waitForURL(/\/admin\/applications\/[a-z0-9]+/);

    await page.getByTestId("tab-screening").click();
    const radio = page.getByTestId("status-radio-面接待ち");
    await expect(radio).toBeVisible({ timeout: 5_000 });
    await radio.check({ timeout: 5_000 });
    await page.getByTestId("status-update-submit").click();

    // モーダル開く
    await expect(page.getByRole("heading", { name: /「面接待ち」に進めますか？/ })).toBeVisible({
      timeout: 5_000,
    });

    // 承知の上で進めるボタンは disabled（理由未入力）
    const confirmBtn = page.getByTestId("status-override-confirm");
    await expect(confirmBtn).toBeDisabled();

    // 理由を入力 → 有効化
    await page.getByTestId("status-override-reason").fill("E2E テスト用の理由");
    await expect(confirmBtn).toBeEnabled();
  });
});
