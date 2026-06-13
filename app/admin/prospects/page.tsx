"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/toast";
import { HelpTip } from "@/components/admin/HelpTip";
import { Icon } from "@/components/ui/Icon";
import { AgentProspectTabs } from "@/components/admin/AgentProspectTabs";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Prospect {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  birthDate: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  intendedSchool: string | null;
  intendedDepartment: string | null;
  enrollmentYear: string | null;
  expectedApplyDate: string | null;
  agentNotes: string | null;
  agentId: string;
  agent: { id: string; name: string; country: string };
  status: string;
  matchedApplicationId: string | null;
  matchedAt: string | null;
  matchedBy: string | null;
  adminMemo: string | null;
  createdAt: string;
  referredAt: string;
}

interface DuplicateGroup {
  key: string;
  reason: "email" | "name-birth" | "name";
  prospects: Array<{
    id: string;
    lastName: string;
    firstName: string;
    email: string | null;
    birthDate: string | null;
    agentName: string;
    referredAt: string;
    status: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  "候補": "bg-blue-100 text-blue-700",
  "出願済": "bg-green-100 text-green-700",
  "辞退": "bg-gray-100 text-gray-600",
  "重複（他エージェント優先）": "bg-amber-100 text-amber-700",
  "無効": "bg-red-100 text-red-700",
};

export default function AdminProspectsPage() {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "duplicates">("all");

  const fetchAll = async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("q", search.trim());
    if (filterStatus) sp.set("status", filterStatus);
    if (filterAgent) sp.set("agentId", filterAgent);
    sp.set("orderBy", "name");
    const [pRes, dRes] = await Promise.all([
      fetch(`/api/prospects?${sp}`),
      fetch("/api/prospects/duplicates"),
    ]);
    if (pRes.status === 403) {
      router.push("/admin/dashboard");
      return;
    }
    if (pRes.ok) setProspects(await pRes.json());
    if (dRes.ok) {
      const d = await dRes.json();
      setDuplicates(d.groups || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentOptions = Array.from(
    new Map(prospects.map((p) => [p.agentId, p.agent.name])).entries(),
  );

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(`ステータスを「${status}」に更新しました`, "success");
      fetchAll();
    } else {
      toast("更新に失敗しました", "error");
    }
  };

  const deleteProspect = async (p: Prospect) => {
    const ok = await confirm({
      title: "希望者を削除しますか？",
      message: `${p.lastName} ${p.firstName} (エージェント: ${p.agent.name}) を削除します。元に戻せません。`,
      okLabel: "削除する",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/prospects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("削除しました", "success");
      fetchAll();
    } else {
      toast("削除に失敗しました", "error");
    }
  };

  return (
    <>
      <div className="wsdb-topbar">
        <div>
          <h1 className="wsdb-topbar-title inline-flex items-center gap-2">希望者リスト<HelpTip text={"エージェント経由で事前申告された出願見込み者です。ステータスで進捗を管理し、「重複検出」タブで複数エージェントからの重複登録を確認できます。"} /></h1>
          <p className="wsdb-topbar-meta">エージェント経由の出願候補者管理 + 重複検出</p>
        </div>
      </div>

      <AgentProspectTabs />

      <div className="space-y-5">
        {/* KPI 集計カード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div style={{ "--wsdb-accent": "#2563eb", cursor: "default" } as CSSProperties} className="wsdb-stat">
            <div className="wsdb-stat-body">
              <div className="wsdb-stat-label">候補</div>
              <div className="wsdb-stat-value">{prospects.filter((p) => p.status === "候補").length}</div>
              <div className="wsdb-stat-sub">アプローチ中</div>
            </div>
            <div className="wsdb-stat-icon wsdb-stat-icon-blue"><Icon name="users" className="w-6 h-6" /></div>
          </div>
          <div style={{ "--wsdb-accent": "#059669", cursor: "default" } as CSSProperties} className="wsdb-stat">
            <div className="wsdb-stat-body">
              <div className="wsdb-stat-label">出願済</div>
              <div className="wsdb-stat-value">{prospects.filter((p) => p.status === "出願済").length}</div>
              <div className="wsdb-stat-sub">出願に進んだ</div>
            </div>
            <div className="wsdb-stat-icon wsdb-stat-icon-green"><Icon name="send" className="w-6 h-6" /></div>
          </div>
          <div style={{ "--wsdb-accent": "#7c3aed", cursor: "default" } as CSSProperties} className="wsdb-stat">
            <div className="wsdb-stat-body">
              <div className="wsdb-stat-label">紐付け済</div>
              <div className="wsdb-stat-value">{prospects.filter((p) => p.matchedApplicationId).length}</div>
              <div className="wsdb-stat-sub">申請と照合済</div>
            </div>
            <div className="wsdb-stat-icon wsdb-stat-icon-purple"><Icon name="check" className="w-6 h-6" /></div>
          </div>
          <div style={{ "--wsdb-accent": "#d97706", cursor: "default" } as CSSProperties} className="wsdb-stat">
            <div className="wsdb-stat-body">
              <div className="wsdb-stat-label">重複検出</div>
              <div className="wsdb-stat-value">{duplicates.length}</div>
              <div className="wsdb-stat-sub">要確認</div>
            </div>
            <div className="wsdb-stat-icon wsdb-stat-icon-amber"><Icon name="info" className="w-6 h-6" /></div>
          </div>
        </div>

        {/* 希望者リスト内サブタブ：全件 / 重複検出 */}
        <div className="flex border-b border-gray-200 gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "all" ? "border-navy-700 text-navy-800 bg-white" : "border-transparent text-gray-500"
            }`}
          >
            全希望者 ({prospects.length})
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "duplicates" ? "border-amber-500 text-amber-800 bg-white" : "border-transparent text-gray-500"
            }`}
          >
            重複検出 ({duplicates.length})
          </button>
        </div>

        {/* 全希望者タブ */}
        {activeTab === "all" && (
          <>
            <div className="card flex flex-wrap items-end gap-3">
              <div>
                <label className="form-label">検索（氏名・メール）</label>
                <input
                  className="form-input min-w-[200px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchAll()}
                  placeholder="山田 / @example.com"
                />
              </div>
              <div>
                <label className="form-label">ステータス</label>
                <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">すべて</option>
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">エージェント</label>
                <select className="form-input" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                  <option value="">すべて</option>
                  {agentOptions.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <button onClick={fetchAll} className="btn-primary text-sm px-4">適用</button>
            </div>

            {loading ? (
              <SkeletonList rows={6} cols={6} />
            ) : prospects.length === 0 ? (
              <EmptyState
                title="該当する希望者はいません"
                description="フィルター条件を変えるか、エージェント経由で希望者が登録されるとここに表示されます。"
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-800 text-white">
                    <tr>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">氏名 (A→Z)</th>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">エージェント</th>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">メール / 電話</th>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">志望校</th>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">ステータス</th>
                      <th className="text-left px-3 py-3 font-semibold whitespace-nowrap text-xs">マッチ</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prospects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900">{p.lastName} {p.firstName}</p>
                          {p.lastNameKana && <p className="text-xs text-gray-500">{p.lastNameKana} {p.firstNameKana}</p>}
                          {p.birthDate && <p className="text-xs text-gray-400">{p.birthDate}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-700">{p.agent.name}</p>
                          {p.agent.country && <span className="inline-block text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mt-1">{p.agent.country}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {p.email && <p className="break-all">{p.email}</p>}
                          {p.phone && <p className="text-gray-500">{p.phone}</p>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {p.intendedSchool && <p>{p.intendedSchool}</p>}
                          {p.intendedDepartment && <p className="text-gray-500">{p.intendedDepartment}</p>}
                          {p.enrollmentYear && <p className="text-gray-400">{p.enrollmentYear}年4月</p>}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={p.status}
                            onChange={(e) => updateStatus(p.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[p.status] || ""}`}
                          >
                            {Object.keys(STATUS_COLORS).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.matchedApplicationId ? (
                            <Link href={`/admin/applications/${p.matchedApplicationId}`}
                              className="text-green-600 hover:underline">
                              紐付け済
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {p.matchedBy && <p className="text-gray-400">{p.matchedBy}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => deleteProspect(p)}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 重複検出タブ */}
        {activeTab === "duplicates" && (
          <div className="card">
            <p className="text-xs text-gray-600 mb-4">
              複数のエージェントから同じ学生が登録されている可能性があります。名前のアルファベット順で表示。
            </p>
            {duplicates.length === 0 ? (
              <p className="text-center py-6 text-gray-400">重複は検出されませんでした</p>
            ) : (
              <div className="space-y-4">
                {duplicates.map((g, idx) => {
                  const reasonLabel = g.reason === "email" ? "メール一致"
                    : g.reason === "name-birth" ? "氏名+生年月日 一致"
                    : "氏名のみ一致";
                  const reasonBg = g.reason === "email" ? "bg-red-50 border-red-200"
                    : g.reason === "name-birth" ? "bg-amber-50 border-amber-200"
                    : "bg-yellow-50 border-yellow-200";
                  return (
                    <div key={idx} className={`rounded-xl border-2 ${reasonBg} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{g.prospects[0].lastName} {g.prospects[0].firstName}</p>
                          <p className="text-xs text-gray-600">
                            {reasonLabel} — {g.prospects.length} 件
                          </p>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="text-left py-1">エージェント</th>
                            <th className="text-left py-1">登録日</th>
                            <th className="text-left py-1">メール</th>
                            <th className="text-left py-1">誕生日</th>
                            <th className="text-left py-1">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.prospects.map((p) => (
                            <tr key={p.id} className="border-t border-white/60">
                              <td className="py-1 font-medium text-gray-800">{p.agentName}</td>
                              <td className="py-1 text-gray-600">{new Date(p.referredAt).toLocaleDateString("ja-JP")}</td>
                              <td className="py-1 text-gray-600 break-all">{p.email || "—"}</td>
                              <td className="py-1 text-gray-600">{p.birthDate || "—"}</td>
                              <td className="py-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || ""}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-[10px] text-gray-500 mt-2 italic">
                        推奨：先に登録されたエージェントを「候補」のまま残し、後発を「重複（他エージェント優先）」に変更してください。
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
