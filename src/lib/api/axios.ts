import axios, { AxiosError } from "axios";

/**
 * Dùng relative URL `/api` thay vì tuyệt đối (`env.NEXT_PUBLIC_APP_URL + "/api"`)
 * để:
 *  1. Tránh CORS preflight ở production (client cùng origin với API).
 *  2. Không bị "đóng băng" host vào bundle lúc build — `NEXT_PUBLIC_APP_URL` không
 *     còn ảnh hưởng đến URL mà client gọi, chỉ còn dùng cho email link / share URL.
 *  3. Dev và prod hoạt động giống nhau, không cần đổi env khi đổi domain.
 *
 * Axios sẽ tự nối `baseURL` với `url` của request, vd `/api` + `/v1/products`
 * → `/api/v1/products`. Callers tiếp tục dùng `/v1/...` như cũ, không phải sửa.
 */
export const api = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error),
);

export type ApiError = AxiosError<{ message?: string; code?: string }>;
