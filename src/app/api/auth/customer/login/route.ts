import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { loginUser, publicUser } from "@/lib/customer-auth";
import { reconcileCustomerWallet } from "@/lib/wallet-reconcile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const loggedIn = await loginUser({
      email: body.email || "",
      password: body.password || "",
    });
    const fresh = await findUserByEmail(loggedIn.email);
    if (!fresh) return NextResponse.json({ user: loggedIn });

    const { user, restored } = await reconcileCustomerWallet(fresh);
    return NextResponse.json({ user: publicUser(user), walletRestored: restored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 401 },
    );
  }
}
