/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Upload,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type { ExtractedPayslipData } from '../../shared/types.ts';
import { api } from '../api/client.ts';
import { EmployeeProfile } from '../../shared/types.ts';

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedData: (data: Partial<EmployeeProfile>) => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedData,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedPayslipData | null>(null);

  // Editable fields before confirmation
  const [editableValues, setEditableValues] = useState<Record<string, any>>({});

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);

      const base64Data = await base64Promise;
      const mimeType = file.type || 'image/jpeg';

      const data: ExtractedPayslipData = await api.payslip.extract(base64Data, mimeType);
      setExtractedData(data);

      // Populate editable initial state
      const initial: Record<string, any> = {};
      for (const [key, field] of Object.entries(data)) {
        initial[key] = (field as any)?.value ?? '';
      }
      setEditableValues(initial);
    } catch (err: any) {
      setError(err?.message || 'שגיאה בפענוח הקובץ. וודאו שהקובץ קריא ונסו שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmMerge = () => {
    const updates: Partial<EmployeeProfile> = {};

    if (editableValues.base) updates.base = Number(editableValues.base);
    if (editableValues.occupation) updates.occupation = String(editableValues.occupation);
    if (editableValues.commissions) updates.commissions = Number(editableValues.commissions);
    if (editableValues.bonus) updates.bonus = Number(editableValues.bonus);
    if (editableValues.pensionPct) updates.pensionPct = Number(editableValues.pensionPct);
    if (editableValues.studyFundPct) updates.studyFundPct = Number(editableValues.studyFundPct);
    if (editableValues.creditPoints) updates.creditPoints = Number(editableValues.creditPoints);
    if (editableValues.childrenUpTo23) updates.childrenUpTo23 = Number(editableValues.childrenUpTo23);
    if (editableValues.currentCar) {
      updates.hasCar = true;
      updates.currentCarName = String(editableValues.currentCar);
    }
    if (editableValues.carParticipation) updates.currentParticipation = Number(editableValues.carParticipation);
    if (editableValues.maintenance) updates.currentMaintenance = Number(editableValues.maintenance);

    onApplyExtractedData(updates);
    onClose();
  };

  const fieldLabels: Record<string, string> = {
    occupation: 'תפקיד / עיסוק',
    base: 'שכר יסוד (בסיס)',
    commissions: 'עמלות ושכר עידוד',
    bonus: 'בונוס חודשי',
    pensionPct: 'אחוז הפרשת פנסיה (%)',
    studyFundPct: 'קרן השתלמות (%)',
    creditPoints: 'נקודות זיכוי',
    currentCar: 'רכב חברה קיים',
    carParticipation: 'ניכוי השתתפות רכב',
    maintenance: 'דמי אחזקת רכב',
    childrenUpTo23: 'ילדים עד גיל 23',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand-dark flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-ink">טעינת תלוש שכר או חוזה העסקה</h3>
              <p className="text-xs text-slate-500">חילוץ אוטומטי של שכר, הפרשות ורכב קיים</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Privacy Banner */}
          <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">אזהרת פרטיות חשובה: </span>
              <span>
                השתמשו רק בטפסי דוגמה מותאמים (פרטים אישיים ותעודת זהות שונו או הוסתרו). בגרסה החינמית של ג׳מיני הקלט עשוי לשמש לאימון המודלים.
              </span>
            </div>
          </div>

          {!extractedData ? (
            /* Upload State */
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-brand hover:bg-slate-50 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-700">
                  {file ? file.name : 'לחצו לבחירת תלוש שכר או גררו קובץ לכאן'}
                </span>
                <span className="text-xs text-slate-500 mt-1">תמיכה בפורמטים PDF, PNG, JPG (עד 10MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {file && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                  <button
                    onClick={handleUploadAndAnalyze}
                    disabled={isLoading}
                    className="lift px-4 py-2 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand-dark disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>מנתח תלוש...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>התחל ניתוח</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-danger/10 text-danger text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Review & Edit Table: "מה קראנו, אשרו או תקנו" */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-ink flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>מה קראנו – אשרו או תקנו לפני מיזוג:</span>
                </h4>
                <button
                  onClick={() => setExtractedData(null)}
                  className="text-xs text-brand-dark hover:underline"
                >
                  העלה קובץ אחר
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {Object.entries(extractedData).map(([key, field]) => {
                  const label = fieldLabels[key] || key;
                  const quote = (field as any)?.sourceQuote || '';
                  const conf = (field as any)?.confidence || 'medium';

                  return (
                    <div key={key} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="sm:w-1/2">
                        <span className="font-semibold text-slate-800">{label}</span>
                        {quote && <span className="text-[11px] text-slate-400 block truncate">ציטוט: "{quote}"</span>}
                      </div>

                      <div className="flex items-center gap-2 sm:w-1/2">
                        <input
                          type="text"
                          value={editableValues[key] ?? ''}
                          onChange={(e) =>
                            setEditableValues({ ...editableValues, [key]: e.target.value })
                          }
                          placeholder="לא זוהה"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-brand"
                        />
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            conf === 'high'
                              ? 'bg-success/10 text-success'
                              : conf === 'medium'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {conf === 'high' ? 'בטוח' : conf === 'medium' ? 'בינוני' : 'חלש'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {extractedData && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleConfirmMerge}
              className="lift px-4 py-2 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand-dark transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>אשר ועדכן פרופיל</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
