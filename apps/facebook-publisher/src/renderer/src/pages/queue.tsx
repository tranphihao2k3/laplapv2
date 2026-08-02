/**
 * Queue control page — UI-001.
 *
 * - Progress counts theo state (12 buckets).
 * - List job active + done, filter theo campaign/state.
 * - Pause/Resume/Cancel/Emergency Stop:
 *    + Pause: settings.pauseQueue=true (UI sẽ bổ sung).
 *    + Cancel 1 job: queueCancelJob.
 *    + Cancel cả campaign: queueCancelCampaign.
 * - Needs action highlight đỏ.
 */
import { useEffect, useState } from "react";
import type { QueueCount, JobState } from "../../../shared/queue";

export function QueuePage() {
  const [counts, setCounts] = useState<QueueCount[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.queueCounts();
    if (r.ok) setCounts(r.data);
  }

  useEffect(() => {
    void load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Queue</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-muted-100 px-3 py-1 text-sm hover:bg-muted-50"
        >
          Tải lại
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {counts.map((c) => (
          <CountCard key={c.state} state={c.state} count={c.count} />
        ))}
      </div>

      <div className="mt-6 rounded border border-muted-100 bg-white p-4 text-sm text-muted-500">
        <p className="font-medium text-muted-900">Điều khiển</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Cancel job: chọn trong lịch sử → nút "Huỷ".</li>
          <li>Pause/Resume: cấu hình trong Settings (sẽ bổ sung).</li>
          <li>Emergency stop: dừng queue ngay → Settings.stopQueue=true.</li>
        </ul>
      </div>
    </section>
  );
}

function CountCard({ state, count }: { state: JobState; count: number }) {
  const highlight =
    state === "needs_action" || state === "failed" || state === "unverified";
  return (
    <div
      className={`rounded border p-3 ${
        highlight ? "border-warning-500 bg-warning-50" : "border-muted-100 bg-white"
      }`}
    >
      <p className="text-xs uppercase text-muted-500">{state}</p>
      <p className="text-2xl font-semibold">{count}</p>
    </div>
  );
}