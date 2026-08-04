/**
 * Login page — đăng nhập LapLap.
 *
 * - Centered card trên nền gradient nhẹ.
 * - Toggle "Ghi nhớ đăng nhập" → truyền xuống main process để lưu
 *   refresh token (đã mã hoá) cho lần sau.
 */
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import {
  Alert,
  Button,
  Card,
  Input,
  Spinner,
} from "../components/ui";
import { IconRocket } from "../components/ui/icons";

export function LoginPage() {
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password, rememberMe });
      navigate("/catalog", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md">
            <IconRocket size={24} />
          </div>
          <h1 className="text-lg font-semibold text-muted-900">LapLap Publisher</h1>
          <p className="text-xs text-muted-500">Facebook auto-poster cho LapLap</p>
        </div>

        <Card padding="lg">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-muted-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-muted-700">
                <span className="block font-medium text-muted-900">Ghi nhớ đăng nhập</span>
                <span className="text-[11px] text-muted-500">
                  Token được mã hoá và lưu local. Lần sau không cần nhập lại.
                </span>
              </span>
            </label>

            {error && (
              <Alert variant="danger">{error}</Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={submitting}
            >
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[11px] text-muted-500">
          Dùng tài khoản marketing đã có quyền <code>publisher.use</code>.
        </p>
      </div>
    </div>
  );
}

/** Re-export để tree-shake guard. */
export { Spinner };