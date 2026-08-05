import { getDeviceId, getDeviceMac } from "./device-id";

const CACHE_KEY = "max.activationStatus";
const POLL_MS = 8000;

function apiBase(): string | null {
  const raw = import.meta.env.VITE_ACTIVATION_API?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

export type ActivationStatus = {
  activated: boolean;
  label?: string | null;
};

function readCache(deviceId: string): ActivationStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { deviceId: string; activated: boolean; label?: string };
    if (parsed.deviceId !== deviceId || !parsed.activated) return null;
    return { activated: true, label: parsed.label };
  } catch {
    return null;
  }
}

function writeCache(deviceId: string, status: ActivationStatus): void {
  if (!status.activated) return;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ deviceId, activated: true, label: status.label ?? null }),
  );
}

export function isActivationRequired(): boolean {
  return Boolean(apiBase());
}

export async function registerForActivation(): Promise<void> {
  const base = apiBase();
  if (!base) return;

  const deviceId = getDeviceId();
  try {
    await fetch(`${base}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        mac: getDeviceMac(deviceId),
        version: __APP_VERSION__,
      }),
    });
  } catch {
    /* offline */
  }
}

export async function fetchActivationStatus(deviceId: string): Promise<ActivationStatus> {
  const cached = readCache(deviceId);
  if (cached?.activated) return cached;

  const base = apiBase();
  if (!base) return { activated: true };

  try {
    const res = await fetch(
      `${base}/activate?deviceId=${encodeURIComponent(deviceId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { activated: false };
    const data = (await res.json()) as ActivationStatus;
    if (data.activated) writeCache(deviceId, data);
    return data;
  } catch {
    return { activated: false };
  }
}

export function getActivationPollMs(): number {
  return POLL_MS;
}

export function clearActivationCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
