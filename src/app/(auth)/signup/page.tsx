import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="container flex min-h-screen items-center justify-center py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Tạo tài khoản</h1>
          <p className="text-sm text-muted-foreground">Đăng ký để bắt đầu dùng LapLap</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
