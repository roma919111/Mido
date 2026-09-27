// @ts-nocheck
"use client";

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

function M(e) {
        let t = e.trim();
        if (!t) return "";
        if (t.startsWith("/generations/")) {
            let e = new URLSearchParams({
                local: t,
                type: "video"
            });
            return `/api/media/stream?${e.toString()}`
        }
        return function(e) {
            let t = e.trim();
            if (!t) return null;
            try {
                let e = new URL(t);
                if ("https:" !== e.protocol) return null;
                let r = e.hostname.toLowerCase();
                if ("minimaxai-minimax-h3-turbo-lora.hf.space" !== r && !r.endsWith(".hf.space") && "cdn-media.huggingface.co" !== r) return null;
                let a = new URLSearchParams({
                    u: function(e) {
                        let t = new TextEncoder().encode(e),
                            r = "";
                        for (let e = 0; e < t.length; e += 1) r += String.fromCharCode(t[e]);
                        return btoa(r).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
                    }(e.toString())
                });
                return `/api/space/stream?${a.toString()}`
            } catch {
                return null
            }
        }(t) || t
    }

    function $(e) {
        let t = Number(e);
        return Number.isFinite(t) ? Math.min(1, Math.max(.1, .01 * Math.round(t / .01))) : .65
    }
    let L = [.5, .65, 1];

    function G(e) {
        return Math.max(1, e.replace(/\r\n/g, "\n").replace(/\n+$/g, "").trim().split(/\n\s*\n+/).map(e => e.trim()).filter(Boolean).length)
    }
    let T = /^\s*seconds\s*:/im;

    function D(e) {
        return T.test(e)
    }

    function E(e, t) {
        var r, a;
        let n, s, i = e.replace(/\r\n/g, "\n").replace(/\n+$/g, "").trim(),
            l = Math.min(8, Math.max(1, t?.paragraphCount ?? G(i))),
            o = (r = i.split(/\n\s*\n+/).map(e => e.trim()).filter(Boolean).slice(0, l), a = {
                skipSceneAnchor: t?.skipSceneAnchor,
                skipSecondsHint: t?.skipSecondsHint
            }, n = Math.min(15, Math.max(1, Math.round(15))), 1 === (s = a?.skipSecondsHint ? r.map(e => e.trim()).filter(Boolean) : r.map(e => D(e) ? e : `${e}
seconds: ${n}`)).length ? s[0] : a?.skipSceneAnchor ? s.join("\n\n") : `Consistent scene, characters, lighting, and camera style throughout.

${s.join("\n\n")}`),
            d = Math.round(15 * l * 10) / 10;
        return {
            targetTotalSeconds: d,
            promptForRunpod: o,
            perShotSeconds: 0,
            beatCount: l,
            expectedTotalSeconds: d,
            expandedBeats: !1
        }
    }
    function H(e) {
        let t = e.toLowerCase();
        return "gpu_required" === e || "studio_rental_required" === e || "studio_rental_expired" === e || "studio_rental_provisioning" === e || "vyronix_id_link_required" === e || "studio_gpu_failover" === e || t.includes("gpu") || t.includes("cloudflare") || t.includes("r2") || t.includes("sync") || t.includes("pod failed") || t.includes("h3 pod") || t.includes("econnrefused") || t.includes("failed to connect") || t.includes("couldn't connect") || t.includes("network error") || t.includes("fetch failed") || t.includes("30–60") || t.includes("30-60") || t.includes("loading") && t.includes("weight")
    }

    function F(e, t, r = !1) {
        if (!e?.trim()) return t ? "جاري التوليد…" : "Generating…";
        let a = e.toLowerCase();
        return r && H(e) ? t ? "جاري التجهيز…" : "Preparing…" : a.includes("saving video") ? t ? "حفظ الفيديو…" : "Saving video…" : !r && a.includes("in gpu queue") ? t ? "في الطابور — انتظر…" : "In queue — please wait…" : !r && (a.includes("retry") || a.includes("network error")) ? t ? "جاري المحاولة…" : "Retrying…" : e
    }

    function J(e, t, r = !1) {
        if (!e?.trim()) return t ? "فشل التوليد" : "Generation failed";
        if ("job_stale" === e) return t ? "انقطع التوليد — حدّث الصفحة وحاول مرة ثانية" : "Generation interrupted — refresh and try again";
        if (r) {
            if ("studio_rental_expired" === e) return t ? `انتهت ساعتَا التأجير — ادفع $${STUDIO_RENTAL_PRICE_USD} لتأجير جديد` : `Your ${STUDIO_RENTAL_DURATION_HOURS}-hour rental ended — pay $${STUDIO_RENTAL_PRICE_USD} to rent again`;
            if ("studio_rental_provisioning" === e || "gpu_booting" === e) return t ? "GPU يحمّل النماذج — وقت التجهيز مجاني. انتظر حتى «الاستوديو جاهز» (≈20–30 د أول مرة)" : "GPU loading models — prep is free. Wait for «Studio ready» (≈20–30 min first boot)";
            if ("studio_gpu_failover" === e) return t ? "السيرفر الحالي مشغول — جاري الانتقال لسيرفر بديل. انتظر قليلاً — الوقت لا يُخصم من تأجيرك" : "Current server busy — switching hosts. Please wait — rental time is not deducted";
            if ("studio_rental_required" === e) return t ? `تحتاج تأجير ${STUDIO_RENTAL_DURATION_HOURS} ساعة — ادفع $${STUDIO_RENTAL_PRICE_USD} للبدء` : `Rent ${STUDIO_RENTAL_DURATION_HOURS} hours ($${STUDIO_RENTAL_PRICE_USD}) to rent`;
            if ("vyronix_id_link_required" === e) return t ? "أدخل فيرونيكس ID أعلاه واضغط ربط قبل التوليد" : "Enter your Vyronix ID above and link before generating";
            if ("character_refs_unavailable" === e) return t ? "تعذّر تحميل صور الشخصيات — أعد اختيار الصور وحاول مرة أخرى" : "Could not load character images — re-select photos and try again";
            if ("gpu_required" === e) return t ? "GPU غير متصل — حدّث الصفحة" : "GPU not connected — refresh the page";
            if ("gpu_offline" === e) return t ? "توقف GPU عن التوليد — اضغط «إيقاف» ثم Generate من جديد" : "GPU stopped generating — press Stop, then Generate again";
            if (H(e)) return t ? "GPU غير جاهز بعد — انتظر دقيقتين ثم حاول" : "GPU not ready yet — wait a couple of minutes and retry"
        }
        if (H(e)) return t ? "GPU غير متصل — حدّث الصفحة" : "GPU not connected — refresh the page";
        let a = e.toLowerCase();
        return a.includes("out of memory") || a.includes("oom") ? t ? "الذاكرة ممتلئة — جرّب دارافت أو وصفاً أقصر" : "Out of memory — try Draft mode or a shorter prompt" : a.includes("timed out") || a.includes("timeout") ? t ? "انتهت مهلة التوليد — جرّب مدة أقصر أو كرّر المحاولة" : "Generation timed out — try a shorter duration or retry" : e
    }
    let V = {
        fast: {
            megapixels: .5,
            steps: 6,
            duration: 5,
            labelAr: "فاست",
            labelEn: "Fast",
            hintAr: "6 خطوات · وضوح 0.5 MP",
            hintEn: "6 steps · 0.5 MP clarity"
        },
        standard: {
            megapixels: .65,
            steps: 8,
            duration: 5,
            labelAr: "ستاندرد",
            labelEn: "Standard",
            hintAr: "8 خطوات · وضوح 0.65 MP",
            hintEn: "8 steps · 0.65 MP clarity"
        },
        full: {
            megapixels: 1,
            steps: 28,
            duration: 8,
            labelAr: "فول",
            labelEn: "Full",
            hintAr: "28 خطوة · وضوح 1 MP",
            hintEn: "28 steps · 1 MP clarity"
        }
    };
    function W({
        value: e,
        onChange: r,
        ltxAvailable: a = !0,
        vyronixAvailable: n = !0,
        spaceBackendLabel: s = "HF Turbo",
        ar: i = !1
    }) {
        let l = `VYRONIX Fast \xb7 ${s}`;
        return jsxs("div", {
            className: "rounded-2xl border border-[#22f0ff]/35 bg-[#141821] p-3 sm:p-4",
            children: [jsxs("label", {
                className: "block",
                children: [jsx("span", {
                    className: "text-xs font-bold uppercase tracking-[0.2em] text-[#22f0ff]",
                    children: i ? "موديل الفيديو" : "Video model"
                }), jsxs("select", {
                    value: e,
                    onChange: e => r(e.target.value),
                    className: "mt-2 w-full rounded-xl border border-white/12 bg-[#0f1218] px-3 py-3 text-sm font-semibold text-white outline-none ring-[#22f0ff]/40 focus:ring-2",
                    children: [jsx("option", {
                        value: "ltx",
                        disabled: !a,
                        children: "LTX · HF Space (multi-subject)"
                    }), jsx("option", {
                        value: "vyronix",
                        disabled: !n,
                        children: l
                    })]
                })]
            }), jsx("p", {
                className: "mt-2 text-[11px] leading-relaxed text-white/45",
                children: "ltx" === e ? i ? "مخرجات LTX فقط: دقة Space · مدة 1–8 ث · subjects · Scene image" : "LTX outputs only: Space resolution · 1–8s · subjects · scene image" : i ? "مخرجات VYRONIX GPU فقط: شخصيات · إطارات · مدة · Generate — كما كان" : "VYRONIX GPU outputs only: characters · frames · duration · Generate — unchanged"
            })]
        })
    }
    const CreateStudioLazy = dynamic(
  () => import("./CreateStudio").then((m) => ({ default: m.CreateStudio })),
  {
    loading: () =>
      jsx("div", {
        className: "flex justify-center py-10",
        children: jsx(Loader2, { className: "h-8 w-8 animate-spin text-[#22f0ff]/80" }),
      }),
  },
);
const q = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9", "9:21"];
const X = "vyronix-rental-aspect";

    function Y(e) {
        let t = e.playbackUrl?.trim();
        if (t) return t.startsWith("/api/media/stream") || t.startsWith("/api/space/stream") ? t : M(t);
        let r = e.resultUrl?.trim();
        return r ? M(r) : ""
    }
    async function K(e) {
        let t = new FormData;
        t.append("file", e);
        let {
            res: r,
            data: a
        } = await fetchJson("/api/h3-lab/upload", {
            method: "POST",
            credentials: "include",
            body: t
        });
        if (!r.ok || !a?.path) throw Error("string" == typeof a?.error ? a.error : "Upload failed");
        return a.path
    }

    function Q({
        elapsedMs: e,
        elapsedSec: r,
        active: a
    }) {
        let s, i, l, [o, d] = useState(0);
        useEffect(() => {
            if (!a) return;
            let e = window.setInterval(() => d(e => e + 1), 40);
            return () => window.clearInterval(e)
        }, [a]);
        let c = r % 60 * 6;
        return jsxs("div", {
            className: "flex flex-col items-center gap-3 py-1",
            children: [jsx("div", {
                className: "relative",
                children: jsxs("svg", {
                    viewBox: "0 0 100 100",
                    className: "h-[5.5rem] w-[5.5rem] drop-shadow-[0_0_18px_rgba(34,240,255,0.35)]",
                    "aria-hidden": !0,
                    children: [jsx("circle", {
                        cx: "50",
                        cy: "50",
                        r: "46",
                        fill: "#0d1118",
                        stroke: "rgba(34,240,255,0.35)",
                        strokeWidth: "2"
                    }), Array.from({
                        length: 12
                    }).map((e, r) => {
                        let a = 30 * r * Math.PI / 180,
                            n = 50 + 38 * Math.sin(a),
                            s = 50 - 38 * Math.cos(a),
                            i = 50 + 44 * Math.sin(a),
                            l = 50 - 44 * Math.cos(a);
                        return jsx("line", {
                            x1: n,
                            y1: s,
                            x2: i,
                            y2: l,
                            stroke: "rgba(255,255,255,0.35)",
                            strokeWidth: r % 3 == 0 ? 2 : 1,
                            strokeLinecap: "round"
                        }, r)
                    }), jsx("line", {
                        x1: "50",
                        y1: "50",
                        x2: "50",
                        y2: "30",
                        stroke: "rgba(255,255,255,0.55)",
                        strokeWidth: "2.5",
                        strokeLinecap: "round",
                        transform: `rotate(${r%3600/3600*360+c/12} 50 50)`
                    }), jsx("line", {
                        x1: "50",
                        y1: "50",
                        x2: "50",
                        y2: "22",
                        stroke: "#7c5cff",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        transform: `rotate(${c} 50 50)`
                    }), jsx("line", {
                        x1: "50",
                        y1: "50",
                        x2: "50",
                        y2: "16",
                        stroke: "#22f0ff",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                        transform: `rotate(${24*o%360} 50 50)`
                    }), jsx("circle", {
                        cx: "50",
                        cy: "50",
                        r: "3.5",
                        fill: "#22f0ff"
                    })]
                })
            }), jsx("span", {
                className: "font-mono text-2xl font-bold tabular-nums tracking-wider text-[#22f0ff]",
                children: (i = Math.floor((s = Math.floor(e / 1e3)) / 60), l = Math.floor(e % 1e3 / 100), `${i}:${String(s%60).padStart(2,"0")}.${l}`)
            })]
        })
    }
    export function H3LabClient({
        returnPath: e = "/h3-lab",
        extraSection: r,
        topSection: M,
        linkSection: T,
        hideHeroCard: H = !1,
        hideFloatingResultCard: Z = !1,
        gpuOnly: ee = !1,
        rentalEndsAt: et,
        rentalStartedAt: er,
        paidHourActive: ea = !1,
        rentalGpuFailover: en = !1,
        rentalFrozen: es = !1,
        rentalPodReady: ei = !1,
        rentalCanGenerate: el = !1,
        rentalVyronixId: eo,
        rentalPrepStartedAt: ed,
        needsVyronixLink: ec = !1,
        studioUnlocked: eu = !1,
        guestStudioPreview: em = !1
    }) {
        let {
            locale: ex,
            dir: ep,
            t: eh
        } = useLocale(), ef = "ar" === ex, {
            user: eb,
            logout: eg,
            ready: ew,
            refreshing: ev,
            refreshUser: ej
        } = useCustomerUser(), [ey, eN] = useState(() => {
            if (typeof window === "undefined") return "ltx";
            return "vyronix" === new URLSearchParams(window.location.search).get("engine") ? "vyronix" : "ltx";
        }), ek = useRef(!1), [eS, eA] = useState(null), [eI, eU] = useState(!1), [eC, eP] = useState(""), [e_, eR] = useState(""), [eM, e$] = useState([]), [eL, eG] = useState(() => {
            if (!ee || typeof sessionStorage === "undefined") return "9:16";
            let e = sessionStorage.getItem(X)?.trim();
            return e && q.includes(e) ? e : "9:16"
        }), [eT, eD] = useState(ee), eE = eT ? 120 : 15, eO = ee ? V.standard.duration : 15, [eH, eF] = useState(eO), [eJ, eV] = useState(.65), [eB, eW] = useState(!1), [ez, eq] = useState("standard"), [eX, eY] = useState(42), [eK, eQ] = useState("larry"), [eZ, e0] = useState(!1), [e1, e2] = useState(null), [e5, e3] = useState(null), [e4, e6] = useState(null), [e8, e7] = useState(""), [e9, te] = useState(""), [tt, tr] = useState(""), [ta, tn] = useState(""), [ts, ti] = useState(null), [tl, to] = useState([]), [td, tc] = useState(0), [tu, tm] = useState(1), [tx, tp] = useState(""), [th, tf] = useState(!1), [tb, tg] = useState(null), [tw, tv] = useState(""), [tj, ty] = useState(!1), [tN, tk] = useState(!1), [tS, tA] = useState(!1), [tI, tU] = useState(0), tC = useRef(null), tP = useRef(null), t_ = useRef(!1), tR = useRef(!1), tM = useRef(0), t$ = useRef(null), tL = useRef(new Map), tG = useRef(new Map), tT = useRef(!1), tD = useMemo(() => eM.map(e => e.name), [eM]), tE = useMemo(() => eM.map(e => ({
            type: "image",
            id: e.id,
            url: e.preview,
            label: e.name
        })), [eM]), {
            linkedCharacters: tO,
            linkedIds: tH
        } = useLinkedCharacters(eC, tE, tD), tF = isAdminUser(eb), lastOriginalPromptRef = useRef(readLastOriginalPrompt()), tJ = useMemo(() => eM.filter(e => isCharacterName(e.name)), [eM]), tV = useCallback(e => {
            let t = normalizeCharacterName(e);
            t && eP(e => {
                let r = e.trim();
                return r ? matchNamedCharacters(r, [{
                    id: "probe",
                    type: "image",
                    url: "",
                    label: t
                }]).length > 0 ? e : `${r} ${t}` : t
            })
        }, []), tB = useCallback(e => {
            let t = e ?? Date.now();
            tU(Math.max(0, Date.now() - t)), tC.current && window.clearInterval(tC.current), tC.current = window.setInterval(() => tU(Math.max(0, Date.now() - t)), 100)
        }, []), tW = useCallback(() => {
            tC.current && (window.clearInterval(tC.current), tC.current = null)
        }, []), tz = useCallback(() => {
            tL.current.forEach(e => window.clearTimeout(e)), tL.current.clear(), tG.current.clear()
        }, []), tq = useCallback(() => {
            t_.current = !1, t$.current = null, tz(), null !== tP.current && (window.clearTimeout(tP.current), tP.current = null)
        }, [tz]), tX = useCallback(() => {
            tq(), tW(), e7(""), e6(null), ty(!1), tR.current = !1, t$.current = null, tM.current = 0, clearStoredH3JobId()
        }, [tq, tW]), tY = useCallback(e => {
            if (!e.every(e => "complete" === e.status || "error" === e.status)) return;
            tq(), tW(), ty(!1), tR.current = !1;
            let t = e.filter(e => "complete" === e.status && e.videoUrl);
            t.length > 0 && (ti(t[0].videoUrl), tc(t[0].index));
            let r = e.filter(e => "error" === e.status).length;
            r === e.length ? tp(ef ? "فشل توليد كل الخيارات — جرّب مرة أخرى" : "All variants failed — try again") : r > 0 && te(ef ? `${t.length} من ${e.length} جاهزة — بعض الخيارات فشلت` : `${t.length} of ${e.length} ready — some variants failed`)
        }, [ef, tq, tW]), tK = useCallback((e, t) => {
            e6(e), ty(!0), tp(""), t_.current = !0, t$.current = e, tM.current = 0, storeH3JobId(e), tB(t), t0.current(e)
        }, [tB]), tQ = Math.floor(tI / 1e3), tZ = e => 404 === e.status || 401 === e.status || 503 === e.status, t0 = useRef(async () => {}), t1 = useCallback(async (e, t) => {
            if (tM.current += 1, e7(ef ? "جاري متابعة التوليد…" : "Still generating…"), tM.current >= 12) {
                tX(), tp(ef ? "توقف التتبع — جرّب توليد جديد" : "Tracking stopped — try again");
                return
            }
            if (tZ(t)) {
                tP.current = window.setTimeout(() => {
                    t0.current(e)
                }, 5e3);
                return
            }
            tp(ef ? "فشل التحقق من الحالة" : "Status check failed"), tX()
        }, [ef, tX]), t2 = useCallback(e => {
            if (e7(F(e.progress, ef, ee)), "complete" === e.status) {
                if (te(e.info || ""), tr(e.submittedPrompt || ""), tn(e.originalPrompt || ""), e.planOnly) ti(null);
                else {
                    let t = Y(e);
                    t && ti(t)
                }
                return tX(), "complete"
            }
            return "error" === e.status ? ("job_stale" === e.error && clearStoredH3JobId(), tp(J(e.error, ef, ee)), tX(), "error") : !1 === e.gpuLive ? (tp(J("gpu_offline", ef, ee)), tX(), "error") : "active"
        }, [ef, ee, tX]), t5 = useCallback(async e => {
            let t, r;
            if (t_.current) {
                try {
                    ({
                        res: t,
                        data: r
                    } = await fetchJson(`/api/h3-lab/status?jobId=${encodeURIComponent(e)}${ee?"&gpu_only=1":""}`, {
                        credentials: "include"
                    }))
                } catch {
                    if (!t_.current) return;
                    tP.current = window.setTimeout(() => {
                        t5(e)
                    }, 5e3);
                    return
                }
                if (t_.current) {
                    if (!t.ok || !r) return tZ(t) ? void await t1(e, t) : (tp(ef ? "فشل التحقق من الحالة" : "Status check failed"), void tX());
                    tM.current = 0, "active" === t2(r) && (tP.current = window.setTimeout(() => {
                        t5(e)
                    }, 3500))
                }
            }
        }, [ef, t2, t1, tX]);
        t0.current = t5;
        let t3 = useRef(async () => {}),
            t4 = useCallback(async (e, t) => {
                let r, a;
                if (!t_.current) return;
                try {
                    ({
                        res: r,
                        data: a
                    } = await fetchJson(`/api/h3-lab/status?jobId=${encodeURIComponent(t)}&gpu_only=1`, {
                        credentials: "include"
                    }))
                } catch {
                    if (!t_.current) return;
                    let r = window.setTimeout(() => {
                        t3.current(e, t)
                    }, 5e3);
                    tL.current.set(t, r);
                    return
                }
                if (!t_.current) return;
                if (!r.ok || !a) {
                    if (tZ(r)) {
                        if (tM.current += 1, tM.current >= 12) return void to(t => {
                            let r = t.map(t => t.index === e ? {
                                ...t,
                                status: "error",
                                error: ef ? "توقف التتبع" : "Tracking stopped"
                            } : t);
                            return tY(r), r
                        });
                        let r = window.setTimeout(() => {
                            t3.current(e, t)
                        }, 5e3);
                        return void tL.current.set(t, r)
                    }
                    return void to(t => {
                        let r = t.map(t => t.index === e ? {
                            ...t,
                            status: "error",
                            error: ef ? "فشل التحقق من الحالة" : "Status check failed"
                        } : t);
                        return tY(r), r
                    })
                }
                if (tM.current = 0, !1 === a.gpuLive) {
                    let t = J("gpu_offline", ef, ee);
                    tp(t), to(r => {
                        let a = r.map(r => r.index === e ? {
                            ...r,
                            status: "error",
                            error: t
                        } : r);
                        return tY(a), a
                    });
                    return
                }
                if ("complete" === a.status) {
                    a.submittedPrompt?.trim() && tr(a.submittedPrompt.trim()), a.originalPrompt?.trim() ? tn(a.originalPrompt.trim()) : eC.trim() && tn(eC.trim()), a.info?.trim() && te(a.info.trim());
                    let t = a.planOnly ? "" : Y(a);
                    to(r => {
                        let a = r.map(r => r.index === e ? {
                                ...r,
                                status: "complete",
                                videoUrl: t || void 0,
                                progress: void 0
                            } : r),
                            n = a.find(e => "complete" === e.status && e.videoUrl);
                        n?.videoUrl && (ti(e => e || n.videoUrl), tc(e => a.some(t => t.index === e && t.videoUrl) ? e : n.index));
                        let s = a.filter(e => "complete" === e.status || "error" === e.status).length;
                        return te(ef ? `${s}/${a.length} جاهزة — يمكنك مشاهدة أي فيديو اكتمل` : `${s}/${a.length} ready — watch any finished video`), tY(a), a
                    });
                    return
                }
                if ("error" === a.status) return void to(t => {
                    let r = t.map(t => t.index === e ? {
                        ...t,
                        status: "error",
                        error: J(a.error, ef, ee)
                    } : t);
                    return tY(r), r
                });
                let n = F(a.progress, ef, ee);
                e7(ef ? `خيار ${e+1}/${STUDIO_VIDEO_VARIANT_COUNT} — ${n||"جاري التوليد…"}` : `Option ${e+1}/${STUDIO_VIDEO_VARIANT_COUNT} — ${n||"Generating…"}`), to(t => t.map(t => t.index === e ? {
                    ...t,
                    status: "generating",
                    progress: a.progress
                } : t));
                let s = window.setTimeout(() => {
                    t3.current(e, t)
                }, 3500);
                tL.current.set(t, s)
            }, [ef, ee, eC, tY]);
        t3.current = t4;
        let t6 = useCallback(async () => {
            if (!eb) return;
            let e = readH3UiCache();
            if (e?.videoUrl && ti(e.videoUrl), e?.videoVariants?.length && (to(e.videoVariants), null != e.selectedVariantIndex && tc(e.selectedVariantIndex)), e?.submittedPrompt && tr(e.submittedPrompt), e?.originalPrompt && tn(e.originalPrompt), e?.info && te(e.info), e?.error && tp(e.error), e?.progress && e7(e.progress), e?.generating && e.jobId && !e.videoVariants?.length && (e6(e.jobId), ty(!0), null != e.elapsedAnchorMs && tB(Date.now() - e.elapsedAnchorMs)), e?.generating && e.videoVariants?.length)
                for (let t of (ty(!0), t_.current = !0, null != e.elapsedAnchorMs && tB(Date.now() - e.elapsedAnchorMs), e.videoVariants)) t.jobId && ("pending" === t.status || "generating" === t.status) && (tG.current.set(t.jobId, t.index), t4(t.index, t.jobId));
            let t = async (e, t) => {
                let r = ee ? "&gpu_only=1" : "",
                    {
                        res: a,
                        data: n
                    } = await fetchJson(`/api/h3-lab/status?jobId=${encodeURIComponent(e)}${r}`, {
                        credentials: "include"
                    });
                if (!a.ok || !n) return !1;
                if ("complete" === n.status || "error" === n.status) return t2(n), !0;
                if ("queued" === n.status || "running" === n.status) {
                    let r = n.updatedAt ?? n.createdAt ?? t ?? 0,
                        a = Date.now() - r;
                    return ee && a > 27e5 ? (clearStoredH3JobId(), writeH3UiCache({
                        generating: !1,
                        jobId: void 0
                    }), !1) : (e7(F(n.progress, ef, ee) || (ef ? "جاري التوليد…" : "Generating…")), tK(e, n.createdAt ?? t), !0)
                }
                return !1
            };
            try {
                let {
                    res: r,
                    data: a
                } = await fetchJson("/api/h3-lab/active", {
                    credentials: "include"
                });
                if (r.ok && a?.active && a.jobId && await t(a.jobId, a.createdAt)) return;
                let n = readStoredH3JobId() || (0, B.readH3ActiveJobIdFromCookie)() || e?.jobId?.trim() || null,
                    s = e?.elapsedAnchorMs != null ? Date.now() - e.elapsedAnchorMs : void 0;
                if (n && await t(n, s)) return;
                if (e?.generating && n) return void tK(n, s);
                e?.generating && tX();
                let {
                    res: i,
                    data: l
                } = await fetchJson(`/api/h3-lab/last${ee?"?gpu_only=1":""}`, {
                    credentials: "include"
                });
                if (i.ok && l?.found && l.job) {
                    let e = l.job,
                        t = Y(e);
                    t && (ti(t), writeH3UiCache({
                        videoUrl: t,
                        generating: !1
                    })), e.submittedPrompt?.trim() && tr(e.submittedPrompt.trim()), e.originalPrompt?.trim() && tn(e.originalPrompt.trim()), e.info?.trim() && te(e.info.trim())
                }
            } catch {}
        }, [eb, ef, ee, t2, tK, tB, tX, t4]);
        useEffect(() => {
            if (!eb) {
                tT.current = !1, tq();
                return
            }
            ew && !tT.current && (tT.current = !0, t6())
        }, [eb, ew, t6, tq]), useEffect(() => {
            eb && writeH3UiCache({
                jobId: e4 ?? void 0,
                videoUrl: ts ?? void 0,
                videoVariants: tl.length ? tl : void 0,
                selectedVariantIndex: tl.length ? td : void 0,
                generating: tj,
                progress: e8 || void 0,
                submittedPrompt: tt || void 0,
                originalPrompt: ta || void 0,
                info: e9 || void 0,
                error: tx || void 0,
                elapsedAnchorMs: tj ? Date.now() - tI : void 0
            })
        }, [eb, e4, ts, tl, td, tj, e8, tt, ta, e9, tx, tI]), useEffect(() => () => {
            tT.current = !1, tq()
        }, [tq]), useEffect(() => {
            let e = () => {
                if (document.hidden) return;
                let e = t$.current;
                e && t_.current && t0.current(e)
            };
            return document.addEventListener("visibilitychange", e), () => document.removeEventListener("visibilitychange", e)
        }, []);
        let t8 = useCallback(async () => {
                if (!eb) return;
                let {
                    data: e
                } = await fetchJson(ee ? "/api/h3-lab/config?gpu_only=1" : "/api/h3-lab/config", {
                    credentials: "include"
                });
                e && eA(e), eU(!0)
            }, [eb, ee]),
            t7 = !!(en || es || eS?.gpuFailover || eS?.rentalFrozen),
            t9 = ee && !!(ea || et);
        useEffect(() => {
            if (!eb) {
                eA(null), eU(!1);
                return
            }
            t8()
        }, [eb, t8]), (0, n.useLayoutEffect)(() => {
            if (!ee || ek.current) return;
            let e = resolveEditBoot();
            if (!e || "ai-rental" !== e.studioOrigin) return;
            let t = e.rentalEngine ?? (String(e.modelId || "").trim() === VERONIX_DEPLOYED_MODEL_ID ? "ltx" : "vyronix");
            if (eN(t), "vyronix" === t && (ek.current = !0, e.prompt && eP(stripInternalPromptNotes(e.prompt)), null != e.duration && Number.isFinite(Number(e.duration)) && (eD(!1), eF(Math.min(15, Math.max(1, Math.round(Number(e.duration)))))), e.aspectRatio && q.includes(e.aspectRatio) && eG(e.aspectRatio), te(ef ? "تم تحميل إعدادات التعديل من Assets — راجع الوصف والمدة ثم Generate" : "Edit settings loaded from Assets — review prompt and Generate"), clearEditDraft(), window.location.search.includes("edit="))) {
                let e = new URL(window.location.href);
                ["edit", "duration", "d", "resolution", "r", "aspect", "ar", "clarity", "c", "model", "m", "engine", "studio"].forEach(t => e.searchParams.delete(t)), window.history.replaceState({}, "", e.pathname + e.search + e.hash)
            }
        }, [ee, ef, 15]), useEffect(() => {
            if (!ee || !eb || eS?.canGenerate && eS?.podReady && !t7) return;
            let e = t7 ? 8e3 : eS?.gpuLinked ? 12e3 : 6e3,
                t = window.setInterval(() => void t8(), e);
            return () => window.clearInterval(t)
        }, [ee, eb, t7, eS?.canGenerate, eS?.podReady, eS?.gpuLinked, t8]);
        let re = eS?.backend === "runpod_serverless" || eS?.runpodReady !== void 0,
            rt = ec && !re;
        useEffect(() => {
            if (!tj || !ee || !eb || re) return;
            let e = async () => {
                let {
                    data: e
                } = await fetchJson("/api/h3-lab/config?gpu_only=1&job_guard=1", {
                    credentials: "include"
                });
                if (!e || "runpod_serverless" === e.backend || !1 !== e.gpuLive) return;
                let t = e.gpuOfflineReason || "gpu_offline";
                tp(J(t, ef, ee)), tX(), to(e => 0 === e.length ? e : e.map(e => "complete" === e.status ? e : {
                    ...e,
                    status: "error",
                    error: J(t, ef, ee)
                }))
            };
            e();
            let t = window.setInterval(() => void e(), 6e3);
            return () => window.clearInterval(t)
        }, [tj, ee, eb, ef, tX, re]), useEffect(() => {
            if (!ee || !eb || tj || tN || tS) return;
            let e = eS?.activeJob;
            e?.jobId && ("queued" === e.status || "running" === e.status) && tK(e.jobId, e.createdAt)
        }, [ee, eb, tj, tN, tS, eS?.activeJob, tK]), useEffect(() => {
            if (!tj) return;
            let e = window.setInterval(() => {
                tI < 12e4 || e7(e => e || (ef ? "يبدو أن التوليد عالق — جرّب «إيقاف التوليد» ثم Generate من جديد" : "Generation may be stuck — try Stop, then Generate again"))
            }, 5e3);
            return () => window.clearInterval(e)
        }, [tj, tI, ef]);
        let rr = V[ez],
            ra = ee ? $(rr.megapixels) : $(eJ),
            rn = rr.steps,
            rs = function(e, t) {
                let r, a, n, s, i, l, o, d = $(e),
                    {
                        width: c,
                        height: u
                    } = (r = $(d), n = Number.isFinite((a = t.split(":").map(e => Number(e.trim())))[0]) && a[0] > 0 ? a[0] : 16, s = Number.isFinite(a[1]) && a[1] > 0 ? a[1] : 9, l = Math.max(32, 32 * Math.round(Math.sqrt((i = 1e6 * Math.max(.1, r)) * Math.max(n, s) / Math.min(n, s)) / 32)), o = Math.max(32, 32 * Math.round(i / l / 32)), n >= s ? {
                        width: l,
                        height: o
                    } : {
                        width: o,
                        height: l
                    }),
                    m = d.toFixed(2).replace(/\.?0+$/, "") || "0";
                return `${m} MP \xb7 ${c}\xd7${u}`
            }(ra, eL),
            ri = useMemo(() => {
                var e, t;
                let r, a, n, s, i = G(eC);
                if (ee) {
                    return eT ? (e = {
                        paragraphCount: i
                    }, E(eC, {
                        paragraphCount: e?.paragraphCount,
                        skipSceneAnchor: !0,
                        skipSecondsHint: !0
                    })) : function(e, t = 120) {
                        let r, a = Math.min(15, 120, Math.max(1, Number(t) || 120)),
                            n = (r = e.trim()) ? r.split(/\n\s*\n+/).map(e => e.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim() : "",
                            s = n;
                        return n && !D(n) && (s = `${n}
seconds: ${a}`), {
                            targetTotalSeconds: a,
                            promptForRunpod: s,
                            perShotSeconds: a,
                            beatCount: 1,
                            expectedTotalSeconds: a,
                            expandedBeats: !1
                        }
                    }(eC, eH)
                }
                return eT ? E(eC, {
                    paragraphCount: i
                }) : (t = eC, a = Math.min(15, Math.max(1, Number(eH) || 15)), {
                    targetTotalSeconds: s = Math.round(a * (n = (r = t.split(/\n\s*\n+/).map(e => e.trim()).filter(Boolean)).length <= 1 ? 1 : Math.max(1, r.length - 1)) * 10) / 10,
                    promptForRunpod: function(e, t) {
                        let r = Math.min(15, Math.max(1, Math.round(t))),
                            a = e.split(/\n\s*\n+/).map(e => e.trim()).filter(Boolean);
                        if (!a.length) return e;
                        if (1 === a.length) return D(a[0]) ? e : (a[0] = `${a[0]}
seconds: ${r}`, a.join("\n\n"));
                        let n = !1;
                        for (let e = 1; e < a.length; e += 1) D(a[e]) || (a[e] = `${a[e]}
seconds: ${r}`, n = !0);
                        return n ? a.join("\n\n") : e
                    }(t, a),
                    perShotSeconds: a,
                    beatCount: n,
                    expectedTotalSeconds: s,
                    expandedBeats: !1
                })
            }, [eT, eH, ee, eC]),
            rl = hasArabic(eC) ? "rtl" : ep,
            ro = e => {
                eq(e), eV(V[e].megapixels), ee && !eT && eF(V[e].duration)
            },
            rd = async e => {
                if (!e) return;
                if (!(e.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(e.name || ""))) return void tp(ef ? "الملف ليس صورة — استخدم JPG أو PNG أو HEIC" : "Not an image — use JPG, PNG, or HEIC");
                let t = URL.createObjectURL(e),
                    r = crypto.randomUUID(),
                    a = !1;
                if (e$(n => n.length >= 4 ? n : (a = !0, [...n, {
                        id: r,
                        file: e,
                        preview: t,
                        name: ""
                    }])), !a) return void URL.revokeObjectURL(t);
                if (!ee) try {
                    let t = await K(e);
                    e$(e => e.map(e => e.id === r ? {
                        ...e,
                        uploadPath: t
                    } : e))
                } catch (e) {
                    tp(J(e instanceof Error ? e.message : void 0, ef, ee) || (ef ? "تعذّر رفع صورة الشخصية" : "Character image upload failed"))
                }
            }, rc = useCallback(async () => {
                for (let e = 0; e < 48; e += 1) {
                    await new Promise(e => window.setTimeout(e, 5e3));
                    try {
                        let {
                            res: e,
                            data: t
                        } = await fetchJson("/api/h3-lab/config?gpu_only=1", {
                            credentials: "include"
                        });
                        if (e.ok && t?.modelsReady && t?.podReachable && !t?.activeJob && t?.canGenerate !== !1) {
                            eA(t), tA(!1), te(ef ? "✓ GPU جاهز — يمكنك التوليد من جديد" : "✓ GPU ready — start a fresh generate");
                            return
                        }
                    } catch {}
                }
                tA(!1), te(ef ? "GPU قد يحتاج دقيقة إضافية — انتظر ثم جرّب Generate" : "GPU may need another minute — wait, then try Generate")
            }, [ef]), ru = useCallback(async () => {
                if (tN) return;
                tk(!0), tq(), t_.current = !1, tR.current = !1, tG.current.clear();
                let e = null;
                try {
                    let t = ee ? "/api/h3-lab/unlock?gpu_only=1" : "/api/h3-lab/unlock",
                        {
                            data: r
                        } = await fetchJson(t, {
                            method: "POST",
                            credentials: "include"
                        });
                    e = r
                } catch {}clearH3UiCache(), clearStoredH3JobId(), tX(), t8(), ti(null), to([]), tc(0), tr(""), tn(""), tg(null), tp(""), e7(""), ee && e?.rentalGpuStop?.rebootScheduled ? (tA(!0), te(ef ? "تم إيقاف كل المهام — جاري إعادة تشغيل GPU (1–3 دقائق)" : "All jobs stopped — rebooting GPU (1–3 min)"), rc()) : (tA(!1), te(ee ? ef ? "تم إيقاف التوليد — GPU جاهز لتوليد جديد" : "Generation stopped — GPU ready for a fresh run" : ef ? "تم إيقاف التوليد" : "Generation stopped")), tk(!1)
            }, [ef, ee, tX, tN, rc, t8]), rm = async e => {
                if (th || eC.trim().length < 3) return tp(ef ? "اكتب وصف المشهد (3 أحرف على الأقل)" : "Enter a scene description (at least 3 characters)"), null;
                tf(!0), tp(""), te(""), tv("");
                try {
                    let {
                        res: t,
                        data: r
                    } = await fetchJson("/api/h3-lab/enhance", {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            prompt: eC,
                            mode: e
                        })
                    }), a = (r?.translated || "").trim();
                    if (!t.ok || !a) {
                        let e = J("string" == typeof r?.error ? r.error : void 0, ef, ee);
                        return tv(e), tp(e), null
                    }
                    if ("literal" === e) {
                        if (!isAcceptableLiteralEnglish(a)) {
                            let e = ef ? "الترجمة لم تكتمل — حاول مرة أخرى" : "Translation incomplete — try again";
                            return tv(e), tp(e), null
                        }
                    } else if (hasArabic(a)) {
                        let e = ef ? "الترجمة لم تكتمل — حاول مرة أخرى" : "Translation incomplete — try again";
                        return tv(e), tp(e), null
                    }
                    tn(eC.trim()), eP(a), tg(e);
                    let n = "literal" === e ? ef ? "✓ ترجمة حرفية — بدون تحسين Gemini" : "✓ Literal translation — no Gemini enhancement" : ef ? "✓ Gemini — سيناريو سينمائي جاهز، راجع ثم اضغط Generate" : "✓ Gemini cinematic screenplay ready — review, then Generate";
                    return tv(n), te(n), a
                } catch (t) {
                    let e = t instanceof Error ? J(t.message, ef, ee) : ef ? "تعذّرت الترجمة" : "Translation failed";
                    return tv(e), tp(e), null
                } finally {
                    tf(!1)
                }
            }, rx = async (lastOriginalOnly = !1) => {
                if (tj || tR.current || th || tN || tS) return;
                if (lastOriginalOnly) {
                    if (!tF || !ee) return;
                    let t = (lastOriginalPromptRef.current.trim() || eC.trim()).trim();
                    if (!t) return void tp(ef ? "لا يوجد برومبت أصلي سابق — اكتب وصفًا أو استخدم Generate أولًا." : "No prior original prompt — enter a description or use Generate first.");
                    lastOriginalPromptRef.current = t, writeLastOriginalPrompt(t)
                } else if (eC.trim().length < 3) return void tp(ef ? "اكتب وصف المشهد (3 أحرف على الأقل)" : "Enter a scene description (at least 3 characters)");
                if (eI && eS && !rj && !t9) return;
                let e = lastOriginalOnly ? lastOriginalPromptRef.current.trim() : eC;
                if (!lastOriginalOnly) {
                    let t = eC.trim();
                    t && (lastOriginalPromptRef.current = t, writeLastOriginalPrompt(t))
                }
                tR.current = !0, tq(), t_.current = !0, ty(!0), tp(""), te(""), tr(""), tb || tn(""), ti(null), to([]), tc(0), tB(), e7(ef ? "إرسال الطلب…" : "Submitting…");
                try {
                    let t, r;
                    !ee && eM.some(e => !e.uploadPath) && e7(ef ? "رفع صور الشخصيات…" : "Uploading character images…"), ee && e1 && (e7(ef ? "رفع الإطار الأول…" : "Uploading start frame…"), t = await K(e1.file)), ee && e5 && (e7(ef ? "رفع الإطار الأخير…" : "Uploading end frame…"), r = await K(e5.file));
                    let a = eM.map(e => {
                            let t = normalizeCharacterName(e.name);
                            return {
                                type: "image",
                                id: e.id,
                                url: e.preview,
                                label: t || e.name
                            }
                        }),
                        n = orderCharacterRefsForBinding(e, a).map(e => eM.find(t => t.id === e.id)).filter(e => !!e),
                        s = n.length >= eM.length ? n : [...n, ...eM.filter(e => !n.some(t => t.id === e.id))],
                        i = [],
                        l = [];
                    for (let e = 0; e < s.length; e += 1) {
                        let t = s[e];
                        l.push(normalizeCharacterName(t.name)), t.uploadPath || e7(ef ? `رفع شخصية ${e+1}…` : `Uploading character ${e+1}…`);
                        let r = t.uploadPath || await K(t.file);
                        t.uploadPath || e$(e => e.map(e => e.id === t.id ? {
                            ...e,
                            uploadPath: r
                        } : e)), i.push(r)
                    }
                    let o = !lastOriginalOnly && ee && !tF && s.length > 0 ? buildH3StudioCharacterBundle(e, s) : null;
                    o?.prompt.trim() && (e = o.prompt);
                    let d = !lastOriginalOnly && ee && !tF && s.length > 0 ? e_.trim() || o?.characterMemory || buildH3Smite79CharacterMemory(s.map(e => ({
                            name: e.name
                        }))) : e_ || void 0,
                        c = (a, n) => ({
                            prompt: e,
                            character_memory: d,
                            exposed_terms: o?.exposedTerms || void 0,
                            ref_images: i.length ? i : void 0,
                            ref_character_names: l.length ? l : void 0,
                            start_frame: t,
                            end_frame: r,
                            resolution: eL,
                            megapixels: ra,
                            shot_seconds: eT ? void 0 : eH,
                            auto_duration: eT || void 0,
                            speed_mode: ez,
                            plan_only: eZ,
                            prevent_nudity: !0,
                            lock_restraints: !0,
                            anatomy_guard: "auto",
                            solidity_guard: "auto",
                            motion_guard: "auto",
                            shift_video: 12,
                            shift_audio: 3,
                            steps: rn,
                            seed: a,
                            lora: eK,
                            locale: ex,
                            gpu_only: ee || void 0,
                            prompt_ready: !!ee && (!!tF || "literal" === tb || "screenplay" === tb) || !(!ee || hasArabic(e)) || void 0,
                            variant_batch_id: n?.variantBatchId,
                            variant_index: n?.variantIndex,
                            variant_total: n?.variantTotal
                        }),
                        u = ee ? Math.min(4, Math.max(1, tu)) : tu;
                    if (ee && !eZ && u > 1) {
                        let e, t, r = crypto.randomUUID(),
                            a = (e = Math.min(STUDIO_VIDEO_VARIANT_COUNT, Math.max(1, u)), t = eX > 0 ? eX : Math.floor(1e6 * Math.random()), Array.from({
                                length: e
                            }, (e, r) => t + 10007 * r)),
                            n = a.map((e, t) => ({
                                index: t,
                                seed: e,
                                status: "pending"
                            }));
                        to(n), tc(0), e7(ef ? `إرسال ${a.length} فيديو…` : `Submitting ${a.length} videos…`);
                        let s = [...n],
                            i = !1;
                        for (let e = 0; e < a.length; e += 1) {
                            let t = a[e],
                                {
                                    res: n,
                                    data: l
                                } = await fetchJson("/api/h3-lab/generate", {
                                    method: "POST",
                                    credentials: "include",
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify(c(t, {
                                        variantBatchId: r,
                                        variantIndex: e,
                                        variantTotal: u
                                    }))
                                });
                            n.ok && l?.jobId ? (i = !0, s[e] = {
                                ...s[e],
                                jobId: l.jobId,
                                status: "generating"
                            }, tG.current.set(l.jobId, e), 0 === e && (e6(l.jobId), storeH3JobId(l.jobId), l.submittedPrompt?.trim() && tr(l.submittedPrompt.trim()), l.originalPrompt?.trim() ? tn(l.originalPrompt.trim()) : eC.trim() && tn(eC.trim())), t4(e, l.jobId)) : s[e] = {
                                ...s[e],
                                status: "error",
                                error: J("string" == typeof l?.error ? l.error : void 0, ef, ee)
                            }, to([...s])
                        }
                        if (!i) {
                            tp(ef ? "تعذر بدء التوليد" : "Could not start generation"), tX(), to([]);
                            return
                        }
                        e7(ef ? `جاري توليد ${a.length} فيديو…` : `Generating ${a.length} videos…`);
                        return
                    }
                    let {
                        res: m,
                        data: x
                    } = await fetchJson("/api/h3-lab/generate", {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(c(eX))
                    });
                    if (!m.ok || !x?.jobId) {
                        tp("string" == typeof x?.error ? J(x.error, ef, ee) : ef ? "تعذر بدء التوليد" : "Could not start generation"), tX();
                        return
                    }
                    e6(x.jobId), storeH3JobId(x.jobId), x.submittedPrompt?.trim() && tr(x.submittedPrompt.trim()), x.originalPrompt?.trim() ? tn(x.originalPrompt.trim()) : eC.trim() && tn(eC.trim()), t5(x.jobId)
                } catch (e) {
                    tp(J(e instanceof Error ? e.message : ef ? "تعذّر الاتصال" : "Connection failed", ef, ee)), tX()
                } finally {
                    tR.current = !1
                }
            }, rp = !!(eS?.gpuLinked || eS?.configured || eS?.backend || ei || eu && eo), rh = !!(eS?.modelsReady || ei || re && t9), rf = eo ?? eS?.vyronixId, rb = ed ?? eS?.prepStartedAt, rg = !!(ea || et), rw = !!(!ee || !eI || re && rg && !t7 && !rt && (t9 || eu || eS?.canGenerate || el) || eu && ei && rg && !rt || rh && (rp || eS?.configured || ei) && (eS?.canGenerate || el || t9 || eu && rh)), rv = ee && (rh || re && t9) && !t7 && !rt && (t9 || !!eS?.canGenerate || el), rj = !!(rp || eu || eS?.configured), ry = !ee && eM.some(e => !e.uploadPath), rN = !!(ee && eS?.activeJob?.jobId && ("queued" === eS.activeJob.status || "running" === eS.activeJob.status)), rk = tj || rN, rS = tj || th || tN || tS || ry || rt || ee && !eu && !(ei && rg && !rt) && !(re && t9) || ee && eI && !rw, rA = ee ? Math.min(4, eS?.maxParallel ?? 4) : 4;
        useEffect(() => {
            tm(e => Math.min(Math.max(1, e), rA))
        }, [rA]);
        let rI = rk ? ef ? "جاري التوليد…" : "Generating…" : tS ? ef ? "GPU يعاد تشغيله…" : "GPU rebooting…" : th ? ef ? "جاري الترجمة…" : "Translating…" : eZ ? ef ? "معاينة الخطة" : "Preview plan" : tu > 1 && ee ? `Generate \xd7${tu}` : eh.create.generate,
            rU = ee && !eZ && (rk || !!ts || tl.length > 0),
            rC = tu > 1 && (tj || tl.length > 0) ? Math.max(tl.length, tu) : tl.length > 0 ? tl.length : tj || ts ? 1 : 0,
            rP = tj ? Date.now() - tI : Date.now(),
            r_ = !ee || eu || tj ? rt ? jsx("p", {
                className: "text-center text-xs leading-relaxed text-[#22f0ff]/90",
                children: ef ? "أدخل فيرونيكس ID أعلاه لربط الاستوديو بـ GPU قبل التوليد" : "Enter your Vyronix ID above to link the studio GPU before generating"
            }) : ee && eI && !rw && !tj ? jsx("p", {
                className: "text-center text-xs leading-relaxed text-amber-200/85",
                children: t7 ? eh.studioRental.failoverTitle : ef ? "انتظر حتى يظهر «الاستوديو جاهز» — الواجهة تتحقق من GPU كل بضع ثوانٍ" : "Wait for «Studio ready» — the UI polls your GPU every few seconds"
            }) : null : jsxs("p", {
                className: "text-center text-xs leading-relaxed text-amber-200/85",
                children: [ef ? "اشترك من " : "Subscribe from ", jsx(Link, {
                    href: STUDIO_RENTAL_PRICING_PATH,
                    className: "font-semibold text-[#22f0ff] underline",
                    children: ef ? "صفحة الباقات" : "the pricing page"
                }), ef ? " لتفعيل التوليد" : " to unlock generation"]
            });
        return ew || eb ? !ew || eb || em && ee ? jsxs("div", {
            className: "relative min-h-[100dvh] bg-[#0b0d12] text-white",
            children: [jsx("div", {
                "aria-hidden": !0,
                className: "pointer-events-none fixed inset-0 -z-10 studio-backdrop"
            }), jsx(AppHeader, {
                compact: !0,
                user: eb,
                onLogout: () => void eg(),
                ready: ew,
                refreshing: ev
            }), jsxs("main", {
                className: "overflow-x-hidden pb-bottom-nav",
                children: [M ? jsx("div", {
                    className: "mx-auto max-w-3xl px-4 pt-3 sm:px-6",
                    children: M
                }) : null, H ? ee ? jsx("section", {
                    className: "mx-auto max-w-3xl px-4 pt-2 sm:px-6",
                    dir: ep,
                    children: jsxs("div", {
                        className: "flex flex-wrap items-center justify-between gap-2",
                        children: [jsx(DeployStamp, {
                            className: "text-[10px] font-mono text-white/40"
                        }), jsxs("div", {
                            className: "flex flex-wrap items-center gap-2",
                            children: [ec ? jsx("span", {
                                className: "inline-flex items-center gap-1.5 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-1 text-[11px] font-semibold text-[#c8fbff]",
                                children: ef ? "○ أدخل Vyronix ID للربط" : "○ Enter Vyronix ID to link"
                            }) : ei && eu ? jsx("span", {
                                className: "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-100",
                                children: ef ? "● GPU مربوط — الاستوديو جاهز" : "● GPU linked — studio ready"
                            }) : rp ? jsx("span", {
                                className: "inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100",
                                children: ef ? "● GPU متصل — جاري التحميل…" : "● GPU connected — loading…"
                            }) : jsx("span", {
                                className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55",
                                children: ef ? "○ GPU غير مربوط" : "○ GPU not linked"
                            }), et ? jsx(RentalDigitalClock, {
                                endsAt: et,
                                startedAt: er,
                                ar: ef,
                                compact: !0,
                                showWindow: !0
                            }) : null]
                        })]
                    })
                }) : null : jsx("section", {
                    className: "mx-auto max-w-3xl px-4 pt-3 sm:px-6 sm:pt-6",
                    dir: ep,
                    children: jsxs("div", {
                        className: "rounded-3xl border border-white/8 bg-gradient-to-br from-[#141821] via-[#10141c] to-[#0b0d12] p-5 sm:p-7",
                        children: [jsx(BrandLogo, {
                            size: "lg",
                            className: "mb-4"
                        }), jsx("p", {
                            className: "text-[10px] font-semibold uppercase tracking-[0.18em] text-[#22f0ff]/85 sm:text-xs sm:tracking-[0.24em]",
                            children: ee ? ef ? O.AI_RENTAL_STUDIO_NAME_AR : O.AI_RENTAL_STUDIO_NAME : ef ? "MiniMax H3 · فيديو طويل" : "MiniMax H3 · Long video"
                        }), jsx("h1", {
                            className: "mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl",
                            children: ee ? ef ? O.AI_RENTAL_STUDIO_NAME_AR : O.AI_RENTAL_STUDIO_NAME : ef ? "مختبر H3 Long Videos" : "H3 Long Videos Lab"
                        }), jsx("p", {
                            className: "mt-2 max-w-xl text-[13px] leading-relaxed text-white/55 sm:text-sm",
                            children: ee ? ef ? "اكتب بالعربية أو الإنجليزية — اضغط Generate مباشرة، أو استخدم «تحسين Gemini» / «ترجمة حرفية» اختيارياً." : "Arabic or English — tap Generate directly, or optionally use Gemini enhance / literal translate." : ef ? "اكتب بالعربية أو الإنجليزية — الترجمة والتحسين تلقائي عند التوليد (مثل Turbo). الفقرة الأولى = المكان والإضاءة، والسطر الفاضي = لقطة." : "Arabic or English — auto-translated and enhanced on generate (like Turbo). First paragraph = place & light; blank line = new shot."
                        }), ee ? jsxs("div", {
                            className: "mt-3 flex flex-col items-start gap-2",
                            children: [jsx(DeployStamp, {
                                className: "text-[10px] font-mono text-white/40"
                            }), jsx("div", {
                                className: "flex w-full flex-wrap items-center gap-3",
                                children: et && rw ? jsxs("div", {
                                    className: "inline-flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 sm:px-4",
                                    children: [t7 ? jsx("span", {
                                        className: "text-[11px] font-semibold text-amber-100 sm:text-xs",
                                        children: eh.studioRental.failoverTitle
                                    }) : jsx("span", {
                                        className: "text-[11px] font-bold text-emerald-100 sm:text-xs",
                                        children: eh.studioRental.studioReady
                                    }), jsx("span", {
                                        className: "hidden h-4 w-px bg-emerald-400/30 sm:inline",
                                        "aria-hidden": !0
                                    }), jsx(RentalDigitalClock, {
                                        endsAt: et,
                                        startedAt: er,
                                        ar: ef,
                                        compact: !0,
                                        showWindow: !0
                                    })]
                                }) : rv ? jsx("div", {
                                    className: "inline-flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 sm:px-4",
                                    children: jsx("span", {
                                        className: "text-[11px] font-bold text-emerald-100 sm:text-xs",
                                        children: eh.studioRental.studioReady
                                    })
                                }) : jsx("p", {
                                    className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60",
                                    children: eI ? t7 ? eh.studioRental.failoverTitle : rp && rh ? ef ? "● GPU متصل — جاري تفعيل النماذج…" : "● GPU linked — loading models…" : rp ? ef ? "● GPU متصل — انتظر models OK" : "● GPU linked — waiting for models" : ef ? "○ GPU غير متصل — انتظر أو Refresh" : "○ GPU not connected — wait or refresh" : ef ? "● جاري الاتصال بالـ GPU…" : "● Connecting to GPU…"
                                })
                            }), et && !rw ? jsx("div", {
                                className: "inline-flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 sm:px-4",
                                children: jsx(RentalDigitalClock, {
                                    endsAt: et,
                                    startedAt: er,
                                    ar: ef,
                                    compact: !0,
                                    showWindow: !0
                                })
                            }) : null, eI && rp && !rw && !t7 ? jsxs("div", {
                                className: "flex flex-wrap items-start gap-3",
                                children: [jsx(StudioPrepClock, {
                                    label: rh ? ef ? "GPU يفعّل ComfyUI — انتظر «الاستوديو جاهز»" : "GPU starting ComfyUI — wait for «Studio ready»" : ef ? "GPU يحمّل النماذج من R2 — Refresh آمن" : "GPU loading models from R2 — safe to refresh"
                                }), jsx(VyronixIdBadge, {
                                    vyronixId: rf,
                                    prepStartedAt: rb,
                                    ar: ef,
                                    compact: !0
                                })]
                            }) : null]
                        }) : null, ee ? null : jsx("p", {
                            className: "mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60",
                            children: eI ? eS?.configured ? eS.label ? `● ${eS.label}` : eS.turboUsesSpace ? ef ? "● Turbo = نفس Space (Larry · 6 steps)" : "● Turbo = same as Space (Larry · 6 steps)" : ef ? "● متصل بـ Vast GPU" : "● Vast GPU connected" : ef ? "○ غير مربوط" : "○ Not configured" : ef ? "● جاري الاتصال…" : "● Connecting…"
                        })]
                    })
                }), jsxs("section", {
                    className: `mx-auto max-w-3xl space-y-4 px-4 sm:px-6 ${H?"pt-3":"pt-6"} pb-6`,
                    dir: ep,
                    children: [!eI || eS?.configured || ee ? null : jsx("div", {
                        className: "rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100",
                        children: ef ? "الخدمة غير مربوطة بعد — تواصل مع الدعم." : "Service not configured yet."
                    }), ee ? jsx("div", {
                        className: "space-y-3",
                        children: T ? jsx("div", {
                            children: T
                        }) : null
                    }) : null, ee ? jsx("div", {
                        className: "scroll-mt-24",
                        id: "rental-video-model",
                        children: jsx(W, {
                            value: ey,
                            onChange: eN,
                            ltxAvailable: !0,
                            vyronixAvailable: !0,
                            spaceBackendLabel: eS?.spaceBackend === "runpod" || eS?.backend === "runpod_serverless" ? "RunPod GPU" : "HF Turbo",
                            ar: ef
                        })
                    }) : null, ee ? jsx("div", {
                        className: "ltx" === ey ? "" : "hidden",
                        "aria-hidden": "ltx" !== ey,
                        children: jsx(CreateStudioLazy, {
                            user: eb,
                            onUserRefresh: ej,
                            rentalLtxOnly: !0
                        })
                    }) : null, jsx("div", {
                        className: ee && "vyronix" !== ey ? "hidden" : "",
                        "aria-hidden": ee && "vyronix" !== ey,
                        children: jsxs(Fragment, {
                            children: [jsxs("div", {
                                className: "rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 sm:p-4",
                                children: [jsxs("p", {
                                    className: "mb-1 text-sm font-medium text-white/80",
                                    children: [ee ? ef ? "صور الشخصيات (مرجع الوجه)" : "Character images (face reference)" : ef ? "صور الشخصيات (REF2VA)" : "Character images (REF2VA)", " ", jsx("span", {
                                        className: "font-normal text-white/45",
                                        children: ef ? "(اختياري)" : "(optional)"
                                    })]
                                }), jsx("p", {
                                    className: "mb-2.5 text-[11px] leading-relaxed text-white/40",
                                    children: ee ? ef ? "ارفع صورة + اكتب اسم الشخصية في الوصف (أو سيُضاف تلقائياً عند التوليد)" : "Upload photo + name the character in your prompt (or auto-added on generate)" : eh.create.charactersHint
                                }), jsxs("div", {
                                    className: "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                                    children: [eM.map((e, r) => {
                                        let a = tH.has(e.id);
                                        return jsxs("div", {
                                            className: `w-[6.75rem] shrink-0 space-y-1.5 rounded-2xl border bg-black/25 p-1.5 sm:w-[9.5rem] ${a?"border-[#22f0ff]/55 ring-1 ring-[#22f0ff]/25":"border-white/10"}`,
                                            children: [jsxs("div", {
                                                className: "relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#1a1f2a]",
                                                role: "button",
                                                tabIndex: 0,
                                                onClick: () => tV(e.name),
                                                onKeyDown: t => {
                                                    ("Enter" === t.key || " " === t.key) && (t.preventDefault(), tV(e.name))
                                                },
                                                children: [jsx("img", {
                                                    src: e.preview,
                                                    alt: e.name || `char-${r+1}`,
                                                    className: "h-full w-full object-cover"
                                                }), jsx("button", {
                                                    type: "button",
                                                    className: "absolute right-1 top-1 rounded-full bg-black/70 p-0.5",
                                                    onClick: t => {
                                                        var r;
                                                        t.preventDefault(), t.stopPropagation(), r = e.id, e$(e => {
                                                            let t = e.find(e => e.id === r);
                                                            return t?.preview.startsWith("blob:") && URL.revokeObjectURL(t.preview), e.filter(e => e.id !== r)
                                                        })
                                                    },
                                                    "aria-label": ef ? "حذف الصورة" : "Remove image",
                                                    children: jsx(XIcon, {
                                                        className: "h-3 w-3"
                                                    })
                                                }), a ? jsx("span", {
                                                    className: "absolute bottom-1 left-1 rounded-full bg-[#22f0ff]/90 px-1.5 py-0.5 text-[8px] font-bold text-black",
                                                    children: ef ? "مربوط" : "Linked"
                                                }) : null, e.uploadPath || ee ? null : jsx("span", {
                                                    className: "absolute inset-x-1 bottom-6 rounded bg-black/70 px-1 py-0.5 text-center text-[8px] text-white/80",
                                                    children: ef ? "جاري الرفع…" : "Uploading…"
                                                })]
                                            }), jsxs("label", {
                                                className: "block space-y-0.5",
                                                dir: ep,
                                                children: [jsx("span", {
                                                    className: "block text-center text-[10px] font-semibold text-[#22f0ff]",
                                                    children: eh.create.characterName
                                                }), jsx("input", {
                                                    type: "text",
                                                    value: e.name,
                                                    onChange: t => {
                                                        var r, a;
                                                        let n;
                                                        return r = e.id, a = t.target.value, n = normalizeCharacterName(a), void e$(e => e.map(e => e.id === r ? {
                                                            ...e,
                                                            name: n
                                                        } : e))
                                                    },
                                                    onBlur: () => {
                                                        isCharacterName(e.name) && tV(e.name)
                                                    },
                                                    placeholder: eh.create.characterNamePlaceholder,
                                                    className: "w-full rounded-lg border border-[#22f0ff]/35 bg-black/50 px-1.5 py-1.5 text-center text-xs font-semibold text-white outline-none placeholder:font-normal placeholder:text-white/35 focus:border-[#22f0ff]",
                                                    maxLength: 40,
                                                    autoComplete: "off"
                                                })]
                                            })]
                                        }, e.id)
                                    }), eM.length < 4 ? jsxs("label", {
                                        className: "flex aspect-[3/4] w-[6.75rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 text-white/60 sm:w-[9.5rem]",
                                        children: [jsx(ImagePlus, {
                                            className: "h-5 w-5"
                                        }), jsx("span", {
                                            className: "text-[10px]",
                                            children: eh.create.add
                                        }), jsx("input", {
                                            type: "file",
                                            accept: "image/*",
                                            multiple: !0,
                                            className: "hidden",
                                            onChange: e => {
                                                let t = e.target.files;
                                                t?.length && ((async () => {
                                                    for (let e of Array.from(t)) await rd(e)
                                                })(), e.target.value = "")
                                            }
                                        })]
                                    }) : null]
                                }), tJ.length > 0 ? jsxs("div", {
                                    className: "mt-3 space-y-1.5",
                                    dir: ep,
                                    children: [jsx("p", {
                                        className: "text-[10px] font-semibold text-white/45",
                                        children: ef ? "الشخصيات المسماة — اضغط للإدراج في الوصف" : "Named characters — tap to insert into prompt"
                                    }), jsx("div", {
                                        className: "flex flex-wrap gap-1.5",
                                        children: tJ.map(e => {
                                            let r = tH.has(e.id);
                                            return jsxs("button", {
                                                type: "button",
                                                onClick: () => tV(e.name),
                                                className: `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${r?"border-[#22f0ff]/40 bg-[#22f0ff]/15 text-[#22f0ff]":"border-white/15 bg-white/5 text-white/55 hover:border-[#22f0ff]/30 hover:text-[#22f0ff]"}`,
                                                children: [jsx("img", {
                                                    src: e.preview,
                                                    alt: "",
                                                    className: "h-4 w-4 rounded-full object-cover"
                                                }), normalizeCharacterName(e.name), r ? jsx("span", {
                                                    "aria-hidden": !0,
                                                    children: "✓"
                                                }) : null]
                                            }, e.id)
                                        })
                                    })]
                                }) : null]
                            }), ee ? jsx("div", {
                                className: "grid grid-cols-2 gap-3",
                                children: [{
                                    label: eh.space.startFrame,
                                    preview: e1?.preview,
                                    which: "start"
                                }, {
                                    label: eh.space.endFrame,
                                    preview: e5?.preview,
                                    which: "end"
                                }].map(e => jsxs("label", {
                                    className: "relative flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 text-center",
                                    children: [e.preview ? jsx("img", {
                                        src: e.preview,
                                        alt: "",
                                        className: "mb-2 h-16 w-full rounded-lg object-cover"
                                    }) : jsx(ImagePlus, {
                                        className: "mb-2 h-5 w-5 text-white/50"
                                    }), jsx("span", {
                                        className: "text-xs text-white/70",
                                        children: e.label
                                    }), jsx("input", {
                                        type: "file",
                                        accept: "image/*",
                                        className: "hidden",
                                        onChange: t => {
                                            ((e, t) => {
                                                if (!t) return;
                                                let r = URL.createObjectURL(t);
                                                "start" === e ? (e1?.preview.startsWith("blob:") && URL.revokeObjectURL(e1.preview), e2({
                                                    file: t,
                                                    preview: r
                                                })) : (e5?.preview.startsWith("blob:") && URL.revokeObjectURL(e5.preview), e3({
                                                    file: t,
                                                    preview: r
                                                }))
                                            })(e.which, t.target.files?.[0]), t.target.value = ""
                                        }
                                    }), e.preview ? jsx("button", {
                                        type: "button",
                                        className: "absolute right-2 top-2 rounded-full bg-black/70 p-1",
                                        onClick: t => {
                                            t.preventDefault(), t.stopPropagation(), "start" === e.which ? (e1?.preview.startsWith("blob:") && URL.revokeObjectURL(e1.preview), e2(null)) : (e5?.preview.startsWith("blob:") && URL.revokeObjectURL(e5.preview), e3(null))
                                        },
                                        "aria-label": ef ? "حذف الصورة" : "Remove image",
                                        children: jsx(XIcon, {
                                            className: "h-3 w-3"
                                        })
                                    }) : null]
                                }, e.which))
                            }) : null, jsx("div", {
                                className: "rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5",
                                children: jsxs("label", {
                                    className: "block",
                                    children: [jsx("span", {
                                        className: "text-sm font-medium text-white/80",
                                        children: ef ? "وصف المشهد" : "Scene description"
                                    }), jsx("p", {
                                        className: "mt-0.5 text-[11px] text-white/40",
                                        children: ee ? ef ? "سطر فارغ = لقطة جديدة · الترجمة/التحسين اختياري من الأزرار أدناه" : "Blank line = new shot · translate/enhance optional via buttons below" : ef ? "✓ العربية مدعومة — اكتب بالعربية وسيُترجم تلقائياً عند التوليد. سطر فارغ = لقطة جديدة." : "✓ Arabic supported — write in Arabic; it auto-translates on generate. Blank line = new shot."
                                    }), eM.length > 0 ? jsx(CharacterLinkBanner, {
                                        linkedCharacters: tO,
                                        showHint: tD.some(e => isCharacterName(e)),
                                        hint: ee ? ef ? "اكتب اسم الشخصية في الوصف لربط الصورة" : "Use the character name in your prompt to bind the photo" : eh.create.charactersHint,
                                        title: eh.space.charactersLinked,
                                        dir: ep
                                    }) : null, jsx("textarea", {
                                        dir: rl,
                                        lang: hasArabic(eC) ? "ar" : ex,
                                        className: "mt-2 w-full resize-y whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0f1218] p-3 text-sm leading-relaxed text-white outline-none ring-[#22f0ff]/40 placeholder:text-white/30 focus:ring-2",
                                        style: {
                                            unicodeBidi: "plaintext"
                                        },
                                        rows: 6,
                                        value: eC,
                                        onChange: e => {
                                            eP(e.target.value), tg(null), tv("")
                                        },
                                        placeholder: ef ? "ضوء نهاري. مزرعة مع حظيرة.\n\nمحمد يقود فان ويتوقف.\n\nمحمد ينزل ويمشي للحظيرة." : "Daylight. A farm with a barn.\n\nDom drives a van and stops.\n\nDom walks to the barn."
                                    }), ee ? jsxs("div", {
                                        className: "mt-3 flex flex-wrap items-center gap-2",
                                        children: [jsxs("button", {
                                            type: "button",
                                            onClick: () => void rm("literal"),
                                            disabled: th || tj || eC.trim().length < 3,
                                            className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50",
                                            children: [jsx(Languages, {
                                                className: "h-4 w-4"
                                            }), ef ? "ترجمة حرفية" : "Literal translate"]
                                        }), "screenplay" !== tb || hasArabic(eC) ? "literal" !== tb || hasArabic(eC) ? null : jsx("span", {
                                            className: "rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200",
                                            children: ef ? "✓ ترجمة حرفية — جاهز" : "✓ Literal — ready"
                                        }) : jsx("span", {
                                            className: "rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200",
                                            children: ef ? "✓ Gemini — جاهز للتوليد" : "✓ Gemini — ready"
                                        })]
                                    }) : null, tx ? jsx("div", {
                                        className: "mt-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-100",
                                        role: "alert",
                                        children: J(tx, ef, ee)
                                    }) : null, ee && tw ? jsx("p", {
                                        className: `mt-2 text-[11px] leading-relaxed ${tw.startsWith("✓")?"text-emerald-200/90":"text-red-200/90"}`,
                                        children: tw
                                    }) : null, ee ? jsxs("div", {
                                        className: "mt-4 rounded-xl border border-[#22f0ff]/25 bg-[#22f0ff]/5 p-3",
                                        children: [jsx("p", {
                                            className: "text-xs font-semibold uppercase tracking-wide text-[#22f0ff]/90",
                                            children: ef ? "جودة التوليد" : "Generation quality"
                                        }), jsx("div", {
                                            className: "mt-3 grid grid-cols-3 gap-2",
                                            children: Object.keys(V).map(e => {
                                                let r = V[e],
                                                    a = ez === e;
                                                return jsx("button", {
                                                    type: "button",
                                                    onClick: () => ro(e),
                                                    className: `rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${a?"border-[#22f0ff]/50 bg-[#22f0ff]/15 text-[#22f0ff]":"border-white/10 bg-black/20 text-white/55 hover:border-[#22f0ff]/25"}`,
                                                    children: ef ? r.labelAr : r.labelEn
                                                }, e)
                                            })
                                        }), jsx("p", {
                                            className: "mt-2 text-center text-[11px] leading-relaxed text-white/50",
                                            children: ef ? rr.hintAr : rr.hintEn
                                        }), jsx("p", {
                                            className: "mt-1 text-center font-mono text-sm tabular-nums text-[#22f0ff]",
                                            children: rs
                                        }), jsx("p", {
                                            className: "mt-1 text-center text-[10px] text-white/40",
                                            children: ef ? `${rn} خطوات \xb7 Larry` : `${rn} steps \xb7 Larry`
                                        })]
                                    }) : null]
                                })
                            }), ee ? null : jsx("div", {
                                className: "rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5",
                                children: jsxs("label", {
                                    className: "block",
                                    children: [jsx("span", {
                                        className: "text-sm font-medium text-white/80",
                                        children: ef ? "الشخصيات (اختياري)" : "Characters (optional)"
                                    }), jsx("p", {
                                        className: "mt-0.5 text-[11px] text-white/40",
                                        children: ef ? "مواصفات المظهر — مثل: Dom = he, tall, brunette, white t-shirt" : "Appearance notes — e.g. Dom = he, tall, brunette, white t-shirt"
                                    }), jsx("textarea", {
                                        className: "mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0f1218] p-3 text-sm leading-relaxed text-white outline-none ring-[#22f0ff]/40 placeholder:text-white/30 focus:ring-2",
                                        rows: 3,
                                        value: e_,
                                        onChange: e => eR(e.target.value),
                                        placeholder: "Dom = he, tall, 35, brunette, white t-shirt, blue jeans"
                                    })]
                                })
                            }), ee ? null : jsxs("div", {
                                className: "rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5",
                                children: [jsx("p", {
                                    className: "mb-2 text-sm font-medium text-white/80",
                                    children: ef ? "جودة التوليد" : "Generation quality"
                                }), jsx("div", {
                                    className: "grid grid-cols-3 gap-2",
                                    children: Object.keys(V).map(e => {
                                        let r = V[e],
                                            a = ez === e;
                                        return jsx("button", {
                                            type: "button",
                                            onClick: () => ro(e),
                                            className: `rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${a?"border-[#22f0ff]/50 bg-[#22f0ff]/15 text-[#22f0ff]":"border-white/10 bg-black/20 text-white/55 hover:border-[#22f0ff]/25"}`,
                                            children: ef ? r.labelAr : r.labelEn
                                        }, e)
                                    })
                                }), jsx("p", {
                                    className: "mt-2 text-[11px] leading-relaxed text-white/40",
                                    children: ef ? rr.hintAr : rr.hintEn
                                }), jsx("p", {
                                    className: "mt-1 text-[10px] text-white/35",
                                    children: ef ? `الحالي: ${ra} MP \xb7 ${rr.steps} خطوات \xb7 ${rr.duration} ث` : `Current: ${ra} MP \xb7 ${rr.steps} steps \xb7 ${rr.duration}s`
                                })]
                            }), jsxs("div", {
                                className: "grid gap-4 sm:grid-cols-2",
                                children: [jsx("div", {
                                    className: "rounded-2xl border border-white/10 bg-[#141821] p-4",
                                    children: jsxs("label", {
                                        className: "block",
                                        children: [jsx("span", {
                                            className: "text-xs font-semibold uppercase tracking-wide text-white/45",
                                            children: ef ? "نسبة العرض" : "Aspect ratio"
                                        }), jsx("select", {
                                            value: eL,
                                            onChange: e => {
                                                let t = e.target.value;
                                                eG(t), ee && sessionStorage.setItem(X, t)
                                            },
                                            className: "mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2",
                                            children: q.map(e => jsx("option", {
                                                value: e,
                                                children: e
                                            }, e))
                                        })]
                                    })
                                }), ee ? null : jsx("div", {
                                    className: "rounded-2xl border border-white/10 bg-[#141821] p-4",
                                    children: jsxs("label", {
                                        className: "block",
                                        children: [jsx("span", {
                                            className: "text-xs font-semibold uppercase tracking-wide text-white/45",
                                            children: ef ? "الوضوح (MP)" : "Clarity (MP)"
                                        }), jsx("p", {
                                            className: "mt-1 text-[10px] text-white/40",
                                            children: ef ? "0.1 – 1 MP — كل القيم متاحة" : "0.1 – 1 MP — full range"
                                        }), jsx("input", {
                                            type: "range",
                                            min: .1,
                                            max: 1,
                                            step: .01,
                                            value: ra,
                                            onChange: e => eV(Number(e.target.value)),
                                            className: "mt-3 w-full accent-[#22f0ff]"
                                        }), jsx("p", {
                                            className: "mt-2 text-center font-mono text-sm tabular-nums text-[#22f0ff]",
                                            children: rs
                                        }), jsx("p", {
                                            className: "mt-1 text-center text-[10px] text-white/40",
                                            children: ef ? `${rn} خطوات \xb7 Turbo/Larry` : `${rn} steps \xb7 Turbo/Larry`
                                        }), jsx("div", {
                                            className: "mt-2 flex flex-wrap justify-center gap-1.5",
                                            children: L.map(e => jsx("button", {
                                                type: "button",
                                                onClick: () => eV(e),
                                                className: `rounded-lg border px-2 py-1 text-[10px] font-semibold tabular-nums transition ${ra===e?"border-[#22f0ff]/50 bg-[#22f0ff]/15 text-[#22f0ff]":"border-white/10 bg-black/20 text-white/50 hover:border-[#22f0ff]/25"}`,
                                                children: e
                                            }, e))
                                        })]
                                    })
                                }), jsxs("div", {
                                    className: "rounded-2xl border border-white/10 bg-[#141821] p-4 sm:col-span-2",
                                    children: [jsxs("label", {
                                        className: "block",
                                        children: [jsx("span", {
                                            className: "text-xs font-semibold uppercase tracking-wide text-white/45",
                                            children: eT ? ef ? "فيرونيكس أوتو — 15 ث/فقرة · حتى 120 ث" : "Vyronix Auto — 15s/paragraph · up to 120s" : ef ? `مدة اللقطة — حتى ${eE} ث` : `Shot length — up to ${eE}s`
                                        }), jsx("p", {
                                            className: "mt-1 text-[10px] text-white/40",
                                            children: eT ? ef ? "Turbo/Larry · 15 ث لكل فقرة — كل فقرة = لقطة (سطر فارغ بين الفقرات)." : "Turbo/Larry · 15s per paragraph — each paragraph = one shot (blank line between)." : ee ? ef ? `لقطة واحدة حتى ${eE} ث — حرّك الشريط (بدون أوتو).` : `Single shot up to ${eE}s — use the slider (no Auto needed).` : ef ? "H3 (Smite79) ~15 ث/لقطة — للفيدio الأطول فعّل «أوتو» أو أضف لقطات (سطر فارغ)." : "H3 (Smite79) ~15s per shot — for longer video enable Auto or add shots (blank line)."
                                        }), jsx("input", {
                                            type: "range",
                                            min: 1,
                                            max: eE,
                                            step: 1,
                                            value: eT ? ri.expectedTotalSeconds : eH,
                                            disabled: eT,
                                            onChange: e => eF(Number(e.target.value)),
                                            className: "mt-3 w-full accent-[#22f0ff] disabled:opacity-40"
                                        }), jsxs("p", {
                                            className: "mt-2 text-center font-mono text-lg font-bold tabular-nums text-[#22f0ff]",
                                            children: [eT ? ri.expectedTotalSeconds : eH, jsx("span", {
                                                className: "text-sm font-normal text-white/50",
                                                children: eT ? ef ? " ث (كلي)" : "s total" : ee ? ef ? " ث (لقطة واحدة)" : "s (single shot)" : ef ? " ث/لقطة" : "s/shot"
                                            })]
                                        }), jsx("p", {
                                            className: "mt-1 text-center text-[10px] text-white/45",
                                            children: eT ? ef ? `≈ ${ri.beatCount} فقرة \xd7 15 ث → ~${ri.expectedTotalSeconds} ث` : `≈ ${ri.beatCount} paragraphs \xd7 15s → ~${ri.expectedTotalSeconds}s` : ee ? ef ? `لقطة واحدة → ${eH} ث` : `Single shot → ${eH}s` : ef ? `≈ ${ri.perShotSeconds.toFixed(1)} ث/لقطة \xd7 ${ri.beatCount} → ~${ri.expectedTotalSeconds} ث` : `≈ ${ri.perShotSeconds.toFixed(1)}s/shot \xd7 ${ri.beatCount} → ~${ri.expectedTotalSeconds}s`
                                        }), eT ? jsx("p", {
                                            className: "mt-2 text-center text-[10px] text-amber-200/75",
                                            children: ef ? `≈ ${ri.expectedTotalSeconds} ث = ${ri.beatCount} فقرة \xd7 15 ث — لا توسيع تلقائي.` : `≈ ${ri.expectedTotalSeconds}s = ${ri.beatCount} paragraphs \xd7 15s — no auto expansion.`
                                        }) : !(eH > 6) || ee || eT ? null : jsx("p", {
                                            className: "mt-2 text-center text-[10px] text-amber-200/75",
                                            children: ef ? "المدة الأطول تأخذ وقتاً أكثر — لا تغلق الصفحة" : "Longer durations take more time — keep this page open"
                                        })]
                                    }), jsxs("label", {
                                        className: "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3",
                                        children: [jsx("input", {
                                            type: "checkbox",
                                            checked: eT,
                                            onChange: e => eD(e.target.checked),
                                            className: "mt-0.5 h-4 w-4 shrink-0 accent-[#22f0ff]"
                                        }), jsxs("span", {
                                            className: "text-sm leading-relaxed text-white/75",
                                            children: [jsx("span", {
                                                className: "font-semibold text-[#22f0ff]",
                                                children: ef ? "فيرونيكس أوتو" : "Vyronix Auto"
                                            }), " — ", ef ? "15 ث × عدد الفقرات = المدة (حتى 120 ث) — سطر فارغ بين الفقرات." : "15s × paragraph count = duration (up to 120s) — blank line between paragraphs."]
                                        })]
                                    })]
                                }), ee ? jsxs("div", {
                                    className: "space-y-3 sm:col-span-2",
                                    children: [jsxs("div", {
                                        className: "rounded-2xl border border-[#22f0ff]/25 bg-[#141821] p-3",
                                        dir: ep,
                                        children: [jsxs("div", {
                                            className: "flex items-stretch gap-2",
                                            children: [jsxs("div", {
                                                className: "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 bg-black/20 px-2 py-1.5",
                                                "aria-label": eh.create.outputCount,
                                                children: [jsx("span", {
                                                    className: "text-[10px] font-semibold text-white/55",
                                                    children: ef ? "عدد" : "Count"
                                                }), jsxs("div", {
                                                    className: "flex items-center gap-1",
                                                    children: [jsx("button", {
                                                        type: "button",
                                                        onClick: () => tm(e => Math.max(1, e - 1)),
                                                        disabled: tu <= 1 || tj,
                                                        className: "flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40",
                                                        "aria-label": ef ? "إنقاص العدد" : "Decrease count",
                                                        children: jsx(Minus, {
                                                            className: "h-4 w-4"
                                                        })
                                                    }), jsx("span", {
                                                        className: "min-w-[1.5rem] text-center text-base font-black tabular-nums text-white",
                                                        children: tu
                                                    }), jsx("button", {
                                                        type: "button",
                                                        onClick: () => tm(e => Math.min(rA, e + 1)),
                                                        disabled: tu >= rA || tj,
                                                        className: "flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40",
                                                        "aria-label": ef ? "زيادة العدد" : "Increase count",
                                                        children: jsx(Plus, {
                                                            className: "h-4 w-4"
                                                        })
                                                    })]
                                                }), jsx("span", {
                                                    className: "text-[9px] text-white/40",
                                                    children: ef ? `حتى ${rA} معاً` : `Up to ${rA} parallel`
                                                })]
                                            }), tF && ee ? jsxs("button", {
                                                type: "button",
                                                disabled: rS,
                                                onClick: () => {
                                                    rS || rx(!0)
                                                },
                                                title: ef ? "توليد بالبرومبت الأصلي الأخير دون تعديل (أدمن)" : "Generate last original prompt unchanged (admin)",
                                                className: "flex h-[3.25rem] max-w-[38%] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-2 text-[10px] font-bold leading-tight text-amber-50 disabled:opacity-50 sm:max-w-none sm:px-3 sm:text-xs",
                                                children: [jsx("span", {
                                                    children: ef ? "جنريت آخر" : "Last orig."
                                                }), jsx("span", {
                                                    className: "font-normal text-amber-100/75",
                                                    children: ef ? "أصلي" : "prompt"
                                                })]
                                            }) : null, jsxs("button", {
                                                type: "button",
                                                disabled: rS,
                                                "aria-disabled": rS,
                                                onClick: () => {
                                                    rS || rx()
                                                },
                                                className: "flex h-[3.25rem] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(34,240,255,0.2)] disabled:cursor-not-allowed disabled:opacity-75 sm:gap-2 sm:px-5 sm:text-base",
                                                children: [rk ? jsx(Loader2, {
                                                    className: "h-5 w-5 animate-spin"
                                                }) : jsx(Sparkles, {
                                                    className: "h-5 w-5"
                                                }), rI]
                                            }), rk ? jsxs("button", {
                                                type: "button",
                                                disabled: tN,
                                                onClick: () => void ru(),
                                                className: "flex h-[3.25rem] shrink-0 items-center justify-center gap-1 rounded-2xl border border-red-400/45 bg-red-500/15 px-3 text-xs font-bold text-red-100 disabled:opacity-60 sm:px-4 sm:text-sm",
                                                children: [tN ? jsx(Loader2, {
                                                    className: "h-4 w-4 animate-spin"
                                                }) : jsx(Square, {
                                                    className: "h-4 w-4 fill-current"
                                                }), tN ? ef ? "إيقاف…" : "Stop…" : ef ? "إيقاف" : "Stop"]
                                            }) : null]
                                        }), r_ ? jsx("div", {
                                            className: "mt-2",
                                            children: r_
                                        }) : null]
                                    }), rU && !Z ? jsxs("div", {
                                        className: "space-y-2 rounded-2xl border border-[#22f0ff]/30 bg-[#0b0d12] p-2.5 sm:p-3",
                                        children: [jsxs("div", {
                                            className: "flex flex-wrap items-center justify-between gap-2 px-0.5",
                                            children: [jsx("p", {
                                                className: "text-[11px] font-semibold uppercase tracking-wide text-[#22f0ff]/90",
                                                children: tj ? F(e8, ef, ee) || (ef ? "جاري التوليد…" : "Generating…") : rC > 1 ? ef ? `جاري توليد ${rC} فيديو` : `Generating ${rC} videos` : ef ? eh.create.resultVideos : "Generation result"
                                            }), jsxs("div", {
                                                className: "flex items-center gap-2",
                                                children: [tj ? jsx(GenerateClock, {
                                                    startedAt: rP,
                                                    size: "compact"
                                                }) : null, jsx(Link, {
                                                    href: "/assets",
                                                    className: "text-xs font-semibold text-emerald-300",
                                                    children: ef ? "Assets ←" : "Assets →"
                                                })]
                                            })]
                                        }), rC > 1 ? jsx("div", {
                                            className: "grid grid-cols-2 gap-1.5 sm:gap-2",
                                            children: Array.from({
                                                length: rC
                                            }, (e, r) => {
                                                let a = tl.find(e => e.index === r) ?? {
                                                        index: r,
                                                        seed: 0,
                                                        status: "pending"
                                                    },
                                                    n = a.videoUrl,
                                                    s = tj || "generating" === a.status || "pending" === a.status && !!a.jobId;
                                                return jsxs("div", {
                                                    className: "overflow-hidden rounded-xl border border-white/10 bg-[#141821]",
                                                    children: [jsxs("div", {
                                                        className: "flex items-center justify-between border-b border-white/8 px-2 py-1",
                                                        children: [jsx("span", {
                                                            className: "text-[10px] font-semibold text-white/75",
                                                            children: ef ? `فيديو ${r+1}` : `Video ${r+1}`
                                                        }), s ? jsx(Loader2, {
                                                            className: "h-3 w-3 animate-spin text-[#22f0ff]"
                                                        }) : n ? jsx("span", {
                                                            className: "text-[9px] text-emerald-300",
                                                            children: ef ? "جاهز" : "Ready"
                                                        }) : "error" === a.status ? jsx("span", {
                                                            className: "text-[9px] text-red-300",
                                                            children: ef ? "فشل" : "Failed"
                                                        }) : null]
                                                    }), n ? jsx("video", {
                                                        src: n,
                                                        controls: !0,
                                                        playsInline: !0,
                                                        preload: "metadata",
                                                        className: "aspect-[9/16] w-full bg-black object-cover"
                                                    }) : jsx("div", {
                                                        className: "flex aspect-[9/16] w-full flex-col items-center justify-center gap-1.5 px-2 text-center",
                                                        children: "error" === a.status ? jsx("span", {
                                                            className: "text-[10px] text-red-300/90",
                                                            children: a.error || (ef ? "فشل" : "Failed")
                                                        }) : s ? jsxs(Fragment, {
                                                            children: [jsx(Loader2, {
                                                                className: "h-5 w-5 animate-spin text-[#22f0ff]"
                                                            }), jsx("span", {
                                                                className: "text-[10px] text-white/55",
                                                                children: F(a.progress, ef, ee) || (ef ? "جاري…" : "Generating…")
                                                            })]
                                                        }) : jsx("span", {
                                                            className: "text-[10px] text-white/35",
                                                            children: ef ? "بانتظار" : "Waiting"
                                                        })
                                                    })]
                                                }, r)
                                            })
                                        }) : tj && !ts ? jsxs("div", {
                                            className: "flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#141821] px-4 py-8",
                                            children: [jsx(GenerateClock, {
                                                startedAt: rP,
                                                size: "large"
                                            }), jsx("p", {
                                                className: "text-xs font-semibold text-white/75",
                                                children: F(e8, ef, ee) || (ef ? "جاري التوليد…" : "Generating…")
                                            })]
                                        }) : ts ? jsx("video", {
                                            src: ts,
                                            controls: !0,
                                            playsInline: !0,
                                            preload: "metadata",
                                            className: "w-full rounded-xl border border-white/10"
                                        }, ts) : null, tj ? jsxs("div", {
                                            className: "flex items-center justify-between gap-2 border-t border-white/8 pt-2",
                                            children: [jsx("p", {
                                                className: "min-w-0 truncate text-[10px] text-amber-100/85",
                                                children: F(e8, ef, ee) || (ef ? "جاري التوليد…" : "Generating…")
                                            }), jsx("button", {
                                                type: "button",
                                                disabled: tN,
                                                onClick: () => void ru(),
                                                className: "shrink-0 rounded-lg border border-red-400/45 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-100 disabled:opacity-60",
                                                children: tN ? ef ? "إيقاف…" : "Stop…" : ef ? "إيقاف" : "Stop"
                                            })]
                                        }) : null]
                                    }) : null]
                                }) : null]
                            })]
                        })
                    }), ee ? null : jsxs(Fragment, {
                        children: [jsxs("button", {
                            type: "button",
                            onClick: () => eW(e => !e),
                            className: "flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#141821] px-4 py-2.5 text-xs font-medium text-white/55",
                            children: [ef ? "إعدادات متقدمة (اختياري)" : "Advanced settings (optional)", jsx(ChevronDown, {
                                className: `h-4 w-4 transition ${eB?"rotate-180":""}`
                            })]
                        }), eB ? jsxs("div", {
                            className: "space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4",
                            children: [jsxs("label", {
                                className: "block",
                                children: [jsx("span", {
                                    className: "text-xs font-semibold uppercase tracking-wide text-white/45",
                                    children: ef ? "Seed (نفس Space)" : "Seed (same as Space)"
                                }), jsx("input", {
                                    type: "number",
                                    min: 0,
                                    max: 0x7fffffff,
                                    value: eX,
                                    onChange: e => eY(Math.max(0, Number(e.target.value) || 0)),
                                    className: "mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2"
                                }), jsx("p", {
                                    className: "mt-1 text-[10px] text-white/40",
                                    children: ef ? "الافتراضي 42 — نفس /space" : "Default 42 — matches /space"
                                })]
                            }), jsxs("label", {
                                className: "block",
                                children: [jsx("span", {
                                    className: "text-xs font-semibold uppercase tracking-wide text-white/45",
                                    children: "LoRA"
                                }), jsxs("select", {
                                    value: eK,
                                    onChange: e => eQ(e.target.value),
                                    className: "mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2",
                                    children: [jsx("option", {
                                        value: "larry",
                                        children: "Larry (Turbo)"
                                    }), jsx("option", {
                                        value: "lightx",
                                        children: "LightX"
                                    }), jsx("option", {
                                        value: "off",
                                        children: ef ? "إيقاف" : "Off"
                                    })]
                                })]
                            }), jsxs("label", {
                                className: "flex items-center gap-2 text-sm text-white/70",
                                children: [jsx("input", {
                                    type: "checkbox",
                                    checked: eZ,
                                    onChange: e => e0(e.target.checked)
                                }), ef ? "خطة نصية فقط — بدون فيديو" : "Text plan only — no video"]
                            })]
                        }) : null]
                    }), r ? jsx("div", {
                        className: "space-y-4",
                        children: r
                    }) : null, ee ? null : jsxs(Fragment, {
                        children: [jsxs("button", {
                            type: "button",
                            disabled: rS,
                            "aria-disabled": rS,
                            onClick: () => {
                                rS || rx()
                            },
                            className: "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#22f0ff] to-[#7c5cff] px-4 py-3.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50",
                            children: [tj ? jsx(Loader2, {
                                className: "h-4 w-4 animate-spin"
                            }) : jsx(Sparkles, {
                                className: "h-4 w-4"
                            }), rI]
                        }), r_]
                    }), tj && !ee ? jsxs("div", {
                        className: "rounded-2xl border border-[#22f0ff]/25 bg-[#22f0ff]/5 px-4 py-4",
                        children: [jsx(Q, {
                            elapsedMs: tI,
                            elapsedSec: tQ,
                            active: tj
                        }), jsx("p", {
                            className: "mt-3 text-center text-sm text-amber-100/90",
                            children: F(e8, ef, ee) || (ef ? "قد يستغرق عدة دقائق — لا تغلق الصفحة" : "May take several minutes — keep this page open")
                        }), jsxs("button", {
                            type: "button",
                            disabled: tN,
                            onClick: () => void ru(),
                            className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/45 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100 disabled:cursor-not-allowed disabled:opacity-60",
                            children: [tN ? jsx(Loader2, {
                                className: "h-4 w-4 animate-spin"
                            }) : jsx(Square, {
                                className: "h-4 w-4 fill-current"
                            }), tN ? ef ? "جاري الإيقاف…" : "Stopping…" : ef ? "إيقاف التوليد" : "Stop generation"]
                        })]
                    }) : null, ta && ta !== tt && !ee ? jsxs("div", {
                        className: "rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/70",
                        children: [jsx("p", {
                            className: "mb-1 font-semibold text-white/85",
                            children: ef ? "وصفك (عربي):" : "Your prompt (Arabic):"
                        }), jsx("pre", {
                            className: "whitespace-pre-wrap",
                            dir: "rtl",
                            children: ta
                        })]
                    }) : null, tt ? jsxs("div", {
                        className: "rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/70",
                        children: [jsx("p", {
                            className: "mb-1 font-semibold text-white/85",
                            children: ef ? ee ? "الوصف المُرسل للـ GPU (مترجم — إنجليزي):" : "الوصف المُرسل (مترجم — إنجليزي):" : ee ? "Prompt sent to GPU (translated English):" : "Prompt sent (translated English):"
                        }), jsx("pre", {
                            className: "whitespace-pre-wrap",
                            children: tt
                        })]
                    }) : null, e9 && !tj ? jsx("pre", {
                        className: "max-h-64 overflow-auto rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/75 whitespace-pre-wrap",
                        children: e9
                    }) : null]
                })]
            }), jsx(BottomNav, {})]
        }) : jsxs("div", {
            className: "min-h-screen bg-[#0b0d12] px-4 py-12 text-center text-white",
            children: [jsx("p", {
                className: "mb-4",
                children: ef ? "سجّل الدخول لاستخدام المختبر" : "Sign in to use H3 Lab"
            }), jsx(Link, {
                href: loginHref(e),
                className: "text-[#22f0ff] underline",
                children: ef ? "تسجيل الدخول" : "Login"
            })]
        }) : jsx("div", {
            className: "flex min-h-screen items-center justify-center bg-[#0b0d12]",
            children: jsx(Loader2, {
                className: "h-8 w-8 animate-spin text-[#22f0ff]"
            })
        })
    }