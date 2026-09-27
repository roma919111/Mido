#!/usr/bin/env node
/** Download Turbopack chunks referenced by vyronix.app/ai-rental-studio (H3 recovery). */
import fs from "node:fs";
import path from "node:path";

const ORIGIN = process.env.VYRONIX_ORIGIN || "https://vyronix.app";
const OUT = path.join(process.cwd(), "scripts/recovery");

const DEFAULT_CHUNKS = [
  "0w1yk8ho8r259.js",
  "1lcxpy-z8g7a5.js",
  "3j9nqkqpw9js9.js",
  "23ph7e0oflam3.js",
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const html = await fetch(`${ORIGIN}/ai-rental-studio`).then((r) => r.text());
  const fromHtml = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) =>
    m[0].replace("/_next/static/chunks/", ""),
  );
  const names = [...new Set([...DEFAULT_CHUNKS, ...fromHtml])];
  for (const name of names) {
    const url = `${ORIGIN}/_next/static/chunks/${name}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("skip", name, res.status);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log("saved", name, buf.length);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
