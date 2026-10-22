/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  HelpCircle,
  Info,
  Printer,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import React, { useState } from 'react';
import { CarFitTurn, CarHighlights, ComparisonResult, Rules } from '../../shared/types.ts';
import { AiNotice } from './AiNotice.tsx';
import { BeyondMoneyChat } from './BeyondMoneyChat.tsx';
import { WaterfallChart } from './WaterfallChart.tsx';

/** A rule rate (0.0104) as a percent label ("1.04%") */
const pct = (rate: number) => `${(rate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/** Approved pros and cons of one car (admin-approved text, no numbers from the model) */
const CarHighlightsColumn: React.FC<{ title: string; carLabel: string; highlights: CarHighlights }> = ({
  title,
  carLabel,
  highlights,
}) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
    <div>
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="text-sm font-bold text-ink">{carLabel}</div>
    </div>
    <ul className="space-y-1.5 text-xs sm:text-sm">
      {highlights.pros.map((t, i) => (
        <li key={`p${i}`} className="flex items-start gap-2 text-slate-700">
          <ThumbsUp className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
          <span>{t}</span>
        </li>
      ))}
      {highlights.cons.map((t, i) => (
        <li key={`c${i}`} className="flex items-start gap-2 text-slate-700">
          <ThumbsDown className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  </div>
);

interface ComparisonCardProps {
  comparison: ComparisonResult;
  /** The current rules (GET /api/meta): every amount and rate in the notes comes from here, none is written in the UI */
  rules?: Rules;
  /** Pros and cons of today's car and of the alternative car, when the admin approved them */
  highlights?: { today?: CarHighlights; alt?: CarHighlights };
  onSelectCarAgain?: () => void;
  onCompareAnother?: () => void;
  onAskRep?: () => void;
  onShowRankedOptions?: () => void;
  /** "Beyond the money" advisor; absent = the chat is hidden */
  onAskCarFit?: (text: string, history: CarFitTurn[]) => Promise<string>;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  comparison,
  rules,
  highlights,
  onSelectCarAgain,
  onCompareAnother,
  onAskRep,
  onShowRankedOptions,
  onAskCarFit,
}) => {
  const [showHowCalculated, setShowHowCalculated] = useState(false);

  const diff = comparison.diffNet;
  const isPositive = diff >= 0;
  const diffSign = isPositive ? '+' : '−';
  const absDiffFormatted = Math.abs(diff).toLocaleString();

  const impactSentence = isPositive
    ? `הנטו שלך יעלה ב-${absDiffFormatted} ₪ בחודש`
    : `הנטו שלך ירד ב-${absDiffFormatted} ₪ בחודש`;

  const todayNet = Math.round(comparison.todayBreakdown.net);
  const altNet = Math.round(comparison.altBreakdown.net);

  return (
    <div data-comparison-details className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
      {/* Header with Big Number */}
      <div
        className={`p-6 text-center border-b ${
          isPositive ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isPositive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            }`}
          >
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {isPositive ? 'תוספת חודשית לנטו' : 'הפחתה חודשית מהנטו'}
          </span>
        </div>

        {/* The Memorable Hero Number */}
        <div
          className={`text-5xl sm:text-6xl font-black tracking-tight my-2 ${
            isPositive ? 'text-success' : 'text-danger'
          }`}
          dir="ltr"
        >
          {diffSign}{absDiffFormatted} ₪
        </div>

        <p className="text-base sm:text-lg font-medium text-ink">{impactSentence}</p>

        {/* Eligibility badge */}
        <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm bg-white/80 border border-slate-200">
          {comparison.eligible ? (
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
          )}
          <span className={comparison.eligible ? 'text-slate-700' : 'text-danger font-medium'}>
            {comparison.eligibilityReason_he}
          </span>
        </div>
      </div>

      {/* Two Columns: Today vs Alternative */}
      <div className="p-6 border-b border-line bg-slate-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6">
          {/* Column Today */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">המצב היום</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">בסיס</span>
            </div>
            <h4 className="text-base font-bold text-ink mb-3">{comparison.todayCarLabel}</h4>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>שווי שימוש למס:</span>
                <span className="font-semibold text-slate-900">
                  {Math.round(comparison.todayState.benefitValue).toLocaleString()} ₪
                </span>
              </div>
              <div className="flex justify-between">
                <span>השתתפות עובד:</span>
                <span className="font-semibold text-slate-900">
                  {Math.round(comparison.todayState.participation).toLocaleString()} ₪
                </span>
              </div>
              {comparison.todayState.maintenance > 0 && (
                <div className="flex justify-between">
                  <span>דמי אחזקה:</span>
                  <span className="font-semibold text-slate-900">
                    {Math.round(comparison.todayState.maintenance).toLocaleString()} ₪
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-800">שכר נטו חודשי:</span>
                <span className="text-base font-bold text-brand-dark" dir="ltr">
                  {todayNet.toLocaleString()} ₪
                </span>
              </div>
            </div>
          </div>

          {/* Column Alternative */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border-2 border-brand/30 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-semibold text-brand-dark uppercase tracking-wider">החלופה המוצעת</span>
              <span className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand-dark font-semibold">
                השוואה
              </span>
            </div>
            <h4 className="text-base font-bold text-ink mb-3">{comparison.altCarLabel}</h4>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>שווי שימוש למס:</span>
                <span className="font-semibold text-slate-900">
                  {Math.round(comparison.altState.benefitValue).toLocaleString()} ₪
                </span>
              </div>
              <div className="flex justify-between">
                <span>השתתפות עובד:</span>
                <span className="font-semibold text-slate-900">
                  {Math.round(comparison.altState.participation).toLocaleString()} ₪
                </span>
              </div>
              {comparison.altState.evGrossUp > 0 && (
                <div className="flex justify-between text-success font-medium">
                  <span>החזר טעינה חשמלית (מגולם):</span>
                  <span>{rules ? `+${rules.electric.netBonus.toLocaleString()} ₪ נטו` : 'כלול בנטו'}</span>
                </div>
              )}
              {comparison.altState.maintenance > 0 && (
                <div className="flex justify-between">
                  <span>דמי אחזקה:</span>
                  <span className="font-semibold text-slate-900">
                    {Math.round(comparison.altState.maintenance).toLocaleString()} ₪
                  </span>
                </div>
              )}
              {comparison.altState.familyGapShare > 0 && (
                <div className="flex justify-between text-danger">
                  <span>השתתפות עובד בפער מעל תקציב:</span>
                  <span className="font-semibold">
                    {Math.round(comparison.altState.familyGapShare).toLocaleString()} ₪
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-800">שכר נטו חודשי:</span>
                <span className="text-base font-bold text-brand-dark" dir="ltr">
                  {altNet.toLocaleString()} ₪
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Plain Hebrew 2-line explanation */}
        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900">{comparison.summary_he[0]}</div>
          <div className="text-slate-600">{comparison.summary_he[1]}</div>
          {comparison.sourceNote && (
            <div className="text-xs text-warning pt-1 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{comparison.sourceNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* Beyond the money: approved pros and cons of the cars, and the AI advisor */}
      {(highlights?.today || highlights?.alt || onAskCarFit) && (
        <div className="p-6 border-b border-line">
          <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <CarFront className="w-4 h-4 text-brand-dark" />
            <span>מעבר לכסף</span>
          </h4>
          {(highlights?.today || highlights?.alt) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3">
                {highlights.today && (
                  <CarHighlightsColumn title="הרכב היום" carLabel={comparison.todayCarLabel} highlights={highlights.today} />
                )}
                {highlights.alt && (
                  <CarHighlightsColumn title="החלופה" carLabel={comparison.altCarLabel} highlights={highlights.alt} />
                )}
              </div>
              <AiNotice
                className="mt-2"
                text="סיכום כללי שנכתב בעזרת בינה מלאכותית ואושר על ידי מנהל המערכת, ועדיין עלול לכלול טעויות. אינו מפרט טכני; לפרטים מלאים פנו ליבואן."
              />
            </>
          )}
          {/* A new car pair starts a new chat */}
          {onAskCarFit && (
            <div className={highlights?.today || highlights?.alt ? 'mt-4' : ''}>
              <BeyondMoneyChat key={`${comparison.todayCarLabel}|${comparison.altCarLabel}`} onAsk={onAskCarFit} />
            </div>
          )}
        </div>
      )}

      {/* "למה?" Delta Steps & Waterfall Chart */}
      <div className="p-6 border-b border-line">
        <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-dark" />
          <span>למה? פירוט צעדי ההשפעה על שכר הנטו</span>
        </h4>

        {/* Waterfall Chart */}
        <WaterfallChart todayNet={todayNet} altNet={altNet} steps={comparison.steps} />

        {/* Steps List */}
        <div className="space-y-2.5 mt-4">
          {comparison.steps.map((step, idx) => {
            // Rounded steps add up exactly to the difference shown above
            const shown = step.deltaNetRounded ?? Math.round(step.deltaNet);
            const isPos = shown >= 0;
            return (
              <div
                key={idx}
                className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs sm:text-sm"
              >
                <div>
                  <div className="font-semibold text-slate-900">{step.label_he}</div>
                  <div className="text-slate-600 text-xs mt-0.5">{step.explanation_he}</div>
                </div>
                <span
                  className={`font-bold shrink-0 mr-3 px-2 py-0.5 rounded ${
                    isPos ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}
                  dir="ltr"
                >
                  {isPos ? '+' : ''}{shown.toLocaleString()} ₪
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable "איך חישבנו" */}
      <div className="border-b border-line">
        <button
          onClick={() => setShowHowCalculated(!showHowCalculated)}
          className="w-full px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-brand-dark" />
            <span>איך חישבנו? פירוט מלא של מדרגות המס, ביטוח לאומי ומקורות</span>
          </span>
          {showHowCalculated ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHowCalculated && (
          <div className="p-6 bg-slate-50 text-xs sm:text-sm space-y-4 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 border-b pb-1">פירוט ניכויי היום</div>
                <div className="flex justify-between">
                  <span>בסיס למס (שכר + שווי שימוש):</span>
                  <span>{Math.round(comparison.todayBreakdown.taxableBase).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>מס הכנסה (אחרי נקודות ופנסיה):</span>
                  <span>{Math.round(comparison.todayBreakdown.tax).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>ביטוח לאומי ומס בריאות:</span>
                  <span>{Math.round(comparison.todayBreakdown.niHealth).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>הפרשת עובד לפנסיה:</span>
                  <span>{Math.round(comparison.todayBreakdown.pension).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>הפרשת קרן השתלמות:</span>
                  <span>{Math.round(comparison.todayBreakdown.studyFund).toLocaleString()} ₪</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 border-b pb-1">פירוט ניכויי החלופה</div>
                <div className="flex justify-between">
                  <span>בסיס למס (שכר + שווי שימוש):</span>
                  <span>{Math.round(comparison.altBreakdown.taxableBase).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>מס הכנסה (אחרי נקודות ופנסיה):</span>
                  <span>{Math.round(comparison.altBreakdown.tax).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between">
                  <span>ביטוח לאומי ומס בריאות:</span>
                  <span>{Math.round(comparison.altBreakdown.niHealth).toLocaleString()} ₪</span>
                </div>
                {comparison.altState.evGrossUp > 0 && (
                  <div className="flex justify-between text-success">
                    <span>גילום ברוטו להחזר חשמל:</span>
                    <span>+{Math.round(comparison.altState.evGrossUp).toLocaleString()} ₪ ברוטו</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>הפרשת עובד לפנסיה:</span>
                  <span>{Math.round(comparison.altBreakdown.pension).toLocaleString()} ₪</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              {rules && (
                <>
                  <div>• שווי שימוש: {rules.valueOfUse.source}, לפי מפתח ייחודי ({rules.valueOfUse.key.join(', ')}).</div>
                  <div>
                    • מס הכנסה חושב לפי מדרגות מס הכנסה חודשיות שנת {rules.netMethod.taxYear} וערך נקודת זיכוי של{' '}
                    {rules.netMethod.creditPointValue.toLocaleString()} ₪ לחודש.
                  </div>
                  <div>
                    • ביטוח לאומי: {pct(rules.netMethod.nationalInsurance.lowRate)} עד{' '}
                    {rules.netMethod.nationalInsurance.threshold.toLocaleString()} ₪, {pct(rules.netMethod.nationalInsurance.highRate)} עד
                    תקרת {rules.netMethod.nationalInsurance.ceiling.toLocaleString()} ₪.
                  </div>
                  <div>
                    • מס בריאות: {pct(rules.netMethod.health.lowRate)} עד {rules.netMethod.health.threshold.toLocaleString()} ₪,{' '}
                    {pct(rules.netMethod.health.highRate)} עד תקרת {rules.netMethod.health.ceiling.toLocaleString()} ₪.
                  </div>
                </>
              )}
              <div>• עודף תקציב רכב: לפי נוהל שטראוס, עודף אינו נפדה במזומן.</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 sm:p-6 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {onSelectCarAgain && (
            <button
              onClick={onSelectCarAgain}
              className="lift px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold bg-brand text-white hover:bg-brand-dark transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>החלף רכב וחשב שוב</span>
            </button>
          )}

          {onCompareAnother && (
            <button
              onClick={onCompareAnother}
              className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              השווה לאפשרות אחרת
            </button>
          )}

          {onShowRankedOptions && (
            <button
              onClick={onShowRankedOptions}
              className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              איזה רכב הכי משתלם?
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onAskRep && (
            <button
              onClick={onAskRep}
              className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-brand-dark border border-brand/30 hover:bg-brand/5 transition-colors flex items-center gap-1.5"
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span>שלח שאלה לנציג</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            title="הדפס תוצאות"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer Note */}
      <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
        חישוב אינדיקטיבי{rules ? ` לפי לוחות ${rules.netMethod.taxYear}` : ''}; ההפרשות והזיכויים כפי שהוזנו בפרופיל
      </div>
    </div>
  );
};
