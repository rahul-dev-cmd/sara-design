import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Flame,
  HeartPulse,
} from 'lucide-react';
import { ViewMode } from '../lib/saraData';

interface ViewportDockProps {
  viewMode: ViewMode;
  explodeAmount: number;
  cutawayAmount: number;
  includeHeartbeat: boolean;
  simPlaying: boolean;
  simSpeed: number;
  thermalView: boolean;
  fpvCamera: boolean;
  dockCollapsed: boolean;
  onChangeMode: (mode: ViewMode) => void;
  onChangeExplode: (value: number) => void;
  onChangeCutaway: (value: number) => void;
  onToggleHeartbeat: () => void;
  onToggleSimPlaying: () => void;
  onResetSim: () => void;
  onChangeSimSpeed: (speed: number) => void;
  onToggleThermal: () => void;
  onToggleFpv: () => void;
  onResetCamera: () => void;
  onToggleCollapsed: () => void;
}

const MODES: Array<{ id: ViewMode; label: string; keyHint: string }> = [
  { id: 'outer', label: 'Outer', keyHint: '1' },
  { id: 'inner', label: 'Inner', keyHint: '2' },
  { id: 'explode', label: 'Explode', keyHint: '3' },
  { id: 'simulate', label: 'Simulate', keyHint: '4' },
];

export const ViewportDock: React.FC<ViewportDockProps> = ({
  viewMode,
  explodeAmount,
  cutawayAmount,
  includeHeartbeat,
  simPlaying,
  simSpeed,
  thermalView,
  fpvCamera,
  dockCollapsed,
  onChangeMode,
  onChangeExplode,
  onChangeCutaway,
  onToggleHeartbeat,
  onToggleSimPlaying,
  onResetSim,
  onChangeSimSpeed,
  onToggleThermal,
  onToggleFpv,
  onResetCamera,
  onToggleCollapsed,
}) => {
  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-30 w-[min(1080px,96vw)] -translate-x-1/2 flex flex-col items-center">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!dockCollapsed}
        className="pointer-events-auto mb-1 inline-flex items-center gap-1.5 rounded-t-md border border-b-0 border-white/12 bg-[#0e141c]/95 px-3 py-1 text-[11px] font-medium text-[#9aa7b8] hover:text-white transition-colors cursor-pointer"
      >
        {dockCollapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Show 3D Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!dockCollapsed && (
        <div
          role="toolbar"
          aria-label="3D Robot View Controls"
          className="pointer-events-auto w-full rounded-lg border border-white/12 bg-[#0e141c]/95 px-2.5 py-2 shadow-2xl"
        >
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
            {/* 4 Primary View Modes */}
            <div className="flex items-center gap-0.5 rounded-md bg-[#161e2a] p-0.5 shrink-0">
              {MODES.map((m) => {
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeMode(m.id)}
                    aria-pressed={active}
                    className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#ff7a1a] text-[#0b0f14]'
                        : 'text-[#cbd5e1] hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    {m.label}
                    <span className="ml-1 hidden xl:inline font-mono text-[10px] opacity-65">
                      {m.keyHint}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mode-Specific Controls */}
            {viewMode === 'explode' && (
              <div className="flex items-center gap-2 min-w-[160px] flex-1 max-w-[240px]">
                <label
                  htmlFor="explode-slider"
                  className="text-xs font-medium text-[#cbd5e1] whitespace-nowrap"
                >
                  Explode
                </label>
                <input
                  id="explode-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(explodeAmount * 100)}
                  onChange={(e) => onChangeExplode(Number(e.target.value) / 100)}
                  className="sara-slider w-full"
                />
                <span className="font-mono text-[11px] tabular-nums text-[#9aa7b8] w-8 text-right">
                  {Math.round(explodeAmount * 100)}%
                </span>
              </div>
            )}

            {(viewMode === 'outer' || viewMode === 'inner') && (
              <div className="flex items-center gap-2 min-w-[160px] flex-1 max-w-[240px]">
                <label
                  htmlFor="cutaway-slider"
                  className="text-xs font-medium text-[#cbd5e1] whitespace-nowrap"
                >
                  Cutaway
                </label>
                <input
                  id="cutaway-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(cutawayAmount * 100)}
                  onChange={(e) => onChangeCutaway(Number(e.target.value) / 100)}
                  className="sara-slider w-full"
                />
                <span className="font-mono text-[11px] tabular-nums text-[#9aa7b8] w-8 text-right">
                  {Math.round(cutawayAmount * 100)}%
                </span>
              </div>
            )}

            {viewMode === 'simulate' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleSimPlaying}
                  className="inline-flex items-center gap-1 rounded border border-white/14 bg-[#17202c] px-2.5 py-1.5 text-xs font-medium text-white hover:border-[#ff7a1a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {simPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Start</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onResetSim}
                  aria-label="Reset simulation"
                  className="inline-flex items-center gap-1 rounded border border-white/14 bg-[#17202c] px-2 py-1.5 text-xs font-medium text-[#cbd5e1] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Reset</span>
                </button>

                <div className="flex items-center rounded border border-white/12 bg-[#141c26] p-0.5">
                  {[0.5, 1, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onChangeSimSpeed(spd)}
                      className={`rounded px-1.5 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
                        simSpeed === spd
                          ? 'bg-white/14 text-white'
                          : 'text-[#9aa7b8] hover:text-white'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onToggleThermal}
                  aria-pressed={thermalView}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    thermalView
                      ? 'border-[#ff7a1a] bg-[#ff7a1a]/20 text-[#ffb37b]'
                      : 'border-white/14 bg-[#17202c] text-[#cbd5e1] hover:text-white'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Thermal</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleFpv}
                  aria-pressed={fpvCamera}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    fpvCamera
                      ? 'border-[#ff7a1a] bg-[#ff7a1a]/20 text-[#ffb37b]'
                      : 'border-white/14 bg-[#17202c] text-[#cbd5e1] hover:text-white'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Camera</span>
                </button>
              </div>
            )}

            {/* Right Group: Heartbeat Concept Toggle & Reset View */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={includeHeartbeat}
                onClick={onToggleHeartbeat}
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  includeHeartbeat
                    ? 'border-[#22d3ee] bg-[#0b252e] text-[#67e8f9]'
                    : 'border-white/14 bg-[#17202c] text-[#9aa7b8] hover:border-[#22d3ee]/60 hover:text-white'
                }`}
              >
                <HeartPulse className="h-3.5 w-3.5 text-[#22d3ee]" aria-hidden="true" />
                <span>Include heartbeat module</span>
              </button>

              <button
                type="button"
                onClick={onResetCamera}
                aria-label="Reset 3D camera view"
                className="inline-flex items-center gap-1 rounded border border-white/14 bg-[#17202c] px-2 py-1.5 text-xs font-medium text-[#cbd5e1] hover:border-white/30 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden xl:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
