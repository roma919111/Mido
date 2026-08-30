import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(tmpdir(), `vx-dur-${Date.now()}`);
mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, "vyronix-duration.mjs");
const build = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    path.join(root, "src/lib/vyronix-duration.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
  ],
  { cwd: root, encoding: "utf8" },
);
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(build.status ?? 1);
}

const mod = await import(pathToFileURL(outfile).href);
const { vyronixShotTiming, VYRONIX_MODEL_SHOT_SECONDS } = mod;

if (VYRONIX_MODEL_SHOT_SECONDS !== 15) {
  throw new Error(`expected 15s model shot, got ${VYRONIX_MODEL_SHOT_SECONDS}`);
}

const timing = vyronixShotTiming({ prompt: "a\n\nb", perShotSeconds: 15 });
if (timing.perShotSeconds !== 15 || timing.shotCount !== 2 || timing.totalSeconds !== 30) {
  throw new Error(`bad timing: ${JSON.stringify(timing)}`);
}

console.log("vyronix-duration smoke ok", timing);
rmSync(outDir, { recursive: true, force: true });
