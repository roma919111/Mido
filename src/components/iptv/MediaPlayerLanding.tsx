"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import {
  MEDIA_PLAYER_ACTIVATE_PATH,
  MEDIA_PLAYER_PRICE_SAR,
  MEDIA_PLAYER_PRODUCT_NAME_AR,
  MEDIA_PLAYER_SOURCE_STORAGE_KEY,
  formatMediaPlayerPrice,
  sanitizeTrafficSource,
} from "@/lib/media-player-commerce";
import { IPTV_BRAND_LOGO } from "./IptvBrandMark";

const FEATURES = [
  { title: "أفلام", body: "مكتبة أفلام كاملة داخل المتصفح، بجودة عرض سينمائية على الجوال والحاسوب." },
  { title: "مسلسلات", body: "مواسم وحلقات مرتّبة، مع مواصلة المشاهدة من حيث توقفت." },
  { title: "مباشر", body: "قنوات مباشرة ودليل عرض واضح وانتقال سريع بين القنوات." },
  { title: "مباريات", body: "مواعيد المباريات بتوقيت الرياض، مع فتح أقرب قناة بضغطة." },
];

const STEPS = [
  {
    n: "1",
    title: "اشترك بالخدمة السنوية",
    body: "التفعيل السنوي للمشغّل بـ 40 ريالاً سعودياً فقط. دفع آمن عبر Stripe.",
  },
  {
    n: "2",
    title: "أرسل بيانات اشتراكك",
    body: "كل المطلوب: Host و Username و Password. ترسلها للدعم مرة واحدة عبر واتساب.",
  },
  {
    n: "3",
    title: "شاهد على أجهزتك",
    body: "نفتح المشغّل على جهازك فوراً — آيفون، آيباد، ماك بوك، وأندرويد.",
  },
];

const PROVIDERS = ["إيليا برو", "ماكس TV", "وأغلب اشتراكات الميديا الأخرى"];

const DEVICES = [
  { name: "iPhone", image: "/promo/max-media/vyronix-max-media-iphone.png", alt: "ماكس ميديا بلاير على الآيفون" },
  { name: "iPad", image: "/promo/max-media/vyronix-max-media-tablet.png", alt: "ماكس ميديا بلاير على الآيباد" },
  { name: "MacBook", image: "/promo/max-media/vyronix-max-media-devices.png", alt: "ماكس ميديا بلاير على الماك بوك" },
  { name: "Android", image: "/promo/max-media/vyronix-max-media-android.png", alt: "ماكس ميديا بلاير على أندرويد" },
];

export function MediaPlayerLanding() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);
  const [source, setSource] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCanceled(params.get("canceled") === "1");
    const fromQuery = sanitizeTrafficSource(params.get("src") || params.get("from") || params.get("ref"));
    const stored = sanitizeTrafficSource(window.localStorage.getItem(MEDIA_PLAYER_SOURCE_STORAGE_KEY));
    const next = fromQuery || stored;
    if (fromQuery) {
      window.localStorage.setItem(MEDIA_PLAYER_SOURCE_STORAGE_KEY, fromQuery);
    }
    setSource(next);
  }, []);

  const adsClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const adsSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim();
  const showAds = Boolean(adsClient && adsSlot);
  const priceLabel = formatMediaPlayerPrice();

  async function handleSubscribe() {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ url?: string; error?: string }>("/api/billing/media-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok || !data.url) throw new Error(data.error || "تعذّر بدء الدفع");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بدء الدفع");
      setBusy(false);
    }
  }

  return (
    <div className="maxvr-land" dir="rtl" lang="ar">
      <header className="maxvr-land__bar">
        <div className="maxvr-land__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IPTV_BRAND_LOGO} alt="" width={40} height={40} />
          <div>
            <strong>ماكس ميديا</strong>
            <span>بلاير</span>
          </div>
        </div>
        <a className="maxvr-land__ghost" href={MEDIA_PLAYER_ACTIVATE_PATH}>
          دخول المشغّل
        </a>
      </header>

      <main className="maxvr-land__main">
        <section className="maxvr-land__hero">
          <p className="maxvr-land__kicker">{MEDIA_PLAYER_PRODUCT_NAME_AR}</p>
          <h1>مشغّل ميديا احترافي يعمل مع اشتراكك الحالي</h1>
          <p className="maxvr-land__lead">
            {MEDIA_PLAYER_PRODUCT_NAME_AR} مشغّل ويب سينمائي يشغّل بيانات أي اشتراك ميديا عبر Host و Username و Password —
            بما فيها اشتراكات مثل <strong>إيليا برو</strong> و<strong>ماكس TV</strong> وغيرها. بدون تطبيق إضافي، ومن
            المتصفح مباشرة على أجهزة آبل وأندرويد.
          </p>

          <figure className="maxvr-land__hero-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/promo/max-media/vyronix-max-media-hero.png" alt={`واجهة ${MEDIA_PLAYER_PRODUCT_NAME_AR} السينمائية`} />
          </figure>

          {canceled ? <p className="maxvr-land__note">تم إلغاء الدفع. يمكنك الاشتراك متى شئت.</p> : null}
          {error ? <p className="maxvr-land__error">{error}</p> : null}

          <div className="maxvr-land__offer">
            <div className="maxvr-land__price">
              <span className="maxvr-land__amount" dir="ltr">
                {priceLabel}
              </span>
              <span className="maxvr-land__period">اشتراك سنوي للمشغّل — {MEDIA_PLAYER_PRICE_SAR} ريالاً سعودياً</span>
            </div>
            <ul className="maxvr-land__bullets">
              <li>خدمة سنوية واضحة: 40 ريال سعودي في السنة</li>
              <li>بعد الدفع تزودنا فقط بـ Host و Username و Password لاشتراكك</li>
              <li>التفعيل عبر الدعم خلال دقائق على جهازك</li>
            </ul>
            <button type="button" className="maxvr-land__cta" disabled={busy} onClick={() => void handleSubscribe()}>
              {busy ? "جاري التحويل للدفع…" : "اشترك الآن — 40 ر.س / سنة"}
            </button>
            <p className="maxvr-land__fine">
              الدفع عبر Stripe بالريال السعودي. لا تحتاج حساباً مسبقاً — البريد يُدخل في صفحة الدفع.
            </p>
          </div>
        </section>

        <section className="maxvr-land__compat" aria-label="التوافق">
          <h2>يشغّل جميع الاشتراكات الشائعة</h2>
          <p>
            يكفي أن تملك اشتراك مشاهدة سارياً. المشغّل يقرأ نفس بيانات البوابة التي تستخدمها مع تطبيقات التشغيل المعروفة،
            ويعرض أفلامك ومسلسلاتك والقنوات المباشرة داخل {MEDIA_PLAYER_PRODUCT_NAME_AR}.
          </p>
          <ul>
            {PROVIDERS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className="maxvr-land__creds" aria-label="بيانات التفعيل">
            <span>Host</span>
            <span>Username</span>
            <span>Password</span>
          </div>
          <p className="maxvr-land__fine">هذه البيانات تُرسل للدعم مرة واحدة بعد الاشتراك — لا نطلب منك تنصيب برنامج.</p>
        </section>

        <section className="maxvr-land__devices" aria-label="الأجهزة المدعومة">
          <h2>يعمل على منتجات آبل وأندرويد</h2>
          <p>تجربة مشاهدة كاملة من المتصفح على iPhone و iPad و MacBook وأجهزة Android.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="maxvr-land__devices-hero"
            src="/promo/max-media/vyronix-max-media-devices.png"
            alt="ماكس ميديا بلاير على الآيفون والآيباد والماك بوك وأندرويد"
          />
          <ul className="maxvr-land__device-list">
            {DEVICES.map((device) => (
              <li key={device.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={device.image} alt={device.alt} />
                <strong>{device.name}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="maxvr-land__grid" aria-label="ماذا تشاهد">
          {FEATURES.map((item) => (
            <article key={item.title} className="maxvr-land__card">
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </section>

        <section className="maxvr-land__steps">
          <h2>كيف تشغّل الخدمة</h2>
          <ol>
            {STEPS.map((step) => (
              <li key={step.n}>
                <span>{step.n}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="maxvr-land__close">
          <h2>ابدأ المشاهدة خلال دقائق</h2>
          <p>
            اشترك بـ 40 ريالاً سعودياً للسنة، ثم أرسل Host و Username و Password عبر واتساب. فريق الدعم يفعّل{" "}
            {MEDIA_PLAYER_PRODUCT_NAME_AR} على جهازك.
          </p>
          <button type="button" className="maxvr-land__cta" disabled={busy} onClick={() => void handleSubscribe()}>
            {busy ? "جاري التحويل للدفع…" : "اشترك الآن"}
          </button>
        </section>

        {showAds ? (
          <aside className="maxvr-land__ads" aria-label="إعلان">
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client={adsClient}
              data-ad-slot={adsSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </aside>
        ) : null}
      </main>

      <footer className="maxvr-land__foot">
        <p>{MEDIA_PLAYER_PRODUCT_NAME_AR}</p>
        <a href={MEDIA_PLAYER_ACTIVATE_PATH}>لدي تفعيل — افتح المشغّل</a>
      </footer>
    </div>
  );
}
