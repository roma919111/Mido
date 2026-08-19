import { cookies } from "next/headers";

const COOKIE = "veronix_drive_token";
const MAX_AGE = 60 * 60; // 1 hour

export async function setDriveAccessToken(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readDriveAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value?.trim() || null;
}

export async function clearDriveAccessToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
