/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lock } from 'lucide-react';
import React, { useState } from 'react';
import { accessToken, Role } from '../api/client.ts';

interface AccessGateProps {
  role: Role;
  /** Shown after a wrong code */
  error?: string | null;
  onUnlocked: () => void;
}

const TITLES: Record<Role, string> = {
  rep: 'כניסת נציג שכר',
  admin: 'כניסת מנהל מערכת',
};

/** Asks for the rep/admin access code; the server checks it on every request */
export const AccessGate: React.FC<AccessGateProps> = ({ role, error, onUnlocked }) => {
  const [code, setCode] = useState('');

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          accessToken.set(role, code.trim());
          setCode('');
          onUnlocked();
        }}
        className="bg-white rounded-2xl border border-line border-t-[3px] border-t-brand shadow-xs p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand-dark flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">{TITLES[role]}</h2>
            <p className="text-xs text-slate-500">המסך מכיל נתוני שכר: נדרש קוד גישה</p>
          </div>
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה"
          autoComplete="current-password"
          className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
        {error && <p className="text-xs text-danger font-medium">{error}</p>}
        <button
          type="submit"
          disabled={!code.trim()}
          className="w-full px-4 py-2.5 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40 transition-colors text-sm font-semibold"
        >
          כניסה
        </button>
      </form>
    </div>
  );
};
