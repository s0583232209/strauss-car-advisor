import React from 'react';
import { Pinwheel } from './CarDecor.tsx';

export const NotFoundPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
    <Pinwheel className="w-20 h-20 mb-6" spin title="פינוויל שטראוס" />
    <p className="text-8xl font-extrabold text-brand leading-none mb-4">404</p>
    <h1 className="text-2xl font-bold text-ink mb-2">הדף לא נמצא</h1>
    <p className="text-muted text-sm max-w-xs mb-8">
      נראה שהכתובת שהקלדת לא קיימת במערכת. אולי הקישור פג תוקף?
    </p>
    <a
      href="/"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors lift"
    >
      חזרה לדף הבית
    </a>
  </div>
);
