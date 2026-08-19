import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { getStorageStatus } from "@/lib/storage-usage";
import { readDriveAccessToken } from "@/lib/google-drive-token";
import { listAssetsForUser } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const storage = await getStorageStatus();
    const driveReady = Boolean(await readDriveAccessToken());

    let videoCount = 0;
    if (user) {
      const assets = await listAssetsForUser(user.id);
      videoCount = assets.filter(
        (a) =>
          a.mediaType === "video" &&
          a.status === "completed" &&
          a.url?.startsWith("/generations/"),
      ).length;
    }

    return NextResponse.json({
      ...storage,
      driveReady,
      videoCount,
      loggedIn: Boolean(user),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage status failed" },
      { status: 500 },
    );
  }
}
