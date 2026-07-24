"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Sparkles, Users, Zap } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";

export default function HomePage() {
  const { user, openPricing } = useApp();

  return (
    <div className="space-y-8">
      <section className="animate-fade-up relative overflow-hidden rounded-[32px] border border-[var(--border)] bg-[rgba(12,18,30,0.65)] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">OpenArt Studio</p>
        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-white sm:text-6xl">
          Studio <span className="text-cyan-300 neon-text">AI</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
          Generate cinematic images and motion with a private credit wallet, community explore feed,
          and OpenArt MCP-powered creation pipeline.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 px-5 py-3 text-sm font-semibold text-[#041018]"
          >
            Start Creating <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={openPricing}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 px-5 py-3 text-sm text-cyan-100"
          >
            <Zap className="h-4 w-4" /> Upgrade to Pro
          </button>
        </div>
        <p className="mt-4 text-sm text-white/40">
          {user
            ? `Signed in as ${user.fullName} · ${user.credits} credits · ${user.subscriptionTier} plan`
            : "Sign in to sync your private library and credit balance."}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            href: "/create",
            title: "Create / Generate",
            desc: "Text-to-image, text-to-video, image-to-video, and inpaint.",
            icon: Clapperboard,
          },
          {
            href: "/community",
            title: "Community Feed",
            desc: "Explore public creations in a masonry gallery.",
            icon: Users,
          },
          {
            href: "/library",
            title: "My Library",
            desc: "Your private generations, prompts, and settings history.",
            icon: Sparkles,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.04]"
            >
              <Icon className="h-5 w-5 text-cyan-300" />
              <h2 className="mt-4 text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-white/45">{card.desc}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
