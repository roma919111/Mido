import { redirect } from "next/navigation";
import { MEDIA_PLAYER_LANDING_PATH } from "@/lib/media-player-commerce";

/** Old marketing URL — keep as a server redirect in case the config redirect is skipped. */
export default function LegacyMediaPlayerLandingPage() {
  redirect(MEDIA_PLAYER_LANDING_PATH);
}
