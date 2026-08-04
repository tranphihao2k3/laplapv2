/**
 * Queue control page — UI-001 + QUE-002 controls.
 *
 * - Worker controls: Start / Pause / Resume / Emergency Stop.
 * - Count cards theo state (12 buckets).
 * - Polling 3s.
 */
import { useEffect, useState } from "react";
import type {
  QueueCount,
  JobState,
  JobAttemptRecord,
  WorkerStatus,
} from "../../../shared/queue";
import type { CampaignJobSummary } from "../../../shared/campaigns";
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  IconPause,
  IconPlay,
  IconRefresh,
  IconStop,
} from "../components/ui/icons";

const STATE_VARIANT: Record<
  JobState,
  "neutral" | "primary" | "success" | "warning" | "danger"
> = {
  queued: "neutral",
  in_progress: "primary",
  needs_action: "warning",
  succeeded: "success",
  failed: "danger",
  skipped: "neutral",
  unverified: "warning",
};

/**
 * Tông nền card tuỳ mức "cần chú ý":
 *  - danger (failed)        → danger-50.
 *  - warning (needs_action, unverified) → warning-50.
 *  - bình thường            → flat (trắng + border mỏng).
 */
const STATE_CARD_TONE: Record<
  JobState,
  "danger" | "warning" | "flat"
> = {
  queued: "flat",
  in_progress: "flat",
  needs_action: "warning",
  succeeded: "flat",
  failed: "danger",
  skipped: "flat",
  unverified: "warning",
};

const STATE_LABEL: Record<JobState, string> = {
  queued: "Chờ",
  in_progress: "Đang chạy",
  needs_action: "Cần xử lý",
  succeeded: "Thành công",
  failed: "Thất bại",
  skipped: "Bỏ qua",
  unverified: "Chưa xác minh",
};

export function QueuePage() {
  const [counts, setCounts] = useState<QueueCount[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [activeJob, setActiveJob] = useState<CampaignJobSummary | null>(null);
  const [activeJobAttempts, setActiveJobAttempts] = useState<JobAttemptRecord[]>([]);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  async function loadAll() {
    const api = window.publisherApi;
    if (!api) return;
    const [countsR, statusR] = await Promise.all([api.queueCounts(), api.workerStatus()]);
    if (countsR.ok) setCounts(countsR.data);
    if (statusR.ok) setWorker(statusR.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    const id = setInterval(loadAll, 3000);
    return () => clearInterval(id);
  }, []);

  // Đọc flash message từ Campaign wizard (qua sessionStorage).
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("queue.flash");
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem("queue.flash");
      const parsed = JSON.parse(raw) as {
        kind?: string;
        jobsCreated?: number;
        duplicates?: number;
        at?: number;
      };
      // Bỏ flash cũ (>30s) để tránh alert lặp khi user refresh.
      if (parsed.at && Date.now() - parsed.at > 30_000) return;
      if (parsed.kind === "enqueued" || parsed.kind === "reposted") {
        const created = parsed.jobsCreated ?? 0;
        const dup = parsed.duplicates ?? 0;
        const parts: string[] = [];
        if (parsed.kind === "reposted") parts.push("Đã đăng lại chiến dịch");
        if (created > 0) parts.push(`tạo ${created} job mới`);
        if (dup > 0) parts.push(`bỏ qua ${dup} trùng`);
        setFlash(parts.length > 0 ? parts.join(", ") + "." : "Không có job mới.");
      }
    } catch {
      /* ignore malformed flash */
    }
  }, []);

  // Khi worker pick job mới → fetch detail + attempts + group name.
  useEffect(() => {
    const api = window.publisherApi;
    const jobId = worker?.currentJobId ?? null;
    const campaignId = worker?.currentCampaignId ?? null;
    const groupId = worker?.currentGroupId ?? null;

    if (!api || !jobId || !campaignId) {
      setActiveJob(null);
      setActiveJobAttempts([]);
      setActiveGroupName(null);
      return;
    }

    let cancelled = false;

    async function fetchActive() {
      // 1. Lấy job summary từ campaignJobs.
      const jobsR = await api!.campaignsJobs(campaignId!);
      if (cancelled) return;
      const job = jobsR.ok ? jobsR.data.find((j) => j.id === jobId) ?? null : null;
      setActiveJob(job);

      // 2. Attempts → render step progress.
      const attR = await api!.queueAttempts(jobId!);
      if (cancelled) return;
      setActiveJobAttempts(attR.ok ? attR.data : []);

      // 3. Group name để hiển thị user-friendly.
      if (groupId) {
        const gR = await api!.groupsGet(groupId);
        if (!cancelled) setActiveGroupName(gR.ok ? gR.data?.name ?? null : null);
      }
    }

    void fetchActive();
    // Poll lại mỗi 3s theo nhịp của queueCounts/workerStatus.
    const id = setInterval(() => void fetchActive(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [worker?.currentJobId, worker?.currentCampaignId, worker?.currentGroupId]);

  // Track đang gửi action nào để disable tất cả 4 nút worker — tránh
  // click liên tục / double-fire / state lệch (vd bấm Stop xong click Start
  // trước khi IPC phản hồi → backend xử lý đè lệnh).
  const [pendingAction, setPendingAction] = useState<
    null | "start" | "pause" | "resume" | "stop"
  >(null);
  const anyPending = pendingAction !== null;

  async function handleStart() {
    if (anyPending) return;
    setPendingAction("start");
    try {
      const r = await window.publisherApi.workerStart();
      if (r.ok) setWorker(r.data);
      else setError(r.error.message);
    } finally {
      setPendingAction(null);
    }
  }
  async function handlePause() {
    if (anyPending) return;
    setPendingAction("pause");
    try {
      const r = await window.publisherApi.workerPause();
      if (r.ok) setWorker(r.data);
      else setError(r.error.message);
    } finally {
      setPendingAction(null);
    }
  }
  async function handleResume() {
    if (anyPending) return;
    setPendingAction("resume");
    try {
      const r = await window.publisherApi.workerResume();
      if (r.ok) setWorker(r.data);
      else setError(r.error.message);
    } finally {
      setPendingAction(null);
    }
  }
  async function handleStop() {
    if (anyPending) return;
    setPendingAction("stop");
    try {
      const r = await window.publisherApi.workerStop();
      if (r.ok) {
        setError(null);
        await loadAll();
      } else {
        setError(r.error.message);
      }
    } finally {
      setPendingAction(null);
    }
  }

  const running = worker?.running === true;
  const paused = worker?.paused === true;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Queue"
        subtitle={
          loading
            ? "Đang tải…"
            : `${counts.reduce((a, c) => a + c.count, 0)} jobs · cập nhật mỗi 3s`
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={<IconRefresh size={14} />}
            onClick={() => void loadAll()}
          >
            Tải lại
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {flash && (
        <Alert variant="success" onClose={() => setFlash(null)}>
          {flash} Worker đang chạy — xem panel &quot;Job đang chạy&quot; bên dưới.
        </Alert>
      )}

      {/* Worker controls */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-muted-900">Worker</span>
          <Badge
            variant={running && !paused ? "success" : paused ? "warning" : "neutral"}
            size="md"
            dot
          >
            {running ? (paused ? "paused" : "running") : "stopped"}
          </Badge>
          {worker?.currentJobId && (
            <span className="font-mono text-xs text-muted-500">
              job: {worker.currentJobId.slice(0, 12)}…
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="success"
              size="md"
              icon={<IconPlay size={14} />}
              onClick={() => void handleStart()}
              loading={pendingAction === "start"}
              disabled={running || anyPending}
            >
              Start
            </Button>
            <Button
              variant="warning"
              size="md"
              icon={<IconPause size={14} />}
              onClick={() => void handlePause()}
              loading={pendingAction === "pause"}
              disabled={!running || paused || anyPending}
            >
              Pause
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<IconPlay size={14} />}
              onClick={() => void handleResume()}
              loading={pendingAction === "resume"}
              disabled={!running || !paused || anyPending}
            >
              Resume
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={<IconStop size={14} />}
              onClick={() => void handleStop()}
              loading={pendingAction === "stop"}
              disabled={!running || anyPending}
            >
              Emergency Stop
            </Button>
          </div>
        </div>
      </Card>

      {/* Active job panel — luôn render để user thấy rõ worker
          đang làm gì; idle state hiển thị placeholder. */}
      <ActiveJobPanel
        job={activeJob}
        groupName={activeGroupName}
        attempts={activeJobAttempts}
        workerRunning={worker?.running ?? false}
      />

      {/* Count cards */}
      {loading ? (
        <Card padding="lg">
          <div className="flex items-center justify-center gap-3 py-4 text-muted-500">
            <Spinner size="sm" />
            <span className="text-sm">Đang tải counts…</span>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {counts.map((c) => (
            <CountCard
              key={c.state}
              state={c.state}
              count={c.count}
              label={STATE_LABEL[c.state]}
            />
          ))}
        </div>
      )}

      {/* Worker stats */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-muted-900">Thống kê worker</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Đã xử lý" value={worker?.totalProcessed ?? 0} />
          <Stat label="Thành công" value={worker?.totalSucceeded ?? 0} variant="success" />
          <Stat label="Thất bại" value={worker?.totalFailed ?? 0} variant="danger" />
          <Stat label="Bỏ qua" value={worker?.totalSkipped ?? 0} />
        </dl>
      </Card>
    </section>
  );
}

function CountCard({
  state,
  count,
  label,
}: {
  state: JobState;
  count: number;
  label: string;
}) {
  const variant = STATE_VARIANT[state];
  const tone = STATE_CARD_TONE[state];
  const isAttention = tone !== "flat";
  // Khi card có tone màu (warning/danger), badge phải có nền TRẮNG để
  // tránh chìm vào background — pattern "solid badge trên tinted card".
  const badgeClass =
    tone === "danger"
      ? "bg-white border border-danger-200 text-danger-700"
      : tone === "warning"
        ? "bg-white border border-warning-300 text-warning-700"
        : "";

  return (
    <Card
      padding="md"
      variant={isAttention ? "default" : "flat"}
      className={tone === "danger" ? "border-danger-200 bg-danger-50/60" : tone === "warning" ? "border-warning-200 bg-warning-50/60" : ""}
    >
      <div className="flex items-center justify-between">
        <Badge variant={variant} size="sm" className={badgeClass}>
          {label}
        </Badge>
        {isAttention && count > 0 && (
          <span
            className={`h-2 w-2 animate-pulse rounded-full ${
              tone === "danger" ? "bg-danger-500" : "bg-warning-500"
            }`}
          />
        )}
      </div>
      <p
        className={[
          "mt-2 text-3xl font-semibold tabular-nums",
          tone === "danger" ? "text-danger-700" : tone === "warning" ? "text-warning-700" : "text-muted-900",
        ].join(" ")}
      >
        {count.toLocaleString("vi-VN")}
      </p>
    </Card>
  );
}

function Stat({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: number;
  variant?: "neutral" | "success" | "danger";
}) {
  const valueColor =
    variant === "success"
      ? "text-success-700"
      : variant === "danger"
        ? "text-danger-700"
        : "text-muted-900";
  return (
    <div className="rounded-md border border-muted-100 bg-white p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-500">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value.toLocaleString("vi-VN")}
      </dd>
    </div>
  );
}

/**
 * Pipeline stage definitions — ánh xạ JobState của runner.
 * Thứ tự = thứ tự thực thi. Renderer dùng để vẽ progress + đoán step hiện tại
 * từ attempts (lấy toState của attempt cuối).
 */
const PIPELINE_STAGES: { state: JobState; label: string; description: string }[] = [
  { state: "queued", label: "Chờ", description: "Job đang chờ worker xử lý" },
  { state: "preflight", label: "Kiểm tra", description: "Xác minh giá/tồn kho/token" },
  { state: "posting", label: "Đang đăng", description: "Gửi nội dung vào nhóm" },
  { state: "awaiting_confirmation", label: "Chờ duyệt", description: "Cần user xác nhận trong browser" },
  { state: "published", label: "Xong", description: "Đã đăng thành công" },
];

const ACTIVE_TERMINAL_BAD: JobState[] = ["failed", "cancelled"];
const ACTIVE_TERMINAL_NEEDS: JobState[] = ["needs_action", "unverified"];

function ActiveJobPanel({
  job,
  groupName,
  attempts,
  workerRunning,
}: {
  job: CampaignJobSummary | null;
  groupName: string | null;
  attempts: JobAttemptRecord[];
  workerRunning: boolean;
}) {
  // Idle state: không có job — hiển thị placeholder rõ ràng để user biết
  // panel này ở đâu và worker đang chờ gì.
  if (!job) {
    return (
      <Card padding="md" className="border-dashed border-muted-200 bg-muted-50/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-900">Job đang chạy</h3>
            <p className="mt-1 text-xs text-muted-600">
              {workerRunning
                ? "Worker đang chờ job từ hàng đợi…"
                : "Worker chưa chạy — bấm Start ở trên để bắt đầu."}
            </p>
          </div>
          <Badge variant="neutral" size="sm">
            idle
          </Badge>
        </div>
      </Card>
    );
  }

  // Step hiện tại = stage ứng với state hiện tại của job.
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.state === job.state);
  const currentStep = stageIndex >= 0 ? stageIndex : 0;
  const isTerminal = ACTIVE_TERMINAL_BAD.includes(job.state)
    || ACTIVE_TERMINAL_NEEDS.includes(job.state)
    || job.state === "published"
    || job.state === "skipped";
  const isFailure = ACTIVE_TERMINAL_BAD.includes(job.state);

  // Error từ job summary hoặc từ attempt cuối.
  const lastAttempt = attempts[attempts.length - 1];
  const errorCode = job.lastErrorCode ?? lastAttempt?.errorCode ?? null;
  const errorMessage = job.lastErrorMessage ?? lastAttempt?.errorMessage ?? null;

  return (
    <Card padding="md" className={isFailure ? "border-danger-200 bg-danger-50/30" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-900">
              {isFailure ? "Job thất bại" : isTerminal ? "Job hoàn tất" : "Job đang chạy"}
            </h3>
            <Badge
              variant={
                isFailure
                  ? "danger"
                  : job.state === "published"
                    ? "success"
                    : ACTIVE_TERMINAL_NEEDS.includes(job.state)
                      ? "warning"
                      : "primary"
              }
              size="sm"
              dot={!isTerminal}
            >
              {job.state}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-700" title={groupName ?? job.groupId}>
            Nhóm: <strong>{groupName ?? job.groupId.slice(0, 12) + "…"}</strong>
          </p>
          <p className="font-mono text-[11px] text-muted-500">
            job: {job.id.slice(0, 12)}…
          </p>
        </div>
        {!isTerminal && (
          <div className="flex items-center gap-1.5 text-xs text-primary-700">
            <Spinner size="sm" />
            <span>Đang xử lý…</span>
          </div>
        )}
      </div>

      {/* Pipeline steps */}
      <ol className="mt-3 flex flex-wrap items-center gap-1.5">
        {PIPELINE_STAGES.slice(0, 4).map((s, i) => {
          const done = isFailure ? false : currentStep > i;
          const active = !isFailure && !isTerminal && currentStep === i;
          const tone = done
            ? "bg-success-100 text-success-700 border-success-200"
            : active
              ? "bg-primary-100 text-primary-700 border-primary-300 ring-2 ring-primary-200"
              : "bg-muted-50 text-muted-500 border-muted-200";
          return (
            <li key={s.state} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition ${tone}`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold">
                  {done ? "✓" : i + 1}
                </span>
                <span>{s.label}</span>
              </div>
              {i < PIPELINE_STAGES.length - 2 && (
                <span className="text-muted-300">→</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mô tả step hiện tại + lỗi nếu có */}
      <div className="mt-3">
        {isFailure && errorCode ? (
          <Alert variant="danger" title={`Lỗi: ${errorCode}`}>
            {errorMessage ?? "(không có chi tiết)"}
          </Alert>
        ) : isFailure ? (
          <Alert variant="danger">Job thất bại — xem History để biết chi tiết.</Alert>
        ) : isTerminal ? (
          <p className="text-xs text-muted-600">
            {PIPELINE_STAGES[stageIndex]?.description ?? "Đã hoàn tất."}
          </p>
        ) : (
          <p className="text-xs text-muted-600">
            <strong>Bước hiện tại:</strong>{" "}
            {PIPELINE_STAGES[currentStep]?.description ?? "Đang xử lý…"}
          </p>
        )}
      </div>
    </Card>
  );
}