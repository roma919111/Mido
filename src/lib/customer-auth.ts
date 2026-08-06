import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByEmail,
  findUserById,
  publicUser,
  type UserRecord,
} from "@/lib/db";

const COOKIE_NAME = "veronix_session";

function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OPENART_SESSION_SECRET?.trim() ||
    "veronix-dev-auth-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(userId: string): Promise<string> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
  return token;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionCookie(userId);
  const jar = await cookies();
  const httpsPublic =
    (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || "").startsWith(
      "https://",
    );
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || httpsPublic,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  return findUserById(id);
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  referralCode?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !email.includes("@")) throw new Error("Valid email is required");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email,
    name: input.name?.trim() || email.split("@")[0] || "Creator",
    passwordHash,
  });

  const { applyReferralOnSignup } = await import("@/lib/referral");
  await applyReferralOnSignup(user.id, input.referralCode);

  const fresh = await findUserById(user.id);
  await setSessionCookie(user.id);
  return publicUser(fresh || user);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await findUserByEmail(input.email.trim().toLowerCase());
  if (!user) throw new Error("Invalid email or password");
  if (user.locked) {
    throw new Error(
      user.lockedReason?.trim() ||
        "تم إيقاف هذا الحساب. تواصل مع الدعم.",
    );
  }
  if (!user.passwordHash) {
    throw new Error("This account uses Google Sign-In. Continue with Google.");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  await setSessionCookie(user.id);
  return publicUser(user);
}

export { publicUser, COOKIE_NAME };
