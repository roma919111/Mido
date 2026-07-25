import { Suspense } from "react";
import { OpenArtSetupPage } from "@/components/veronix/OpenArtSetupPage";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0b0d12]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl px-4 py-10 text-sm text-white/50" dir="rtl">
            جارٍ التحميل…
          </div>
        }
      >
        <OpenArtSetupPage />
      </Suspense>
    </div>
  );
}
