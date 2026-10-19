/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  Briefcase,
  Car as CarIcon,
  CheckCircle2,
  Database,
  Download,
  FileCheck,
  FileJson,
  FileSpreadsheet,
  Info,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { AdminOverview, CalibrationSummary, Rules, VehicleLookupResult } from '../../shared/types.ts';
import { api, ApiError } from '../api/client.ts';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'calibration' | 'rules' | 'catalog' | 'occupations' | 'employees' | 'tax' | 'db' | 'assumptions'
  >('calibration');

  // Reference data, rules and record count from the server
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Calibration test runner state
  const [calibrationData, setCalibrationData] = useState<CalibrationSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Rules state
  const [currentRules, setCurrentRules] = useState<Rules | null>(null);
  const [rulesJsonString, setRulesJsonString] = useState<string>('');
  const [rulesSavedMsg, setRulesSavedMsg] = useState<string | null>(null);

  // Tax Authority file (stored on the server)
  const [taxRowCount, setTaxRowCount] = useState<number>(0);
  const [csvUploadStatus, setCsvUploadStatus] = useState<string | null>(null);
  const [csvProgress, setCsvProgress] = useState<number>(0);

  // Lookup tester state
  const [lookupYear, setLookupYear] = useState('2025');
  const [lookupType, setLookupType] = useState('1');
  const [lookupProduct, setLookupProduct] = useState('01014');
  const [lookupModel, setLookupModel] = useState('00003');
  const [lookupResult, setLookupResult] = useState<VehicleLookupResult | null>(null);
  const [lookupSearched, setLookupSearched] = useState(false);

  /** A 401 already sent the app back to the login screen; anything else is shown above the tabs */
  const handleApiError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return;
    setLoadError(err instanceof Error ? err.message : 'שגיאה בתקשורת עם השרת');
  };

  const showRules = (r: Rules) => {
    setCurrentRules(r);
    setRulesJsonString(JSON.stringify(r, null, 2));
  };

  const loadOverview = async () => {
    try {
      const o = await api.admin.overview();
      setOverview(o);
      showRules(o.rules);
      setTaxRowCount(o.taxRecordCount);
      setLoadError(null);
      runTests();
    } catch (err) {
      handleApiError(err);
    }
  };

  // Load data and run tests on mount
  useEffect(() => {
    loadOverview();
  }, []);

  const runTests = async () => {
    setIsRunningTests(true);
    try {
      setCalibrationData(await api.admin.runCalibration());
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const refreshDbCount = async () => {
    try {
      setTaxRowCount((await api.admin.overview()).taxRecordCount);
    } catch (err) {
      handleApiError(err);
    }
  };

  const flashRulesMsg = (msg: string) => {
    setRulesSavedMsg(msg);
    setTimeout(() => setRulesSavedMsg(null), 3000);
  };

  const handleSaveRules = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rulesJsonString);
    } catch (err: any) {
      alert(`שגיאה בתחביר ה-JSON: ${err?.message}`);
      return;
    }
    try {
      showRules(await api.admin.saveRules(parsed));
      flashRulesMsg('הכללים נשמרו ועודכנו במנוע בהצלחה!');
      runTests();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 400) alert(err.message);
      else handleApiError(err);
    }
  };

  const handleResetRules = async () => {
    try {
      showRules(await api.admin.resetRules());
      flashRulesMsg('הכללים אופסו לברירת המחדל.');
      runTests();
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setCsvUploadStatus('מעלה את הקובץ לשרת ומנתח אותו (windows-1255)...');
    setCsvProgress(30);

    try {
      const { count } = await api.admin.uploadTaxCsv(file);
      setCsvProgress(100);
      setCsvUploadStatus(`הקובץ נטען בהצלחה! ${count.toLocaleString()} רשומות נשמרו בשרת.`);
      refreshDbCount();
      runTests();
    } catch (err: any) {
      setCsvProgress(0);
      if (err instanceof ApiError && err.status === 401) handleApiError(err);
      else setCsvUploadStatus(`שגיאה בטעינת ה-CSV: ${err?.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleRunLookup = async () => {
    setLookupSearched(true);
    try {
      // Uploaded file first, then the seed and the catalog (server side)
      setLookupResult(await api.admin.lookup({ year: lookupYear, type: lookupType, product: lookupProduct, model: lookupModel }));
    } catch (err) {
      setLookupResult(null);
      handleApiError(err);
    }
  };

  if (!overview || !currentRules) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center text-sm text-slate-500">
        {loadError ?? 'טוען נתוני ניהול...'}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Admin Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">ניהול נתונים, כללים ובדיקות כיול</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand-dark">
              Admin Panel
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            כל הנתונים והכללים ניתנים לעדכון והחלפה (פיילוט מחליף נתונים, לא קוד)
          </p>
        </div>

        {/* Quick calibration status badge */}
        {calibrationData && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500">סטטוס כיול:</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                calibrationData.failed === 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {calibrationData.failed === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>100% עבר ({calibrationData.passed}/{calibrationData.total})</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>{calibrationData.failed} נכשלו מתוך {calibrationData.total}</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-200 mb-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('calibration')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'calibration'
              ? 'bg-brand text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>בדיקות כיול (Benchmark)</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'rules' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileJson className="w-4 h-4" />
          <span>קובץ כללים (Rules JSON)</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'catalog' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CarIcon className="w-4 h-4" />
          <span>קטלוג רכבים (20)</span>
        </button>

        <button
          onClick={() => setActiveTab('occupations')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'occupations' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>טבלת עיסוקים (14)</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'employees' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>עובדי דוגמה (6)</span>
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'tax' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>לוחות מס וביטוח לאומי</span>
        </button>

        <button
          onClick={() => setActiveTab('db')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'db' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>מאגר שווי שימוש (רשות המסים)</span>
        </button>

        <button
          onClick={() => setActiveTab('assumptions')}
          className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'assumptions' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>הנחות יסוד</span>
        </button>
      </div>

      {/* Tab 1: Calibration Tests */}
      {activeTab === 'calibration' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-ink">בדיקות כיול מקיפות (סעיף 8)</h3>
              <p className="text-xs text-slate-500">
                אימות כל תוצאות הנטו, המס, ביטוח לאומי וגילום החשמל של 6 עובדי הדוגמה בדיוק של ±1 ₪
              </p>
            </div>

            <button
              onClick={runTests}
              disabled={isRunningTests}
              className="lift px-4 py-2 rounded-full text-xs font-bold bg-brand text-white hover:bg-brand-dark transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>הרץ בדיקות כיול עכשיו</span>
            </button>
          </div>

          {calibrationData && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">סטטוס</th>
                    <th className="p-3">שם הבדיקה</th>
                    <th className="p-3">קטגוריה</th>
                    <th className="p-3">ערך צפוי</th>
                    <th className="p-3">ערך בפועל</th>
                    <th className="p-3">הערות / פרטים</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calibrationData.results.map((res, idx) => (
                    <tr
                      key={idx}
                      className={res.passed ? 'hover:bg-slate-50' : 'bg-danger/5 hover:bg-danger/10'}
                    >
                      <td className="p-3">
                        {res.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-success/10 text-success">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>עבר</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-danger/10 text-danger">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>נכשל</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{res.name}</td>
                      <td className="p-3 text-slate-500">
                        {res.category === 'benchmark'
                          ? 'בנצ׳מרק עובדים'
                          : res.category === 'rules'
                          ? 'כללי מדיניות'
                          : res.category === 'lookup'
                          ? 'שליפת שווי שימוש'
                          : 'קבוצה ב׳ ויתור'}
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-700" dir="ltr">
                        {res.expected}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900" dir="ltr">
                        {res.actual}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{res.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Rules JSON */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-ink">קובץ כללים ותקציבים (strauss-rules.json)</h3>
              <p className="text-xs text-slate-500">עריכה ישירה של נתוני התקציב, מדרגות המס וכללי הזכאות</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetRules}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                איפוס לברירת מחדל
              </button>
              <button
                onClick={handleSaveRules}
                className="lift px-4 py-1.5 rounded-full text-xs font-bold bg-brand text-white hover:bg-brand-dark"
              >
                שמור והחל שינויים
              </button>
            </div>
          </div>

          {rulesSavedMsg && (
            <div className="p-3 rounded-lg bg-success/10 text-success text-xs font-bold">
              {rulesSavedMsg}
            </div>
          )}

          <textarea
            rows={18}
            value={rulesJsonString}
            onChange={(e) => setRulesJsonString(e.target.value)}
            className="w-full p-4 font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl focus:outline-none"
            dir="ltr"
          />
        </div>
      )}

      {/* Tab 3: Catalog (20 cars) */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-ink">קטלוג הרכבים של שטראוס (20 כלי רכב)</h3>
              <p className="text-xs text-slate-500">
                רכבי קבוצות א–ד + רכבי מסלול ברוכת ילדים (CARNIVAL, SANTA FE)
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">מזהה</th>
                  <th className="p-3">קבוצה</th>
                  <th className="p-3">יצרן ודגם</th>
                  <th className="p-3">קוד תוצר/דגם</th>
                  <th className="p-3">שנה</th>
                  <th className="p-3">סוג הנעה</th>
                  <th className="p-3">מחיר מחירון</th>
                  <th className="p-3">שווי שימוש</th>
                  <th className="p-3">עלות חברה</th>
                  <th className="p-3">השתתפות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {overview.catalog.map((car) => (
                  <tr key={car.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-brand-dark">{car.id}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                        {car.group}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {car.make} {car.model}
                    </td>
                    <td className="p-3 font-mono text-slate-600" dir="ltr">
                      {car.productCode}/{car.modelCode}
                    </td>
                    <td className="p-3 font-mono">{car.year}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          car.driveCode === 3
                            ? 'bg-success/15 text-success'
                            : car.driveCode === 1
                            ? 'bg-brand/15 text-brand-dark'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {car.fuel}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{car.listPrice.toLocaleString()} ₪</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{car.benefit.toLocaleString()} ₪</td>
                    <td className="p-3 font-mono">{car.companyCost.toLocaleString()} ₪</td>
                    <td className="p-3 font-mono">{car.participation.toLocaleString()} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Occupations (14 roles) */}
      {activeTab === 'occupations' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-ink">טבלת עיסוקים, רכב חובה ודמי אחזקה (14 עיסוקים)</h3>
              <p className="text-xs text-slate-500">עיסוקים שבהם רכב חובה אינם רשאים לוותר על הרכב כנגד אחזקה</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">שם העיסוק</th>
                  <th className="p-3">קבוצת זכאות</th>
                  <th className="p-3">רכב חובה תפעולי</th>
                  <th className="p-3">רשאי/ת לוותר?</th>
                  <th className="p-3">דמי אחזקה בעת ויתור</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.occupations.map((occ, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{occ.occupation}</td>
                    <td className="p-3 font-bold text-brand-dark">קבוצה {occ.group}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          occ.carMandatory ? 'bg-danger/10 text-danger' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {occ.carMandatory ? 'כן (חובה)' : 'לא'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          occ.canWaive ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {occ.canWaive ? 'כן (ניתן לוותר)' : 'חסום'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      {occ.maintenance > 0 ? `${occ.maintenance.toLocaleString()} ₪` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Employees */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-ink">עובדי דוגמה לכיול ובדיקות (6 פרופילים)</h3>
              <p className="text-xs text-slate-500">פרופילים רשמיים מחוברת הכיול (שמות ופרטים פיקטיביים)</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">מזהה</th>
                  <th className="p-3">שם</th>
                  <th className="p-3">עיסוק</th>
                  <th className="p-3">קבוצה</th>
                  <th className="p-3">בסיס</th>
                  <th className="p-3">עמלות/בונוס</th>
                  <th className="p-3">פנסיה / השתלמות</th>
                  <th className="p-3">נק׳ זיכוי</th>
                  <th className="p-3">ילדים עד 23</th>
                  <th className="p-3">מצב היום</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {overview.employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-brand-dark">{emp.id}</td>
                    <td className="p-3 font-bold text-slate-900">{emp.name}</td>
                    <td className="p-3 text-slate-700">{emp.occupation}</td>
                    <td className="p-3 font-bold">קבוצה {emp.group}</td>
                    <td className="p-3 font-mono">{emp.base.toLocaleString()} ₪</td>
                    <td className="p-3 font-mono">{emp.commissions || emp.bonus ? (emp.commissions + emp.bonus).toLocaleString() : '0'} ₪</td>
                    <td className="p-3 font-mono">{emp.pensionPct}% / {emp.studyFundPct}%</td>
                    <td className="p-3 font-mono">{emp.creditPoints}</td>
                    <td className="p-3 font-mono font-bold">{emp.childrenUpTo23}</td>
                    <td className="p-3 text-slate-800">
                      {emp.hasCar ? `${emp.currentCarName} (השתתפות ${emp.currentParticipation} ₪)` : `ויתור (אחזקה ${emp.currentMaintenance} ₪)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Tax Tables */}
      {activeTab === 'tax' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-ink">לוחות מס הכנסה וביטוח לאומי לשנת 2025</h3>
            <p className="text-xs text-slate-500">מחושבים על בסיס חודשי על פי נתוני rules.netMethod</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Brackets */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">מדרגות מס הכנסה חודשיות</h4>
              <div className="space-y-1.5 font-mono">
                {currentRules.netMethod.brackets.map(([ceiling, rate], idx) => (
                  <div key={idx} className="flex justify-between p-2 rounded bg-white border border-slate-100">
                    <span>
                      מדרגה {idx + 1}: {ceiling === null ? 'מעל המדרגה הקודמת' : `עד ${ceiling.toLocaleString()} ₪`}
                    </span>
                    <span className="font-bold text-brand-dark">{(rate * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                ערך נקודת זיכוי: {currentRules.netMethod.creditPointValue} ₪ לחודש
              </div>
            </div>

            {/* NI + Health + Pension credit */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">ביטוח לאומי ומס בריאות</h4>
              <div className="space-y-2 font-mono">
                <div className="p-2 rounded bg-white border border-slate-100 flex justify-between">
                  <span>שיעור מופחת (עד 7,522 ₪):</span>
                  <span className="font-bold text-brand-dark">
                    {((currentRules.netMethod.nationalInsurance.lowRate + currentRules.netMethod.health.lowRate) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-100 flex justify-between">
                  <span>שיעור מלא (עד 50,695 ₪):</span>
                  <span className="font-bold text-brand-dark">
                    {((currentRules.netMethod.nationalInsurance.highRate + currentRules.netMethod.health.highRate) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-100 flex justify-between">
                  <span>זיכוי מס פנסיוני (סעיף 45א):</span>
                  <span className="font-bold text-brand-dark">
                    {(currentRules.netMethod.pensionCredit.rate * 100).toFixed(0)}% עד 7% מתקרה של {currentRules.netMethod.pensionCredit.incomeCeiling.toLocaleString()} ₪
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                שווי שימוש ברכב נכנס לבסיס מס הכנסה, ביטוח לאומי ומס בריאות ואינו משולם במזומן.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Vehicle Benefit DB */}
      {activeTab === 'db' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-ink">מאגר שווי שימוש ברכב (רשות המסים - הקובץ המורחב)</h3>
            <p className="text-xs text-slate-500">
              טעינת קובץ CSV רשמי של רשות המסים (כ-78,000 שורות בקידוד windows-1255) הנשמר בשרת כאינדקס קומפקטי
            </p>
          </div>

          {/* Important Technical Notes */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-brand-dark" />
              <span>הנחיות טכניות מתוך ניתוח הקובץ האמיתי של רשות המסים:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>מפתח החיפוש הרשמי והייחודי:</strong> (שנת רישום, קוד סוג רכב, קוד תוצר, קוד דגם).
              </li>
              <li>
                <strong>סוג רכב:</strong> הקטלוג אינו כולל עמודת סוג רכב, לכן ברירת המחדל לרכב פרטי היא <code>1</code>.
              </li>
              <li>
                <strong>אזהרת דגמים כפולים:</strong> קוד תוצר ודגם מסוימים מופיעים פעמיים עם סוג רכב שונה (למשל BYD 01014/00003/2025: סוג 1 מחזיר ATTO 3 עם שווי 3,130 ₪, ואילו סוג 2 מחזיר TANG עם שווי 6,950 ₪!). השמטת סוג הרכב תחזיר ערך שגוי.
              </li>
              <li>
                <strong>שדה סוג הנעה:</strong> בקובץ המקורי מקודד כ-<code>0</code> בנזין · <code>1</code> היברידי · <code>2</code> פלאג-אין · <code>3</code> חשמלי (על אף שכותרת העמודה מנוסחת בצורה מטעה).
              </li>
              <li>
                <strong>עדיפות שליפה:</strong> קובץ CSV שהועלה ← ערך הזרע של הקטלוג (התואם ב-100% לקובץ הרשמי).
              </li>
            </ul>
          </div>

          {/* Upload and DB stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Upload Area */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-800 block">העלאת קובץ CSV רשות המסים:</span>
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-brand transition-colors">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="font-semibold text-slate-700">בחרו קובץ CSV להעלאה</span>
                <span className="text-[11px] text-slate-500">קידוד windows-1255 או UTF-8</span>
                <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
              </label>

              {csvUploadStatus && (
                <div className="p-2.5 rounded bg-slate-100 text-slate-800 font-medium">
                  <div>{csvUploadStatus}</div>
                  {csvProgress > 0 && csvProgress < 100 && (
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-brand h-full" style={{ width: `${csvProgress}%` }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DB Status */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-800 block mb-1">מצב המאגר בשרת:</span>
                <div className="text-2xl font-black text-brand-dark">{taxRowCount.toLocaleString()} רשומות</div>
                <div className="text-slate-500 mt-1">
                  {taxRowCount > 0
                    ? 'המאגר בשרת פעיל ומוכן לשליפות.'
                    : 'כרגע פעיל מאגר הזרע המאומת של הקטלוג (כל 20 הרכבים זמינים).'}
                </div>
              </div>

              {taxRowCount > 0 && (
                <button
                  onClick={async () => {
                    try {
                      await api.admin.clearTaxRecords();
                    } catch (err) {
                      handleApiError(err);
                    }
                    refreshDbCount();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 w-fit"
                >
                  נקה את המאגר בשרת
                </button>
              )}
            </div>
          </div>

          {/* Interactive Lookup Tester */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Search className="w-4 h-4 text-brand-dark" />
              <span>בדיקת שליפת שווי שימוש לפי מפתח 4-Tuple:</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">שנת רישום:</label>
                <input
                  type="text"
                  value={lookupYear}
                  onChange={(e) => setLookupYear(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">סוג רכב (1 פרטי, 2 מסחרי):</label>
                <input
                  type="text"
                  value={lookupType}
                  onChange={(e) => setLookupType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">קוד תוצר (5 ספרות):</label>
                <input
                  type="text"
                  value={lookupProduct}
                  onChange={(e) => setLookupProduct(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">קוד דגם (5 ספרות):</label>
                <input
                  type="text"
                  value={lookupModel}
                  onChange={(e) => setLookupModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleRunLookup}
                className="px-4 py-2 rounded-full bg-brand text-white font-bold hover:bg-brand-dark"
              >
                בצע חיפוש שווי שימוש
              </button>

              <button
                onClick={() => {
                  setLookupYear('2025');
                  setLookupType('1');
                  setLookupProduct('01014');
                  setLookupModel('00003');
                  handleRunLookup();
                }}
                className="text-xs text-brand-dark hover:underline"
              >
                בדוק דוגמת BYD ATTO 3 (סוג 1)
              </button>

              <button
                onClick={() => {
                  setLookupYear('2025');
                  setLookupType('2');
                  setLookupProduct('01014');
                  setLookupModel('00003');
                  handleRunLookup();
                }}
                className="text-xs text-brand-dark hover:underline"
              >
                בדוק דוגמת BYD TANG (סוג 2)
              </button>
            </div>

            {lookupSearched && (
              <div className="mt-3 p-3 rounded-lg bg-white border border-slate-200">
                {lookupResult ? (
                  <div className="space-y-1 font-mono">
                    <div className="font-bold text-success text-sm">
                      נמצא! שווי שימוש: {lookupResult.value.toLocaleString()} ₪
                    </div>
                    <div>דגם מסחרי: {lookupResult.commercialName || 'לא צוין'}</div>
                    <div>סוג הנעה: {lookupResult.driveCode === 3 ? 'חשמלי (3)' : lookupResult.driveCode}</div>
                    <div>מחיר מחירון: {lookupResult.listPrice.toLocaleString()} ₪</div>
                  </div>
                ) : (
                  <div className="text-danger font-bold">
                    לא נמצאה רשומה תואמת. המערכת תפנה לנציג שכר (לעולם לא תנחש).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 8: Assumptions */}
      {activeTab === 'assumptions' && (
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-ink">הנחות יסוד (Assumptions Panel)</h3>
            <p className="text-xs text-slate-500">
              תיעוד שקוף של כל ההנחות החישוביות והמבניות שנבחרו עבור יועץ הרכב
            </p>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">1. מדרגות מס הכנסה וביטוח לאומי (2025):</span>
              החישוב מתבצע על בסיס חודשי שוטף (ולא מצטבר שנתי), לפי מדרגות מס 2025, ערך נקודת זיכוי של 242 ₪ לחודש, ותקרות ביטוח לאומי ומס בריאות מעודכנות (סף מופחת 7,522 ₪, תקרה 50,695 ₪).
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">2. עודף תקציב רכב אינו נפדה במזומן:</span>
              לפי נוהל שטראוס (unusedBudget: not_paid), אם עובד בוחר ברכב שעלותו למעביד נמוכה מתקציב הקבוצה שלו, היתרה אינה משולמת לעובד כתוספת שכר.
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">3. דמי אחזקת רכב בעת ויתור:</span>
              דמי אחזקת הרכב חייבים במס מלא ובביטוח לאומי/בריאות, אך אינם מוכרים לשכר פנסיוני (maintenanceIsPensionable: false).
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">4. החזר טעינה חשמלית (+250 ₪ נטו מגולם):</span>
              רכבים בעלי קוד הנעה 3 (חשמלי מלא) בלבד זכאים להחזר. רכבים היברידיים ופלאג-אין אינם זכאים. סכום הגילום מחושב במדויק בשיטת Bisection כך שהתוספת לנטו תעמוד בדיוק על 250 ₪.
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">5. מסלול ברוכת ילדים:</span>
              זכאות מגיל 4 ילדים ומעלה עד גיל 23. על הפער שבין עלות הרכב למעסיק (למשל קיה קרניבל 6,000 ₪) לבין תקציב הקבוצה של העובד, העובד משתתף ב-50% המנוכים משכר הנטו, והמעסיק מממן את 50% הנותרים.
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">6. קוד סוג רכב 1 (פרטי) בשליפות שווי שימוש:</span>
              קטלוג הרכבים אינו מכיל עמודת סוג רכב נפרדת. נקבע כי לכל רכבי הקטלוג סוג הרכב הוא 1 (רכב נוסעים פרטי M1). במידה והרשומה לא אותרה, המערכת מסלימה לנציג אנושי ולא מנחשת.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
