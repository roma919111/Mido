import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  closeAdminSession,
  deliverToCustomer,
  getCustomerLabel,
  undeliverDevice,
} from "../lib/admin-mode";
import { getDeviceId, getDeviceMac } from "../lib/device-id";
import {
  isPlatformAppInstalled,
  launchNativePlatformApp,
  openPlatformPlayStore,
} from "../lib/platform-launch-native";
import { openPlatformNow } from "../lib/platform-open";
import {
  isCustomerBootDone,
  markCustomerBootDone,
  prepareCustomerHandoff,
  resetCustomerBoot,
  setCustomerMode,
  setPreferredPlatform,
} from "../lib/customer-mode";
import { PLATFORMS } from "../lib/platforms";
import type { PlatformId } from "../types";

const PLATFORMS_ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

type AdminPageProps = {
  onDelivered: () => void;
  onClose?: () => void;
};

export function AdminPage({ onDelivered, onClose }: AdminPageProps) {
  const deviceId = getDeviceId();
  const deviceMac = getDeviceMac(deviceId);
  const [label, setLabel] = useState(() => getCustomerLabel() ?? "");
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [bootDone, setBootDone] = useState(isCustomerBootDone());

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const next: Record<PlatformId, boolean> = { netflix: false, shahid: false, tod: false };
    for (const id of PLATFORMS_ORDER) {
      next[id] = await isPlatformAppInstalled(id);
    }
    setInstalled(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 5000);
  }

  async function handleInstall(platform: PlatformId) {
    flash(`فتح Play Store — ${PLATFORMS[platform].name}`);
    await openPlatformPlayStore(platform);
    window.setTimeout(() => void refresh(), 3000);
  }

  async function handleOpenApp(platform: PlatformId) {
    const meta = PLATFORMS[platform];
    await launchNativePlatformApp(platform, meta.homeUrl);
    flash(`✓ ${meta.name} — سجّل اشتراك الزبون هنا`);
  }

  async function handleOpenBrowser(platform: PlatformId) {
    await openPlatformNow(platform);
    flash(`🌐 ${PLATFORMS[platform].name} في المتصفح`);
  }

  function handleDeliver() {
    prepareCustomerHandoff();
    deliverToCustomer(label);
    closeAdminSession();
    flash("✓ تم تسليم الجهاز للزبون");
    window.setTimeout(onDelivered, 800);
  }

  function handleUndeliver() {
    undeliverDevice();
    setCustomerMode(false);
    flash("وضع التجهيز — يمكنك التعديل مجدداً");
  }

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div>
          <p className="admin-page__badge">🔧 Admin — تجهيز الزبون</p>
          <h1>إعداد الجهاز قبل التسليم</h1>
          <p className="admin-page__lead">
            أنت (Mohammed) تثبّت التطبيقات وتسجّل الاشتراك هنا — الزبون يرى 3 أزرار فقط.
          </p>
        </div>
        {onClose ? (
          <button type="button" className="admin-page__close" onClick={onClose}>
            ✕
          </button>
        ) : null}
      </header>

      {msg ? <p className="admin-page__msg">{msg}</p> : null}

      <section className="admin-card">
        <h2>معلومات الجهاز</h2>
        <p>
          <strong>Device ID:</strong> {deviceId}
        </p>
        <p>
          <strong>MAC:</strong> {deviceMac}
        </p>
        <label className="admin-field">
          <span>اسم الزبون (اختياري)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثال: أحمد — صالون 3"
          />
        </label>
      </section>

      <section className="admin-card">
        <h2>① ثبّت تطبيقات المنصات</h2>
        <p className="admin-card__hint">اضغط «تثبيت» → ثبّت من Play Store → افتح التطبيق → سجّل اشتراك الزبون</p>
        <div className="admin-platform-list">
          {PLATFORMS_ORDER.map((platform) => {
            const meta = PLATFORMS[platform];
            const ok = installed[platform];
            return (
              <article key={platform} className="admin-platform-row">
                <div>
                  <strong>{meta.name}</strong>
                  <span className={ok ? "is-ok" : "is-no"}>{ok ? "✓ مثبت" : "غير مثبت"}</span>
                </div>
                <div className="admin-platform-row__btns">
                  {!ok ? (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleInstall(platform)}>
                      📥 تثبيت
                    </button>
                  ) : (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleOpenApp(platform)}>
                      ▶ فتح + اشتراك
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void handleOpenBrowser(platform)}>
                    🌐
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setPreferredPlatform(platform);
                      flash(`المنصة الافتراضية: ${meta.name}`);
                    }}
                  >
                    ★
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-card">
        <h2>② خيارات التسليم</h2>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={bootDone}
            onChange={(e) => {
              setBootDone(e.target.checked);
              if (e.target.checked) markCustomerBootDone();
              else resetCustomerBoot();
            }}
          />
          <span>تخطّي شاشة Netflix التلقائية عند أول فتح للزبون</span>
        </label>
      </section>

      <section className="admin-card admin-card--deliver">
        <h2>③ تسليم للزبون</h2>
        <p>بعد تثبيت Netflix/شاهد وتسجيل الاشتراك — اضغط الزر أدناه. الزبون لن يرى هذه الصفحة.</p>
        <button type="button" className="admin-deliver-btn" onClick={handleDeliver}>
          ✅ تسليم الجهاز للزبون
        </button>
        <button type="button" className="admin-undeliver-btn" onClick={handleUndeliver}>
          ↩ إعادة وضع التجهيز
        </button>
      </section>
    </div>
  );
}
