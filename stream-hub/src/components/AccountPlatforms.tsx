import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import type { PlatformId } from "../types";
import {
  clearPlatformAccount,
  loadPlatformAccounts,
  savePlatformAccount,
  type PlatformAccountsStore,
} from "../lib/platform-accounts";
import { openPlatformPlayStore, isPlatformAppInstalled } from "../lib/platform-launch-native";
import { PLATFORMS } from "../lib/platforms";

const PLATFORM_ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

type AccountPlatformsProps = {
  streamHubUsername: string;
};

export function AccountPlatforms({ streamHubUsername }: AccountPlatformsProps) {
  const [accounts, setAccounts] = useState<PlatformAccountsStore>({});
  const [drafts, setDrafts] = useState<Record<PlatformId, { username: string; password: string }>>({
    netflix: { username: "", password: "" },
    shahid: { username: "", password: "" },
    tod: { username: "", password: "" },
  });
  const [showPassword, setShowPassword] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void (async () => {
      const next: Record<PlatformId, boolean> = { netflix: false, shahid: false, tod: false };
      for (const id of PLATFORM_ORDER) {
        next[id] = await isPlatformAppInstalled(id);
      }
      setInstalled(next);
    })();
  }, []);

  useEffect(() => {
    const loaded = loadPlatformAccounts();
    setAccounts(loaded);
    setDrafts({
      netflix: {
        username: loaded.netflix?.username ?? "",
        password: loaded.netflix?.password ?? "",
      },
      shahid: {
        username: loaded.shahid?.username ?? "",
        password: loaded.shahid?.password ?? "",
      },
      tod: {
        username: loaded.tod?.username ?? "",
        password: loaded.tod?.password ?? "",
      },
    });
  }, []);

  function handleSave(platform: PlatformId) {
    const draft = drafts[platform];
    savePlatformAccount(platform, draft.username, draft.password);
    setAccounts(loadPlatformAccounts());
    setSavedMsg(`تم حفظ حساب ${PLATFORMS[platform].name}`);
    window.setTimeout(() => setSavedMsg(null), 2500);
  }

  function handleClear(platform: PlatformId) {
    clearPlatformAccount(platform);
    setAccounts(loadPlatformAccounts());
    setDrafts((prev) => ({
      ...prev,
      [platform]: { username: "", password: "" },
    }));
  }

  return (
    <div className="account-page">
      <div className="notice account-page__intro">
        <strong>مرحباً {streamHubUsername}</strong>
        <p>
          أضف بيانات دخول المنصات الرسمية. تُحفظ <strong>على هذا الجهاز فقط</strong> — لا
          تُرسل لأي سيرفر.
        </p>
        <p className="account-page__warn">
          للاستخدام الشخصي / جهاز عائلي. Stream Hub لا يسجّل الدخول تلقائياً — سجّل مرة في
          تطبيق كل منصة، أو استخدم البيانات المحفوظة للمرجع.
        </p>
      </div>

      {savedMsg ? <p className="account-page__saved">{savedMsg}</p> : null}

      <div className="account-platforms">
        {PLATFORM_ORDER.map((platform) => {
          const meta = PLATFORMS[platform];
          const saved = accounts[platform];
          const draft = drafts[platform];

          return (
            <section
              key={platform}
              className="account-platform-card"
              style={{ "--platform-color": meta.color } as React.CSSProperties}
            >
              <header className="account-platform-card__head">
                <h3>{meta.name}</h3>
                {saved?.username ? (
                  <span className="account-platform-card__badge">محفوظ ✓</span>
                ) : (
                  <span className="account-platform-card__badge account-platform-card__badge--empty">
                    غير محفوظ
                  </span>
                )}
              </header>

              <div className="field">
                <label htmlFor={`${platform}-user`}>اسم المستخدم / البريد</label>
                <input
                  id={`${platform}-user`}
                  type="text"
                  autoComplete="username"
                  placeholder={`حساب ${meta.name}`}
                  value={draft.username}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [platform]: { ...prev[platform], username: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor={`${platform}-pass`}>كلمة المرور</label>
                <div className="password-row">
                  <input
                    id={`${platform}-pass`}
                    type={showPassword[platform] ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={draft.password}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [platform]: { ...prev[platform], password: e.target.value },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, [platform]: !prev[platform] }))
                    }
                  >
                    {showPassword[platform] ? "إخفاء" : "إظهار"}
                  </button>
                </div>
              </div>

              <div className="account-platform-card__actions">
                {Capacitor.isNativePlatform() && !installed[platform] ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => void openPlatformPlayStore(platform)}
                  >
                    📥 ثبّت {meta.name}
                  </button>
                ) : null}
                <button type="button" className="btn btn--primary btn--sm" onClick={() => handleSave(platform)}>
                  حفظ
                </button>
                {saved ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleClear(platform)}>
                    حذف
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
