/**
 * Zustand store — auth + settings snapshot cho renderer.
 *
 * Không cache business data (products, groups, ...) ở đây — đó là việc của
 * query layer (CAT-001). Store này chỉ chứa:
 *  - authStatus: từ publisherApi.authGetStatus().
 *  - settings: từ publisherApi.settingsGet().
 *
 * Pattern:
 *  - Hydrate lúc app start: bootstrap().
 *  - Sau mutate (login/logout/settings.patch): refetch qua action.
 *  - Renderer UI subscribe qua hook `useAuth` / `useSettings`.
 */
import { create } from "zustand";
import type { AuthStatus } from "../../shared/auth";
import type { AppSettings, SettingsPatch } from "../../shared/settings";

type AuthState = {
  status: AuthStatus | null;
  loading: boolean;
  error: string | null;
};

type SettingsState = {
  data: AppSettings | null;
  defaults: AppSettings | null;
  loading: boolean;
  error: string | null;
};

type AppStore = AuthState &
  SettingsState & {
    bootstrap: () => Promise<void>;
    refreshAuth: () => Promise<void>;
    refreshSettings: () => Promise<void>;
    login: (input: { email: string; password: string }) => Promise<AuthStatus>;
    logout: () => Promise<void>;
    patchSettings: (patch: SettingsPatch) => Promise<void>;
  };

const initial: AuthState & SettingsState = {
  status: null,
  loading: false,
  error: null,
  data: null,
  defaults: null,
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initial,

  async bootstrap() {
    set({ loading: true, error: null });
    try {
      const api = window.publisherApi;
      if (!api) throw new Error("publisherApi chưa sẵn sàng");

      const [authResult, settingsResult, defaultsResult] = await Promise.all([
        api.authGetStatus(),
        api.settingsGet(),
        api.settingsGetDefaults(),
      ]);

      if (!authResult.ok) throw new Error(authResult.error.message);
      if (!settingsResult.ok) throw new Error(settingsResult.error.message);
      if (!defaultsResult.ok) throw new Error(defaultsResult.error.message);

      set({
        status: authResult.data,
        data: settingsResult.data,
        defaults: defaultsResult.data,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  async refreshAuth() {
    const api = window.publisherApi;
    if (!api) return;
    const result = await api.authGetStatus();
    if (result.ok) set({ status: result.data });
  },

  async refreshSettings() {
    const api = window.publisherApi;
    if (!api) return;
    const result = await api.settingsGet();
    if (result.ok) set({ data: result.data });
  },

  async login(input) {
    const api = window.publisherApi;
    if (!api) throw new Error("publisherApi chưa sẵn sàng");
    set({ loading: true, error: null });
    const result = await api.authLogin(input);
    if (!result.ok) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }
    set({ status: result.data, loading: false });
    return result.data;
  },

  async logout() {
    const api = window.publisherApi;
    if (!api) return;
    await api.authLogout();
    const status = await api.authGetStatus();
    if (status.ok) set({ status: status.data });
  },

  async patchSettings(patch) {
    const api = window.publisherApi;
    if (!api) return;
    set({ loading: true, error: null });
    const result = await api.settingsPatch(patch);
    if (!result.ok) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }
    set({ data: result.data, loading: false });
  },
}));

// Selector helpers — re-export để component subscribe nhỏ hơn.
export const useAuth = () => useAppStore((s) => s.status);
export const useSettings = () => useAppStore((s) => s.data);
export const useSettingsDefaults = () => useAppStore((s) => s.defaults);