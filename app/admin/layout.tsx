"use client";

import { usePathname } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

/**
 * 管理画面の共通レイアウト。
 * /admin (ログイン画面) と /admin/applications/[id] (印刷向け、フル幅優先) は
 * シェルなしで描画。それ以外はサイドバー付き wsdb 風シェル。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  // シェル不要のパス
  const NO_SHELL = pathname === "/admin"; // ログイン画面

  if (NO_SHELL) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
