import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export function LoginPage() {
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/catalog", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted-50">
      <form
        onSubmit={onSubmit}
        className="w-80 rounded-lg border border-muted-100 bg-white p-6 shadow-sm"
      >
        <h1 className="text-base font-semibold">Đăng nhập LapLap</h1>
        <p className="mt-1 text-xs text-muted-500">
          Dùng tài khoản marketing đã có quyền <code>publisher.use</code>.
        </p>
        <label className="mt-4 block text-sm">
          <span className="text-muted-900">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-muted-900">Mật khẩu</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-xs text-danger-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}