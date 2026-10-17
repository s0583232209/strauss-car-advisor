/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from './api/client.ts';
import { AdminView } from './ui/AdminView.tsx';
import { EmployeeView } from './ui/EmployeeView.tsx';
import { GuideView } from './ui/GuideView.tsx';
import { AdvisorLogo, HillsScene } from './ui/CarDecor.tsx';
import { ActiveScreen, Header } from './ui/Header.tsx';
import { RepresentativeView } from './ui/RepresentativeView.tsx';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('employee');
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [isThrottled, setIsThrottled] = useState(false);

  // Handle Hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('rep')) {
        setActiveScreen('rep');
      } else if (hash.includes('admin')) {
        setActiveScreen('admin');
      } else if (hash.includes('guide')) {
        setActiveScreen('guide');
      } else {
        setActiveScreen('employee');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync hash when screen changes
  const handleNavigate = (screen: ActiveScreen) => {
    setActiveScreen(screen);
    if (screen === 'employee') window.location.hash = '#/';
    else if (screen === 'rep') window.location.hash = '#/rep';
    else if (screen === 'admin') window.location.hash = '#/admin';
    else if (screen === 'guide') window.location.hash = '#/guide';
  };

  // Poll the open-tickets count for the header badge (a number only, no ticket content)
  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen bg-surface text-ink flex flex-col font-sans">
      {/* Top Header with role navigation */}
      <Header
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        openTicketCount={openTicketsCount}
        isThrottled={isThrottled}
      />

      {/* Main Screen Content */}
      <main className="flex-1">
        {activeScreen === 'employee' && (
          <EmployeeView onThrottledChange={setIsThrottled} />
        )}

        {activeScreen === 'rep' && <RepresentativeView />}

        {activeScreen === 'admin' && <AdminView />}

        {activeScreen === 'guide' && <GuideView />}
      </main>

      {/* Footer: Strauss-green hills with vehicles slowly driving over them */}
      <footer className="mt-10">
        <HillsScene />
        <div className="bg-green -mt-px py-3 px-4 flex items-center justify-center gap-2 text-center text-xs font-medium text-ink">
          <AdvisorLogo variant="light" className="w-6 h-6 shrink-0" />
          <span>יועץ הרכב של שטראוס · מערכת השוואת שכר נטו ורכב חברה · שנת מס 2025</span>
        </div>
      </footer>
    </div>
  );
}
