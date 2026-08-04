import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MobileShell } from "./components/MobileShell";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileShell>
      <App />
    </MobileShell>
  </StrictMode>,
);
