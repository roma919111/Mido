/** Client-side rental session cache (mirrors production vyronix-h3-rental-v1). */

export type H3RentalCache = {
  active?: boolean;
  provisioning?: boolean;
  awaitingLink?: boolean;
  customerLinked?: boolean;
  sessionId?: string;
  endsAt?: string;
  startedAt?: string;
  podReady?: boolean;
  vyronixId?: string;
  gpuFailover?: boolean;
  frozenRemainingMs?: number;
  remainingMs?: number;
  cachedAt?: number;
};

const RENTAL_CACHE_KEY = "vyronix-h3-rental-v1";
const RENTAL_ANCHOR_KEY = "vyronix-h3-rental-anchor-v1";

export function remainingMsUntil(isoEndsAt: string | undefined, now = Date.now()): number {
  if (!isoEndsAt?.trim()) return 0;
  const ends = new Date(isoEndsAt).getTime();
  return Number.isFinite(ends) ? Math.max(0, ends - now) : 0;
}

export type RentalClockAnchor = {
  sessionId?: string;
  endsAt: string;
  startedAt?: string;
};

export function readRentalClockAnchor(): RentalClockAnchor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RENTAL_ANCHOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RentalClockAnchor;
    if (!parsed.endsAt?.trim() || remainingMsUntil(parsed.endsAt) <= 0) {
      localStorage.removeItem(RENTAL_ANCHOR_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRentalClockAnchor(input: {
  sessionId?: string;
  endsAt?: string;
  startedAt?: string;
}): RentalClockAnchor | null {
  const existing = readRentalClockAnchor();
  if (existing && remainingMsUntil(existing.endsAt) > 0) {
    const a = input.sessionId;
    const b = existing.sessionId;
    if (!a || !b || a === b) return existing;
    localStorage.removeItem(RENTAL_ANCHOR_KEY);
  }
  const endsAt = input.endsAt?.trim();
  if (!endsAt || remainingMsUntil(endsAt) <= 0) return existing;
  const anchor: RentalClockAnchor = {
    sessionId: input.sessionId || existing?.sessionId,
    endsAt,
    startedAt: input.startedAt?.trim() || existing?.startedAt,
  };
  localStorage.setItem(RENTAL_ANCHOR_KEY, JSON.stringify(anchor));
  return anchor;
}

function readRawRentalCache(): H3RentalCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(RENTAL_CACHE_KEY) ?? sessionStorage.getItem(RENTAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as H3RentalCache;
  } catch {
    return null;
  }
}

function clearRentalStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RENTAL_CACHE_KEY);
  sessionStorage.removeItem(RENTAL_CACHE_KEY);
  localStorage.removeItem(RENTAL_ANCHOR_KEY);
}

export function clearH3RentalCache(): void {
  clearRentalStorage();
}

export function readH3RentalCache(): H3RentalCache | null {
  const cached = readRawRentalCache();
  if (!cached) return null;

  const anchor = readRentalClockAnchor();
  const endsAt = anchor?.endsAt || cached.endsAt;
  if (
    endsAt &&
    new Date(endsAt).getTime() <= Date.now() &&
    (!cached.frozenRemainingMs || cached.frozenRemainingMs <= 0)
  ) {
    clearRentalStorage();
    if (!anchor || remainingMsUntil(anchor.endsAt) <= 0) {
      localStorage.removeItem(RENTAL_ANCHOR_KEY);
    }
    return null;
  }

  const clockLive = !!(endsAt && remainingMsUntil(endsAt) > 0);
  if (cached.active || cached.provisioning || cached.gpuFailover || clockLive) {
    return {
      ...cached,
      endsAt,
      startedAt: anchor?.startedAt || cached.startedAt,
    };
  }
  return null;
}

export function resolveStableRentalClock(input?: {
  sessionId?: string;
  endsAt?: string;
  startedAt?: string;
}): { endsAt: string; startedAt?: string } | null {
  const anchor = readRentalClockAnchor();
  if (anchor && remainingMsUntil(anchor.endsAt) > 0) {
    const a = input?.sessionId;
    const b = anchor.sessionId;
    if (!a || !b || a === b) {
      return { endsAt: anchor.endsAt, startedAt: anchor.startedAt ?? input?.startedAt };
    }
  }
  if (input?.endsAt?.trim() && remainingMsUntil(input.endsAt) > 0) {
    const merged = writeRentalClockAnchor({
      sessionId: input.sessionId,
      endsAt: input.endsAt,
      startedAt: input.startedAt,
    });
    return merged
      ? { endsAt: merged.endsAt, startedAt: merged.startedAt ?? input.startedAt }
      : { endsAt: input.endsAt, startedAt: input.startedAt };
  }
  const cached = readH3RentalCache();
  if (cached?.endsAt && remainingMsUntil(cached.endsAt) > 0) {
    return { endsAt: cached.endsAt, startedAt: cached.startedAt };
  }
  return null;
}

export function writeH3RentalCache(input: H3RentalCache): void {
  if (typeof window === "undefined") return;
  const prev = readH3RentalCache();

  if (input.awaitingLink && !input.endsAt?.trim()) {
    localStorage.removeItem(RENTAL_ANCHOR_KEY);
  }

  const anchorInput =
    input.endsAt?.trim() || readRentalClockAnchor()?.endsAt
      ? writeRentalClockAnchor({
          sessionId: input.sessionId || prev?.sessionId,
          endsAt: input.endsAt,
          startedAt: input.startedAt,
        })
      : null;

  const endsAt =
    anchorInput?.endsAt ||
    readRentalClockAnchor()?.endsAt ||
    input.endsAt?.trim() ||
    (prev?.endsAt && remainingMsUntil(prev.endsAt) > 0 ? prev.endsAt : undefined);

  const startedAt =
    anchorInput?.startedAt || input.startedAt?.trim() || prev?.startedAt;

  const shouldPersist =
    input.active ||
    input.provisioning ||
    input.awaitingLink ||
    (endsAt && remainingMsUntil(endsAt) > 0) ||
    (input.frozenRemainingMs && input.frozenRemainingMs > 0);

  if (!shouldPersist) {
    if (!anchorInput || remainingMsUntil(anchorInput.endsAt) <= 0) {
      clearRentalStorage();
    }
    return;
  }

  const payload: H3RentalCache = {
    active: input.active || !!(endsAt && remainingMsUntil(endsAt) > 0),
    provisioning: !!(input.provisioning || input.awaitingLink) && !endsAt,
    awaitingLink: input.awaitingLink,
    customerLinked: input.customerLinked ?? prev?.customerLinked,
    sessionId: input.sessionId || prev?.sessionId,
    endsAt,
    startedAt,
    podReady: input.podReady,
    vyronixId: input.vyronixId,
    gpuFailover: input.gpuFailover,
    frozenRemainingMs: input.frozenRemainingMs,
    remainingMs: input.remainingMs,
    cachedAt: Date.now(),
  };

  const json = JSON.stringify(payload);
  localStorage.setItem(RENTAL_CACHE_KEY, json);
  try {
    sessionStorage.setItem(RENTAL_CACHE_KEY, json);
  } catch {
    /* quota / private mode */
  }
}
