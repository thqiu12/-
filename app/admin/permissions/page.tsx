"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/toast";

interface CapabilityDef { key: string; label: string; group: string; desc: string; }

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  sales: "営業",
  interviewer: "面接官",
};

export default function PermissionsPage() {
  const router = useRouter();
  const { toast } = useUI();
  const [caps, setCaps] = useState<CapabilityDef[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [superadminOnly, setSuperadminOnly] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/permissions");
        if (res.status === 401 || res.status === 403) { router.push("/admin"); return; }
        if (!res.ok) throw new Error("取得に失敗しました");
        const d = await res.json();
        setCaps(d.capabilities);
        setRoles(d.roles);
        setSuperadminOnly(d.superadminOnly || []);
        setDefaults(d.defaults || {});
        const m: Record<string, Set<string>> = {};
        for (const r of d.roles) m[r] = new Set<string>(d.matrix[r] || []);
        setMatrix(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラー");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const groups = useMemo(() => {
    const g: Record<string, CapabilityDef[]> = {};
    for (const c of caps) (g[c.group] ??= []).push(c);
    return g;
  }, [caps]);

  const isLocked = (cap: string) => superadminOnly.includes(cap);

  const toggle = (role: string, cap: string) => {
    if (isLocked(cap)) return;
    setMatrix((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      if (next[role].has(cap)) next[role].delete(cap); else next[role].add(cap);
      return next;
    });
    setDirty(true);
  };

  const resetDefaults = () => {
    const m: Record<string, Set<string>> = {};
    for (const r of roles) m[r] = new Set<string>(defaults[r] || []);
    setMatrix(m);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string[]> = {};
      for (const r of roles) payload[r] = Array.from(matrix[r] || []);
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix: payload }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "保存に失敗しました"); }
      toast("権限を保存しました", "success");
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="wsdb-topbar">
        <div>
          <h1 className="wsdb-topbar-title">権限設定</h1>
          <p className="wsdb-topbar-meta">ロールごとに操作の可否を設定（超管理者は常に全権限）</p>
        </div>
      </div>

      {error ? (
        <div className="card text-center py-8 text-red-600">{error}</div>
      ) : loading ? (
        <div className="card text-center py-16 text-gray-400">読み込み中...</div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-gray-500">チェック＝その操作を許可。変更後に「保存」してください。</p>
            <div className="flex items-center gap-2">
              <button onClick={resetDefaults} className="btn-secondary text-sm">既定に戻す</button>
              <button onClick={save} disabled={saving || !dirty} className="btn-primary text-sm disabled:opacity-50">
                {saving ? "保存中..." : dirty ? "保存" : "保存済み"}
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left font-bold text-gray-700 px-4 py-3 min-w-[260px]">操作</th>
                  <th className="text-center font-bold text-purple-700 px-3 py-3 w-24">スーパー<br/>管理者</th>
                  {roles.map((r) => (
                    <th key={r} className="text-center font-bold text-navy-700 px-3 py-3 w-24">{ROLE_LABEL[r] || r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groups).map(([group, list]) => (
                  <>
                    <tr key={`g-${group}`} className="bg-gray-50/60">
                      <td colSpan={2 + roles.length} className="px-4 py-1.5 text-xs font-bold text-gray-500 tracking-wide">{group}</td>
                    </tr>
                    {list.map((c) => (
                      <tr key={c.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {c.label}
                            {isLocked(c.key) && <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 rounded-full px-1.5 py-0.5">超管理者のみ</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{c.desc}</div>
                        </td>
                        {/* super_admin は常にON */}
                        <td className="text-center px-3 py-3">
                          <input type="checkbox" checked readOnly disabled className="w-4 h-4 accent-purple-600 opacity-70" />
                        </td>
                        {roles.map((r) => (
                          <td key={r} className="text-center px-3 py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-navy-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              checked={isLocked(c.key) ? false : (matrix[r]?.has(c.key) ?? false)}
                              disabled={isLocked(c.key)}
                              onChange={() => toggle(r, c.key)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            ※ 「合否を決定する」「合否・案内メールを送信する」などをロール別にON/OFFできます。例：営業の「合否を決定する」を外すと、営業は合格/不合格を設定できなくなります（閲覧・編集は可）。
          </p>
        </div>
      )}
    </>
  );
}
