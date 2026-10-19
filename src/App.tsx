/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { AuthStatus } from '../shared/types.ts';
import { api, setLoggedOutHandler } from './api/client.ts';
import { AccessGate } from './ui/AccessGate.tsx';
import { AccessDeniedPage } from './ui/AccessDeniedPage.tsx';
import { AdminView } from './ui/AdminView.tsx';
import { EmployeeView } from './ui/EmployeeView.tsx';
import { AdvisorLogo, HillsScene } from './ui/CarDecor.tsx';
import { ActiveScreen, ALL_SCREENS, Header, SCREENS_BY_ROLE } from './ui/Header.tsx';
import { NotFoundPage } from './ui/NotFoundPage.tsx';
import { RepresentativeView } from './ui/RepresentativeView.tsx';

const LOGGED_OUT: AuthStatus = { enabled: true, user: null };

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen | null>('employee');
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [isThrottled, setIsThrottled] = useState(false);
  // null while GET /api/auth/me is on its way
  const [auth, setAuth] = useState<AuthStatus | null>(null);

  // Who is logged in; any call that the server refuses with 401 sends the user back to the login screen
  useEffect(() => {
    setLoggedOutHandler(() => setAuth(LOGGED_OUT));
    api.auth.me().then(setAuth).catch(() => setAuth(LOGGED_OUT));
  }, []);

  const needsLogin = auth !== null && auth.enabled && !auth.user;
  const screens: ActiveScreen[] = !auth || needsLogin ? [] : auth.user ? SCREENS_BY_ROLE[auth.user.role] : ALL_SCREENS;
  const userRole = auth?.user?.role ?? (auth && !auth.enabled ? 'admin' : null);

  // /:role/pagename — e.g. /employee/employee, /rep/rep, /admin/admin
  const PAGE_MAP: Record<string, ActiveScreen> = { home: 'employee', rep: 'rep', admin: 'admin' };

  const screenFromPath = (): ActiveScreen | null => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'employee';
    const page = parts[1]?.toLowerCase();
    return PAGE_MAP[page] ?? null; // null → 404
  };

  const pageSlug = (s: ActiveScreen) => s === 'employee' ? 'home' : s;

  // null = 404 (unknown path); known page the user's role can't access = 403
  const is404 = activeScreen === null;
  const is403 = !is404 && screens.length > 0 && !screens.includes(activeScreen!);
  const screen: ActiveScreen = (!is404 && !is403 ? activeScreen : screens[0]) ?? 'employee';

  // Handle path-based routing
  useEffect(() => {
    const handlePopState = () => setActiveScreen(screenFromPath());
    setActiveScreen(screenFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Once role is known, redirect bare / to /:role/employee
  useEffect(() => {
    if (!userRole) return;
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      window.history.replaceState(null, '', `/${userRole}/home`);
      setActiveScreen('employee');
    }
  }, [userRole]);

  // Sync URL when navigating
  const handleNavigate = (next: ActiveScreen) => {
    setActiveScreen(next);
    if (userRole) window.history.pushState(null, '', `/${userRole}/${pageSlug(next)}`);
  };

  const handleLogout = async () => {
    try { await api.auth.logout(); }
    finally {
      setAuth(LOGGED_OUT);
      window.history.replaceState(null, '', '/');
    }
  };

  // Poll the open-tickets count for the header badge (a number only, no ticket content), for reps and admins
  const showsTicketBadge = screens.includes('rep');
  useEffect(() => {
    if (!showsTicketBadge) return;
    let active = true;
    const refresh = () =>
      api.tickets
        .openCount()
        .then((n) => active && setOpenTicketsCount(n))
        .catch(() => undefined);
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [showsTicketBadge]);

  return (
    <div className="isolate min-h-screen bg-surface text-ink flex flex-col font-sans">
      {/* Top Header with role navigation */}
      <Header
        activeScreen={screen ?? 'employee'}
        onNavigate={handleNavigate}
        screens={screens}
        openTicketCount={openTicketsCount}
        isThrottled={isThrottled}
        userEmail={auth?.user?.email}
        onLogout={auth?.user ? handleLogout : undefined}
      />

      {/* Main Screen Content */}
      <main className="flex-1">
        {auth === null && <div className="py-16 text-center text-sm text-slate-500">טוען...</div>}

        {needsLogin && <AccessGate onLoggedIn={(user) => setAuth({ enabled: true, user })} />}

        {!needsLogin && is404 && <NotFoundPage />}

        {!needsLogin && is403 && <AccessDeniedPage />}

        {!needsLogin && !is404 && !is403 && screen === 'employee' && (
          <EmployeeView onThrottledChange={setIsThrottled} />
        )}

        {!needsLogin && !is404 && !is403 && screen === 'rep' && <RepresentativeView />}

        {!needsLogin && !is404 && !is403 && screen === 'admin' && <AdminView />}

      </main>

      {/* Footer: Strauss-green hills with vehicles slowly driving over them.
          Pulled up behind the content (the top of the hills is empty sky) so short screens need no scroll. */}
      <footer className="relative -z-10 -mt-12 sm:-mt-16">
        <HillsScene />
        <div className="bg-green -mt-px py-3 px-4 flex items-center justify-center gap-2 text-center text-xs font-medium text-ink">
          <AdvisorLogo variant="light" className="w-6 h-6 shrink-0" />
          <span>יועץ הרכב של שטראוס · מערכת השוואת שכר נטו ורכב חברה · שנת מס 2025</span>
        </div>
      </footer>
    </div>
  );
}
