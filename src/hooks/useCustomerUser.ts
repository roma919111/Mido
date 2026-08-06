"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import {
  readCustomerSnapshot,
  writeCustomerSnapshot,
} from "@/lib/customer-user-cache";
import { fetchJson } from "@/lib/fetch-json";

const AUTH_REFRESH_TTL_MS = 60_000;

/** Customer session — hydrates from cache instantly; refreshes in background. */
export function useCustomerUser() {
  const lastFetchRef = useRef(0);
  const [user, setUserState] = useState<CustomerUser | null>(() =>
    readCustomerSnapshot(),
  );
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const applyUser = useCallback((next: CustomerUser | null) => {
    setUserState(next);
    writeCustomerSnapshot(next);
  }, []);

  const refreshUser = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < AUTH_REFRESH_TTL_MS) {
      setReady(true);
      return;
    }
    lastFetchRef.current = now;
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
    void refreshUser(true);
  }, [refreshUser]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void refreshUser(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    applyUser(null);
    lastFetchRef.current = 0;
  }, [applyUser]);

  return {
    user,
    setUser: applyUser,
    refreshUser: () => refreshUser(true),
    logout,
    ready,
    refreshing,
  };
}
