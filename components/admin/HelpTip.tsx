"use client";

/**
 * 先生向けのヘルプ注釈。タイトルや項目の横に小さな「？」を置き、
 * ホバー/フォーカスで説明を表示する。レイアウトは変えない（絶対配置のツールチップ）。
 * 使い方: <HelpTip text={"1行目\n2行目"} />
 */
export function HelpTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`group/help relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label="ヘルプ"
        className="w-[18px] h-[18px] shrink-0 rounded-full bg-gray-200 text-gray-500 hover:bg-navy-600 hover:text-white text-[11px] font-bold leading-none flex items-center justify-center transition-colors cursor-help"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 w-64 max-w-[80vw] rounded-lg bg-navy-900 text-white text-[11px] font-normal leading-relaxed tracking-normal normal-case text-left px-3 py-2 shadow-xl whitespace-pre-line opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible group-focus-within/help:opacity-100 group-focus-within/help:visible transition-opacity duration-150"
      >
        {text}
      </span>
    </span>
  );
}
