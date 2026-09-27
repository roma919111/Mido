// @ts-nocheck
"use client";

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

function h({
        ar: e = !1,
        onLinked: i,
        podReady: r = !1,
        notified: s = !1,
        defaultVyronixId: l
    }) {
        let {
            t: o
        } = useLocale(), [c, u] = useState(""), [f, g] = useState(!1), [m, p] = useState("");
        useEffect(() => {
            null != l && l > 0 ? u(String(l)) : u("")
        }, [l]);
        let y = useCallback(async t => {
            let n = Number((t ?? c).trim());
            if (!Number.isFinite(n) || n <= 0) return p(e ? "أدخل رقم فيرونيكس ID صحيحاً" : "Enter a valid Vyronix ID number"), !1;
            g(!0), p("");
            try {
                let {
                    res: t,
                    data: r
                } = await fetchJson("/api/h3-lab/rental/link", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        vyronixId: n
                    })
                });
                if (!t.ok || !r?.ok) return p(r?.message || (e ? "تعذّر الربط — تحقق من الرقم" : "Link failed — check your ID")), !1;
                return i?.({
                    vyronixId: r.vyronixId,
                    endsAt: r.endsAt,
                    startedAt: r.startedAt
                }), !0
            } catch {
                return p(e ? "تعذّر الاتصال" : "Connection failed"), !1
            } finally {
                g(!1)
            }
        }, [e, i, c]);
        return jsxs("div", {
            className: "overflow-hidden rounded-3xl border border-[#22f0ff]/30 bg-[#141821]/95 p-5 sm:p-6",
            children: [jsxs("div", {
                className: "flex items-center gap-2 text-[#22f0ff]",
                children: [jsx(Link2, {
                    className: "h-5 w-5"
                }), jsx("h2", {
                    className: "text-lg font-bold text-white",
                    children: o.studioRental.linkTitle
                })]
            }), jsx("p", {
                className: "mt-2 text-sm leading-relaxed text-white/65",
                children: o.studioRental.linkBody
            }), r ? null != l && l > 0 ? jsx("p", {
                className: "mt-2 text-xs font-semibold text-[#22f0ff]/95",
                children: e ? `فيرونيكس ID: ${l} — أدخل الرقم واضغط ربط` : `Vyronix ID: ${l} — enter it and tap Link`
            }) : s ? jsx("p", {
                className: "mt-2 text-xs font-semibold text-emerald-200/90",
                children: e ? "✓ GPU جاهز — أدخل ID واضغط ربط لبدء الساعتين" : "✓ GPU ready — enter ID and tap Link to start your 2 hours"
            }) : r ? jsx("p", {
                className: "mt-2 text-xs font-semibold text-emerald-200/90",
                children: e ? "✓ GPU جاهز — أدخل Vyronix ID واضغط ربط" : "✓ GPU ready — enter Vyronix ID and tap Link"
            }) : null : jsx("p", {
                className: "mt-2 text-xs leading-relaxed text-amber-200/85",
                children: e ? "جاري تجهيز GPU — عند الجاهزية أدخل Vyronix ID واضغط ربط" : "GPU is preparing — when ready, enter your Vyronix ID and tap Link"
            }), jsxs("label", {
                className: "mt-4 block",
                children: [jsx("span", {
                    className: "text-xs font-semibold text-white/75",
                    children: o.studioRental.linkLabel
                }), jsx("input", {
                    type: "text",
                    inputMode: "numeric",
                    dir: "ltr",
                    value: c,
                    onChange: e => u(e.target.value.replace(/[^\d]/g, "")),
                    placeholder: o.studioRental.linkPlaceholder,
                    className: "mt-2 w-full rounded-xl border border-white/12 bg-[#0f1218] px-3 py-3 font-mono text-lg tracking-wide text-white outline-none ring-[#22f0ff]/40 focus:ring-2"
                })]
            }), m ? jsx("p", {
                className: "mt-2 text-sm text-red-300",
                children: m
            }) : null, jsxs("button", {
                type: "button",
                disabled: f || c.trim().length < 4,
                onClick: () => void y(),
                className: "mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-3 text-sm font-extrabold text-[#0b0d12] disabled:opacity-50",
                children: [f ? jsx(Loader2, {
                    className: "h-4 w-4 animate-spin"
                }) : null, o.studioRental.linkButton]
            })]
        })
    }

    function y() {
        let e = readH3RentalCache(),
            t = readRentalClockAnchor();
        if (!e && !t) return null;
        let i = resolveStableRentalClock({
                sessionId: e?.sessionId ?? t?.sessionId,
                endsAt: e?.endsAt ?? t?.endsAt,
                startedAt: e?.startedAt ?? t?.startedAt,
                remainingMs: e?.remainingMs
            }),
            n = i.endsAt ? remainingMsUntil(i.endsAt) : e?.remainingMs ?? 0,
            r = !!(i.endsAt && remainingMsUntil(i.endsAt) > 0),
            a = r || !!e?.active || !!e?.provisioning || !!(e?.frozenRemainingMs && e.frozenRemainingMs > 0),
            s = !!e?.provisioning && !e?.podReady;
        return a || s ? {
            active: a,
            status: s ? "provisioning" : "active",
            sessionId: e?.sessionId ?? t?.sessionId,
            remainingMs: r ? remainingMsUntil(i.endsAt) : n,
            endsAt: i.endsAt,
            startedAt: i.startedAt,
            podReady: !!e?.podReady,
            provisioning: !!(e?.provisioning || e?.awaitingLink),
            awaitingLink: !!e?.awaitingLink,
            studioAvailable: !0,
            priceUsd: STUDIO_RENTAL_PRICE_USD,
            vastCostEstimateUsd: VAST_H3_ESTIMATED_COST_PER_HOUR_USD,
            gpuFailover: e?.gpuFailover,
            frozenRemainingMs: e?.frozenRemainingMs
        } : ((!i.endsAt || 0 >= remainingMsUntil(i.endsAt)) && clearH3RentalCache(), null)
    }
    export default function AiRentalStudioClient() {
        let e = useRouter(),
            {
                user: x,
                ready: b,
                logout: v,
                refreshing: k
            } = useCustomerUser(),
            {
                locale: w,
                t: A
            } = useLocale(),
            R = "ar" === w,
            I = useSearchParams(),
            N = "1" === I.get("rental") && (!!I.get("session_id")?.trim() || "1" === I.get("test_rental") || "1" === I.get("preparing")),
            [S, L] = useState(() => y()),
            [j, M] = useState(() => null === y()),
            [_, E] = useState(""),
            [T, D] = useState(N),
            [C, U] = useState(!1),
            O = useRef(!!(y()?.active || y()?.provisioning)),
            P = useRef(!1);
        useEffect(() => {
            "1" === I.get("checkout") && e.replace(STUDIO_RENTAL_PRICING_PATH)
        }, [I, e]);
        let F = useCallback(async () => {
                if (!x) {
                    L(null), clearH3RentalCache(), M(!0);
                    return
                }
                try {
                    let e = await fetch("/api/h3-lab/rental", {
                        cache: "no-store"
                    });
                    if (e.ok) {
                        let t = await e.json(),
                            i = resolveStableRentalClock(t),
                            n = {
                                ...t,
                                endsAt: i.endsAt ?? t.endsAt,
                                startedAt: i.startedAt ?? t.startedAt,
                                active: t.active || !!t.awaitingLink || !!(i.endsAt && remainingMsUntil(i.endsAt) > 0) || !!(t.frozenRemainingMs && t.frozenRemainingMs > 0),
                                provisioning: !!(t.provisioning || t.active && !t.podReady),
                                podReady: !!t.podReady,
                                awaitingLink: !!t.awaitingLink,
                                customerLinked: !!t.customerLinked
                            };
                        L(n), writeH3RentalCache(n), (t.active || t.provisioning) && (O.current = !0);
                        let r = !!(i.endsAt && remainingMsUntil(i.endsAt) > 0);
                        "ended" === t.status || "failed" === t.status ? r || (clearH3RentalCache(), O.current = !1) : r || t.active || t.provisioning || t.endsAt || t.frozenRemainingMs && t.frozenRemainingMs > 0 || (clearH3RentalCache(), O.current = !1)
                    } elsereadH3RentalCache()
                } catch {} finally {
                    M(!0)
                }
            }, [x]),
            V = useCallback(async () => {
                if (x && isAdminUser(x)) {
                    U(!0), clearH3RentalCache(), O.current = !1, L(null);
                    try {
                        await fetch("/api/h3-lab/rental/reset-link", {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                fresh: !0
                            })
                        })
                    } catch {} finally {
                        U(!1)
                    }
                    await F()
                }
            }, [x, F]);
        useEffect(() => {
            N || F()
        }, [F, N]), useEffect(() => {
            let e = "1" === I.get("refresh");
            x && b && e && isAdminUser(x) && !N && (async () => {
                await V(), window.history.replaceState({}, "", AI_RENTAL_STUDIO_PATH)
            })()
        }, [x, b, I, V, N]), useEffect(() => {
            let e = I.get("session_id")?.trim(),
                t = "1" === I.get("rental"),
                i = "1" === I.get("test_rental");
            x && t && (e || i || "1" === I.get("preparing")) && (P.current || (P.current = !0, (async () => {
                D(!0), E("");
                let t = !1;
                try {
                    if (e) {
                        let i = !1;
                        for (let n = 0; n < 10; n += 1) {
                            let r = await fetch("/api/billing/confirm", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    credentials: "include",
                                    body: JSON.stringify({
                                        sessionId: e
                                    })
                                }),
                                a = await r.json();
                            if (r.ok && !1 !== a.ok) {
                                i = !0;
                                break
                            }
                            if ("not_paid" === a.reason && n < 9) {
                                await new Promise(e => setTimeout(e, 2e3));
                                continue
                            }
                            if ("already_processed" === a.reason) {
                                i = !0;
                                break
                            }
                            E(a.error || A.studioRental.confirmPaymentFailed), t = !0;
                            break
                        }
                        i || t || E(A.studioRental.confirmPaymentFailed)
                    }
                    await F(), O.current = !0
                } catch {
                    E(A.studioRental.confirmPaymentFailed), await F()
                } finally {
                    D(!1), window.history.replaceState({}, "", AI_RENTAL_STUDIO_PATH)
                }
            })()))
        }, [x, I, F, A.studioRental.confirmPaymentFailed]);
        let z = useMemo(() => resolveStableRentalClock(S), [S?.sessionId, S?.endsAt, S?.startedAt, S?.remainingMs, S?.awaitingLink]),
            H = z.endsAt ?? S?.endsAt,
            G = z.startedAt ?? S?.startedAt,
            X = !!(H && remainingMsUntil(H) > 0),
            $ = X && !S?.gpuFailover && !S?.rentalFrozen && !!S?.podReady;
        useEffect(() => {
            if (!S?.active && !S?.provisioning && !S?.gpuFailover || $) return;
            let e = S?.gpuFailover || S?.provisioning ? 8e3 : 2e4,
                t = window.setInterval(() => void F(), e);
            return () => window.clearInterval(t)
        }, [S?.active, S?.provisioning, S?.gpuFailover, S?.rentalFrozen, S?.podReady, $, F]);
        let B = useMemo(() => {
                let e = readH3RentalCache();
                return !!e && (!!(e.frozenRemainingMs && e.frozenRemainingMs > 0 || e.gpuFailover || e.endsAt && remainingMsUntil(e.endsAt) > 0) || !!(e.provisioning || e.awaitingLink))
            }, [S]),
            W = !!(H && 0 >= remainingMsUntil(H) && !S?.frozenRemainingMs);
        useEffect(() => {
            H && W && (clearH3RentalCache(), O.current = !1, F())
        }, [W, H, F]);
        let J = useMemo(() => !!x && !!j && !W && (!!(S?.gpuFailover || S?.rentalFrozen || S?.endsAt && remainingMsUntil(S.endsAt) > 0 || S?.active || S?.provisioning) || !!B || !!O.current), [x, S, j, B, W]),
            q = !!S?.customerLinked,
            K = !!S?.runpodStudio,
            Y = !!(x && !q && !K),
            Z = !!(x && J && (q || K));
        useEffect(() => {
            if (!x || q) return;
            let e = window.setInterval(() => void F(), 1e4);
            return () => window.clearInterval(e)
        }, [x, q, F]);
        let Q = useCallback(e => {
                O.current = !0, writeH3RentalCache({
                    active: !0,
                    provisioning: !0,
                    awaitingLink: !1,
                    podReady: !1,
                    customerLinked: !0,
                    endsAt: e.endsAt,
                    startedAt: e.startedAt
                }), L(t => t ? {
                    ...t,
                    awaitingLink: !1,
                    customerLinked: !0,
                    provisioning: !0,
                    podReady: !1,
                    vyronixId: e.vyronixId ?? t.vyronixId,
                    endsAt: e.endsAt ?? t.endsAt,
                    startedAt: e.startedAt ?? t.startedAt,
                    active: !0
                } : t), F()
            }, [F]),
            ee = S ?? {
                active: !0,
                status: "provisioning",
                remainingMs: 0,
                podReady: !1,
                provisioning: !0,
                awaitingLink: !0,
                studioAvailable: !0,
                priceUsd: STUDIO_RENTAL_PRICE_USD,
                vastCostEstimateUsd: VAST_H3_ESTIMATED_COST_PER_HOUR_USD
            },
            et = Y ? jsxs("div", {
                className: "sticky top-14 z-30 rounded-2xl bg-[#0b0d12]/95 pb-1 pt-1 backdrop-blur-md",
                children: [jsx("p", {
                    className: "mb-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c5cff]",
                    children: R ? "ربط Vyronix ID مع فيرونيكس" : "Link Vyronix ID to Vyronix"
                }), S?.vyronixId ? jsx("div", {
                    className: "mb-3 flex justify-center",
                    children: jsx(VyronixIdBadge, {
                        vyronixId: S.vyronixId,
                        prepStartedAt: S.prepStartedAt,
                        ar: R
                    })
                }) : null, jsx(h, {
                    ar: R,
                    podReady: ee.podReady,
                    defaultVyronixId: ee.vyronixId,
                    notified: !!(ee.gpuReadyNotified || ee.whatsappNotified || ee.emailNotified),
                    onLinked: Q
                })]
            }) : null,
            ei = isAdminUser(x) ? jsx("div", {
                className: "flex justify-center",
                children: jsxs("button", {
                    type: "button",
                    disabled: C,
                    onClick: () => void V(),
                    className: "inline-flex items-center gap-2 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-1.5 text-[11px] font-semibold text-[#c8fbff] disabled:opacity-50",
                    children: [C ? jsx(Loader2, {
                        className: "h-3.5 w-3.5 animate-spin"
                    }) : jsx(RefreshCw, {
                        className: "h-3.5 w-3.5"
                    }), R ? "↻ بداية جديدة (admin)" : "↻ Fresh start (admin)"]
                })
            }) : null,
            en = !b || !x || J || T || isAdminUser(x) ? null : jsxs("div", {
                className: "rounded-2xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-4 py-3 text-center text-sm text-white/85",
                children: [jsx("p", {
                    children: R ? "اشترك من صفحة الباقات — سيصلك Vyronix ID على الواتساب أو الإيميل بعد التجهيز." : "Subscribe on the pricing page — your Vyronix ID arrives on WhatsApp or email when ready."
                }), jsx(Link, {
                    href: STUDIO_RENTAL_PRICING_PATH,
                    className: "mt-2 inline-block font-bold text-[#22f0ff] underline underline-offset-2",
                    children: R ? "← الباقات · فيرونيكس" : "← Pricing · Vyronix"
                })]
            }),
            er = x ? et || en ? jsxs("div", {
                className: "space-y-3",
                children: [et, en]
            }) : null : jsxs("div", {
                className: "rounded-2xl border border-[#22f0ff]/30 bg-[#22f0ff]/8 px-4 py-3 text-center text-sm text-white/85",
                children: [jsx("p", {
                    children: R ? "سجّل الدخول لربط Vyronix ID مع فيرونيكس" : "Sign in to link your Vyronix ID to Vyronix"
                }), jsx(Link, {
                    href: loginHref(AI_RENTAL_STUDIO_PATH),
                    className: "mt-2 inline-block font-bold text-[#22f0ff] underline underline-offset-2",
                    children: R ? "تسجيل الدخول" : "Sign in"
                })]
            }),
            ea = T ? jsx("div", {
                className: "pointer-events-none fixed inset-0 z-50 flex items-start justify-center bg-[#0b0d12]/75 px-4 pt-24",
                children: jsxs("div", {
                    className: "pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-[#22f0ff]/30 bg-[#10141c] px-6 py-8 text-center shadow-xl",
                    children: [jsx(Loader2, {
                        className: "h-8 w-8 animate-spin text-[#22f0ff]"
                    }), jsx("p", {
                        className: "text-sm text-white/75",
                        children: R ? "جاري تأكيد الدفع وتشغيل فيرونيكس…" : "Confirming payment and launching Vyronix…"
                    })]
                })
            }) : null;
        return b && (x && isAdminUser(x) || !x || j) ? jsxs(Fragment, {
            children: [ea, _ ? jsx("div", {
                className: "fixed left-0 right-0 top-16 z-40 mx-auto max-w-md px-4",
                children: jsx("p", {
                    className: "rounded-xl border border-red-400/30 bg-red-950/80 px-3 py-2 text-center text-sm text-red-200",
                    children: _
                })
            }) : null, jsx(H3LabClient, {
                gpuOnly: !0,
                guestStudioPreview: !0,
                hideHeroCard: !0,
                returnPath: AI_RENTAL_STUDIO_PATH,
                topSection: er,
                extraSection: ei,
                needsVyronixLink: Y,
                studioUnlocked: Z,
                paidHourActive: X,
                rentalEndsAt: H,
                rentalStartedAt: G,
                rentalGpuFailover: S?.gpuFailover,
                rentalFrozen: S?.rentalFrozen,
                rentalPodReady: S?.podReady,
                rentalCanGenerate: !!(S?.canGenerate || X && (S?.podReady || K) && (q || K)),
                rentalVyronixId: S?.vyronixId,
                rentalPrepStartedAt: S?.prepStartedAt
            })]
        }) : jsx("div", {
            className: "flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d12] px-6",
            children: jsx(Loader2, {
                className: "h-8 w-8 animate-spin text-[#22f0ff]"
            })
        })
    }