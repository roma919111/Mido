import { findUserByEmail, findUserById, type UserRecord } from "@/lib/db";

/** Resolve wallet user for a Stripe session even after local user ids change. */
export async function resolveUserForCheckoutSession(session: {
  metadata?: Record<string, string> | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
}): Promise<UserRecord | null> {
  const userId = session.metadata?.userId?.trim();
  if (userId) {
    const byId = await findUserById(userId);
    if (byId) return byId;
  }

  const email =
    session.metadata?.email?.trim() ||
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    "";
  if (email) {
    return findUserByEmail(email.toLowerCase());
  }
  return null;
}
