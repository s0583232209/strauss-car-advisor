/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  Filter,
  Headset,
  Inbox,
  MessageSquare,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { StorageAdapter, SupportTicket } from '../store/types.ts';

interface RepresentativeViewProps {
  storage: StorageAdapter;
}

export const RepresentativeView: React.FC<RepresentativeViewProps> = ({ storage }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'answered' | 'closed'>('all');

  // Form states
  const [replyText, setReplyText] = useState('');
  const [structuredValue, setStructuredValue] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('1/1');
  const [isSending, setIsSending] = useState(false);

  // Subscribe to tickets list
  useEffect(() => {
    const unsub = storage.onTicketsChange((all) => {
      setTickets(all);
      if (all.length > 0 && !selectedTicketId) {
        setSelectedTicketId(all[0].id);
      }
    });
    return () => unsub();
  }, [storage, selectedTicketId]);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null;

  const handleSendAnswer = async (status: 'answered' | 'closed') => {
    if (!selectedTicket || isSending) return;
    setIsSending(true);

    try {
      const updated: SupportTicket = {
        ...selectedTicket,
        status,
        answeredAt: Date.now(),
        answer: {
          text: replyText.trim() || 'פנייתך נבדקה ואושרה במערכת.',
          value: structuredValue ? parseFloat(structuredValue) : undefined,
          effectiveFrom: effectiveFrom.trim() || undefined,
        },
      };

      await storage.saveTicket(updated);
      setReplyText('');
      setStructuredValue('');
    } finally {
      setIsSending(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#E3E8EE] mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C2733]">מרכז תמיכה ופניות שכר</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0E6E8C]/10 text-[#0E6E8C]">
              ממשק נציג שכר
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            מענה לשאלות עובדים, החרגות ואימות גובה השתתפות עצמית ברכב חדש
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterStatus === 'all' ? 'bg-[#0E6E8C] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            הכל ({tickets.length})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterStatus === 'open'
                ? 'bg-[#C0392B] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            פתוחות ({tickets.filter((t) => t.status === 'open').length})
          </button>
          <button
            onClick={() => setFilterStatus('answered')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterStatus === 'answered'
                ? 'bg-[#1B8A5A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            נענו ({tickets.filter((t) => t.status === 'answered').length})
          </button>
        </div>
      </div>

      {/* Grid: Tickets List + Ticket Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E3E8EE] shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>רשימת פניות ({filteredTickets.length})</span>
            <Inbox className="w-4 h-4 text-slate-400" />
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">אין פניות תואמות לסינון זה</div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = ticket.id === selectedTicket?.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full p-4 text-right transition-colors flex flex-col gap-1.5 ${
                      isSelected ? 'bg-[#0E6E8C]/5 border-r-4 border-[#0E6E8C]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{ticket.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ticket.status === 'open'
                            ? 'bg-[#C0392B]/10 text-[#C0392B]'
                            : ticket.status === 'answered'
                            ? 'bg-[#1B8A5A]/10 text-[#1B8A5A]'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {ticket.status === 'open' ? 'פתוחה' : ticket.status === 'answered' ? 'נענתה' : 'סגורה'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{ticket.question}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{ticket.summary}</p>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span>עובד: {ticket.profile.name || ticket.profile.occupation}</span>
                      <span>{new Date(ticket.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Details Panel (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E3E8EE] shadow-xs p-6">
          {!selectedTicket ? (
            <div className="text-center py-16 text-slate-400 text-sm">בחרו פנייה מרשימת הפניות לעיון ומענה</div>
          ) : (
            <div className="space-y-6">
              {/* Ticket Top bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#1C2733]">{selectedTicket.id}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        selectedTicket.status === 'open'
                          ? 'bg-[#C0392B]/10 text-[#C0392B]'
                          : 'bg-[#1B8A5A]/10 text-[#1B8A5A]'
                      }`}
                    >
                      {selectedTicket.status === 'open' ? 'ממתינה למענה' : 'נענתה'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mt-1">{selectedTicket.question}</h3>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(selectedTicket.createdAt).toLocaleString('he-IL')}</span>
                </div>
              </div>

              {/* Bot summary & Employee context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Employee snapshot */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                    <User className="w-3.5 h-3.5 text-[#0E6E8C]" />
                    <span>פרופיל עובד/ת:</span>
                  </div>
                  <div>שם / תפקיד: {selectedTicket.profile.name || selectedTicket.profile.occupation}</div>
                  <div>קבוצת זכאות: {selectedTicket.profile.group} · שכר בסיס: {selectedTicket.profile.base?.toLocaleString()} ₪</div>
                  <div>רכב קיים: {selectedTicket.profile.hasCar ? selectedTicket.profile.currentCarName : 'ללא (אחזקה)'}</div>
                </div>

                {/* Bot Summary */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                    <MessageSquare className="w-3.5 h-3.5 text-[#0E6E8C]" />
                    <span>תמצית הבוט:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{selectedTicket.summary}</p>
                </div>
              </div>

              {/* Existing Answer if present */}
              {selectedTicket.answer && (
                <div className="p-4 rounded-xl bg-[#1B8A5A]/5 border border-[#1B8A5A]/20 text-xs sm:text-sm space-y-1">
                  <div className="font-bold text-[#1B8A5A] flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>תשובה שנשלחה לעובד:</span>
                  </div>
                  <p className="text-slate-800 font-medium">"{selectedTicket.answer.text}"</p>
                  {selectedTicket.answer.value !== undefined && (
                    <div className="text-slate-600 pt-1">
                      השתתפות מעודכנת: <strong>{selectedTicket.answer.value} ₪</strong> | בתוקף מ:{' '}
                      {selectedTicket.answer.effectiveFrom || 'מיידי'}
                    </div>
                  )}
                </div>
              )}

              {/* Reply Form */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-[#1C2733] flex items-center gap-2">
                  <Headset className="w-4 h-4 text-[#0E6E8C]" />
                  <span>מענה נציג שכר:</span>
                </h4>

                {/* Free Text */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    תוכן התשובה לעובד (יוצג ישירות בצ׳אט):
                  </label>
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="לדוגמה: השתתפות עצמית עבור BYD Atto 3 אושרה ל-350 ₪ לחודש, בתוקף מ-1/1..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-[#0E6E8C] focus:outline-none"
                  />
                </div>

                {/* Structured Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-[#0E6E8C]" />
                      <span>גובה השתתפות חדש (₪ לחודש):</span>
                    </label>
                    <input
                      type="number"
                      value={structuredValue}
                      onChange={(e) => setStructuredValue(e.target.value)}
                      placeholder="למשל: 350"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-[#0E6E8C]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#0E6E8C]" />
                      <span>בתוקף מ- (תאריך/מועד):</span>
                    </label>
                    <input
                      type="text"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      placeholder="למשל: 1/1"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-[#0E6E8C]"
                    />
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleSendAnswer('closed')}
                    disabled={isSending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    סגור פנייה
                  </button>

                  <button
                    onClick={() => handleSendAnswer('answered')}
                    disabled={isSending}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0E6E8C] hover:bg-[#0B566E] transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 rotate-180" />
                    <span>שלח תשובה ועדכן את העובד</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
