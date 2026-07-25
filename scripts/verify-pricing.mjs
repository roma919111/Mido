#!/usr/bin/env node
/**
 * Verify Veronix markup: every live model quote = OpenArt × 1.8
 * Usage: node scripts/verify-pricing.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const MULTIPLIER = 1.8;

const CASES = [
  { id: "auto", media: "image", mode: "text2image" },
  { id: "gpt-image-2", media: "image", mode: "text2image" },
  { id: "nano-banana-2-lite", media: "image", mode: "text2image" },
  { id: "nano-banana-2", media: "image", mode: "text2image" },
  { id: "nano-banana-pro", media: "image", mode: "text2image" },
  { id: "seedream-5-lite", media: "image", mode: "text2image" },
  { id: "seedream-4-5", media: "image", mode: "text2image" },
  { id: "kling-3-omni-image", media: "image", mode: "text2image" },
  {
    id: "seedance-2-mini",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 9,
    generateAudio: true,
  },
  {
    id: "seedance-2",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
  },
  {
    id: "seedance-2-fast",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
  },
  {
    id: "gemini-omni-flash",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
  },
  {
    id: "kling-3-omni",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
  },
  {
    id: "pixverse-v6",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
    generateAudio: false,
  },
  {
    id: "wan-2-7",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
  },
  {
    id: "grok-imagine",
    media: "video",
    mode: "image2video",
    resolution: "720p",
    duration: 5,
  },
];

function expected(openArt) {
  return Math.max(1, Math.round(Number(openArt) * MULTIPLIER));
}

async function quote(c) {
  const res = await fetch(`${BASE}/api/credits/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      modelIds: [c.id],
      media: c.media,
      mode: c.mode,
      aspectRatio: c.media === "image" ? "1:1" : "16:9",
      resolution: c.resolution,
      duration: c.duration,
      generateAudio: c.generateAudio,
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

let failed = 0;
console.log(`Verifying ×${MULTIPLIER} against ${BASE}\n`);

const modelsRes = await fetch(`${BASE}/api/models`);
const models = await modelsRes.json();
const liveVideo = (models.video || []).filter((m) => m.available).map((m) => m.id);
const liveImage = (models.image || []).filter((m) => m.available).map((m) => m.id);
console.log("Live image:", liveImage.join(", "));
console.log("Live video:", liveVideo.join(", "));
if (!liveVideo.includes("seedance-2-mini") || liveImage.length < 1 || liveVideo.length < 2) {
  console.log("FAIL expected full live catalog (not Veronix-only)");
  failed++;
} else {
  console.log("OK   full live catalog restored\n");
}

for (const c of CASES) {
  const { status, data } = await quote(c);
  const q = data.quotes?.[0];
  if (status !== 200 || !q) {
    console.log(`FAIL ${c.id}: HTTP ${status} ${data.error || ""}`);
    failed++;
    continue;
  }
  const openArt = q.openArtCredits;
  const listPrice = data.listPriceCredits ?? q.listPriceCredits ?? q.totalCredits;
  const want = expected(openArt);
  const multOk = Number(data.multiplier ?? q.multiplier) === MULTIPLIER;
  const mathOk = Number(listPrice) === want || Number(q.totalCredits) === want;
  const liveOk = q.source === "openart" || q.source === "openart-cache";
  const ok = multOk && mathOk && liveOk && q.available;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${c.id.padEnd(22)} openArt=${String(openArt).padStart(4)} → ${String(want).padStart(4)} source=${q.source}`,
  );
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: remaining=${failed}`);
process.exit(failed === 0 ? 0 : 1);
