import { useState } from "react";
import { useSettings, useAppStore } from "../store/app-store";
import type { SettingsPatch } from "../../../shared/settings";

export function SettingsPage() {
  const settings = useSettings();
  const defaults = useAppStore((s) => s.defaults);
  const patch = useAppStore((s) => s.patchSettings);
  const reset = useAppStore((s) => s.resetSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!settings || !defaults) {
    return <p className="text-sm text-muted-500">Đang tải cấu hình…</p>;
  }

  async function onSave(values: SettingsPatch) {
    setSaving(true);
    setError(null);
    try {
      await patch(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1 className="text-lg font-semibold">Cấu hình</h1>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600"
        >
          {error}
        </p>
      )}
      <form
        className="mt-3 space-y-3 rounded border border-muted-100 bg-white p-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onSave({
            apiBaseUrl: String(fd.get("apiBaseUrl") ?? "").trim(),
            locale:
              String(fd.get("locale")) === "en"
                ? "en"
                : ("vi" as const),
            defaultPostingMode:
              (String(fd.get("defaultPostingMode")) as "assisted" | "auto") === "auto"
                ? "auto"
                : "assisted",
            autoSubmitGloballyAllowed: fd.get("autoSubmit") === "on",
            httpTimeoutMs: Number(fd.get("httpTimeoutMs") ?? 15000),
            playwrightTimeoutMs: Number(fd.get("playwrightTimeoutMs") ?? 30000),
            diagnosticsTtlMs: Number(fd.get("diagnosticsTtlMs") ?? 7 * 24 * 3600 * 1000),
          });
        }}
      >
        <Field label="API base URL" name="apiBaseUrl" defaultValue={settings.apiBaseUrl} />
        <SelectField
          label="Locale"
          name="locale"
          defaultValue={settings.locale}
          options={[
            { value: "vi", label: "Tiếng Việt (vi)" },
            { value: "en", label: "English (en)" },
          ]}
        />
        <SelectField
          label="Default posting mode"
          name="defaultPostingMode"
          defaultValue={settings.defaultPostingMode}
          options={[
            { value: "assisted", label: "Assisted (an toàn — mặc định)" },
            { value: "auto", label: "Auto (cần GOV-AUTO + autoSubmit bật)" },
          ]}
        />
        <CheckboxField
          label="Cho phép auto-submit (cần GOV-AUTO duyệt)"
          name="autoSubmit"
          defaultChecked={settings.autoSubmitGloballyAllowed}
        />
        <Field
          label="HTTP timeout (ms)"
          name="httpTimeoutMs"
          defaultValue={String(settings.httpTimeoutMs)}
          type="number"
        />
        <Field
          label="Playwright timeout (ms)"
          name="playwrightTimeoutMs"
          defaultValue={String(settings.playwrightTimeoutMs)}
          type="number"
        />
        <Field
          label="Diagnostics TTL (ms)"
          name="diagnosticsTtlMs"
          defaultValue={String(settings.diagnosticsTtlMs)}
          type="number"
        />

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded border border-muted-100 px-3 py-1.5 text-sm hover:bg-muted-50"
          >
            Khôi phục mặc định
          </button>
        </div>

        <div className="pt-2 text-xs text-muted-500">
          Mặc định: locale={defaults.locale}, posting={defaults.defaultPostingMode},
          autoSubmit={String(defaults.autoSubmitGloballyAllowed)}, timeout={defaults.httpTimeoutMs}ms,
          Playwright={defaults.playwrightTimeoutMs}ms, TTL={defaults.diagnosticsTtlMs}ms.
        </div>
      </form>
    </section>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-muted-900">{props.label}</span>
      <input
        name={props.name}
        defaultValue={props.defaultValue}
        type={props.type ?? "text"}
        className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-muted-900">{props.label}</span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField(props: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        name={props.name}
        type="checkbox"
        defaultChecked={props.defaultChecked}
        className="h-4 w-4 rounded border-muted-100"
      />
      <span className="text-muted-900">{props.label}</span>
    </label>
  );
}
