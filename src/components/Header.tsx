"use client";

import { Coins, Sparkles, Zap } from "lucide-react";

interface HeaderProps {
  credits: number;
  plan?: string;
  configured: boolean;
  email?: string;
}

export function Header({ credits, plan, configured, email }: HeaderProps) {
  return (
    <header className="relative z-20 border-b border-white/8 bg-[rgba(10,12,16,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] shadow-[0_0_32px_rgba(46,230,166,0.28)]">
            <Sparkles className="h-5 w-5 text-[#06140f]" strokeWidth={2.25} />
            <span className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)] bg-[length:200%_100%]" />
          </div>
          <div className="leading-tight">
            <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
              Studio <span className="text-[var(--accent)]">AI</span>
            </p>
            <p className="text-xs text-white/45">
              {configured ? email ?? "OpenArt connected" : "Demo mode · connect OpenArt"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
            <Coins className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-medium tabular-nums">
              {credits} {plan === "Demo" || !configured ? "Free Credits" : "Credits"}
            </span>
          </div>
          <a
            href="https://openart.ai/pricing"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[#06140f] transition duration-300 hover:bg-[var(--accent-strong)] sm:px-4"
          >
            <Zap className="h-4 w-4 transition group-hover:rotate-12" />
            <span className="hidden sm:inline">Upgrade / Buy Credits</span>
            <span className="sm:hidden">Upgrade</span>
          </a>
        </div>
      </div>
    </header>
  );
}
