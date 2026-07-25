import { BrandLogo } from "./BrandLogo";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/8 bg-[rgba(8,10,14,0.65)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <BrandLogo size="sm" />
          <p className="text-sm text-white/40">
            Next-gen AI image & video studio powered by OpenArt.
          </p>
        </div>
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} VYRONIX.AI · All rights reserved
        </p>
      </div>
    </footer>
  );
}
