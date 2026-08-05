import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ensureAutoSession, getSession, logout } from "./lib/auth";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { isCustomerBootDone, isCustomerMode } from "./lib/customer-mode";
import { HomePage } from "./components/HomePage";
import { CustomerBoot } from "./components/CustomerBoot";
import { MaxLoginPage } from "./components/MaxLoginPage";
import { GoogleTvLauncher } from "./components/GoogleTvLauncher";

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (isCustomerMode()) {
      const session = ensureAutoSession();
      if (session) {
        enterAppShellMode();
        setAuthed(true);
        setBooting(!isCustomerBootDone());
      }
    } else {
      const session = getSession();
      if (session) {
        enterAppShellMode();
        setAuthed(true);
      }
    }
    setReady(true);
  }, []);

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

  if (booting && Capacitor.isNativePlatform()) {
    return (
      <CustomerBoot
        onDone={() => {
          setBooting(false);
        }}
      />
    );
  }

  return (
    <GoogleTvLauncher>
      <HomePage
        onLogout={
          isCustomerMode()
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
