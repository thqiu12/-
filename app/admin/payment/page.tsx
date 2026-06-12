"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/toast";

interface PayMethod { bankInfo: string; qr: string | null }
interface PaymentConfig { examFee: PayMethod; tuition: PayMethod }

const MAX_QR_BYTES = 500 * 1024; // 約500KB

export default function PaymentSettingsPage() {
  const router = useRouter();
  const { toast } = useUI();
  const [cfg, setCfg] = useState<PaymentConfig>({ examFee: { bankInfo: "", qr: null }, tuition: { bankInfo: "", qr: null } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/payment-config");
      if (res.status === 401 || res.status === 403) { router.push("/admin"); return; }
      if (res.ok) setCfg(await res.json());
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (kind: "examFee" | "tuition", patch: Partial<PayMethod>) => {
    setCfg((c) => ({ ...c, [kind]: { ...c[kind], ...patch } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payment-config", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "保存に失敗しました");
      toast("支払い設定を保存しました", "success");
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
          <h1 className="wsdb-topbar-title">支払い設定</h1>
          <p className="wsdb-topbar-meta">受験料・学費の振込先とQRコードを設定（学生に表示）</p>
        </div>
        <button onClick={save} disabled={saving || !dirty} className="btn-primary text-sm disabled:opacity-50">
          {saving ? "保存中..." : dirty ? "保存する" : "保存済み"}
        </button>
      </div>

      {loading ? (
        <div className="card text-center py-16 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <PaymentCard title="受験料の振込先" hint="出願時（選考料の支払い）に学生へ表示されます。" method={cfg.examFee} onChange={(p) => update("examFee", p)} />
          <PaymentCard title="学費の振込先" hint="合格後の入学手続きで学生へ表示されます。" method={cfg.tuition} onChange={(p) => update("tuition", p)} />
        </div>
      )}
      {!loading && (
        <p className="text-xs text-gray-400 mt-3">
          ※ 振込先テキスト・QRコードの両方／片方を設定できます。QRは画像（PNG・JPG、〜500KB）をアップロードしてください（PayPay・微信・支付宝・NewAge等、決済アプリのQRが使えます）。
        </p>
      )}
    </>
  );
}

function PaymentCard({ title, hint, method, onChange }: {
  title: string; hint: string; method: PayMethod; onChange: (p: Partial<PayMethod>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    if (!f.type.startsWith("image/")) { setErr("画像ファイルを選択してください"); return; }
    if (f.size > MAX_QR_BYTES) { setErr("画像が大きすぎます（500KBまで）。圧縮してください。"); return; }
    const reader = new FileReader();
    reader.onload = () => onChange({ qr: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">{hint}</p>

      <label className="form-label">振込先（口座情報）</label>
      <textarea
        className="form-input text-sm min-h-[96px] resize-y font-mono"
        placeholder={"銀行名：〇〇銀行 〇〇支店\n口座種別：普通\n口座番号：1234567\n口座名義：学校法人〇〇学園"}
        value={method.bankInfo}
        onChange={(e) => onChange({ bankInfo: e.target.value })}
      />

      <label className="form-label mt-4">QRコード（決済アプリ用・任意）</label>
      {method.qr ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={method.qr} alt="QRコード" className="w-32 h-32 object-contain border border-gray-200 rounded-lg bg-white p-1" />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3">差し替え</button>
            <button type="button" onClick={() => onChange({ qr: null })} className="text-xs text-red-600 hover:text-red-700 font-semibold">削除</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors">
          QRコード画像をアップロード
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
