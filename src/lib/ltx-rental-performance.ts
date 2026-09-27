/**
 * AI Rental Studio — LTX timing policy (HF Space parity).
 *
 * Goal: video appears in the UI as soon as HF returns (~60s).
 * Vyronix disk persist runs in the background (see ltx25-deployed-job.ts).
 */

export {
  buildLtx25StatusPayload,
  ensureLtx25PreviewDelivered,
  isLtx25DeployedAsset,
  ltx25PreviewPlaybackUrl,
} from "@/lib/ltx25-deployed-job";
