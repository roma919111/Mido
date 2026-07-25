"use client";

import { Coins, Zap } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface HeaderProps {
  plan?: string;
  configured: boolean;
  live?: boolean;
  connectionError?: string;
}

export function Header({
  plan,
  configured,
  live,
  connectionError,
}: HeaderProps) {
  return (
    <header className="relative z-20 border-b border-white/8 bg-[rgba(10,12,16,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <BrandLogo size="md" />
            <p className="mt-0.5 text-xs text-white/45">
              {configured
                ? "Ready — generate instantly, no login required"
                : connectionError
                  ? "Studio temporarily unavailable"
                  : "Connecting studio…"}
            </p>
            <p
              className={`mt-0.5 text-[10px] tracking-wide ${
                live ? "text-cyan-300/80" : "text-rose-300/80"
              }`}
            >
              {live ? "LIVE MCP" : "OFFLINE"} · powered by OpenArt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
            <Coins className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-medium tabular-nums">
              {configured ? `${plan ?? "Studio"} ready` : "Warming up"}
            </span>
          </div>

          <a
            href="https://openart.ai/pricing"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[#06140f] transition duration-300 hover:bg-[var(--accent-strong)] sm:px-4"
          >
            <Zap className="h-4 w-4 transition group-hover:rotate-12" />
            <span className="hidden sm:inline">Upgrade</span>
            <span className="sm:hidden">Pro</span>
          </a>
        </div>
      </div>
    </header>
  );
}
