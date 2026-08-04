/**
 * Campaign wizard UI — CMP-001.
 *
 * - List campaign dạng card (thay table).
 * - Wizard modal 4 step với step indicator đẹp.
 * - Step content: chọn product+variant, template, group set, review.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CampaignRecord,
  GroupRecord,
  GroupSetRecord,
  ProductSummary,
  ProductVariantSummary,
  TemplateRecord,
} from "../../../shared/publisher-api";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
} from "../components/ui";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconPlus,
  IconRocket,
  IconTrash,
} from "../components/ui/icons";

type Step = 1 | 2 | 3 | 4;

const STATUS_VARIANT: Record<CampaignRecord["status"], "neutral" | "primary" | "success" | "warning"> = {
  draft: "neutral",
  ready: "primary",
  archived: "warning",
};

const STATUS_LABEL: Record<CampaignRecord["status"], string> = {
  draft: "Nháp",
  ready: "Sẵn sàng",
  archived: "Đã lưu trữ",
};

export function CampaignPage() {
  const [items, setItems] = useState<CampaignRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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

  // Re-enqueue campaign ĐÃ CÓ: gọi lại enqueue với cùng campaignId.
  // Service tự skip nếu job cũ cùng fingerprint đang active (unique partial),
  // và INSERT job mới nếu job cũ đã ở state terminal (published/failed/skipped/...).
  // → user không cần tạo lại campaign từ đầu.
  const [repostingId, setRepostingId] = useState<string | null>(null);
  async function handleRepost(campaignId: string) {
    const api = window.publisherApi;
    if (!api) return;
    setRepostingId(campaignId);
    try {
      // Lấy job list trước để cảnh báo nếu có job đang chạy (sẽ bị skip).
      let activeCount = 0;
      try {
        const jobsRes = await api.campaignsJobs(campaignId);
        if (jobsRes.ok) {
          activeCount = jobsRes.data.filter((j) =>
            ["queued", "preflight", "posting", "awaiting_confirmation"].includes(j.state),
          ).length;
        }
      } catch {
        // ignore — vẫn cho phép enqueue.
      }
      if (activeCount > 0) {
        const ok = window.confirm(
          `Có ${activeCount} job đang chạy/queue — các job trùng fingerprint sẽ bị BỎ QUA. Tiếp tục?`,
        );
        if (!ok) return;
      } else {
        const ok = window.confirm(
          "Đăng lại chiến dịch này? Sẽ tạo job mới cho mỗi nhóm (job cũ đã xong) và chạy worker.",
        );
        if (!ok) return;
      }
      const enq = await api.campaignsEnqueue({ campaignId });
      if (!enq.ok) {
        setError(enq.error.message);
        return;
      }
      // Auto-start worker + navigate Queue (giống flow tạo mới).
      try {
        await api.workerStart();
      } catch {
        // ignore — có thể đã chạy.
      }
      try {
        sessionStorage.setItem(
          "queue.flash",
          JSON.stringify({
            kind: "reposted",
            jobsCreated: enq.data.jobsCreated,
            duplicates: enq.data.duplicates,
            at: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      navigate("/queue");
      void load();
    } finally {
      setRepostingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Chiến dịch"
        subtitle={`${items.length} chiến dịch`}
        actions={
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
            Tạo chiến dịch
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {items.length === 0 ? (        <Card padding="none">
          <EmptyState
            icon={<IconRocket size={22} />}
            title="Chưa có chiến dịch"
            description="Tạo chiến dịch để gom sản phẩm + mẫu + nhóm thành 1 lệnh đăng."
            action={
              <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                Tạo chiến dịch
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onDelete={() => void handleDelete(c.id)}
              onRepost={() => void handleRepost(c.id)}
              isReposting={repostingId === c.id}
            />
          ))}
        </div>
      )}

      {creating && (
        <CampaignWizard
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
          onEnqueued={async (jobsCreated, duplicates) => {
            setCreating(false);
            void load();
            // Auto-start worker để user không phải bấm Start thủ công.
            // Bỏ qua lỗi — worker có thể đã chạy sẵn.
            try {
              await window.publisherApi?.workerStart();
            } catch {
              /* ignore */
            }
            // Pass thông báo sang Queue qua sessionStorage.
            try {
              sessionStorage.setItem(
                "queue.flash",
                JSON.stringify({
                  kind: "enqueued",
                  jobsCreated,
                  duplicates,
                  at: Date.now(),
                }),
              );
            } catch {
              /* sessionStorage có thể bị block — không chặn flow */
            }
            navigate("/queue");
          }}
          onError={setError}
        />
      )}
    </section>
  );
}

function CampaignCard({
  campaign,
  onDelete,
  onRepost,
  isReposting,
}: {
  campaign: CampaignRecord;
  onDelete: () => void;
  onRepost: () => void;
  isReposting: boolean;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-muted-900" title={campaign.name}>
            {campaign.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-500">
            Tạo: {new Date(campaign.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[campaign.status]} size="sm">
          {STATUS_LABEL[campaign.status]}
        </Badge>
      </header>

      <dl className="space-y-1 text-xs text-muted-700">
        <Row label="Product" value={campaign.productId} mono />
        <Row label="Variant" value={campaign.variantId} mono />
        <Row label="Template" value={campaign.templateId} mono />
        <Row
          label="Group set"
          value={campaign.groupSetId ?? "(tất cả nhóm enabled)"}
          mono
        />
      </dl>

      <footer className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          icon={<IconRocket size={14} />}
          loading={isReposting}
          onClick={onRepost}
          title="Tạo job mới từ chiến dịch này để đăng lại"
        >
          Đăng lại
        </Button>
        <Button variant="danger" size="sm" icon={<IconTrash size={14} />} onClick={onDelete}>
          Xoá
        </Button>
      </footer>
    </Card>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const display = value.length > 24 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  return (
    <div className="flex items-center gap-2">
      <dt className="w-20 shrink-0 text-muted-500">{label}</dt>
      <dd className={["truncate", mono ? "font-mono" : ""].join(" ")} title={value}>
        {display}
      </dd>
    </div>
  );
}

function CampaignWizard(props: {
  onClose: () => void;
  onSaved: () => void;
  /** Được gọi SAU KHI enqueue xong với số job đã insert. Page dùng để
   *  auto-start worker và navigate sang /queue. */
  onEnqueued: (jobsCreated: number, duplicates: number) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("Chiến dịch mới");
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [groupSetId, setGroupSetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) return !!productId && !!variantId;
    if (step === 2) return !!templateId;
    return true;
  }, [step, productId, variantId, templateId]);

  async function enqueueAll() {
    if (!productId || !variantId || !templateId) {
      props.onError("Thiếu product/variant/template");
      return;
    }
    const api = window.publisherApi;
    if (!api) return;
    setSubmitting(true);
    const created = await api.campaignsCreate({
      name,
      productId,
      variantId,
      templateId,
      groupSetId,
    });
    if (!created.ok) {
      setSubmitting(false);
      props.onError(created.error.message);
      return;
    }
    const enq = await api.campaignsEnqueue({ campaignId: created.data.id });
    setSubmitting(false);
    if (!enq.ok) {
      props.onError(enq.error.message);
      return;
    }
    await props.onEnqueued(enq.data.jobsCreated, enq.data.duplicates);
  }

  return (
    <Modal
      open
      onClose={props.onClose}
      title="Chiến dịch mới"
      description="Chọn sản phẩm, mẫu, nhóm rồi enqueue job đăng bài."
      size="lg"
    >
      <StepIndicator step={step} />

      <div className="mt-5 min-h-[280px]">
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
          />
        )}
      </div>

      <footer className="mt-6 flex items-center justify-between border-t border-muted-100 pt-4">
        <Button
          variant="secondary"
          size="md"
          icon={<IconArrowLeft size={14} />}
          disabled={step === 1}
          onClick={() => setStep((s) => (s - 1) as Step)}
        >
          Quay lại
        </Button>
        <div className="flex gap-2">
          {step < 4 ? (
            <Button
              variant="primary"
              size="md"
              iconRight={<IconArrowRight size={14} />}
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Tiếp
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              disabled={!canNext}
              onClick={() => void enqueueAll()}
            >
              Enqueue
            </Button>
          )}
        </div>
      </footer>
    </Modal>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const labels = ["Sản phẩm", "Mẫu", "Nhóm", "Review"];
  return (
    <ol className="flex items-center">
      {labels.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        const isLast = i === labels.length - 1;
        return (
          <li key={label} className={["flex flex-1 items-center", isLast ? "flex-none" : ""].join(" ")}>
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                  done
                    ? "bg-success-600 text-white"
                    : active
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-muted-100 text-muted-500",
                ].join(" ")}
              >
                {done ? <IconCircleCheck size={14} /> : idx}
              </span>
              <span
                className={[
                  "text-xs font-medium transition",
                  active ? "text-primary-700" : done ? "text-success-700" : "text-muted-500",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <span
                className={[
                  "mx-3 h-px flex-1 transition",
                  done ? "bg-success-300" : "bg-muted-200",
                ].join(" ")}
              />
            )}
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
      <Input
        label="Tên chiến dịch"
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
      />
      <SelectField
        label="Sản phẩm"
        value={props.productId ?? ""}
        onChange={(v) => {
          props.setProductId(v);
          props.setVariantId("");
        }}
        placeholder="-- Chọn sản phẩm --"
        options={products.map((p) => ({ value: p.productId, label: p.name }))}
      />
      <SelectField
        label="Biến thể"
        value={props.variantId ?? ""}
        onChange={props.setVariantId}
        disabled={!props.productId}
        placeholder="-- Chọn biến thể --"
        options={variants.map((v) => ({
          value: v.variantId,
          label: `${v.sku}${v.name ? ` (${v.name})` : ""} — ${v.sellingPrice?.toLocaleString("vi-VN") ?? "?"}₫ — kho ${v.availableQty}`,
        }))}
      />
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
      <SelectField
        label="Chọn mẫu"
        value={props.templateId ?? ""}
        onChange={props.setTemplateId}
        placeholder="-- Chọn mẫu --"
        options={templates.map((t) => ({ value: t.id, label: t.name }))}
      />
      <div>
        <p className="mb-1 text-xs font-medium text-muted-700">Preview</p>
        <div className="min-h-[120px] rounded-md border border-muted-100 bg-muted-50/40 p-3 text-sm whitespace-pre-wrap text-muted-800">
          {preview || (
            <span className="text-muted-500">(chọn mẫu để xem preview)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Step3(props: {
  groupSetId: string | null;
  setGroupSetId: (v: string | null) => void;
}) {
  const [sets, setSets] = useState<GroupSetRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [members, setMembers] = useState<GroupRecord[]>([]);
  const [mode, setMode] = useState<"set" | "manual">("manual");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void Promise.all([
      api.groupSetsList().then((r) => r.ok && setSets(r.data)),
      api.groupsList().then((r) => r.ok && setGroups(r.data.filter((g) => g.enabled))),
    ]);
  }, []);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api || !props.groupSetId) {
      setMembers([]);
      return;
    }
    void api.groupSetsMembers(props.groupSetId).then((r) => r.ok && setMembers(r.data));
  }, [props.groupSetId]);

  // Khi mode đổi, reset selection phù hợp.
  function switchMode(next: "set" | "manual") {
    setMode(next);
    if (next === "manual") {
      // Rời "set" → xoá groupSetId đang chọn.
      props.setGroupSetId(null);
    } else {
      // Rời "manual" → xoá danh sách nhóm đã chọn.
      setSelectedGroups([]);
    }
  }

  function toggleGroup(id: string) {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function createSetFromSelection() {
    if (selectedGroups.length === 0) return;
    const api = window.publisherApi;
    if (!api) return;
    setCreating(true);
    const r = await api.groupSetsCreate(`Tập tạm (${new Date().toLocaleString("vi-VN")})`);
    if (!r.ok) {
      setCreating(false);
      console.error("groupSetsCreate failed:", r.error);
      return;
    }
    // Add từng nhóm vào set mới.
    for (const gid of selectedGroups) {
      await api.groupSetsAddMember(r.data.id, gid);
    }
    setCreating(false);
    props.setGroupSetId(r.data.id);
    // Reload list để user thấy set mới.
    const rl = await api.groupSetsList();
    if (rl.ok) setSets(rl.data);
  }

  const enabledGroups = groups;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md border border-muted-100 bg-muted-50/40 p-0.5 text-xs">
        <ModeTab active={mode === "manual"} onClick={() => switchMode("manual")}>
          Chọn nhóm lẻ
        </ModeTab>
        <ModeTab active={mode === "set"} onClick={() => switchMode("set")}>
          Dùng tập nhóm có sẵn
        </ModeTab>
      </div>

      {mode === "manual" && (
        <div className="space-y-2">
          {enabledGroups.length === 0 ? (
            <div className="rounded-md border border-dashed border-muted-200 bg-muted-50/40 p-4 text-center text-xs text-muted-500">
              Chưa có nhóm enabled nào. Vào trang{" "}
              <strong>Nhóm Facebook</strong> để thêm.
            </div>
          ) : (
            <>
              <ul className="max-h-56 overflow-y-auto rounded-md border border-muted-100 bg-white">
                {enabledGroups.map((g) => {
                  const checked = selectedGroups.includes(g.id);
                  return (
                    <li
                      key={g.id}
                      className={[
                        "flex cursor-pointer items-center gap-2 border-b border-muted-100 px-3 py-1.5 text-sm last:border-b-0 transition",
                        checked ? "bg-primary-50/40" : "hover:bg-muted-50",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroup(g.id)}
                        className="h-4 w-4 rounded border-muted-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="flex-1 truncate" title={g.name}>
                        {g.name}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {g.postingMode === "assisted" ? "Hỗ trợ" : "Tự động"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-600">
                  Đã chọn <strong>{selectedGroups.length}</strong> / {enabledGroups.length} nhóm
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  loading={creating}
                  disabled={selectedGroups.length === 0}
                  onClick={() => void createSetFromSelection()}
                >
                  Tạo tập nhóm & dùng
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "set" && (
        <div className="space-y-2">
          <SelectField
            label="Tập nhóm"
            value={props.groupSetId ?? ""}
            onChange={(v) => props.setGroupSetId(v || null)}
            placeholder={
              sets.length === 0 ? "-- Chưa có tập nhóm nào --" : "-- Chọn tập nhóm --"
            }
            options={sets.map((s) => ({ value: s.id, label: s.name }))}
          />
          <div className="rounded-md border border-muted-100 bg-muted-50/40 p-3 text-xs text-muted-700">
            {props.groupSetId
              ? `${members.length} nhóm trong tập sẽ được đăng.`
              : sets.length === 0
                ? "Chưa có tập nhóm nào. Vào trang Nhóm Facebook → tab Tập nhóm để tạo."
                : "Chọn 1 tập nhóm hoặc chuyển sang tab \"Chọn nhóm lẻ\"."}
          </div>
        </div>
      )}

      <div className="rounded-md border border-primary-200 bg-primary-50/40 p-2.5 text-xs text-primary-700">
        {props.groupSetId
          ? `Sẽ đăng vào tập nhóm đã chọn (${members.length} nhóm).`
          : selectedGroups.length > 0 && mode === "manual"
            ? `Bấm &quot;Tạo tập nhóm & dùng&quot; để lưu ${selectedGroups.length} nhóm đã chọn thành 1 tập.`
            : "Mặc định nếu không chọn gì: sẽ đăng vào tất cả nhóm enabled."}
      </div>
    </div>
  );
}

function ModeTab(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "flex-1 rounded px-2.5 py-1.5 text-xs font-medium transition",
        props.active
          ? "bg-white text-primary-700 shadow-sm"
          : "text-muted-600 hover:text-muted-900",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

function Step4(props: {
  name: string;
  productId: string | null;
  variantId: string | null;
  templateId: string | null;
  groupSetId: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card padding="md" variant="flat">
        <h3 className="text-sm font-semibold text-muted-900">{props.name}</h3>
        <dl className="mt-2 space-y-1 text-xs text-muted-700">
          <Row label="Product" value={props.productId ?? "—"} mono />
          <Row label="Variant" value={props.variantId ?? "—"} mono />
          <Row label="Template" value={props.templateId ?? "—"} mono />
          <Row
            label="Group set"
            value={props.groupSetId ?? "(tất cả nhóm enabled)"}
            mono
          />
        </dl>
      </Card>
      <Alert variant="primary">
        Nhấn <strong>Đăng bài</strong> sẽ tạo jobs và tự chuyển sang Queue.
      </Alert>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-700">{label}</span>
      <select
        className="block h-9 w-full rounded-md border border-muted-200 bg-white px-2.5 text-sm transition focus:border-primary-500 focus:shadow-ring focus:outline-none disabled:cursor-not-allowed disabled:bg-muted-50 disabled:text-muted-500"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || "")}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

