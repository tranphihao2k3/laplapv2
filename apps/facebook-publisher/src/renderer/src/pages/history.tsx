/**
 * History page — UI-002.
 *
 * - List job done (state ∈ {published, pending_approval, unverified,
 *   failed, skipped, cancelled}) với attempts + last error.
 * - Click vào job → chi tiết attempts.
 * - Có nút "Xem lại" cho unverified để user xác nhận.
 */
import { useEffect, useState } from "react";
import type { CampaignJobSummary } from "../../shared/campaigns";
import type { JobAttemptRecord } from "../../shared/queue";

export function HistoryPage() {
  const [items, setItems] = useState<CampaignJobSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<JobAttemptRecord[]>([]);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    // Lấy tất cả campaign rồi collect jobs done.
    const r = await api.campaignsList();
    if (!r.ok) return;
    const allJobs: CampaignJobSummary[] = [];
    for (const c of r.data) {
      const jr = await api.campaignsJobs(c.id);
      if (jr.ok) allJobs.push(...jr.data);
    }
    const DONE_STATES = new Set([
      "published",
      "pending_approval",
      "unverified",
      "failed",
      "skipped",
      "cancelled",
    ]);
    setItems(allJobs.filter((j) => DONE_STATES.has(j.state)));
  }

  useEffect(() => {
    void load();
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
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lịch sử</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-muted-100 px-3 py-1 text-sm hover:bg-muted-50"
        >
          Tải lại
        </button>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="overflow-hidden rounded border border-muted-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted-50 text-left text-xs uppercase text-muted-500">
              <tr>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Cập nhật</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-500">
                    Chưa có job nào kết thúc.
                  </td>
                </tr>
              )}
              {items.map((j) => (
                <tr
                  key={j.id}
                  className={`cursor-pointer border-t border-muted-100 ${
                    activeJobId === j.id ? "bg-primary-50" : ""
                  }`}
                  onClick={() => setActiveJobId(j.id)}
                >
                  <td className="px-3 py-2">
                    <StateBadge state={j.state} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-500">{j.groupId.slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-xs text-muted-500">
                    {j.updatedAt ? new Date(j.updatedAt).toLocaleString("vi-VN") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(j.state === "failed" || j.state === "needs_action") && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void cancel(j.id);
                        }}
                        className="rounded border border-danger-500 px-2 py-0.5 text-xs text-danger-600 hover:bg-danger-50"
                      >
                        Huỷ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-muted-100 bg-white p-3">
          <h3 className="text-sm font-medium">Chi tiết attempts</h3>
          {!activeJobId && (
            <p className="mt-2 text-sm text-muted-500">Chọn một job bên trái.</p>
          )}
          {activeJobId && (
            <ol className="mt-2 space-y-1 text-xs">
              {attempts.length === 0 && <li className="text-muted-500">Không có attempt.</li>}
              {attempts.map((a) => (
                <li key={a.id} className="rounded border border-muted-100 p-2">
                  <div>
                    <strong>#{a.attemptNumber}</strong> {a.fromState ?? "(none)"} → {a.toState}
                  </div>
                  {a.errorCode && (
                    <div className="text-danger-600">
                      {a.errorCode}: {a.errorMessage ?? ""}
                    </div>
                  )}
                  <div className="text-muted-500">{a.startedAt}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function StateBadge({ state }: { state: string }) {
  const color =
    state === "published"
      ? "bg-success-50 text-success-600"
      : state === "pending_approval"
        ? "bg-warning-50 text-warning-600"
        : state === "unverified"
          ? "bg-warning-50 text-warning-600"
          : state === "failed"
            ? "bg-danger-50 text-danger-600"
            : "bg-muted-50 text-muted-500";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${color}`}>{state}</span>;
}