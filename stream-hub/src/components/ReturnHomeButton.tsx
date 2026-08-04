import { useEffect, useState } from "react";
import { wasPlatformOpened } from "../lib/app-navigation";
import { OverlayPortal } from "./OverlayPortal";

type ReturnHomeButtonProps = {
  onClick: () => void;
};

export function ReturnHomeButton({ onClick }: ReturnHomeButtonProps) {
  const [visible, setVisible] = useState(wasPlatformOpened());

  useEffect(() => {
    const sync = () => setVisible(wasPlatformOpened());
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
  }, []);

  if (!visible) return null;

  return (
    <OverlayPortal>
      <button type="button" className="return-home-fab" onClick={onClick}>
        🏠 واجهة MAX
      </button>
    </OverlayPortal>
  );
}
