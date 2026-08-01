import { useEffect, useState } from "react";

declare global {
  interface Window {
    publisherApi?: {
      getAppVersion: () => Promise<string>;
    };
  }
}

/**
 * App shell tối thiểu — kiểm tra môi trường (sandbox React + IPC) hoạt động
 * đúng. Giao diện thật sẽ thuộc CAT-/GRP-/TPL-/UI-* (M3+).
 */
export function App() {
  const [version, setVersion] = useState<string>("...");

  useEffect(() => {
    window.publisherApi?.getAppVersion().then(setVersion).catch(() => setVersion("n/a"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ marginTop: 0 }}>LapLap Facebook Publisher</h1>
      <p>Scaffold cho desktop app — M2/APP-001.</p>
      <p style={{ color: "#666", fontSize: 14 }}>
        Electron version: <code>{version}</code>
      </p>
      <p style={{ color: "#666", fontSize: 13 }}>
        Tính năng chính (product sync, group, template, queue, Playwright) sẽ thêm ở
        Milestone 3–5. Xem <code>docs/FB-PUBLISHER-TASKS.md</code>.
      </p>
    </main>
  );
}
