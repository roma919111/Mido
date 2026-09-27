import { redirect } from "next/navigation";
import { AI_RENTAL_STUDIO_PATH } from "@/lib/ai-rental-studio";

/** Legacy H3 Vast lab URL → AI Rental Studio. */
export default function LegacyH3VastPage() {
  redirect(AI_RENTAL_STUDIO_PATH);
}
