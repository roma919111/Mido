import { NextResponse } from "next/server";
import { getWhatsAppSupportNumber } from "@/lib/support-contact";

export const runtime = "nodejs";

/** Public non-secret site config for client chrome (WhatsApp, etc.). */
export async function GET() {
  const whatsapp = getWhatsAppSupportNumber();
  return NextResponse.json({
    whatsapp: whatsapp || null,
  });
}
