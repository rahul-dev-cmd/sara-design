import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SaraPartsData } from '../lib/saraData';
import { StatusBadge } from './StatusBadge';

interface ElectronicsSectionProps {
  data: SaraPartsData;
  includeHeartbeat: boolean;
}

type WireFilter = 'all' | 'power' | 'data' | 'motor' | 'tether';
type SubsystemId = 'head' | 'traction' | 'tail' | 'operator' | null;

const SUBSYSTEM_DETAILS: Record<
  Exclude<SubsystemId, null>,
  { title: string; summary: string; connections: string[] }
> = {
  head: {
    title: 'Head Sensing Bay (Raspberry Pi Zero 2 W)',
    summary:
      'Streams live RGB video, thermal frames, audio, and CO2 readings up to the operator laptop. Talks to the tail ESP32 over UART.',
    connections: [
      'OV5647 RGB Camera → Pi CSI ribbon port',
      'MLX90640 Thermal Camera → Pi I2C (0x33, 3.3 V)',
      'INMP441 MEMS Mic → Pi I2S (GPIO18/19/20)',
      'MH-Z19B CO2 Sensor → PWM output routed to Tail ESP32 GPIO34',
      '4× Nose LEDs + logic-level MOSFET → Pi GPIO12 (5 V rail)',
    ],
  },
  traction: {
    title: 'Traction Modules M1, M2, M3 (12× N20 Motors)',
    summary:
      'Three belt modules with 4 orange TPU belts each (top, bottom, left, right). 24 motor wires run through the 12 mm body core hole back to the tail drivers.',
    connections: [
      'M1: 4× N20 motors (8 wires → TB1 & TB2)',
      'M2: 4× N20 motors (8 wires → TB3 & TB4)',
      'M3: 4× N20 motors (8 wires → TB5 & TB6)',
      '12 V-rated N20 motors run from 7.4 V rail (lower speed & torque — bench test planned)',
    ],
  },
  tail: {
    title: 'Tail Control & Power Bay (ESP32 + 2S Pack)',
    summary:
      'Runs low-level motion control, 8 steering servos, 6 dual motor drivers, and the independent 0.5 s safety watchdog so SARA can stop even if the Pi hangs.',
    connections: [
      '2× 18650 cells (7.4 V, 6.0–8.4 V) → 2S BMS + 2× NTC → 10 A fuse → Main switch',
      '5 V 3 A buck → Pi Zero 2 W, ESP32, CO2 sensor, LEDs',
      '6 V 5 A buck → PCA9685 V+ → 8× MG90S steering servos',
      'ESP32 GPIO27 (MOTOR_EN) → STBY of all 6 TB6612FNG drivers (off at boot)',
    ],
  },
  operator: {
    title: 'Operator Station (Laptop Browser Dashboard)',
    summary:
      'Runs AI detection and evidence scoring because the Pi Zero 2 W is too small. Sends joystick/WASD commands down and provides an instant STOP button.',
    connections: [
      'USB-Ethernet tether link (Tether design to be decided in Stage 3)',
      'Mechanical Dyneema retrieval line on hand reel (independent of power/data)',
      'Human operator makes all rescue decisions',
    ],
  },
};

export const ElectronicsSection: React.FC<ElectronicsSectionProps> = ({ data, includeHeartbeat }) => {
  const [wireFilter, setWireFilter] = useState<WireFilter>('all');
  const [activeSubsystem, setActiveSubsystem] = useState<SubsystemId>('tail');
  const [pinMapOpen, setPinMapOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(true);

  const wireOpacity = (kind: Exclude<WireFilter, 'all'>) =>
    wireFilter === 'all' || wireFilter === kind ? 1 : 0.14;

  return (
    <section
      id="electronics"
      className="relative z-20 border-t border-white/10 bg-[#0b0f14] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
              <span>07. Electronics &amp; System Architecture</span>
              <span aria-hidden="true">·</span>
              <StatusBadge status="PLANNED" />
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
              Safety loop separated from AI compute
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa7b8]">
              The Raspberry Pi Zero 2 W in the head streams camera, thermal, CO2, and audio data up
              to the laptop where AI detection runs. The ESP32 in the tail keeps the independent
              safety watchdog — if the link goes quiet for about 0.5 s, it cuts motor enable even if
              the Pi hangs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-[#121821] p-1">
            {(
              [
                ['all', 'All Wires'],
                ['power', 'Power Rails'],
                ['data', 'Data Buses'],
                ['motor', 'Motor Wires'],
                ['tether', 'Tether & Line'],
              ] as Array<[WireFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWireFilter(key)}
                className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  wireFilter === key
                    ? 'bg-[#ff7a1a] text-[#0b0f14]'
                    : 'text-[#cbd5e1] hover:bg-white/6 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Block-Level Wiring SVG Diagram */}
        <div className="mt-10 rounded-lg border border-white/10 bg-[#10161f] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4 text-xs text-[#9aa7b8]">
            <span>
              Interactive block-level wiring diagram — click any subsystem block to inspect routes
            </span>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-[#f87171]">
                <span className="h-0.5 w-4 bg-[#ef4444]" aria-hidden="true" /> Power (7.4V / 6V / 5V)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#60a5fa]">
                <span className="h-0.5 w-4 bg-[#3b82f6]" aria-hidden="true" /> Data (UART / I2C / CSI / I2S)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#4ade80]">
                <span className="h-0.5 w-4 bg-[#22c55e]" aria-hidden="true" /> 24 Motor Wires
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#cbd5e1]">
                <span className="h-0.5 w-4 border-t border-dashed border-[#cbd5e1]" aria-hidden="true" /> Tether (Stage 3 TBD)
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <svg
              viewBox="0 0 1060 410"
              role="img"
              aria-label="SARA Block-Level Wiring Diagram across Head, Traction Modules, Tail, and Operator Laptop"
              className="w-full min-w-[740px] h-auto"
            >
              {/* Zone Backgrounds */}
              <g
                onClick={() => setActiveSubsystem('head')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Inspect Head electronics block"
                onKeyDown={(e) => e.key === 'Enter' && setActiveSubsystem('head')}
              >
                <rect
                  x="16"
                  y="16"
                  width="225"
                  height="286"
                  rx="8"
                  fill="#131c27"
                  stroke={activeSubsystem === 'head' ? '#ff7a1a' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={activeSubsystem === 'head' ? 2 : 1}
                />
                <text x="30" y="38" fill="#9aa7b8" fontSize="11" fontWeight="600" letterSpacing="1">
                  HEAD BAY
                </text>
                {/* Pi Zero 2 W */}
                <rect x="122" y="54" width="106" height="145" rx="6" fill="#143326" stroke="#22c55e" strokeWidth="1" />
                <text x="175" y="106" textAnchor="middle" fill="#eef2f7" fontSize="12" fontWeight="600">
                  Raspberry Pi
                </text>
                <text x="175" y="123" textAnchor="middle" fill="#eef2f7" fontSize="12" fontWeight="600">
                  Zero 2 W
                </text>
                <text x="175" y="144" textAnchor="middle" fill="#9aa7b8" fontSize="10">
                  Video &amp; web server
                </text>

                {/* Head Sensors */}
                {[
                  { y: 54, t: 'OV5647 Cam', s: 'CSI' },
                  { y: 94, t: 'MLX90640', s: 'I2C 0x33' },
                  { y: 134, t: 'INMP441 Mic', s: 'I2S' },
                  { y: 174, t: '4× LEDs', s: 'MOSFET' },
                  { y: 214, t: 'MH-Z19B CO2', s: 'PWM out' },
                ].map((b) => (
                  <g key={b.t}>
                    <rect x="28" y={b.y} width="78" height="32" rx="4" fill="#192331" stroke="rgba(255,255,255,0.16)" />
                    <text x="67" y={b.y + 14} textAnchor="middle" fill="#eef2f7" fontSize="10" fontWeight="600">
                      {b.t}
                    </text>
                    <text x="67" y={b.y + 26} textAnchor="middle" fill="#8a97a8" fontSize="9">
                      {b.s}
                    </text>
                  </g>
                ))}

                {/* Optional Cyan Heartbeat Concept Module */}
                {includeHeartbeat && (
                  <g>
                    <rect
                      x="122"
                      y="214"
                      width="106"
                      height="68"
                      rx="5"
                      fill="#0b2630"
                      stroke="#22d3ee"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <text x="175" y="236" textAnchor="middle" fill="#67e8f9" fontSize="10" fontWeight="600">
                      Heartbeat Sensor
                    </text>
                    <text x="175" y="251" textAnchor="middle" fill="#a5f3fc" fontSize="9">
                      CONCEPT · Not in BOM
                    </text>
                    <text x="175" y="266" textAnchor="middle" fill="#67e8f9" fontSize="8.5">
                      Type &amp; range TBD
                    </text>
                  </g>
                )}
              </g>

              {/* TRACTION MODULES */}
              <g
                onClick={() => setActiveSubsystem('traction')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Inspect Traction Modules block"
                onKeyDown={(e) => e.key === 'Enter' && setActiveSubsystem('traction')}
              >
                <rect
                  x="257"
                  y="16"
                  width="225"
                  height="286"
                  rx="8"
                  fill="#131c27"
                  stroke={activeSubsystem === 'traction' ? '#ff7a1a' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={activeSubsystem === 'traction' ? 2 : 1}
                />
                <text x="271" y="38" fill="#9aa7b8" fontSize="11" fontWeight="600" letterSpacing="1">
                  TRACTION MODULES
                </text>
                {['M1', 'M2', 'M3'].map((m, idx) => (
                  <g key={m} transform={`translate(${271 + idx * 69}, 64)`}>
                    <rect width="60" height="194" rx="5" fill="#231a12" stroke="#ff7a1a" strokeOpacity="0.65" />
                    <text x="30" y="26" textAnchor="middle" fill="#ffb37b" fontSize="12" fontWeight="700">
                      {m}
                    </text>
                    <text x="30" y="54" textAnchor="middle" fill="#eef2f7" fontSize="10">
                      4 belts
                    </text>
                    <text x="30" y="70" textAnchor="middle" fill="#9aa7b8" fontSize="9">
                      L · R · T · B
                    </text>
                    <text x="30" y="106" textAnchor="middle" fill="#eef2f7" fontSize="10" fontWeight="600">
                      4× N20
                    </text>
                    <text x="30" y="120" textAnchor="middle" fill="#9aa7b8" fontSize="9">
                      motors
                    </text>
                    <text x="30" y="176" textAnchor="middle" fill="#4ade80" fontSize="9">
                      8 wires
                    </text>
                  </g>
                ))}
              </g>

              {/* TAIL BAY */}
              <g
                onClick={() => setActiveSubsystem('tail')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Inspect Tail electronics block"
                onKeyDown={(e) => e.key === 'Enter' && setActiveSubsystem('tail')}
              >
                <rect
                  x="498"
                  y="16"
                  width="350"
                  height="286"
                  rx="8"
                  fill="#131c27"
                  stroke={activeSubsystem === 'tail' ? '#ff7a1a' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={activeSubsystem === 'tail' ? 2 : 1}
                />
                <text x="512" y="38" fill="#9aa7b8" fontSize="11" fontWeight="600" letterSpacing="1">
                  TAIL BAY (POWER, CONTROL &amp; DRIVERS)
                </text>

                {/* Power Chain Top Row */}
                {[
                  { x: 512, w: 76, t: '2× 18650', s: '7.4 V nominal' },
                  { x: 596, w: 76, t: '2S BMS', s: '+ 2× NTC' },
                  { x: 680, w: 68, t: '10 A Fuse', s: 'Protection' },
                  { x: 756, w: 78, t: 'Main Switch', s: 'Cutoff' },
                ].map((p) => (
                  <g key={p.t}>
                    <rect x={p.x} y="52" width={p.w} height="40" rx="4" fill="#291618" stroke="#ef4444" strokeOpacity="0.7" />
                    <text x={p.x + p.w / 2} y="69" textAnchor="middle" fill="#fecaca" fontSize="10" fontWeight="600">
                      {p.t}
                    </text>
                    <text x={p.x + p.w / 2} y="83" textAnchor="middle" fill="#fca5a5" fontSize="8.5">
                      {p.s}
                    </text>
                  </g>
                ))}

                {/* Dual Bucks */}
                <rect x="512" y="114" width="76" height="44" rx="4" fill="#281b15" stroke="#f97316" strokeOpacity="0.65" />
                <text x="550" y="133" textAnchor="middle" fill="#fed7aa" fontSize="10" fontWeight="600">
                  Buck 5 V 3 A
                </text>
                <text x="550" y="147" textAnchor="middle" fill="#fdba74" fontSize="8.5">
                  Pi + ESP32
                </text>

                <rect x="600" y="114" width="84" height="44" rx="4" fill="#281b15" stroke="#f97316" strokeOpacity="0.65" />
                <text x="642" y="133" textAnchor="middle" fill="#fed7aa" fontSize="10" fontWeight="600">
                  Buck 6 V 5 A
                </text>
                <text x="642" y="147" textAnchor="middle" fill="#fdba74" fontSize="8.5">
                  Servos (risk)
                </text>

                {/* PCA9685 + 8x MG90S */}
                <rect x="696" y="114" width="138" height="44" rx="4" fill="#152438" stroke="#3b82f6" strokeOpacity="0.7" />
                <text x="765" y="133" textAnchor="middle" fill="#dbeafe" fontSize="10" fontWeight="600">
                  PCA9685 + 8× MG90S
                </text>
                <text x="765" y="147" textAnchor="middle" fill="#93c5fd" fontSize="8.5">
                  I2C servo driver &amp; cables
                </text>

                {/* ESP32 Controller */}
                <rect x="512" y="182" width="144" height="96" rx="6" fill="#143326" stroke="#22c55e" strokeWidth="1.2" />
                <text x="584" y="212" textAnchor="middle" fill="#eef2f7" fontSize="12" fontWeight="700">
                  ESP32 DevKit
                </text>
                <text x="584" y="230" textAnchor="middle" fill="#86efac" fontSize="10">
                  Motion control &amp;
                </text>
                <text x="584" y="244" textAnchor="middle" fill="#86efac" fontSize="10">
                  0.5 s safety watchdog
                </text>
                <text x="584" y="264" textAnchor="middle" fill="#9aa7b8" fontSize="8.5">
                  12 PWM · I2C · UART2
                </text>

                {/* MCP23017 + 6x TB6612FNG */}
                <rect x="670" y="182" width="164" height="42" rx="4" fill="#1d2236" stroke="#818cf8" strokeOpacity="0.7" />
                <text x="752" y="200" textAnchor="middle" fill="#e0e7ff" fontSize="10" fontWeight="600">
                  2× MCP23017 Expanders
                </text>
                <text x="752" y="214" textAnchor="middle" fill="#a5b4fc" fontSize="8.5">
                  24 direction pins (I2C)
                </text>

                <rect x="670" y="234" width="164" height="44" rx="4" fill="#2a1f16" stroke="#ff7a1a" strokeOpacity="0.7" />
                <text x="752" y="253" textAnchor="middle" fill="#ffedd5" fontSize="10" fontWeight="600">
                  6× TB6612FNG Drivers
                </text>
                <text x="752" y="267" textAnchor="middle" fill="#fdba74" fontSize="8.5">
                  12 outputs · Thermal shutdown
                </text>
              </g>

              {/* OPERATOR LAPTOP */}
              <g
                onClick={() => setActiveSubsystem('operator')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Inspect Operator Laptop block"
                onKeyDown={(e) => e.key === 'Enter' && setActiveSubsystem('operator')}
              >
                <rect
                  x="864"
                  y="16"
                  width="180"
                  height="286"
                  rx="8"
                  fill="#131c27"
                  stroke={activeSubsystem === 'operator' ? '#ff7a1a' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={activeSubsystem === 'operator' ? 2 : 1}
                />
                <text x="878" y="38" fill="#9aa7b8" fontSize="11" fontWeight="600" letterSpacing="1">
                  OPERATOR
                </text>
                <rect x="880" y="64" width="148" height="170" rx="6" fill="#21182c" stroke="#a78bfa" strokeOpacity="0.65" />
                <text x="954" y="96" textAnchor="middle" fill="#eef2f7" fontSize="12" fontWeight="700">
                  Laptop (Browser)
                </text>
                <text x="954" y="122" textAnchor="middle" fill="#cbd5e1" fontSize="10">
                  Live video &amp; thermal
                </text>
                <text x="954" y="138" textAnchor="middle" fill="#cbd5e1" fontSize="10">
                  CO2 + audio + score
                </text>
                <text x="954" y="164" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="600">
                  AI detection runs here
                </text>
                <text x="954" y="192" textAnchor="middle" fill="#f87171" fontSize="10" fontWeight="700">
                  Dashboard STOP button
                </text>
                <text x="954" y="216" textAnchor="middle" fill="#9aa7b8" fontSize="9">
                  Human decides rescue
                </text>

                {/* Mechanical Hand Reel */}
                <rect x="880" y="250" width="148" height="38" rx="4" fill="#18222e" stroke="#94a3b8" strokeOpacity="0.5" />
                <text x="954" y="267" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="600">
                  Dyneema Hand Reel
                </text>
                <text x="954" y="280" textAnchor="middle" fill="#9aa7b8" fontSize="8.5">
                  Mechanical recovery line
                </text>
              </g>

              {/* CENTRAL CABLE BUNDLE BUS BAR */}
              <rect
                x="16"
                y="324"
                width="832"
                height="46"
                rx="6"
                fill="#0e141c"
                stroke="rgba(255,255,255,0.14)"
              />
              <text x="432" y="344" textAnchor="middle" fill="#eef2f7" fontSize="11" fontWeight="600">
                BODY CORE CABLE BUNDLE (12 mm inner tunnel)
              </text>
              <text x="432" y="360" textAnchor="middle" fill="#9aa7b8" fontSize="10">
                5 V + GND · UART (Pi ↔ ESP32) · CO2 PWM · 24 N20 Motor Wires · Tether Data
              </text>

              {/* COLORED SIGNAL / POWER / MOTOR / TETHER WIRES */}
              {/* Power Wires (Red) */}
              <g opacity={wireOpacity('power')} stroke="#ef4444" strokeWidth="2.2" fill="none">
                <path d="M 550 158 L 550 324 M 155 199 L 155 324" />
                <path d="M 550 92 L 550 114 M 642 92 L 642 114" />
                <path d="M 588 72 L 596 72 M 672 72 L 680 72 M 748 72 L 756 72" />
              </g>

              {/* Data Wires (Blue) */}
              <g opacity={wireOpacity('data')} stroke="#3b82f6" strokeWidth="2" fill="none">
                <path d="M 106 70 L 122 70 M 106 110 L 122 110 M 106 150 L 122 150 M 106 190 L 122 190" />
                <path d="M 184 199 L 184 324 M 67 246 L 67 324 M 560 278 L 560 324" />
                <path d="M 656 205 L 670 205 M 630 182 L 730 158" />
              </g>

              {/* 24 Motor Wires (Green) */}
              <g opacity={wireOpacity('motor')} stroke="#22c55e" strokeWidth="2.2" fill="none">
                <path d="M 301 258 L 301 324 M 370 258 L 370 324 M 439 258 L 439 324 M 752 278 L 752 324" />
              </g>

              {/* Tether & Mechanical Retrieval Line */}
              <g opacity={wireOpacity('tether')} fill="none">
                <path
                  d="M 205 199 L 205 386 L 954 386 L 954 234"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text x="954" y="399" textAnchor="middle" fill="#cbd5e1" fontSize="9.5">
                  Tether design to be decided in Stage 3
                </text>
                <path
                  d="M 848 269 L 880 269"
                  stroke="#94a3b8"
                  strokeWidth="2.4"
                />
              </g>
            </svg>
          </div>

          {/* Active Subsystem Readout */}
          {activeSubsystem && (
            <div className="mt-5 rounded-md border border-white/10 bg-[#141c27] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  {SUBSYSTEM_DETAILS[activeSubsystem].title}
                </h3>
                <StatusBadge status="PLANNED" />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#cbd5e1]">
                {SUBSYSTEM_DETAILS[activeSubsystem].summary}
              </p>
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-xs text-[#9aa7b8] sm:grid-cols-2">
                {SUBSYSTEM_DETAILS[activeSubsystem].connections.map((item) => (
                  <li key={item} className="font-mono text-[11px]">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Expandable Panels: Current Budget & Pin Map */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Expandable Panel 1: Current Budget */}
          <div className="rounded-lg border border-white/10 bg-[#10161f]">
            <button
              type="button"
              onClick={() => setBudgetOpen((v) => !v)}
              aria-expanded={budgetOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-white">
                    Current Budget (Datasheet Values, Not Measured)
                  </span>
                  <StatusBadge status="DATASHEET" />
                </div>
                <p className="mt-0.5 text-xs text-[#9aa7b8]">
                  7.4 V motors, 5 V compute/sensors, 6 V steering servos
                </p>
              </div>
              {budgetOpen ? (
                <ChevronUp className="h-4 w-4 text-[#9aa7b8] shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#9aa7b8] shrink-0" aria-hidden="true" />
              )}
            </button>

            {budgetOpen && (
              <div className="border-t border-white/8 px-5 py-4 space-y-4">
                {data.currentBudget.map((rail) => {
                  const pct = Math.min(100, Math.round((rail.estimatedPeakA / rail.limitA) * 100));
                  const barColor =
                    rail.riskLevel === 'warning'
                      ? 'bg-[#f59e0b]'
                      : rail.riskLevel === 'caution'
                        ? 'bg-[#ff7a1a]'
                        : 'bg-[#22c55e]';
                  return (
                    <div key={rail.rail} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{rail.rail}</span>
                          <span className="text-[11px] text-[#9aa7b8]">({rail.converter})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-[#eef2f7]">
                            {rail.typicalRange}
                          </span>
                          <StatusBadge status={rail.status} />
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-[#9aa7b8]">{rail.breakdown}</p>
                      <p
                        className={`text-[11px] font-medium ${
                          rail.riskLevel === 'warning' ? 'text-[#fbbf24]' : 'text-[#cbd5e1]'
                        }`}
                      >
                        {rail.assessment}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expandable Panel 2: Pin Map Summary */}
          <div className="rounded-lg border border-white/10 bg-[#10161f]">
            <button
              type="button"
              onClick={() => setPinMapOpen((v) => !v)}
              aria-expanded={pinMapOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-white">
                    Pin Map Summary (ESP32 &amp; Pi Zero 2 W)
                  </span>
                  <StatusBadge status="PLANNED" />
                </div>
                <p className="mt-0.5 text-xs text-[#9aa7b8]">
                  KiCad block-level schematic passes ERC (0 errors, 0 warnings); PCB/DRC not done
                </p>
              </div>
              {pinMapOpen ? (
                <ChevronUp className="h-4 w-4 text-[#9aa7b8] shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#9aa7b8] shrink-0" aria-hidden="true" />
              )}
            </button>

            {pinMapOpen && (
              <div className="border-t border-white/8 px-5 py-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-white">ESP32 DevKit Assignment</h4>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/10 text-[#8a97a8]">
                          <th className="py-1.5 pr-3 font-medium">Function</th>
                          <th className="py-1.5 pr-3 font-medium">GPIO</th>
                          <th className="py-1.5 font-medium">Connects to</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {data.pinMap.esp32.map((row) => (
                          <tr key={row.func}>
                            <td className="py-1.5 pr-3 font-medium text-[#eef2f7] whitespace-nowrap">
                              {row.func}
                            </td>
                            <td className="py-1.5 pr-3 font-mono text-[#ffb37b]">{row.gpio}</td>
                            <td className="py-1.5 text-[#9aa7b8]">{row.connectsTo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white">Raspberry Pi Zero 2 W</h4>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/10 text-[#8a97a8]">
                          <th className="py-1.5 pr-3 font-medium">Pin / Port</th>
                          <th className="py-1.5 font-medium">Connects to</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {data.pinMap.piZero.map((row) => (
                          <tr key={row.pin}>
                            <td className="py-1.5 pr-3 font-mono text-[#cbd5e1] whitespace-nowrap">
                              {row.pin}
                            </td>
                            <td className="py-1.5 text-[#9aa7b8]">{row.connectsTo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-[#9aa7b8]">{data.pinMap.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
