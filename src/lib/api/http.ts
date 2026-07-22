import { AxiosError } from "axios";
import { api } from "./axios";
import type { ApiResponse } from "./response";

type ErrorPayload = {
  ok?: false;
  error?: {
    message?: string;
    fields?: Record<string, string[] | undefined>;
    requestId?: string;
  };
};

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null && "error" in value;
}

export async function http<T>(...args: Parameters<typeof api.request>): Promise<T> {
  try {
    const res = await api.request<ApiResponse<T>>(...args);
    if (!res.data.ok) throw res.data;
    return res.data.data;
  } catch (err) {
    if (err instanceof AxiosError) {
      const payload = err.response?.data;
      if (isErrorPayload(payload)) throw payload;
    }
    throw err;
  }
}

export const httpGet = <T>(url: string, params?: Record<string, unknown>) =>
  http<T>({ method: "GET", url, params });

export const httpPost = <T>(url: string, data?: unknown) =>
  http<T>({ method: "POST", url, data });

export const httpPatch = <T>(url: string, data?: unknown) =>
  http<T>({ method: "PATCH", url, data });

export const httpDelete = <T>(url: string) => http<T>({ method: "DELETE", url });
