import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(tmpdir(), `vx-chain-${Date.now()}`);
mkdirSync(outDir, { recursive: true });

// Bundle chain + enhance (no vision network calls in unit path)
const entry = path.join(outDir, "entry.ts");
writeFileSync(
  entry,
  `
export { buildChainedIdea, injectEntitiesIntoAction, inferFinalPose, buildSceneState, isSequentialAction } from ${JSON.stringify(path.join(root, "src/lib/prompt-chain.ts"))};
`,
);

const outfile = path.join(outDir, "chain.mjs");
const build = spawnSync(
  "npx",
  ["--yes", "esbuild", path.join(root, "src/lib/prompt-chain.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${outfile}`],
  { encoding: "utf8" },
);
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}

const {
  buildChainedIdea,
  injectEntitiesIntoAction,
  inferFinalPose,
  buildSceneState,
  isSequentialAction,
} = await import(pathToFileURL(outfile).href);

let failed = 0;
function check(name, cond, detail) {
  if (!cond) {
    console.error("FAIL", name, detail || "");
    failed += 1;
  } else {
    console.log("PASS", name);
  }
}

const entities = [
  "رجل يرتدي قميصاً أبيض",
  "رجل يرتدي قميصاً أسود",
];

const punched = injectEntitiesIntoAction("رجل يلكم رجلاً آخر", entities, true);
check(
  "entity inject punch",
  punched.includes("قميصاً أبيض") && punched.includes("قميصاً أسود"),
  punched,
);

check("sequential detect", isSequentialAction("ثم يضعه على الأرض"));

const state1 = buildSceneState({
  action: "رجل يرفع رجلاً آخر فوق رأسه",
  enhanced: "x",
  entityPhrases: entities,
});
check(
  "final pose lift",
  /يحمل|مرفوع|فوق رأس/.test(state1.finalPose),
  state1.finalPose,
);

const chained = buildChainedIdea({
  action: "ثم يضعه على الأرض",
  previous: state1,
  entityPhrases: entities,
});
check("chained flag", chained.chained);
check(
  "chained mentions previous pose",
  /الحالة النهائية|بدءاً من/.test(chained.idea) && /أرض/.test(chained.idea),
  chained.idea,
);

const fresh = buildChainedIdea({
  action: "رجل يمشي في الشارع",
  previous: state1,
  entityPhrases: entities,
});
check("no chain without ثم", !fresh.chained, fresh.idea);

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll chain smoke cases passed.");
console.log("infer:", inferFinalPose("رجل يلكم رجلاً آخر", true));
