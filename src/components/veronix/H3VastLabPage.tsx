"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { H3LabClient } from "@/components/veronix/H3LabClient";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { VyronixIdBadge } from "@/components/veronix/VyronixIdBadge";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { isAdminUser } from "@/lib/admin-shared";
import {
  AI_RENTAL_STUDIO_PATH,
  STUDIO_RENTAL_PRICE_USD,
  STUDIO_RENTAL_PRICING_PATH,
  VAST_H3_ESTIMATED_COST_PER_HOUR_USD,
} from "@/lib/ai-rental-studio";
import { loginHref } from "@/lib/auth-next";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearH3RentalCache,
  readH3RentalCache,
  readRentalClockAnchor,
  remainingMsUntil,
  resolveStableRentalClock,
  writeH3RentalCache,
  type H3RentalCache,
} from "@/lib/h3-rental-cache";

/** GET /api/h3-lab/rental payload (plus client-derived flags). */
type RentalState = {
  active: boolean;
  status?: string;
  sessionId?: string;
  remainingMs?: number;
  endsAt?: string;
  startedAt?: string;
  podReady?: boolean;
  provisioning?: boolean;
  awaitingLink?: boolean;
  customerLinked?: boolean;
  runpodStudio?: boolean;
  canGenerate?: boolean;
  studioAvailable?: boolean;
  priceUsd?: number;
  vastCostEstimateUsd?: number;
  gpuFailover?: boolean;
  rentalFrozen?: boolean;
  frozenRemainingMs?: number;
  vyronixId?: number;
  prepStartedAt?: string;
  gpuReadyNotified?: boolean;
  whatsappNotified?: boolean;
  emailNotified?: boolean;
};

type LinkedRental = {
  vyronixId?: number;
  endsAt?: string;
  startedAt?: string;
};

type LinkResponse = LinkedRental & { ok?: boolean; message?: string };

type BillingConfirmResponse = { ok?: boolean; reason?: string; error?: string };

function toRentalCache(state: RentalState): H3RentalCache {
  return {
    ...state,
    vyronixId: state.vyronixId != null ? String(state.vyronixId) : undefined,
  };
}

function VyronixLinkForm({
  ar = false,
  onLinked,
  podReady = false,
  notified = false,
  defaultVyronixId,
}: {
  ar?: boolean;
  onLinked?: (linked: LinkedRental) => void;
  podReady?: boolean;
  notified?: boolean;
  defaultVyronixId?: number;
}) {
  const { t } = useLocale();
  const defaultValue =
    defaultVyronixId != null && defaultVyronixId > 0 ? String(defaultVyronixId) : "";
  const [value, setValue] = useState(defaultValue);
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (syncedDefault !== defaultValue) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }

  const submit = useCallback(
    async (override?: string) => {
      const vyronixId = Number((override ?? value).trim());
      if (!Number.isFinite(vyronixId) || vyronixId <= 0) {
        setError(ar ? "أدخل رقم فيرونيكس ID صحيحاً" : "Enter a valid Vyronix ID number");
        return false;
      }
      setBusy(true);
      setError("");
      try {
        const { res, data } = await fetchJson<LinkResponse>("/api/h3-lab/rental/link", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vyronixId }),
        });
        if (!res.ok || !data?.ok) {
          setError(data?.message || (ar ? "تعذّر الربط — تحقق من الرقم" : "Link failed — check your ID"));
          return false;
        }
        onLinked?.({ vyronixId: data.vyronixId, endsAt: data.endsAt, startedAt: data.startedAt });
        return true;
      } catch {
        setError(ar ? "تعذّر الاتصال" : "Connection failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ar, onLinked, value],
  );

  const hasDefaultId = defaultVyronixId != null && defaultVyronixId > 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#22f0ff]/30 bg-[#141821]/95 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[#22f0ff]">
        <Link2 className="h-5 w-5" />
        <h2 className="text-lg font-bold text-white">{t.studioRental.linkTitle}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{t.studioRental.linkBody}</p>
      {!podReady ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
          {ar
            ? "جاري تجهيز GPU — عند الجاهزية أدخل Vyronix ID واضغط ربط"
            : "GPU is preparing — when ready, enter your Vyronix ID and tap Link"}
        </p>
      ) : hasDefaultId ? (
        <p className="mt-2 text-xs font-semibold text-[#22f0ff]/95">
          {ar
            ? `فيرونيكس ID: ${defaultVyronixId} — أدخل الرقم واضغط ربط`
            : `Vyronix ID: ${defaultVyronixId} — enter it and tap Link`}
        </p>
      ) : notified ? (
        <p className="mt-2 text-xs font-semibold text-emerald-200/90">
          {ar
            ? "✓ GPU جاهز — أدخل ID واضغط ربط لبدء الساعتين"
            : "✓ GPU ready — enter ID and tap Link to start your 2 hours"}
        </p>
      ) : (
        <p className="mt-2 text-xs font-semibold text-emerald-200/90">
          {ar ? "✓ GPU جاهز — أدخل Vyronix ID واضغط ربط" : "✓ GPU ready — enter Vyronix ID and tap Link"}
        </p>
      )}
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-white/75">{t.studioRental.linkLabel}</span>
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={t.studioRental.linkPlaceholder}
          className="mt-2 w-full rounded-xl border border-white/12 bg-[#0f1218] px-3 py-3 font-mono text-lg tracking-wide text-white outline-none ring-[#22f0ff]/40 focus:ring-2"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        disabled={busy || value.trim().length < 4}
        onClick={() => void submit()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-3 text-sm font-extrabold text-[#0b0d12] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t.studioRental.linkButton}
      </button>
    </div>
  );
}

/** Rental snapshot from localStorage so refreshes keep the clock and link state. */
function readCachedRental(): RentalState | null {
  const cached = readH3RentalCache();
  const anchor = readRentalClockAnchor();
  if (!cached && !anchor) return null;

  const clock = resolveStableRentalClock({
    sessionId: cached?.sessionId ?? anchor?.sessionId,
    endsAt: cached?.endsAt ?? anchor?.endsAt,
    startedAt: cached?.startedAt ?? anchor?.startedAt,
  });
  const clockLive = !!(clock?.endsAt && remainingMsUntil(clock.endsAt) > 0);
  const remainingMs = clock?.endsAt ? remainingMsUntil(clock.endsAt) : (cached?.remainingMs ?? 0);
  const active =
    clockLive ||
    !!cached?.active ||
    !!cached?.provisioning ||
    !!(cached?.frozenRemainingMs && cached.frozenRemainingMs > 0);
  const provisioningOnly = !!cached?.provisioning && !cached?.podReady;

  if (!active && !provisioningOnly) {
    if (!clock?.endsAt || remainingMsUntil(clock.endsAt) <= 0) clearH3RentalCache();
    return null;
  }

  return {
    active,
    status: provisioningOnly ? "provisioning" : "active",
    sessionId: cached?.sessionId ?? anchor?.sessionId,
    remainingMs,
    endsAt: clock?.endsAt,
    startedAt: clock?.startedAt,
    podReady: !!cached?.podReady,
    provisioning: !!(cached?.provisioning || cached?.awaitingLink),
    awaitingLink: !!cached?.awaitingLink,
    studioAvailable: true,
    priceUsd: STUDIO_RENTAL_PRICE_USD,
    vastCostEstimateUsd: VAST_H3_ESTIMATED_COST_PER_HOUR_USD,
    gpuFailover: cached?.gpuFailover,
    frozenRemainingMs: cached?.frozenRemainingMs,
  };
}

/** /ai-rental-studio — rental checkout confirm, Vyronix ID link, and H3 studio. */
export function H3VastLabPage() {
  const router = useRouter();
  const { user, ready } = useCustomerUser();
  const { locale, t } = useLocale();
  const ar = locale === "ar";
  const searchParams = useSearchParams();
  const confirmFailedMessage = t.studioRental.confirmPaymentFailed;
  const confirmingFromUrl =
    searchParams.get("rental") === "1" &&
    (!!searchParams.get("session_id")?.trim() ||
      searchParams.get("test_rental") === "1" ||
      searchParams.get("preparing") === "1");

  const [initialRental] = useState(readCachedRental);
  const [rental, setRental] = useState<RentalState | null>(initialRental);
  const [rentalLoaded, setRentalLoaded] = useState(initialRental === null);
  const [confirmError, setConfirmError] = useState("");
  const [confirming, setConfirming] = useState(confirmingFromUrl);
  const [resetting, setResetting] = useState(false);
  const [hadRental, setHadRental] = useState(
    !!(initialRental?.active || initialRental?.provisioning),
  );
  const confirmStartedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "1") router.replace(STUDIO_RENTAL_PRICING_PATH);
  }, [searchParams, router]);

  const refreshRental = useCallback(async () => {
    if (!user) {
      setRental(null);
      clearH3RentalCache();
      setRentalLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/h3-lab/rental", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as RentalState;
        const clock = resolveStableRentalClock(data);
        const clockLive = !!(clock?.endsAt && remainingMsUntil(clock.endsAt) > 0);
        const next: RentalState = {
          ...data,
          endsAt: clock?.endsAt ?? data.endsAt,
          startedAt: clock?.startedAt ?? data.startedAt,
          active:
            data.active ||
            !!data.awaitingLink ||
            clockLive ||
            !!(data.frozenRemainingMs && data.frozenRemainingMs > 0),
          provisioning: !!(data.provisioning || (data.active && !data.podReady)),
          podReady: !!data.podReady,
          awaitingLink: !!data.awaitingLink,
          customerLinked: !!data.customerLinked,
        };
        setRental(next);
        writeH3RentalCache(toRentalCache(next));
        if (data.active || data.provisioning) setHadRental(true);

        const ended = data.status === "ended" || data.status === "failed";
        const idle =
          !data.active &&
          !data.provisioning &&
          !data.endsAt &&
          !(data.frozenRemainingMs && data.frozenRemainingMs > 0);
        if (!clockLive && (ended || idle)) {
          clearH3RentalCache();
          setHadRental(false);
        }
      } else {
        // Reading prunes an expired cache entry.
        readH3RentalCache();
      }
    } catch {
      /* keep cached rental on transient errors */
    } finally {
      setRentalLoaded(true);
    }
  }, [user]);

  const resetRental = useCallback(async () => {
    if (!user || !isAdminUser(user)) return;
    setResetting(true);
    clearH3RentalCache();
    setHadRental(false);
    setRental(null);
    try {
      await fetch("/api/h3-lab/rental/reset-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fresh: true }),
      });
    } catch {
      /* refresh below reflects server state */
    } finally {
      setResetting(false);
    }
    await refreshRental();
  }, [user, refreshRental]);

  useEffect(() => {
    // Server rental state is external; signed-out users reset local state synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!confirmingFromUrl) void refreshRental();
  }, [refreshRental, confirmingFromUrl]);

  useEffect(() => {
    const wantsRefresh = searchParams.get("refresh") === "1";
    if (!user || !ready || !wantsRefresh || !isAdminUser(user) || confirmingFromUrl) return;
    void (async () => {
      await resetRental();
      window.history.replaceState({}, "", AI_RENTAL_STUDIO_PATH);
    })();
  }, [user, ready, searchParams, resetRental, confirmingFromUrl]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id")?.trim();
    const rentalReturn = searchParams.get("rental") === "1";
    const testRental = searchParams.get("test_rental") === "1";
    const preparing = searchParams.get("preparing") === "1";
    if (!user || !rentalReturn || !(sessionId || testRental || preparing)) return;
    if (confirmStartedRef.current) return;
    confirmStartedRef.current = true;

    void (async () => {
      setConfirming(true);
      setConfirmError("");
      let failed = false;
      try {
        if (sessionId) {
          let confirmed = false;
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const res = await fetch("/api/billing/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ sessionId }),
            });
            const data = (await res.json()) as BillingConfirmResponse;
            if (res.ok && data.ok !== false) {
              confirmed = true;
              break;
            }
            if (data.reason === "not_paid" && attempt < 9) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }
            if (data.reason === "already_processed") {
              confirmed = true;
              break;
            }
            setConfirmError(data.error || confirmFailedMessage);
            failed = true;
            break;
          }
          if (!confirmed && !failed) setConfirmError(confirmFailedMessage);
        }
        await refreshRental();
        setHadRental(true);
      } catch {
        setConfirmError(confirmFailedMessage);
        await refreshRental();
      } finally {
        setConfirming(false);
        window.history.replaceState({}, "", AI_RENTAL_STUDIO_PATH);
      }
    })();
  }, [user, searchParams, refreshRental, confirmFailedMessage]);

  const clock = useMemo(
    () => resolveStableRentalClock(rental ?? undefined),
    // Clock anchor only moves with these fields; other rental updates must not re-anchor it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rental?.sessionId, rental?.endsAt, rental?.startedAt, rental?.remainingMs, rental?.awaitingLink],
  );
  const rentalEndsAt = clock?.endsAt ?? rental?.endsAt;
  const rentalStartedAt = clock?.startedAt ?? rental?.startedAt;
  const paidHourActive = !!(rentalEndsAt && remainingMsUntil(rentalEndsAt) > 0);
  const studioLive =
    paidHourActive && !rental?.gpuFailover && !rental?.rentalFrozen && !!rental?.podReady;

  useEffect(() => {
    if ((!rental?.active && !rental?.provisioning && !rental?.gpuFailover) || studioLive) return;
    const intervalMs = rental?.gpuFailover || rental?.provisioning ? 8000 : 20000;
    const id = window.setInterval(() => void refreshRental(), intervalMs);
    return () => window.clearInterval(id);
  }, [
    rental?.active,
    rental?.provisioning,
    rental?.gpuFailover,
    rental?.rentalFrozen,
    rental?.podReady,
    studioLive,
    refreshRental,
  ]);

  const cacheSaysLive = useMemo(() => {
    const cached = readH3RentalCache();
    if (!cached) return false;
    return (
      !!(
        (cached.frozenRemainingMs && cached.frozenRemainingMs > 0) ||
        cached.gpuFailover ||
        (cached.endsAt && remainingMsUntil(cached.endsAt) > 0)
      ) || !!(cached.provisioning || cached.awaitingLink)
    );
    // localStorage is re-read whenever the rental state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental]);

  const rentalExpired = !!(
    rentalEndsAt &&
    remainingMsUntil(rentalEndsAt) <= 0 &&
    !rental?.frozenRemainingMs
  );

  /* eslint-disable react-hooks/set-state-in-effect -- expiry is clock-driven, not an event */
  useEffect(() => {
    if (!rentalEndsAt || !rentalExpired) return;
    clearH3RentalCache();
    setHadRental(false);
    void refreshRental();
  }, [rentalExpired, rentalEndsAt, refreshRental]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rentalInPlay = useMemo(
    () =>
      !!user &&
      rentalLoaded &&
      !rentalExpired &&
      (!!(
        rental?.gpuFailover ||
        rental?.rentalFrozen ||
        (rental?.endsAt && remainingMsUntil(rental.endsAt) > 0) ||
        rental?.active ||
        rental?.provisioning
      ) ||
        cacheSaysLive ||
        hadRental),
    [user, rental, rentalLoaded, cacheSaysLive, rentalExpired, hadRental],
  );

  const customerLinked = !!rental?.customerLinked;
  const runpodStudio = !!rental?.runpodStudio;
  const needsVyronixLink = !!(user && !customerLinked && !runpodStudio);
  const studioUnlocked = !!(user && rentalInPlay && (customerLinked || runpodStudio));

  useEffect(() => {
    if (!user || customerLinked) return;
    const id = window.setInterval(() => void refreshRental(), 10000);
    return () => window.clearInterval(id);
  }, [user, customerLinked, refreshRental]);

  const handleLinked = useCallback(
    (linked: LinkedRental) => {
      setHadRental(true);
      writeH3RentalCache({
        active: true,
        provisioning: true,
        awaitingLink: false,
        podReady: false,
        customerLinked: true,
        endsAt: linked.endsAt,
        startedAt: linked.startedAt,
      });
      setRental((prev) =>
        prev
          ? {
              ...prev,
              awaitingLink: false,
              customerLinked: true,
              provisioning: true,
              podReady: false,
              vyronixId: linked.vyronixId ?? prev.vyronixId,
              endsAt: linked.endsAt ?? prev.endsAt,
              startedAt: linked.startedAt ?? prev.startedAt,
              active: true,
            }
          : prev,
      );
      void refreshRental();
    },
    [refreshRental],
  );

  const linkRental: RentalState = rental ?? {
    active: true,
    status: "provisioning",
    remainingMs: 0,
    podReady: false,
    provisioning: true,
    awaitingLink: true,
    studioAvailable: true,
    priceUsd: STUDIO_RENTAL_PRICE_USD,
    vastCostEstimateUsd: VAST_H3_ESTIMATED_COST_PER_HOUR_USD,
  };

  const linkSection = needsVyronixLink ? (
    <div className="sticky top-14 z-30 rounded-2xl bg-[#0b0d12]/95 pb-1 pt-1 backdrop-blur-md">
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c5cff]">
        {ar ? "ربط Vyronix ID مع فيرونيكس" : "Link Vyronix ID to Vyronix"}
      </p>
      {rental?.vyronixId ? (
        <div className="mb-3 flex justify-center">
          <VyronixIdBadge
            vyronixId={rental.vyronixId}
            prepStartedAt={rental.prepStartedAt}
            ar={ar}
          />
        </div>
      ) : null}
      <VyronixLinkForm
        ar={ar}
        podReady={linkRental.podReady}
        defaultVyronixId={linkRental.vyronixId}
        notified={
          !!(linkRental.gpuReadyNotified || linkRental.whatsappNotified || linkRental.emailNotified)
        }
        onLinked={handleLinked}
      />
    </div>
  ) : null;

  const adminSection = isAdminUser(user) ? (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={resetting}
        onClick={() => void resetRental()}
        className="inline-flex items-center gap-2 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-1.5 text-[11px] font-semibold text-[#c8fbff] disabled:opacity-50"
      >
        {resetting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {ar ? "↻ بداية جديدة (admin)" : "↻ Fresh start (admin)"}
      </button>
    </div>
  ) : null;

  const subscribeHint =
    !ready || !user || rentalInPlay || confirming || isAdminUser(user) ? null : (
      <div className="rounded-2xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-4 py-3 text-center text-sm text-white/85">
        <p>
          {ar
            ? "اشترك من صفحة الباقات — سيصلك Vyronix ID على الواتساب أو الإيميل بعد التجهيز."
            : "Subscribe on the pricing page — your Vyronix ID arrives on WhatsApp or email when ready."}
        </p>
        <Link
          href={STUDIO_RENTAL_PRICING_PATH}
          className="mt-2 inline-block font-bold text-[#22f0ff] underline underline-offset-2"
        >
          {ar ? "← الباقات · فيرونيكس" : "← Pricing · Vyronix"}
        </Link>
      </div>
    );

  const topSection = user ? (
    linkSection || subscribeHint ? (
      <div className="space-y-3">
        {linkSection}
        {subscribeHint}
      </div>
    ) : null
  ) : (
    <div className="rounded-2xl border border-[#22f0ff]/30 bg-[#22f0ff]/8 px-4 py-3 text-center text-sm text-white/85">
      <p>{ar ? "سجّل الدخول لربط Vyronix ID مع فيرونيكس" : "Sign in to link your Vyronix ID to Vyronix"}</p>
      <Link
        href={loginHref(AI_RENTAL_STUDIO_PATH)}
        className="mt-2 inline-block font-bold text-[#22f0ff] underline underline-offset-2"
      >
        {ar ? "تسجيل الدخول" : "Sign in"}
      </Link>
    </div>
  );

  const confirmOverlay = confirming ? (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center bg-[#0b0d12]/75 px-4 pt-24">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-[#22f0ff]/30 bg-[#10141c] px-6 py-8 text-center shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
        <p className="text-sm text-white/75">
          {ar ? "جاري تأكيد الدفع وتشغيل فيرونيكس…" : "Confirming payment and launching Vyronix…"}
        </p>
      </div>
    </div>
  ) : null;

  const canRender = ready && (isAdminUser(user) || !user || rentalLoaded);
  if (!canRender) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d12] px-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
      </div>
    );
  }

  return (
    <>
      {confirmOverlay}
      {confirmError ? (
        <div className="fixed left-0 right-0 top-16 z-40 mx-auto max-w-md px-4">
          <p className="rounded-xl border border-red-400/30 bg-red-950/80 px-3 py-2 text-center text-sm text-red-200">
            {confirmError}
          </p>
        </div>
      ) : null}
      <H3LabClient
        gpuOnly
        guestStudioPreview
        hideHeroCard
        returnPath={AI_RENTAL_STUDIO_PATH}
        topSection={topSection}
        extraSection={adminSection}
        needsVyronixLink={needsVyronixLink}
        studioUnlocked={studioUnlocked}
        paidHourActive={paidHourActive}
        rentalEndsAt={rentalEndsAt}
        rentalStartedAt={rentalStartedAt}
        rentalGpuFailover={rental?.gpuFailover}
        rentalFrozen={rental?.rentalFrozen}
        rentalPodReady={rental?.podReady}
        rentalCanGenerate={
          !!(
            rental?.canGenerate ||
            (paidHourActive &&
              (rental?.podReady || runpodStudio) &&
              (customerLinked || runpodStudio))
          )
        }
        rentalVyronixId={rental?.vyronixId}
        rentalPrepStartedAt={rental?.prepStartedAt}
      />
    </>
  );
}
