import React from 'react';
import {
  NO_VITAL_SIGN_LABEL,
  OPERATOR_DECISION_NOTICE,
  evaluateRescuePriority,
} from '../lib/saraData';
import { SimTelemetry } from '../three/SaraViewport';
import { StatusBadge } from './StatusBadge';

interface SimulationPanelProps {
  telemetry: SimTelemetry;
  includeHeartbeat: boolean;
  thermalView: boolean;
  fpvCamera: boolean;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  telemetry,
  includeHeartbeat,
  thermalView,
  fpvCamera,
}) => {
  const personA = evaluateRescuePriority(
    {
      cameraConfidence: telemetry.personADetected ? 84 : 25,
      thermalMatch: telemetry.personADetected,
      co2Elevated: telemetry.personADetected,
      audioDetected: telemetry.personADetected,
      heartbeatDetected: telemetry.personADetected,
      bpm: telemetry.personADetected ? telemetry.personABpm : null,
    },
    includeHeartbeat
  );

  const personB = evaluateRescuePriority(
    {
      cameraConfidence: telemetry.personBDetected ? 32 : 12,
      thermalMatch: false,
      co2Elevated: false,
      audioDetected: false,
      heartbeatDetected: false,
      bpm: null,
    },
    includeHeartbeat
  );

  const activeEvidenceScore = telemetry.sample.evidenceScore;

  return (
    <aside
      aria-label="Concept Simulation Evidence Panel"
      className="pointer-events-auto fixed top-18 right-4 z-30 w-[min(360px,calc(100vw-2rem))] max-h-[calc(100vh-11rem)] overflow-y-auto rounded-lg border border-white/14 bg-[#0d131b]/95 p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status="CONCEPT SIMULATION" />
        <span className="font-mono text-[11px] tabular-nums text-[#9aa7b8]">
          Path {Math.round(telemetry.progress * 100)}%
        </span>
      </div>

      <h3 className="mt-2 font-display text-sm font-semibold text-white">
        Collapsed Rubble Concept Simulation
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[#9aa7b8]">
        Scripted animation showing the planned workflow — not real physics or proof of hardware
        performance.
      </p>

      {/* Active View Flags */}
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#cbd5e1]">
        <span>View: {fpvCamera ? 'Nose Camera (FPV)' : 'Corridor Overview'}</span>
        <span aria-hidden="true">·</span>
        <span>{thermalView ? 'Thermal palette' : 'Visible light'}</span>
      </div>

      {/* Live Concept Evidence Score */}
      <div className="mt-3 rounded border border-white/10 bg-[#121a24] p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-[#cbd5e1]">Live Evidence Score (Concept)</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-white">
            {activeEvidenceScore}
            <span className="text-xs font-normal text-[#8a97a8]"> / 100</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#ff7a1a] transition-all duration-150"
            style={{ width: `${activeEvidenceScore}%` }}
          />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 font-mono text-[10px] tabular-nums text-[#9aa7b8]">
          <div>RGB Cam: {telemetry.sample.cameraScore}%</div>
          <div>Thermal: +{telemetry.sample.thermalDeltaC.toFixed(1)}°C</div>
          <div>CO2: {telemetry.sample.co2Ppm} ppm</div>
          <div>Audio: {telemetry.sample.audioScore}%</div>
          {includeHeartbeat && (
            <div className="col-span-2 text-[#67e8f9]">
              Heartbeat (CONCEPT):{' '}
              {telemetry.sample.bpm
                ? `~${telemetry.sample.bpm} bpm detected`
                : 'Scanning (range/accuracy TBD)'}
            </div>
          )}
        </div>
      </div>

      {/* Rescue Priority Triage List */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#eef2f7]">Rescue Priority List</h4>
          <StatusBadge status="PLANNED" />
        </div>

        {/* Person A Card */}
        <div
          className={`rounded border p-2.5 ${
            personA.markerColor === 'green'
              ? 'border-[#22c55e]/55 bg-[#0e2017]'
              : 'border-[#f59e0b]/45 bg-[#1f180c]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">Person A · Mid Pocket</span>
            <span
              className={`font-mono text-[10px] font-semibold ${
                personA.markerColor === 'green' ? 'text-[#4ade80]' : 'text-[#fbbf24]'
              }`}
            >
              PRIORITY {personA.priorityRank}
            </span>
          </div>
          <p
            className={`mt-1 font-mono text-[11px] font-medium ${
              personA.markerColor === 'green' ? 'text-[#86efac]' : 'text-[#fcd34d]'
            }`}
          >
            {telemetry.personADetected ? personA.statusHeadline : 'Approaching pocket…'}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[#cbd5e1]">{personA.guidance}</p>
        </div>

        {/* Person B Card */}
        <div className="rounded border border-[#f59e0b]/50 bg-[#1f180c] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">Person B · Far Pocket</span>
            <span className="font-mono text-[10px] font-semibold text-[#fbbf24]">
              PRIORITY {personB.priorityRank}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] font-semibold text-[#fbbf24]">
            {NO_VITAL_SIGN_LABEL}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[#cbd5e1]">{personB.guidance}</p>
        </div>
      </div>

      {/* Priority Logic Legend */}
      <div className="mt-3 border-t border-white/10 pt-2.5 text-[11px] text-[#9aa7b8] space-y-1">
        <p className="font-medium text-[#e8eef5]">{OPERATOR_DECISION_NOTICE}</p>
        <p>
          1) Heartbeat + other evidence: rescue first. 2) Other evidence only: high priority,
          re-check. 3) No vital sign detected, unconfirmed: re-check later.
        </p>
      </div>
    </aside>
  );
};
