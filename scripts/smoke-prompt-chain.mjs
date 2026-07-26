import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(tmpdir(), `vx-chain-${Date.now()}`);
mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, "chain.mjs");
const build = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    path.join(root, "src/lib/prompt-chain.ts"),
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

const {
  buildChainedIdea,
  injectEntitiesIntoAction,
  buildSceneState,
  isSequentialAction,
} = await import(pathToFileURL(outfile).href);

let failed = 0;
function check(name, cond, detail) {
  if (!cond) {
    console.error("FAIL", name, detail || "");
    failed += 1;
  } else console.log("PASS", name);
}

const entities = ["أنثى طويلة ترتدي ليغينغ تايغر", "رجل قصير يرتدي قميصاً"];
const genders = ["female", "male"];

const punched = injectEntitiesIntoAction(
  "الأنثى ترفع الرجل وترميه عالياً",
  entities,
  true,
  genders,
);
check(
  "replace الأنثى/الرجل with concrete phrases",
  punched.includes("ليغينغ تايغر") &&
    punched.includes("قميصاً") &&
    !punched.includes("الأنثى") &&
    !/الالال|الصورة المرجعية/.test(punched),
  punched,
);

const noMangle = injectEntitiesIntoAction(
  "الانثى ترفع الرجل",
  ["أنثى طويلة ترتدي ليغينغ تايغر", "رجل قصير يرتدي قميصاً"],
  true,
  genders,
);
check("no arabic corruption", !/الالالشخصية|ألوانهاية/.test(noMangle), noMangle);

check("sequential detect", isSequentialAction("ثم يضعه على الأرض"));

const state1 = buildSceneState({
  action: "الأنثى ترفع الرجل فوق رأسها",
  enhanced: "x",
  entityPhrases: entities,
  entityGenders: genders,
});
const chained = buildChainedIdea({
  action: "ثم تضعه على الأرض",
  previous: state1,
  entityPhrases: entities,
  entityGenders: genders,
});
check("chained flag", chained.chained);
check("chained keeps concrete entities or pose", /الحالة النهائية|ليغينغ|قميص/.test(chained.idea), chained.idea);

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll chain smoke cases passed.");
console.log("sample:", punched);
