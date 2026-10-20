/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lock } from 'lucide-react';
import React, { useState } from 'react';
import type { AuthUser } from '../../shared/types.ts';
import { api } from '../api/client.ts';

// Temporary test users for the hackathon team (public on purpose); delete this list to hide the box
const DEMO_PASSWORD = '123456';
const DEMO_USERS: Array<{ email: string; role: string }> = [
  { email: 'employee1@example.com', role: 'עובד' },
  { email: 'employee2@example.com', role: 'עובד' },
  { email: 'rep@example.com', role: 'נציג שכר' },
  { email: 'admin@example.com', role: 'מנהל' },
];

interface AccessGateProps {
  onLoggedIn: (user: AuthUser) => void;
}

/** Email and password login; the server checks them with Supabase Auth and sets httpOnly cookies */
export const AccessGate: React.FC<AccessGateProps> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim() !== '' && password !== '' && !busy;

  return (
    // Side by side on wide screens (login on the right in RTL), stacked on phones
    <div
      className={`mx-auto px-4 py-16 grid gap-4 items-start ${
        DEMO_USERS.length > 0 ? 'max-w-md md:max-w-4xl md:grid-cols-2' : 'max-w-md'
      }`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSubmit) return;
          setBusy(true);
          setError(null);
          try {
            const user = await api.auth.login(email.trim(), password);
            setPassword('');
            onLoggedIn(user);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'הכניסה נכשלה');
          } finally {
            setBusy(false);
          }
        }}
        className="bg-white rounded-2xl border border-line border-t-[3px] border-t-brand shadow-xs p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand-dark flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">כניסה למערכת</h2>
            <p className="text-xs text-slate-500">המערכת מכילה נתוני שכר: נדרשת כניסה עם אימייל וסיסמה</p>
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">אימייל</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface/60 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">סיסמה</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface/60 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-danger font-medium">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full px-4 py-2.5 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40 transition-colors text-sm font-semibold"
        >
          {busy ? 'נכנסים...' : 'כניסה'}
        </button>
      </form>

      {DEMO_USERS.length > 0 && (
        <div className="bg-white rounded-2xl border border-line shadow-xs p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-ink">משתמשי בדיקה לצוות ההאקתון</h3>
            <p className="text-xs text-slate-500">
              בינתיים אפשר להיכנס עם אחד המשתמשים האלה. הסיסמה של כולם:{' '}
              <span dir="ltr" className="font-mono font-semibold text-slate-700">{DEMO_PASSWORD}</span>
            </p>
          </div>
          <ul className="space-y-1.5">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(DEMO_PASSWORD);
                    setError(null);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-line hover:border-brand hover:bg-brand/5 transition-colors text-xs"
                >
                  <span className="font-semibold text-slate-700">{u.role}</span>
                  <span dir="ltr" className="font-mono text-slate-600">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400">לחיצה על משתמש ממלאת את הטופס</p>
        </div>
      )}
    </div>
  );
};
