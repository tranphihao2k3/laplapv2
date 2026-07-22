import axios, { AxiosError } from "axios";
import { env } from "@/lib/env";

export const api = axios.create({
  baseURL: env.NEXT_PUBLIC_APP_URL + "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error),
);

export type ApiError = AxiosError<{ message?: string; code?: string }>;
