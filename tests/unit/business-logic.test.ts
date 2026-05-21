/**
 * 業務ロジック（ストッパー・日時重複検知・受験票発行条件）の単体テスト
 *
 * これらは実際は admin UI / API ハンドラ内のロジックですが、純粋関数として
 * 切り出してテストすることで仕様の固定を担保します。
 */
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────
// ① ステータス遷移ストッパー: 書類未提出・受験料未払いで「面接待ち」以降に進めない
// ─────────────────────────────────────────────────────────────
type Doc = { docType: string; status?: string | null };
type App = {
  documents: Doc[];
  examFeeStatus?: string | null;
};

function getStatusTransitionIssues(app: App, newStatus: string): string[] {
  const GATED = new Set(["面接待ち", "合格", "補欠合格"]);
  if (!GATED.has(newStatus)) return [];
  const issues: string[] = [];

  const submitted = app.documents.filter(
    (d) => !d.docType.startsWith("入学手続き_") &&
           (d.status === "提出済" || d.status === "確認済" || !d.status),
  );
  if (submitted.length === 0) issues.push("出願書類が未提出");

  const rejected = app.documents.filter(
    (d) => d.status === "差し戻し" && !d.docType.startsWith("入学手続き_"),
  );
  if (rejected.length > 0) issues.push(`書類 ${rejected.length} 件 差し戻し中`);

  const feeStatus = app.examFeeStatus || "未払い";
  if (feeStatus !== "確認済み" && feeStatus !== "確認済") {
    issues.push(`選考費が「${feeStatus}」のまま`);
  }
  return issues;
}

describe("ステータス遷移ストッパー", () => {
  it("書類未提出 + 受験料未払い → 2 件の警告", () => {
    const issues = getStatusTransitionIssues(
      { documents: [], examFeeStatus: "未払い" },
      "面接待ち",
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain("出願書類が未提出");
    expect(issues[1]).toContain("未払い");
  });

  it("書類提出済み + 確認済み → 警告なし（クリーンパス）", () => {
    const issues = getStatusTransitionIssues(
      {
        documents: [{ docType: "証明写真（3×3cm）", status: "確認済" }],
        examFeeStatus: "確認済み",
      },
      "面接待ち",
    );
    expect(issues).toHaveLength(0);
  });

  it("差し戻し中の書類があると警告", () => {
    const issues = getStatusTransitionIssues(
      {
        documents: [
          { docType: "証明写真（3×3cm）", status: "提出済" },
          { docType: "JLPT", status: "差し戻し" },
        ],
        examFeeStatus: "確認済み",
      },
      "面接待ち",
    );
    expect(issues.some((i) => i.includes("差し戻し"))).toBe(true);
  });

  it("入学手続き_ 系書類は出願書類カウントに含めない", () => {
    const issues = getStatusTransitionIssues(
      {
        documents: [{ docType: "入学手続き_振込証明書", status: "提出済" }],
        examFeeStatus: "確認済み",
      },
      "面接待ち",
    );
    expect(issues.some((i) => i.includes("出願書類が未提出"))).toBe(true);
  });

  it("確認済 (旧表記、み無し) でも受験料 OK 扱い（後方互換）", () => {
    const issues = getStatusTransitionIssues(
      {
        documents: [{ docType: "X", status: "提出済" }],
        examFeeStatus: "確認済",
      },
      "面接待ち",
    );
    expect(issues.some((i) => i.includes("選考費"))).toBe(false);
  });

  it("受付中 / 書類確認中 への遷移はチェック対象外", () => {
    expect(getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "受付中")).toEqual([]);
    expect(getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "書類確認中")).toEqual([]);
    expect(getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "不合格")).toEqual([]);
    expect(getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "辞退")).toEqual([]);
  });

  it("合格 / 補欠合格もゲート対象", () => {
    expect(
      getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "合格").length,
    ).toBeGreaterThan(0);
    expect(
      getStatusTransitionIssues({ documents: [], examFeeStatus: "未払い" }, "補欠合格").length,
    ).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ② 試験日程の重複検知
// ─────────────────────────────────────────────────────────────
type Slot = { schoolId: string; priority: number; examType: "筆記試験" | "面接試験"; date: string; time: string };

function detectConflicts(slots: Slot[]): Slot[] {
  const groups: Record<string, Slot[]> = {};
  for (const s of slots) {
    const key = `${s.date}|${s.time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const conflicts: Slot[] = [];
  for (const group of Object.values(groups)) {
    if (group.length > 1) conflicts.push(...group);
  }
  return conflicts;
}

describe("試験日程の重複検知", () => {
  it("重複なしなら conflicts は空", () => {
    const slots: Slot[] = [
      { schoolId: "a", priority: 1, examType: "面接試験", date: "2026-06-15", time: "10:00" },
      { schoolId: "b", priority: 2, examType: "面接試験", date: "2026-06-20", time: "10:00" },
    ];
    expect(detectConflicts(slots)).toEqual([]);
  });

  it("同じ日付・時刻があれば全エントリを返す", () => {
    const slots: Slot[] = [
      { schoolId: "a", priority: 1, examType: "面接試験", date: "2026-06-15", time: "10:00" },
      { schoolId: "b", priority: 2, examType: "筆記試験", date: "2026-06-15", time: "10:00" },
    ];
    expect(detectConflicts(slots)).toHaveLength(2);
  });

  it("日付同じでも時刻違いなら衝突しない", () => {
    const slots: Slot[] = [
      { schoolId: "a", priority: 1, examType: "面接試験", date: "2026-06-15", time: "10:00" },
      { schoolId: "b", priority: 1, examType: "筆記試験", date: "2026-06-15", time: "14:00" },
    ];
    expect(detectConflicts(slots)).toEqual([]);
  });

  it("3 つ重なった場合も全部返す", () => {
    const slots: Slot[] = [
      { schoolId: "a", priority: 1, examType: "面接試験", date: "2026-06-15", time: "10:00" },
      { schoolId: "b", priority: 2, examType: "面接試験", date: "2026-06-15", time: "10:00" },
      { schoolId: "c", priority: 3, examType: "面接試験", date: "2026-06-15", time: "10:00" },
    ];
    expect(detectConflicts(slots)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
// ③ 受験票発行可否（gate）
// ─────────────────────────────────────────────────────────────
function canIssueExamTicket(input: {
  applicationStatus: string;
  hasRejectedDocs: boolean;
  hasInterviewSlot: boolean;
  hasWrittenSlot: boolean;
  writtenExempted: boolean;
}): { ok: boolean; reason?: string } {
  if (input.applicationStatus !== "面接待ち")
    return { ok: false, reason: "書類審査通過後にダウンロードできます。" };
  if (input.hasRejectedDocs)
    return { ok: false, reason: "差し戻された書類があります。" };
  const hasAnySlot = input.hasInterviewSlot || input.hasWrittenSlot || input.writtenExempted;
  if (!hasAnySlot) return { ok: false, reason: "試験日程が確定するまでお待ちください。" };
  return { ok: true };
}

describe("受験票発行可否", () => {
  it("面接待ち + 面接日程あり + 差し戻しなし → 発行可", () => {
    const r = canIssueExamTicket({
      applicationStatus: "面接待ち",
      hasRejectedDocs: false,
      hasInterviewSlot: true,
      hasWrittenSlot: false,
      writtenExempted: false,
    });
    expect(r.ok).toBe(true);
  });

  it("筆記免除のみでも発行可（一般課程以外）", () => {
    const r = canIssueExamTicket({
      applicationStatus: "面接待ち",
      hasRejectedDocs: false,
      hasInterviewSlot: false,
      hasWrittenSlot: false,
      writtenExempted: true,
    });
    expect(r.ok).toBe(true);
  });

  it("ステータスが受付中なら発行不可", () => {
    const r = canIssueExamTicket({
      applicationStatus: "受付中",
      hasRejectedDocs: false,
      hasInterviewSlot: true,
      hasWrittenSlot: false,
      writtenExempted: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("書類審査通過後");
  });

  it("差し戻しありなら発行不可", () => {
    const r = canIssueExamTicket({
      applicationStatus: "面接待ち",
      hasRejectedDocs: true,
      hasInterviewSlot: true,
      hasWrittenSlot: false,
      writtenExempted: false,
    });
    expect(r.ok).toBe(false);
  });

  it("試験日程未確定なら発行不可", () => {
    const r = canIssueExamTicket({
      applicationStatus: "面接待ち",
      hasRejectedDocs: false,
      hasInterviewSlot: false,
      hasWrittenSlot: false,
      writtenExempted: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("試験日程");
  });
});
