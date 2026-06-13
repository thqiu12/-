"use client";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/toast";
import { HelpTip } from "@/components/admin/HelpTip";
import { Icon } from "@/components/ui/Icon";

interface QuotaRow {
  id: string;
  schoolName: string;
  department: string;
  enrollmentYear: string;
  quota: number;
  accepted: number;
  pending: number;
  remaining: number;
  fillRate: number;
  memo: string | null;
}

export default function QuotaPage() {
  const router = useRouter();
  const { confirm } = useUI();
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState("2027");
  // 全体設定（入学希望年）と連動する年度リスト
  const [cfgYears, setCfgYears] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // form
  const [fSchool, setFSchool] = useState("");
  const [fDept, setFDept] = useState("");
  const [fYear, setFYear] = useState("2027");
  const [fQuota, setFQuota] = useState("");
  const [fMemo, setFMemo] = useState("");

  // 志望校・学科は出願フォームと同じ正規データから取得（TDB含む・常に最新）
  const [schoolOpts, setSchoolOpts] = useState<{ name: string; depts: string[] }[]>([]);
  const SCHOOLS = schoolOpts.map((s) => s.name);
  const deptsOf = (name: string) => schoolOpts.find((s) => s.name === name)?.depts ?? [];

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/quota");
    if (res.status === 401) { router.push("/admin"); return; }
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    fetch("/api/apply/schools")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { name: string; departments?: { name: string }[] }[]) => {
        if (Array.isArray(data)) setSchoolOpts(data.map((s) => ({ name: s.name, depts: (s.departments || []).map((d) => d.name) })));
      })
      .catch(() => {});
  }, []);

  // 全体設定の入学希望年と連動（既定の年度フィルタもここに合わせる）
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.enrollmentYears) && d.enrollmentYears.length) {
          setCfgYears(d.enrollmentYears);
          setFilterYear(d.enrollmentYears[0]);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = rows.filter(r => !filterYear || r.enrollmentYear === filterYear);

  // 学校ごとにグループ化
  const grouped: Record<string, QuotaRow[]> = {};
  filtered.forEach(r => {
    if (!grouped[r.schoolName]) grouped[r.schoolName] = [];
    grouped[r.schoolName].push(r);
  });

  // 合計計算
  const totalQuota = filtered.reduce((s, r) => s + (r.quota || 0), 0);
  const totalAccepted = filtered.reduce((s, r) => s + r.accepted, 0);
  const totalRemaining = filtered.reduce((s, r) => s + Math.max(r.remaining, 0), 0);

  const handleSave = async () => {
    if (!fQuota || Number(fQuota) < 1) { setFormError("定員数を入力してください"); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch("/api/admin/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName: fSchool, department: fDept, enrollmentYear: fYear, quota: Number(fQuota), memo: fMemo }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowModal(false);
      fetchData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, label: string) => {
    const ok = await confirm({ title: "定員設定を削除", message: `「${label}」の定員設定を削除しますか？`, danger: true, okLabel: "削除" });
    if (!ok) return;
    await fetch(`/api/admin/quota?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // 年度ピル＝全体設定の年度 ∪ 既にデータがある年度（過去年度も消さずに残す）
  const years = Array.from(new Set([...cfgYears, ...rows.map((r) => r.enrollmentYear)])).sort();

  return (
    <>
      <div className="wsdb-topbar">
        <div>
          <h1 className="wsdb-topbar-title inline-flex items-center gap-2">定員管理<HelpTip text={"学校×学科×入学年度ごとの定員と充足状況です。合格者数は申請の合否（合格）から自動集計されます。年度は全体設定の「入学希望年」と連動します。"} /></h1>
          <p className="wsdb-topbar-meta">学校×学科×入学年度 別 留学生定員</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* サマリーカード（KPI） */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div style={{ "--wsdb-accent": "#2563eb", cursor: "default" } as CSSProperties} className="wsdb-stat">
              <div className="wsdb-stat-body">
                <div className="wsdb-stat-label">総定員（{filterYear}年度）</div>
                <div className="wsdb-stat-value">{totalQuota}<span className="text-base font-normal text-muted ml-1">名</span></div>
                <div className="wsdb-stat-sub">募集枠の合計</div>
              </div>
              <div className="wsdb-stat-icon wsdb-stat-icon-blue"><Icon name="clipboard" className="w-6 h-6" /></div>
            </div>
            <div style={{ "--wsdb-accent": "#059669", cursor: "default" } as CSSProperties} className="wsdb-stat">
              <div className="wsdb-stat-body">
                <div className="wsdb-stat-label">合格確定</div>
                <div className="wsdb-stat-value">{totalAccepted}<span className="text-base font-normal text-muted ml-1">名</span></div>
                <div className="wsdb-stat-sub">充足率 {totalQuota > 0 ? Math.round(totalAccepted/totalQuota*100) : 0}%</div>
              </div>
              <div className="wsdb-stat-icon wsdb-stat-icon-green"><Icon name="check" className="w-6 h-6" /></div>
            </div>
            <div style={{ "--wsdb-accent": totalRemaining <= 5 ? "#dc2626" : totalRemaining <= 10 ? "#d97706" : "#0f766e", cursor: "default" } as CSSProperties} className="wsdb-stat">
              <div className="wsdb-stat-body">
                <div className="wsdb-stat-label">残定員</div>
                <div className="wsdb-stat-value">{totalRemaining}<span className="text-base font-normal text-muted ml-1">名</span></div>
                <div className="wsdb-stat-sub">{totalRemaining <= 5 ? "残りわずか" : "まだ募集可能"}</div>
              </div>
              <div className={`wsdb-stat-icon ${totalRemaining <= 5 ? "wsdb-stat-icon-red" : totalRemaining <= 10 ? "wsdb-stat-icon-amber" : "wsdb-stat-icon-gray"}`}><Icon name="users" className="w-6 h-6" /></div>
            </div>
          </div>
        )}

        {/* フィルター＋新規ボタン */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">入学年度：</span>
            <div className="flex gap-1">
              {years.map(y => (
                <button key={y} onClick={() => setFilterYear(y)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterYear === y ? "bg-navy-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-navy-300"}`}>
                  {y}年度
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { const s0 = schoolOpts[0]; setFSchool(s0?.name || ""); setFDept(s0?.depts[0] || ""); setFYear(filterYear || "2027"); setFQuota(""); setFMemo(""); setFormError(null); setShowModal(true); }}
            className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            定員を設定
          </button>
        </div>

        {/* テーブル */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">読み込み中...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-lg mb-2">定員データがありません</p>
            <p className="text-sm">「定員を設定」から追加してください</p>
          </div>
        ) : (
          Object.entries(grouped).map(([schoolName, schoolRows]) => {
            const schoolTotal = schoolRows.reduce((s, r) => s + (r.quota||0), 0);
            const schoolAccepted = schoolRows.reduce((s, r) => s + r.accepted, 0);
            return (
              <div key={schoolName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* 学校ヘッダー */}
                <div className="bg-navy-800 text-white px-5 py-3 flex items-center justify-between">
                  <h2 className="font-bold">{schoolName}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <span>定員計 <strong>{schoolTotal}</strong>名</span>
                    <span>合格 <strong className="text-green-300">{schoolAccepted}</strong>名</span>
                    <span>残 <strong className={schoolTotal - schoolAccepted <= 5 ? "text-red-300" : "text-white"}>{schoolTotal - schoolAccepted}</strong>名</span>
                  </div>
                </div>

                {/* 学科行 */}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-semibold text-gray-600">学科</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">入学年度</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">定員</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">合格確定</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">審査中</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">残定員</th>
                      <th className="px-4 py-2.5 w-48">充足率</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schoolRows.map(r => {
                      const rate = r.fillRate;
                      const barColor = rate >= 90 ? "bg-red-500" : rate >= 70 ? "bg-yellow-400" : "bg-green-500";
                      const remainColor = r.remaining <= 0 ? "text-red-600 font-bold" : r.remaining <= 5 ? "text-orange-500 font-semibold" : "text-gray-700";
                      return (
                        <tr key={r.id} className={`hover:bg-gray-50 ${r.remaining <= 0 ? "bg-red-50" : ""}`}>
                          <td className="px-5 py-3 font-medium text-gray-900">{r.department}</td>
                          <td className="px-4 py-3 text-gray-600">{r.enrollmentYear}年度</td>
                          <td className="px-4 py-3 text-center font-semibold text-navy-800">{r.quota || "未設定"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-green-600">{r.accepted}</span>
                            <span className="text-gray-400 text-xs ml-0.5">名</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-yellow-600 font-medium">{r.pending}</span>
                            <span className="text-gray-400 text-xs ml-0.5">名</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.remaining < 0 ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <span className={remainColor}>
                                {r.remaining <= 0 ? "満員" : `${r.remaining}名`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {rate >= 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-semibold w-8 text-right ${rate >= 90 ? "text-red-600" : rate >= 70 ? "text-yellow-600" : "text-green-600"}`}>
                                  {rate}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!r.id.startsWith("unset-") && (
                              <button onClick={() => handleDelete(r.id, `${r.schoolName} ${r.department} ${r.enrollmentYear}年度`)}
                                className="text-xs text-red-400 hover:text-red-600">削除</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {/* 定員設定モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">定員を設定</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}
              <div>
                <label className="form-label">学校 <span className="form-required">*</span></label>
                <select className="form-input" value={fSchool} onChange={e => { setFSchool(e.target.value); setFDept(deptsOf(e.target.value)[0] || ""); }}>
                  {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">学科 <span className="form-required">*</span></label>
                <select className="form-input" value={fDept} onChange={e => setFDept(e.target.value)}>
                  {deptsOf(fSchool).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">入学年度 <span className="form-required">*</span></label>
                <select className="form-input" value={fYear} onChange={e => setFYear(e.target.value)}>
                  {(cfgYears.length ? cfgYears : ["2026","2027","2028","2029"]).map(y => <option key={y} value={y}>{y}年度</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">定員数（名） <span className="form-required">*</span></label>
                <input type="number" min={1} max={999} className="form-input" placeholder="例: 20" value={fQuota} onChange={e => setFQuota(e.target.value)} />
              </div>
              <div>
                <label className="form-label">メモ</label>
                <input type="text" className="form-input" placeholder="任意" value={fMemo} onChange={e => setFMemo(e.target.value)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary" disabled={saving}>キャンセル</button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving ? "保存中..." : "設定を保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
