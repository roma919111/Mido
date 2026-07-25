import { BrandLogo } from "./BrandLogo";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/8 bg-[rgba(8,10,14,0.85)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <BrandLogo size="sm" />
          <p className="max-w-md text-sm text-white/40">
            Next-gen AI image &amp; video studio. Create cinematic stills and motion from a single
            prompt.
          </p>
        </div>
        <p className="text-xs text-white/30">© {year} VYRONIX.AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
