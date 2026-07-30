import { Suspense } from "react";
import { CreatePage } from "@/components/veronix/CreatePage";

export default function CreateVideoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
      <CreatePage media="video" />
    </Suspense>
  );
}
