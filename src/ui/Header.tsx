/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, CheckCircle2, FileSpreadsheet, Headset, MessageSquare, ShieldAlert } from 'lucide-react';
import React from 'react';

export type ActiveScreen = 'employee' | 'rep' | 'admin' | 'guide';

interface HeaderProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  openTicketCount: number;
  isThrottled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  onNavigate,
  openTicketCount,
  isThrottled,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E3E8EE] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0E6E8C] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ש
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-[#1C2733] tracking-tight">יועץ הרכב</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0E6E8C]/10 text-[#0E6E8C] font-medium">
                  שטראוס
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                מחשבון שכר נטו, כלי רכב חשמליים ומדיניות רכב חברה
              </p>
            </div>
          </div>

          {/* Navigation Role Switcher */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onNavigate('employee')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === 'employee'
                  ? 'bg-[#0E6E8C] text-white shadow-xs'
                  : 'text-[#1C2733] hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>עובד</span>
            </button>

            <button
              onClick={() => onNavigate('rep')}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === 'rep'
                  ? 'bg-[#0E6E8C] text-white shadow-xs'
                  : 'text-[#1C2733] hover:bg-slate-100'
              }`}
            >
              <Headset className="w-4 h-4" />
              <span>נציג</span>
              {openTicketCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-[#C0392B] rounded-full">
                  {openTicketCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === 'admin'
                  ? 'bg-[#0E6E8C] text-white shadow-xs'
                  : 'text-[#1C2733] hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">נתונים ובדיקות</span>
              <span className="sm:hidden">ניהול</span>
            </button>

            <button
              onClick={() => onNavigate('guide')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === 'guide'
                  ? 'bg-[#0E6E8C] text-white shadow-xs'
                  : 'text-[#1C2733] hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>מדריך</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Throttled Banner */}
      {isThrottled && (
        <div className="bg-[#B4690E]/10 border-t border-[#B4690E]/20 px-4 py-2 text-xs sm:text-sm text-[#B4690E] flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>המערכת מתמודדת כרגע עם עומס מכסות זמני (429). ממתינים מספר שניות ומנסים מחדש באופן אוטומטי.</span>
        </div>
      )}
    </header>
  );
};
