import { useCallback, useEffect, useState } from "react";
import { bootstrapCustomerApk, isNativeCustomerApk } from "./lib/bootstrap-customer-apk";
import { fetchActivationStatus, isActivationRequired } from "./lib/activation";
import { getDeviceId } from "./lib/device-id";
import { getSession, logout } from "./lib/auth";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { ActivationScreen } from "./components/ActivationScreen";
import { HomePage } from "./components/HomePage";
import { MaxLoginPage } from "./components/MaxLoginPage";
import { GoogleTvLauncher } from "./components/GoogleTvLauncher";

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [activated, setActivated] = useState(false);
  const nativeCustomer = isNativeCustomerApk();
  const needsActivation = nativeCustomer && isActivationRequired();

  const enterCustomerApp = useCallback(() => {
    bootstrapCustomerApk();
    enterAppShellMode();
    setAuthed(true);
    setActivated(true);
  }, []);

  useEffect(() => {
    async function init() {
      if (nativeCustomer) {
        if (needsActivation) {
          const deviceId = getDeviceId();
          const status = await fetchActivationStatus(deviceId);
          if (status.activated) {
            enterCustomerApp();
          }
        } else {
          enterCustomerApp();
        }
      } else {
        const session = getSession();
        if (session) {
          enterAppShellMode();
          setAuthed(true);
        }
      }
      setReady(true);
    }
    void init();
  }, [nativeCustomer, needsActivation, enterCustomerApp]);

  if (!ready) return null;

  if (nativeCustomer && needsActivation && !activated) {
    return (
      <GoogleTvLauncher>
        <ActivationScreen onActivated={enterCustomerApp} />
      </GoogleTvLauncher>
    );
  }

  if (!authed) {
    return (
      <GoogleTvLauncher>
        <MaxLoginPage
          onSuccess={() => {
            enterAppShellMode();
            setAuthed(true);
          }}
        />
      </GoogleTvLauncher>
    );
  }

  return (
    <GoogleTvLauncher>
      <HomePage
        onLogout={
          nativeCustomer
            ? undefined
            : () => {
                exitAppShellMode();
                logout();
                setAuthed(false);
              }
        }
      />
    </GoogleTvLauncher>
  );
}
