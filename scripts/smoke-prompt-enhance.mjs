import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(tmpdir(), `vx-enhance-${Date.now()}`);
mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, "prompt-enhance.mjs");

const build = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    path.join(root, "src/lib/prompt-enhance.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
  ],
  { encoding: "utf8" },
);
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}

const { enhancePrompt, analyzeScene } = await import(pathToFileURL(outfile).href);

const cases = [
  { prompt: "رجل يتمشي", mode: "text-to-video" },
  { prompt: "رجل يركض في الصحراء", mode: "text-to-video" },
  { prompt: "امرأة ترقص تحت المطر", mode: "text-to-video" },
  { prompt: "a man walking", mode: "text-to-video" },
  { prompt: "a man walking on the beach", mode: "text-to-video" },
];

let failed = 0;
for (const c of cases) {
  const analysis = analyzeScene(c.prompt);
  const out = enhancePrompt(c.prompt, c.mode);
  const needsSecondary = /يتمش|يمشي|walking|يركض|runn/i.test(c.prompt);
  const okSecondary =
    !needsSecondary ||
    /شعر|hair|يتطاير|drifting|lifting|ملابس|clothes|clothing|غبار|dust/i.test(out);
  const longer = out.length > c.prompt.length + 40;
  const keepsIdea =
    out.includes(c.prompt) || out.toLowerCase().includes(c.prompt.toLowerCase());
  console.log("\nIN:", c.prompt);
  console.log(
    "ACTION:",
    analysis.actionKey,
    "MOTION:",
    analysis.motion,
    "SETTING:",
    analysis.settingKey,
  );
  console.log("OUT:", out);
  if (!okSecondary || !longer || !keepsIdea) {
    console.error("FAIL", { okSecondary, longer, keepsIdea });
    failed += 1;
  } else {
    console.log("PASS");
  }
}

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll smoke cases passed.");
