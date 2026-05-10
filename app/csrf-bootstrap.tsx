"use client";

import { useEffect } from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function CsrfBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { __csrfPatched?: boolean };
    if (w.__csrfPatched) return;
    w.__csrfPatched = true;

    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return original(input, init);
      }
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.startsWith("/api/")) return original(input, init);

      const token = readCookie("csrf_token");
      if (!token) return original(input, init);

      const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
      if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
      return original(input, { ...init, headers });
    };

    // XMLHttpRequest 経由のリクエストにも CSRF トークンを自動付与
    type XHR = XMLHttpRequest & { __csrfMethod?: string; __csrfUrl?: string };
    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (this: XHR, method, url, ...rest: unknown[]) {
      this.__csrfMethod = String(method).toUpperCase();
      this.__csrfUrl = typeof url === "string" ? url : url.toString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (xhrOpen as any).call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (this: XHR, body?: Document | XMLHttpRequestBodyInit | null) {
      const m = this.__csrfMethod || "GET";
      const u = this.__csrfUrl || "";
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS" && u.startsWith("/api/")) {
        const token = readCookie("csrf_token");
        if (token) {
          try { this.setRequestHeader("x-csrf-token", token); } catch { /* already sent */ }
        }
      }
      return xhrSend.call(this, body ?? null);
    };
  }, []);
  return null;
}
