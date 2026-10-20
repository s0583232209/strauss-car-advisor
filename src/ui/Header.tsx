/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileSpreadsheet, Headset, LogOut, MessageSquare, ShieldAlert, UserPlus } from 'lucide-react';
import React from 'react';
import type { UserRole } from '../../shared/types.ts';
import { AdvisorLogo, StraussLogo } from './CarDecor.tsx';

export type ActiveScreen = 'employee' | 'rep' | 'admin' | 'users';

export const ALL_SCREENS: ActiveScreen[] = ['employee', 'rep', 'admin', 'users'];

/** Screens each role may open. The server enforces the same split on the data (403). */
export const SCREENS_BY_ROLE: Record<UserRole, ActiveScreen[]> = {
  employee: ['employee'],
  rep: ['employee', 'rep'],
  admin: ALL_SCREENS,
};

interface HeaderProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  /** Tabs to show; empty on the login screen */
  screens: ActiveScreen[];
  openTicketCount: number;
  isThrottled?: boolean;
  /** The logged-in user; absent when the server has no login */
  userEmail?: string;
  onLogout?: () => void;
}

// Active tab: white pill on the blue bar; inactive: light text with a soft hover pill.
const navClass = (active: boolean) =>
  `relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-white ${
    active ? 'bg-white text-brand-dark shadow-sm' : 'text-white hover:bg-white/15'
  }`;

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  onNavigate,
  screens,
  openTicketCount,
  isThrottled,
  userEmail,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-blue-deep text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand */}
            <div className="flex items-center gap-3 min-w-0">
              {/* White badge keeps the logo colors crisp on the blue bar */}
              <div className="bg-white rounded-2xl px-2.5 py-1 shadow-sm shrink-0">
                <StraussLogo className="h-9 sm:h-10" />
              </div>
              <span className="hidden sm:block w-px h-8 bg-white/30" aria-hidden="true" />
              <AdvisorLogo variant="light" className="hidden sm:block w-10 h-10 shrink-0" />
              <div className="min-w-0 hidden sm:block">
                <span className="block font-bold text-lg leading-tight">יועץ הרכב</span>
                <p className="text-xs text-white/90 hidden md:block truncate">
                  מחשבון שכר נטו, כלי רכב חשמליים ומדיניות רכב חברה
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Navigation Role Switcher: only the screens this user may open */}
              {screens.length > 1 && (
                <nav className="flex items-center gap-1 sm:gap-1.5 bg-black/10 rounded-full p-1">
                  {screens.includes('employee') && (
                    <button onClick={() => onNavigate('employee')} className={navClass(activeScreen === 'employee')}>
                      <MessageSquare className="w-4 h-4" />
                      <span>עובד</span>
                    </button>
                  )}

                  {screens.includes('rep') && (
                    <button onClick={() => onNavigate('rep')} className={navClass(activeScreen === 'rep')}>
                      <Headset className="w-4 h-4" />
                      <span>נציג</span>
                      {openTicketCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-brand rounded-full ring-2 ring-white">
                          {openTicketCount}
                        </span>
                      )}
                    </button>
                  )}

                  {screens.includes('admin') && (
                    <button onClick={() => onNavigate('admin')} className={navClass(activeScreen === 'admin')}>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="hidden sm:inline">נתונים</span>
                      <span className="sm:hidden">ניהול</span>
                    </button>
                  )}

                  {screens.includes('users') && (
                    <button onClick={() => onNavigate('users')} className={navClass(activeScreen === 'users')}>
                      <UserPlus className="w-4 h-4" />
                      <span>משתמשים</span>
                    </button>
                  )}
                </nav>
              )}

              {userEmail && onLogout && (
                <div className="flex items-center gap-2">
                  <span className="hidden lg:block text-xs text-white/90 max-w-48 truncate" dir="ltr" title={userEmail}>
                    {userEmail}
                  </span>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-white hover:bg-white/15 transition-colors focus-visible:outline-white"
                    aria-label={`יציאה (${userEmail})`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">יציאה</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Throttled Banner */}
        {isThrottled && (
          <div className="bg-white/95 px-4 py-2 text-xs sm:text-sm text-warning flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>המערכת מתמודדת כרגע עם עומס מכסות זמני (429). ממתינים מספר שניות ומנסים מחדש באופן אוטומטי.</span>
          </div>
        )}
      </div>

      {/* Layered waves in the pinwheel colors: red, orange and green lines under the blue */}
      <svg
        className="block w-full h-5 sm:h-6 -mt-px pointer-events-none"
        viewBox="0 0 1440 46"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path fill="#78A12F" d="M0,0 H1440 V26 C1180,52 900,50 720,35 C540,20 260,16 0,43 Z" />
        <path fill="#F48326" d="M0,0 H1440 V22 C1180,46 900,44 720,30 C540,16 260,12 0,38 Z" />
        <path fill="#ED3024" d="M0,0 H1440 V18 C1180,40 900,38 720,25 C540,12 260,8 0,33 Z" />
        <path fill="#0A6EA8" d="M0,0 H1440 V13 C1180,34 900,32 720,20 C540,8 260,4 0,27 Z" />
      </svg>
    </header>
  );
};
