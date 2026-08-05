import { useEffect, useState } from "react";
import { wasPlatformOpened } from "../lib/app-navigation";
import { OverlayPortal } from "./OverlayPortal";

type ReturnHomeButtonProps = {
  onClick: () => void;
  forceVisible?: boolean;
};

export function ReturnHomeButton({ onClick, forceVisible = false }: ReturnHomeButtonProps) {
  const [visible, setVisible] = useState(forceVisible || wasPlatformOpened());

  useEffect(() => {
    const sync = () => setVisible(forceVisible || wasPlatformOpened());
    sync();
    const id = window.setInterval(sync, 400);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [forceVisible]);

  if (!visible && !forceVisible) return null;

  return (
    <OverlayPortal>
      <button type="button" className="return-home-fab" onClick={onClick} aria-label="رجوع لـ MAX">
        ← رجوع لـ MAX
      </button>
    </OverlayPortal>
  );
}
