import { useEffect, useState } from "react";
import { hasPendingReturnHome } from "../lib/app-navigation";
import { OverlayPortal } from "./OverlayPortal";

type ReturnHomeButtonProps = {
  onClick: () => void;
};

export function ReturnHomeButton({ onClick }: ReturnHomeButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(hasPendingReturnHome());
    sync();
    const id = window.setInterval(sync, 600);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (!visible) return null;

  return (
    <OverlayPortal>
      <button type="button" className="return-home-fab" onClick={onClick}>
        🏠 رجوع للواجهة
      </button>
    </OverlayPortal>
  );
}
