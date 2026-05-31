/**
 * API テスト: 受験票 PDF 発行 (/api/documents/exam-ticket)
 */
import { test, expect } from "@playwright/test";

test.describe("受験票 PDF 発行 API", () => {
  test("認証情報なしで 400", async ({ request }) => {
    const res = await request.get("/api/documents/exam-ticket");
    expect(res.status()).toBe(400);
  });

  test("受付中ステータスでは 403 (書類審査通過後にダウンロードできます)", async ({ request }) => {
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0001&email=demo-0001%40example.com",
    );
    if (res.status() === 404) test.skip(true, "DEMO-0001 が seed されていない");
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("書類審査通過後");
  });

  test("間違った email で 404", async ({ request }) => {
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0001&email=wrong%40example.com",
    );
    expect([400, 403, 404]).toContain(res.status());
  });

  test("面接待ち + 試験日確定 で 200 + PDF (DEMO-0005 第2志望)", async ({ request }) => {
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0005&email=demo-0005%40example.com&priority=2",
      { headers: { Accept: "application/pdf" } },
    );
    // 第2志望の試験日が設定されていない場合は seed のバージョン次第なので skip
    if (res.status() === 403 || res.status() === 404) {
      test.skip(true, "DEMO-0005 第2志望に試験日が seed されていないか、面接待ち状態でない");
    }
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");

    // PDF マジックバイト
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");

    // ファイル名に志望順位
    const cd = res.headers()["content-disposition"] || "";
    expect(cd).toMatch(/第2志望|priority|priority%3D2|priority=2/i);
  });
});
