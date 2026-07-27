"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clapperboard, FolderOpen, Home, ImageIcon, Lightbulb, Sparkles, Wrench } from "lucide-react";

const ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  center?: boolean;
}> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inspire", label: "Inspire", icon: Lightbulb },
  { href: "/create", label: "إنشاء", icon: Sparkles, center: true },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/assets", label: "Assets", icon: FolderOpen },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!createOpen) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setCreateOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCreateOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [createOpen]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0d12]/95 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.center
            ? pathname.startsWith("/create") || (pathname === "/" && createOpen)
            : item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.center) {
            return (
              <div
                key={item.label}
                ref={menuRef}
                className="relative -mt-5 flex flex-col items-center justify-center"
              >
                {createOpen && (
                  <div
                    className="absolute bottom-[4.75rem] left-1/2 z-[60] w-[min(92vw,20.5rem)] -translate-x-1/2"
                    dir="rtl"
                  >
                    <div className="overflow-hidden rounded-[22px] border border-white/12 bg-[#12161f] shadow-[0_22px_55px_rgba(0,0,0,0.55)]">
                      <div className="border-b border-white/8 px-4 py-3 text-center">
                        <p className="text-xs font-semibold tracking-[0.14em] text-[#22f0ff]/90">إنشاء</p>
                        <p className="mt-1 text-sm text-white/55">اختر النوع للمتابعة</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateOpen(false);
                            router.push("/create/video");
                          }}
                          className="flex flex-col items-center gap-2 rounded-2xl border border-[#22f0ff]/30 bg-[linear-gradient(180deg,rgba(34,240,255,0.14),rgba(20,24,33,0.98))] px-3 py-4"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22f0ff]/15 text-[#22f0ff] ring-1 ring-[#22f0ff]/30">
                            <Clapperboard className="h-6 w-6" />
                          </span>
                          <span className="text-sm font-bold text-white">فيديو VYRONIX</span>
                          <span className="text-[11px] text-white/45">4–15 ثانية · حتى 4K</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateOpen(false);
                            router.push("/create/image");
                          }}
                          className="flex flex-col items-center gap-2 rounded-2xl border border-[#7c5cff]/30 bg-[linear-gradient(180deg,rgba(124,92,255,0.14),rgba(20,24,33,0.98))] px-3 py-4"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7c5cff]/15 text-[#b9a6ff] ring-1 ring-[#7c5cff]/30">
                            <ImageIcon className="h-6 w-6" />
                          </span>
                          <span className="text-sm font-bold text-white">صور VYRONIX</span>
                          <span className="text-[11px] text-white/45">جودة 2K · بدون واترمارك</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  aria-expanded={createOpen}
                  aria-label="إنشاء"
                  onClick={() => setCreateOpen((v) => !v)}
                  className="relative flex flex-col items-center justify-center"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] shadow-[0_10px_30px_rgba(124,92,255,0.45)] ring-4 ring-[#0b0d12]">
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-semibold ${
                      active || createOpen ? "text-white" : "text-white/80"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${
                active ? "text-white" : "text-white/45"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-[#22f0ff]" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
