/** Visible on GET /api/health — bump the r### suffix on each studio/LTX release. */
export const VYRONIX_BUILD_STAMP = "ltx-full-video-r399-rental";

export function getVyronixBuildStamp(): string {
  const fromEnv = process.env.VYRONIX_BUILD_STAMP?.trim();
  return fromEnv || VYRONIX_BUILD_STAMP;
}
