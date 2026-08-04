/**
 * Templates page — TPL-001/TPL-002 UI.
 *
 * - List template dạng card (thay table).
 * - Editor modal 2 pane: textarea + live preview.
 * - Biến click-to-insert + auto-detect.
 * - Sửa / Xoá / Tạo mới.
 */
import { useEffect, useMemo, useState } from "react";
import type { TemplateRecord } from "../../../shared/templates";
import {
  DEFAULT_TEMPLATE_BODY,
  SAMPLE_TEMPLATE_CONTEXT,
  TEMPLATE_VARIABLES,
  extractTemplateVariables,
} from "../../../shared/template-vars";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  IconEdit,
  IconInbox,
  IconPlus,
  IconTrash,
} from "../components/ui/icons";

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
    <section className="space-y-5">
      <PageHeader
        title="Mẫu đăng"
        subtitle={`${items.length} mẫu`}
        actions={
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
            Tạo mẫu
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" title="Lỗi" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<IconInbox size={22} />}
            title="Chưa có mẫu đăng"
            description={'Bấm "Tạo mẫu" để bắt đầu. Có thể dùng 1 trong 3 preset: Laptop Cần Thơ / Điện thoại / Phụ kiện.'}
            action={
              <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                Tạo mẫu
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => setEditing(t)}
              onDelete={() => void handleDelete(t.id)}
            />
          ))}
        </div>
      )}

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

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: TemplateRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-muted-900" title={template.name}>
            {template.name}
          </h3>
          {template.updatedAt && (
            <p className="mt-0.5 text-[11px] text-muted-500">
              Cập nhật: {new Date(template.updatedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>
        <Badge variant="neutral" size="sm">
          {template.allowlistedVariables.length} biến
        </Badge>
      </header>

      <div className="max-h-32 overflow-y-auto rounded-md border border-muted-100 bg-muted-50/40 p-2.5 font-mono text-xs leading-relaxed text-muted-700">
        {template.body}
      </div>

      <footer className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" icon={<IconEdit size={14} />} onClick={onEdit}>
          Sửa
        </Button>
        <Button variant="danger" size="sm" icon={<IconTrash size={14} />} onClick={onDelete}>
          Xoá
        </Button>
      </footer>
    </Card>
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
  const [body, setBody] = useState(props.initial?.body ?? DEFAULT_TEMPLATE_BODY);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const detected = useMemo(() => extractTemplateVariables(body), [body]);

  async function refreshPreview() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.templatesPreview({
      body,
      context: SAMPLE_TEMPLATE_CONTEXT,
      locale: "vi-VN",
    });
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
    if (!name.trim()) {
      setNameError("Tên mẫu không được rỗng");
      return;
    }
    setNameError(null);
    const api = window.publisherApi;
    if (!api) return;
    setSubmitting(true);
    const r = isEdit
      ? await api.templatesUpdate(props.initial!.id, {
          name,
          body,
          allowlistedVariables: detected,
          previewContext: SAMPLE_TEMPLATE_CONTEXT,
          previewLocale: "vi-VN",
        })
      : await api.templatesCreate({
          name,
          body,
          allowlistedVariables: detected,
          previewContext: SAMPLE_TEMPLATE_CONTEXT,
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
    setBody((prev: string) => (prev.length > 0 && !prev.endsWith(" ") ? prev + " " : prev) + `{{${v}}}`);
  }

  return (
    <Modal
      open
      onClose={props.onClose}
      title={isEdit ? "Sửa mẫu đăng" : "Tạo mẫu đăng"}
      description="Chỉnh sửa body với biến có sẵn. Preview render với dữ liệu mẫu."
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" form="template-form" loading={submitting}>
            {submitting ? "Đang lưu…" : "Lưu"}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={onSubmit} className="grid h-full grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Input
            label="Tên mẫu"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            placeholder="VD: Mặc định — Laptop Cần Thơ"
            required
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-700">Thân mẫu</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="block w-full rounded-md border border-muted-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed transition focus:border-primary-500 focus:shadow-ring focus:outline-none"
            />
          </label>

          <div className="rounded-md bg-muted-50/60 p-2.5 text-xs text-muted-700">
            <span className="font-medium">Biến phát hiện: </span>
            {detected.length === 0 ? (
              <span className="text-muted-500">(không có)</span>
            ) : (
              <span className="font-mono">{detected.join(", ")}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-900">Preview</h3>
            <p className="mt-0.5 text-[11px] text-muted-500">
              Dùng dữ liệu mẫu. Văn bản cuối sẽ render lại khi enqueue job.
            </p>
          </div>
          <div className="min-h-[200px] flex-1 overflow-auto rounded-md border border-muted-100 bg-muted-50/40 p-3 text-sm whitespace-pre-wrap text-muted-800">
            {previewError ? (
              <span className="text-danger-600">{previewError}</span>
            ) : preview ? (
              preview
            ) : (
              <span className="inline-flex items-center gap-2 text-muted-500">
                <Spinner size="sm" /> đang render…
              </span>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-700">Biến có sẵn (click để chèn)</p>
            <div className="mt-1.5 flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-md border border-muted-100 bg-white p-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded border border-muted-200 bg-muted-50/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

