/**
 * Tailwind config — design tokens cho app LapLap Facebook Publisher.
 *
 * Hệ thống token 3 lớp (primitive → semantic → component). Tailwind chỉ
 * có primitive + semantic; UI-* sau sẽ bổ sung component tokens nếu cần.
 *
 * Style: clean modern — white surface + subtle shadow + primary accent
 * + smooth transition. Touch target ≥ 44px.
 *
 * Anti-pattern tránh:
 *  - Random shadow values (định nghĩa scale: xs/sm/md/lg/xl).
 *  - Emoji icon (dùng Lucide SVG).
 *  - Inconsistent radius (scale: sm/md/lg/xl/full).
 *  - Hard-coded hex trong component (luôn dùng token).
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
        // Brand — LapLap primary blue.
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // Semantic — green/amber/red theo docs §15.
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        // Neutral scale (slate-50..900).
        muted: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      // Border radius scale — dùng semantic token.
      borderRadius: {
        none: "0",
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        full: "9999px",
      },
      // Box shadow scale — semantic cho elevation.
      boxShadow: {
        none: "none",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
        DEFAULT: "0 2px 4px -1px rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
        md: "0 4px 8px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)",
        lg: "0 12px 24px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.04)",
        xl: "0 24px 48px -12px rgb(15 23 42 / 0.18), 0 8px 16px -8px rgb(15 23 42 / 0.08)",
        // Focus ring — primary outline.
        ring: "0 0 0 3px rgb(37 99 235 / 0.18)",
        "ring-danger": "0 0 0 3px rgb(220 38 38 / 0.18)",
      },
      // Spacing — đã có từ Tailwind core, nhưng semantic naming.
      spacing: {
        section: "1.5rem",
        page: "2rem",
      },
      // Transition tokens — duration + easing mặc định.
      transitionDuration: {
        DEFAULT: "180ms",
        fast: "120ms",
        slow: "280ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
        "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
        "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      // Animation keyframes — dùng cho entrance/exit.
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-out": "fade-out 140ms cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-up": "slide-up 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-down": "slide-down 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "spin-slow": "spin-slow 1.2s linear infinite",
        shimmer: "shimmer 2s linear infinite",
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
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      // Backdrop blur tokens (cho modal/menu).
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;