"use client";

import { Suspense } from "react";
import { AppHeader } from "./AppHeader";
import { AuthForm } from "./AuthForm";
import { BottomNav } from "./BottomNav";
import { useCustomerUser } from "@/hooks/useCustomerUser";

function AuthPageBody({ mode }: { mode: "login" | "signup" }) {
  const { user, logout } = useCustomerUser();

  return (
    <>
      <AppHeader user={user} onLogout={() => void logout()} />
      <AuthForm mode={mode} embedded />
    </>
  );
}

export function AuthPageShell({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
        <AuthPageBody mode={mode} />
      </Suspense>
      <BottomNav />
    </div>
  );
}
