import { useEffect, useState } from "react";
import { bootstrapCustomerApk, isNativeCustomerApk } from "./lib/bootstrap-customer-apk";
import { getSession, logout } from "./lib/auth";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { HomePage } from "./components/HomePage";
import { MaxLoginPage } from "./components/MaxLoginPage";
import { GoogleTvLauncher } from "./components/GoogleTvLauncher";

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const nativeCustomer = isNativeCustomerApk();

  useEffect(() => {
    if (nativeCustomer) {
      bootstrapCustomerApk();
      enterAppShellMode();
      setAuthed(true);
    } else {
      const session = getSession();
      if (session) {
        enterAppShellMode();
        setAuthed(true);
      }
    }
    setReady(true);
  }, [nativeCustomer]);

  if (!ready) return null;

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
