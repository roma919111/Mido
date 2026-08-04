import { Capacitor } from "@capacitor/core";
import { PLATFORMS } from "../lib/platforms";
import type { PlatformId } from "../types";

const SETUP_KEY = "streamhub.smartSetupDone";

export function shouldShowSmartSetup(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  return localStorage.getItem(SETUP_KEY) !== "1";
}

export function completeSmartSetup(): void {
  localStorage.setItem(SETUP_KEY, "1");
}

export function openPlayStore(platform: PlatformId): void {
  const url = PLATFORMS[platform].playStoreUrl;
  window.open(url, "_blank", "noopener,noreferrer");
}

const STEPS = [
  {
    title: "ثبّت تطبيقات المنصات",
    body: "Netflix · شاهد · TOD من Play Store — مجاني التثبيت.",
  },
  {
    title: "سجّل دخول مرة واحدة",
    body: "افتح كل تطبيق وسجّل حسابك الرسمي. Stream Hub ما يحفظ تشغيل — فقط يرسلك للتطبيق.",
  },
  {
    title: "تصفّح واضغط Play",
    body: "من Stream Hub اختر العنوان → يفتح التطبيق على نفس الفيلم. اضغط ▶ هناك.",
  },
] as const;

type SmartSetupProps = {
  onDone: () => void;
};

export function SmartSetup({ onDone }: SmartSetupProps) {
  function handleDone() {
    completeSmartSetup();
    onDone();
  }

  return (
    <div className="smart-setup">
      <div className="smart-setup__card">
        <p className="smart-setup__badge">أذكى مسار — Google TV</p>
        <h1>إعداد 3 دقائق</h1>
        <p className="smart-setup__lead">
          Stream Hub = واجهة اكتشاف. التشغيل = التطبيق الرسمي. بدون متصفح، بدون DRM، بدون رفض.
        </p>

        <ol className="smart-setup__steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="smart-setup__num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="smart-setup__stores">
          {(Object.keys(PLATFORMS) as PlatformId[]).map((id) => (
            <button key={id} type="button" className="btn btn--ghost" onClick={() => openPlayStore(id)}>
              {PLATFORMS[id].name}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn--primary smart-setup__done" onClick={handleDone}>
          تم — ادخل Stream Hub
        </button>
      </div>
    </div>
  );
}
