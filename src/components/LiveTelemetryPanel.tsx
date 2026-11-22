import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { TELEMETRY_WINDOW_SEC, TelemetrySample } from '../lib/simTelemetry';
import { StatusBadge } from './StatusBadge';

interface LiveTelemetryPanelProps {
  history: TelemetrySample[];
  includeHeartbeat: boolean;
  simPlaying: boolean;
}

interface SeriesToggleState {
  thermal: boolean;
  co2: boolean;
  av: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TelemetrySample }>;
  includeHeartbeat: boolean;
}

const TelemetryTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  includeHeartbeat,
}) => {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const pt = payload[0].payload;

  return (
    <div className="rounded border border-white/15 bg-[#0b0f14]/96 px-2.5 py-2 font-mono text-[10px] shadow-xl">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1 text-[#cbd5e1]">
        <span>T {pt.relSec === 0 ? '0.0s (Now)' : `${pt.relSec.toFixed(1)}s`}</span>
        <span className="text-[#8a97a8]">Path {Math.round(pt.progress * 100)}%</span>
      </div>
      <div className="mt-1.5 space-y-0.5 tabular-nums">
        <div className="flex items-center justify-between gap-4 text-[#ff7a1a] font-semibold">
          <span>Evidence Score</span>
          <span>{pt.evidenceScore} / 100</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[#fbbf24]">
          <span>Thermal (MLX90640)</span>
          <span>
            {pt.thermalScore}% (+{pt.thermalDeltaC.toFixed(1)}°C)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[#cbd5e1]">
          <span>CO2 (MH-Z19B)</span>
          <span>{pt.co2Ppm} ppm</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[#60a5fa]">
          <span>RGB + Audio</span>
          <span>{pt.avScore}%</span>
        </div>
        {includeHeartbeat && pt.heartbeatScore !== null && (
          <div className="flex items-center justify-between gap-4 text-[#22d3ee]">
            <span>Heartbeat (CONCEPT)</span>
            <span>
              {pt.bpm ? `${pt.bpm} bpm (${pt.heartbeatScore}%)` : `${pt.heartbeatScore}%`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const LiveTelemetryPanel: React.FC<LiveTelemetryPanelProps> = ({
  history,
  includeHeartbeat,
  simPlaying,
}) => {
  const [expanded, setExpanded] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );
  const [visibleSeries, setVisibleSeries] = useState<SeriesToggleState>({
    thermal: true,
    co2: true,
    av: true,
  });

  const latest = history.length > 0 ? history[history.length - 1] : null;

  const delta10s = useMemo(() => {
    if (history.length < 2) return 0;
    return history[history.length - 1].evidenceScore - history[0].evidenceScore;
  }, [history]);

  const toggleSeries = (key: keyof SeriesToggleState) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section
      aria-label="Live Concept Sensor Telemetry (Last 10 Seconds)"
      data-testid="live-telemetry-panel"
      data-sample-count={history.length}
      className="pointer-events-auto fixed bottom-[104px] left-4 z-30 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-white/14 bg-[#0d131b]/95 shadow-2xl"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-3.5 w-3.5 shrink-0 text-[#ff7a1a]" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xs font-semibold text-white whitespace-nowrap truncate">
                Live Sensor Telemetry
              </h3>
              <span className="font-mono text-[10px] tabular-nums text-[#8a97a8] whitespace-nowrap">
                Last {TELEMETRY_WINDOW_SEC}s
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`font-mono text-[10px] tabular-nums whitespace-nowrap ${
              simPlaying ? 'text-[#ffb37b]' : 'text-[#8a97a8]'
            }`}
          >
            {simPlaying ? '● Streaming' : '❚❚ Paused'}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse live telemetry chart' : 'Expand live telemetry chart'}
            className="inline-flex items-center gap-1 rounded border border-white/12 bg-[#141c26] px-2 py-1 text-[10px] font-medium text-[#cbd5e1] hover:border-white/30 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            {expanded ? (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
                <span>Graph</span>
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-3.5 pt-2.5 pb-3">
          {/* Top Readout Strip: Primary Evidence Score + 10s Delta + Honesty Tag */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium text-[#8a97a8]">
                Evidence Score Evolution (Concept)
              </div>
              <div className="mt-0.5 flex items-baseline gap-2 font-mono tabular-nums">
                <span
                  data-testid="telemetry-evidence-score"
                  className="text-xl font-semibold text-white"
                >
                  {latest ? latest.evidenceScore : 0}
                </span>
                <span className="text-[11px] text-[#8a97a8]">/ 100</span>
                <span
                  className={`text-[11px] font-medium ${
                    delta10s > 0
                      ? 'text-[#4ade80]'
                      : delta10s < 0
                        ? 'text-[#fbbf24]'
                        : 'text-[#8a97a8]'
                  }`}
                >
                  {delta10s > 0 ? `+${delta10s}` : delta10s} (10s)
                </span>
              </div>
            </div>
            <StatusBadge status="CONCEPT SIMULATION" />
          </div>

          {/* Interactive Channel Filter Controls */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded bg-[#ff7a1a]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#ffb37b]">
              <span className="h-1.5 w-3 rounded-xs bg-[#ff7a1a]" aria-hidden="true" />
              Evidence
            </span>

            <button
              type="button"
              onClick={() => toggleSeries('thermal')}
              aria-pressed={visibleSeries.thermal}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                visibleSeries.thermal
                  ? 'border-[#f59e0b]/50 bg-[#f59e0b]/12 text-[#fcd34d]'
                  : 'border-white/10 bg-transparent text-[#64748b] hover:text-[#cbd5e1]'
              }`}
            >
              <span className="h-0.5 w-2.5 bg-[#f59e0b]" aria-hidden="true" />
              Thermal
            </button>

            <button
              type="button"
              onClick={() => toggleSeries('co2')}
              aria-pressed={visibleSeries.co2}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                visibleSeries.co2
                  ? 'border-[#94a3b8]/50 bg-white/8 text-[#e2e8f0]'
                  : 'border-white/10 bg-transparent text-[#64748b] hover:text-[#cbd5e1]'
              }`}
            >
              <span className="h-0.5 w-2.5 bg-[#94a3b8]" aria-hidden="true" />
              CO2
            </button>

            <button
              type="button"
              onClick={() => toggleSeries('av')}
              aria-pressed={visibleSeries.av}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                visibleSeries.av
                  ? 'border-[#60a5fa]/50 bg-[#60a5fa]/12 text-[#93c5fd]'
                  : 'border-white/10 bg-transparent text-[#64748b] hover:text-[#cbd5e1]'
              }`}
            >
              <span className="h-0.5 w-2.5 bg-[#60a5fa]" aria-hidden="true" />
              Cam/Audio
            </button>

            {includeHeartbeat && (
              <span className="inline-flex items-center gap-1.5 rounded border border-[#22d3ee]/50 bg-[#0b252e] px-2 py-0.5 font-mono text-[10px] text-[#67e8f9]">
                <span className="h-0.5 w-2.5 bg-[#22d3ee]" aria-hidden="true" />
                Heartbeat
              </span>
            )}
          </div>

          {/* Recharts 10-Second Sliding Window Chart */}
          <div
            className="mt-2.5 h-[164px] w-full min-w-0 rounded border border-white/8 bg-[#090d12] px-1 pt-2 pb-0.5"
            data-testid="telemetry-chart-container"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={history}
                margin={{ top: 6, right: 10, left: -24, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="saraEvidenceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7a1a" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#ff7a1a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                  vertical={true}
                />

                <XAxis
                  dataKey="relSec"
                  type="number"
                  domain={[-TELEMETRY_WINDOW_SEC, 0]}
                  ticks={[-10, -7.5, -5, -2.5, 0]}
                  tickFormatter={(v: number) => (v === 0 ? '0s' : `${v}s`)}
                  stroke="#64748b"
                  tick={{ fill: '#8a97a8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                />

                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  stroke="#64748b"
                  tick={{ fill: '#8a97a8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={false}
                />

                <ReferenceLine
                  y={70}
                  stroke="rgba(255, 122, 26, 0.3)"
                  strokeDasharray="4 4"
                />

                <Tooltip
                  content={<TelemetryTooltip includeHeartbeat={includeHeartbeat} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1 }}
                  isAnimationActive={false}
                />

                <Area
                  type="monotone"
                  dataKey="evidenceScore"
                  name="Evidence Score"
                  stroke="#ff7a1a"
                  strokeWidth={2.2}
                  fill="url(#saraEvidenceFill)"
                  dot={false}
                  activeDot={{ r: 3.5, fill: '#ff7a1a', stroke: '#0b0f14', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />

                {visibleSeries.thermal && (
                  <Line
                    type="monotone"
                    dataKey="thermalScore"
                    name="Thermal"
                    stroke="#f59e0b"
                    strokeWidth={1.3}
                    strokeDasharray="3 2"
                    dot={false}
                    activeDot={{ r: 2.5, fill: '#f59e0b' }}
                    isAnimationActive={false}
                  />
                )}

                {visibleSeries.co2 && (
                  <Line
                    type="monotone"
                    dataKey="co2Score"
                    name="CO2"
                    stroke="#94a3b8"
                    strokeWidth={1.2}
                    dot={false}
                    activeDot={{ r: 2.5, fill: '#94a3b8' }}
                    isAnimationActive={false}
                  />
                )}

                {visibleSeries.av && (
                  <Line
                    type="monotone"
                    dataKey="avScore"
                    name="Cam/Audio"
                    stroke="#60a5fa"
                    strokeWidth={1.2}
                    dot={false}
                    activeDot={{ r: 2.5, fill: '#60a5fa' }}
                    isAnimationActive={false}
                  />
                )}

                {includeHeartbeat && (
                  <Line
                    type="monotone"
                    dataKey="heartbeatScore"
                    name="Heartbeat (CONCEPT)"
                    stroke="#22d3ee"
                    strokeWidth={1.7}
                    dot={false}
                    activeDot={{ r: 3, fill: '#22d3ee' }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Live Compact Sensor Footnote Strip */}
          <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-[10px] tabular-nums text-[#9aa7b8]">
            <div>
              IR:{' '}
              <span className="text-[#fcd34d]">
                +{latest ? latest.thermalDeltaC.toFixed(1) : '0.0'}°C
              </span>
            </div>
            <div>
              CO2:{' '}
              <span className="text-[#e2e8f0]">{latest ? latest.co2Ppm : 420} ppm</span>
            </div>
            <div className="text-right">
              {includeHeartbeat ? (
                <span className="text-[#67e8f9]">
                  HR: {latest?.bpm ? `${latest.bpm} bpm` : 'Scanning'}
                </span>
              ) : (
                <span>RGB/Mic: {latest ? latest.avScore : 0}%</span>
              )}
            </div>
          </div>

          <p className="mt-1.5 text-[10px] leading-snug text-[#7d8a9b]">
            Simulated concept sensor signals over a rolling 10s window — not measured hardware data.
          </p>
        </div>
      )}
    </section>
  );
};
