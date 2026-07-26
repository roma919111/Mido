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

const { planShotSequence, formatShotScript } = await import(pathToFileURL(outfile).href);

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

// NO ثم — context only (user's real complaint)
const noThum = planShotSequence(
  "أنثى تسدد لكمة احترافية على وجه رجل بالحركة البطيئة بذراع واحدة قبل ان يسقط تمسكه فاقد الوعي أنثى ترفع الرجل عاليًا فوق رأسها في وضعية الرفع العلوي",
);
check("no-ثم context splits >= 2", noThum.shotCount >= 2, noThum);
check(
  "no-ثم has punch and lift beats",
  noThum.shots.some((s) => /تسدد|لكمة/.test(s.action)) &&
    noThum.shots.some((s) => /ترفع|رفع/.test(s.action)),
  noThum.shots.map((s) => s.action),
);

const walk = planShotSequence("رجل يمشي في الشارع يجلس على كرسي يضحك");
check("verb-chain walk/sit/laugh >= 2", walk.shotCount >= 2, walk);

const single = planShotSequence("قطة تمشي في الغابة");
check("single stays 1", !single.multiShot && single.shotCount === 1, single);

const script = formatShotScript(noThum, true);
check("shot script lists لقطة", /لقطة 1/.test(script) && /لقطة 2/.test(script), script);
check("shot script not one dense cinematic blob", !/^مشهد سينمائي واقعي:/.test(script), script);

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll shot-plan smoke cases passed.");
console.log("no-ثم beats:\n", noThum.shots.map((s, i) => `${i + 1}. ${s.action}`).join("\n"));
