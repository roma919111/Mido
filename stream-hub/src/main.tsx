import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CATALOG, CATEGORIES } from "./data/catalog";
import { getSession, login, logout } from "./lib/auth";
import { openOfficialLink, PLATFORMS } from "./lib/platforms";
import type { CatalogItem } from "./types";
import "./index.css";

function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login(username, password)) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    setError(null);
    onSuccess();
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Stream Hub</h1>
        <p className="subtitle">
          واجهة موحّدة للوصول الرسمي لمنصات البث. التشغيل يتم دائماً عبر المنصة
          الأصلية — بدون تجاوز DRM.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="field">
          <label htmlFor="username">اسم المستخدم</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="primary-btn">
          دخول
        </button>
      </form>
    </div>
  );
}

function ContentCard({ item }: { item: CatalogItem }) {
  return (
    <article className="card">
      <div className="card-poster" style={{ background: item.posterGradient }}>
        <div>
          <h3>{item.title}</h3>
          {item.titleEn ? <span>{item.titleEn}</span> : null}
        </div>
      </div>
      <div className="card-body">
        <p>{item.description}</p>
        <div className="platform-row">
          {item.platforms.map((link) => {
            const meta = PLATFORMS[link.platform];
            return (
              <button
                key={`${item.id}-${link.platform}`}
                type="button"
                className="platform-btn"
                style={{ background: meta.color }}
                onClick={() => openOfficialLink(link.url)}
              >
                ▶ {link.label ?? `شاهد على ${meta.name}`}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function HomePage({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [nav, setNav] = useState<"home" | "platforms" | "account">("home");

  const items = useMemo(() => {
    if (category === "all") return CATALOG;
    return CATALOG.filter((item) => item.category === category);
  }, [category]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Stream Hub</h1>
          <p>مرحباً، {username}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={onLogout}>
          خروج
        </button>
      </header>

      {nav === "home" ? (
        <main className="content">
          <div className="chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`chip ${category === cat.id ? "active" : ""}`}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>

          <p className="notice">
            كل زر «شاهد» يفتح الرابط الرسمي للمنصة في المتصفح أو التطبيق الأصلي.
            لا يتم تشغيل الفيديو داخل Stream Hub — هذا يحافظ على DRM وشروط
            الاستخدام.
          </p>
        </main>
      ) : null}

      {nav === "platforms" ? (
        <main className="content">
          <h2 style={{ marginTop: 0 }}>المنصات</h2>
          <div className="grid">
            {Object.values(PLATFORMS).map((platform) => (
              <article key={platform.id} className="card">
                <div className="card-body">
                  <h3 style={{ marginTop: 0 }}>{platform.name}</h3>
                  <p>فتح الموقع الرسمي</p>
                  <button
                    type="button"
                    className="platform-btn"
                    style={{ background: platform.color }}
                    onClick={() => openOfficialLink(platform.homeUrl)}
                  >
                    ▶ فتح {platform.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      ) : null}

      {nav === "account" ? (
        <main className="content">
          <h2 style={{ marginTop: 0 }}>الحساب</h2>
          <div className="notice">
            <strong>المستخدم:</strong> {username}
            <br />
            <br />
            سجّل الدخول إلى Netflix / شاهد / TOD مرة واحدة في Chrome على هذا
            الجهاز. بعدها الروابط الرسمية ستفتح وأنت مسجّل تلقائياً.
          </div>
        </main>
      ) : null}

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-item ${nav === "home" ? "active" : ""}`}
          onClick={() => setNav("home")}
        >
          الرئيسية
        </button>
        <button
          type="button"
          className={`nav-item ${nav === "platforms" ? "active" : ""}`}
          onClick={() => setNav("platforms")}
        >
          المنصات
        </button>
        <button
          type="button"
          className={`nav-item ${nav === "account" ? "active" : ""}`}
          onClick={() => setNav("account")}
        >
          الحساب
        </button>
      </nav>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUsername(session.username);
      setAuthed(true);
    }
  }, []);

  function handleLogout() {
    logout();
    setAuthed(false);
    setUsername("");
  }

  if (!authed) {
    return (
      <LoginPage
        onSuccess={() => {
          const session = getSession();
          setUsername(session?.username ?? "");
          setAuthed(true);
        }}
      />
    );
  }

  return <HomePage username={username} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
