"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import {
  readCustomerSnapshot,
  writeCustomerSnapshot,
} from "@/lib/customer-user-cache";
import { fetchJson } from "@/lib/fetch-json";

/** Customer session — hydrates from cache instantly; refreshes in background. */
export function useCustomerUser() {
  const pathname = usePathname();
  const [user, setUserState] = useState<CustomerUser | null>(() =>
    readCustomerSnapshot(),
  );
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const applyUser = useCallback((next: CustomerUser | null) => {
    setUserState(next);
    writeCustomerSnapshot(next);
  }, []);

  const refreshUser = useCallback(async () => {
    setRefreshing(true);
    try {
      const { res, data } = await fetchJson<{ user: CustomerUser | null }>(
        "/api/auth/customer/me",
      );
      if (res.ok) {
        applyUser(data.user);
      }
    } catch {
      // Keep cached session visible on transient network errors.
    } finally {
      setReady(true);
      setRefreshing(false);
    }
  }, [applyUser]);

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
    applyUser(null);
  }, [applyUser]);

  return { user, setUser: applyUser, refreshUser, logout, ready, refreshing };
}
