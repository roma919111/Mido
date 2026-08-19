import { redirect } from "next/navigation";
import { MEDIA_PLAYER_LANDING_PATH } from "@/lib/media-player-commerce";

/** Legacy marketing URL. */
export default function LegacyPlayerLandingPage() {
  redirect(MEDIA_PLAYER_LANDING_PATH);
}
