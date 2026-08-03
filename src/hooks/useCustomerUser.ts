"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import { fetchJson } from "@/lib/fetch-json";

/** Customer session — refreshes on route change and when tab becomes visible. */
export function useCustomerUser() {
  const pathname = usePathname();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ user: CustomerUser | null }>(
        "/api/auth/customer/me",
      );
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser, pathname]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void refreshUser();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, setUser, refreshUser, logout, ready };
}
