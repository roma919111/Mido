import { NextResponse } from "next/server";
import { isMaxAdminAuthorized, listActivations } from "@/lib/max-activations";

export const runtime = "nodejs";

/** Admin: list all registered devices. */
export async function GET(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = await listActivations();
  return NextResponse.json({ devices });
}
