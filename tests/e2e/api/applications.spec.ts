/**
 * API テスト: 出願の作成・取得・更新
 *
 * 1. POST /api/applications で出願作成
 * 2. GET /api/applications/[id] で取得（admin）
 * 3. PATCH /api/applications/[id] で status 変更（admin）
 * 4. GET /api/applications/status で学生本人ログイン
 * 5. 認可: 他者の email では取れない
 */
import { test, expect } from "@playwright/test";

async function loginAsAdmin(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post("/api/admin/login", {
    data: { username: "admin", password: "TestAdmin2026!" },
  });
  const body = await res.json();
  return { csrfToken: body.csrfToken as string };
}

const VALID_APP = {
  lastName: "テスト姓",
  firstName: "テスト名",
  lastNameKana: "テストセイ",
  firstNameKana: "テストメイ",
  birthDate: "2003-04-15",
  gender: "男性",
  nationality: "中国",
  japaneseLevel: "N2",
  phone: "090-1234-5678",
  email: `test-${Date.now()}@example.com`,
  postalCode: "1234567",
  prefecture: "東京都",
  city: "新宿区",
  address: "1-2-3",
  schoolName: "中央ゼミナール",
  department: "大学受験科",
  enrollmentYear: "2026",
  enrollmentMonth: "4",
  lastSchoolName: "テスト高校",
  lastSchoolCountry: "中国",
  lastSchoolGraduate: "卒業",
  applicationReason: "テスト用の志望動機です。".repeat(20),
};

test.describe("出願作成 API (/api/applications)", () => {
  test("正常データで 201 + 出願番号発行", async ({ request }) => {
    const res = await request.post("/api/applications", {
      data: { ...VALID_APP, status: "書類待ち" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.applicationNo).toMatch(/^\d{2}-\d-\d{3}$/);
    expect(body.id).toBeDefined();
  });

  test("メール不正で 400", async ({ request }) => {
    const res = await request.post("/api/applications", {
      data: { ...VALID_APP, email: "not-an-email", status: "書類待ち" },
    });
    expect(res.status()).toBe(400);
  });

  test("必須フィールド欠落で 400", async ({ request }) => {
    const { lastName: _omitted, ...incomplete } = VALID_APP;
    void _omitted;
    const res = await request.post("/api/applications", {
      data: { ...incomplete, status: "書類待ち" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("出願ステータス確認 API (/api/applications/status)", () => {
  test("有効な applicationNo + email で 200", async ({ request }) => {
    const res = await request.get("/api/applications/status?applicationNo=DEMO-0001&email=demo-0001%40example.com");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.applicationNo).toBe("DEMO-0001");
  });

  test("不正な email で 404", async ({ request }) => {
    const res = await request.get(
      "/api/applications/status?applicationNo=DEMO-0001&email=wrong%40example.com",
    );
    expect([403, 404]).toContain(res.status());
  });
});

test.describe("出願詳細・更新 API (admin only)", () => {
  test("未認証で 401", async ({ request }) => {
    // DEMO-0001 を取得しようとして認証無しは弾かれる
    const res = await request.patch("/api/applications/cmpcsd08j002e13oa57uhp29h", {
      data: { status: "面接待ち" },
    });
    // middleware が CSRF または admin_token を要求
    expect([401, 403]).toContain(res.status());
  });

  test("admin でステータス変更", async ({ request }) => {
    const { csrfToken } = await loginAsAdmin(request);

    // 一覧から ID を取得
    const list = await request.get("/api/applications");
    expect(list.ok()).toBe(true);
    const apps = await list.json();
    expect(Array.isArray(apps)).toBe(true);
    const target = apps.find((a: { applicationNo: string }) => a.applicationNo === "DEMO-0007");
    if (!target) test.skip(true, "DEMO-0007 (テスト用) が seed されていない");

    const before = target.status;
    const next = before === "保留" ? "受付中" : "保留";

    const res = await request.patch(`/api/applications/${target.id}`, {
      headers: { "X-CSRF-Token": csrfToken },
      data: { status: next },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe(next);

    // 元に戻す
    await request.patch(`/api/applications/${target.id}`, {
      headers: { "X-CSRF-Token": csrfToken },
      data: { status: before },
    });
  });
});
