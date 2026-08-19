import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";
import { loginHref, safeAuthNextPath } from "@/lib/auth-next";

function isAdminDenied(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === 403) return true;
  const message = err instanceof Error ? err.message : "";
  return /admin access denied|admin account is locked/i.test(message);
}

/** Gate /admin* pages: guests (and other accounts) sign in, then return here. */
export async function requireAdminPage(nextPath: string): Promise<void> {
  try {
    await requireAdminUser();
  } catch (err) {
    if (!isAdminDenied(err)) throw err;
    redirect(loginHref(safeAuthNextPath(nextPath, "/admin")));
  }
}
