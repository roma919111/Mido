import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(tmpdir(), `vx-shots-${Date.now()}`);
mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, "shots.mjs");
const build = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    path.join(root, "src/lib/shot-plan.ts"),
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

const { planShotSequence, shouldAutoMultiShot } = await import(pathToFileURL(outfile).href);

let failed = 0;
function check(name, cond, detail) {
  if (!cond) {
    console.error("FAIL", name, detail || "");
    failed += 1;
  } else console.log("PASS", name);
}

const fight = planShotSequence(
  "أنثى ترفع الرجل فوق رأسها ثم تقذفه عالياً ثم تؤدي وقفة يدين ثم يسقط ممدد على بطنه فوق منتصف ساقيها ثم تلف ساقيها حول خصره",
);
check("fight splits to 5", fight.shotCount === 5, fight);
check("multi enabled", fight.multiShot, fight.reason);

const walk = planShotSequence("رجل يجلس على كرسي ثم أنثى تعطيه كوباً ثم يضحك الرجل");
check("generic sit/give/laugh splits", walk.shotCount === 3, walk);
check("generic not fight-specific", walk.shots.every((s) => !/handstand|وقفة يدين/.test(s.prompt) || s.index !== 0), walk);

const single = planShotSequence("قطة تمشي في الغابة");
check("single stays 1", !single.multiShot && single.shotCount === 1, single);

const forced = planShotSequence("أ ثم ب ثم ج", { forceSingle: true });
check("force single", !forced.multiShot, forced);

check(
  "auto off on free trial",
  !shouldAutoMultiShot(fight, { freeTrial: true, media: "video" }),
);
check(
  "auto on for paid video",
  shouldAutoMultiShot(fight, { freeTrial: false, media: "video" }),
);

// Each shot prompt should be focused (contain its action)
check(
  "shot prompts keep own action",
  fight.shots.every((s) => s.prompt.includes(s.action.slice(0, 12)) || s.action.length < 12),
  fight.shots.map((s) => s.prompt.slice(0, 80)),
);

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll shot-plan smoke cases passed.");
console.log(
  "sample shots:\n",
  fight.shots.map((s, i) => `${i + 1}. ${s.action}`).join("\n"),
);
