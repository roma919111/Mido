import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type OverlayPortalProps = {
  children: ReactNode;
};

export function OverlayPortal({ children }: OverlayPortalProps) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
