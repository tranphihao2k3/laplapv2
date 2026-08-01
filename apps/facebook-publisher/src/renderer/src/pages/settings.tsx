import { useSettings, useAppStore } from "../store/app-store";

export function SettingsPage() {
  const settings = useSettings();
  const defaults = useAppStore((s) => s.defaults);
  const patch = useAppStore((s) => s.patchSettings);

  if (!settings || !defaults) {
    return <p className="text-sm text-muted-500">Đang tải cấu hình…</p>;
  }

  return (
    <section>
      <h1 className="text-lg font-semibold">Cấu hình</h1>
      <div className="mt-3 space-y-2 rounded border border-muted-100 bg-white p-4 text-sm">
        <div>
          <span className="text-muted-500">API base URL:</span>{" "}
          <code className="rounded bg-muted-50 px-1.5 py-0.5">{settings.apiBaseUrl}</code>
        </div>
        <div>
          <span className="text-muted-500">Locale:</span> {settings.locale}
        </div>
        <div>
          <span className="text-muted-500">Default posting mode:</span>{" "}
          {settings.defaultPostingMode}
        </div>
        <div>
          <span className="text-muted-500">HTTP timeout (ms):</span>{" "}
          {settings.httpTimeoutMs}
        </div>
        <div className="pt-2">
          <button
            type="button"
            className="rounded border border-muted-100 px-3 py-1 text-xs hover:bg-muted-50"
            onClick={() => {
              void patch({ httpTimeoutMs: 20_000 });
            }}
          >
            Đặt HTTP timeout = 20s
          </button>
        </div>
        <div className="pt-2 text-xs text-muted-500">
          Default locale: {defaults.locale}; default posting: {defaults.defaultPostingMode}.
        </div>
      </div>
    </section>
  );
}