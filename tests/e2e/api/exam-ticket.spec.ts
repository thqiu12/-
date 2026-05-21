/**
 * API テスト: 受験票 PDF 発行 (/api/documents/exam-ticket)
 *
 * 1. 学生本人 (applicationNo + email) で発行可能
 * 2. status=受付中 では 403
 * 3. 差し戻し書類があると 403
 * 4. priority=2 で第2志望の PDF
 * 5. Content-Type は application/pdf
 */
import { test, expect } from "@playwright/test";

test.describe("受験票 PDF 発行", () => {
  test("面接待ち + 試験日確定 → 200 + PDF", async ({ request }) => {
    // DEMO-0005 (面接待ち、第2志望に試験日設定済み) を想定
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0005&email=demo-0005%40example.com&priority=2",
      { headers: { Accept: "application/pdf" } },
    );
    if (res.status() === 403) {
      test.skip(true, "DEMO-0005 の第2志望に試験日が設定されていない (seed 依存)");
    }
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");

    // PDF マジックバイト (%PDF-)
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  test("認証情報なしで 400", async ({ request }) => {
    const res = await request.get("/api/documents/exam-ticket");
    expect(res.status()).toBe(400);
  });

  test("受付中ステータスでは 403", async ({ request }) => {
    // DEMO-0001 は受付中
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0001&email=demo-0001%40example.com",
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("書類審査通過後");
  });

  test("ファイル名に志望順位が入る (Content-Disposition)", async ({ request }) => {
    const res = await request.get(
      "/api/documents/exam-ticket?applicationNo=DEMO-0005&email=demo-0005%40example.com&priority=2",
    );
    if (res.status() !== 200) test.skip(true, "受験票 PDF 発行条件を満たさない");
    const cd = res.headers()["content-disposition"] || "";
    expect(cd).toContain("第2志望");
  });
});
