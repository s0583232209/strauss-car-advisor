import { ShieldAlert } from 'lucide-react';
import React from 'react';

export const AccessDeniedPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
    <div className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-6">
      <ShieldAlert className="w-10 h-10 text-brand" />
    </div>
    <p className="text-8xl font-extrabold text-brand leading-none mb-4">403</p>
    <h1 className="text-2xl font-bold text-ink mb-2">אין לך הרשאה לכאן</h1>
    <p className="text-muted text-sm max-w-xs mb-8">
      המסך הזה מיועד לתפקידים אחרים. אם אתה חושב שמדובר בטעות, פנה למנהל המערכת.
    </p>
    <a
      href="/"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors lift"
    >
      חזרה לדף הבית
    </a>
  </div>
);
