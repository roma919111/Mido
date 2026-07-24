"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Clapperboard,
  Home,
  Library,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/create", label: "Create / Generate", icon: Clapperboard },
  { href: "/community", label: "Community Feed", icon: Users },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/library", label: "My Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-[var(--border)] px-4 py-5">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-sky-500 glow-cyan">
          <Sparkles className="h-5 w-5 text-[#041018]" />
          <span className="pointer-events-none absolute inset-0 animate-shimmer rounded-2xl bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)]" />
        </div>
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white neon-text">
            Studio AI
          </p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/50">OpenArt Studio</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-cyan-400/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white/90"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-cyan-300" : "text-white/40 group-hover:text-cyan-200"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent p-4">
        <p className="text-sm font-medium text-white">Create without limits</p>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          Unlock Pro for 1,000 credits and 1080p generation.
        </p>
      </div>
    </aside>
  );
}
