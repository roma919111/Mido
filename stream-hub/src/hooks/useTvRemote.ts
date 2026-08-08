import { useEffect, type RefObject } from "react";

/** Android TV / remote: arrow keys scroll main list and horizontal rows. */
export function useTvRemote(mainRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const main = mainRef.current;
      if (!main) return;

      const target = e.target as HTMLElement | null;
      const row = (target?.closest(
        ".content-row__track, .max-show__track, .max-show__ott-track, .mstv-row-section__track",
      ) ?? null) as HTMLElement | null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          main.scrollBy({ top: 140, behavior: "smooth" });
          break;
        case "ArrowUp":
          e.preventDefault();
          main.scrollBy({ top: -140, behavior: "smooth" });
          break;
        case "ArrowRight":
          if (row) {
            e.preventDefault();
            row.scrollBy({ left: 160, behavior: "smooth" });
          }
          break;
        case "ArrowLeft":
          if (row) {
            e.preventDefault();
            row.scrollBy({ left: -160, behavior: "smooth" });
          }
          break;
        case "PageDown":
          e.preventDefault();
          main.scrollBy({ top: main.clientHeight * 0.85, behavior: "smooth" });
          break;
        case "PageUp":
          e.preventDefault();
          main.scrollBy({ top: -main.clientHeight * 0.85, behavior: "smooth" });
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [mainRef]);
}
