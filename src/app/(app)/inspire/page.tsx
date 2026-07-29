import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/veronix/BottomNav";

export default function InspirePage() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-10">
        <h1 className="font-display text-3xl font-extrabold">Inspire</h1>
        <p className="mt-3 text-white/50">
          Browse ideas and jump into Create with a starting prompt.
        </p>
        <div className="mt-6 grid gap-3">
          {[
            "Cinematic neon alley at night, rain reflections",
            "Product hero shot of perfume bottle, soft studio light",
            "Anime character walking through cherry blossom street",
          ].map((idea) => (
            <Link
              key={idea}
              href={`/?idea=${encodeURIComponent(idea)}`}
              className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4 text-sm text-white/80"
            >
              {idea}
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
