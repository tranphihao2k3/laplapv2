/**
 * Tailwind config — design tokens tối thiểu cho M3 UI.
 *
 * Convention repo root: shadcn + Tailwind, hệ thống token 3 lớp (primitive
 * → semantic → component). M3 chỉ cần primitive + semantic. UI-* sau sẽ
 * bổ sung component tokens nếu cần.
 *
 * Màu chính: LapLap primary #2563eb (blue-600), success #16a34a, warning
 * #d97706, danger #dc2626. Đã tinh chỉnh để phù hợp giao diện Facebook
 * tiếng Việt (theo docs §15 UI conventions).
 */
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        success: { 500: "#22c55e", 600: "#16a34a" },
        warning: { 500: "#f59e0b", 600: "#d97706" },
        danger: { 500: "#ef4444", 600: "#dc2626" },
        muted: { 50: "#f9fafb", 100: "#f3f4f6", 500: "#6b7280", 900: "#111827" },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;