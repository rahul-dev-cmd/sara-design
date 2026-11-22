import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  NO_VITAL_SIGN_LABEL,
  SaraPartsData,
  ViewMode,
  computeSegmentLayout,
} from '../lib/saraData';
import { TelemetrySample, sampleConceptTelemetry } from '../lib/simTelemetry';
import { createProceduralTextures } from './textures';
import { SaraRobotRig, buildSaraRobot } from './buildSaraRobot';
import { RubbleSimulationRig, buildRubbleScene } from './buildRubbleScene';

export type StoryChapter = 'hero' | 'journey' | 'explorer' | 'joint' | 'belt' | 'simulate';

export interface SimTelemetry {
  progress: number; // 0..1
  simTimeSec: number;
  personADetected: boolean;
  personBDetected: boolean;
  personABpm: number;
  servoAngleDeg: number;
  beltRpmConcept: number;
  sample: TelemetrySample;
}

interface ProjectedCallout {
  partId: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

interface VictimOverlayPos {
  x: number;
  y: number;
  visible: boolean;
}

export interface SaraViewportProps {
  data: SaraPartsData;
  viewMode: ViewMode;
  chapter: StoryChapter;
  explodeAmount: number;
  cutawayAmount: number;
  includeHeartbeat: boolean;
  selectedPartId: string | null;
  hoveredPartId: string | null;
  simPlaying: boolean;
  simSpeed: number;
  simResetSignal: number;
  resetCameraSignal: number;
  thermalView: boolean;
  fpvCamera: boolean;
  reducedMotion: boolean;
  onSelectPart: (partId: string | null) => void;
  onHoverPart: (partId: string | null) => void;
  onSimTelemetry: (telemetry: SimTelemetry) => void;
  onReady: () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function getCameraPreset(
  chapter: StoryChapter,
  viewMode: ViewMode,
  explodeAmount: number
): { pos: [number, number, number]; target: [number, number, number] } {
  if (viewMode === 'simulate' || chapter === 'simulate') {
    return { pos: [2.2, 3.85, 10.2], target: [-0.35, 0.16, -0.15] };
  }
  if (viewMode === 'explode') {
    const dist = 7.6 + explodeAmount * 3.4;
    return { pos: [0.0, 2.15 + explodeAmount * 0.55, dist], target: [0, 0.05, 0] };
  }
  if (viewMode === 'inner') {
    return { pos: [-1.2, 2.05, 6.2], target: [0, 0, 0] };
  }
  if (chapter === 'joint') {
    return { pos: [-1.5, 0.95, 2.45], target: [-2.12, 0.0, 0] };
  }
  if (chapter === 'belt') {
    return { pos: [0.55, 0.95, 2.55], target: [0.0, 0.0, 0] };
  }
  if (chapter === 'journey') {
    return { pos: [-3.8, 1.75, 5.4], target: [-1.35, -0.05, 0] };
  }
  if (chapter === 'explorer') {
    return { pos: [-0.9, 2.05, 6.4], target: [-0.65, 0, 0] };
  }
  // Hero default: frame SARA in the open right area on desktop so Hero copy never blocks the robot
  const isWide = typeof window !== 'undefined' && window.innerWidth >= 1024;
  return isWide
    ? { pos: [-4.6, 2.1, 6.3], target: [-1.75, -0.05, 0] }
    : { pos: [-3.2, 2.2, 7.6], target: [0.0, -0.65, 0] };
}

export const SaraViewport: React.FC<SaraViewportProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [webglError, setWebglError] = useState(false);
  const [callouts, setCallouts] = useState<ProjectedCallout[]>([]);
  const [victimMarkers, setVictimMarkers] = useState<{ a: VictimOverlayPos; b: VictimOverlayPos }>({
    a: { x: 0, y: 0, visible: false },
    b: { x: 0, y: 0, visible: false },
  });

  // Trigger camera glide when chapter, mode, or reset signal changes
  const initialPreset = getCameraPreset(props.chapter, props.viewMode, props.explodeAmount);
  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(...initialPreset.pos),
    target: new THREE.Vector3(...initialPreset.target),
    active: false,
  });

  // Start simulation mid-corridor approaching Person A with the full 9-segment aluminium body clearly visible
  const simProgressRef = useRef(0.56);
  const simClockRef = useRef(5.0);

  useEffect(() => {
    const preset = getCameraPreset(props.chapter, props.viewMode, props.explodeAmount);
    cameraGoalRef.current.pos.set(...preset.pos);
    cameraGoalRef.current.target.set(...preset.target);
    cameraGoalRef.current.active = true;
  }, [props.chapter, props.viewMode, props.resetCameraSignal]);

  useEffect(() => {
    if (props.simResetSignal > 0) {
      simProgressRef.current = 0.28;
      simClockRef.current = 0;
    }
  }, [props.simResetSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError(true);
      propsRef.current.onReady();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0f14');
    scene.fog = new THREE.FogExp2('#0b0f14', 0.022);

    // Mandatory RoomEnvironment studio reflections on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
      0.08,
      120
    );
    const startPreset = getCameraPreset(
      propsRef.current.chapter,
      propsRef.current.viewMode,
      propsRef.current.explodeAmount
    );
    camera.position.set(...startPreset.pos);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.35;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.target.set(...startPreset.target);

    // Cancel scripted camera transition immediately when user interacts
    const onControlStart = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-point warm/cool studio lighting rig (<= 1 shadow caster) calibrated for brushed Aluminium 6061
    const hemiLight = new THREE.HemisphereLight(0xb8d4f2, 0x161d26, 0.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e4, 1.95);
    keyLight.position.set(5.5, 7.5, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x88b4e8, 1.15);
    rimLight.position.set(-6.0, 3.2, -5.5);
    scene.add(rimLight);

    const accentRim = new THREE.DirectionalLight(0xff9c4a, 0.45);
    accentRim.position.set(2.5, -2.5, -4.5);
    scene.add(accentRim);

    // Studio softbox highlight on GPU devices
    let rectLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      rectLight = new THREE.RectAreaLight(0xffffff, 2.2, 6, 2.2);
      rectLight.position.set(0, 4.6, 2.4);
      rectLight.lookAt(0, 0, 0);
      scene.add(rectLight);
    }

    // Procedural PBR textures
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const textures = createProceduralTextures(maxAniso);

    // Studio floor contact-shadow grounding plane + subtle hairline reference ring
    const studioGroundGroup = new THREE.Group();
    const contactShadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 4.2),
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      })
    );
    contactShadowPlane.rotation.x = -Math.PI / 2;
    contactShadowPlane.position.y = -0.64;
    studioGroundGroup.add(contactShadowPlane);

    const studioFloorGrid = new THREE.GridHelper(16, 24, 0x263242, 0x151c26);
    studioFloorGrid.position.y = -0.66;
    const gridMat = studioFloorGrid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.35;
    studioGroundGroup.add(studioFloorGrid);
    scene.add(studioGroundGroup);

    // Build SARA 3D procedural robot directly from parts.json
    const robot: SaraRobotRig = buildSaraRobot(propsRef.current.data, textures, isSoftwareGl);
    scene.add(robot.root);

    // Build collapsed-building rubble corridor for Concept Simulation
    const rubble: RubbleSimulationRig = buildRubbleScene(textures);
    scene.add(rubble.group);

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Scratch reusable math objects (zero GC in render loop!)
    const _raycaster = new THREE.Raycaster();
    const _pointerNdc = new THREE.Vector2();
    const _vecA = new THREE.Vector3();
    const _vecB = new THREE.Vector3();
    const _vecC = new THREE.Vector3();
    const _quatA = new THREE.Quaternion();
    const _matA = new THREE.Matrix4();
    const _up = new THREE.Vector3(0, 1, 0);

    const layout = computeSegmentLayout(propsRef.current.data.dimensions.segments);

    // Pointer hover & click part inspection (throttled raycasting against robot.interactables only)
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const pickPartAt = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointerNdc, camera);
      const hits = _raycaster.intersectObjects(robot.interactables, false);
      for (const hit of hits) {
        if (!hit.object.visible) continue;
        // Skip hidden parent branches
        let hidden = false;
        let cur: THREE.Object3D | null = hit.object;
        while (cur) {
          if (!cur.visible) {
            hidden = true;
            break;
          }
          cur = cur.parent;
        }
        if (hidden) continue;
        const pid = hit.object.userData.partId as string | undefined;
        if (pid) return pid;
      }
      return null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 55) return;
      lastHoverCheck = now;
      if (propsRef.current.viewMode === 'simulate') return;
      const pid = pickPartAt(e.clientX, e.clientY);
      canvas.style.cursor = pid ? 'pointer' : 'grab';
      if (pid !== propsRef.current.hoveredPartId) {
        propsRef.current.onHoverPart(pid);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // User orbited, not clicked
      if (propsRef.current.viewMode === 'simulate') return;
      const pid = pickPartAt(e.clientX, e.clientY);
      if (pid) {
        propsRef.current.onSelectPart(pid === propsRef.current.selectedPartId ? null : pid);
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Notify loading screen that 3D scene is ready
    propsRef.current.onReady();

    // Animation loop with strict software-WebGL afterDraw() pacing
    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let beltPhase = 0;
    let lastHudPush = 0;
    let prevThermal = false;
    let prevHeartbeat = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 8);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 85);
          }
        };
        frameId = window.setTimeout(poll, 8);
      } else {
        frameId = window.setTimeout(cb, 95);
      }
    };

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(0.08, Math.max(0.001, rawDt));
      lastTime = now;

      const p = propsRef.current;
      const motionMult = p.reducedMotion ? 0 : 1;
      elapsed += dt * motionMult;

      // Sync heartbeat toggle
      if (p.includeHeartbeat !== prevHeartbeat) {
        robot.setHeartbeatVisible(p.includeHeartbeat);
        prevHeartbeat = p.includeHeartbeat;
      }

      // Sync thermal view toggle (active only in Simulate mode)
      const activeThermal = p.viewMode === 'simulate' && p.thermalView;
      if (activeThermal !== prevThermal) {
        robot.setThermalMode(activeThermal);
        rubble.setThermalMode(activeThermal);
        scene.background = new THREE.Color(activeThermal ? '#0c0824' : '#0b0f14');
        (scene.fog as THREE.FogExp2).color.set(activeThermal ? '#0c0824' : '#0b0f14');
        prevThermal = activeThermal;
      }

      const isSim = p.viewMode === 'simulate';
      rubble.group.visible = isSim;
      studioGroundGroup.visible = !isSim;

      // Adjust lighting mood between clean studio and dim rubble rescue corridor
      if (isSim) {
        keyLight.intensity = activeThermal ? 0.65 : 1.15;
        hemiLight.intensity = activeThermal ? 0.85 : 0.44;
        rimLight.intensity = activeThermal ? 0.5 : 0.78;
        robot.setLedIntensity(activeThermal ? 0.2 : 9.2);
      } else {
        keyLight.intensity = 1.95;
        hemiLight.intensity = 0.68;
        rimLight.intensity = 1.25;
        robot.setLedIntensity(0.42);
      }

      // Apply outer/inner/explode/simulate geometry transforms
      robot.setViewMode(p.viewMode, p.explodeAmount, p.cutawayAmount, p.selectedPartId);

      let servoAngleDeg = 0;
      let beltRpmConcept = 0;

      if (isSim) {
        // Reset hero rotation so spline drives world orientation cleanly
        robot.root.rotation.set(0, 0, 0);
        robot.root.position.set(0, 0, 0);

        // Advance SARA along the rubble spline when playing
        if (p.simPlaying) {
          simClockRef.current += dt;
          simProgressRef.current += dt * 0.048 * p.simSpeed;
          if (simProgressRef.current > 0.96) {
            simProgressRef.current = 0.28;
          }
          beltPhase += dt * 0.72 * p.simSpeed;
          beltRpmConcept = Math.round(28 * p.simSpeed);
        }
        robot.advanceBelts(beltPhase);

        // Place all 9 segments sequentially along the 3D rubble spline with exact CAD spacing
        // (extrapolating smoothly along entry tangent when rawU < 0 so segments NEVER bunch up!)
        const curveLen = rubble.crawlCurve.getLength();
        const headS = Math.min(0.96, Math.max(0.18, simProgressRef.current));
        const jointAngles: Array<{ yaw: number; pitch: number }> = [];
        let tailU = 0.02;

        layout.placements.forEach((seg, idx) => {
          const distFromHead = seg.centerMm / 100; // units behind head nose
          const rawU = headS - distFromHead / curveLen;

          if (rawU >= 0) {
            const u = Math.min(0.995, rawU);
            rubble.crawlCurve.getPointAt(u, _vecA);
            rubble.crawlCurve.getTangentAt(u, _vecB);
          } else {
            // Smooth straight approach outside the rubble entrance before entering the gap
            rubble.crawlCurve.getPointAt(0, _vecA);
            rubble.crawlCurve.getTangentAt(0, _vecB);
            _vecA.addScaledVector(_vecB, rawU * curveLen);
          }

          if (idx === layout.placements.length - 1) {
            tailU = Math.max(0.01, Math.min(0.95, rawU));
          }

          const segGroup = robot.segmentGroups[idx];
          segGroup.position.copy(_vecA);
          // Robot local -X points forward along travel direction; apply smooth yaw + terrain pitch
          const yaw = Math.atan2(_vecB.z, -_vecB.x);
          const horizLen = Math.max(0.0001, Math.hypot(_vecB.x, _vecB.z));
          const pitch = THREE.MathUtils.clamp(Math.atan2(_vecB.y, horizLen), -0.32, 0.32);
          segGroup.rotation.order = 'YXZ';
          segGroup.rotation.set(0, yaw, -pitch);

          if (seg.type === 'joint') {
            if (rawU > 0.03 && rawU < 0.97) {
              const uNext = Math.min(0.995, rawU + 0.032);
              const uPrev = Math.max(0.005, rawU - 0.032);
              rubble.crawlCurve.getTangentAt(uNext, _vecB);
              rubble.crawlCurve.getTangentAt(uPrev, _vecC);
              const deltaYaw = Math.atan2(_vecB.z, -_vecB.x) - Math.atan2(_vecC.z, -_vecC.x);
              const deltaPitch = _vecB.y - _vecC.y;
              jointAngles.push({
                yaw: THREE.MathUtils.clamp(deltaYaw * 1.45, -0.5, 0.5),
                pitch: THREE.MathUtils.clamp(deltaPitch * 1.1, -0.28, 0.28),
              });
            } else {
              jointAngles.push({ yaw: 0, pitch: 0 });
            }
          }
        });

        robot.setJointAngles(jointAngles);
        rubble.updateTrailingLines(tailU);
        rubble.update(elapsed, p.includeHeartbeat);

        // Camera: First-Person Nose Camera vs. Full-Body Rescue Corridor Follow Camera
        if (p.fpvCamera) {
          robot.cameraMountNode.getWorldPosition(_vecA);
          const headYaw = robot.headGroup.rotation.y;
          _vecB.set(-Math.cos(headYaw), -0.06, Math.sin(headYaw)).normalize();
          camera.position.copy(_vecA);
          _vecC.copy(_vecA).addScaledVector(_vecB, 3.0);
          camera.lookAt(_vecC);
        } else if (cameraGoalRef.current.active) {
          // Frame mid-body (Module 1 / Joint 2) from elevated wide angle so the ENTIRE 9-segment robot,
          // nose LED beam, trailing tether, and sheltered Person A sit cleanly between left/right HUD cards
          const midSeg = robot.segmentGroups[3] ?? robot.headGroup;
          midSeg.getWorldPosition(_vecA);
          _vecB.set(_vecA.x + 0.75, 3.85, _vecA.z + 10.1);
          _vecC.set(_vecA.x - 0.55, 0.18, _vecA.z - 0.15);
          const damp = isSoftwareGl ? 0.65 : 1 - Math.exp(-3.4 * dt);
          camera.position.lerp(_vecB, damp);
          controls.target.lerp(_vecC, damp);
        }
      } else {
        // Studio showcase modes (Hero, Journey, Explorer, Joint close-up, Belt close-up)
        if (p.chapter === 'hero' && p.viewMode === 'outer' && !p.selectedPartId) {
          robot.root.rotation.y = Math.sin(elapsed * 0.35) * 0.28;
        } else {
          robot.root.rotation.y = THREE.MathUtils.damp(robot.root.rotation.y, 0, 5, dt);
        }

        // Joint close-up live animation: bend Joint 1 & 2 smoothly and pull cables!
        if (p.chapter === 'joint') {
          const bendYaw = Math.sin(elapsed * 1.8) * 0.42;
          const bendPitch = Math.cos(elapsed * 1.2) * 0.24;
          servoAngleDeg = Math.round(bendYaw * 57.3);
          robot.setJointAngles([
            { yaw: bendYaw, pitch: bendPitch },
            { yaw: -bendYaw * 0.5, pitch: bendPitch * 0.4 },
            { yaw: 0, pitch: 0 },
            { yaw: 0, pitch: 0 },
          ]);
          // Expose cardan mechanism clearly during Joint chapter
          if (p.viewMode === 'outer') {
            robot.joints[0].sleeveMesh.position.y = 0.52;
          }
        } else {
          const gentle = p.viewMode === 'explode' ? 0 : Math.sin(elapsed * 0.9) * 0.06;
          robot.setJointAngles([
            { yaw: gentle, pitch: 0 },
            { yaw: -gentle, pitch: 0 },
            { yaw: gentle * 0.7, pitch: 0 },
            { yaw: 0, pitch: 0 },
          ]);
        }

        // Belt close-up live drive animation
        if (p.chapter === 'belt') {
          beltPhase += dt * 0.65 * motionMult;
          beltRpmConcept = 26;
          robot.advanceBelts(beltPhase);
        } else if (p.chapter === 'journey') {
          beltPhase += dt * 0.28 * motionMult;
          robot.advanceBelts(beltPhase);
        }

        // Smooth camera glide to preset until arrival or user interaction
        if (cameraGoalRef.current.active) {
          const damp = isSoftwareGl ? 0.55 : 1 - Math.exp(-4.5 * dt);
          camera.position.lerp(cameraGoalRef.current.pos, damp);
          controls.target.lerp(cameraGoalRef.current.target, damp);
          if (
            camera.position.distanceTo(cameraGoalRef.current.pos) < 0.04 &&
            controls.target.distanceTo(cameraGoalRef.current.target) < 0.04
          ) {
            cameraGoalRef.current.active = false;
          }
        }
      }

      if (!isSim || !p.fpvCamera) {
        controls.update();
      }

      renderer.render(scene, camera);

      // Throttled HUD & 2D projection updates (~5–6 Hz so React & Recharts stay smooth)
      if (now - lastHudPush > 175) {
        lastHudPush = now;
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;

        if (p.viewMode === 'explode' && p.explodeAmount > 0.12) {
          const projected: ProjectedCallout[] = robot.calloutAnchors
            .filter((a) => p.includeHeartbeat || a.partId !== 'heartbeat_module')
            .map((a) => {
              a.object.updateWorldMatrix(true, false);
              _vecA.copy(a.localOffset).applyMatrix4(a.object.matrixWorld);
              _vecA.project(camera);
              return {
                partId: a.partId,
                label: a.label,
                x: (_vecA.x * 0.5 + 0.5) * w,
                y: (-_vecA.y * 0.5 + 0.5) * h,
                visible: _vecA.z > -1 && _vecA.z < 1,
              };
            });
          setCallouts(projected);
        } else {
          setCallouts((prev) => (prev.length ? [] : prev));
        }

        if (isSim) {
          rubble.personAAnchor.getWorldPosition(_vecA);
          _vecA.y += 1.05;
          _vecA.project(camera);
          const aPos: VictimOverlayPos = {
            x: (_vecA.x * 0.5 + 0.5) * w,
            y: (-_vecA.y * 0.5 + 0.5) * h,
            visible: _vecA.z > -1 && _vecA.z < 1,
          };

          rubble.personBAnchor.getWorldPosition(_vecB);
          _vecB.y += 1.05;
          _vecB.project(camera);
          const bPos: VictimOverlayPos = {
            x: (_vecB.x * 0.5 + 0.5) * w,
            y: (-_vecB.y * 0.5 + 0.5) * h,
            visible: _vecB.z > -1 && _vecB.z < 1,
          };
          setVictimMarkers({ a: aPos, b: bPos });

          // Concept detection milestones & continuous sensor sample along crawl path
          const prog = simProgressRef.current;
          const simTimeSec = Number(simClockRef.current.toFixed(2));
          const personADetected = prog >= 0.34;
          const personBDetected = prog >= 0.68;
          const sample = sampleConceptTelemetry(prog, simTimeSec, p.includeHeartbeat);
          const personABpm = sample.bpm ?? Math.round(73 + Math.sin(elapsed * 1.4) * 3);

          p.onSimTelemetry({
            progress: prog,
            simTimeSec,
            personADetected,
            personBDetected,
            personABpm,
            servoAngleDeg,
            beltRpmConcept,
            sample,
          });
        } else {
          const sample = sampleConceptTelemetry(
            simProgressRef.current,
            simClockRef.current,
            p.includeHeartbeat
          );
          p.onSimTelemetry({
            progress: simProgressRef.current,
            simTimeSec: simClockRef.current,
            personADetected: false,
            personBDetected: false,
            personABpm: 74,
            servoAngleDeg,
            beltRpmConcept,
            sample,
          });
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Suppress unused helper warnings while preserving pre-allocated math scratchpad
    void _quatA;
    void _matA;
    void _up;

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      robot.dispose();
      rubble.dispose();
      textures.dispose();
      envRT.dispose();
      renderer.dispose();
      if (rectLight) rectLight.dispose();
    };
  }, [props.data]);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#0b0f14]"
      data-testid="sara-3d-viewport"
      data-view-mode={props.viewMode}
      data-heartbeat={props.includeHeartbeat ? 'on' : 'off'}
      data-thermal={props.thermalView ? 'on' : 'off'}
    >
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Graceful fallback if WebGL is unavailable */}
      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0f14] p-8 text-center">
          <p className="font-display text-xl font-semibold text-white">
            3D WebGL Preview Unavailable
          </p>
          <p className="mt-2 max-w-md text-sm text-[#9aa7b8]">
            Your browser could not initialize a WebGL context. All specifications, wiring diagrams,
            safety tables, and Bill of Materials remain available below.
          </p>
        </div>
      )}

      {/* Exploded View Projected Leader Callouts */}
      {props.viewMode === 'explode' && callouts.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {callouts.map(
            (c) =>
              c.visible && (
                <button
                  key={c.partId}
                  type="button"
                  onClick={() => props.onSelectPart(c.partId)}
                  style={{
                    transform: `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px) translate(-50%, -50%)`,
                  }}
                  className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                    c.partId === 'heartbeat_module'
                      ? 'border-[#22d3ee]/70 bg-[#0b0f14]/92 text-[#67e8f9] hover:border-[#22d3ee]'
                      : props.selectedPartId === c.partId
                        ? 'border-[#ff7a1a] bg-[#ff7a1a] text-[#0b0f14]'
                        : 'border-white/20 bg-[#0b0f14]/90 text-[#e8eef5] hover:border-[#ff7a1a]'
                  }`}
                >
                  <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
                  <span>{c.label}</span>
                </button>
              )
          )}
        </div>
      )}

      {/* Concept Simulation 3D-Projected Victim Markers */}
      {props.viewMode === 'simulate' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {victimMarkers.a.visible && (
            <div
              style={{
                transform: `translate(${Math.round(victimMarkers.a.x)}px, ${Math.round(victimMarkers.a.y)}px) translate(-50%, -100%)`,
              }}
              className={`absolute top-0 left-0 border px-2.5 py-1.5 text-[11px] leading-tight whitespace-nowrap ${
                props.includeHeartbeat
                  ? 'border-[#22c55e]/80 bg-[#0b0f14]/92 text-[#dcfce7]'
                  : 'border-[#f59e0b]/80 bg-[#0b0f14]/92 text-[#fef3c7]'
              }`}
            >
              <div className="font-semibold">
                Person A · {props.includeHeartbeat ? 'Heartbeat Confirmed' : 'Multi-Sensor Evidence'}
              </div>
              <div className="font-mono text-[10px] opacity-90">
                {props.includeHeartbeat ? 'Priority 1 · Rescue first' : 'Priority 2 · Re-check'}
              </div>
            </div>
          )}

          {victimMarkers.b.visible && (
            <div
              style={{
                transform: `translate(${Math.round(victimMarkers.b.x)}px, ${Math.round(victimMarkers.b.y)}px) translate(-50%, -100%)`,
              }}
              className="absolute top-0 left-0 border border-[#f59e0b]/80 bg-[#0b0f14]/92 px-2.5 py-1.5 text-[11px] leading-tight text-[#fef3c7] whitespace-nowrap"
            >
              <div className="font-semibold">Person B</div>
              <div className="font-mono text-[10px] text-[#fbbf24]">{NO_VITAL_SIGN_LABEL}</div>
            </div>
          )}

          {/* First-Person Camera View Subtle Optical Frame */}
          {props.fpvCamera && (
            <div className="pointer-events-none absolute inset-6 border border-white/15">
              <div className="absolute top-3 left-3 bg-[#0b0f14]/85 px-2.5 py-1 font-mono text-[11px] text-[#e8eef5]">
                {props.thermalView
                  ? 'MLX90640 THERMAL FEED · CONCEPT SIMULATION'
                  : 'OV5647 NOSE CAMERA · CONCEPT SIMULATION'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
