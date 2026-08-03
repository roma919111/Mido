import { NextResponse } from "next/server";
import {
  CREDITS_PER_USD,
  CREDIT_USD,
  listVideoModelPricing,
} from "@/config/modelPricing";

export const runtime = "nodejs";

/** Public read-only model pricing table for UI + integrations. */
export async function GET() {
  return NextResponse.json({
    creditUsd: CREDIT_USD,
    creditsPerUsd: CREDITS_PER_USD,
    models: listVideoModelPricing(),
  });
}
