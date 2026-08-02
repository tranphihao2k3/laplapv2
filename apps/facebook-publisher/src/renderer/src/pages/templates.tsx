/**
 * Templates page — TPL-001/TPL-002 UI.
 *
 * - List templates, create/edit/delete.
 * - Editor textarea + variable list (clickable insert).
 * - Live preview qua templatesPreview, dùng giá trị giả định cho
 *   {{product.name}}, {{variant.price}}, ... (UI không cần catalog sync).
 */
import { useEffect, useMemo, useState } from "react";
import type { TemplateRecord } from "../../../shared/templates";

const SAMPLE_VARIABLES: Record<string, unknown> = {
  "product.name": "Laptop LapLap Air 13",
  "product.shortDescription": "Mỏng nhẹ, pin 12 giờ",
  "product.slug": "laplap-air-13",
  "product.updatedAt": "2026-08-01T10:00:00Z",
  "variant.sku": "LAP-AIR-13-2024",
  "variant.name": "Bản 16GB/512GB",
  "variant.price": 24500000,
  "variant.availableQty": 7,
  "group.name": "Mua bán laptop Hà Nội",
  "group.url": "https://facebook.com/groups/laptop-hn",
  "post.id": "demo-post-id",
  "post.scheduledAt": "2026-08-05T09:00:00Z",
};

const VARIABLE_HINTS = [
  "product.name",
  "product.shortDescription",
  "product.slug",
  "product.updatedAt",
  "variant.sku",
  "variant.name",
  "variant.price",
  "variant.availableQty",
  "group.name",
  "group.url",
  "post.id",
  "post.scheduledAt",
];

export function TemplatesPage() {
  const [items, setItems] = useState<TemplateRecord[]>([]);
  const [editing, setEditing] = useState<TemplateRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.templatesList();
    if (r.ok) setItems(r.data);
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Xoá mẫu đăng này?")) return;
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.templatesDelete(id);
    if (!r.ok) setError(r.error.message);
    void load();
  }

  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mẫu đăng</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Tạo mẫu
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded border border-muted-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted-50 text-left text-xs uppercase text-muted-500">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Thân (rút gọn)</th>
              <th className="px-3 py-2">Cập nhật</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-500">
                  Chưa có mẫu nào. Bấm "Tạo mẫu".
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className="border-t border-muted-100">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2 text-muted-500">
                  {t.body.length > 80 ? t.body.slice(0, 80) + "…" : t.body}
                </td>
                <td className="px-3 py-2 text-xs text-muted-500">
                  {t.updatedAt ? new Date(t.updatedAt).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="mr-1 rounded border border-muted-100 px-2 py-0.5 text-xs hover:bg-muted-50"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(t.id)}
                    className="rounded border border-danger-500 px-2 py-0.5 text-xs text-danger-600 hover:bg-danger-50"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <TemplateForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
            setError(null);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            setError(null);
            void load();
          }}
          onError={setError}
        />
      )}
    </section>
  );
}

function TemplateForm(props: {
  initial?: TemplateRecord;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!props.initial;
  const [name, setName] = useState(props.initial?.name ?? "");
  const [body, setBody] = useState(props.initial?.body ?? "Sản phẩm {{product.name}}\nGiá: {{variant.price}}\nNhóm: {{group.name}}");
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const detected = useMemo(() => {
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      if (m[1]) out.add(m[1]);
    }
    return Array.from(out);
  }, [body]);

  async function refreshPreview() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.templatesPreview({ body, context: SAMPLE_VARIABLES, locale: "vi-VN" });
    if (r.ok) {
      setPreview(r.data.text);
      setPreviewError(null);
    } else {
      setPreviewError(r.error.message);
      setPreview("");
    }
  }

  useEffect(() => {
    void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const api = window.publisherApi;
    if (!api) return;
    setSubmitting(true);
    const r = isEdit
      ? await api.templatesUpdate(props.initial!.id, {
          name,
          body,
          allowlistedVariables: detected,
          previewContext: SAMPLE_VARIABLES,
          previewLocale: "vi-VN",
        })
      : await api.templatesCreate({
          name,
          body,
          allowlistedVariables: detected,
          previewContext: SAMPLE_VARIABLES,
          previewLocale: "vi-VN",
        });
    setSubmitting(false);
    if (!r.ok) {
      props.onError(r.error.message);
      return;
    }
    props.onSaved();
  }

  function insertVar(v: string) {
    setBody((prev: string) => `${prev}{{${v}}}`);
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30">
      <form
        onSubmit={onSubmit}
        className="grid h-[80vh] w-[min(960px,90vw)] grid-cols-2 gap-4 rounded-lg border border-muted-100 bg-white p-5 shadow-lg"
      >
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">{isEdit ? "Sửa mẫu" : "Tạo mẫu"}</h2>
          <label className="mt-3 block text-sm">
            <span>Tên</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
            />
          </label>
          <label className="mt-3 flex flex-1 flex-col text-sm">
            <span>Thân mẫu</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="mt-1 block flex-1 rounded border border-muted-100 px-2 py-1.5 font-mono"
            />
          </label>
          <div className="mt-2 text-xs text-muted-500">
            Biến phát hiện: {detected.length === 0 ? "(không có)" : detected.join(", ")}
          </div>
        </div>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">Preview</h3>
          <p className="mt-1 text-xs text-muted-500">
            Dùng dữ liệu mẫu (SAMPLE_VARIABLES). Văn bản cuối sẽ được render lại khi enqueue job.
          </p>
          <div className="mt-2 flex-1 overflow-auto rounded border border-muted-100 bg-muted-50 p-3 whitespace-pre-wrap text-sm">
            {previewError ? (
              <span className="text-danger-600">{previewError}</span>
            ) : (
              preview || "(đang render…)"
            )}
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium">Biến có sẵn (click để chèn)</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {VARIABLE_HINTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded border border-muted-100 px-2 py-0.5 font-mono text-xs hover:bg-muted-50"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-muted-100 px-3 py-1.5 text-sm hover:bg-muted-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}