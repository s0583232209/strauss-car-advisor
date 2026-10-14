/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  Car as CarIcon,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Paperclip,
  PlusCircle,
  RotateCcw,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  User,
  Users,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { runAgentTurn } from '../agent/loop.ts';
import { buildOpeningMessage } from '../agent/profileStatus.ts';
import { getMissingFields } from '../agent/tools.ts';
import employeesData from '../data/employees.json';
import { buildScenario, findCarByIdOrName, findOccupation } from '../engine/scenario.ts';
import { ComparisonResult, EligibilityGroup, EmployeeProfile } from '../engine/types.ts';
import { applyRepAnswer, findUndeliveredAnswers } from '../store/repAnswer.ts';
import { ChatMessage, StorageAdapter, SupportTicket } from '../store/types.ts';
import { AdvisorLogo, Pinwheel } from './CarDecor.tsx';
import { ComparisonCard } from './ComparisonCard.tsx';
import { PayslipModal } from './PayslipModal.tsx';

// Start of the system message shown when a sample employee is loaded (dry runs only)
const SAMPLE_LOADED_PREFIX = 'נטענו בהצלחה נתוני הדוגמה של';

// Empty profile: every field is undefined until the agent collects it (get_missing_fields);
// 0 is a valid answer. EmployeeProfile keeps the fields required because the engine needs
// them, so every buildScenario call is guarded by getMissingFields.
const emptyProfile = () => ({}) as EmployeeProfile;

interface EmployeeViewProps {
  storage: StorageAdapter;
  sessionId: string;
  onTicketCreated: () => void;
}

// Sample-question chips take turns through the Strauss pinwheel colors
const CHIP_COLORS = [
  'bg-brand-light border-brand/20 hover:bg-brand/15',
  'bg-sky-light border-sky/30 hover:bg-sky/20',
  'bg-lime-light border-green/25 hover:bg-lime/60',
  'bg-orange-light border-orange/30 hover:bg-orange/20',
];

export const EmployeeView: React.FC<EmployeeViewProps> = ({
  storage,
  sessionId,
  onTicketCreated,
}) => {
  // State: Profile
  const [profile, setProfile] = useState<EmployeeProfile>(emptyProfile);

  // Recompute a comparison only when the profile is complete for its scenario
  const recomputeIfComplete = (p: EmployeeProfile, prev: ComparisonResult): ComparisonResult | null =>
    getMissingFields(p, prev.scenarioType).length > 0
      ? null
      : buildScenario(p, { type: prev.scenarioType, targetCarId: prev.targetCar?.id });

  // State: Messages & Conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);

  // State: Last Comparison
  const [lastComparison, setLastComparison] = useState<ComparisonResult | null>(null);

  // State: Toggle for rep participation demo mode
  const [repParticipationMode, setRepParticipationMode] = useState(false);

  // State: Modals & Panels
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Latest values for async callbacks (agent turn, chips) that would otherwise see stale closures
  const profileRef = useRef(profile);
  const lastComparisonRef = useRef(lastComparison);
  const messagesRef = useRef(messages);
  profileRef.current = profile;
  lastComparisonRef.current = lastComparison;
  messagesRef.current = messages;

  // Load state from StorageAdapter on mount
  useEffect(() => {
    async function loadInitial() {
      const savedProfile = await storage.loadProfile(sessionId);
      const savedMessages = (await storage.loadMessages(sessionId)) || [];

      // The profile belongs to its conversation. Keep it only if there is a conversation, and keep
      // a sample profile only if it was loaded on purpose (older versions saved Noa as the default).
      const hasConversation = savedMessages.length > 1;
      const sampleLoaded = savedMessages.some((m) => m.role === 'system' && m.content.startsWith(SAMPLE_LOADED_PREFIX));
      const keepSaved = !!savedProfile && hasConversation && (!savedProfile.id || sampleLoaded);

      if (keepSaved) {
        setProfile(savedProfile);
        setMessages(savedMessages);
        const savedComp = await storage.loadLastComparison(sessionId);
        if (savedComp) setLastComparison(savedComp);
      } else {
        // Start clean: no profile, no comparison, only the greeting
        await storage.saveProfile(sessionId, emptyProfile());
        await storage.saveLastComparison(sessionId, null);
        // Initial greeting
        const greeting: ChatMessage = {
          id: 'msg-0',
          role: 'assistant',
          content: buildOpeningMessage(emptyProfile()),
          timestamp: Date.now(),
        };
        setMessages([greeting]);
        await storage.saveMessages(sessionId, [greeting]);
      }
    }

    loadInitial();
  }, [sessionId, storage]);

  // Ticket ids being delivered right now (polling fires every 2s, delivery is async)
  const deliveringRef = useRef<Set<string>>(new Set());
  // Latest handleSendMessage for the ticket subscription below
  const sendMessageRef = useRef<typeof handleSendMessage | null>(null);

  // Subscribe to storage changes (e.g. when rep answers ticket in another tab)
  useEffect(() => {
    const unsubscribe = storage.onTicketsChange(async (tickets) => {
      for (const ticket of findUndeliveredAnswers(tickets, sessionId)) {
        if (deliveringRef.current.has(ticket.id)) continue;
        deliveringRef.current.add(ticket.id);

        const delivery = applyRepAnswer(
          ticket,
          profileRef.current,
          lastComparisonRef.current,
          Date.now()
        );
        // Mark as delivered first, so a reload or another poll never shows it twice
        await storage.saveTicket(delivery.ticket);

        const repMsg: ChatMessage = {
          id: `rep-ans-${ticket.id}`,
          role: 'rep',
          content: delivery.repMessageText,
          comparison: delivery.comparison,
          timestamp: Date.now(),
        };
        const newMessages = [...messagesRef.current, repMsg];
        messagesRef.current = newMessages;
        setMessages(newMessages);
        await storage.addMessage(sessionId, repMsg);

        if (delivery.comparison) {
          lastComparisonRef.current = delivery.comparison;
          setLastComparison(delivery.comparison);
          await storage.saveLastComparison(sessionId, delivery.comparison);
        }

        if (delivery.agentNote) {
          await sendMessageRef.current?.(delivery.agentNote, {
            messages: newMessages,
            internal: true,
          });
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId, storage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle user send message
  const handleSendMessage = async (
    textToSend?: string,
    override?: { profile?: EmployeeProfile; messages?: ChatMessage[]; internal?: boolean }
  ) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    // Internal system notes (e.g. a rep answer) go to the agent only, not to the chat
    let newMessages = override?.messages ?? messagesRef.current;
    if (!override?.internal) {
      setInputValue('');
      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      newMessages = [...newMessages, userMsg];
      messagesRef.current = newMessages;
      setMessages(newMessages);
      await storage.addMessage(sessionId, userMsg);
    }

    setIsTyping(true);

    // Comparison computed during this turn (attached to the assistant message)
    let turnComparison: ComparisonResult | undefined;

    try {
      const turnResult = await runAgentTurn(
        text,
        newMessages,
        {
          // Copy: tools mutate the turn profile in place (tools.ts update_profile)
          profile: { ...(override?.profile ?? profileRef.current) },
          lastComparison: lastComparisonRef.current,
          repParticipationMode,
          onProfileUpdate: async (updates) => {
            const updated = { ...profileRef.current, ...updates };
            profileRef.current = updated;
            setProfile(updated);
            storage.saveProfile(sessionId, updated);
            // If last comparison exists, recompute with updated profile
            const prevComparison = lastComparisonRef.current;
            const recomputed = prevComparison ? recomputeIfComplete(updated, prevComparison) : null;
            if (recomputed) {
              lastComparisonRef.current = recomputed;
              setLastComparison(recomputed);
              storage.saveLastComparison(sessionId, recomputed);
            }
          },
          onComparisonRun: async (comp) => {
            turnComparison = comp;
            lastComparisonRef.current = comp;
            setLastComparison(comp);
            await storage.saveLastComparison(sessionId, comp);
          },
          onEscalate: async (question, summary) => {
            const ticketId = `TICK-${Date.now().toString().slice(-4)}`;
            const ticket: SupportTicket = {
              id: ticketId,
              sessionId,
              question,
              summary,
              status: 'open',
              profile: profileRef.current,
              lastComparison: lastComparisonRef.current || undefined,
              transcript: newMessages,
              createdAt: Date.now(),
            };
            await storage.saveTicket(ticket);
            onTicketCreated();
            return ticketId;
          },
        },
        (throttled) => setIsThrottled(throttled)
      );

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: turnResult.text,
        comparison: turnComparison,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      await storage.addMessage(sessionId, assistantMsg);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `שגיאה בעיבוד הבקשה: ${err?.message || 'אנא נסו שנית'}.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  sendMessageRef.current = handleSendMessage;

  // Helper to load sample employee
  const handleLoadSampleEmployee = async (
    empId: string
  ): Promise<{ profile: EmployeeProfile; messages: ChatMessage[] } | undefined> => {
    const target = (employeesData as EmployeeProfile[]).find((e) => e.id === empId);
    if (!target) return undefined;

    profileRef.current = target;
    setProfile(target);
    await storage.saveProfile(sessionId, target);

    // Initial baseline comparison
    const initialComp = buildScenario(target, { type: 'keep' as any });
    lastComparisonRef.current = initialComp;
    setLastComparison(initialComp);
    await storage.saveLastComparison(sessionId, initialComp);

    const loadMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'system',
      content: `${SAMPLE_LOADED_PREFIX} ${target.name} (${target.occupation}, קבוצה ${target.group}, שכר בסיס ${target.base?.toLocaleString()} ₪).`,
      timestamp: Date.now(),
    };
    const updatedMessages = [...messagesRef.current, loadMsg];
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    await storage.addMessage(sessionId, loadMsg);
    return { profile: target, messages: updatedMessages };
  };

  // Reset conversation: a new conversation starts with an empty profile (no data carried over)
  const handleNewConversation = async () => {
    const greeting: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: buildOpeningMessage(emptyProfile()),
      timestamp: Date.now(),
    };
    const cleared = emptyProfile();
    profileRef.current = cleared;
    lastComparisonRef.current = null;
    messagesRef.current = [greeting];
    setProfile(cleared);
    setMessages([greeting]);
    setLastComparison(null);
    await storage.saveProfile(sessionId, cleared);
    await storage.saveMessages(sessionId, [greeting]);
    await storage.saveLastComparison(sessionId, null);
  };

  // Sample questions chips
  const sampleChips = [
    {
      label: 'קורולה קרוס ← Atto 3 חשמלי',
      empId: 'E-001',
      text: 'אם אעבור מהקורולה קרוס ל-BYD Atto 3 החשמלי - כמה זה ישנה לי בנטו?',
    },
    {
      label: '5 ילדים: מעבר לקרניבל',
      empId: 'E-002',
      text: 'יש לי 5 ילדים. אם אקח קרניבל במסלול ברוכת ילדים - מה יקרה לנטו?',
    },
    {
      label: 'אחזקת רכב ← MG4 חשמלי',
      empId: 'E-003',
      text: 'היום אני מקבלת אחזקת רכב. אם אקח MG4 חשמלי - כמה אפסיד או ארוויח בנטו?',
    },
    {
      label: 'טוסון ← EV3 חשמלי',
      empId: 'E-004',
      text: 'אם אחליף את הטוסון ב-EV3 - מה ההפרש בנטו?',
    },
    {
      label: 'מאזדה 3 ← ויתור על רכב',
      empId: 'E-005',
      text: 'אם אוותר על הרכב ואקבל אחזקה - כמה אקבל בנטו?',
    },
    {
      label: 'אוקטביה ← טסלה מודל 3',
      empId: 'E-006',
      text: 'אם אעבור מהאוקטביה לטסלה מודל 3 - מה יקרה לנטו?',
    },
    {
      label: 'עובדת קבוצה ב׳ שמוותרת על הרכב',
      empId: 'E-GEN-B',
      text: 'אני מהנדסת תהליך מקבוצה ב עם שכר 15,000 ₪. אם אוותר על הנירו ואקבל אחזקת רכב - מה יקרה לנטו שלי?',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Demo helper bar */}
      <div className="bg-white p-4 rounded-xl border border-line border-t-[3px] border-t-brand mb-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Preset employee picker */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-dark" />
              <span>טען עובד לדוגמה:</span>
            </span>
            <select
              onChange={(e) => (e.target.value ? handleLoadSampleEmployee(e.target.value) : handleNewConversation())}
              value={profile.id || ''}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">ללא: שיחה חדשה עם נתונים אמיתיים</option>
              {(employeesData as any[]).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.occupation} · קבוצה {emp.group})
                </option>
              ))}
            </select>
          </div>

          {/* Toggle "השתתפות ברכב החדש" */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 font-medium">השתתפות ברכב חדש:</span>
            <button
              onClick={() => setRepParticipationMode(!repParticipationMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                repParticipationMode
                  ? 'bg-warning/15 text-warning border border-warning/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {repParticipationMode ? (
                <>
                  <ToggleRight className="w-4 h-4 text-warning" />
                  <span>אימות נציג (סימולציית פנייה)</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500" />
                  <span>לפי ברירת מחדל בקטלוג</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick sample question chips */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted ml-1">🚦 שאלות מפתח:</span>
          {sampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={async () => {
                const loaded = await handleLoadSampleEmployee(chip.empId);
                handleSendMessage(chip.text, loaded);
              }}
              className={`text-xs px-3 py-1.5 rounded-full text-ink border transition-colors ${CHIP_COLORS[idx % CHIP_COLORS.length]}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Chat + Profile Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chat & Comparison Card (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Chat Container */}
          <div className="bg-white rounded-2xl border border-line border-t-[3px] border-t-brand shadow-xs flex flex-col h-[520px]">
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
                <button
                  onClick={() => setIsPayslipModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                  title="העלאת תלוש שכר"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">העלאת תלוש</span>
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
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 text-sm">
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
                    <span>מחשב נתונים במנוע השכר...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setIsPayslipModalOpen(true)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="העלאת תלוש"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="כתבו כאן... (למשל: מה יקרה לנטו אם אעבור לרכב חשמלי?)"
                  className="flex-1 px-4 py-2.5 rounded-full border border-line bg-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
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

          {/* Comparison Card (Displayed directly below chat when available) */}
          {lastComparison && (
            <ComparisonCard
              comparison={lastComparison}
              onSelectCarAgain={() => handleSendMessage('אילו רכבים נוספים אני יכול לבחור בקבוצה שלי?')}
              onCompareAnother={() => handleSendMessage('מה קורה אם אני מוותר על הרכב ומקבל אחזקה?')}
              onAskRep={async () => {
                const ticketId = `TICK-${Date.now().toString().slice(-4)}`;
                const ticket: SupportTicket = {
                  id: ticketId,
                  sessionId,
                  question: `שאלה לגבי השוואת שכר בין ${lastComparison.todayCarLabel} ל-${lastComparison.altCarLabel}`,
                  summary: `העובד ביקש בירור ידני לגבי השוואת השכר המוצגת.`,
                  status: 'open',
                  profile,
                  lastComparison,
                  transcript: messages,
                  createdAt: Date.now(),
                };
                await storage.saveTicket(ticket);
                onTicketCreated();
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `tick-${Date.now()}`,
                    role: 'system',
                    content: `הפנייה נשלחה לנציג שכר (מספר פנייה: ${ticketId}). נציג יבדוק את הנתונים וישיב בהקדם.`,
                    timestamp: Date.now(),
                  },
                ]);
              }}
              onShowRankedOptions={() => handleSendMessage('איזה רכב בקטלוג הכי משתלם לי מבחינת הנטו?')}
            />
          )}
        </div>

        {/* Right Column: Collected Profile Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-line border-t-[3px] border-t-green shadow-xs p-5 sticky top-24">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-lime-light text-success flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">פרופיל שנאסף</h3>
                <span className="text-[11px] text-slate-500">נתוני שכר וזכאות נוכחיים</span>
              </div>
            </div>

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
                      const base = raw === '' || Number(raw) < 0 ? undefined : Number(raw);
                      const updated = { ...profile, base } as EmployeeProfile;
                      setProfile(updated);
                      storage.saveProfile(sessionId, updated);
                      const recomputed = lastComparison ? recomputeIfComplete(updated, lastComparison) : null;
                      if (recomputed) setLastComparison(recomputed);
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
      </div>

      {/* Payslip Modal */}
      <PayslipModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        onApplyExtractedData={async (extracted) => {
          setProfile((prev) => {
            const updated = { ...prev, ...extracted };
            storage.saveProfile(sessionId, updated);
            const recomputed = lastComparison ? recomputeIfComplete(updated, lastComparison) : null;
            if (recomputed) setLastComparison(recomputed);
            return updated;
          });

          const confirmMsg: ChatMessage = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: 'נתוני תלוש השכר מוזגו בהצלחה לתוך הפרופיל. המחשבון עודכן.',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, confirmMsg]);
          await storage.addMessage(sessionId, confirmMsg);
        }}
      />
    </div>
  );
};
