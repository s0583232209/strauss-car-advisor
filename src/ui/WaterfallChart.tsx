/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DeltaStep } from '../../shared/types.ts';

interface WaterfallChartProps {
  todayNet: number;
  altNet: number;
  steps: DeltaStep[];
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  todayNet,
  altNet,
  steps,
}) => {
  // Chart dimensions
  const height = 180;
  const paddingBottom = 40;
  const paddingTop = 25;
  const availableHeight = height - paddingTop - paddingBottom;

  // Build items array: [Today, ...steps, Alt]
  const items: Array<{
    label: string;
    value: number;
    delta?: number;
    isTotal?: boolean;
    start: number;
    end: number;
  }> = [];

  // Start with today
  items.push({
    label: 'היום',
    value: todayNet,
    isTotal: true,
    start: 0,
    end: todayNet,
  });

  let runningTotal = todayNet;
  for (const step of steps) {
    // Rounded steps, so the bars end exactly at the alternative's net
    const delta = step.deltaNetRounded ?? Math.round(step.deltaNet);
    const start = runningTotal;
    runningTotal += delta;
    items.push({
      label: step.label_he.replace('שינוי ', ''),
      value: delta,
      delta,
      isTotal: false,
      start: Math.min(start, runningTotal),
      end: Math.max(start, runningTotal),
    });
  }

  // End with alt
  items.push({
    label: 'החלופה',
    value: altNet,
    isTotal: true,
    start: 0,
    end: altNet,
  });

  // Calculate scales
  const maxVal = Math.max(todayNet, altNet, runningTotal, ...items.map((i) => i.end)) * 1.15;
  const minVal = Math.min(0, ...items.map((i) => i.start));
  const range = maxVal - minVal || 1;

  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) / range) * availableHeight;
  };

  const colWidth = 46;
  const gap = 14;
  const chartWidth = Math.max(340, items.length * (colWidth + gap) + 20);

  return (
    <div className="w-full overflow-x-auto py-2">
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="w-full max-w-2xl mx-auto h-auto min-w-[340px]"
      >
        {/* Baseline line */}
        <line
          x1={10}
          y1={getY(0)}
          x2={chartWidth - 10}
          y2={getY(0)}
          stroke="#E2E8F0"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {items.map((item, idx) => {
          const x = 16 + idx * (colWidth + gap);
          const y1 = getY(item.end);
          const y2 = getY(item.start);
          const barHeight = Math.max(3, Math.abs(y2 - y1));
          const topY = Math.min(y1, y2);

          let barColor = '#0390CB'; // Base total
          if (!item.isTotal) {
            barColor = (item.delta || 0) >= 0 ? '#78A12F' : '#ED3024';
          }

          const valueDisplay = item.isTotal
            ? `${Math.round(item.value).toLocaleString()}`
            : `${item.delta! >= 0 ? '+' : ''}${Math.round(item.delta!).toLocaleString()}`;

          return (
            <g key={idx}>
              {/* Connector line to next item */}
              {idx < items.length - 1 && (
                <line
                  x1={x + colWidth}
                  y1={getY(item.isTotal ? item.value : item.delta! >= 0 ? item.end : item.start)}
                  x2={x + colWidth + gap}
                  y2={getY(item.isTotal ? item.value : item.delta! >= 0 ? item.end : item.start)}
                  stroke="#CBD5E1"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Bar */}
              <rect
                x={x}
                y={topY}
                width={colWidth}
                height={barHeight}
                rx={4}
                fill={barColor}
                opacity={0.9}
              />

              {/* Top value text */}
              <text
                x={x + colWidth / 2}
                y={topY - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#1A202C"
              >
                {valueDisplay}
              </text>

              {/* Bottom label */}
              <text
                x={x + colWidth / 2}
                y={height - 14}
                textAnchor="middle"
                fontSize="10"
                fill="#64748B"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
