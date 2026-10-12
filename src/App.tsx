/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { getStorageAdapter } from './store/supabaseAdapter.ts';
import { StorageAdapter, SupportTicket } from './store/types.ts';
import { AdminView } from './ui/AdminView.tsx';
import { EmployeeView } from './ui/EmployeeView.tsx';
import { GuideView } from './ui/GuideView.tsx';
import { ActiveScreen, Header } from './ui/Header.tsx';
import { RepresentativeView } from './ui/RepresentativeView.tsx';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('employee');
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [isThrottled, setIsThrottled] = useState(false);

  // Storage adapter singleton
  const storage: StorageAdapter = getStorageAdapter();
  const sessionId = 'session-strauss-primary';

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

  // Subscribe to tickets to keep the open-tickets badge updated
  useEffect(() => {
    const unsub = storage.onTicketsChange((tickets: SupportTicket[]) => {
      const open = tickets.filter((t) => t.status === 'open').length;
      setOpenTicketsCount(open);
    });
    return () => unsub();
  }, [storage]);

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-[#1C2733] flex flex-col font-['Heebo',sans-serif]">
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
          <EmployeeView
            storage={storage}
            sessionId={sessionId}
            onTicketCreated={() => {
              // Ticket badge updates via listener
            }}
          />
        )}

        {activeScreen === 'rep' && <RepresentativeView storage={storage} />}

        {activeScreen === 'admin' && <AdminView />}

        {activeScreen === 'guide' && <GuideView />}
      </main>

      {/* Global Minimal Footer */}
      <footer className="py-4 border-t border-[#E3E8EE] bg-white text-center text-xs text-slate-400">
        יועץ הרכב של שטראוס (Yoetz HaRechev) · מערכת השוואת שכר נטו ורכב חברה · שנת מס 2025
      </footer>
    </div>
  );
}
