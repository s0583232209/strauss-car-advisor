/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import type { AuthUser, UserRole } from '../../shared/types.ts';
import { api, ApiError } from '../api/client.ts';

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'עובד',
  rep: 'נציג שכר',
  admin: 'מנהל',
};

const ROLE_HINTS: Record<UserRole, string> = {
  employee: 'רואה את מסך העובד בלבד',
  rep: 'רואה את מסך העובד ואת פניות העובדים',
  admin: 'גישה מלאה, כולל נתונים והוספת משתמשים',
};

const MIN_PASSWORD = 8;

/** Admin only: adds a user who can log in at once. The server checks the role again (403). */
export const UsersView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('employee');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Users added in this visit (emails and roles only; passwords are never kept)
  const [added, setAdded] = useState<AuthUser[]>([]);

  const canSubmit = email.trim() !== '' && password.length >= MIN_PASSWORD && !busy;

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg border border-line bg-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSubmit) return;
          setBusy(true);
          setError(null);
          try {
            const user = await api.admin.createUser({ email: email.trim(), password, role });
            setAdded((prev) => [user, ...prev]);
            setEmail('');
            setPassword('');
            setRole('employee');
          } catch (err) {
            // A 401 already sent the app back to the login screen
            if (err instanceof ApiError && err.status === 401) return;
            setError(err instanceof Error ? err.message : 'יצירת המשתמש נכשלה');
          } finally {
            setBusy(false);
          }
        }}
        className="bg-white rounded-2xl border border-line border-t-[3px] border-t-brand shadow-xs p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand-dark flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">הוספת משתמש</h2>
            <p className="text-xs text-slate-500">המשתמש יוכל להיכנס מיד עם האימייל והסיסמה שתגדירו</p>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">אימייל</span>
          <input
            type="email"
            dir="ltr"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">סיסמה ראשונית</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pl-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <span className="block text-[11px] text-slate-400">לפחות {MIN_PASSWORD} תווים. מסרו אותה למשתמש בערוץ מאובטח.</span>
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-slate-600 mb-1">באיזה תפקיד להוסיף את המשתמש?</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={`px-2 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  role === r
                    ? 'border-brand bg-brand/10 text-brand-dark ring-2 ring-brand/20'
                    : 'border-line bg-surface/60 text-slate-600 hover:border-brand/50'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <span className="block text-[11px] text-slate-400">{ROLE_HINTS[role]}</span>
        </fieldset>

        {error && <p role="alert" className="text-xs text-danger font-medium">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40"
        >
          {busy ? 'יוצרים...' : 'יצירת משתמש'}
        </button>
      </form>

      {added.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-line shadow-xs p-5 space-y-2">
          <h3 className="text-sm font-bold text-ink">נוספו עכשיו</h3>
          <ul className="space-y-1.5">
            {added.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-line text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {ROLE_LABELS[u.role]}
                </span>
                <span dir="ltr" className="font-mono text-slate-600">{u.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
