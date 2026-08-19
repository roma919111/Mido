import { cookies } from "next/headers";

export const IPTV_DEVICE_COOKIE = "maxvr_device_id";
export const IPTV_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 730;

export type DeviceCookieIdentity = {
  mac: string;
  devicePin: string;
  savedAt: number;
};

function westernizeDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function isValidMac(mac: string | null | undefined): mac is string {
  return Boolean(mac && westernizeDigits(mac).replace(/[^a-fA-F0-9]/g, "").length === 12);
}

function isValidPin(pin: string | null | undefined): pin is string {
  return Boolean(pin && /^\d{4}$/.test(westernizeDigits(pin).replace(/\D/g, "")));
}

export function parseDeviceCookieValue(raw: string | undefined | null): DeviceCookieIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeviceCookieIdentity;
    if (!isValidMac(parsed.mac) || !isValidPin(parsed.devicePin)) return null;
    return {
      mac: parsed.mac,
      devicePin: parsed.devicePin,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export async function readDeviceCookie(): Promise<DeviceCookieIdentity | null> {
  const jar = await cookies();
  return parseDeviceCookieValue(jar.get(IPTV_DEVICE_COOKIE)?.value);
}

export async function writeDeviceCookie(mac: string, devicePin: string): Promise<void> {
  if (!isValidMac(mac) || !isValidPin(devicePin)) return;
  const jar = await cookies();
  const httpsPublic = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || "").startsWith("https://");
  jar.set(IPTV_DEVICE_COOKIE, JSON.stringify({ mac, devicePin, savedAt: Date.now() } satisfies DeviceCookieIdentity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || httpsPublic,
    path: "/",
    maxAge: IPTV_DEVICE_COOKIE_MAX_AGE,
  });
}
