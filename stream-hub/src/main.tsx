import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MobileShell } from "./components/MobileShell";
import "./index.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => void reg.unregister());
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileShell>
      <App />
    </MobileShell>
  </StrictMode>,
);
