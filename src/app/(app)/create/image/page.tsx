import { Suspense } from "react";
import { CreatePage } from "@/components/veronix/CreatePage";

export default function CreateImagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
      <CreatePage media="image" />
    </Suspense>
  );
}