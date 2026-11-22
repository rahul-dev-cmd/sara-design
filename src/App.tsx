import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HeartPulse, SlidersHorizontal, ArrowDown } from 'lucide-react';
import {
  DEFAULT_PARTS_DATA,
  SaraPartsData,
  ViewMode,
  computeBomTotals,
  computeSegmentLayout,
  formatInr,
  getVisibleParts,
  loadPartsData,
} from './lib/saraData';
import {
  TELEMETRY_WINDOW_SEC,
  TelemetrySample,
  pushTelemetrySample,
  sampleConceptTelemetry,
  seedTelemetryHistory,
} from './lib/simTelemetry';
import { SaraViewport, SimTelemetry, StoryChapter } from './three/SaraViewport';
import { Navbar } from './components/Navbar';
import { StatusBadge } from './components/StatusBadge';
import { ViewportDock } from './components/ViewportDock';
import { PartInspectorCard } from './components/PartInspectorCard';
import { SimulationPanel } from './components/SimulationPanel';
import { LiveTelemetryPanel } from './components/LiveTelemetryPanel';
import { ElectronicsSection } from './components/ElectronicsSection';
import { SpecsAndBomSection } from './components/SpecsAndBomSection';
import { SafetyRisksRoadmapSection } from './components/SafetyRisksRoadmapSection';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const [data, setData] = useState<SaraPartsData>(DEFAULT_PARTS_DATA);
  const [loadProgress, setLoadProgress] = useState(25);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadingDismissed, setLoadingDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });

  const [reducedMotion, setReducedMotion] = useState(false);
  const [chapter, setChapter] = useState<StoryChapter>('hero');
  const [viewMode, setViewMode] = useState<ViewMode>('outer');
  const [explodeAmount, setExplodeAmount] = useState(0.75);
  const [cutawayAmount, setCutawayAmount] = useState(0);
  const [includeHeartbeat, setIncludeHeartbeat] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Concept simulation controls
  const [simPlaying, setSimPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simResetSignal, setSimResetSignal] = useState(0);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [thermalView, setThermalView] = useState(false);
  const [fpvCamera, setFpvCamera] = useState(false);
  const [telemetry, setTelemetry] = useState<SimTelemetry>(() => ({
    progress: 0.46,
    simTimeSec: 5.0,
    personADetected: true,
    personBDetected: false,
    personABpm: 74,
    servoAngleDeg: 0,
    beltRpmConcept: 26,
    sample: sampleConceptTelemetry(0.46, 5.0, false),
  }));
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetrySample[]>(() =>
    seedTelemetryHistory(0.46, 5.0, false, 1)
  );
  const lastRecordedSimTimeRef = useRef<number>(5.0);

  const [in3DStage, setIn3DStage] = useState(true);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Load parts.json dynamically so edits to public/parts.json update immediately
  // Only replace state if external parts.json differs from bundled defaults to avoid remounting WebGL
  useEffect(() => {
    let active = true;
    setLoadProgress(55);
    loadPartsData().then((loaded) => {
      if (!active) return;
      if (JSON.stringify(loaded) !== JSON.stringify(DEFAULT_PARTS_DATA)) {
        setData(loaded);
      }
      setLoadProgress(85);
    });
    return () => {
      active = false;
    };
  }, []);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Dismiss loading screen smoothly once scene is ready
  useEffect(() => {
    if (!sceneReady) return;
    setLoadProgress(100);
    if (loadingDismissed) return;
    const t = window.setTimeout(() => setLoadingDismissed(true), 280);
    return () => clearTimeout(t);
  }, [sceneReady, loadingDismissed]);

  // GSAP ScrollTrigger choreography binding scroll chapters to the sticky 3D stage
  useEffect(() => {
    const triggers: ScrollTrigger[] = [];
    const chapterIds: StoryChapter[] = ['hero', 'journey', 'explorer', 'joint', 'belt', 'simulate'];

    chapterIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 45%',
        onEnter: () => {
          setChapter(id);
          if (id === 'simulate') setViewMode('simulate');
          else if (id === 'joint') setViewMode((prev) => (prev === 'simulate' ? 'outer' : prev));
          else if (id === 'hero' || id === 'journey') {
            setViewMode((prev) => (prev === 'simulate' ? 'outer' : prev));
          }
        },
        onEnterBack: () => {
          setChapter(id);
          if (id === 'simulate') setViewMode('simulate');
          else if (id !== 'explorer') {
            setViewMode((prev) => (prev === 'simulate' ? 'outer' : prev));
          }
        },
      });
      triggers.push(st);
    });

    if (stageRef.current) {
      triggers.push(
        ScrollTrigger.create({
          trigger: stageRef.current,
          start: 'top top',
          end: 'bottom 35%',
          onEnter: () => setIn3DStage(true),
          onEnterBack: () => setIn3DStage(true),
          onLeave: () => setIn3DStage(false),
        })
      );
    }

    return () => {
      triggers.forEach((t) => t.kill());
    };
  }, []);

  // Keyboard shortcuts: 1 Outer, 2 Inner, 3 Explode, 4 Simulate, R Reset camera, H Heartbeat toggle, Space Play/Pause sim
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === '1') setViewMode('outer');
      else if (key === '2') setViewMode('inner');
      else if (key === '3') {
        setViewMode('explode');
        setExplodeAmount((v) => (v < 0.25 ? 0.75 : v));
      } else if (key === '4') {
        setViewMode('simulate');
        setChapter('simulate');
      } else if (key === 'r') {
        setResetCameraSignal((n) => n + 1);
      } else if (key === 'h') {
        setIncludeHeartbeat((v) => !v);
      } else if (key === ' ' && viewMode === 'simulate') {
        e.preventDefault();
        setSimPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode]);

  // Clear selection if heartbeat module is toggled off while selected
  useEffect(() => {
    if (!includeHeartbeat && selectedPartId === 'heartbeat_module') {
      setSelectedPartId(null);
    }
  }, [includeHeartbeat, selectedPartId]);

  const handleChangeMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'explode') {
      setExplodeAmount((v) => (v < 0.25 ? 0.78 : v));
    }
    if (mode === 'simulate') {
      setChapter('simulate');
      setSelectedPartId(null);
      setHoveredPartId(null);
    } else if (chapter === 'simulate') {
      setChapter('explorer');
    }
  }, [chapter]);

  const handleLaunchSimulation = useCallback(() => {
    setViewMode('simulate');
    setChapter('simulate');
    setSelectedPartId(null);
    document.getElementById('simulate')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  const handleViewportReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  // Re-evaluate existing 10s telemetry buffer when Heartbeat module is toggled so chart reflects toggle immediately
  useEffect(() => {
    setTelemetryHistory((prev) =>
      prev.map((pt) => {
        const updated = sampleConceptTelemetry(pt.progress, pt.timeSec, includeHeartbeat);
        return { ...updated, relSec: pt.relSec };
      })
    );
    setTelemetry((prev) => ({
      ...prev,
      sample: sampleConceptTelemetry(prev.progress, prev.simTimeSec, includeHeartbeat),
    }));
  }, [includeHeartbeat]);

  const handleSimTelemetry = useCallback((next: SimTelemetry) => {
    setTelemetry(next);
    if (next.simTimeSec > lastRecordedSimTimeRef.current + 0.05) {
      lastRecordedSimTimeRef.current = next.simTimeSec;
      setTelemetryHistory((prev) =>
        pushTelemetrySample(prev, next.sample, TELEMETRY_WINDOW_SEC)
      );
    }
  }, []);

  const visibleParts = useMemo(
    () => getVisibleParts(data.parts, includeHeartbeat),
    [data.parts, includeHeartbeat]
  );

  const selectedPart = useMemo(
    () => visibleParts.find((p) => p.id === selectedPartId) ?? null,
    [visibleParts, selectedPartId]
  );

  const hoveredPart = useMemo(
    () => visibleParts.find((p) => p.id === hoveredPartId) ?? null,
    [visibleParts, hoveredPartId]
  );

  const layout = useMemo(() => computeSegmentLayout(data.dimensions.segments), [data.dimensions.segments]);
  const bomTotals = useMemo(
    () => computeBomTotals(data.bom.groups, data.bom.contingencyPercent),
    [data.bom.groups, data.bom.contingencyPercent]
  );

  return (
    <div className="sara-grain min-h-screen bg-[#0b0f14] text-[#eef2f7]">
      {/* Loading Screen with Progress Bar */}
      {!loadingDismissed && (
        <div
          aria-label="Loading 3D studio"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b0f14] px-6 transition-opacity duration-300"
        >
          <div className="font-display text-2xl font-bold tracking-tight text-white">SARA</div>
          <p className="mt-1 text-xs text-[#9aa7b8]">
            Building procedural 3D hardware model from parts.json
          </p>
          <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[#ff7a1a] transition-all duration-200"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <span className="mt-2 font-mono text-[11px] tabular-nums text-[#8a97a8]">
            {loadProgress}%
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Navigation */}
      <Navbar onLaunchSimulation={handleLaunchSimulation} />

      {/* ===================================================================== */}
      {/* SCROLL-DRIVEN STICKY 3D PRODUCT STAGE (SECTIONS 1 – 6)                */}
      {/* ===================================================================== */}
      <main>
        <div ref={stageRef} className="relative">
          {/* Sticky Full-Viewport 3D Canvas */}
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            <SaraViewport
              data={data}
              viewMode={viewMode}
              chapter={chapter}
              explodeAmount={explodeAmount}
              cutawayAmount={cutawayAmount}
              includeHeartbeat={includeHeartbeat}
              selectedPartId={selectedPartId}
              hoveredPartId={hoveredPartId}
              simPlaying={simPlaying}
              simSpeed={simSpeed}
              simResetSignal={simResetSignal}
              resetCameraSignal={resetCameraSignal}
              thermalView={thermalView}
              fpvCamera={fpvCamera}
              reducedMotion={reducedMotion}
              onSelectPart={setSelectedPartId}
              onHoverPart={setHoveredPartId}
              onSimTelemetry={handleSimTelemetry}
              onReady={handleViewportReady}
            />
          </div>

          {/* Floating Part Inspector (Outer / Inner / Explode modes) */}
          {in3DStage && viewMode !== 'simulate' && (
            <PartInspectorCard
              part={selectedPart}
              hoveredPart={hoveredPart}
              onClearSelection={() => setSelectedPartId(null)}
            />
          )}

          {/* Floating Simulation Evidence Panel & Live 10s Telemetry Graph (Simulate mode only) */}
          {in3DStage && viewMode === 'simulate' && (
            <>
              <LiveTelemetryPanel
                history={telemetryHistory}
                includeHeartbeat={includeHeartbeat}
                simPlaying={simPlaying}
              />
              <SimulationPanel
                telemetry={telemetry}
                includeHeartbeat={includeHeartbeat}
                thermalView={thermalView}
                fpvCamera={fpvCamera}
              />
            </>
          )}

          {/* Unified Collapsible Bottom 3D Control Dock */}
          {in3DStage && (
            <ViewportDock
              viewMode={viewMode}
              explodeAmount={explodeAmount}
              cutawayAmount={cutawayAmount}
              includeHeartbeat={includeHeartbeat}
              simPlaying={simPlaying}
              simSpeed={simSpeed}
              thermalView={thermalView}
              fpvCamera={fpvCamera}
              dockCollapsed={dockCollapsed}
              onChangeMode={handleChangeMode}
              onChangeExplode={setExplodeAmount}
              onChangeCutaway={setCutawayAmount}
              onToggleHeartbeat={() => setIncludeHeartbeat((v) => !v)}
              onToggleSimPlaying={() => setSimPlaying((p) => !p)}
              onResetSim={() => {
                setSimResetSignal((n) => n + 1);
                setSimPlaying(true);
                lastRecordedSimTimeRef.current = 0;
                const initialSample = sampleConceptTelemetry(0.22, 0, includeHeartbeat);
                setTelemetryHistory([initialSample]);
              }}
              onChangeSimSpeed={setSimSpeed}
              onToggleThermal={() => setThermalView((v) => !v)}
              onToggleFpv={() => setFpvCamera((v) => !v)}
              onResetCamera={() => {
                setFpvCamera(false);
                setResetCameraSignal((n) => n + 1);
              }}
              onToggleCollapsed={() => setDockCollapsed((v) => !v)}
            />
          )}

          {/* Compact Top-Left Context Banner during Full-Stage Inspection (Inner / Explode / Simulate) */}
          {in3DStage && (viewMode === 'inner' || viewMode === 'explode' || viewMode === 'simulate') && (
            <div className="pointer-events-auto fixed top-18 left-4 z-30 max-w-[330px] rounded-lg border border-white/12 bg-[#0d131b]/92 px-3.5 py-2.5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge
                  status={
                    viewMode === 'simulate'
                      ? 'CONCEPT SIMULATION'
                      : viewMode === 'explode'
                        ? 'CAD ESTIMATE'
                        : 'PLANNED'
                  }
                />
                <button
                  type="button"
                  onClick={() => handleChangeMode('outer')}
                  className="text-[11px] font-medium text-[#9aa7b8] hover:text-white transition-colors cursor-pointer"
                >
                  Exit to Story
                </button>
              </div>
              <p className="mt-1.5 text-xs font-medium text-white">
                {viewMode === 'simulate'
                  ? 'Rubble Gap Concept Simulation (Scripted)'
                  : viewMode === 'explode'
                    ? 'Exploded Assembly — Click any part or label'
                    : 'Internal Cutaway View — Drag Cutaway slider'}
              </p>
              {includeHeartbeat && (
                <p className="mt-1 font-mono text-[10px] text-[#67e8f9]">
                  Heartbeat module ON · CONCEPT, not in current build
                </p>
              )}
            </div>
          )}

          {/* OVERLAID SCROLL STORY CHAPTERS (fades away cleanly in Inner/Explode/Simulate so 3D scene is 100% unobstructed!) */}
          <div
            className={`pointer-events-none relative z-10 -mt-[100vh] transition-opacity duration-250 ${
              viewMode === 'outer' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* SECTION 1: HERO */}
            <section
              id="hero"
              className="flex min-h-screen flex-col justify-end lg:justify-center px-5 pt-20 pb-28 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div
                  className={`max-w-[490px] rounded-lg border border-white/10 bg-[#0b0f14]/88 p-5 sm:p-6 ${
                    viewMode === 'outer' ? 'pointer-events-auto' : 'pointer-events-none'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#9aa7b8]">
                    <StatusBadge status="PLANNED" />
                    <span className="font-medium text-[#ffb37b]">{data.project.statusLabel}</span>
                  </div>

                  <div className="mt-2.5 text-xs text-[#9aa7b8]">
                    {data.project.award} ·{' '}
                    <span className="font-mono text-[#e8eef5]">{data.project.applicationId}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8a97a8]">
                    {data.project.track} · {data.project.subTheme}
                  </div>

                  <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-[42px] sm:leading-[1.12] [text-wrap:balance]">
                    {data.project.headline}
                  </h1>

                  <p className="mt-3.5 text-sm leading-relaxed text-[#cbd5e1] sm:text-[15px]">
                    <strong className="text-white">SARA</strong> ({data.project.fullName}) —{' '}
                    {data.project.oneLiner}
                  </p>

                  {/* Key At-a-Glance CAD Specs (every number status-badged!) */}
                  <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
                    <div>
                      <dt className="text-[11px] text-[#8a97a8]">Length</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                        {layout.totalLengthMm} mm
                      </dd>
                      <StatusBadge status="CAD ESTIMATE" className="mt-1" />
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#8a97a8]">Section</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                        101 × 101 mm
                      </dd>
                      <StatusBadge status="CAD ESTIMATE" className="mt-1" />
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#8a97a8]">Est. Mass</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                        ~1.15 kg
                      </dd>
                      <StatusBadge status="CAD ESTIMATE" className="mt-1" />
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#8a97a8]">Est. BOM</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#ff7a1a]">
                        {formatInr(bomTotals.totalInr)}
                      </dd>
                      <StatusBadge status="PLANNED" className="mt-1" />
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <a
                      href="#explorer"
                      onClick={() => handleChangeMode('explode')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#ff7a1a] px-4 py-2 text-xs font-semibold text-[#0b0f14] hover:bg-[#ff8e3c] transition-colors whitespace-nowrap"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Inspect Exploded 3D Model</span>
                    </a>
                    <a
                      href="#journey"
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/16 bg-[#131a24] px-3.5 py-2 text-xs font-medium text-[#e8eef5] hover:border-white/35 transition-colors whitespace-nowrap"
                    >
                      <span>Scroll Story</span>
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: PROBLEM & USER JOURNEY (BEFORE vs AFTER) */}
            <section
              id="journey"
              className="flex min-h-screen items-center px-5 py-24 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div className="pointer-events-auto max-w-[540px] rounded-lg border border-white/10 bg-[#0b0f14]/88 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-xs text-[#9aa7b8]">
                    <span>02. Problem &amp; User Journey</span>
                    <span aria-hidden="true">·</span>
                    <StatusBadge status="PLANNED" />
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl [text-wrap:balance]">
                    Narrow, curved rubble stops wheeled robots
                  </h2>
                  <p className="mt-2.5 text-xs leading-relaxed text-[#cbd5e1] sm:text-sm">
                    After an earthquake, building collapse, or mine accident, rescuers cannot see
                    into unstable voids. Sending a person in just to look is dangerous, and dust or
                    darkness hides whether anyone is inside.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded border border-white/10 bg-[#121821] p-3.5">
                      <h3 className="font-display text-xs font-semibold text-[#fbbf24]">
                        Before: without SARA
                      </h3>
                      <ol className="mt-2.5 space-y-1.5 text-xs text-[#cbd5e1]">
                        {data.userJourney.before.map((step, i) => (
                          <li key={step} className="flex gap-2">
                            <span className="font-mono text-[#8a97a8]">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="rounded border border-[#ff7a1a]/35 bg-[#19130e] p-3.5">
                      <h3 className="font-display text-xs font-semibold text-[#ffb37b]">
                        After: with SARA
                      </h3>
                      <ol className="mt-2.5 space-y-1.5 text-xs text-[#eef2f7]">
                        {data.userJourney.after.map((step, i) => (
                          <li key={step} className="flex gap-2">
                            <span className="font-mono text-[#ff7a1a]">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] leading-relaxed text-[#9aa7b8]">
                    {data.userJourney.honestNote}
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 3 & 4: INTERACTIVE 3D EXPLORER & PART PICKER */}
            <section
              id="explorer"
              className="flex min-h-screen items-center px-5 py-24 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div className="pointer-events-auto max-w-[400px] rounded-lg border border-white/10 bg-[#0b0f14]/88 p-5">
                  <div className="flex items-center gap-2 text-xs text-[#9aa7b8]">
                    <span>03. Interactive 3D Hardware Explorer</span>
                    <span aria-hidden="true">·</span>
                    <StatusBadge status="CAD ESTIMATE" />
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    145 parts, inspected from outside to core
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                    Drag to orbit, scroll to zoom, or switch{' '}
                    <strong className="text-white">Outer</strong>,{' '}
                    <strong className="text-white">Inner</strong>, and{' '}
                    <strong className="text-white">Explode</strong> in the bottom dock. Click any
                    part on the 3D model — or choose one below — to isolate it and open its spec
                    card.
                  </p>

                  {/* Heartbeat Concept Highlight Box */}
                  <div className="mt-3.5 rounded border border-[#22d3ee]/35 bg-[#0b1f26] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#67e8f9]">
                        <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
                        Heartbeat Sensor Module
                      </span>
                      <StatusBadge status="CONCEPT" />
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#a5f3fc]">
                      Future patent-track feature, not in current build or BOM. Sensor type, range
                      and accuracy: to be decided and tested.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIncludeHeartbeat((v) => !v)}
                      className="mt-2 rounded border border-[#22d3ee]/60 bg-[#0e2d38] px-2.5 py-1 text-[11px] font-medium text-[#67e8f9] hover:bg-[#133b49] transition-colors cursor-pointer"
                    >
                      {includeHeartbeat ? 'Remove heartbeat module' : 'Add heartbeat module to 3D views'}
                    </button>
                  </div>

                  {/* Quick Part Picker List (accessible for keyboard & mobile users) */}
                  <div className="mt-4">
                    <div className="text-[11px] font-medium text-[#8a97a8]">
                      Quick-inspect component ({visibleParts.length} sub-assemblies)
                    </div>
                    <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
                      {visibleParts.map((part) => {
                        const isSel = selectedPartId === part.id;
                        return (
                          <button
                            key={part.id}
                            type="button"
                            onClick={() => {
                              setSelectedPartId(isSel ? null : part.id);
                              if (
                                viewMode === 'outer' &&
                                ![
                                  'head_shell',
                                  'nose_cap',
                                  'joint_sleeve',
                                  'belt_module_core',
                                  'n20_motors',
                                  'tpu_belts',
                                  'wiring_harness',
                                  'tail_shell',
                                  'retrieval_anchor',
                                ].includes(part.id)
                              ) {
                                setViewMode('inner');
                              }
                            }}
                            className={`rounded border px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                              part.isHeartbeat
                                ? isSel
                                  ? 'border-[#22d3ee] bg-[#22d3ee] text-[#0b0f14] font-semibold'
                                  : 'border-[#22d3ee]/50 bg-[#0c2129] text-[#67e8f9] hover:border-[#22d3ee]'
                                : isSel
                                  ? 'border-[#ff7a1a] bg-[#ff7a1a] text-[#0b0f14] font-semibold'
                                  : 'border-white/12 bg-[#131a24] text-[#cbd5e1] hover:border-white/30 hover:text-white'
                            }`}
                          >
                            {part.name.split('(')[0].trim()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: CARDAN JOINT MECHANISM CLOSE-UP */}
            <section
              id="joint"
              className="flex min-h-screen items-center px-5 py-24 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div className="pointer-events-auto max-w-[440px] rounded-lg border border-white/10 bg-[#0b0f14]/88 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-xs text-[#9aa7b8]">
                    <span>05. Cardan Joint Mechanism</span>
                    <span aria-hidden="true">·</span>
                    <StatusBadge status="CAD ESTIMATE" />
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    Cable-pulled universal joint bending
                  </h2>
                  <p className="mt-2.5 text-xs leading-relaxed text-[#cbd5e1] sm:text-sm">
                    Each of SARA&apos;s 4 joints pairs{' '}
                    <strong className="text-white">two machined Aluminium 6061 yokes</strong> with a
                    dark steel cross, 4 miniature bearings, and a soft orange TPU 95A sleeve. Four
                    steel cables run back to 8 MG90S servos in the tail — pulling a cable bends the
                    joint smoothly around jagged obstacles.
                  </p>

                  {/* Live Animated Servo Pull Indicator */}
                  <div className="mt-4 flex items-center justify-between gap-4 rounded border border-white/10 bg-[#121923] p-3.5">
                    <div className="flex items-center gap-3">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 40 40"
                        aria-hidden="true"
                        className="shrink-0"
                      >
                        <rect
                          x="4"
                          y="10"
                          width="22"
                          height="20"
                          rx="3"
                          fill="#1d4f91"
                          stroke="#60a5fa"
                          strokeWidth="1.2"
                        />
                        <circle cx="24" cy="20" r="6" fill="#0b0f14" stroke="#cbd5e1" strokeWidth="1.2" />
                        <line
                          x1="24"
                          y1="20"
                          x2={24 + Math.cos((telemetry.servoAngleDeg * Math.PI) / 180) * 11}
                          y2={20 + Math.sin((telemetry.servoAngleDeg * Math.PI) / 180) * 11}
                          stroke="#ff7a1a"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          MG90S Tail Servo Pull (Concept)
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#ffb37b]">
                          Joint yaw {telemetry.servoAngleDeg >= 0 ? '+' : ''}
                          {telemetry.servoAngleDeg}° · 4 steel tendons
                        </div>
                      </div>
                    </div>
                    <StatusBadge status="PLANNED" />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 6: BELT DRIVE CLOSE-UP */}
            <section
              id="belt"
              className="flex min-h-screen items-center px-5 py-24 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div className="pointer-events-auto max-w-[440px] rounded-lg border border-white/10 bg-[#0b0f14]/88 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-xs text-[#9aa7b8]">
                    <span>06. 4-Sided Belt Traction Drive</span>
                    <span aria-hidden="true">·</span>
                    <StatusBadge status="CAD ESTIMATE" />
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    Twelve grippy TPU belts — traction even upside down
                  </h2>
                  <p className="mt-2.5 text-xs leading-relaxed text-[#cbd5e1] sm:text-sm">
                    Three belt modules carry{' '}
                    <strong className="text-white">4 orange TPU 95A treaded belts each</strong>{' '}
                    (top, bottom, left, right), driven individually by 12 compact N20 gear motors.
                    If rubble rolls the body onto its side or roof, SARA still keeps forward drive.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3.5 text-xs">
                    <div>
                      <div className="text-[#8a97a8]">Module mass</div>
                      <div className="mt-0.5 font-mono font-semibold text-white">142 g each</div>
                      <StatusBadge status="CAD ESTIMATE" className="mt-1" />
                    </div>
                    <div>
                      <div className="text-[#8a97a8]">Outer belt span</div>
                      <div className="mt-0.5 font-mono font-semibold text-white">101 × 101 mm</div>
                      <StatusBadge status="CAD ESTIMATE" className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 6B: CONCEPT SIMULATION CHAPTER */}
            <section
              id="simulate"
              className="flex min-h-screen items-start px-5 pt-20 pb-32 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[1380px]">
                <div className="pointer-events-auto max-w-[380px] rounded-lg border border-[#ff7a1a]/35 bg-[#0b0f14]/90 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="CONCEPT SIMULATION" />
                    <span className="font-mono text-[11px] text-[#9aa7b8]">NOT PHYSICS</span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold text-white">
                    Rubble Gap Crawl &amp; Vital-Sign Triage
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#cbd5e1]">
                    Watch SARA articulate beneath collapsed concrete slabs and rebar with nose LEDs
                    lit. Toggle <strong className="text-white">Thermal</strong>,{' '}
                    <strong className="text-white">Camera View</strong>, and{' '}
                    <strong className="text-[#67e8f9]">Include heartbeat module</strong> in the
                    bottom dock to compare priority triage between Person A and Person B.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* EDITORIAL ENGINEERING SECTIONS (SECTIONS 7 – 13)                      */}
        {/* ===================================================================== */}
        <ElectronicsSection data={data} includeHeartbeat={includeHeartbeat} />
        <SpecsAndBomSection data={data} includeHeartbeat={includeHeartbeat} />
        <SafetyRisksRoadmapSection data={data} />
      </main>
    </div>
  );
}
