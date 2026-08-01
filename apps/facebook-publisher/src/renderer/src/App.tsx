import { useEffect, useState } from "react";
import type { PublisherApi } from "../../shared/publisher-api";

declare global {
  interface Window {
    publisherApi?: PublisherApi;
  }
}

/**
 * App shell tối thiểu — kiểm tra môi trường (sandbox React + IPC) hoạt động
 * đúng. Giao diện thật sẽ thuộc CAT-/GRP-/TPL-/UI-* (M3+).
 */
export function App() {
  const [version, setVersion] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api) {
      setError("publisherApi không khả dụng — kiểm tra preload/electron preload đã load");
      return;
    }
    api.getAppVersion().then((result) => {
      if (result.ok) {
        setVersion(result.data);
      } else {
        setError(`${result.error.code}: ${result.error.message}`);
      }
    });
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ marginTop: 0 }}>LapLap Facebook Publisher</h1>
      <p>Scaffold cho desktop app — Milestone 2.</p>
      <p style={{ color: "#666", fontSize: 14 }}>
        Electron version: <code>{version}</code>
      </p>
      {error && (
        <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}
      <p style={{ color: "#666", fontSize: 13 }}>
        Tính năng chính (product sync, group, template, queue, Playwright) sẽ thêm ở
        Milestone 3–5. Xem <code>docs/FB-PUBLISHER-TASKS.md</code>.
      </p>
    </main>
  );
}
