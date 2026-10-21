/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ChevronUp,
  Edit3,
  Paperclip,
  RotateCcw,
  Send,
  User,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { CarHighlights, ChatMessage, ComparisonResult,EmployeeProfile, Rules, SessionState } from '../../shared/types.ts';
import { api } from '../api/client.ts';
import { AdvisorLogo, Pinwheel } from './CarDecor.tsx';
import { ComparisonCard } from './ComparisonCard.tsx';
import { PayslipModal } from './PayslipModal.tsx';

// Empty profile until the server sends the conversation
const emptyProfile = () => ({}) as EmployeeProfile;

// How often the chat asks the server for rep answers that arrived meanwhile
const SYNC_INTERVAL_MS = 4000;
// Card edits are sent after the employee stops typing for this long
const PROFILE_SAVE_DELAY_MS = 400;

interface EmployeeViewProps {
  /** The model provider is throttling (shown in the header) */
  onThrottledChange?: (throttled: boolean) => void;
}

const systemNote = (content: string): ChatMessage => ({
  id: `local-${Date.now()}`,
  role: 'system',
  content,
  timestamp: Date.now(),
});

export const EmployeeView: React.FC<EmployeeViewProps> = ({ onThrottledChange }) => {
  // State: the conversation as the server keeps it
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile>(emptyProfile);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastComparison, setLastComparison] = useState<ComparisonResult | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // What the agent is doing right now (shown in the typing indicator)
  const [agentStatus, setAgentStatus] = useState('');

  // State: Modals & Panels
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  // On lg+ screens the chat matches the open profile card's height, and keeps that height
  // while the profile is closed so the chat never jumps
  const [profileHeight, setProfileHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = profileCardRef.current;
    if (!el) return;
    const wide = window.matchMedia('(min-width: 64rem)');
    const update = () => setProfileHeight(wide.matches ? el.offsetHeight : undefined);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    wide.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', update);
    };
  }, [isProfileOpen]);
  // Latest values for timers and async callbacks that would otherwise see stale closures
  const busyRef = useRef(false);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const profileSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Shows the server's view of the conversation */
  const applyState = (s: SessionState) => {
    setSessionId(s.id);
    setProfile(s.profile);
    setMessages(s.messages);
    setLastComparison(s.lastComparison);
    lastMessageIdRef.current = s.messages[s.messages.length - 1]?.id;
  };

  const showError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'אנא נסו שנית';
    setMessages((prev) => [...prev, systemNote(`שגיאה: ${message}`)]);
  };

  /** Runs one server call at a time (a message or a reset) */
  const runExclusive = async (fn: () => Promise<void>): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await fn();
    } catch (err) {
      showError(err);
    } finally {
      busyRef.current = false;
    }
  };

  // Load this browser's conversation on mount
  useEffect(() => {
    api.sessions.current().then(applyState).catch(showError);
  }, []);

  // Approved pros and cons of the catalog cars; fetched again with each new comparison (the admin may
  // have approved more). Without them the card shows the money comparison only.
  const [carHighlights, setCarHighlights] = useState<Record<string, CarHighlights>>({});
  // The rules behind the card's amounts and source notes (EV refund, tax year, NI rates); fetched with the
  // highlights since the admin may have uploaded new rules. Without them the card leaves those lines out.
  const [rules, setRules] = useState<Rules | undefined>(undefined);
  useEffect(() => {
    if (!lastComparison) return;
    api.highlights().then(setCarHighlights).catch(() => undefined);
    api.meta().then((m) => setRules(m.rules)).catch(() => undefined);
  }, [lastComparison]);

  // Rep answers arrive through the server: poll while idle and show new messages
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(async () => {
      if (busyRef.current) return;
      try {
        const s = await api.sessions.sync(sessionId, false);
        if (busyRef.current) return;
        if (s.messages[s.messages.length - 1]?.id !== lastMessageIdRef.current) applyState(s);
      } catch {
        // Next poll tries again
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sessionId]);

  // Keep the conversation scrolled internally; scrollIntoView also moves the page.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isTyping]);

  /** One agent turn on the server; the status line follows what the agent is doing */
  const sendToAgent = async (text: string, id: string) => {
    // Shown right away; replaced by the server's conversation when the turn ends
    setMessages((prev) => [...prev, { id: `local-usr-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() }]);
    setAgentStatus('');
    setIsTyping(true);
    try {
      const s = await api.sessions.sendMessage(id, text, false, (event) => {
        if (event.type === 'status') setAgentStatus(event.text);
        else if (event.type === 'throttled') onThrottledChange?.(event.on);
      });
      applyState(s);
    } finally {
      setIsTyping(false);
      onThrottledChange?.(false);
    }
  };

  // Handle user send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping || !sessionId) return;
    if (!textToSend) setInputValue('');
    await runExclusive(() => sendToAgent(text, sessionId));
  };

  // Reset conversation: a new conversation starts with an empty profile (no data carried over)
  const handleNewConversation = () =>
    runExclusive(async () => {
      if (!sessionId) return;
      applyState(await api.sessions.reset(sessionId));
    });

  /** Card edit: shown at once, saved (and the comparison recomputed) when typing pauses */
  const handleProfileEdit = (updates: Partial<EmployeeProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    if (profileSaveTimer.current) clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(async () => {
      if (!sessionId) return;
      try {
        // undefined is sent as null: the field becomes missing again
        const body = Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v ?? null]));
        const s = await api.sessions.updateProfile(sessionId, body, 'manual');
        setLastComparison(s.lastComparison);
      } catch (err) {
        showError(err);
      }
    }, PROFILE_SAVE_DELAY_MS);
  };

  // Grid placement. Without a comparison the chat is centered and the profile sits at the side;
  // a closed profile shrinks to a round icon and gives its width to the calculations.
  const chatCols = [
    'lg:col-span-8',
    isProfileOpen ? '' : 'lg:col-start-3',
    lastComparison ? 'xl:col-span-8 xl:col-start-auto' : 'xl:col-span-12 xl:col-start-7',
  ].join(' ');
  const calcCols = isProfileOpen ? 'xl:col-span-10' : 'xl:col-span-14';
  const profileCols = isProfileOpen
    ? `lg:col-span-4 ${lastComparison ? 'xl:col-span-6' : 'xl:col-span-6 xl:col-start-19'}`
    : `lg:col-span-2 lg:col-start-11 ${lastComparison ? 'xl:col-span-2 xl:col-start-auto' : 'xl:col-span-2 xl:col-start-23'}`;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Main Grid. xl: chat | calculations | profile. lg: chat | profile, calculations below. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-24 gap-8 items-start">
        {/* Chat */}
        <div className={`${chatCols} lg:order-1 xl:sticky xl:top-24 min-w-0`}>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-line border-t-[3px] border-t-brand shadow-xs flex flex-col h-[min(62vh,680px)] min-h-[360px] lg:h-[calc(100vh-15rem)] lg:max-h-[820px]"
            style={profileHeight ? { height: profileHeight, maxHeight: 'none' } : undefined}
          >
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white border border-line shadow-xs flex items-center justify-center shrink-0">
                  <AdvisorLogo className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">שיחה עם יועץ הרכב</h3>
                  <span className="text-[11px] text-success flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                    מחובר · מנוע חישוב שכר 2025
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Payslip upload is disabled until the feature is finished */}
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 cursor-not-allowed opacity-70 flex items-center gap-1"
                  title="העלאת תלוש - עדיין בפיתוח"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">העלאת תלוש - עדיין בפיתוח</span>
                </button>

                <button
                  onClick={handleNewConversation}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1"
                  title="שיחה חדשה"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">שיחה חדשה</span>
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div ref={messagesContainerRef} className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto flex flex-col text-sm">
              {/* mt-auto keeps messages at the bottom; empty space stays above them */}
              <div className="mt-auto space-y-3">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isRep = msg.role === 'rep';
                  const isSystem = msg.role === 'system';

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="p-2.5 rounded-lg bg-slate-100 text-xs text-slate-600 text-center mx-auto max-w-md border border-slate-200"
                      >
                        {msg.content}
                      </div>
                    );
                  }

                  if (isRep) {
                    return (
                      <div
                        key={msg.id}
                        className="p-3 rounded-xl bg-brand/10 border border-brand/20 text-xs sm:text-sm text-brand-dark font-medium"
                      >
                        {msg.content}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                          isUser
                            ? 'bg-brand text-white rounded-br-xs'
                            : 'bg-white text-ink border border-line rounded-bl-xs shadow-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-end">
                    <div className="bg-white border border-line shadow-xs rounded-2xl px-4 py-2.5 rounded-bl-xs flex items-center gap-2 text-muted text-xs font-medium">
                      <Pinwheel className="w-6 h-6" spin />
                      <span>{agentStatus || 'מחשב נתונים במנוע השכר...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="p-2 text-slate-300 rounded-lg cursor-not-allowed"
                  title="העלאת תלוש - עדיין בפיתוח"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="כתבו כאן... (למשל: מה יקרה לנטו אם אעבור לרכב חשמלי?)"
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-line bg-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="lift px-4 py-2.5 rounded-full bg-brand text-white hover:bg-brand-dark disabled:opacity-40 transition-colors flex items-center gap-1.5 text-sm font-semibold shrink-0"
                >
                  <span>שלח</span>
                  <Send className="w-3.5 h-3.5 rotate-180" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Calculations */}
        {lastComparison && (
          <div className={`lg:col-span-12 lg:order-3 ${calcCols} xl:order-2 min-w-0`}>
            <ComparisonCard
              comparison={lastComparison}
              rules={rules}
              highlights={{
                today: profile.hasCar && profile.currentCarId ? carHighlights[profile.currentCarId] : undefined,
                alt:
                  lastComparison.targetCar && lastComparison.targetCar.id !== profile.currentCarId
                    ? carHighlights[lastComparison.targetCar.id]
                    : undefined,
              }}
              onSelectCarAgain={() => handleSendMessage('אילו רכבים נוספים אני יכול לבחור בקבוצה שלי?')}
              onCompareAnother={() => handleSendMessage('מה קורה אם אני מוותר על הרכב ומקבל אחזקה?')}
              onAskRep={() =>
                runExclusive(async () => {
                  if (!sessionId) return;
                  applyState(await api.sessions.askRep(sessionId));
                })
              }
              onShowRankedOptions={() => handleSendMessage('איזה רכב בקטלוג הכי משתלם לי מבחינת הנטו?')}
              onAskCarFit={sessionId ? (text, history) => api.sessions.carFit(sessionId, text, history) : undefined}
            />
          </div>
        )}

        {/* Profile panel */}
        <div className={`${profileCols} lg:order-2 xl:order-3 xl:sticky xl:top-24`}>
          {!isProfileOpen ? (
            // Closed: a round profile icon at the side; clicking it opens the card
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                aria-expanded={false}
                aria-label="הצגת הפרופיל"
                title="הצגת הפרופיל"
                className="w-14 h-14 rounded-full bg-white border border-line shadow-xs hover:shadow-sm transition flex items-center justify-center"
              >
                <span className="w-10 h-10 rounded-full bg-lime-light text-success flex items-center justify-center">
                  <User className="w-5 h-5" />
                </span>
              </button>
            </div>
          ) : (
          <div ref={profileCardRef} className="bg-white rounded-2xl border border-line border-t-[3px] border-t-green shadow-xs p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            {/* Clicking the title closes the card to a round icon */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              aria-expanded={true}
              className="flex items-center gap-2 text-right"
              title="הסתרת הפרופיל"
            >
              <div className="w-8 h-8 rounded-lg bg-lime-light text-success flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">פרופיל שנאסף</h3>
                <span className="text-[11px] text-slate-500">נתוני שכר וזכאות נוכחיים</span>
              </div>
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-2.5 py-1 text-xs font-semibold text-brand-dark hover:bg-brand/10 rounded-lg transition-colors flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingProfile ? 'סיום' : 'תיקון נתונים'}</span>
            </button>
          </div>

          {/* Profile fields list */}
          <div className="space-y-3 text-xs">
            {/* Base Salary */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">שכר בסיס חודשי:</span>
                {isEditingProfile ? (
                  <input
                    type="number"
                    min={0}
                    value={profile.base ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      handleProfileEdit({ base: raw === '' || Number(raw) < 0 ? undefined : Number(raw) });
                    }}
                    className="w-24 px-2 py-1 text-xs font-bold border border-slate-300 rounded bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-900 text-sm">
                    {profile.base !== undefined ? `${profile.base.toLocaleString()} ₪` : 'חסר'}
                  </span>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-lime-light text-success border border-green/25 font-semibold">
                קבוצה {profile.group ?? 'חסר'}
              </span>
            </div>

            {/* Occupation */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 block mb-0.5">עיסוק / תפקיד:</span>
              <span className="font-bold text-slate-900">{profile.occupation || 'לא הוגדר'}</span>
            </div>

            {/* Current Car */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500">מצב רכב נוכחי:</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    profile.hasCar
                      ? 'bg-brand/10 text-brand-dark'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {profile.hasCar === undefined ? 'חסר' : profile.hasCar ? 'רכב חברה קיים' : 'ויתור (אחזקה)'}
                </span>
              </div>
              <div className="font-bold text-slate-900">
                {profile.hasCar === undefined
                  ? 'חסר'
                  : profile.hasCar
                  ? profile.currentCarName
                  : `אחזקת רכב: ${profile.currentMaintenance === undefined ? 'חסר' : `${profile.currentMaintenance.toLocaleString()} ₪`}`}
              </div>
              {profile.hasCar && (
                <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
                  <span>שווי שימוש: {profile.currentBenefit === undefined ? 'חסר' : `${profile.currentBenefit.toLocaleString()} ₪`}</span>
                  <span>השתתפות: {profile.currentParticipation === undefined ? 'חסר' : `${profile.currentParticipation.toLocaleString()} ₪`}</span>
                </div>
              )}
            </div>

            {/* Deductions & Credit Points */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">עמלות חודשיות:</span>
                <span className="font-bold text-slate-900">{profile.commissions === undefined ? 'חסר' : `${profile.commissions.toLocaleString()} ₪`}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">בונוס חודשי:</span>
                <span className="font-bold text-slate-900">{profile.bonus === undefined ? 'חסר' : `${profile.bonus.toLocaleString()} ₪`}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">הפרשת פנסיה:</span>
                <span className="font-bold text-slate-900">{profile.pensionPct === undefined ? 'חסר' : `${profile.pensionPct}%`}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">קרן השתלמות:</span>
                <span className="font-bold text-slate-900">{profile.studyFundPct === undefined ? 'חסר' : `${profile.studyFundPct}%`}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">נקודות זיכוי:</span>
                <span className="font-bold text-slate-900">{profile.creditPoints ?? 'חסר'}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[11px]">ילדים עד 23:</span>
                <span className="font-bold text-slate-900">{profile.childrenUpTo23 ?? 'חסר'}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            שינוי נתון מחשב מחדש את תוצאת ההשוואה באופן מיידי
          </div>
          </div>
          )}
        </div>
      </div>

      {/* Payslip Modal */}
      <PayslipModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        onApplyExtractedData={(extracted) =>
          runExclusive(async () => {
            if (!sessionId) return;
            applyState(await api.sessions.updateProfile(sessionId, extracted, 'payslip'));
          })
        }
      />
    </div>
  );
};

