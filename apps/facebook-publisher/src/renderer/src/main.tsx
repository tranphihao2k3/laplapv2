import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in renderer/index.html");

createRoot(container).render(<App />);