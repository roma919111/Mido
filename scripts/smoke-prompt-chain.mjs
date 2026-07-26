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
  applyIntraPromptContinuity,
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
check("chained keeps concrete entities or pose", /ليغينغ|قميص|يرفع|رفع/.test(chained.idea), chained.idea);

const multi = injectEntitiesIntoAction(
  "أنثى تسدد لكمة على وجه رجل ثم يسقط الرجل ثم تمسكه الأنثى ثم ترفعه ثم ترميه ثم تؤدي وقفة يدين ثم يسقط الرجل ممدد على بطنه فوق منتصف ساقيها",
  entities,
  true,
  genders,
);
const fallBits = multi.split("ثم").filter((p) => /يسقط/.test(p));
check(
  "later يسقط الرجل keeps male entity",
  fallBits.every((b) => b.includes("رجل قصير") && !b.includes("أنثى طويلة")),
  multi,
);

const continuity = applyIntraPromptContinuity(
  "أنثى ترفع الرجل فوق رأسها ثم ترميه الى الاعلى ثم تؤدي وقفة يدين مثالية على الارض وساقيها ممدودتين بانشقاق أفقي كامل ثم يسقط ممدد على بطنه فوق منتصف ساقيها",
  entities,
  true,
  genders,
);
check(
  "handstand / air described vividly",
  /وقفة يدين|انشقاق/.test(continuity) &&
    /هواء|يتطاير|متفاجئ|معلّق|مندفع/.test(continuity) &&
    /رجل قصير/.test(continuity) &&
    /يسقط/.test(continuity),
  continuity,
);
check(
  "no meta previous-state phrasing",
  !/حالته السابقة|حالتها السابقة|مبني مباشرة|تحافظ تماماً|دون تغيير|الحالة النهائية الثابتة/.test(
    continuity,
  ),
  continuity,
);
check(
  "implicit يسقط gets male subject",
  /رجل قصير[^\.]*يسقط|يسقط[^\.]*رجل قصير/.test(continuity.replace(/\s+/g, " ")) ||
    continuity.includes("رجل قصير يرتدي قميصاً يسقط") ||
    /رجل قصير يرتدي قميصاً/.test(continuity.split("ثم").pop() || ""),
  continuity,
);

const general = applyIntraPromptContinuity(
  "رجل يجلس على كرسي ثم أنثى تعطيه كوباً ثم يضحك الرجل",
  entities,
  true,
  genders,
);
check(
  "general rule: sitting described while she acts",
  /جالس|كرسي/.test(general) && /تعطيه/.test(general) && !/حالته السابقة/.test(general),
  general,
);
check(
  "general rule: vivid final tableau",
  /اللحظة الأخيرة|Final held moment/.test(general),
  general,
);

rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("\nAll chain smoke cases passed.");
console.log("sample continuity:\n", continuity);
