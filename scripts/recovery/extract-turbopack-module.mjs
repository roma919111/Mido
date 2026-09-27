#!/usr/bin/env node
/** Extract one Turbopack module body from a downloaded prod chunk (for H3 recovery). */
import fs from "node:fs";

const [chunkPath, moduleId] = process.argv.slice(2);
if (!chunkPath || !moduleId) {
  console.error("Usage: node extract-turbopack-module.mjs <chunk.js> <moduleId>");
  process.exit(1);
}

const src = fs.readFileSync(chunkPath, "utf8");
const needle = `${moduleId},`;
const start = src.indexOf(needle);
if (start < 0) {
  console.error(`Module ${moduleId} not found in ${chunkPath}`);
  process.exit(1);
}

let depth = 0;
let i = start + needle.length;
let started = false;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === "{") {
    depth++;
    started = true;
  } else if (ch === "}") {
    depth--;
    if (started && depth === 0) {
      console.log(src.slice(start, i + 1));
      process.exit(0);
    }
  }
}
console.error("Could not find module end");
process.exit(1);
