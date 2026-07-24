"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { UserProfile } from "@/lib/types";
import { PricingModal } from "@/components/modals/PricingModal";

interface AppContextValue {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  openPricing: () => void;
  closePricing: () => void;
  pricingOpen: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [, startTransition] = useTransition();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      startTransition(() => {
        setUser(data.user ?? null);
        setLoading(false);
      });
    } catch {
      startTransition(() => {
        setUser(null);
        setLoading(false);
      });
    }
  }, [startTransition]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        startTransition(() => {
          setUser(data.user ?? null);
          setLoading(false);
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        startTransition(() => {
          setUser(null);
          setLoading(false);
        });
      });

    return () => controller.abort();
  }, [startTransition]);

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
      setUser,
      openPricing: () => setPricingOpen(true),
      closePricing: () => setPricingOpen(false),
      pricingOpen,
    }),
    [user, loading, refreshUser, pricingOpen],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProviders");
  return ctx;
}
