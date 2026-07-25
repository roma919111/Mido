"use client";

import { Coins, LogIn, LogOut, Zap } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface HeaderProps {
  credits: number;
  plan?: string;
  configured: boolean;
  email?: string;
  live?: boolean;
  mcpEndpoint?: string;
  connectionError?: string;
  needsAuth?: boolean;
  authMethod?: "oauth" | "env" | null;
  onLogout?: () => void;
}

export function Header({
  credits,
  plan,
  configured,
  email,
  live,
  mcpEndpoint,
  connectionError,
  needsAuth,
  authMethod,
  onLogout,
}: HeaderProps) {
  const endpoint = mcpEndpoint ?? "https://mcp.openart.ai/mcp";

  return (
    <header className="relative z-20 border-b border-white/8 bg-[rgba(10,12,16,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <BrandLogo size="md" />
            <p className="mt-0.5 text-xs text-white/45">
              {configured
                ? email ?? "OpenArt MCP connected"
                : needsAuth
                  ? "Sign in with OpenArt to connect MCP"
                  : connectionError
                    ? "OpenArt MCP connection error"
                    : "Connecting to OpenArt MCP…"}
            </p>
            <p
              className={`mt-0.5 text-[10px] tracking-wide ${
                live ? "text-cyan-300/80" : "text-rose-300/80"
              }`}
            >
              {live ? "LIVE" : "OFFLINE"}
              {authMethod ? ` · ${authMethod.toUpperCase()}` : ""} · {endpoint}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
            <Coins className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-medium tabular-nums">
              {credits} {plan ? `${plan} Credits` : "Credits"}
            </span>
          </div>

          {needsAuth || !configured ? (
            <a
              href="/api/auth/login"
              className="group inline-flex items-center gap-2 rounded-full bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#041018] transition duration-300 hover:bg-cyan-300 sm:px-4"
            >
              <LogIn className="h-4 w-4 transition group-hover:translate-x-0.5" />
              <span className="hidden sm:inline">Sign in with OpenArt</span>
              <span className="sm:hidden">Sign in</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 sm:px-4"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Out</span>
            </button>
          )}

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
