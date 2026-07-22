import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("LapLap"),
});

const serverEnvSchema = envSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

// Giá trị fallback để build (thu thập page data, prerender /_not-found…) không
// chết khi thiếu env. Runtime thực tế vẫn cần env thật để Supabase hoạt động.
const FALLBACK: Env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_NAME: "LapLap",
};

const raw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  // Không throw — chỉ cảnh báo. Tránh làm hỏng `next build`.
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.warn(
    `[env] Thiếu hoặc sai biến môi trường: ${missing}. Đang dùng giá trị fallback — ` +
      `hãy cấu hình đúng NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY để app chạy đúng.`,
  );
}

export const env: Env = parsed.success ? parsed.data : FALLBACK;

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv được dùng ở client - chỉ import trong server code");
  }
  const result = serverEnvSchema.safeParse({
    ...env,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.success) {
    return {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  return result.data;
}
