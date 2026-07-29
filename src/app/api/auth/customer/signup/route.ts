import { NextResponse } from "next/server";
import { registerUser } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const user = await registerUser({
      email: body.email || "",
      password: body.password || "",
      name: body.name,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 },
    );
  }
}
