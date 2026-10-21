/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Beyond the money": a chat with an AI car expert about which car fits the employee's life.
 * The server sends the model only non-financial profile fields and the base salary rounded down to
 * thousands. The chat lives in this component only; a new comparison starts a new one.
 */

import { CarFront, Lock, Send, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { CarFitTurn } from '../../shared/types.ts';

const SUGGESTIONS = [
  'איזה מהרכבים מתאים יותר למשפחה שלי?',
  'מה הטווח של הרכב החשמלי בפועל?',
  'רכב חשמלי מתאים לי בלי עמדת טעינה בבית?',
  'איזה רכב נוח יותר לחניה בעיר?',
];

const WELCOME =
  'שלום! אני סוכן הרכב של שטראוס, עם ניסיון של שנים בכל הרכבים בקטלוג. ספרו לי קצת על השגרה שלכם: ילדים, נסיעות, חניה, טעינה. אמליץ לכם מה הכי מתאים, מעבר למספרים.';

/** **bold** inside a line */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

/** The model's light Markdown (bold, "* " / "- " bullets, "1. " lists) as text elements, never as HTML */
function Formatted({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1" />;
        const bullet = line.match(/^[*\-•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue shrink-0">•</span>
              <span>{inline(bullet[1])}</span>
            </div>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

const AdvisorAvatar: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <div
    className={`${size === 'lg' ? 'w-11 h-11' : 'w-7 h-7'} rounded-full bg-gradient-to-br from-blue to-sky flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white`}
  >
    <CarFront className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} text-white`} />
  </div>
);

interface BeyondMoneyChatProps {
  /** One question with the earlier turns; resolves with the advisor's reply */
  onAsk: (text: string, history: CarFitTurn[]) => Promise<string>;
}

export const BeyondMoneyChat: React.FC<BeyondMoneyChatProps> = ({ onAsk }) => {
  const [turns, setTurns] = useState<CarFitTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const history = turns;
    setTurns([...history, { role: 'user', content: text }]);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const reply = await onAsk(text, history);
      setTurns((t) => [...t, { role: 'assistant', content: reply }]);
    } catch (err) {
      // Take the question back, so it can be sent again
      setTurns(history);
      setInput(text);
      setError(err instanceof Error ? err.message : 'היועץ לא זמין כרגע');
    } finally {
      setBusy(false);
    }
  };

  const botBubble = (content: React.ReactNode, key: React.Key) => (
    <div key={key} className="flex items-end gap-2 justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-bl-xs px-4 py-3 bg-white border border-line shadow-xs text-ink leading-relaxed">
        {content}
      </div>
      <AdvisorAvatar />
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-blue/30 shadow-md bg-white">
      {/* Header */}
      <div className="relative px-5 py-4 bg-gradient-to-l from-blue-deep via-blue to-sky text-white">
        <div className="flex items-center gap-3">
          <AdvisorAvatar size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="text-base font-bold">סוכן הרכב האישי שלכם</h5>
              <span className="px-2 py-0.5 rounded-full bg-white text-blue-deep text-[11px] font-extrabold flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3" />
                פיצ'ר חדש
              </span>
            </div>
            <div className="text-[11px] text-white/90 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
              <span>מחובר · מומחה רכב AI, מעבר לכסף</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs sm:text-sm text-white/95 leading-relaxed">
          הנטו הוא רק חצי מההחלטה. שאלו את הסוכן על מרחב, טווח, טעינה, בטיחות ונוחות, וקבלו המלצה מקצועית שמותאמת
          למשפחה ולאורח החיים שלכם.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-96 overflow-y-auto p-4 space-y-3 bg-white text-xs sm:text-sm">
        {botBubble(<p>{WELCOME}</p>, 'welcome')}

        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 justify-end pr-9">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => ask(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-sky-light text-blue-deep border border-blue/20 hover:bg-blue hover:text-white transition-colors disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-br-xs px-4 py-3 bg-blue text-white leading-relaxed whitespace-pre-line">
                {t.content}
              </div>
            </div>
          ) : (
            botBubble(<Formatted text={t.content} />, i)
          )
        )}

        {busy &&
          botBubble(
            <div className="flex items-center gap-1 py-1" aria-label="הסוכן כותב">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 rounded-full bg-blue/60 animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>,
            'typing'
          )}
      </div>

      {error && <div className="px-4 pb-2 text-xs text-danger bg-white">{error}</div>}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 p-3 border-t border-line bg-white"
      >
        <input
          type="text"
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="שאלו את הסוכן... (למשל: יש לי שני ילדים ואני נוסע הרבה לצפון)"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-line bg-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="lift w-10 h-10 rounded-full bg-blue text-white hover:bg-blue-dark disabled:opacity-40 transition-colors flex items-center justify-center shrink-0"
          title="שלח"
        >
          <Send className="w-4 h-4 rotate-180" />
        </button>
      </form>

      <p className="px-4 py-2 text-[11px] text-muted bg-surface border-t border-line flex items-start gap-1.5">
        <Lock className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          הסוכן רואה את התפקיד, קבוצת הזכאות, מספר הילדים והרכב הנוכחי, ואת שכר הבסיס מעוגל כלפי מטה לאלפים. פרטי השכר
          המלאים לא נשלחים. נתונים טכניים הם הערכה לפי נתוני היצרן; לפרטים מדויקים פנו ליבואן.
        </span>
      </p>
    </div>
  );
};
