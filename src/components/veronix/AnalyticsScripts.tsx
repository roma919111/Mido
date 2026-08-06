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
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
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
        <Script id="meta-pixel" strategy="afterInteractive">
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

/** Fire conversion events from client components when analytics IDs exist. */
export function trackAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  try {
    w.gtag?.("event", name, params || {});
  } catch {
    // ignore
  }
  try {
    if (name === "sign_up") w.fbq?.("track", "CompleteRegistration");
    if (name === "purchase") w.fbq?.("track", "Purchase");
  } catch {
    // ignore
  }
}
