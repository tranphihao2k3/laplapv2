/**
 * History page — UI-002.
 *
 * - Master/detail: danh sách jobs done bên trái + attempts bên phải.
 * - Polling tự động 5s.
 * - Card item thay vì <tr> để dễ đọc.
 */
import { useEffect, useState } from "react";
import type { CampaignJobSummary, JobState } from "../../../shared/campaigns";
import type { JobAttemptRecord } from "../../../shared/queue";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  IconHistory,
  IconRefresh,
  IconTrash,
} from "../components/ui/icons";

const DONE_STATES: JobState[] = [
  "published",
  "pending_approval",
  "unverified",
  "failed",
  "skipped",
  "cancelled",
];

const STATE_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  published: "success",
  pending_approval: "warning",
  unverified: "warning",
  failed: "danger",
  skipped: "neutral",
  cancelled: "neutral",
  needs_action: "warning",
};

const STATE_LABEL: Record<string, string> = {
  published: "Đã đăng",
  pending_approval: "Chờ duyệt",
  unverified: "Chưa xác minh",
  failed: "Thất bại",
  skipped: "Bỏ qua",
  cancelled: "Đã huỷ",
  needs_action: "Cần xử lý",
};

export function HistoryPage() {
  const [items, setItems] = useState<CampaignJobSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<JobAttemptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.campaignsList();
    if (!r.ok) {
      setError(r.error.message);
      setLoading(false);
      return;
    }
    const allJobs: CampaignJobSummary[] = [];
    for (const c of r.data) {
      const jr = await api.campaignsJobs(c.id);
      if (jr.ok) allJobs.push(...jr.data);
    }
    setItems(allJobs.filter((j) => DONE_STATES.includes(j.state)));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const api = window.publisherApi;
    if (!api) return;
    void api.queueAttempts(activeJobId).then((r) => r.ok && setAttempts(r.data));
  }, [activeJobId]);

  async function cancel(jobId: string) {
    const api = window.publisherApi;
    if (!api) return;
    if (!window.confirm("Huỷ job này?")) return;
    await api.queueCancelJob(jobId);
    void load();
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Lịch sử"
        subtitle={
          loading
            ? "Đang tải…"
            : `${items.length} job hoàn thành · cập nhật mỗi 5s`
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={<IconRefresh size={14} />}
            onClick={() => void load()}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr,1fr]">
        {/* Job list */}
        <div className="space-y-2">
          {loading ? (
            <Card padding="lg">
              <div className="flex items-center justify-center gap-3 py-4 text-muted-500">
                <Spinner size="sm" />
                <span className="text-sm">Đang tải…</span>
              </div>
            </Card>
          ) : items.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={<IconHistory size={22} />}
                title="Chưa có job nào kết thúc"
                description="Job sẽ xuất hiện ở đây sau khi worker xử lý xong."
              />
            </Card>
          ) : (
            items.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setActiveJobId(j.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition",
                  activeJobId === j.id
                    ? "border-primary-300 bg-primary-50/50 shadow-sm"
                    : "border-muted-100 hover:border-muted-200 hover:shadow-sm",
                ].join(" ")}
              >
                <Badge variant={STATE_VARIANT[j.state] ?? "neutral"} size="sm" dot>
                  {STATE_LABEL[j.state] ?? j.state}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-muted-700">
                    {j.groupId.slice(0, 12)}…
                  </p>
                  <p className="text-[11px] text-muted-500">
                    {j.updatedAt ? new Date(j.updatedAt).toLocaleString("vi-VN") : "—"}
                  </p>
                </div>
                {(j.state === "failed" || j.state === "needs_action") && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<IconTrash size={12} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      void cancel(j.id);
                    }}
                  >
                    Huỷ
                  </Button>
                )}
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <Card padding="md" className="self-start lg:sticky lg:top-20">
          <h3 className="text-sm font-semibold text-muted-900">Chi tiết attempts</h3>
          {!activeJobId ? (
            <p className="mt-3 text-sm text-muted-500">Chọn một job bên trái.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {attempts.length === 0 && (
                <li className="text-sm text-muted-500">Không có attempt.</li>
              )}
              {attempts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-muted-100 bg-muted-50/30 p-2.5 text-xs"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-muted-500">#{a.attemptNumber}</span>
                    <span className="text-[10px] text-muted-500">{a.startedAt}</span>
                  </div>
                  <p className="mt-1 text-muted-800">
                    {a.fromState ?? "(none)"} → <strong>{a.toState}</strong>
                  </p>
                  {a.errorCode && (
                    <p className="mt-0.5 text-danger-600">
                      {a.errorCode}: {a.errorMessage ?? ""}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </section>
  );
}