import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { deleteAssetForUser, findAssetById, listAssetsForUser } from "@/lib/db";
import { readDriveAccessToken } from "@/lib/google-drive-token";
import { uploadLocalFileToDrive } from "@/lib/google-drive-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Upload selected (or all local) videos to the customer's Google Drive,
 * then delete them from Vyronix storage to free disk.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const token = await readDriveAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Connect Google Drive first", needsDriveAuth: true },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      assetIds?: string[];
      deleteAfter?: boolean;
      limit?: number;
    };
    const deleteAfter = body.deleteAfter !== false;
    const limit = Math.min(20, Math.max(1, Number(body.limit) || 10));

    let targets = await listAssetsForUser(user.id);
    targets = targets.filter(
      (a) =>
        a.mediaType === "video" &&
        a.status === "completed" &&
        a.url?.startsWith("/generations/"),
    );

    if (Array.isArray(body.assetIds) && body.assetIds.length) {
      const want = new Set(body.assetIds);
      targets = targets.filter((a) => want.has(a.id));
    }

    // Oldest first — free classic clutter first
    targets.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    targets = targets.slice(0, limit);

    const results: Array<{
      assetId: string;
      ok: boolean;
      driveFileId?: string;
      webViewLink?: string;
      deleted?: boolean;
      error?: string;
    }> = [];

    for (const asset of targets) {
      try {
        const fresh = await findAssetById(user.id, asset.id);
        if (!fresh?.url?.startsWith("/generations/")) {
          results.push({ assetId: asset.id, ok: false, error: "Not a local file" });
          continue;
        }
        const filename = `Vyronix-${asset.id.slice(0, 8)}-${Date.now()}.mp4`;
        const uploaded = await uploadLocalFileToDrive({
          accessToken: token,
          localUrl: fresh.url,
          filename,
        });
        let deleted = false;
        if (deleteAfter) {
          deleted = await deleteAssetForUser(user.id, asset.id);
        }
        results.push({
          assetId: asset.id,
          ok: true,
          driveFileId: uploaded.id,
          webViewLink: uploaded.webViewLink,
          deleted,
        });
      } catch (err) {
        results.push({
          assetId: asset.id,
          ok: false,
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    const uploaded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      uploaded,
      failed,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive export failed" },
      { status: 500 },
    );
  }
}
