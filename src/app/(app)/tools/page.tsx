import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/veronix/BottomNav";

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-10">
        <h1 className="font-display text-3xl font-extrabold">Tools</h1>
        <p className="mt-3 text-white/50">Quick actions for Veronix creators.</p>
        <div className="mt-6 grid gap-3">
          <Link href="/" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            Create image / video
          </Link>
          <Link href="/pricing" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            Upgrade plan & credits
          </Link>
          <Link href="/assets" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            Open Assets library
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
