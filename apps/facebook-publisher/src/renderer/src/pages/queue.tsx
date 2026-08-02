/**
 * Queue control page — UI-001 + QUE-002 controls.
 *
 * - Progress counts theo state (12 buckets).
 * - Worker controls: Start / Pause / Resume / Emergency Stop (QUE-002).
 * - Pause/Resume: chỉ tạm dừng nhận job mới; job hiện tại chạy tới hết.
 * - Emergency stop: pause + cancel mọi queued → không bắn bài mới.
 */
import { useEffect, useState } from "react";
import type { QueueCount, JobState, WorkerStatus } from "../../../shared/queue";

export function QueuePage() {
  const [counts, setCounts] = useState<QueueCount[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const api = window.publisherApi;
    if (!api) return;
    const [countsR, statusR] = await Promise.all([api.queueCounts(), api.workerStatus()]);
    if (countsR.ok) setCounts(countsR.data);
    if (statusR.ok) setWorker(statusR.data);
  }

  useEffect(() => {
    void loadAll();
    const id = setInterval(loadAll, 3000);
    return () => clearInterval(id);
  }, []);

  async function handleStart() {
    const r = await window.publisherApi.workerStart();
    if (r.ok) setWorker(r.data);
    else setError(r.error.message);
  }
  async function handlePause() {
    const r = await window.publisherApi.workerPause();
    if (r.ok) setWorker(r.data);
    else setError(r.error.message);
  }
  async function handleResume() {
    const r = await window.publisherApi.workerResume();
    if (r.ok) setWorker(r.data);
    else setError(r.error.message);
  }
  async function handleStop() {
    const r = await window.publisherApi.workerStop();
    if (r.ok) {
      setError(null);
      await loadAll();
    } else setError(r.error.message);
  }

  const running = worker?.running === true;
  const paused = worker?.paused === true;

  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Queue</h1>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="rounded border border-muted-100 px-3 py-1 text-sm hover:bg-muted-50"
        >
          Tải lại
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600"
        >
          {error}
        </p>
      )}

      {/* Worker controls */}
      <div
        data-testid="worker-controls"
        className="mt-4 flex flex-wrap items-center gap-2 rounded border border-muted-100 bg-white p-3"
      >
        <span className="text-sm font-medium">Worker:</span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            running && !paused
              ? "bg-success-50 text-success-700"
              : paused
                ? "bg-warning-50 text-warning-700"
                : "bg-muted-50 text-muted-500"
          }`}
        >
          {running ? (paused ? "paused" : "running") : "stopped"}
        </span>
        {worker?.currentJobId && (
          <span className="text-xs text-muted-500">job: {worker.currentJobId.slice(0, 8)}…</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={running}
            className="rounded border border-success-500 px-3 py-1 text-sm text-success-700 disabled:opacity-40"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => void handlePause()}
            disabled={!running || paused}
            className="rounded border border-warning-500 px-3 py-1 text-sm text-warning-700 disabled:opacity-40"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => void handleResume()}
            disabled={!running || !paused}
            className="rounded border border-primary-500 px-3 py-1 text-sm text-primary-700 disabled:opacity-40"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={!running}
            className="rounded border border-danger-500 px-3 py-1 text-sm text-danger-600 disabled:opacity-40"
          >
            Emergency Stop
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {counts.map((c) => (
          <CountCard key={c.state} state={c.state} count={c.count} />
        ))}
      </div>

      <div className="mt-6 rounded border border-muted-100 bg-white p-4 text-sm text-muted-500">
        <p className="font-medium text-muted-900">Thống kê worker</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Đã xử lý: {worker?.totalProcessed ?? 0}</li>
          <li>Thành công: {worker?.totalSucceeded ?? 0}</li>
          <li>Thất bại: {worker?.totalFailed ?? 0}</li>
          <li>Bỏ qua: {worker?.totalSkipped ?? 0}</li>
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
