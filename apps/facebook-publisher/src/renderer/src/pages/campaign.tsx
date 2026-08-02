/**
 * Campaign wizard UI — CMP-001.
 *
 * Multi-step:
 *  - Step 1: chọn product + variant (CAT-002 reuse).
 *  - Step 2: chọn template + xem preview render (TPL-002 reuse).
 *  - Step 3: chọn group set hoặc chọn lẻ group enabled.
 *  - Step 4: review + enqueue.
 *
 * Back/next giữ state. Không enqueue khi thiếu variant/anh/group.
 */
import { useEffect, useMemo, useState } from "react";
import type {
  CampaignRecord,
  GroupRecord,
  GroupSetRecord,
  ProductSummary,
  ProductVariantSummary,
  TemplateRecord,
} from "../../../shared/publisher-api";

type Step = 1 | 2 | 3 | 4;

export function CampaignPage() {
  const [items, setItems] = useState<CampaignRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.campaignsList();
    if (r.ok) setItems(r.data);
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Xoá chiến dịch? Job queue liên quan sẽ xoá theo.")) return;
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.campaignsDelete(id);
    if (!r.ok) setError(r.error.message);
    void load();
  }

  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chiến dịch</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Tạo chiến dịch
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
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">Group set</th>
              <th className="px-3 py-2">Tạo lúc</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-500">
                  Chưa có chiến dịch. Bấm "Tạo chiến dịch".
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-muted-100">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs text-muted-500">{c.status}</td>
                <td className="px-3 py-2 text-xs">{c.productId.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-xs">{c.variantId.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-xs">{c.groupSetId ? c.groupSetId.slice(0, 8) + "…" : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-500">
                  {new Date(c.createdAt).toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
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
      {creating && (
        <CampaignWizard
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
          onError={setError}
        />
      )}
    </section>
  );
}

function CampaignWizard(props: {
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("Chiến dịch mới");
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [groupSetId, setGroupSetId] = useState<string | null>(null);
  const [enqueueResult, setEnqueueResult] = useState<{ created: number; duplicates: number } | null>(null);

  const canNext = useMemo(() => {
    if (step === 1) return !!productId && !!variantId;
    if (step === 2) return !!templateId;
    if (step === 3) return true; // group set optional
    return true;
  }, [step, productId, variantId, templateId]);

  async function enqueueAll() {
    if (!productId || !variantId || !templateId) {
      props.onError("Thiếu product/variant/template");
      return;
    }
    const api = window.publisherApi;
    if (!api) return;
    const created = await api.campaignsCreate({
      name,
      productId,
      variantId,
      templateId,
      groupSetId,
    });
    if (!created.ok) {
      props.onError(created.error.message);
      return;
    }
    const enq = await api.campaignsEnqueue({ campaignId: created.data.id });
    if (!enq.ok) {
      props.onError(enq.error.message);
      return;
    }
    setEnqueueResult({ created: enq.data.jobsCreated, duplicates: enq.data.duplicates });
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30">
      <div className="grid h-[80vh] w-[min(960px,90vw)] grid-rows-[auto,1fr,auto] rounded-lg border border-muted-100 bg-white p-5 shadow-lg">
        <header className="flex items-center justify-between border-b border-muted-100 pb-3">
          <h2 className="text-base font-semibold">Chiến dịch mới</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-muted-100 px-2 py-0.5 text-sm hover:bg-muted-50"
          >
            ✕
          </button>
        </header>
        <div className="overflow-auto py-4">
          <Steps step={step} />
          {step === 1 && (
            <Step1
              name={name}
              setName={setName}
              productId={productId}
              setProductId={setProductId}
              variantId={variantId}
              setVariantId={setVariantId}
            />
          )}
          {step === 2 && <Step2 templateId={templateId} setTemplateId={setTemplateId} />}
          {step === 3 && <Step3 groupSetId={groupSetId} setGroupSetId={setGroupSetId} />}
          {step === 4 && (
            <Step4
              name={name}
              productId={productId}
              variantId={variantId}
              templateId={templateId}
              groupSetId={groupSetId}
              enqueueResult={enqueueResult}
            />
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-muted-100 pt-3">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="rounded border border-muted-100 px-3 py-1.5 text-sm hover:bg-muted-50"
              >
                ← Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 4 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                Tiếp →
              </button>
            ) : enqueueResult ? (
              <button
                type="button"
                onClick={props.onSaved}
                className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                Xong
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void enqueueAll()}
                disabled={!canNext}
                className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                Enqueue {productId && variantId && templateId ? "" : "(thiếu)"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const labels = ["Sản phẩm", "Mẫu", "Nhóm", "Review"];
  return (
    <ol className="mb-4 flex justify-between text-xs">
      {labels.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        return (
          <li
            key={label}
            className={`flex-1 text-center ${
              active ? "font-medium text-primary-700" : done ? "text-success-600" : "text-muted-500"
            }`}
          >
            {idx}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function Step1(props: {
  name: string;
  setName: (v: string) => void;
  productId: string | null;
  setProductId: (v: string) => void;
  variantId: string | null;
  setVariantId: (v: string) => void;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [variants, setVariants] = useState<ProductVariantSummary[]>([]);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void api.catalogList({ page: 1, pageSize: 100 }).then((r) => r.ok && setProducts(r.data.items));
  }, []);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api || !props.productId) return;
    void api.catalogVariants(props.productId).then((r) => r.ok && setVariants(r.data));
  }, [props.productId]);

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span>Tên chiến dịch</span>
        <input
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
        />
      </label>
      <div>
        <p className="text-sm font-medium">Sản phẩm</p>
        <select
          className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5 text-sm"
          value={props.productId ?? ""}
          onChange={(e) => {
            props.setProductId(e.target.value || "");
            props.setVariantId("");
          }}
        >
          <option value="">-- Chọn sản phẩm --</option>
          {products.map((p) => (
            <option key={p.productId} value={p.productId}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="text-sm font-medium">Biến thể</p>
        <select
          className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5 text-sm"
          value={props.variantId ?? ""}
          disabled={!props.productId}
          onChange={(e) => props.setVariantId(e.target.value || "")}
        >
          <option value="">-- Chọn biến thể --</option>
          {variants.map((v) => (
            <option key={v.variantId} value={v.variantId}>
              {v.sku} {v.name ? `(${v.name})` : ""} — {v.sellingPrice ?? "?"}₫ — kho {v.availableQty}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Step2(props: {
  templateId: string | null;
  setTemplateId: (v: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void api.templatesList().then((r) => r.ok && setTemplates(r.data));
  }, []);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api || !props.templateId) return;
    const tpl = templates.find((t) => t.id === props.templateId);
    if (!tpl) return;
    void api
      .templatesPreview({
        body: tpl.body,
        context: {
          "product.name": "Laptop LapLap Air 13",
          "variant.price": 24500000,
          "variant.availableQty": 7,
          "group.name": "Mua bán laptop Hà Nội",
          "group.url": "https://facebook.com/groups/x",
        },
        locale: "vi-VN",
      })
      .then((r) => r.ok && setPreview(r.data.text));
  }, [props.templateId, templates]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Chọn mẫu</p>
      <select
        className="block w-full rounded border border-muted-100 px-2 py-1.5 text-sm"
        value={props.templateId ?? ""}
        onChange={(e) => props.setTemplateId(e.target.value || "")}
      >
        <option value="">-- Chọn mẫu --</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="rounded border border-muted-100 bg-muted-50 p-3 text-sm whitespace-pre-wrap">
        {preview || "(chọn mẫu để xem preview)"}
      </div>
    </div>
  );
}

function Step3(props: {
  groupSetId: string | null;
  setGroupSetId: (v: string | null) => void;
}) {
  const [sets, setSets] = useState<GroupSetRecord[]>([]);
  const [members, setMembers] = useState<GroupRecord[]>([]);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void api.groupSetsList().then((r) => r.ok && setSets(r.data));
  }, []);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api || !props.groupSetId) {
      setMembers([]);
      return;
    }
    void api.groupSetsMembers(props.groupSetId).then((r) => r.ok && setMembers(r.data));
  }, [props.groupSetId]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Tập nhóm</p>
      <select
        className="block w-full rounded border border-muted-100 px-2 py-1.5 text-sm"
        value={props.groupSetId ?? ""}
        onChange={(e) => props.setGroupSetId(e.target.value || null)}
      >
        <option value="">-- Tất cả nhóm enabled --</option>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div>
        <p className="text-xs text-muted-500">
          {props.groupSetId
            ? `${members.length} nhóm sẽ được đăng.`
            : "Mặc định sẽ đăng vào tất cả nhóm enabled."}
        </p>
      </div>
    </div>
  );
}

function Step4(props: {
  name: string;
  productId: string | null;
  variantId: string | null;
  templateId: string | null;
  groupSetId: string | null;
  enqueueResult: { created: number; duplicates: number } | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{props.name}</strong>
      </p>
      <ul className="list-disc pl-5 text-muted-500">
        <li>Product: {props.productId ?? "—"}</li>
        <li>Variant: {props.variantId ?? "—"}</li>
        <li>Template: {props.templateId ?? "—"}</li>
        <li>Group set: {props.groupSetId ?? "(tất cả nhóm enabled)"}</li>
      </ul>
      {props.enqueueResult && (
        <div className="mt-4 rounded border border-success-500 bg-success-50 p-3 text-success-600">
          Đã enqueue {props.enqueueResult.created} job (bỏ qua {props.enqueueResult.duplicates} bản trùng).
        </div>
      )}
    </div>
  );
}