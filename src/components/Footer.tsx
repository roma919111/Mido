import { BrandLogo } from "./BrandLogo";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/8 bg-[rgba(7,9,13,0.85)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="space-y-2">
          <BrandLogo size="sm" />
          <p className="max-w-md text-sm text-white/40">
            Next-gen AI image &amp; video studio. OpenArt MCP runs on the platform account —
            customers generate with no login.
          </p>
        </div>
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} VYRONIX.AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
