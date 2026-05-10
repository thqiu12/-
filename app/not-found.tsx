import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-6xl font-bold text-gray-300 mb-4">404</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">ページが見つかりません</h2>
        <p className="text-sm text-gray-500 mb-6">URLをご確認ください。</p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
