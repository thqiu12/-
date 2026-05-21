/**
 * API テスト: /api/admin/settings + /api/apply/settings
 *
 * 1. 公開エンドポイント /api/apply/settings は認証不要で 200 + デフォルト値
 * 2. /api/admin/settings は admin 認証必須
 * 3. PUT で enrollmentYears を更新できる
 * 4. zod 検証エラー: 4 桁以外は reject
 * 5. 重複・ソートが正規化される
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";

async function loginAsAdmin(request: playwrightRequest.APIRequestContext) {
  const res = await request.post("/api/admin/login", {
    data: { username: "admin", password: "TestAdmin2026!" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return { csrfToken: body.csrfToken as string };
}

test.describe("/api/apply/settings (公開)", () => {
  test("認証なしで 200 を返す", async ({ request }) => {
    const res = await request.get("/api/apply/settings");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.enrollmentYears)).toBe(true);
    expect(body.enrollmentYears.length).toBeGreaterThan(0);
    expect(typeof body.enrollmentMonth).toBe("string");
  });
});

test.describe("/api/admin/settings (管理者)", () => {
  test("未認証は 403", async ({ request }) => {
    const res = await request.get("/api/admin/settings");
    expect([401, 403]).toContain(res.status());
  });

  test("admin で GET → 200", async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get("/api/admin/settings");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.enrollmentYears).toBeDefined();
    expect(body.enrollmentMonth).toBeDefined();
  });

  test("PUT で enrollmentYears 更新 + 重複除去 + ソート", async ({ request }) => {
    const { csrfToken } = await loginAsAdmin(request);
    const res = await request.put("/api/admin/settings", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { enrollmentYears: ["2028", "2026", "2026", "2027"] },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.enrollmentYears).toEqual(["2026", "2027", "2028"]);
  });

  test("4桁数字以外で zod 400", async ({ request }) => {
    const { csrfToken } = await loginAsAdmin(request);
    const res = await request.put("/api/admin/settings", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { enrollmentYears: ["abc", "20a6"] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error || body.issues).toBeDefined();
  });

  test("空配列で 400", async ({ request }) => {
    const { csrfToken } = await loginAsAdmin(request);
    const res = await request.put("/api/admin/settings", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { enrollmentYears: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("PUT 後、公開エンドポイントにも反映される", async ({ request }) => {
    const { csrfToken } = await loginAsAdmin(request);
    await request.put("/api/admin/settings", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { enrollmentYears: ["2027", "2028", "2029"] },
    });
    const res = await request.get("/api/apply/settings");
    const body = await res.json();
    expect(body.enrollmentYears).toEqual(["2027", "2028", "2029"]);

    // 後始末: デフォルトに戻す
    await request.put("/api/admin/settings", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { enrollmentYears: ["2026", "2027", "2028"] },
    });
  });
});
