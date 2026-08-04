import { useMemo, useState } from "react";
import { enterAppShellMode } from "../lib/app-shell";
import { enterKioskMode, isKioskEnabled } from "../lib/kiosk-mode";
import { enterPlaybackMode } from "../lib/fullscreen";
import { login } from "../lib/auth";
import { getDeviceId, getDeviceMac } from "../lib/device-id";

type MaxLoginPageProps = {
  onSuccess: () => void;
};

export function MaxLoginPage({ onSuccess }: MaxLoginPageProps) {
  const deviceId = useMemo(() => getDeviceId(), []);
  const deviceMac = useMemo(() => getDeviceMac(deviceId), [deviceId]);

  const [code, setCode] = useState(deviceId);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeCodeMode, setActiveCodeMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const username = activeCodeMode ? "admin" : code.trim();
    if (!login(username, password)) {
      setError("رمز التفعيل أو كلمة المرور غير صحيحة");
      return;
    }
    setError(null);
    enterAppShellMode();
    enterPlaybackMode();
    if (isKioskEnabled()) void enterKioskMode();
    onSuccess();
  }

  return (
    <div className="max-login">
      <div className="max-login__dots max-login__dots--left" aria-hidden="true" />
      <div className="max-login__dots max-login__dots--right" aria-hidden="true" />

      <div className="max-login__layout">
        <div className="max-login__logo-wrap">
          <div className="max-login__logo-ring" aria-hidden="true" />
          <div className="max-login__logo">
            <div className="max-login__play">
              <span className="max-login__max-badge">MAX</span>
            </div>
            <p className="max-login__tagline">MEDIA PLAYER</p>
          </div>
        </div>

        <form className="max-login__panel" onSubmit={handleSubmit}>
          <input
            id="activation-code"
            className="max-login__input"
            inputMode="numeric"
            autoComplete="username"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            readOnly={activeCodeMode}
            aria-label="Activation code"
          />

          <input
            id="password"
            className="max-login__input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••••••"
            required
            aria-label="Password"
          />

          <label className="max-login__check">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </label>

          <label className="max-login__check">
            <input
              type="checkbox"
              checked={activeCodeMode}
              onChange={(e) => {
                setActiveCodeMode(e.target.checked);
                if (e.target.checked) setCode(deviceId);
              }}
            />
            <span>Active Code Activation</span>
          </label>

          {error ? <p className="max-login__error">{error}</p> : null}

          <button type="submit" className="max-login__activate">
            ACTIVATE
          </button>

          <p className="max-login__mac">{deviceMac}</p>
        </form>
      </div>
    </div>
  );
}
