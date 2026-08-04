const DEVICE_ID_KEY = "streamhub.deviceId";

function hashDigits(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(h).padStart(14, "0").slice(0, 14);
}

export function getDeviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const generated = hashDigits(`${navigator.userAgent}-${Date.now()}-${Math.random()}`);
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export function getDeviceMac(deviceId: string): string {
  const seed = hashDigits(`${deviceId}-mac`);
  const pairs = seed.match(/.{1,2}/g)?.slice(0, 6) ?? ["e2", "ca", "64", "be", "8a", "84"];
  return pairs.map((p) => p.padStart(2, "0").slice(0, 2)).join(":");
}
