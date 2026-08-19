import crypto from "node:crypto";

const BASE = process.env.APP_BASE_URL?.replace(/\/+$/, "") || "https://vyronix.app";
const ADMIN_EMAIL = "losmercadooss@gmail.com";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function signJwt(secret, claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...claims, iat: now, exp: now + 3600 }));
  const sig = b64url(
    crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${sig}`;
}
function mp4DurationSeconds(buf) {
  const idx = buf.indexOf(Buffer.from("mvhd"));
  if (idx < 0) return null;
  const version = buf[idx + 4];
  try {
    if (version === 0) {
      const timescale = buf.readUInt32BE(idx + 16);
      const duration = buf.readUInt32BE(idx + 20);
      return timescale > 0 ? duration / timescale : null;
    }
  } catch {
    return null;
  }
  return null;
}

const secret = process.env.AUTH_SECRET?.trim();
const panelRes = await fetch(`${BASE}/api/admin/panel?q=${encodeURIComponent(ADMIN_EMAIL)}`, {
  headers: {
    Cookie: `veronix_session=${signJwt(secret, { sub: "admin", email: ADMIN_EMAIL })}`,
  },
});
const panel = await panelRes.json();
const adminUser = (panel.users || []).find(
  (u) => String(u.email || "").toLowerCase() === ADMIN_EMAIL,
);
const cookie = `veronix_session=${signJwt(secret, { sub: adminUser.id, email: ADMIN_EMAIL })}`;

const assetsRes = await fetch(`${BASE}/api/assets?sync=1`, {
  headers: { Accept: "application/json", Cookie: cookie },
});
const assetsJson = await assetsRes.json();
const assets = (assetsJson.assets || [])
  .filter((a) => a.mediaType === "video")
  .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
  .slice(0, 8);

const rows = [];
for (const a of assets) {
  const row = {
    id: a.id,
    createdAt: a.createdAt,
    status: a.status,
    mode: a.mode,
    model: a.model,
    targetSeconds: a.targetSeconds,
    error: a.error || null,
    url: a.url || null,
    historyId: a.historyId || null,
    creditsUsed: a.creditsUsed,
    jobKind: a.jobMeta?.kind || null,
    nextIndex: a.jobMeta?.nextIndex,
    shotCount: a.jobMeta?.shots?.length,
    partUrlCount: Array.isArray(a.jobMeta?.partUrls)
      ? a.jobMeta.partUrls.filter(Boolean).length
      : null,
    partVideoIds: a.jobMeta?.partVideoIds || null,
  };
  if (a.url && String(a.url).startsWith("/generations/")) {
    const vidRes = await fetch(
      `${BASE}/api/media/stream?local=${encodeURIComponent(a.url)}&type=video`,
      { headers: { Cookie: cookie } },
    );
    const buf = Buffer.from(await vidRes.arrayBuffer());
    row.httpStatus = vidRes.status;
    row.bytes = buf.length;
    row.measuredSeconds = vidRes.ok ? mp4DurationSeconds(buf) : null;
  }
  rows.push(row);
}

console.log(JSON.stringify({ credits: adminUser.credits, rows }, null, 2));
