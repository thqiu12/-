"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center text-3xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h2>
        <p className="text-sm text-gray-500 mb-6">
          システムで予期しないエラーが発生しました。お手数ですが再度お試しください。
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">エラーID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition"
          >
            再試行
          </button>
          <a
            href="/"
            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition"
          >
            トップへ
          </a>
        </div>
      </div>
    </div>
  );
}
