import { NextResponse } from "next/server";
import { loginUser } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await loginUser({
      email: body.email || "",
      password: body.password || "",
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 401 },
    );
  }
}
