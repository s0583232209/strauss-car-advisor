/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import logoUrl from './header_logo.svg';

/** Official Strauss logo (src/ui/header_logo.svg). Its white backing keeps it legible on colored bars. */
export const StraussLogo: React.FC<{ className?: string }> = ({ className = 'h-10' }) => (
  <img src={logoUrl} alt="שטראוס" className={`${className} w-auto select-none`} draggable={false} />
);

const PINWHEEL_PETALS: [string, string][] = [
  ['#C7DE8D', 'M86.88,4.66c-4.44,3.58-9.89,9.58-12,18.06-3,11.88,7,23.4,7.13,23.42-.82-12.07,3.49-31.23,6.19-40.28.29-1,0-1.33-.14-1.46s-.73-.11-1.19.26'],
  ['#C7DE8D', 'M101.78,23.45C93.33,29.37,85.86,36,82,46.14c-1.95-3.29-1.49-7.8-.36-11.31,2.93-9.09,11.49-12.56,19.87-12.48.8,0,1.11.5.25,1.1'],
  ['#0390CB', 'M82,46.14c8.33-2.45,23.4-2.22,32.13,0,1.5.38,1.71-.81,1-1.66-4.17-5.08-9-8.26-15.77-8.8C91.33,35,86.1,40.17,82,46.14'],
  ['#ED3024', 'M74.49,62.22A22.11,22.11,0,0,0,81.13,54c1.94,6.42-3,8.6-6.21,9-.6.07-.86-.44-.43-.78'],
  ['#ED3024', 'M82,46.14c2.35,8.6,1.08,18.87-1.25,27.61-.33,1.26.44,1.69,1.45,1,4.45-3.06,9.32-9.89,9-16.3-.39-6.88-3.26-10.81-9.16-12.31'],
  ['#9ED8EF', 'M82,46.14,104.5,73.78c1,1.25,2.28,1.08,2.32-.47C107,66.2,104.69,47.24,82,46.14'],
  ['#0390CB', 'M82,46.14l10.72,21.1c.69,1.37,1.55,1.26,1.93-.34C96,61.44,97.23,49.09,82,46.14'],
  ['#78A12F', 'M115.91,36.95c-12.44,1.16-18.66-.41-33.89,9.2,7.5-20.08,25.42-16.69,33.87-11,1.15.77.89,1.76,0,1.85'],
  ['#00BAE2', 'M107.77,57.77C102,53.18,90,47.1,82,46.14A18.7,18.7,0,0,1,90,43c8.83-1.4,16.7,4.67,19.13,14,.32,1.23-.44,1.48-1.36.75'],
  ['#C7DE8D', 'M62.25,22.23C66.92,32,72.69,40.77,82,46.14c-3.45,1.68-8,.72-11.27-.92C62.28,41,60,31.35,61.15,22.37c.11-.86.62-1.12,1.1-.13'],
  ['#ED3024', 'M82,46.14c-7.83,5.15-17.87,5-25.68,3.33-1.11-.23-1.41.73-.7,1.49,4.35,4.59,9.79,7.34,15.8,6.81,5.76-.5,10.89-5.11,10.57-11.63'],
  ['#78A12F', 'M82,46.14,69.73,25.7c-.79-1.32-1.63-1.15-1.91.47-.93,5.56-1.22,18.1,14.19,20'],
  ['#F48326', 'M83,23.2c-8.18,6.69-8.11,15.23-1,22.95-.43-6.4.59-14.82,2-22.64.16-.85-.11-1.09-1.07-.3'],
  ['#F48326', 'M82,46.14c-6.64.85-13.2-1.78-18.88-4.9-.94-.52-1.39.08-1.07.83,3.38,8.11,14.63,13.26,20,4.07'],
];

// All petals meet at this hub, so the pinwheel spins around it.
const HUB_X = 82;
const HUB_Y = 46.14;

/** The pinwheel from the Strauss logo, as an icon. `spin` turns it slowly (used as a loading indicator). */
export const Pinwheel: React.FC<{ className?: string; spin?: boolean; title?: string }> = ({
  className = 'w-6 h-6',
  spin = false,
  title,
}) => (
  <svg viewBox="40 4 84 84" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
    <g
      className={spin ? 'animate-spin-slow' : undefined}
      style={{ transformBox: 'view-box', transformOrigin: `${HUB_X}px ${HUB_Y}px` }}
    >
      {PINWHEEL_PETALS.map(([fill, d], i) => (
        <path key={i} fill={fill} d={d} />
      ))}
    </g>
  </svg>
);

/* ---------- Advisor logo: a chat bubble with a car, the agent's own mark ---------- */

const ADVISOR_VARIANTS = {
  // Blue bubble for light backgrounds
  color: { bubble: '#0A6EA8', car: '#FFFFFF', speed: '#9ED8EF' },
  // White bubble for the blue header bar
  light: { bubble: '#FFFFFF', car: '#0A6EA8', speed: '#0390CB' },
};

export const AdvisorLogo: React.FC<{ className?: string; variant?: keyof typeof ADVISOR_VARIANTS; title?: string }> = ({
  className = 'w-10 h-10',
  variant = 'color',
  title,
}) => {
  const c = ADVISOR_VARIANTS[variant];
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path fill={c.bubble} d="M18,6 H46 A14,14 0 0 1 60,20 V36 A14,14 0 0 1 46,50 H27 L15,59 Q13,60.4 13.4,58 L15,50 A11,11 0 0 1 4,39 V20 A14,14 0 0 1 18,6 Z" />
      <path fill={c.car} d="M20.5,27 L25,19.4 Q26,17.6 28.4,17.6 H38.2 Q40.6,17.6 41.8,19.4 L46.6,27 Z" />
      <path fill={c.bubble} d="M24.2,26.2 L27.4,20.4 H32.4 V26.2 Z M34.4,20.4 H38.2 L42,26.2 H34.4 Z" />
      <rect fill={c.car} x="11.5" y="25.5" width="41" height="11.5" rx="5.75" />
      <circle fill="#F48326" cx="15.6" cy="30.2" r="1.7" />
      <rect fill="#ED3024" x="49.4" y="28.6" width="2" height="3.4" rx="1" />
      {[21, 43].map((cx) => (
        <g key={cx}>
          <circle fill="#ED3024" stroke={c.bubble} strokeWidth="2" cx={cx} cy="37" r="5.2" />
          <circle fill="#FFFFFF" cx={cx} cy="37" r="1.9" />
        </g>
      ))}
      <path stroke={c.speed} strokeWidth="1.8" strokeLinecap="round" fill="none" d="M53.5,20.5 H57 M54.5,24.5 H57.5" />
    </svg>
  );
};

/* ---------- Footer scene: hills with cars and a truck slowly driving over them ---------- */

// The road runs along the top of the front hill, right to left (the reading direction).
const ROAD = 'M1560,104 C1380,92 1260,84 1100,96 C920,110 760,122 560,106 C380,92 200,88 -120,104';

/** Small side-view vehicles, front facing left, wheels resting on y=0. */
const Car: React.FC<{ color: string }> = ({ color }) => (
  <g>
    <path d="M-10,-11 L-6,-17.5 H6 L10.5,-11 Z" fill={color} />
    <path d="M-7.3,-11.5 L-4.5,-16 H-0.6 V-11.5 Z M0.8,-11.5 V-16 H5.2 L8,-11.5 Z" fill="#E6F6FC" />
    <rect x="-17" y="-12" width="34" height="9" rx="4" fill={color} />
    <circle cx="-15" cy="-8.5" r="1.3" fill="#FFE9A8" />
    <circle cx="-9" cy="-3" r="3.4" fill="#2D3748" />
    <circle cx="-9" cy="-3" r="1.3" fill="#E2E8F0" />
    <circle cx="9" cy="-3" r="3.4" fill="#2D3748" />
    <circle cx="9" cy="-3" r="1.3" fill="#E2E8F0" />
  </g>
);

const Truck: React.FC = () => (
  <g>
    {/* cargo box with a little pinwheel on the side */}
    <rect x="-10" y="-25" width="38" height="20" rx="3" fill="#FFFFFF" stroke="#E2E8F0" />
    <rect x="-10" y="-9" width="38" height="3" fill="#ED3024" />
    <g transform="translate(9 -15.5) scale(0.17) translate(-82 -46.14)">
      {PINWHEEL_PETALS.map(([fill, d], i) => (
        <path key={i} fill={fill} d={d} />
      ))}
    </g>
    {/* cab */}
    <path d="M-26,-6 V-15 Q-26,-19 -22,-19 H-12 V-6 Z" fill="#0390CB" />
    <rect x="-23.5" y="-17" width="7" height="5" rx="1.5" fill="#E6F6FC" />
    <rect x="-27" y="-7" width="56" height="3" rx="1.5" fill="#4A5568" />
    {[-19, 8, 20].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="-3" r="3.6" fill="#2D3748" />
        <circle cx={cx} cy="-3" r="1.4" fill="#E2E8F0" />
      </g>
    ))}
  </g>
);

const Tree: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-1.5" y="-10" width="3" height="10" fill="#8B6B3E" />
    <circle cx="0" cy="-16" r="9" fill="#78A12F" />
    <circle cx="-3" cy="-19" r="3" fill="#C7DE8D" opacity="0.7" />
  </g>
);

const VEHICLES: { el: React.ReactNode; dur: number; begin: number }[] = [
  { el: <Car color="#ED3024" />, dur: 60, begin: -8 },
  { el: <Truck />, dur: 75, begin: -40 },
  { el: <Car color="#F48326" />, dur: 68, begin: -30 },
  { el: <Car color="#00BAE2" />, dur: 64, begin: -55 },
];

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

/** Rolling hills in Strauss greens; vehicles drive slowly along the road (static if reduced motion). */
export const HillsScene: React.FC<{ className?: string }> = ({ className = '' }) => {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <svg
      className={`block w-full h-28 sm:h-36 ${className}`}
      viewBox="0 0 1440 150"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* far hills */}
      <path d="M0,86 C180,40 360,44 540,72 C720,100 880,36 1080,46 C1240,54 1340,74 1440,62 V150 H0 Z" fill="#C7DE8D" />
      <path d="M0,104 C260,70 420,74 640,92 C840,108 1000,70 1200,72 C1320,73 1400,84 1440,86 V150 H0 Z" fill="#9ED8EF" opacity="0.45" />
      <Tree x={210} y={66} s={1.1} />
      <Tree x={236} y={70} s={0.8} />
      <Tree x={1010} y={52} />
      <Tree x={1300} y={70} s={0.9} />

      {/* front hill + road on its crest */}
      <path d={`${ROAD} L-120,150 L1560,150 Z`} fill="#78A12F" />
      <path d={ROAD} fill="none" stroke="#4A5568" strokeWidth="7" strokeLinecap="round" />
      <path d={ROAD} fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="10 12" opacity="0.8" />

      {VEHICLES.map((v, i) =>
        reducedMotion ? (
          <g key={i} transform={`translate(${300 + i * 260} ${[96, 113, 115, 97][i]})`}>
            {v.el}
          </g>
        ) : (
          <g key={i}>
            {/* Vehicles are drawn facing left; the road path also runs leftwards. */}
            <g>
              {v.el}
              <animateMotion dur={`${v.dur}s`} begin={`${v.begin}s`} repeatCount="indefinite" rotate="auto-reverse" path={ROAD} />
            </g>
          </g>
        ),
      )}
    </svg>
  );
};
