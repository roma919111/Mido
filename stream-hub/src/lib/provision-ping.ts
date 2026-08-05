import { getDeviceId, getDeviceMac } from "./device-id";

const PINGED_KEY = "max.provisionPinged";

/** Notify Mohammed when a paying customer installs the media player (optional webhook). */
export async function pingProvisionerOnce(): Promise<void> {
  if (localStorage.getItem(PINGED_KEY) === "1") return;

  const url = import.meta.env.VITE_PROVISION_WEBHOOK?.trim();
  if (!url) return;

  const deviceId = getDeviceId();
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        mac: getDeviceMac(deviceId),
        version: __APP_VERSION__,
        at: new Date().toISOString(),
      }),
    });
    localStorage.setItem(PINGED_KEY, "1");
  } catch {
    /* offline / no webhook — ignore */
  }
}
