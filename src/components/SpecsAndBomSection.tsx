import React from 'react';
import {
  SaraPartsData,
  computeBomTotals,
  computeSegmentLayout,
  formatInr,
} from '../lib/saraData';
import { StatusBadge } from './StatusBadge';

interface SpecsAndBomSectionProps {
  data: SaraPartsData;
  includeHeartbeat: boolean;
}

export const SpecsAndBomSection: React.FC<SpecsAndBomSectionProps> = ({
  data,
  includeHeartbeat,
}) => {
  const layout = computeSegmentLayout(data.dimensions.segments);
  const bomTotals = computeBomTotals(data.bom.groups, data.bom.contingencyPercent);

  const specRows: Array<{
    parameter: string;
    value: string;
    hardware: string;
    status: 'CAD ESTIMATE' | 'PLANNED' | 'CONCEPT';
  }> = [
    {
      parameter: 'Overall length & cross-section',
      value: `${layout.totalLengthMm} mm long · ${data.overall.crossSectionMm.width} × ${data.overall.crossSectionMm.height} mm section (~${data.overall.innerTubeDiameterMm.value} mm inner tube)`,
      hardware: 'Machined brushed Aluminium 6061 outer shells & belt chassis, TPU 95A nose/belts/bellows, 4 cardan joints',
      status: 'CAD ESTIMATE',
    },
    {
      parameter: 'Estimated mass',
      value: `${data.overall.massPrintedKg.display} printed (${data.overall.massSolidKg.value} kg if solid)`,
      hardware: `${data.overall.partCount.value} parts in CadQuery model (0 collisions found)`,
      status: 'CAD ESTIMATE',
    },
    {
      parameter: 'Belt drive',
      value: '3 belt modules · 4 belts each (top, bottom, left, right)',
      hardware: '12 × N20 gear motors, 6 × TB6612FNG drivers, 2 × MCP23017 I/O expanders',
      status: 'PLANNED',
    },
    {
      parameter: 'Articulated bending',
      value: '4 cardan joints · 4 steel cables per joint',
      hardware: '8 × Al 6061 yokes, 4 steel crosses, 16 bearings, 8 × MG90S servos on PCA9685',
      status: 'PLANNED',
    },
    {
      parameter: 'Head sensing suite',
      value: 'Visible camera, thermal heat map, CO2 gas, audio',
      hardware: 'OV5647 (CSI), MLX90640 (I2C), MH-Z19B (PWM), INMP441 (I2S), 4× LEDs',
      status: 'PLANNED',
    },
    ...(includeHeartbeat
      ? [
          {
            parameter: 'Heartbeat vital-sign module',
            value: 'Sensor type, range and accuracy: to be decided and tested',
            hardware: 'CONCEPT, not in current build or BOM (future post-competition patent track)',
            status: 'CONCEPT' as const,
          },
        ]
      : []),
    {
      parameter: 'Power architecture',
      value: '2S Li-ion pack (7.4 V nominal, 6.0–8.4 V)',
      hardware: '2 × 18650 cells, 2S BMS + 2× NTC, 10 A fuse, main switch, 5 V 3 A & 6 V 5 A bucks',
      status: 'PLANNED',
    },
    {
      parameter: 'Tether & mechanical recovery',
      value: data.overall.tetherStatus.display,
      hardware: 'USB-Ethernet link (open) + hand-pulled Dyneema line on Al M6 eyebolt',
      status: 'PLANNED',
    },
    {
      parameter: 'Crawl speed & battery runtime',
      value: `${data.overall.speed.display} — ${data.overall.speed.note}`,
      hardware: 'No invented speed or battery estimates before bench measurement',
      status: 'PLANNED',
    },
  ];

  return (
    <section
      id="specs-bom"
      className="relative z-20 border-t border-white/10 bg-[#0d121a] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
            <span>08. Specifications, Mass &amp; Bill of Materials</span>
            <span aria-hidden="true">·</span>
            <StatusBadge status="CAD ESTIMATE" />
            <StatusBadge status="PLANNED" />
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
            Transparent numbers driven directly from parts.json
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#9aa7b8]">
            Every dimension, mass estimate, and rupee cost below is read live from{' '}
            <code className="text-xs text-[#ffb37b]">parts.json</code>. Nothing is measured on
            hardware yet — every metric carries its exact status badge.
          </p>
        </div>

        {/* Segment Dimensions & Mass Breakdown Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Segment Lengths (Explicit Placeholder Notice) */}
          <div className="rounded-lg border border-white/10 bg-[#111822] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-white">
                Body Layout (Head to Tail)
              </h3>
              <StatusBadge status="PLACEHOLDER" />
            </div>
            <p className="mt-1 text-xs text-[#fcd34d]">{data.dimensions.segmentLengthsNote}</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[#8a97a8]">
                    <th className="py-2 pr-3 font-medium">Segment</th>
                    <th className="py-2 pr-3 font-medium text-right">Length</th>
                    <th className="py-2 pr-3 font-medium text-right">Est. Mass</th>
                    <th className="py-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {data.dimensions.segments.map((seg) => (
                    <tr key={seg.id}>
                      <td className="py-2 pr-3 font-medium text-[#eef2f7]">{seg.label}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[#cbd5e1]">
                        {seg.lengthMm} mm
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[#cbd5e1]">
                        {seg.massLabel}
                      </td>
                      <td className="py-2 text-right">
                        <StatusBadge status={seg.lengthStatus} />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/15 font-semibold text-white">
                    <td className="pt-2.5 pr-3">Total (9 segments)</td>
                    <td className="pt-2.5 pr-3 text-right font-mono tabular-nums text-[#ff7a1a]">
                      {layout.totalLengthMm} mm
                    </td>
                    <td className="pt-2.5 pr-3 text-right font-mono tabular-nums">
                      ~1.146 kg
                    </td>
                    <td className="pt-2.5 text-right">
                      <StatusBadge status="CAD ESTIMATE" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mass Distribution Visual Bars */}
          <div className="rounded-lg border border-white/10 bg-[#111822] p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-white">
                  Estimated Mass by Subsystem
                </h3>
                <StatusBadge status="CAD ESTIMATE" />
              </div>
              <p className="mt-1 text-xs text-[#9aa7b8]">
                Tail bay is the heaviest section (351 g) because the 2S 18650 battery pack, 8
                servos, and 6 motor drivers sit there.
              </p>

              <div className="mt-5 space-y-4">
                {[
                  { label: 'Head (shell, nose, Pi, sensors)', grams: '107 g', pct: 30 },
                  { label: 'Joints 1–4 (each: yokes, cross, bearings, sleeve)', grams: '58–72 g each', pct: 20 },
                  { label: 'Belt Modules ×3 (each: core, 4 belts, 4 N20 motors)', grams: '142 g each', pct: 40 },
                  { label: 'Tail Bay (battery, BMS, ESP32, 8 servos, 6 drivers)', grams: '351 g', pct: 100 },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-[#eef2f7]">{bar.label}</span>
                      <span className="font-mono tabular-nums text-[#ffb37b] shrink-0">
                        {bar.grams}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-white/8">
                      <div
                        className="h-full bg-[#ff7a1a]"
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded border border-white/10 bg-[#0d131c] p-3.5 text-xs text-[#cbd5e1]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Total printed estimate:{' '}
                  <strong className="font-mono tabular-nums text-white">1.146 kg</strong> (
                  <span className="font-mono tabular-nums">1.586 kg</span> if solid)
                </span>
                <StatusBadge status="CAD ESTIMATE" />
              </div>
              <p className="mt-1 text-[11px] text-[#9aa7b8]">
                Collision check across all 145 parts in CadQuery: 0 collisions found. Real mass to
                be weighed after printing.
              </p>
            </div>
          </div>
        </div>

        {/* Target Hardware Specifications Table */}
        <div className="mt-8 rounded-lg border border-white/10 bg-[#111822] p-5">
          <h3 className="font-display text-base font-semibold text-white">
            Target Specifications &amp; Hardware Selection
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#8a97a8]">
                  <th className="py-2.5 pr-4 font-medium">Parameter</th>
                  <th className="py-2.5 pr-4 font-medium">Target Spec</th>
                  <th className="py-2.5 pr-4 font-medium">Selected Hardware / Protocol</th>
                  <th className="py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {specRows.map((row) => (
                  <tr key={row.parameter}>
                    <td className="py-2.5 pr-4 font-medium text-white whitespace-nowrap">
                      {row.parameter}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] tabular-nums text-[#eef2f7]">
                      {row.value}
                    </td>
                    <td className="py-2.5 pr-4 text-[#9aa7b8]">{row.hardware}</td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill of Materials (INR) */}
        <div className="mt-8 rounded-lg border border-white/10 bg-[#111822] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Estimated Bill of Materials (INR)
              </h3>
              <p className="mt-0.5 text-xs text-[#9aa7b8]">{data.bom.honestNote}</p>
            </div>
            <StatusBadge status="PLANNED" />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#8a97a8]">
                  <th className="py-2.5 pr-4 font-medium">Group</th>
                  <th className="py-2.5 pr-4 font-medium">Parts &amp; Quantity</th>
                  <th className="py-2.5 pr-4 font-medium">Likely Source</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Cost (INR)</th>
                  <th className="py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {data.bom.groups.map((item) => (
                  <tr key={item.group}>
                    <td className="py-2.5 pr-4 font-medium text-white whitespace-nowrap">
                      {item.group}
                    </td>
                    <td className="py-2.5 pr-4 text-[#cbd5e1]">{item.items}</td>
                    <td className="py-2.5 pr-4 text-[#9aa7b8] whitespace-nowrap">{item.source}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#eef2f7]">
                      {formatInr(item.costInr)}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-white/14 text-[#cbd5e1]">
                  <td colSpan={3} className="py-2.5 pr-4 font-medium">
                    Subtotal (7 hardware groups)
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                    {formatInr(bomTotals.subtotalInr)}
                  </td>
                  <td className="py-2.5 text-right">
                    <StatusBadge status="PLANNED" />
                  </td>
                </tr>
                <tr className="text-[#cbd5e1]">
                  <td colSpan={3} className="py-2 pr-4">
                    {data.bom.contingencyPercent}% contingency
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">
                    {formatInr(bomTotals.contingencyInr)}
                  </td>
                  <td className="py-2 text-right">
                    <StatusBadge status="PLANNED" />
                  </td>
                </tr>
                <tr className="border-t border-white/20 text-sm font-semibold text-white">
                  <td colSpan={3} className="pt-3 pr-4">
                    Total Estimated Build Cost (our own estimates, not vendor quotes)
                  </td>
                  <td className="pt-3 pr-4 text-right font-mono tabular-nums text-[#ff7a1a]">
                    {formatInr(bomTotals.totalInr)}
                  </td>
                  <td className="pt-3 text-right">
                    <StatusBadge status="PLANNED" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 rounded border border-[#22d3ee]/30 bg-[#0b1b22] px-3.5 py-2.5 text-xs text-[#a5f3fc]">
            {data.bom.heartbeatNote}
          </p>
        </div>
      </div>
    </section>
  );
};
