import React from 'react';
import { StatusTag } from '../lib/saraData';

interface StatusBadgeProps {
  status: StatusTag | 'UNCONFIRMED' | 'CONCEPT SIMULATION';
  className?: string;
}

const STYLE_MAP: Record<StatusBadgeProps['status'], string> = {
  PLANNED: 'border-white/18 text-[#cbd5e1] bg-[#141c26]',
  'CAD ESTIMATE': 'border-[#ff7a1a]/45 text-[#ffb37b] bg-[#21150d]',
  PLACEHOLDER: 'border-[#f59e0b]/45 text-[#fcd34d] bg-[#21190b]',
  CONCEPT: 'border-[#22d3ee]/50 text-[#67e8f9] bg-[#0b1f26]',
  DATASHEET: 'border-white/20 text-[#9aa7b8] bg-[#111720]',
  UNCONFIRMED: 'border-[#f59e0b]/55 text-[#fbbf24] bg-[#241908]',
  'CONCEPT SIMULATION': 'border-[#ff7a1a]/55 text-[#ff9f56] bg-[#23140b]',
};

/**
 * Crisp, flat typographic honesty micro-tag for every specification and number.
 * Deliberately minimal (square 2px radius, hairline border, monospace) — never puffy candy pills.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider leading-none whitespace-nowrap shrink-0 rounded-[2px] ${STYLE_MAP[status]} ${className}`}
    >
      {status}
    </span>
  );
};
