import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useAppStore } from "./store/app-store";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in renderer/index.html");

// Expose store cho snapshot/CI scripts. Không ảnh hưởng runtime — chỉ phục vụ
// UI snapshot mode (`ELECTRON_SNAPSHOT_BYPASS_AUTH=1`) inject mock state.
// __SNAPSHOT_BYPASS__ được main process set qua localStorage trước khi
// React bundle load (xem scripts/ui-snapshot.ts + runSnapshotMode).
(window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore;
try {
  if (localStorage.getItem("__SNAPSHOT_BYPASS__") === "1") {
    (window as unknown as { __SNAPSHOT_BYPASS__: boolean }).__SNAPSHOT_BYPASS__ = true;
  }
} catch {
  // localStorage có thể block trong một số context.
}

createRoot(container).render(<App />);