import { Suspense } from "react";
import { AuthForm } from "@/components/veronix/AuthForm";
import { BottomNav } from "@/components/veronix/BottomNav";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
        <AuthForm mode="login" />
      </Suspense>
      <BottomNav />
    </div>
  );
}
