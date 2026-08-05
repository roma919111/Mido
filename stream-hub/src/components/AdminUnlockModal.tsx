import { useState } from "react";
import { login } from "../lib/auth";
import { openAdminSession } from "../lib/admin-mode";

type AdminUnlockModalProps = {
  onUnlocked: () => void;
  onCancel: () => void;
};

export function AdminUnlockModal({ onUnlocked, onCancel }: AdminUnlockModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login("admin", password)) {
      setError("كلمة المرور غير صحيحة");
      return;
    }
    openAdminSession();
    onUnlocked();
  }

  return (
    <div className="admin-unlock" role="dialog" aria-modal="true">
      <form className="admin-unlock__card" onSubmit={handleSubmit}>
        <h2>🔧 Admin</h2>
        <p>كلمة مرور المسؤول فقط</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="changeme"
          autoFocus
        />
        {error ? <p className="admin-unlock__error">{error}</p> : null}
        <div className="admin-unlock__actions">
          <button type="submit" className="btn btn--primary">
            دخول
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
