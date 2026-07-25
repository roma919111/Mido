#!/usr/bin/env node
/**
 * Verify Veronix markup: customer Veronix model quote = OpenArt × 1.8
 * Usage: node scripts/verify-pricing.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const MULTIPLIER = 1.8;

const CASES = [
  {
    id: "seedance-2-mini",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 9,
    generateAudio: true,
    label: "Veronix 9s audio",
  },
  {
    id: "seedance-2-mini",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 5,
    generateAudio: false,
    label: "Veronix 5s",
  },
  {
    id: "seedance-2-mini",
    media: "video",
    mode: "text2video",
    resolution: "720p",
    duration: 9,
    generateAudio: false,
    label: "Veronix 9s",
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
      aspectRatio: "16:9",
      resolution: c.resolution,
      duration: c.duration,
      generateAudio: c.generateAudio,
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

let failed = 0;
console.log(`Verifying Veronix ×${MULTIPLIER} against ${BASE}\n`);

const modelsRes = await fetch(`${BASE}/api/models`);
const models = await modelsRes.json();
const videoIds = (models.video || []).map((m) => m.id);
console.log("Customer models:", videoIds.join(", ") || "(none)");
if (videoIds.length !== 1 || videoIds[0] !== "seedance-2-mini") {
  console.log("FAIL customer catalog must expose Veronix only");
  failed++;
} else {
  console.log("OK   customer catalog = Veronix only\n");
}

for (const c of CASES) {
  const { status, data } = await quote(c);
  const q = data.quotes?.[0];
  if (status !== 200 || !q) {
    console.log(`FAIL ${c.label}: HTTP ${status} ${data.error || ""}`);
    failed++;
    continue;
  }
  const openArt = q.openArtCredits;
  const listPrice = q.listPriceCredits ?? (data.freeTrial ? data.listPriceCredits : q.totalCredits);
  // When anonymous, free trial is false so totalCredits should equal list price.
  const billed = q.totalCredits;
  const want = expected(openArt);
  const mathOk = (data.freeTrial ? listPrice : billed) === want || billed === want || listPrice === want;
  // Prefer checking openArt * 1.8 against listPriceCredits when present
  const checkBase = data.listPriceCredits ?? (data.freeTrial ? null : billed);
  const okMath = checkBase == null ? mathOk : checkBase === want;
  const multOk = Number(data.multiplier ?? q.multiplier) === MULTIPLIER;
  const liveOk = q.source === "openart" || q.source === "openart-cache";
  const ok = multOk && okMath && liveOk && q.available;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${c.label.padEnd(18)} openArt=${String(openArt).padStart(4)} → ×1.8=${String(want).padStart(4)} billed=${billed} list=${data.listPriceCredits ?? "—"} source=${q.source} freeTrial=${Boolean(data.freeTrial)}`,
  );
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: checks remaining=${failed}`);
process.exit(failed === 0 ? 0 : 1);
