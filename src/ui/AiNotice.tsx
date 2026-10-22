/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** The notice shown wherever AI-written text appears: answers are generated and may contain mistakes */

import { Sparkles } from 'lucide-react';
import React from 'react';

export const AI_NOTICE_TEXT = 'התשובות נכתבות בעזרת בינה מלאכותית ועלולות לכלול טעויות. כדאי לבדוק פרטים חשובים לפני החלטה.';

interface AiNoticeProps {
  /** Overrides the default sentence, e.g. for a draft or a scanned file */
  text?: string;
  className?: string;
}

export const AiNotice: React.FC<AiNoticeProps> = ({ text = AI_NOTICE_TEXT, className = '' }) => (
  <p role="note" className={`flex items-start gap-1.5 text-[11px] leading-snug text-slate-500 ${className}`}>
    <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-blue" aria-hidden="true" />
    <span>{text}</span>
  </p>
);
