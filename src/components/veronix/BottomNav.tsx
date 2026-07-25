"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Home, Lightbulb, Sparkles, Wrench } from "lucide-react";

const ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  center?: boolean;
}> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inspire", label: "Inspire", icon: Lightbulb },
  { href: "/#create", label: "إنشاء", icon: Sparkles, center: true },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/assets", label: "Assets", icon: FolderOpen },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0d12]/95 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.center
            ? pathname === "/"
            : item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.center) {
            return (
              <Link
                key={item.label}
                href="/#create"
                className="relative -mt-5 flex flex-col items-center justify-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] shadow-[0_10px_30px_rgba(124,92,255,0.45)] ring-4 ring-[#0b0d12]">
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className="mt-1 text-[10px] font-semibold text-white/80">{item.label}</span>
              </Link>
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
