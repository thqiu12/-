"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 「希望者」セクションの上位タブ。希望者リストとエージェント管理を1つのナビ項目に統合する。
 * 希望者は全てエージェント経由のため、同一セクションとして行き来できるようにする。
 * ルートベースのタブ（各ページ・詳細・既存サブタブをそのまま維持）。
 */
const TABS = [
  { href: "/admin/prospects", label: "希望者リスト" },
  { href: "/admin/agents", label: "エージェント" },
];

export function AgentProspectTabs() {
  const pathname = usePathname() || "";
  return (
    <div className="flex border-b border-gray-200 mb-6 gap-1">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors
              ${active ? "border-navy-700 text-navy-800 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
