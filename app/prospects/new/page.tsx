"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

export default function ProspectNewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">読み込み中...</div>}>
      <ProspectNewInner />
    </Suspense>
  );
}

interface AgentInfo {
  id: string;
  name: string;
}

function ProspectNewInner() {
  const [token, setToken] = useState<string>("");
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // フォーム状態
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [intendedSchool, setIntendedSchool] = useState("");
  const [intendedDepartment, setIntendedDepartment] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState("");
  const [expectedApplyDate, setExpectedApplyDate] = useState("");
  const [agentNotes, setAgentNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // トークンから渠道情報を取得
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("token") || "";
    setToken(t);
    if (!t) {
      setAuthError("渠道専用 URL が必要です。配布された URL からアクセスしてください。");
      setAuthLoading(false);
      return;
    }
    fetch(`/api/prospects/agent-by-token?token=${encodeURIComponent(t)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.id) {
          setAuthError("URL が無効です。最新の渠道専用 URL を運営にお問い合わせください。");
        } else {
          setAgent(d);
        }
      })
      .catch(() => setAuthError("ネットワークエラー"))
      .finally(() => setAuthLoading(false));
  }, []);

  const reset = () => {
    setLastName(""); setFirstName(""); setLastNameKana(""); setFirstNameKana("");
    setBirthDate(""); setGender(""); setNationality("");
    setEmail(""); setPhone(""); setIntendedSchool(""); setIntendedDepartment("");
    setEnrollmentYear(""); setExpectedApplyDate(""); setAgentNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    if (!lastName.trim() || !firstName.trim()) {
      setError("姓・名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          formToken: token,
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          lastNameKana: lastNameKana.trim() || undefined,
          firstNameKana: firstNameKana.trim() || undefined,
          birthDate: birthDate || undefined,
          gender: gender || undefined,
          nationality: nationality.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          intendedSchool: intendedSchool.trim() || undefined,
          intendedDepartment: intendedDepartment.trim() || undefined,
          enrollmentYear: enrollmentYear || undefined,
          enrollmentMonth: "4",
          expectedApplyDate: expectedApplyDate || undefined,
          agentNotes: agentNotes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "登録に失敗しました");
      } else {
        setSuccess(true);
        reset();
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch {
      setError("ネットワークエラー");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>;
  }
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <p className="text-3xl mb-4">🚫</p>
          <h1 className="text-lg font-bold text-gray-800 mb-2">アクセスできません</h1>
          <p className="text-sm text-gray-600 mb-4">{authError}</p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">トップへ戻る</Link>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy-800 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="font-bold text-lg">📝 希望者リスト 登録</h1>
          <p className="text-sm text-navy-200">渠道: <strong>{agent?.name}</strong></p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-5">
            出願前の学生情報を事前申告します。後から学生が出願したときに、メールアドレス or 氏名+生年月日で
            自動マッチングされ、{agent?.name} が紹介者として記録されます。
          </p>

          {success && (
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              ✅ 登録しました。続けて別の学生を登録できます。
            </div>
          )}
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Section title="氏名（必須）">
              <Row>
                <FieldText label="姓" required value={lastName} onChange={setLastName} placeholder="山田" />
                <FieldText label="名" required value={firstName} onChange={setFirstName} placeholder="太郎" />
              </Row>
              <Row>
                <FieldText label="姓（カナ）" value={lastNameKana} onChange={setLastNameKana} placeholder="ヤマダ" />
                <FieldText label="名（カナ）" value={firstNameKana} onChange={setFirstNameKana} placeholder="タロウ" />
              </Row>
            </Section>

            <Section title="基本情報（任意・マッチング精度向上）">
              <Row>
                <FieldDate label="生年月日" value={birthDate} onChange={setBirthDate} />
                <FieldSelect label="性別" value={gender} onChange={setGender} options={["", "男性", "女性", "その他"]} />
              </Row>
              <Row>
                <FieldText label="国籍" value={nationality} onChange={setNationality} placeholder="中国" />
                <FieldText label="メールアドレス" type="email" value={email} onChange={setEmail} placeholder="student@example.com" />
              </Row>
              <Row>
                <FieldText label="電話番号" type="tel" value={phone} onChange={setPhone} placeholder="090-1234-5678" />
                <div />
              </Row>
            </Section>

            <Section title="出願予定">
              <Row>
                <FieldText label="志望校" value={intendedSchool} onChange={setIntendedSchool} placeholder="中央ゼミナール" />
                <FieldText label="志望学科" value={intendedDepartment} onChange={setIntendedDepartment} placeholder="大学受験科" />
              </Row>
              <Row>
                <FieldSelect label="入学希望年" value={enrollmentYear} onChange={setEnrollmentYear} options={["", ...years.map(String)]} />
                <FieldDate label="出願予定日" value={expectedApplyDate} onChange={setExpectedApplyDate} />
              </Row>
            </Section>

            <Section title="メモ">
              <label className="block">
                <span className="text-xs text-gray-600 mb-1 block">渠道メモ（学生の特徴・補足）</span>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y min-h-[80px]"
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                  placeholder="例：日本語 N2 レベル / 11月に来日予定 / 大学進学希望"
                  maxLength={1000}
                />
              </label>
            </Section>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={submitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >クリア</button>
              <button
                type="submit"
                disabled={submitting || !lastName || !firstName}
                className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg"
              >
                {submitting ? "登録中..." : "登録する"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          このフォームは渠道専用です。複数学生を連続で登録できます。<br />
          登録後、運営側で自動マッチングが行われます。
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function FieldText({ label, required, value, onChange, placeholder, type = "text" }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">{label}</span>
      <input
        type="date"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">{label}</span>
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || "選択してください"}</option>
        ))}
      </select>
    </label>
  );
}
