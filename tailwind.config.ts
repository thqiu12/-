import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // ステータス・状態バッジで動的に組み立てる色クラスを保護。
  // ※ 通常は静的解析で十分。JIT が見落とすケースに備えた防波堤。
  safelist: [
    { pattern: /^(bg|text|border)-(red|green|blue|yellow|amber|indigo|purple|cyan|sky|teal|orange|gray)-(50|100|200|300|400|500|600|700|800|900)$/ },
    { pattern: /^(bg|text|border)-navy-(50|100|200|300|400|500|600|700|800|900)$/ },
  ],
  theme: {
    extend: {
      colors: {
        // wsdb 由来：管理画面のサイドバー暗色
        sidebar: {
          DEFAULT: "#14212c",
          end: "#18302b",   // グラデ終点
          hover: "rgba(255,255,255,.1)",
        },
        // 既存 navy（互換維持。新規UIは ink/muted/soft を優先）
        navy: {
          50: "#e8edf3",
          100: "#c5d1e0",
          200: "#9fb3cb",
          300: "#7895b6",
          400: "#577fa6",
          500: "#366996",
          600: "#2c5a82",
          700: "#234a6e",
          800: "#1e3a5f",
          900: "#162c4a",
        },
        // wsdb 風セマンティック
        ink:    "#1a242d",  // 本文
        muted:  "#6b7785",  // サブ文
        line:   "#dde6eb",  // 罫線
        soft:   "#f5f8fa",  // カード薄背景
        ok:     "#16493c",  // 緑系（合格・在籍）
        warn:   "#b7791f",  // 黄系（要確認）
        danger: "#b42318",  // 赤系（退学・低出席）
        accent: "#2563eb",  // 青系（CTA・リンク）
      },
      boxShadow: {
        // wsdb 風カードシャドウ
        soft: "0 18px 44px rgba(12, 22, 30, .08)",
      },
      borderRadius: {
        wsdb: "8px",  // wsdb 既定 --radius
      },
      fontFamily: {
        sans: [
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
