// 学校別の筆記試験ポリシー。
// 東京デジタルビジネス専門学校（TDB）は筆記試験を行わない（一般選考も含め全区分で筆記免除）。
// クライアント（schoolId）でもサーバー（schoolName）でも判定できるよう両対応。
const NO_WRITTEN_EXAM_SCHOOL_IDS = ["tdb"];

export function isNoWrittenExamSchool(arg: { schoolId?: string | null; schoolName?: string | null }): boolean {
  if (arg.schoolId && NO_WRITTEN_EXAM_SCHOOL_IDS.includes(arg.schoolId)) return true;
  const name = arg.schoolName || "";
  // 学校名での判定（保存時は schoolName しか持たないケースに対応）
  return /デジタルビジネス|TDB/i.test(name);
}
