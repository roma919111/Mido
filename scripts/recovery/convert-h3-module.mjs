#!/usr/bin/env node
/** Convert extracted pretty H3Lab turbopack module → H3LabClient.tsx */
import fs from "node:fs";

const srcPath = process.argv[2] || "/tmp/h3lab-pretty.js";
const outPath = process.argv[3] || "/workspace/src/components/veronix/H3LabClient.tsx";

let body = fs.readFileSync(srcPath, "utf8");
body = body.replace(/^841482,\s*e\s*=>\s*\{\s*"use strict";\s*/, "");
body = body.replace(/\}\],\s*841482\)\s*\}\s*$/, "}");
body = body.replace(/\}\],\s*841482\)\s*$/, "");

// Drop turbopack import block (lines var t = e.i...)
body = body.replace(
  /var t = e\.i\(843476\),[\s\S]*?R = e\.i\(954870\);\s*/,
  "",
);

// Module 341658 binding
body = body.replace(/var B = e\.i\(341658\);\s*/, "");
body = body.replace(/var O = e\.i\(726184\);\s*/, "");
body = body.replace(
  /let z = \(0, r\.default\)\(\(\) => e\.A\(327642\)\.then\(e => \(\{\s*default: e\.CreateStudio\s*\}\)\), \{[\s\S]*?\}\),/,
  `const CreateStudioLazy = dynamic(
  () => import("./CreateStudio").then((m) => ({ default: m.CreateStudio })),
  {
    loading: () =>
      jsx("div", {
        className: "flex justify-center py-10",
        children: jsx(Loader2, { className: "h-8 w-8 animate-spin text-[#22f0ff]/80" }),
      }),
  },
);`,
);
body = body.replace(/\(0,\s*t\.jsx\)\(z,/g, "jsx(CreateStudioLazy,");
body = body.replace(
  /\n\s*q = \["16:9"/,
  "\nconst q = [\"16:9\"",
);
body = body.replace(
  /,\s*\n\s*X = "vyronix-rental-aspect";/,
  ";\nconst X = \"vyronix-rental-aspect\";",
);

// Export wrapper
body = body.replace(
  /e\.s\(\["H3LabClient",\s*0,\s*function\s*\(/,
  "export function H3LabClient(",
);

const aliasReplacements = [
  [/\(0,\s*t\.jsx\)/g, "jsx"],
  [/\(0,\s*t\.jsxs\)/g, "jsxs"],
  [/\(0,\s*t\.Fragment\)/g, "Fragment"],
  [/\bt\.jsx\b/g, "jsx"],
  [/\bt\.jsxs\b/g, "jsxs"],
  [/\bt\.Fragment\b/g, "Fragment"],
  [/\(0,\s*r\.default\)/g, "dynamic"],
  [/\ba\.default\b/g, "Link"],
  [/\(0,\s*n\.useState\)/g, "useState"],
  [/\(0,\s*n\.useEffect\)/g, "useEffect"],
  [/\(0,\s*n\.useMemo\)/g, "useMemo"],
  [/\(0,\s*n\.useCallback\)/g, "useCallback"],
  [/\(0,\s*n\.useRef\)/g, "useRef"],
  [/\bn\.useState\b/g, "useState"],
  [/\bn\.useEffect\b/g, "useEffect"],
  [/\bn\.useMemo\b/g, "useMemo"],
  [/\bn\.useCallback\b/g, "useCallback"],
  [/\bn\.useRef\b/g, "useRef"],
  [/\(0,\s*N\.useLocale\)/g, "useLocale"],
  [/\(0,\s*I\.useCustomerUser\)/g, "useCustomerUser"],
  [/\(0,\s*U\.useLinkedCharacters\)/g, "useLinkedCharacters"],
  [/\(0,\s*A\.isAdminUser\)/g, "isAdminUser"],
  [/\(0,\s*C\.loginHref\)/g, "loginHref"],
  [/\(0,\s*k\.fetchJson\)/g, "fetchJson"],
  [/\(0,\s*S\.hasArabic\)/g, "hasArabic"],
  [/\(0,\s*S\.isAcceptableLiteralEnglish\)/g, "isAcceptableLiteralEnglish"],
  [/\(0,\s*_\.normalizeCharacterName\)/g, "normalizeCharacterName"],
  [/\(0,\s*_\.matchNamedCharacters\)/g, "matchNamedCharacters"],
  [/\(0,\s*_\.isCharacterName\)/g, "isCharacterName"],
  [/\(0,\s*_\.orderCharacterRefsForBinding\)/g, "orderCharacterRefsForBinding"],
  [/\(0,\s*_\.buildH3StudioCharacterBundle\)/g, "buildH3StudioCharacterBundle"],
  [/\(0,\s*_\.buildH3Smite79CharacterMemory\)/g, "buildH3Smite79CharacterMemory"],
  [/\(0,\s*_\.stripInternalPromptNotes\)/g, "stripInternalPromptNotes"],
  [/\(0,\s*P\.clearEditDraft\)/g, "clearEditDraft"],
  [/\(0,\s*P\.resolveEditBoot\)/g, "resolveEditBoot"],
  [/\(0,\s*B\.clearH3UiCache\)/g, "clearH3UiCache"],
  [/\(0,\s*B\.clearStoredH3JobId\)/g, "clearStoredH3JobId"],
  [/\(0,\s*B\.storeH3JobId\)/g, "storeH3JobId"],
  [/\(0,\s*B\.readH3UiCache\)/g, "readH3UiCache"],
  [/\(0,\s*B\.writeH3UiCache\)/g, "writeH3UiCache"],
  [/\(0,\s*B\.readStoredH3JobId\)/g, "readStoredH3JobId"],
  [/\(0,\s*B\.hasH3GenerationInFlight\)/g, "hasH3GenerationInFlight"],
  [/\bo\.Loader2\b/g, "Loader2"],
  [/\bd\.Minus\b/g, "Minus"],
  [/\bc\.Plus\b/g, "Plus"],
  [/\bu\.Sparkles\b/g, "Sparkles"],
  [/\bm\.Square\b/g, "Square"],
  [/\bx\.X\b/g, "XIcon"],
  [/\bl\.Languages\b/g, "Languages"],
  [/\bs\.ChevronDown\b/g, "ChevronDown"],
  [/\bi\.ImagePlus\b/g, "ImagePlus"],
  [/\bp\.BrandLogo\b/g, "BrandLogo"],
  [/\bh\.StudioPrepClock\b/g, "StudioPrepClock"],
  [/\bf\.VyronixIdBadge\b/g, "VyronixIdBadge"],
  [/\bb\.DeployStamp\b/g, "DeployStamp"],
  [/\bg\.RentalDigitalClock\b/g, "RentalDigitalClock"],
  [/\bw\.GenerateClock\b/g, "GenerateClock"],
  [/\bv\.AppHeader\b/g, "AppHeader"],
  [/\bj\.BottomNav\b/g, "BottomNav"],
  [/\by\.CharacterLinkBanner\b/g, "CharacterLinkBanner"],
  [/\bR\.VERONIX_DEPLOYED_MODEL_ID\b/g, "VERONIX_DEPLOYED_MODEL_ID"],
  [/\bO\.STUDIO_VIDEO_VARIANT_COUNT\b/g, "STUDIO_VIDEO_VARIANT_COUNT"],
  [/\bO\.STUDIO_RENTAL_PRICE_USD\b/g, "STUDIO_RENTAL_PRICE_USD"],
  [/\bO\.STUDIO_RENTAL_DURATION_HOURS\b/g, "STUDIO_RENTAL_DURATION_HOURS"],
  [/\bO\.STUDIO_RENTAL_PRICING_PATH\b/g, "STUDIO_RENTAL_PRICING_PATH"],
];

for (const [re, rep] of aliasReplacements) {
  body = body.replace(re, rep);
}

const header = `"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronDown,
  ImagePlus,
  Languages,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Square,
  X as XIcon,
} from "lucide-react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { BrandLogo } from "@/components/BrandLogo";
import { CharacterLinkBanner } from "@/components/veronix/CharacterLinkBanner";
import { DeployStamp } from "@/components/veronix/DeployStamp";
import { GenerateClock } from "@/components/veronix/GenerateClock";
import { RentalDigitalClock } from "@/components/veronix/RentalDigitalClock";
import { StudioPrepClock } from "@/components/veronix/StudioPrepClock";
import { VyronixIdBadge } from "@/components/veronix/VyronixIdBadge";
import { loginHref } from "@/lib/auth-next";
import {
  STUDIO_RENTAL_DURATION_HOURS,
  STUDIO_RENTAL_PRICE_USD,
  STUDIO_RENTAL_PRICING_PATH,
  STUDIO_VIDEO_VARIANT_COUNT,
} from "@/lib/ai-rental-studio";
import {
  buildH3Smite79CharacterMemory,
  buildH3StudioCharacterBundle,
  isCharacterName,
  matchNamedCharacters,
  normalizeCharacterName,
  orderCharacterRefsForBinding,
  stripInternalPromptNotes,
} from "@/lib/character-names";
import { clearEditDraft, resolveEditBoot } from "@/lib/edit-draft";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearH3UiCache,
  clearStoredH3JobId,
  hasH3GenerationInFlight,
  readH3UiCache,
  readStoredH3JobId,
  storeH3JobId,
  writeH3UiCache,
} from "@/lib/h3-lab-ui-cache";
import { VERONIX_DEPLOYED_MODEL_ID } from "@/lib/ltx25-deployed";
import {
  readLastOriginalPrompt,
  writeLastOriginalPrompt,
} from "@/lib/last-original-prompt";
import { hasArabic, isAcceptableLiteralEnglish } from "@/lib/prompt-translate";
import { isAdminUser } from "@/lib/admin-shared";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useLinkedCharacters } from "@/hooks/useLinkedCharacters";

`;

fs.writeFileSync(outPath, header + body);
console.log("Wrote", outPath, "bytes", header.length + body.length);
