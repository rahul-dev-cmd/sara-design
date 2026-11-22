import React from 'react';
import { X } from 'lucide-react';
import { PartSpec } from '../lib/saraData';
import { StatusBadge } from './StatusBadge';

interface PartInspectorCardProps {
  part: PartSpec | null;
  hoveredPart: PartSpec | null;
  onClearSelection: () => void;
}

export const PartInspectorCard: React.FC<PartInspectorCardProps> = ({
  part,
  hoveredPart,
  onClearSelection,
}) => {
  const activePart = part ?? hoveredPart;
  if (!activePart) return null;

  const isLocked = Boolean(part);
  const isHeartbeat = Boolean(activePart.isHeartbeat);

  return (
    <aside
      aria-label="Part Inspector"
      className={`pointer-events-auto fixed top-18 right-4 z-30 w-[min(350px,calc(100vw-2rem))] rounded-lg border p-4 shadow-2xl ${
        isHeartbeat
          ? 'border-[#22d3ee]/60 bg-[#0c1820]/96'
          : 'border-white/14 bg-[#0e141c]/96'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-[#9aa7b8]">
            <span>{activePart.category}</span>
            <span aria-hidden="true">·</span>
            <StatusBadge status={activePart.status} />
          </div>
          <h3
            className={`mt-1.5 font-display text-base font-semibold leading-snug ${
              isHeartbeat ? 'text-[#67e8f9]' : 'text-white'
            }`}
          >
            {activePart.name}
          </h3>
        </div>
        {isLocked && (
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Close part inspector"
            className="rounded p-1 text-[#9aa7b8] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isHeartbeat && (
        <p className="mt-2 rounded border border-[#22d3ee]/35 bg-[#082029] px-2.5 py-1.5 text-[11px] font-medium text-[#67e8f9]">
          CONCEPT, not in current build or BOM. Future post-competition patent-track module.
        </p>
      )}

      <p className="mt-2.5 text-xs leading-relaxed text-[#cbd5e1]">{activePart.description}</p>

      <dl className="mt-3.5 grid grid-cols-1 gap-2 border-t border-white/10 pt-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-[#8a97a8]">Material</dt>
          <dd className="text-right font-medium text-[#eef2f7]">{activePart.material}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#8a97a8]">Estimated mass</dt>
          <dd className="text-right font-mono text-[11px] tabular-nums text-[#eef2f7]">
            {activePart.mass}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#8a97a8]">Dimensions</dt>
          <dd className="text-right font-mono text-[11px] tabular-nums text-[#eef2f7]">
            {activePart.dimensions}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#8a97a8]">Source</dt>
          <dd className="text-right text-[#cbd5e1]">{activePart.source}</dd>
        </div>
      </dl>

      {!isLocked && (
        <p className="mt-2.5 text-[11px] text-[#8a97a8]">Click part to isolate and pin details.</p>
      )}
    </aside>
  );
};
