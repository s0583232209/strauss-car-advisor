/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  Headset,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import React from 'react';
import { getRules } from '../engine/rules.ts';

export const GuideView: React.FC = () => {
  const rules = getRules();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2 pb-6 border-b border-line">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand-dark">
          <BookOpen className="w-3.5 h-3.5" />
          <span>מדריך הפעלה ונהלים רשמי</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">
          מדריך למשתמש: יועץ הרכב של שטראוס
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl mx-auto">
          כל מה שצריך לדעת על תסריט השיחה, חוקי המדיניות, מקורות המידע והגשת פניות
        </p>
      </div>

      {/* Section 1: תסריט השיחה (Conversation Script) */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-brand-dark">
          <MessageSquare className="w-5 h-5" />
          <h2 className="text-lg font-bold text-ink">1. תסריט השיחה והזרימה עם יועץ הרכב</h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          יועץ הרכב פועל במודל דיאלוגי ממוקד: הוא שואל רק על שדות שחסרים, לעולם אינו ממציא מספרים בעצמו, ומבצע את כל החישובים באמצעות מנוע השכר המובנה.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">1</span>
              <span>הגדרת רצון העובד:</span>
            </div>
            <p className="text-slate-600">
              העובד שואל בשפה חופשית ("מה יקרה לנטו אם אעבור לרכב חשמלי?", "אני רוצה לדעת לגבי ויתור על הרכב", וכדומה).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">2</span>
              <span>קליטת נתוני שכר בסיס וזכאות:</span>
            </div>
            <p className="text-slate-600">
              היועץ שואל על קבוצת הזכאות (א–ד) ושכר הבסיס. לחלופין, ניתן לטעון עובד דוגמה בלחיצה או להעלות תלוש שכר לניתוח אוטומטי.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">3</span>
              <span>רכיבי שכר, ניכויים ורכב נוכחי:</span>
            </div>
            <p className="text-slate-600">
              אימות עמלות, הפרשות לפנסיה ולקרן השתלמות, נקודות זיכוי ודגם הרכב הקיים (או דמי אחזקה במקרה של ויתור קודם).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">4</span>
              <span>הצגת השוואה או פנייה לנציג:</span>
            </div>
            <p className="text-slate-600">
              במידה וכל הנתונים קיימים, מוצג כרטיס השוואה מיידי ומדויק. אם חסר נתון או נדרש אימות, נפתחת פנייה אנושית והשיחה ממשיכה לאחר המענה.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: טבלת כללי המדיניות של שטראוס (Rules Table) */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-brand-dark">
          <Compass className="w-5 h-5" />
          <h2 className="text-lg font-bold text-ink">2. טבלת כללי המדיניות של שטראוס</h2>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">נושא מדיניות</th>
                <th className="p-3">כלל המערכת</th>
                <th className="p-3">משמעות מעשית בחישוב</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 font-bold text-slate-900">תקציבי רכב לפי קבוצה</td>
                <td className="p-3">
                  קבוצה א: {rules.budgets['א']} ₪ · קבוצה ב: {rules.budgets['ב']} ₪ · קבוצה ג: {rules.budgets['ג']} ₪ · קבוצה ד: {rules.budgets['ד']} ₪
                </td>
                <td className="p-3 text-slate-600">תקציב מקסימלי לרכב חברה. עודף תקציב אינו נפדה במזומן.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">בחירת רכב מקבוצות</td>
                <td className="p-3">קבוצת העובד או נמוכה ממנה בלבד</td>
                <td className="p-3 text-slate-600">עובד קבוצה ב׳ רשאי לבחור מרכבי קבוצות א׳ או ב׳ בלבד.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">החזר טעינה חשמלית</td>
                <td className="p-3">+250 ₪ נטו לרכב חשמלי מלא בלבד (קוד הנעה 3)</td>
                <td className="p-3 text-slate-600">מגולם בשכר הברוטו כך שהתוספת לנטו תהיה בדיוק 250 ₪.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">מסלול ברוכת ילדים</td>
                <td className="p-3">4 ילדים ומעלה עד גיל 23 (קיה קרניבל / יונדאי סנטה פה)</td>
                <td className="p-3 text-slate-600">על הפער שמעל תקציב הקבוצה: 50% במימון העובד (ניכוי מהנטו) ו-50% במימון המעסיק.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">ויתור על רכב</td>
                <td className="p-3">מותנה בעיסוק (עיסוק עם רכב חובה אינו רשאי לוותר)</td>
                <td className="p-3 text-slate-600">דמי אחזקה מתווספים לברוטו (חייב במס ובביטוח לאומי, ללא פנסיה), שווי השימוש מתאפס.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: מקורות הנתונים: מה קיים ומה בדרך */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-brand-dark">
          <FileSpreadsheet className="w-5 h-5" />
          <h2 className="text-lg font-bold text-ink">3. מקורות הנתונים: מה קיים כעת ומה בדרך לפיילוט</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-success/5 border border-success/20 space-y-2">
            <div className="font-bold text-success flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>מה קיים ועובד כעת במערכת:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>קטלוג מלא של 20 כלי רכב (יצרן, דגם, שווי שימוש, עלות מעסיק, השתתפות).</li>
              <li>טבלת 14 עיסוקי שטראוס עם הגדרות רכב חובה וסכומי אחזקה.</li>
              <li>מנוע חישוב שכר נטו ישראלי מלא ומדויק ללוחות 2025.</li>
              <li>מאגר זרע של רשות המסים + מפענח CSV של 78 אלף שורות ב-IndexedDB.</li>
              <li>תמיכה בסנכרון מקומי וחיבור מלא לסופאבייס (Supabase Realtime).</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-2">
            <div className="font-bold text-brand-dark flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4" />
              <span>מה שנדרש להשלמת הפיילוט המלא:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>אינטגרציה ישירה עם מערכת חילן / הרמוני לקריאת נתוני שכר בזמן אמת.</li>
              <li>סנכרון שוטף של קטלוג רכבי הליסינג מול ספקי הליסינג של שטראוס.</li>
              <li>אימות זהות עובד באמצעות SSO ארגוני (Google Workspace / Azure AD).</li>
              <li>סקר אבטחת מידע ואישור הגנת פרטיות לעיבוד מסמכים ארגוניים.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 4: מה מוגש ומאושר */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-3 text-xs sm:text-sm text-slate-700">
        <div className="flex items-center gap-2 text-brand-dark">
          <FileCheck2 className="w-5 h-5" />
          <h2 className="text-lg font-bold text-ink">4. אישור תוצאות ותוקף החישוב</h2>
        </div>
        <p className="leading-relaxed">
          החישובים המופקים ביועץ הרכב הם אינדיקטיביים ומבוססים על נתוני השכר שהוזנו והלוחות הרשמיים.
          בכל מקרה של מעבר לרכב חדש או ויתור על רכב, הבקשה מועברת לאישור סופי של מחלקת השכר ומשאבי האנוש בשטראוס.
        </p>
      </div>
    </div>
  );
};
