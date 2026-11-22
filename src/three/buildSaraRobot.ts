import * as THREE from 'three';
import {
  SaraPartsData,
  ViewMode,
  computeExplodedCenters,
  computeSegmentLayout,
} from '../lib/saraData';
import { ProceduralTextureSet } from './textures';

export interface ExplodedCalloutAnchor {
  partId: string;
  label: string;
  object: THREE.Object3D;
  localOffset: THREE.Vector3;
}

export interface BeltTreadPod {
  podGroup: THREE.Group;
  sideDir: THREE.Vector3;
  lugs: THREE.Mesh[];
  rollers: THREE.Object3D[];
  length: number;
  drumRadius: number;
  baseOffset: THREE.Vector3;
}

export interface JointRig {
  index: number;
  segmentGroup: THREE.Group;
  yokeA: THREE.Group;
  yokeB: THREE.Group;
  crossGroup: THREE.Group;
  sleeveMesh: THREE.Group;
  cables: THREE.Mesh[];
  wireBundle: THREE.Group;
  baseSleevePos: THREE.Vector3;
}

export interface SaraRobotRig {
  root: THREE.Group;
  segmentGroups: THREE.Group[];
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  headTopShell: THREE.Group;
  headBottomShell: THREE.Group;
  tailTopShell: THREE.Group;
  tailBottomShell: THREE.Group;
  noseCapGroup: THREE.Group;
  headInternalsGroup: THREE.Group;
  tailInternalsGroup: THREE.Group;
  heartbeatGroup: THREE.Group;
  noseHeartbeatRing: THREE.Mesh;
  headLedLight: THREE.SpotLight;
  headLedBeam: THREE.Mesh;
  headLedMeshes: THREE.Mesh[];
  cameraMountNode: THREE.Object3D;
  joints: JointRig[];
  beltPods: BeltTreadPod[];
  motorShafts: THREE.Object3D[];
  servoHorns: THREE.Object3D[];
  moduleInternals: THREE.Group[];
  eyeboltGroup: THREE.Group;
  studioTetherGroup: THREE.Group;
  interactables: THREE.Object3D[];
  calloutAnchors: ExplodedCalloutAnchor[];
  setViewMode: (
    mode: ViewMode,
    explodeFactor: number,
    cutawayFactor: number,
    selectedPartId: string | null
  ) => void;
  setHeartbeatVisible: (visible: boolean) => void;
  setThermalMode: (enabled: boolean) => void;
  setJointAngles: (angles: Array<{ yaw: number; pitch: number }>) => void;
  advanceBelts: (phase: number) => void;
  setLedIntensity: (intensity: number) => void;
  dispose: () => void;
}

function tagPartRecursive(obj: THREE.Object3D, partId: string, interactables: THREE.Object3D[]) {
  obj.userData.partId = partId;
  obj.traverse((child) => {
    child.userData.partId = partId;
    if ((child as THREE.Mesh).isMesh) {
      interactables.push(child);
    }
  });
}

/**
 * Helper to create a smooth 3D silicone-insulated wire tube between 3D waypoints.
 */
function createWireTube(
  points: Array<[number, number, number]>,
  radius: number,
  material: THREE.Material,
  tubularSegments = 18
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, 6, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  return mesh;
}

/**
 * Builds a CNC-machined Brushed Aluminium half-cylinder clamshell oriented along X,
 * with chamfered end collars, dark-anodized split clamping rails, recessed vent/inspection slots,
 * and stainless steel hex cap screws.
 */
function createAluminiumClamshellHalf(
  radius: number,
  length: number,
  topHalf: boolean,
  alMaterial: THREE.Material,
  darkTrimMaterial: THREE.Material,
  wallThickness = 0.042,
  taperFrontRadius?: number
): THREE.Group {
  const group = new THREE.Group();
  const rFront = taperFrontRadius ?? radius;
  const rBack = radius;
  const radialSegs = 32;
  const phiStart = topHalf ? -Math.PI / 2 : Math.PI / 2;

  // Main brushed aluminium outer barrel
  const outerGeo = new THREE.CylinderGeometry(
    rBack,
    rFront,
    length,
    radialSegs,
    1,
    true,
    phiStart,
    Math.PI
  );
  outerGeo.rotateZ(-Math.PI / 2);
  const outerMesh = new THREE.Mesh(outerGeo, alMaterial);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  // Machined inner wall lining (solid 4 mm thickness visible on cutaway/explode)
  const innerGeo = new THREE.CylinderGeometry(
    Math.max(0.1, rBack - wallThickness),
    Math.max(0.1, rFront - wallThickness),
    length,
    radialSegs,
    1,
    true,
    phiStart,
    Math.PI
  );
  innerGeo.rotateZ(-Math.PI / 2);
  const innerMat = alMaterial.clone();
  innerMat.side = THREE.BackSide;
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerMesh);

  // Machined chamfered end collars (front & rear stepped rings)
  const makeCapRing = (xPos: number, rOuter: number) => {
    const ringGeo = new THREE.RingGeometry(
      Math.max(0.08, rOuter - wallThickness),
      rOuter,
      radialSegs,
      1,
      topHalf ? 0 : Math.PI,
      Math.PI
    );
    ringGeo.rotateY(Math.PI / 2);
    const ringMat = alMaterial.clone();
    ringMat.side = THREE.DoubleSide;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.x = xPos;
    return ring;
  };
  group.add(makeCapRing(-length / 2, rFront));
  group.add(makeCapRing(length / 2, rBack));

  // Stepped dark-anodized precision trim collars at ends
  for (const [xFrac, rCol] of [
    [-0.46, rFront + 0.008],
    [0.46, rBack + 0.008],
  ] as const) {
    const collarGeo = new THREE.CylinderGeometry(
      rCol,
      rCol,
      0.048,
      radialSegs,
      1,
      true,
      phiStart,
      Math.PI
    );
    collarGeo.rotateZ(-Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, darkTrimMaterial);
    collar.position.x = xFrac * length;
    group.add(collar);
  }

  // Dark anodized longitudinal split-seam clamping rails on +Z and -Z edges
  const railGeo = new THREE.BoxGeometry(length * 0.96, 0.022, wallThickness * 1.18);
  const signY = topHalf ? 0.014 : -0.014;
  const avgR = (rFront + rBack) * 0.5 - wallThickness * 0.35;
  for (const signZ of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, darkTrimMaterial);
    rail.position.set(0, signY, signZ * avgR);
    group.add(rail);
  }

  // Machined dark recessed cooling/inspection vent louvers along the flanks
  const slotGeo = new THREE.BoxGeometry(0.11, 0.016, 0.022);
  const yAng = topHalf ? 0.55 : -0.55;
  for (const zSign of [-1, 1]) {
    for (const xFrac of [-0.22, 0.02, 0.24]) {
      const slot = new THREE.Mesh(slotGeo, darkTrimMaterial);
      const rMid = (rFront + rBack) * 0.5 + 0.003;
      slot.position.set(
        xFrac * length,
        Math.sin(yAng) * rMid,
        zSign * Math.cos(yAng) * rMid
      );
      slot.rotation.x = zSign * (Math.PI / 2 - Math.abs(yAng)) * (topHalf ? 1 : -1);
      group.add(slot);
    }
  }

  return group;
}

/**
 * Builds a CNC-machined Aluminium 6061 cardan U-yoke oriented along X with brass cable guide ferrules.
 */
function createCardanYoke(
  baseRadius: number,
  yokeDepth: number,
  alMaterial: THREE.Material,
  brassMaterial: THREE.Material,
  flipDirection: boolean
): THREE.Group {
  const group = new THREE.Group();
  const dir = flipDirection ? -1 : 1;

  // Base flange hub with central 12 mm wire-routing bore ring
  const hubGeo = new THREE.CylinderGeometry(baseRadius * 0.86, baseRadius * 0.86, 0.068, 28);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, alMaterial);
  hub.position.x = -dir * (yokeDepth * 0.44);
  hub.castShadow = true;
  group.add(hub);

  const boreGeo = new THREE.TorusGeometry(baseRadius * 0.44, 0.028, 10, 24);
  boreGeo.rotateY(Math.PI / 2);
  const bore = new THREE.Mesh(boreGeo, alMaterial);
  bore.position.x = -dir * (yokeDepth * 0.44);
  group.add(bore);

  // 4 machined brass cable-guide ferrules at the quadrant rim
  const ferruleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.055, 8).rotateZ(Math.PI / 2);
  const ferruleR = baseRadius * 0.84;
  for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const ferrule = new THREE.Mesh(ferruleGeo, brassMaterial);
    ferrule.position.set(-dir * (yokeDepth * 0.42), Math.sin(ang) * ferruleR, Math.cos(ang) * ferruleR);
    group.add(ferrule);
  }

  // Two symmetric clevis ears extending along X
  const earShape = new THREE.Shape();
  const earLen = yokeDepth * 0.86;
  const earH = 0.118;
  earShape.moveTo(0, -earH * 0.55);
  earShape.lineTo(earLen * 0.72, -earH * 0.5);
  earShape.absarc(earLen * 0.72, 0, earH * 0.5, -Math.PI / 2, Math.PI / 2, false);
  earShape.lineTo(0, earH * 0.55);
  earShape.closePath();

  const earGeo = new THREE.ExtrudeGeometry(earShape, {
    depth: 0.044,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  earGeo.center();

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, alMaterial);
    ear.position.set(dir * (yokeDepth * 0.05), 0, side * (baseRadius * 0.62));
    if (flipDirection) {
      ear.rotation.y = Math.PI;
    }
    ear.castShadow = true;
    group.add(ear);
  }

  return group;
}

/**
 * Builds a realistic multi-part N20 Metal-Gear DC Motor:
 * brushed steel cylindrical motor can, black rear end-bell, twin brass solder tabs,
 * gold-brass rectangular spur gearbox with visible micro-gear stack, rotating steel D-shaft + brass drive pinion,
 * and red/black silicone motor leads curving into the central wiring harness.
 */
function createDetailedN20Motor(
  steelCanMat: THREE.Material,
  brassMat: THREE.Material,
  darkPlasticMat: THREE.Material,
  redWireMat: THREE.Material,
  blackWireMat: THREE.Material,
  shaftMat: THREE.Material
): { motorGroup: THREE.Group; shaftNode: THREE.Object3D } {
  const motorGroup = new THREE.Group();

  // Rear cylindrical brushed-steel N20 DC motor can
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.21, 16).rotateZ(Math.PI / 2),
    steelCanMat
  );
  can.position.x = 0.095;
  can.castShadow = true;
  motorGroup.add(can);

  // Black nylon rear brush end-bell
  const endBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.053, 0.05, 0.032, 14).rotateZ(Math.PI / 2),
    darkPlasticMat
  );
  endBell.position.x = 0.212;
  motorGroup.add(endBell);

  // Twin brass solder terminals on rear face
  const tabGeo = new THREE.BoxGeometry(0.026, 0.01, 0.022);
  const tabPos = new THREE.Mesh(tabGeo, brassMat);
  tabPos.position.set(0.232, 0.022, 0.016);
  const tabNeg = new THREE.Mesh(tabGeo, brassMat);
  tabNeg.position.set(0.232, -0.022, -0.016);
  motorGroup.add(tabPos, tabNeg);

  // Iconic golden-brass N20 rectangular spur gearbox housing
  const gearTopPlate = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.118), brassMat);
  gearTopPlate.position.set(-0.082, 0.044, 0);
  const gearBotPlate = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.118), brassMat);
  gearBotPlate.position.set(-0.082, -0.044, 0);
  const gearFrontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.105, 0.118), brassMat);
  gearFrontPlate.position.set(-0.145, 0, 0);
  const gearRearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.105, 0.118), brassMat);
  gearRearPlate.position.set(-0.016, 0, 0);
  motorGroup.add(gearTopPlate, gearBotPlate, gearFrontPlate, gearRearPlate);

  // Visible miniature internal stacked brass spur gears inside the open N20 gearbox sides!
  const miniGearGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.018, 12);
  for (let g = 0; g < 3; g++) {
    const mg = new THREE.Mesh(miniGearGeo, g % 2 === 0 ? brassMat : steelCanMat);
    mg.position.set(-0.048 - g * 0.034, (g % 2 === 0 ? 1 : -1) * 0.008, (g - 1) * 0.016);
    motorGroup.add(mg);
  }

  // Output shaft + brass drive pinion coupling into the front belt roller
  const shaftNode = new THREE.Group();
  shaftNode.position.set(-0.156, 0, 0);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10).rotateZ(Math.PI / 2),
    shaftMat
  );
  shaft.position.x = -0.055;
  const pinion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.032, 10).rotateZ(Math.PI / 2),
    brassMat
  );
  pinion.position.x = -0.092;
  shaftNode.add(shaft, pinion);
  motorGroup.add(shaftNode);

  // Red & black silicone wire leads curving inward toward the central 12 mm core tunnel
  const wireRed = createWireTube(
    [
      [0.238, 0.022, 0.016],
      [0.285, -0.04, 0.035],
      [0.24, -0.14, 0.02],
      [0.14, -0.19, 0.01],
    ],
    0.0095,
    redWireMat,
    12
  );
  const wireBlk = createWireTube(
    [
      [0.238, -0.022, -0.016],
      [0.285, -0.07, -0.035],
      [0.24, -0.15, -0.02],
      [0.14, -0.19, -0.01],
    ],
    0.0095,
    blackWireMat,
    12
  );
  motorGroup.add(wireRed, wireBlk);

  return { motorGroup, shaftNode };
}

/**
 * Builds a realistic multi-conductor wiring bundle (braided dark sleeve + 6 visible color-coded wires + zip ties)
 * running along X through joints and module cores.
 */
function createMultiConductorHarness(
  length: number,
  wireMaterials: {
    sleeve: THREE.Material;
    red: THREE.Material;
    black: THREE.Material;
    yellow: THREE.Material;
    green: THREE.Material;
    blue: THREE.Material;
    orange: THREE.Material;
  }
): THREE.Group {
  const group = new THREE.Group();
  const half = length * 0.5;

  // Inner dark braided core sleeve
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, length, 10).rotateZ(Math.PI / 2),
    wireMaterials.sleeve
  );
  group.add(sleeve);

  // 6 distinct helically-twisted colored silicone conductors wrapped cleanly around the core
  const strands: Array<{ mat: THREE.Material; phase: number; r: number }> = [
    { mat: wireMaterials.red, phase: 0, r: 0.045 },
    { mat: wireMaterials.black, phase: Math.PI / 3, r: 0.045 },
    { mat: wireMaterials.yellow, phase: (2 * Math.PI) / 3, r: 0.044 },
    { mat: wireMaterials.green, phase: Math.PI, r: 0.044 },
    { mat: wireMaterials.blue, phase: (4 * Math.PI) / 3, r: 0.045 },
    { mat: wireMaterials.orange, phase: (5 * Math.PI) / 3, r: 0.045 },
  ];

  strands.forEach(({ mat, phase, r }) => {
    const pts: Array<[number, number, number]> = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const x = -half + f * length;
      const ang = phase + f * Math.PI * 1.1;
      pts.push([x, Math.sin(ang) * r, Math.cos(ang) * r]);
    }
    group.add(createWireTube(pts, 0.0115, mat, 14));
  });

  // Two matte-black cable-tie collars holding the loom tidy
  const tieGeo = new THREE.TorusGeometry(0.056, 0.008, 6, 16).rotateY(Math.PI / 2);
  for (const fx of [-0.28, 0.28]) {
    const tie = new THREE.Mesh(tieGeo, wireMaterials.sleeve);
    tie.position.x = fx * length;
    group.add(tie);
  }

  return group;
}

/**
 * Procedurally constructs the entire 9-segment SARA snake robot directly from parts.json.
 * Scale: 1.0 Three.js unit = 100 mm.
 * Outer housings: CNC-machined Brushed Aluminium 6061 with dark-anodized rails & bolts.
 * Traction: 3 open-frame aluminium modules with 12 clearly visible brass-gearbox N20 motors,
 * 24 motor wire leads, toothed rollers, and 12 hollow treaded orange TPU 95A belts.
 * Wiring: Full continuous color-coded internal wire harness + head/tail looms + rear tether & Dyneema line.
 */
export function buildSaraRobot(
  data: SaraPartsData,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): SaraRobotRig {
  const root = new THREE.Group();
  root.name = 'SARA_Robot';

  const layout = computeSegmentLayout(data.dimensions.segments);
  const outerRadius = data.dimensions.outerDiameterMm / 200; // 84mm -> 0.42
  const beltHalfSpan = data.dimensions.beltOuterSpanMm / 200; // 101mm -> 0.505

  const interactables: THREE.Object3D[] = [];
  const calloutAnchors: ExplodedCalloutAnchor[] = [];
  const allCreatedMaterials: THREE.Material[] = [];
  const allCreatedGeometries: THREE.BufferGeometry[] = [];

  const trackMat = <T extends THREE.Material>(m: T): T => {
    allCreatedMaterials.push(m);
    return m;
  };

  // === REALISTIC PBR MATERIALS ===
  // 1. CNC Brushed Aluminium 6061 Outer Shells (Head, Tail, Module End Rings)
  const alOuterShellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.brushedAlAlbedo,
      bumpMap: textures.brushedAlBump,
      bumpScale: 0.007,
      roughnessMap: textures.brushedAlRoughness,
      roughness: 0.34,
      metalness: 0.88,
      clearcoat: 0.12,
      clearcoatRoughness: 0.28,
      anisotropy: isSoftwareGl ? 0 : 0.72,
      transparent: false,
      opacity: 1,
    })
  );

  // 2. Dark Hard-Anodized Aluminium 6061 (clamping rails, module chassis rails, track side plates, bezels)
  const darkAnodizedAlMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#27303c'),
      bumpMap: textures.brushedAlBump,
      bumpScale: 0.004,
      roughness: 0.36,
      metalness: 0.82,
      clearcoat: 0.08,
    })
  );

  // 3. Machined Raw Billet Aluminium 6061-T6 (Cardan Yokes, Rollers, M6 Eyebolt)
  const al6061Mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d2dae4'),
      bumpMap: textures.brushedAlBump,
      bumpScale: 0.005,
      roughness: 0.22,
      metalness: 0.94,
      anisotropy: isSoftwareGl ? 0 : 0.8,
    })
  );

  // 4. Vulcanized-style Grippy Orange TPU 95A (Nose bumper, Belts, Joint Bellows)
  const tpuOrangeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(data.materials.tpu.color),
      roughness: 0.72,
      metalness: 0.02,
      clearcoat: 0.04,
      bumpMap: textures.tpuBump,
      bumpScale: 0.012,
    })
  );

  const tpuSleeveMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(data.materials.tpu.color),
      roughness: 0.74,
      metalness: 0.02,
      bumpMap: textures.tpuBump,
      bumpScale: 0.012,
      transparent: false,
      opacity: 1,
    })
  );

  const steelMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#39424e'),
      roughness: 0.34,
      metalness: 0.9,
    })
  );

  const bearingSilverMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c2ccd8'),
      roughness: 0.16,
      metalness: 0.96,
    })
  );

  const brassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d4a238'),
      roughness: 0.24,
      metalness: 0.92,
    })
  );

  const pcbGreenMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.pcbGreenAlbedo,
      roughness: 0.38,
      metalness: 0.16,
      clearcoat: 0.35,
    })
  );

  const pcbBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.pcbBlueAlbedo,
      roughness: 0.38,
      metalness: 0.16,
      clearcoat: 0.35,
    })
  );

  const servoBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1d63b8'),
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.45,
    })
  );

  const pcbRedMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#9e2525'),
      roughness: 0.4,
      metalness: 0.16,
      clearcoat: 0.32,
    })
  );

  const batteryBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1d4ed8'),
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.55,
    })
  );

  const co2TealMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1b7778'),
      roughness: 0.32,
      metalness: 0.68,
    })
  );

  const darkOpticMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0c1016'),
      roughness: 0.1,
      metalness: 0.28,
      clearcoat: 1.0,
    })
  );

  const irLensMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#3b281c'),
      roughness: 0.14,
      metalness: 0.72,
      clearcoat: 0.9,
    })
  );

  // Wire Insulation Materials (matte silicone rubber!)
  const wireSleeveMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#171b22', roughness: 0.85, metalness: 0.05 })
  );
  const wireRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.62, metalness: 0.04 })
  );
  const wireBlackMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1e242d', roughness: 0.68, metalness: 0.05 })
  );
  const wireYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.62, metalness: 0.04 })
  );
  const wireGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.62, metalness: 0.04 })
  );
  const wireBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.62, metalness: 0.04 })
  );
  const wireOrangeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.62, metalness: 0.04 })
  );
  const ffcCopperMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: '#c86a22', roughness: 0.32, metalness: 0.45, clearcoat: 0.3 })
  );
  const dyneemaMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.88, metalness: 0.02 })
  );

  const wireMats = {
    sleeve: wireSleeveMat,
    red: wireRedMat,
    black: wireBlackMat,
    yellow: wireYellowMat,
    green: wireGreenMat,
    blue: wireBlueMat,
    orange: wireOrangeMat,
  };

  const ledEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff7e6'),
      emissive: new THREE.Color('#ffdfa8'),
      emissiveIntensity: 1.6,
      roughness: 0.2,
    })
  );

  const heartbeatMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(data.materials.heartbeat.color),
      emissive: new THREE.Color('#0891b2'),
      emissiveIntensity: 0.42,
      roughness: data.materials.heartbeat.roughness,
      metalness: data.materials.heartbeat.metalness,
      clearcoat: data.materials.heartbeat.clearcoat,
    })
  );

  const thermalRobotMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#27235e'),
      emissive: new THREE.Color('#341b66'),
      emissiveIntensity: 0.32,
      roughness: 0.55,
    })
  );

  const thermalWarmInternalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f97316'),
      emissive: new THREE.Color('#ea580c'),
      emissiveIntensity: 0.72,
      roughness: 0.4,
    })
  );

  // Subtle volumetric-style headlamp cone material (visible only in Simulation visible-light mode)
  const beamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffecc8,
      transparent: true,
      opacity: 0.085,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );

  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  const segmentGroups: THREE.Group[] = [];
  const joints: JointRig[] = [];
  const beltPods: BeltTreadPod[] = [];
  const motorShafts: THREE.Object3D[] = [];
  const servoHorns: THREE.Object3D[] = [];
  const moduleInternals: THREE.Group[] = [];
  const headLedMeshes: THREE.Mesh[] = [];

  let headGroup = new THREE.Group();
  let tailGroup = new THREE.Group();
  let headTopShell = new THREE.Group();
  let headBottomShell = new THREE.Group();
  let tailTopShell = new THREE.Group();
  let tailBottomShell = new THREE.Group();
  let noseCapGroup = new THREE.Group();
  let headInternalsGroup = new THREE.Group();
  let tailInternalsGroup = new THREE.Group();
  let heartbeatGroup = new THREE.Group();
  let noseHeartbeatRing = new THREE.Mesh();
  let eyeboltGroup = new THREE.Group();
  let studioTetherGroup = new THREE.Group();
  const cameraMountNode = new THREE.Object3D();

  // Real forward nose LED SpotLight (illuminating rubble ahead in Simulation mode)
  const headLedLight = new THREE.SpotLight(0xfff1d6, 0.4, 18, Math.PI / 3.8, 0.62, 1.2);
  headLedLight.castShadow = false;

  // Volumetric-style headlamp cone mesh
  const beamGeo = new THREE.ConeGeometry(1.15, 4.4, 24, 1, true);
  beamGeo.translate(0, -2.2, 0);
  beamGeo.rotateZ(-Math.PI / 2);
  const headLedBeam = new THREE.Mesh(beamGeo, beamMat);
  headLedBeam.visible = false;

  // Shared hex bolt geometry for M2.5 stainless fasteners
  const screwGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.024, 6);
  allCreatedGeometries.push(screwGeo, beamGeo);

  let jointCounter = 0;

  layout.placements.forEach((seg) => {
    const segGroup = new THREE.Group();
    segGroup.name = `seg_${seg.id}`;
    segGroup.position.x = seg.centerX;
    root.add(segGroup);
    segmentGroups.push(segGroup);

    const len = seg.lengthUnits;

    if (seg.type === 'head') {
      headGroup = segGroup;
      const noseLen = data.dimensions.noseLengthMm / 100; // 0.24
      const bodyLen = Math.max(0.4, len - noseLen);
      const bodyCenterOffset = noseLen * 0.5;

      // Top & Bottom CNC Brushed Aluminium Clamshells
      headTopShell = createAluminiumClamshellHalf(
        outerRadius,
        bodyLen,
        true,
        alOuterShellMat,
        darkAnodizedAlMat,
        0.042,
        outerRadius * 0.92
      );
      headTopShell.position.x = bodyCenterOffset;

      headBottomShell = createAluminiumClamshellHalf(
        outerRadius,
        bodyLen,
        false,
        alOuterShellMat,
        darkAnodizedAlMat,
        0.042,
        outerRadius * 0.92
      );
      headBottomShell.position.x = bodyCenterOffset;

      // Stainless steel M2.5 hex socket bolts along clamping rails
      const headScrews = new THREE.InstancedMesh(screwGeo, bearingSilverMat, 10);
      const dummy = new THREE.Object3D();
      let si = 0;
      for (const zSide of [-1, 1]) {
        for (const xFrac of [-0.38, -0.18, 0.02, 0.22, 0.4]) {
          dummy.position.set(xFrac * bodyLen, 0.022, zSide * (outerRadius * 0.97));
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          headScrews.setMatrixAt(si++, dummy.matrix);
        }
      }
      headScrews.instanceMatrix.needsUpdate = true;
      headScrews.computeBoundingSphere();
      headTopShell.add(headScrews);

      segGroup.add(headTopShell, headBottomShell);
      tagPartRecursive(headTopShell, 'head_shell', interactables);
      tagPartRecursive(headBottomShell, 'head_shell', interactables);
      calloutAnchors.push({
        partId: 'head_shell',
        label: 'Head Shell (Al 6061)',
        object: headTopShell,
        localOffset: new THREE.Vector3(-0.28, outerRadius + 0.28, 0),
      });

      // Orange TPU 95A Impact Nose Bumper with recessed dark-anodized sensor bulkhead
      noseCapGroup = new THREE.Group();
      noseCapGroup.position.x = -len / 2 + noseLen * 0.5;

      const noseGeo = new THREE.CylinderGeometry(outerRadius * 0.92, outerRadius * 0.72, noseLen, 32);
      noseGeo.rotateZ(-Math.PI / 2);
      const noseMesh = new THREE.Mesh(noseGeo, tpuOrangeMat);
      noseMesh.castShadow = true;
      noseMesh.receiveShadow = true;
      noseCapGroup.add(noseMesh);

      // Machined anodized retaining ring between TPU nose & Aluminium head shell
      const noseCollar = new THREE.Mesh(
        new THREE.TorusGeometry(outerRadius * 0.91, 0.024, 10, 32).rotateY(Math.PI / 2),
        darkAnodizedAlMat
      );
      noseCollar.position.x = noseLen * 0.46;
      noseCapGroup.add(noseCollar);

      // Recessed CNC dark-anodized sensor faceplate
      const bezelGeo = new THREE.CylinderGeometry(outerRadius * 0.67, outerRadius * 0.67, 0.032, 28);
      bezelGeo.rotateZ(Math.PI / 2);
      const bezel = new THREE.Mesh(bezelGeo, darkAnodizedAlMat);
      bezel.position.x = -noseLen / 2 - 0.004;
      noseCapGroup.add(bezel);

      // OV5647 RGB Camera barrel + multi-element optical lens
      const camBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.098, 0.055, 22).rotateZ(Math.PI / 2),
        steelMat
      );
      camBarrel.position.set(-noseLen / 2 - 0.018, 0.075, -0.068);
      const camRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.076, 0.012, 8, 20).rotateY(Math.PI / 2),
        al6061Mat
      );
      camRing.position.set(-noseLen / 2 - 0.044, 0.075, -0.068);
      const camLens = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), darkOpticMat);
      camLens.position.set(-noseLen / 2 - 0.028, 0.075, -0.068);
      noseCapGroup.add(camBarrel, camRing, camLens);

      // MLX90640 Thermal camera barrel + Germanium copper-tinted IR lens
      const thermHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.076, 0.05, 18).rotateZ(Math.PI / 2),
        al6061Mat
      );
      thermHousing.position.set(-noseLen / 2 - 0.018, 0.075, 0.098);
      const thermLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.046, 0.055, 16).rotateZ(Math.PI / 2),
        irLensMat
      );
      thermLens.position.set(-noseLen / 2 - 0.022, 0.075, 0.098);
      noseCapGroup.add(thermHousing, thermLens);

      // 4 Recessed Headlamp LEDs with aluminium reflector cups
      const ledCoords = [
        [0.18, 0.0],
        [-0.18, 0.0],
        [0.0, 0.19],
        [0.0, -0.19],
      ];
      const ledCupGeo = new THREE.CylinderGeometry(0.038, 0.028, 0.028, 14).rotateZ(Math.PI / 2);
      const ledGeo = new THREE.SphereGeometry(0.024, 12, 10);
      ledCoords.forEach(([ly, lz]) => {
        const cup = new THREE.Mesh(ledCupGeo, al6061Mat);
        cup.position.set(-noseLen / 2 - 0.014, ly, lz);
        const led = new THREE.Mesh(ledGeo, ledEmissiveMat);
        led.position.set(-noseLen / 2 - 0.022, ly, lz);
        noseCapGroup.add(cup, led);
        headLedMeshes.push(led);
      });

      // Machined CO2 intake grille slots on lower nose face
      const ventGeo = new THREE.BoxGeometry(0.032, 0.015, 0.11);
      for (let v = 0; v < 4; v++) {
        const vent = new THREE.Mesh(ventGeo, darkOpticMat);
        vent.position.set(-noseLen / 2 - 0.014, -0.065 - v * 0.028, 0);
        noseCapGroup.add(vent);
      }

      // Optional Cyan Heartbeat Nose Aperture Ring (CONCEPT)
      noseHeartbeatRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.052, 0.013, 10, 20).rotateY(Math.PI / 2),
        heartbeatMat
      );
      noseHeartbeatRing.position.set(-noseLen / 2 - 0.025, -0.05, -0.14);
      noseHeartbeatRing.visible = false;
      noseCapGroup.add(noseHeartbeatRing);

      // FPV camera mount + SpotLight + volumetric beam cone
      cameraMountNode.position.set(-noseLen / 2 - 0.05, 0.08, 0);
      noseCapGroup.add(cameraMountNode);

      headLedLight.position.set(-noseLen / 2 - 0.06, 0.05, 0);
      const ledTarget = new THREE.Object3D();
      ledTarget.position.set(-noseLen / 2 - 5.2, -0.25, 0);
      noseCapGroup.add(ledTarget);
      headLedLight.target = ledTarget;
      noseCapGroup.add(headLedLight);

      headLedBeam.position.set(-noseLen / 2 - 0.04, 0.02, 0);
      noseCapGroup.add(headLedBeam);

      segGroup.add(noseCapGroup);
      tagPartRecursive(noseCapGroup, 'nose_cap', interactables);
      calloutAnchors.push({
        partId: 'nose_cap',
        label: 'Nose Cap & Optics (TPU)',
        object: noseCapGroup,
        localOffset: new THREE.Vector3(-0.08, -outerRadius - 0.16, 0),
      });

      // === HEAD INTERNALS + REAL COLOR-CODED WIRING LOOMS ===
      headInternalsGroup = new THREE.Group();
      headInternalsGroup.position.x = bodyCenterOffset;

      // Raspberry Pi Zero 2 W on machined mounting standoffs
      const piGroup = new THREE.Group();
      const piBoard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.024, 0.3), pcbGreenMat);
      const piCpu = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.15), darkOpticMat);
      piCpu.position.set(0.02, 0.022, 0);
      const piRfShield = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.12), bearingSilverMat);
      piRfShield.position.set(-0.18, 0.022, 0.04);
      const piHeader = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.036, 0.048), steelMat);
      piHeader.position.set(0.01, 0.028, -0.115);
      // Brass GPIO pin strip
      const piPins = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.048, 0.022), brassMat);
      piPins.position.set(0.01, 0.038, -0.115);
      piGroup.add(piBoard, piCpu, piRfShield, piHeader, piPins);
      piGroup.position.set(0.05, -0.125, 0);
      tagPartRecursive(piGroup, 'pi_zero', interactables);
      headInternalsGroup.add(piGroup);
      calloutAnchors.push({
        partId: 'pi_zero',
        label: 'Raspberry Pi Zero 2 W',
        object: piGroup,
        localOffset: new THREE.Vector3(0, -0.22, 0.14),
      });

      // MH-Z19B CO2 Sensor (upper chamber)
      const co2Group = new THREE.Group();
      const co2Box = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.1, 0.2), co2TealMat);
      const co2GoldCap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.016, 0.16), brassMat);
      co2GoldCap.position.y = 0.054;
      co2Group.add(co2Box, co2GoldCap);
      co2Group.position.set(-0.04, 0.12, 0.09);
      tagPartRecursive(co2Group, 'mhz19b_co2', interactables);
      headInternalsGroup.add(co2Group);

      // OV5647 Camera PCB
      const ovGroup = new THREE.Group();
      const ovPcb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.22), pcbGreenMat);
      ovGroup.add(ovPcb);
      ovGroup.position.set(-0.37, 0.06, -0.07);
      tagPartRecursive(ovGroup, 'ov5647_cam', interactables);
      headInternalsGroup.add(ovGroup);

      // MLX90640 Thermal breakout
      const mlxGroup = new THREE.Group();
      const mlxPcb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.14), pcbBlueMat);
      mlxGroup.add(mlxPcb);
      mlxGroup.position.set(-0.36, 0.06, 0.11);
      tagPartRecursive(mlxGroup, 'mlx90640_thermal', interactables);
      headInternalsGroup.add(mlxGroup);

      // INMP441 MEMS Mic breakout
      const micGroup = new THREE.Group();
      const micDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.024, 16), pcbBlueMat);
      const micCan = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.035), brassMat);
      micCan.position.y = 0.016;
      micGroup.add(micDisc, micCan);
      micGroup.position.set(-0.18, -0.02, -0.2);
      tagPartRecursive(micGroup, 'inmp441_mic', interactables);
      headInternalsGroup.add(micGroup);

      // LED MOSFET driver strip
      const ledDrvGroup = new THREE.Group();
      const ledPcb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.12), pcbRedMat);
      ledDrvGroup.add(ledPcb);
      ledDrvGroup.position.set(-0.22, -0.18, 0.14);
      tagPartRecursive(ledDrvGroup, 'head_leds', interactables);
      headInternalsGroup.add(ledDrvGroup);

      // REAL 3D HEAD WIRING HARNESS (CSI FFC ribbon + I2C/I2S/PWM/UART/Power looms)
      const headWiring = new THREE.Group();
      // Copper-orange CSI FFC flat cable looping from OV5647 down to Pi Zero 2 W
      const ffcCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, 0.04, -0.07),
        new THREE.Vector3(-0.24, -0.04, -0.06),
        new THREE.Vector3(-0.12, -0.105, -0.03),
        new THREE.Vector3(-0.02, -0.115, 0.0),
      ]);
      const ffcRibbon = new THREE.Mesh(
        new THREE.TubeGeometry(ffcCurve, 18, 0.014, 4, false),
        ffcCopperMat
      );
      ffcRibbon.scale.set(1, 0.35, 3.2);
      headWiring.add(ffcRibbon);

      // MLX90640 4-wire I2C harness (Red, Black, Yellow SDA, Blue SCL) -> Pi GPIO header
      headWiring.add(
        createWireTube([[-0.34, 0.06, 0.11], [-0.22, 0.03, 0.05], [-0.08, -0.07, -0.09]], 0.0085, wireRedMat),
        createWireTube([[-0.34, 0.04, 0.13], [-0.21, 0.01, 0.06], [-0.06, -0.07, -0.10]], 0.0085, wireBlackMat),
        createWireTube([[-0.34, 0.08, 0.09], [-0.20, 0.05, 0.02], [-0.04, -0.07, -0.11]], 0.0085, wireYellowMat),
        createWireTube([[-0.34, 0.08, 0.13], [-0.19, 0.04, 0.04], [-0.02, -0.07, -0.12]], 0.0085, wireBlueMat)
      );

      // MH-Z19B CO2 4-wire PWM + 5V loom running back into the main core tunnel
      headWiring.add(
        createWireTube([[0.12, 0.11, 0.09], [0.28, 0.07, 0.06], [0.46, 0.02, 0.03]], 0.0095, wireGreenMat),
        createWireTube([[0.12, 0.13, 0.07], [0.28, 0.09, 0.04], [0.46, 0.04, 0.01]], 0.0095, wireRedMat),
        createWireTube([[0.12, 0.09, 0.11], [0.28, 0.05, 0.08], [0.46, 0.0, 0.04]], 0.0095, wireBlackMat)
      );

      // INMP441 I2S 3-wire bundle -> Pi GPIO
      headWiring.add(
        createWireTube([[-0.16, -0.02, -0.18], [-0.08, -0.06, -0.15], [0.06, -0.08, -0.11]], 0.008, wireYellowMat),
        createWireTube([[-0.16, -0.03, -0.20], [-0.06, -0.07, -0.17], [0.08, -0.08, -0.12]], 0.008, wireBlueMat)
      );

      // LED MOSFET power pair -> Nose LEDs
      headWiring.add(
        createWireTube([[-0.28, -0.18, 0.14], [-0.38, -0.14, 0.11], [-0.47, -0.08, 0.06]], 0.009, wireRedMat),
        createWireTube([[-0.28, -0.18, 0.11], [-0.38, -0.15, 0.08], [-0.47, -0.10, 0.03]], 0.009, wireBlackMat)
      );

      // Pi Zero 2 W main trunk exiting rear of head into Joint 1 central bore (5V, GND, UART TX/RX, USB tether)
      headWiring.add(
        createWireTube([[0.22, -0.09, -0.10], [0.35, -0.04, -0.05], [0.50, -0.01, -0.02]], 0.011, wireRedMat),
        createWireTube([[0.22, -0.10, -0.08], [0.35, -0.05, -0.03], [0.50, -0.02, 0.0]], 0.011, wireBlackMat),
        createWireTube([[0.22, -0.08, -0.12], [0.35, -0.03, -0.07], [0.50, 0.02, -0.03]], 0.010, wireYellowMat),
        createWireTube([[0.22, -0.11, -0.11], [0.35, -0.06, -0.06], [0.50, 0.01, 0.02]], 0.010, wireOrangeMat)
      );

      tagPartRecursive(headWiring, 'wiring_harness', interactables);
      headInternalsGroup.add(headWiring);

      // CONCEPT: Future Heartbeat (Vital Sign) Sensor Module in CYAN
      heartbeatGroup = new THREE.Group();
      const hbBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.16), heartbeatMat);
      const hbEmitter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.06, 0.05, 18).rotateZ(Math.PI / 2),
        al6061Mat
      );
      hbEmitter.position.set(-0.16, 0, 0);
      const hbBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.018, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
      );
      hbBar.position.set(0, 0.06, 0);
      const hbWire = createWireTube(
        [[0.12, 0, -0.02], [0.22, -0.06, -0.04], [0.16, -0.11, -0.08]],
        0.0085,
        heartbeatMat,
        10
      );
      heartbeatGroup.add(hbBody, hbEmitter, hbBar, hbWire);
      heartbeatGroup.position.set(-0.08, 0.11, -0.15);
      heartbeatGroup.visible = false;
      tagPartRecursive(heartbeatGroup, 'heartbeat_module', interactables);
      headInternalsGroup.add(heartbeatGroup);
      calloutAnchors.push({
        partId: 'heartbeat_module',
        label: 'Heartbeat Module (CONCEPT)',
        object: heartbeatGroup,
        localOffset: new THREE.Vector3(0, 0.44, -0.15),
      });

      segGroup.add(headInternalsGroup);
    } else if (seg.type === 'joint') {
      const idx = jointCounter++;

      // CNC-machined Aluminium 6061 Cardan Yokes (orthogonal pair) + brass cable ferrules
      const yokeA = createCardanYoke(outerRadius * 0.78, len * 0.68, al6061Mat, brassMat, false);
      yokeA.position.x = -len * 0.18;
      const yokeB = createCardanYoke(outerRadius * 0.78, len * 0.68, al6061Mat, brassMat, true);
      yokeB.rotation.x = Math.PI / 2;
      yokeB.position.x = len * 0.18;
      segGroup.add(yokeA, yokeB);
      tagPartRecursive(yokeA, 'cardan_yoke', interactables);
      tagPartRecursive(yokeB, 'cardan_yoke', interactables);

      // Dark machined steel central spider cross + 4 miniature stainless ball bearings
      const crossGroup = new THREE.Group();
      const pinGeo = new THREE.CylinderGeometry(0.042, 0.042, outerRadius * 1.18, 14);
      const pinY = new THREE.Mesh(pinGeo, steelMat);
      const pinZ = new THREE.Mesh(pinGeo, steelMat);
      pinZ.rotation.x = Math.PI / 2;
      const centerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.082, 0.026, 10, 18).rotateY(Math.PI / 2),
        steelMat
      );
      crossGroup.add(pinY, pinZ, centerRing);

      const bearingGeo = new THREE.TorusGeometry(0.056, 0.019, 10, 18);
      const bPositions: Array<[number, number, number, number, number]> = [
        [0, outerRadius * 0.56, 0, Math.PI / 2, 0],
        [0, -outerRadius * 0.56, 0, Math.PI / 2, 0],
        [0, 0, outerRadius * 0.56, 0, 0],
        [0, 0, -outerRadius * 0.56, 0, 0],
      ];
      bPositions.forEach(([bx, by, bz, rx, ry]) => {
        const bearing = new THREE.Mesh(bearingGeo, bearingSilverMat);
        bearing.position.set(bx, by, bz);
        bearing.rotation.set(rx, ry, 0);
        crossGroup.add(bearing);
      });
      segGroup.add(crossGroup);
      tagPartRecursive(crossGroup, 'steel_cross_bearings', interactables);

      // 4 Braided Steel Steering Tendon Cables routed cleanly across the joint quadrants
      const cables: THREE.Mesh[] = [];
      const cableGeo = new THREE.CylinderGeometry(0.013, 0.013, len * 1.24, 8);
      cableGeo.rotateZ(Math.PI / 2);
      const cableR = outerRadius * 0.68;
      const cableAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      cableAngles.forEach((ang) => {
        const cable = new THREE.Mesh(cableGeo, bearingSilverMat);
        cable.position.set(0, Math.sin(ang) * cableR, Math.cos(ang) * cableR);
        segGroup.add(cable);
        cables.push(cable);
        tagPartRecursive(cable, 'steel_cables', interactables);
      });

      // Multi-conductor color-coded wiring loom passing visibly through the cardan joint core!
      const wireBundle = createMultiConductorHarness(len * 1.28, wireMats);
      segGroup.add(wireBundle);
      tagPartRecursive(wireBundle, 'wiring_harness', interactables);

      // Ribbed Orange TPU 95A Flexible Joint Boot (slightly compact so machined Al 6061 yoke rings & steel cables peek at both edges!)
      const sleeveGroup = new THREE.Group();
      const sleeveMain = new THREE.Mesh(
        new THREE.CylinderGeometry(outerRadius * 0.91, outerRadius * 0.91, len * 0.68, 28, 1, true).rotateZ(Math.PI / 2),
        tpuSleeveMat
      );
      sleeveMain.castShadow = true;
      sleeveMain.receiveShadow = true;
      sleeveGroup.add(sleeveMain);
      for (const rx of [-0.22, 0, 0.22]) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(outerRadius * 0.92, 0.024, 10, 28).rotateY(Math.PI / 2),
          tpuSleeveMat
        );
        rib.position.x = rx * len;
        sleeveGroup.add(rib);
      }
      // Dark anodized clamp bands securing the TPU boot to each joint
      for (const rx of [-0.34, 0.34]) {
        const clamp = new THREE.Mesh(
          new THREE.TorusGeometry(outerRadius * 0.90, 0.012, 8, 28).rotateY(Math.PI / 2),
          darkAnodizedAlMat
        );
        clamp.position.x = rx * len;
        sleeveGroup.add(clamp);
      }
      segGroup.add(sleeveGroup);
      tagPartRecursive(sleeveGroup, 'joint_sleeve', interactables);

      if (idx === 0) {
        calloutAnchors.push({
          partId: 'cardan_yoke',
          label: 'Al 6061 Cardan Yokes',
          object: yokeA,
          localOffset: new THREE.Vector3(0.22, outerRadius + 0.72, 0),
        });
        calloutAnchors.push({
          partId: 'joint_sleeve',
          label: 'TPU Joint Bellows',
          object: sleeveGroup,
          localOffset: new THREE.Vector3(0, -outerRadius - 0.58, 0),
        });
      }
      if (idx === 1) {
        calloutAnchors.push({
          partId: 'steel_cross_bearings',
          label: 'Steel Cross & Bearings',
          object: crossGroup,
          localOffset: new THREE.Vector3(0, -outerRadius - 0.44, 0),
        });
      }
      if (idx === 2) {
        calloutAnchors.push({
          partId: 'wiring_harness',
          label: 'Core Wiring Harness',
          object: wireBundle,
          localOffset: new THREE.Vector3(0, outerRadius + 0.42, 0),
        });
      }

      joints.push({
        index: idx,
        segmentGroup: segGroup,
        yokeA,
        yokeB,
        crossGroup,
        sleeveMesh: sleeveGroup,
        cables,
        wireBundle,
        baseSleevePos: sleeveGroup.position.clone(),
      });
    } else if (seg.type === 'module') {
      // === OPEN-FRAME CNC ALUMINIUM BELT MODULE CHASSIS (12× N20 MOTORS & WIRING VISIBLE!) ===
      const coreGroup = new THREE.Group();

      // Front & rear CNC-machined Brushed Aluminium bulkhead rings (hollow core!)
      const bulkheadShape = new THREE.Shape();
      bulkheadShape.absarc(0, 0, outerRadius * 0.96, 0, Math.PI * 2, false);
      const centerHole = new THREE.Path();
      centerHole.absarc(0, 0, outerRadius * 0.42, 0, Math.PI * 2, true);
      bulkheadShape.holes.push(centerHole);

      const bulkheadGeo = new THREE.ExtrudeGeometry(bulkheadShape, {
        depth: 0.075,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.01,
        bevelSegments: 2,
      });
      bulkheadGeo.rotateY(Math.PI / 2);
      bulkheadGeo.center();

      const frontFlange = new THREE.Mesh(bulkheadGeo, alOuterShellMat);
      frontFlange.position.x = -len * 0.44;
      frontFlange.castShadow = true;
      const rearFlange = new THREE.Mesh(bulkheadGeo, alOuterShellMat);
      rearFlange.position.x = len * 0.44;
      rearFlange.castShadow = true;
      coreGroup.add(frontFlange, rearFlange);

      // 4 Dark-Anodized Aluminium structural corner rails at 45° diagonals (leaving all 4 motor bays visibly open!)
      const railGeo = new THREE.BoxGeometry(len * 0.88, 0.055, 0.055);
      const railR = outerRadius * 0.78;
      for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
        const rail = new THREE.Mesh(railGeo, darkAnodizedAlMat);
        rail.position.set(0, Math.sin(ang) * railR, Math.cos(ang) * railR);
        rail.rotation.x = ang;
        rail.castShadow = true;
        coreGroup.add(rail);
      }

      // Central thin aluminium cable guide ring in the middle
      const midRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.014, 8, 22).rotateY(Math.PI / 2),
        al6061Mat
      );
      coreGroup.add(midRing);

      // 4 stainless flange bolts on each bulkhead ring
      const flangeBolts = new THREE.InstancedMesh(screwGeo, bearingSilverMat, 8);
      const dummy = new THREE.Object3D();
      let bi = 0;
      for (const xSide of [-1, 1]) {
        for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
          dummy.position.set(
            xSide * (len * 0.44),
            Math.sin(ang) * (outerRadius * 0.94),
            Math.cos(ang) * (outerRadius * 0.94)
          );
          dummy.rotation.set(ang + Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          flangeBolts.setMatrixAt(bi++, dummy.matrix);
        }
      }
      flangeBolts.instanceMatrix.needsUpdate = true;
      flangeBolts.computeBoundingSphere();
      coreGroup.add(flangeBolts);

      segGroup.add(coreGroup);
      tagPartRecursive(coreGroup, 'belt_module_core', interactables);

      // === 4 EXPOSED N20 BRASS-GEARBOX MOTORS + RED/BLACK LEADS + MULTI-CONDUCTOR CORE HARNESS ===
      // Mounted cleanly in the open chassis bays so motors and wiring are ALWAYS visible!
      const modInternals = new THREE.Group();
      const motorSlots: Array<{ pos: [number, number, number]; rotX: number }> = [
        { pos: [0.02, 0.25, 0], rotX: 0 },
        { pos: [0.02, -0.25, 0], rotX: Math.PI },
        { pos: [0.02, 0, 0.25], rotX: Math.PI / 2 },
        { pos: [0.02, 0, -0.25], rotX: -Math.PI / 2 },
      ];
      motorSlots.forEach(({ pos, rotX }) => {
        const { motorGroup, shaftNode } = createDetailedN20Motor(
          bearingSilverMat,
          brassMat,
          darkOpticMat,
          wireRedMat,
          wireBlackMat,
          steelMat
        );
        motorGroup.position.set(...pos);
        motorGroup.rotation.x = rotX;
        modInternals.add(motorGroup);
        motorShafts.push(shaftNode);
      });

      // Continuous color-coded multi-conductor wiring harness through the open 12 mm core!
      const moduleWireBundle = createMultiConductorHarness(len * 1.06, wireMats);
      modInternals.add(moduleWireBundle);
      tagPartRecursive(modInternals, 'n20_motors', interactables);
      tagPartRecursive(moduleWireBundle, 'wiring_harness', interactables);

      // 4 braided steel steering cables passing straight along the diagonal guide channels
      const passCableGeo = new THREE.CylinderGeometry(0.011, 0.011, len * 1.02, 6).rotateZ(Math.PI / 2);
      const passR = outerRadius * 0.68;
      for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
        const pc = new THREE.Mesh(passCableGeo, bearingSilverMat);
        pc.position.set(0, Math.sin(ang) * passR, Math.cos(ang) * passR);
        modInternals.add(pc);
        tagPartRecursive(pc, 'steel_cables', interactables);
      }

      segGroup.add(modInternals);
      moduleInternals.push(modInternals);

      // === 4 PROTRUDING HOLLOW TREADED ORANGE TPU 95A BELT PODS ON TOOTHED ALUMINIUM ROLLERS ===
      const beltLen = len * 0.76;
      const beltWidth = 0.26;
      const beltThickness = 0.148;
      const drumR = beltThickness * 0.5;
      const podRadialCenter = beltHalfSpan - drumR;
      const halfStraight = (beltLen - beltThickness) * 0.5;

      const sides: Array<{ dir: THREE.Vector3; rotX: number }> = [
        { dir: new THREE.Vector3(0, 1, 0), rotX: 0 },
        { dir: new THREE.Vector3(0, -1, 0), rotX: Math.PI },
        { dir: new THREE.Vector3(0, 0, 1), rotX: Math.PI / 2 },
        { dir: new THREE.Vector3(0, 0, -1), rotX: -Math.PI / 2 },
      ];

      // Hollow extruded stadium-ring TPU belt (real belt wall thickness so rollers are visible inside!)
      const beltOuter = new THREE.Shape();
      beltOuter.absarc(-halfStraight, 0, drumR, Math.PI / 2, (3 * Math.PI) / 2, false);
      beltOuter.absarc(halfStraight, 0, drumR, -Math.PI / 2, Math.PI / 2, false);
      beltOuter.closePath();

      const innerR = drumR - 0.022;
      const beltHole = new THREE.Path();
      beltHole.absarc(-halfStraight, 0, innerR, Math.PI / 2, (3 * Math.PI) / 2, false);
      beltHole.absarc(halfStraight, 0, innerR, -Math.PI / 2, Math.PI / 2, false);
      beltHole.closePath();
      beltOuter.holes.push(beltHole);

      const beltBandGeo = new THREE.ExtrudeGeometry(beltOuter, {
        depth: beltWidth,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.005,
        bevelSegments: 2,
      });
      beltBandGeo.center();

      // Side dark-anodized belt tensioner guide plates
      const sidePlateGeo = new THREE.BoxGeometry(halfStraight * 2.05, 0.046, 0.016);
      const rollerCoreGeo = new THREE.CylinderGeometry(innerR * 0.92, innerR * 0.92, beltWidth + 0.032, 12);
      rollerCoreGeo.rotateX(Math.PI / 2);
      const axleGeo = new THREE.CylinderGeometry(0.018, 0.018, beltWidth + 0.068, 10);
      axleGeo.rotateX(Math.PI / 2);
      const lugGeo = new THREE.BoxGeometry(0.028, 0.018, beltWidth * 0.94);

      sides.forEach(({ dir, rotX }) => {
        const podGroup = new THREE.Group();
        podGroup.rotation.x = rotX;
        const basePos = dir.clone().multiplyScalar(podRadialCenter);
        podGroup.position.copy(basePos);

        const beltBand = new THREE.Mesh(beltBandGeo, tpuOrangeMat);
        beltBand.castShadow = true;
        beltBand.receiveShadow = true;
        podGroup.add(beltBand);

        // Twin dark-anodized aluminium track frame rails holding the rollers
        for (const zSign of [-1, 1]) {
          const plate = new THREE.Mesh(sidePlateGeo, darkAnodizedAlMat);
          plate.position.set(0, 0, zSign * (beltWidth * 0.5 + 0.014));
          podGroup.add(plate);
        }

        // Rotating front & rear toothed Aluminium drive rollers + steel axles
        const rollers: THREE.Object3D[] = [];
        for (const rx of [-halfStraight, halfStraight]) {
          const rollerGroup = new THREE.Group();
          rollerGroup.position.x = rx;
          const drum = new THREE.Mesh(rollerCoreGeo, al6061Mat);
          const axle = new THREE.Mesh(axleGeo, steelMat);
          // 4 tiny dark groove ribs on roller so rotation reads clearly in close-up
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(innerR * 1.85, 0.012, beltWidth + 0.038),
            darkAnodizedAlMat
          );
          rollerGroup.add(drum, axle, rib);
          podGroup.add(rollerGroup);
          rollers.push(rollerGroup);
        }

        // Animated transverse tread lugs wrapped around the belt stadium path
        const lugs: THREE.Mesh[] = [];
        const lugCount = 14;
        for (let l = 0; l < lugCount; l++) {
          const lug = new THREE.Mesh(lugGeo, tpuOrangeMat);
          podGroup.add(lug);
          lugs.push(lug);
        }

        segGroup.add(podGroup);
        tagPartRecursive(podGroup, 'tpu_belts', interactables);

        beltPods.push({
          podGroup,
          sideDir: dir,
          lugs,
          rollers,
          length: halfStraight * 2,
          drumRadius: drumR,
          baseOffset: basePos,
        });
      });

      if (seg.id === 'module1') {
        calloutAnchors.push({
          partId: 'belt_module_core',
          label: 'Al 6061 Module Frame',
          object: coreGroup,
          localOffset: new THREE.Vector3(0, -outerRadius - 0.16, 0),
        });
      }
      if (seg.id === 'module2') {
        calloutAnchors.push({
          partId: 'tpu_belts',
          label: '4× TPU 95A Treaded Belts',
          object: segGroup,
          localOffset: new THREE.Vector3(0, beltHalfSpan + 0.56, 0),
        });
        calloutAnchors.push({
          partId: 'n20_motors',
          label: '12× N20 Brass-Gear Motors',
          object: modInternals,
          localOffset: new THREE.Vector3(0, -outerRadius - 0.52, 0.16),
        });
      }
    } else if (seg.type === 'tail') {
      tailGroup = segGroup;

      // Top & Bottom CNC Brushed Aluminium Clamshells for Tail Bay
      tailTopShell = createAluminiumClamshellHalf(
        outerRadius,
        len,
        true,
        alOuterShellMat,
        darkAnodizedAlMat,
        0.042
      );
      tailBottomShell = createAluminiumClamshellHalf(
        outerRadius,
        len,
        false,
        alOuterShellMat,
        darkAnodizedAlMat,
        0.042
      );

      // Machined rear bulkhead cap split across top/bottom
      const rearWallTop = new THREE.Mesh(
        new THREE.CircleGeometry(outerRadius, 28, 0, Math.PI).rotateY(Math.PI / 2),
        alOuterShellMat
      );
      rearWallTop.position.x = len / 2;
      tailTopShell.add(rearWallTop);

      const rearWallBottom = new THREE.Mesh(
        new THREE.CircleGeometry(outerRadius, 28, Math.PI, Math.PI).rotateY(Math.PI / 2),
        alOuterShellMat
      );
      rearWallBottom.position.x = len / 2;
      tailBottomShell.add(rearWallBottom);

      // Stainless steel seam bolts on Tail Bay
      const tailScrews = new THREE.InstancedMesh(screwGeo, bearingSilverMat, 10);
      const dummy = new THREE.Object3D();
      let si = 0;
      for (const zSide of [-1, 1]) {
        for (const xFrac of [-0.38, -0.18, 0.02, 0.22, 0.4]) {
          dummy.position.set(xFrac * len, 0.022, zSide * (outerRadius * 0.97));
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          tailScrews.setMatrixAt(si++, dummy.matrix);
        }
      }
      tailScrews.instanceMatrix.needsUpdate = true;
      tailScrews.computeBoundingSphere();
      tailTopShell.add(tailScrews);

      segGroup.add(tailTopShell, tailBottomShell);
      tagPartRecursive(tailTopShell, 'tail_shell', interactables);
      tagPartRecursive(tailBottomShell, 'tail_shell', interactables);
      calloutAnchors.push({
        partId: 'tail_shell',
        label: 'Tail Bay Shell (Al 6061)',
        object: tailTopShell,
        localOffset: new THREE.Vector3(0, outerRadius + 0.16, 0),
      });

      // CNC Aluminium M6 Retrieval Eyebolt + Internal Backing Plate + Rubber Tether Gland
      eyeboltGroup = new THREE.Group();
      eyeboltGroup.position.x = len / 2;
      const backingPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.032, 18).rotateZ(Math.PI / 2),
        al6061Mat
      );
      backingPlate.position.x = -0.05;
      const boltCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.072, 0.085, 16).rotateZ(Math.PI / 2),
        al6061Mat
      );
      boltCollar.position.x = 0.035;
      const eyeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.028, 12, 24),
        al6061Mat
      );
      eyeRing.position.x = 0.145;
      // Strain-relief rubber cable gland for USB-Ethernet tether
      const tetherGland = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.048, 0.09, 12).rotateZ(Math.PI / 2),
        darkOpticMat
      );
      tetherGland.position.set(0.04, -0.14, 0.08);
      eyeboltGroup.add(backingPlate, boltCollar, eyeRing, tetherGland);
      segGroup.add(eyeboltGroup);
      tagPartRecursive(eyeboltGroup, 'retrieval_anchor', interactables);
      calloutAnchors.push({
        partId: 'retrieval_anchor',
        label: 'M6 Eyebolt & Tether Gland',
        object: eyeboltGroup,
        localOffset: new THREE.Vector3(0.28, 0.24, 0),
      });

      // Studio-mode trailing tether cable & braided Dyneema recovery line exiting tail bulkhead
      studioTetherGroup = new THREE.Group();
      studioTetherGroup.position.x = len / 2;
      const studioTetherCable = createWireTube(
        [
          [0.08, -0.14, 0.08],
          [0.55, -0.26, 0.14],
          [1.05, -0.44, 0.24],
          [1.65, -0.58, 0.18],
        ],
        0.022,
        wireSleeveMat,
        24
      );
      const studioDyneemaLine = createWireTube(
        [
          [0.21, 0.0, 0.0],
          [0.62, -0.18, -0.06],
          [1.15, -0.46, -0.12],
          [1.72, -0.58, -0.08],
        ],
        0.011,
        dyneemaMat,
        24
      );
      studioTetherGroup.add(studioTetherCable, studioDyneemaLine);
      segGroup.add(studioTetherGroup);
      tagPartRecursive(studioTetherGroup, 'wiring_harness', interactables);

      // === TAIL BAY INTERNALS + COMPLETE POWER, DRIVER & SERVO WIRING HARNESS ===
      tailInternalsGroup = new THREE.Group();

      // 2 × 18650 Li-ion cells + 2S BMS + 10 A yellow blade fuse + Dual Bucks + Main Switch
      const powerGroup = new THREE.Group();
      const cellGeo = new THREE.CylinderGeometry(0.092, 0.092, 0.65, 20).rotateZ(Math.PI / 2);
      const cellLeft = new THREE.Mesh(cellGeo, batteryBlueMat);
      cellLeft.position.set(0.12, -0.15, -0.11);
      const cellRight = new THREE.Mesh(cellGeo, batteryBlueMat);
      cellRight.position.set(0.12, -0.15, 0.11);
      // Nickel spot-weld end caps on 18650 cells
      const capGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14).rotateZ(Math.PI / 2);
      for (const zc of [-0.11, 0.11]) {
        for (const xc of [-0.21, 0.45]) {
          const cap = new THREE.Mesh(capGeo, bearingSilverMat);
          cap.position.set(xc, -0.15, zc);
          powerGroup.add(cap);
        }
      }
      const bmsBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.34), pcbGreenMat);
      bmsBoard.position.set(0.47, -0.14, 0);
      const fuse10A = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), wireYellowMat);
      fuse10A.position.set(0.45, -0.01, -0.18);
      const buck5v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.15), pcbBlueMat);
      buck5v.position.set(0.28, 0.02, -0.15);
      const buck6v = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.16), pcbRedMat);
      buck6v.position.set(0.28, 0.02, 0.15);
      const mainSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.09), pcbRedMat);
      mainSwitch.position.set(0.46, 0.15, 0);
      powerGroup.add(cellLeft, cellRight, bmsBoard, fuse10A, buck5v, buck6v, mainSwitch);
      tagPartRecursive(powerGroup, 'battery_power', interactables);
      tailInternalsGroup.add(powerGroup);
      calloutAnchors.push({
        partId: 'battery_power',
        label: '2× 18650 Pack, BMS & Bucks',
        object: powerGroup,
        localOffset: new THREE.Vector3(0.05, -0.58, 0),
      });

      // ESP32 DevKit + 2× MCP23017 Expanders (upper deck)
      const espGroup = new THREE.Group();
      const espBoard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.028, 0.26), pcbGreenMat);
      const espRfCan = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.16), bearingSilverMat);
      espRfCan.position.set(0.12, 0.028, 0);
      const mcp1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.085), darkOpticMat);
      mcp1.position.set(-0.14, 0.026, -0.07);
      const mcp2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.085), darkOpticMat);
      mcp2.position.set(-0.14, 0.026, 0.07);
      espGroup.add(espBoard, espRfCan, mcp1, mcp2);
      espGroup.position.set(0.08, 0.17, 0);
      tagPartRecursive(espGroup, 'esp32_devkit', interactables);
      tailInternalsGroup.add(espGroup);

      // 6× TB6612FNG Motor Drivers
      const driversGroup = new THREE.Group();
      const drvGeo = new THREE.BoxGeometry(0.034, 0.12, 0.14);
      for (let d = 0; d < 6; d++) {
        const drv = new THREE.Mesh(drvGeo, pcbRedMat);
        drv.position.set(-0.14 + d * 0.056, 0.04, 0);
        driversGroup.add(drv);
      }
      driversGroup.position.set(-0.08, 0.0, 0);
      tagPartRecursive(driversGroup, 'motor_drivers', interactables);
      tailInternalsGroup.add(driversGroup);

      // 8× MG90S Metal-Gear Micro Servos + Rotating Horns + PCA9685 Servo Driver
      const servoGroup = new THREE.Group();
      const pcaBoard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.2), pcbBlueMat);
      pcaBoard.position.set(-0.28, 0.22, 0);
      servoGroup.add(pcaBoard);

      const singleServoGeo = new THREE.BoxGeometry(0.155, 0.088, 0.078);
      const hornGeo = new THREE.BoxGeometry(0.018, 0.095, 0.024);
      for (let s = 0; s < 8; s++) {
        const angle = (s / 8) * Math.PI * 2;
        const svUnit = new THREE.Group();
        const svBody = new THREE.Mesh(singleServoGeo, servoBlueMat);
        const svGearTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10),
          brassMat
        );
        svGearTop.position.set(-0.042, 0.052, 0);
        const hornPivot = new THREE.Group();
        hornPivot.position.set(-0.042, 0.072, 0);
        const hornArm = new THREE.Mesh(hornGeo, al6061Mat);
        hornArm.rotation.z = Math.PI / 2;
        hornPivot.add(hornArm);
        servoHorns.push(hornPivot);
        svUnit.add(svBody, svGearTop, hornPivot);
        svUnit.position.set(-0.42, Math.sin(angle) * 0.19, Math.cos(angle) * 0.19);
        svUnit.rotation.x = angle;
        servoGroup.add(svUnit);

        // 3-wire servo lead (orange/red/black) routing from each MG90S up to PCA9685
        const sy = Math.sin(angle) * 0.19;
        const sz = Math.cos(angle) * 0.19;
        servoGroup.add(
          createWireTube(
            [
              [-0.36, sy, sz],
              [-0.32, sy * 0.6 + 0.08, sz * 0.75],
              [-0.28, 0.21, (s - 3.5) * 0.022],
            ],
            0.0075,
            s % 2 === 0 ? wireOrangeMat : wireRedMat,
            10
          )
        );
      }
      tagPartRecursive(servoGroup, 'servos_pca9685', interactables);
      tailInternalsGroup.add(servoGroup);

      // REAL 3D TAIL POWER & MOTOR WIRING HARNESSES
      const tailWiring = new THREE.Group();
      // Heavy 18650 pack -> BMS -> 10A Fuse -> Main Switch -> 5V & 6V Bucks
      tailWiring.add(
        createWireTube([[0.46, -0.12, -0.11], [0.47, -0.04, -0.18], [0.46, 0.14, -0.02]], 0.014, wireRedMat),
        createWireTube([[0.46, -0.16, 0.11], [0.42, -0.06, 0.16], [0.34, 0.02, 0.14]], 0.014, wireBlackMat),
        createWireTube([[0.43, 0.14, 0.03], [0.35, 0.09, 0.14], [0.28, 0.04, 0.15]], 0.012, wireRedMat),
        createWireTube([[0.43, 0.14, -0.03], [0.35, 0.09, -0.14], [0.28, 0.04, -0.15]], 0.012, wireRedMat)
      );
      // 5V & I2C/UART bus wires: Bucks -> ESP32 -> PCA9685 -> Core Harness entry
      tailWiring.add(
        createWireTube([[0.22, 0.04, -0.15], [0.16, 0.14, -0.11], [-0.15, 0.17, -0.06], [-0.56, 0.02, -0.03]], 0.011, wireRedMat),
        createWireTube([[0.22, 0.02, -0.13], [0.16, 0.12, -0.09], [-0.15, 0.15, -0.04], [-0.56, -0.02, -0.02]], 0.011, wireBlackMat),
        createWireTube([[0.04, 0.18, 0.08], [-0.14, 0.21, 0.05], [-0.26, 0.22, 0.03]], 0.009, wireYellowMat),
        createWireTube([[0.02, 0.18, -0.08], [-0.16, 0.14, -0.05], [-0.56, 0.03, 0.02]], 0.0095, wireGreenMat)
      );
      // 6x TB6612FNG -> Core motor wire bundle exiting front of Tail Bay into Joint 4
      for (let d = 0; d < 6; d++) {
        const dx = -0.22 + d * 0.056;
        tailWiring.add(
          createWireTube(
            [
              [dx, 0.02, (d % 2 === 0 ? 1 : -1) * 0.06],
              [-0.35, -0.03, (d - 2.5) * 0.022],
              [-0.58, 0.0, (d - 2.5) * 0.014],
            ],
            0.009,
            d % 2 === 0 ? wireBlueMat : wireOrangeMat,
            12
          )
        );
      }
      tagPartRecursive(tailWiring, 'wiring_harness', interactables);
      tailInternalsGroup.add(tailWiring);

      segGroup.add(tailInternalsGroup);
    }
  });

  // Record original materials so Thermal View restores cleanly
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      originalMaterials.set(m, m.material);
    }
  });

  let heartbeatEnabled = false;
  let thermalEnabled = false;

  const setHeartbeatVisible = (visible: boolean) => {
    heartbeatEnabled = visible;
    heartbeatGroup.visible = visible;
    noseHeartbeatRing.visible = visible;
  };

  const setThermalMode = (enabled: boolean) => {
    thermalEnabled = enabled;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh === headLedBeam) {
          mesh.visible = false;
          return;
        }
        if (enabled) {
          const pid = mesh.userData.partId as string | undefined;
          const isWarmInternal =
            pid === 'pi_zero' ||
            pid === 'battery_power' ||
            pid === 'esp32_devkit' ||
            pid === 'n20_motors' ||
            pid === 'servos_pca9685';
          mesh.material = isWarmInternal ? thermalWarmInternalMat : thermalRobotMat;
        } else {
          const orig = originalMaterials.get(mesh);
          if (orig) mesh.material = orig;
        }
      }
    });
  };

  const advanceBelts = (phase: number) => {
    const wheelAngle = phase * Math.PI * 2;
    for (const shaft of motorShafts) {
      shaft.rotation.x = wheelAngle * 2.2;
    }

    for (const pod of beltPods) {
      for (const roller of pod.rollers) {
        roller.rotation.z = -wheelAngle;
      }

      const straight = pod.length;
      const r = pod.drumRadius + 0.008;
      const perimeter = 2 * straight + 2 * Math.PI * r;
      const count = pod.lugs.length;

      for (let i = 0; i < count; i++) {
        const s = (((i / count) + (phase % 1) + 1) % 1) * perimeter;
        const lug = pod.lugs[i];
        const halfS = straight * 0.5;
        const arcLen = Math.PI * r;

        if (s < straight) {
          lug.position.set(-halfS + s, r, 0);
          lug.rotation.set(0, 0, 0);
        } else if (s < straight + arcLen) {
          const a = ((s - straight) / arcLen) * Math.PI;
          lug.position.set(halfS + Math.sin(a) * r, Math.cos(a) * r, 0);
          lug.rotation.set(0, 0, -a);
        } else if (s < 2 * straight + arcLen) {
          const d = s - (straight + arcLen);
          lug.position.set(halfS - d, -r, 0);
          lug.rotation.set(0, 0, Math.PI);
        } else {
          const a = ((s - (2 * straight + arcLen)) / arcLen) * Math.PI;
          lug.position.set(-halfS - Math.sin(a) * r, -Math.cos(a) * r, 0);
          lug.rotation.set(0, 0, Math.PI - a);
        }
      }
    }
  };

  advanceBelts(0);

  const setJointAngles = (angles: Array<{ yaw: number; pitch: number }>) => {
    joints.forEach((joint, i) => {
      const ang = angles[i] ?? { yaw: 0, pitch: 0 };
      joint.yokeB.rotation.y = ang.yaw;
      joint.yokeB.rotation.z = ang.pitch;
      joint.crossGroup.rotation.y = ang.yaw * 0.5;
      joint.crossGroup.rotation.z = ang.pitch * 0.5;
      joint.wireBundle.rotation.y = ang.yaw * 0.45;
      joint.wireBundle.rotation.z = ang.pitch * 0.45;

      joint.cables.forEach((cable, ci) => {
        const ySign = ci === 0 || ci === 1 ? 1 : -1;
        const zSign = ci === 0 || ci === 3 ? 1 : -1;
        const pull = 1 + (ang.pitch * ySign + ang.yaw * zSign) * 0.14;
        cable.scale.set(pull, 1, 1);
      });
    });

    // Rotate the 8 MG90S servo horns proportionally to active joint angles
    servoHorns.forEach((horn, idx) => {
      const j = angles[Math.floor(idx / 2)] ?? { yaw: 0, pitch: 0 };
      horn.rotation.y = (idx % 2 === 0 ? j.yaw : j.pitch) * 1.6;
    });
  };

  const setViewMode = (
    mode: ViewMode,
    explodeFactor: number,
    cutawayFactor: number,
    selectedPartId: string | null
  ) => {
    const exp = mode === 'explode' ? Math.max(0.05, explodeFactor) : 0;
    const cut = mode === 'outer' || mode === 'inner' ? cutawayFactor : 0;

    if (mode !== 'simulate') {
      const centers = computeExplodedCenters(layout.placements, exp, 0.44);
      segmentGroups.forEach((grp, idx) => {
        grp.position.set(centers[idx], 0, 0);
        grp.rotation.set(0, 0, 0);
      });
    }

    const isInner = mode === 'inner';
    const isOuter = mode === 'outer';
    const isSim = mode === 'simulate';

    // Hide static studio tether in Simulate mode (dynamic spline tether takes over in rubble!)
    studioTetherGroup.visible = !isSim;

    if (!thermalEnabled) {
      alOuterShellMat.transparent = isInner;
      alOuterShellMat.opacity = isInner ? 0.2 : 1.0;
      alOuterShellMat.depthWrite = !isInner;
      alOuterShellMat.needsUpdate = true;

      tpuSleeveMat.transparent = isInner;
      tpuSleeveMat.opacity = isInner ? 0.22 : 1.0;
      tpuSleeveMat.depthWrite = !isInner;
      tpuSleeveMat.needsUpdate = true;
    }

    const shellLiftY = exp * 0.54 + cut * 0.5;
    const shellDropY = -exp * 0.46;
    headTopShell.position.y = shellLiftY;
    headBottomShell.position.y = shellDropY;
    tailTopShell.position.y = shellLiftY;
    tailBottomShell.position.y = shellDropY;

    const noseBaseX = -layout.placements[0].lengthUnits / 2 + data.dimensions.noseLengthMm / 200;
    noseCapGroup.position.x = noseBaseX - exp * 0.44;
    eyeboltGroup.position.x = layout.placements[8].lengthUnits / 2 + exp * 0.34;

    // Radial expansion of all 12 belt pods on Explode (exposing all 12 brass-gearbox N20 motors!)
    beltPods.forEach((pod) => {
      pod.podGroup.position
        .copy(pod.baseOffset)
        .addScaledVector(pod.sideDir, exp * 0.42);
    });

    // Lift TPU joint boots upward on Explode to expose cardan yokes, steel cables & wiring harness
    joints.forEach((j) => {
      j.sleeveMesh.position.y = exp * 0.44;
    });

    // Module N20 motors & wiring harness remain ALWAYS visible through the open-frame aluminium chassis!
    const showBayInternals = !isOuter || cut > 0.04;
    headInternalsGroup.visible = showBayInternals;
    tailInternalsGroup.visible = showBayInternals;
    moduleInternals.forEach((m) => {
      m.visible = true;
    });

    heartbeatGroup.visible = showBayInternals && heartbeatEnabled;
    noseHeartbeatRing.visible = heartbeatEnabled;

    if (!thermalEnabled) {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh === headLedBeam) return;
          const pid = mesh.userData.partId as string | undefined;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && 'emissive' in mat && mat !== ledEmissiveMat && mat !== heartbeatMat) {
            if (selectedPartId && pid === selectedPartId) {
              mat.emissive.setHex(0x6b2f06);
              mat.emissiveIntensity = 0.72;
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        }
      });
    }
  };

  const setLedIntensity = (intensity: number) => {
    headLedLight.intensity = intensity;
    ledEmissiveMat.emissiveIntensity = 0.85 + intensity * 0.48;
    headLedBeam.visible = !thermalEnabled && intensity > 2.5;
  };

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    allCreatedGeometries.forEach((g) => g.dispose());
    allCreatedMaterials.forEach((m) => m.dispose());
  };

  return {
    root,
    segmentGroups,
    headGroup,
    tailGroup,
    headTopShell,
    headBottomShell,
    tailTopShell,
    tailBottomShell,
    noseCapGroup,
    headInternalsGroup,
    tailInternalsGroup,
    heartbeatGroup,
    noseHeartbeatRing,
    headLedLight,
    headLedBeam,
    headLedMeshes,
    cameraMountNode,
    joints,
    beltPods,
    motorShafts,
    servoHorns,
    moduleInternals,
    eyeboltGroup,
    studioTetherGroup,
    interactables,
    calloutAnchors,
    setViewMode,
    setHeartbeatVisible,
    setThermalMode,
    setJointAngles,
    advanceBelts,
    setLedIntensity,
    dispose,
  };
}
