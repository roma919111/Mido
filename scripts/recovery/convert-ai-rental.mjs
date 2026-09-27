#!/usr/bin/env node
import fs from "node:fs";

const srcPath = process.argv[2] || "/tmp/ai-rental-pretty.js";
const outPath = process.argv[3] || "/workspace/src/components/veronix/AiRentalStudioClient.tsx";

let body = fs.readFileSync(srcPath, "utf8");
body = body.replace(/^278184,\s*e\s*=>\s*\{\s*"use strict";\s*/, "");
body = body.replace(/\}\],\s*278184\)\s*\}\s*$/, "");
body = body.replace(
  /var t = e\.i\(843476\),[\s\S]*?b = e\.i\(142771\);\s*/,
  "",
);
body = body.replace(
  /e\.s\(\["H3VastLabPage",\s*0,\s*function\s*\(/,
  "export default function AiRentalStudioClient(",
);

const reps = [
  [/\(0,\s*t\.jsx\)/g, "jsx"],
  [/\(0,\s*t\.jsxs\)/g, "jsxs"],
  [/\(0,\s*t\.Fragment\)/g, "Fragment"],
  [/\bt\.jsx\b/g, "jsx"],
  [/\bt\.jsxs\b/g, "jsxs"],
  [/\bt\.Fragment\b/g, "Fragment"],
  [/\(0,\s*i\.default\)/g, "Link"],
  [/\bi\.default\b/g, "Link"],
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
  [/\(0,\s*r\.useRouter\)/g, "useRouter"],
  [/\(0,\s*r\.useSearchParams\)/g, "useSearchParams"],
  [/\(0,\s*d\.useLocale\)/g, "useLocale"],
  [/\(0,\s*c\.useCustomerUser\)/g, "useCustomerUser"],
  [/\(0,\s*g\.isAdminUser\)/g, "isAdminUser"],
  [/\(0,\s*b\.fetchJson\)/g, "fetchJson"],
  [/\(0,\s*o\.remainingMsUntil\)/g, "remainingMsUntil"],
  [/\(0,\s*l\.readH3RentalCache\)/g, "readH3RentalCache"],
  [/\(0,\s*l\.writeH3RentalCache\)/g, "writeH3RentalCache"],
  [/\(0,\s*l\.clearH3RentalCache\)/g, "clearH3RentalCache"],
  [/\(0,\s*l\.readRentalClockAnchor\)/g, "readRentalClockAnchor"],
  [/\(0,\s*l\.resolveStableRentalClock\)/g, "resolveStableRentalClock"],
  [/\(0,\s*m\.loginHref\)/g, "loginHref"],
  [/\ba\.Loader2\b/g, "Loader2"],
  [/\bs\.RefreshCw\b/g, "RefreshCw"],
  [/\bx\.Link2\b/g, "Link2"],
  [/\bp\.VyronixIdBadge\b/g, "VyronixIdBadge"],
  [/\(0,\s*f\.H3LabClient\)/g, "H3LabClient"],
  [/\bf\.H3LabClient\b/g, "H3LabClient"],
  [/\bu\.AI_RENTAL_STUDIO_PATH\b/g, "AI_RENTAL_STUDIO_PATH"],
  [/\bu\.STUDIO_RENTAL_PRICING_PATH\b/g, "STUDIO_RENTAL_PRICING_PATH"],
  [/\bu\.STUDIO_RENTAL_PRICE_USD\b/g, "STUDIO_RENTAL_PRICE_USD"],
  [/\bu\.VAST_H3_ESTIMATED_COST_PER_HOUR_USD\b/g, "VAST_H3_ESTIMATED_COST_PER_HOUR_USD"],
];

for (const [re, rep] of reps) body = body.replace(re, rep);

const header = `"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { H3LabClient } from "@/components/veronix/H3LabClient";
import { VyronixIdBadge } from "@/components/veronix/VyronixIdBadge";
import { useLocale } from "@/components/veronix/LocaleProvider";
import {
  AI_RENTAL_STUDIO_PATH,
  STUDIO_RENTAL_PRICE_USD,
  STUDIO_RENTAL_PRICING_PATH,
  VAST_H3_ESTIMATED_COST_PER_HOUR_USD,
} from "@/lib/ai-rental-studio";
import { isAdminUser } from "@/lib/admin-shared";
import { loginHref } from "@/lib/auth-next";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearH3RentalCache,
  readH3RentalCache,
  readRentalClockAnchor,
  remainingMsUntil,
  resolveStableRentalClock,
  writeH3RentalCache,
} from "@/lib/h3-rental-cache";
import { useCustomerUser } from "@/hooks/useCustomerUser";

`;

fs.writeFileSync(outPath, header + body);
console.log("Wrote", outPath);
