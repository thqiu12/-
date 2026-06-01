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
