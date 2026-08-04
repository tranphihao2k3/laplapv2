/**
 * Settings page.
 *
 * - Form chia 2 cột: chung (locale, posting, auto-submit) + kỹ thuật
 *   (timeouts, TTL).
 * - Mỗi field có helper giải thích.
 * - Save button có loading state; reset button có confirm.
 */
import { useState } from "react";
import { useSettings, useAppStore } from "../store/app-store";
import type { SettingsPatch } from "../../../shared/settings";
import {
  Alert,
  Button,
  Card,
  Input,
  PageHeader,
} from "../components/ui";
import { IconRefresh, IconSettings } from "../components/ui/icons";

export function SettingsPage() {
  const settings = useSettings();
  const defaults = useAppStore((s) => s.defaults);
  const patch = useAppStore((s) => s.patchSettings);
  const reset = useAppStore((s) => s.resetSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!settings || !defaults) {
    return (
      <section className="space-y-5">
        <PageHeader title="Cấu hình" />
        <Card padding="lg">
          <p className="text-sm text-muted-500">Đang tải cấu hình…</p>
        </Card>
      </section>
    );
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
    <section className="space-y-5">
      <PageHeader
        title="Cấu hình"
        subtitle="Thiết lập locale, posting mode, timeouts."
      />

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onSave({
            apiBaseUrl: String(fd.get("apiBaseUrl") ?? "").trim(),
            locale:
              String(fd.get("locale")) === "en" ? "en" : ("vi" as const),
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
        <Card padding="md">
          <header className="mb-3 flex items-center gap-2">
            <IconSettings size={16} className="text-muted-500" />
            <h2 className="text-sm font-semibold text-muted-900">Chung</h2>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="API base URL"
              name="apiBaseUrl"
              defaultValue={settings.apiBaseUrl}
              placeholder="https://api.laplap.example"
            />
            <SelectField
              label="Locale"
              name="locale"
              defaultValue={settings.locale}
              options={[
                { value: "vi", label: "Tiếng Việt (vi)" },
                { value: "en", label: "English (en)" },
              ]}
              helper="Ngôn ngữ dùng cho format số/ngày trong template."
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
          </div>
        </Card>

        <Card padding="md">
          <header className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-900">Auto-submit</h2>
          </header>
          <CheckboxField
            label="Cho phép auto-submit (cần GOV-AUTO duyệt)"
            name="autoSubmit"
            defaultChecked={settings.autoSubmitGloballyAllowed}
            helper="Khi bật, worker có thể auto-submit bài đăng mà không cần user nhấn xác nhận."
          />
        </Card>

        <Card padding="md">
          <header className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-900">Kỹ thuật</h2>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="HTTP timeout (ms)"
              name="httpTimeoutMs"
              type="number"
              defaultValue={String(settings.httpTimeoutMs)}
              helper="Thời gian tối đa cho mỗi HTTP call."
            />
            <Input
              label="Playwright timeout (ms)"
              name="playwrightTimeoutMs"
              type="number"
              defaultValue={String(settings.playwrightTimeoutMs)}
              helper="Thời gian tối đa cho page navigation/click."
            />
            <Input
              label="Diagnostics TTL (ms)"
              name="diagnosticsTtlMs"
              type="number"
              defaultValue={String(settings.diagnosticsTtlMs)}
              helper="Thời gian giữ log debug trước khi xoá."
            />
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            icon={<IconRefresh size={14} />}
            onClick={() => {
              if (window.confirm("Khôi phục toàn bộ cấu hình về mặc định?")) {
                void reset();
              }
            }}
          >
            Khôi phục mặc định
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? "Đang lưu…" : "Lưu cấu hình"}
          </Button>
        </div>

        <p className="text-xs text-muted-500">
          Mặc định: locale={defaults.locale}, posting={defaults.defaultPostingMode},
          autoSubmit={String(defaults.autoSubmitGloballyAllowed)},
          timeout={defaults.httpTimeoutMs}ms, Playwright={defaults.playwrightTimeoutMs}ms,
          TTL={defaults.diagnosticsTtlMs}ms.
        </p>
      </form>
    </section>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-700">{props.label}</span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="block h-9 w-full rounded-md border border-muted-200 bg-white px-2.5 text-sm transition focus:border-primary-500 focus:shadow-ring focus:outline-none"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.helper && (
        <span className="mt-1 block text-[11px] text-muted-500">{props.helper}</span>
      )}
    </label>
  );
}

function CheckboxField(props: {
  label: string;
  name: string;
  defaultChecked: boolean;
  helper?: string;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        name={props.name}
        type="checkbox"
        defaultChecked={props.defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-muted-300 text-primary-600 focus:ring-primary-500"
      />
      <span>
        <span className="block text-sm font-medium text-muted-900">{props.label}</span>
        {props.helper && (
          <span className="mt-0.5 block text-[11px] text-muted-500">{props.helper}</span>
        )}
      </span>
    </label>
  );
}