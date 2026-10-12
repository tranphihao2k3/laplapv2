/**
 * Map mã lỗi Supabase Auth thành tiếng Việt + gợi ý.
 * (Tách ra khỏi form để tái sử dụng giữa login/signup.)
 */

type ErrorInfo = { title: string; hint?: string };

const MAP: Record<string, ErrorInfo> = {
  invalid_credentials: {
    title: "Sai email hoặc mật khẩu",
    hint: "Kiểm tra lại email và mật khẩu. Nếu quên hãy bấm \"Quên mật khẩu\".",
  },
  invalid_grant: {
    title: "Sai email hoặc mật khẩu",
    hint: "Thông tin đăng nhập không khớp.",
  },
  email_not_confirmed: {
    title: "Email chưa được xác nhận",
    hint: "Mở email (kể cả spam) và bấm vào liên kết xác nhận trước.",
  },
  user_not_found: {
    title: "Không tìm thấy tài khoản",
    hint: "Email này chưa đăng ký. Bấm \"Đăng ký ngay\" để tạo tài khoản.",
  },
  user_banned: {
    title: "Tài khoản bị khóa",
    hint: "Liên hệ cửa hàng để được hỗ trợ.",
  },
  weak_password: {
    title: "Mật khẩu quá yếu",
    hint: "Mật khẩu phải có ít nhất 6 ký tự, gồm chữ và số.",
  },
  over_request_rate_limit: {
    title: "Quá nhiều lần thử",
    hint: "Đợi vài phút rồi thử lại.",
  },
  over_email_send_rate_limit: {
    title: "Gửi email quá nhiều",
    hint: "Đợi vài phút trước khi yêu cầu email mới.",
  },
  email_exists: {
    title: "Email đã được sử dụng",
    hint: "Email này đã đăng ký. Bấm \"Đăng nhập\" thay.",
  },
  signup_disabled: {
    title: "Tính năng đăng ký đang tạm tắt",
  },
  email_provider_disabled: {
    title: "Đăng nhập bằng email đang tắt",
  },
  validation_failed: {
    title: "Dữ liệu không hợp lệ",
  },
  same_password: {
    title: "Mật khẩu mới phải khác mật khẩu hiện tại",
  },
  email_address_invalid: {
    title: "Email chưa hợp lệ",
  },
};

export function supabaseErrorToMessage(code: string | undefined, raw?: string): ErrorInfo & { code?: string; raw?: string } {
  const known = code ? MAP[code] : undefined;
  return {
    title: known?.title ?? raw ?? "Đăng nhập/đăng ký thất bại",
    hint: known?.hint,
    code,
    raw,
  };
}

export function isRecoverableAuthError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /fetch|network|failed to fetch|networkerror/i.test(e.message);
}

export function networkError(): ErrorInfo {
  return {
    title: "Không kết nối được máy chủ",
    hint: "Kiểm tra kết nối Internet hoặc thử lại sau.",
  };
}
