import { useEffect, useState } from "react";
import { getSession, logout } from "./lib/auth";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { HomePage } from "./components/HomePage";
import { MaxLoginPage } from "./components/MaxLoginPage";
import { GoogleTvLauncher } from "./components/GoogleTvLauncher";

export function App() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const session = getSession();
    if (session) {
      enterAppShellMode();
      setUsername(session.username);
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return (
      <GoogleTvLauncher>
        <MaxLoginPage
          onSuccess={() => {
            const session = getSession();
            setUsername(session?.username ?? "");
            setAuthed(true);
          }}
        />
      </GoogleTvLauncher>
    );
  }

  return (
    <GoogleTvLauncher>
      <HomePage
        username={username}
        onLogout={() => {
          exitAppShellMode();
          logout();
          setAuthed(false);
        }}
      />
    </GoogleTvLauncher>
  );
}
