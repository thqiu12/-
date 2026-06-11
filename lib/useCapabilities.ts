"use client";

import { useEffect, useState } from "react";

/**
 * ログイン中の管理ユーザーの「有効権限」をクライアントで取得するフック。
 * UIの操作可否（合否ドロップダウン・各送信ボタン等）の出し分けに使う。
 * super_admin は全権限が返る。サーバー側の hasCapability が最終的な実行ガード。
 */
export interface UseCapabilities {
  caps: Set<string>;
  role: string | null;
  loaded: boolean;
  can: (cap: string) => boolean;
}

export function useCapabilities(): UseCapabilities {
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (cancelled) return;
        setRole(d?.user?.role ?? null);
        setCaps(new Set<string>(Array.isArray(d?.user?.capabilities) ? d.user.capabilities : []));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);
  // loaded 前は楽観的に許可（チラつき防止）。最終ガードはサーバー側。
  const can = (cap: string) => !loaded || caps.has(cap);
  return { caps, role, loaded, can };
}
