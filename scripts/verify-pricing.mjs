#!/usr/bin/env node
/**
 * Static audit: live API models use ×1.55 markup and $1 = 1,000 wallet credits.
 * Usage: node scripts/verify-pricing.mjs
 * Optional live check: node scripts/verify-pricing.mjs http://127.0.0.1:3000
 */

const MARKUP = 1.55;
const CREDIT_USD = 0.001;
const CREDITS_PER_USD = 1_000;

// BytePlus pack
const BYTEPLUS_PACK_USD = 29.4;
const BYTEPLUS_PACK_TOKENS = 14_000_000;
const BYTEPLUS_TOKEN_USD_PER_1K = (BYTEPLUS_PACK_USD / BYTEPLUS_PACK_TOKENS) * 1000;
const BYTEPLUS_FPS = 24;

// PixVerse pack
const PIXVERSE_PACK_USD = 10;
const PIXVERSE_PACK_CREDITS = 2_000;
const PIXVERSE_USD_PER_API_CREDIT = PIXVERSE_PACK_USD / PIXVERSE_PACK_CREDITS;

const DIMS = {
  "480p": { w: 864, h: 480 },
  "720p": { w: 1280, h: 720 },
  "1080p": { w: 1920, h: 1080 },
  "4k": { w: 3840, h: 2160 },
};

const PIXVERSE_API = {
  "360p": { noAudio: 5, withAudio: 7, noAudioVideoRef: 10, withAudioVideoRef: 14 },
  "540p": { noAudio: 7, withAudio: 9, noAudioVideoRef: 14, withAudioVideoRef: 18 },
  "720p": { noAudio: 9, withAudio: 12, noAudioVideoRef: 18, withAudioVideoRef: 24 },
  "1080p": { noAudio: 18, withAudio: 23, noAudioVideoRef: 36, withAudioVideoRef: 46 },
};

const FLUX_T2V = { draft: 0.06, hd: 0.17, fhd: 0.29 };
const FLUX_V2V = { draft: 0.12, hd: 0.43, fhd: 0.54 };
const KLING_720 = { noAudio: 0.1, withAudio: 0.15 };
const MINIMAX_768 = 0.08;
const GEMINI = 0.1;

function ceilCreditsPerSec(costUsdPerSec) {
  return Math.max(1, Math.ceil((costUsdPerSec * MARKUP) / CREDIT_USD));
}

function totalCredits(perSec, duration, count = 1) {
  return Math.max(1, Math.ceil(perSec * duration * count));
}

function bytePlusTokens(duration, res, seedance2 = false) {
  const { w, h } = DIMS[res];
  const base = ((w * h * BYTEPLUS_FPS * duration) / 1024) * 1;
  return seedance2 ? base * 2 : base;
}

function bytePlusPerSec(res, seedance2 = false) {
  const duration = 5;
  const tokens = bytePlusTokens(duration, res, seedance2);
  const cost = (tokens / 1000) * BYTEPLUS_TOKEN_USD_PER_1K;
  const sell = cost * MARKUP;
  const total = Math.max(1, Math.ceil(sell / CREDIT_USD));
  return Math.max(1, Math.ceil(total / duration));
}

function pixversePerSec(quality, audio, vref) {
  const row = PIXVERSE_API[quality];
  const api =
    vref ? (audio ? row.withAudioVideoRef : row.noAudioVideoRef) : audio ? row.withAudio : row.noAudio;
  return ceilCreditsPerSec(api * PIXVERSE_USD_PER_API_CREDIT);
}

function planCredits(usd) {
  return Math.round(usd * CREDITS_PER_USD);
}

const CASES = [
  {
    name: "Wallet: $1 = 1,000 credits",
    check: () => CREDITS_PER_USD === 1_000 && CREDIT_USD === 0.001,
  },
  {
    name: "Plans: $10 = 10,000 credits",
    check: () => planCredits(10) === 10_000 && planCredits(4) === 4_000,
  },
  {
    name: "BytePlus pack rate $0.0021/1K tokens",
    check: () => Math.abs(BYTEPLUS_TOKEN_USD_PER_1K - 0.0021) < 1e-6,
  },
  {
    name: "PixVerse pack $0.005/API credit",
    check: () => PIXVERSE_USD_PER_API_CREDIT === 0.005,
  },
  {
    name: "Seedance Mini 720p (71/s · 5s = 355)",
    expect: () => totalCredits(bytePlusPerSec("720p"), 5),
    want: 355,
  },
  {
    name: "Seedance 2 720p (141/s · 5s = 705)",
    expect: () => totalCredits(bytePlusPerSec("720p", true), 5),
    want: 705,
  },
  {
    name: "Seedance 2 1080p (317/s · 5s = 1585)",
    expect: () => totalCredits(bytePlusPerSec("1080p", true), 5),
    want: 1585,
  },
  {
    name: "Seedance 2 720p + video ref (282/s · 5s = 1410)",
    expect: () => totalCredits(bytePlusPerSec("720p", true) * 2, 5),
    want: 1410,
  },
  {
    name: "PixVerse 720p no audio (70/s · 5s = 350)",
    expect: () => totalCredits(pixversePerSec("720p", false, false), 5),
    want: 350,
  },
  {
    name: "PixVerse 720p audio (93/s · 5s = 465)",
    expect: () => totalCredits(pixversePerSec("720p", true, false), 5),
    want: 465,
  },
  {
    name: "PixVerse 720p fusion (140/s · 5s = 700)",
    expect: () => totalCredits(pixversePerSec("720p", false, true), 5),
    want: 700,
  },
  {
    name: "FLUX HD t2v (264/s · 5s = 1320)",
    expect: () => totalCredits(ceilCreditsPerSec(FLUX_T2V.hd), 5),
    want: 1320,
  },
  {
    name: "FLUX HD v2v (667/s · 5s = 3335)",
    expect: () => totalCredits(ceilCreditsPerSec(FLUX_V2V.hd), 5),
    want: 3335,
  },
  {
    name: "Kling 720p audio (233/s · 5s = 1165)",
    expect: () => totalCredits(ceilCreditsPerSec(KLING_720.withAudio), 5),
    want: 1165,
  },
  {
    name: "MiniMax 768p (125/s · 5s = 625)",
    expect: () => totalCredits(ceilCreditsPerSec(MINIMAX_768), 5),
    want: 625,
  },
  {
    name: "Gemini Omni (156/s · 5s = 780)",
    expect: () => totalCredits(ceilCreditsPerSec(GEMINI), 5),
    want: 780,
  },
  {
    name: "BytePlus image $0.04 × 1.55 = 63 credits",
    expect: () => Math.max(1, Math.ceil((0.04 * MARKUP) / CREDIT_USD)),
    want: 63,
  },
];

let failed = 0;
console.log(`Pricing audit — markup ×${MARKUP}, wallet $1 = ${CREDITS_PER_USD} credits\n`);

for (const c of CASES) {
  const got = c.expect ? c.expect() : c.check() ? c.want ?? true : false;
  const want = c.want ?? true;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${c.name}${c.expect ? ` → got ${got}, want ${want}` : ""}`);
}

const baseUrl = process.argv[2];
if (baseUrl) {
  console.log(`\nLive API check against ${baseUrl}`);
  const LIVE = [
    { id: "seedance-2-mini", media: "video", resolution: "720p", duration: 5 },
    { id: "seedance-2", media: "video", resolution: "1080p", duration: 5 },
    {
      id: "seedance-2",
      media: "video",
      resolution: "720p",
      duration: 5,
      hasVideoReferences: true,
    },
    { id: "pixverse-v6", media: "video", resolution: "720p", duration: 5 },
    {
      id: "pixverse-v6",
      media: "video",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
    },
    { id: "flux-3-video", media: "video", resolution: "HD", duration: 5 },
    { id: "kling-3-omni", media: "video", resolution: "720p", duration: 5, generateAudio: true },
    { id: "minimax-h3", media: "video", resolution: "768p", duration: 5 },
    { id: "vyronix", media: "video", resolution: "768p", duration: 5 },
  ];

  for (const c of LIVE) {
    const expected = CASES.find((x) => x.name.includes(c.id === "seedance-2-mini" ? "Mini 720p" : c.id === "seedance-2" && c.hasVideoReferences ? "video ref" : c.id === "seedance-2" && c.resolution === "1080p" ? "1080p" : c.id === "pixverse-v6" && c.generateAudio ? "audio" : c.id === "pixverse-v6" ? "no audio" : c.id === "flux-3-video" ? "t2v" : c.id === "kling-3-omni" ? "Kling" : c.id === "minimax-h3" || c.id === "vyronix" ? "MiniMax" : ""))?.expect?.();
    try {
      const res = await fetch(`${baseUrl}/api/credits/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelIds: [c.id],
          media: c.media,
          mode: "text2video",
          aspectRatio: "16:9",
          resolution: c.resolution,
          duration: c.duration,
          generateAudio: c.generateAudio,
          hasVideoReferences: c.hasVideoReferences,
        }),
      });
      const data = await res.json();
      const q = data.quotes?.[0];
      const got = q?.totalCredits;
      const mult = Number(q?.multiplier ?? data.multiplier);
      const ok =
        res.status === 200 &&
        q &&
        mult === MARKUP &&
        (expected == null || got === expected);
      if (!ok) failed++;
      console.log(
        `${ok ? "OK  " : "FAIL"} ${c.id} → ${got} credits (×${mult})${expected != null ? ` want ${expected}` : ""}`,
      );
    } catch (e) {
      failed++;
      console.log(`FAIL ${c.id}: ${e.message}`);
    }
  }
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
