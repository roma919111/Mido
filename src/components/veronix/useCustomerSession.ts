"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import { fetchJson } from "@/lib/fetch-json";
import {
  readCachedCustomer,
  writeCachedCustomer,
} from "@/lib/customer-session-cache";

/**
 * Customer session with instant cache hydrate so the header never flashes Login
 * while `/api/auth/customer/me` is loading between BottomNav pages.
 */
export function useCustomerSession() {
  const [user, setUser] = useState<CustomerUser | null>(() =>
    readCachedCustomer(),
  );
  const [sessionReady, setSessionReady] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ user: CustomerUser | null }>(
        "/api/auth/customer/me",
      );
      const next = data.user ?? null;
      setUser(next);
      writeCachedCustomer(next);
    } catch {
      setUser(null);
      writeCachedCustomer(null);
    } finally {
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/customer/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    writeCachedCustomer(null);
    setSessionReady(true);
  }, []);

  return { user, setUser, sessionReady, refreshUser, logout };
}
