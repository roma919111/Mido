import Script from "next/script";

const GA4 = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
const META_PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

export function AnalyticsScripts() {
  if (!GA4 && !META_PIXEL) return null;

  return (
    <>
      {GA4 ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-init" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA4}', { send_page_view: true });
            `}
          </Script>
        </>
      ) : null}
      {META_PIXEL ? (
        <Script id="meta-pixel" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
    </>
  );
}

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

function analyticsWindow(): AnalyticsWindow | null {
  if (typeof window === "undefined") return null;
  return window as AnalyticsWindow;
}

export type CheckoutItemAnalytics = {
  itemId: string;
  itemName: string;
  price: number;
  quantity?: number;
};

function ga4Items(items: CheckoutItemAnalytics[]) {
  return items.map((item) => ({
    item_id: item.itemId,
    item_name: item.itemName,
    price: item.price,
    quantity: item.quantity ?? 1,
  }));
}

/** GA4 recommended sign_up event. */
export function trackSignUp(method: "email" | "google"): void {
  const label = method === "google" ? "Google" : "Email";
  trackAnalyticsEvent("sign_up", { method: label });
  const w = analyticsWindow();
  try {
    w?.fbq?.("track", "CompleteRegistration");
  } catch {
    // ignore
  }
}

/** GA4 recommended begin_checkout event. */
export function trackBeginCheckout(input: {
  value: number;
  currency?: string;
  items: CheckoutItemAnalytics[];
}): void {
  const currency = input.currency || "USD";
  const w = analyticsWindow();
  try {
    w?.gtag?.("event", "begin_checkout", {
      currency,
      value: input.value,
      items: ga4Items(input.items),
    });
  } catch {
    // ignore
  }
}

/** GA4 recommended purchase event — deduped per transaction in sessionStorage. */
export function trackPurchase(input: {
  transactionId: string;
  value: number;
  currency?: string;
  items: CheckoutItemAnalytics[];
}): void {
  if (typeof window !== "undefined") {
    const key = `ga_purchase_${input.transactionId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }

  const currency = input.currency || "USD";
  const w = analyticsWindow();
  try {
    w?.gtag?.("event", "purchase", {
      transaction_id: input.transactionId,
      currency,
      value: input.value,
      items: ga4Items(input.items),
    });
  } catch {
    // ignore
  }
  try {
    w?.fbq?.("track", "Purchase", {
      value: input.value,
      currency,
    });
  } catch {
    // ignore
  }
}

/** Fire generic GA4/Meta events from client components when analytics IDs exist. */
export function trackAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  const w = analyticsWindow();
  if (!w) return;
  try {
    w.gtag?.("event", name, params || {});
  } catch {
    // ignore
  }
}
