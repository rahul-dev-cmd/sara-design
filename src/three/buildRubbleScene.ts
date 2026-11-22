import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface RubbleSimulationRig {
  group: THREE.Group;
  crawlCurve: THREE.CatmullRomCurve3;
  personAAnchor: THREE.Object3D;
  personBAnchor: THREE.Object3D;
  personARing: THREE.Mesh;
  personBRing: THREE.Mesh;
  dustPoints: THREE.Points;
  update: (elapsed: number, heartbeatEnabled: boolean) => void;
  updateTrailingLines: (tailU: number) => void;
  setThermalMode: (enabled: boolean) => void;
  dispose: () => void;
}

/**
 * Generates a realistic fractured concrete slab with irregular chipped perimeter edges
 * instead of a plain smooth BoxGeometry.
 */
function createFracturedSlabGeometry(
  width: number,
  thickness: number,
  depth: number,
  seed: number
): THREE.ExtrudeGeometry {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const hw = width * 0.5;
  const hd = depth * 0.5;
  const shape = new THREE.Shape();

  // Build jagged fractured polygon around slab perimeter
  const pts: Array<[number, number]> = [];
  const segsX = 6;
  const segsZ = 4;

  for (let i = 0; i <= segsX; i++) {
    const x = -hw + (i / segsX) * width;
    const jitter = i === 0 || i === segsX ? 0 : (rand() - 0.5) * depth * 0.2;
    pts.push([x, -hd + jitter]);
  }
  for (let i = 1; i <= segsZ; i++) {
    const z = -hd + (i / segsZ) * depth;
    const jitter = i === segsZ ? 0 : (rand() - 0.5) * width * 0.14;
    pts.push([hw + jitter, z]);
  }
  for (let i = segsX - 1; i >= 0; i--) {
    const x = -hw + (i / segsX) * width;
    const jitter = i === 0 ? 0 : (rand() - 0.5) * depth * 0.2;
    pts.push([x, hd + jitter]);
  }
  for (let i = segsZ - 1; i >= 1; i--) {
    const z = -hd + (i / segsZ) * depth;
    const jitter = (rand() - 0.5) * width * 0.14;
    pts.push([-hw + jitter, z]);
  }

  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.045,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

/**
 * Builds a rusted structural steel H-beam / girder fragment for authentic building collapse context.
 */
function createSteelIBeam(length: number, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const web = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 0.03), material);
  const topFlange = new THREE.Mesh(new THREE.BoxGeometry(length, 0.03, 0.18), material);
  topFlange.position.y = 0.11;
  const botFlange = new THREE.Mesh(new THREE.BoxGeometry(length, 0.03, 0.18), material);
  botFlange.position.y = -0.11;
  g.add(web, topFlange, botFlange);
  return g;
}

/**
 * Creates a dignified, non-graphic, muted-matte sheltered human silhouette in rescue posture
 * (dusty charcoal clothing + subtle reflective jacket trim) — completely avoiding bright white "snowman" blobs.
 */
function createShelteredPerson(
  jacketMat: THREE.Material,
  trouserMat: THREE.Material,
  hoodMat: THREE.Material,
  reflectorMat: THREE.Material,
  ringColor: number
): { group: THREE.Group; chest: THREE.Mesh; ring: THREE.Mesh; bodyMeshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMeshes: THREE.Mesh[] = [];

  // Sheltered torso leaning against rubble void
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.36, 8, 14), jacketMat);
  chest.position.set(0, 0.36, 0);
  chest.rotation.z = 0.36;
  chest.castShadow = true;
  group.add(chest);
  bodyMeshes.push(chest);

  // Subtle reflective safety stripe band across jacket (catches headlamp naturally)
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.188, 0.05, 14), reflectorMat);
  stripe.position.set(0.01, 0.36, 0);
  stripe.rotation.z = 0.36;
  group.add(stripe);
  bodyMeshes.push(stripe);

  // Hooded head tucked down safely
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), hoodMat);
  head.position.set(-0.15, 0.69, 0);
  head.scale.set(0.95, 1.05, 0.92);
  head.castShadow = true;
  group.add(head);
  bodyMeshes.push(head);

  // Forearms braced near knees
  const armGeo = new THREE.CapsuleGeometry(0.052, 0.32, 6, 10);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, jacketMat);
    arm.position.set(0.1, 0.37, side * 0.19);
    arm.rotation.z = -0.92;
    arm.rotation.y = side * 0.22;
    group.add(arm);
    bodyMeshes.push(arm);
  }

  // Bent sheltered legs
  const legGeo = new THREE.CapsuleGeometry(0.072, 0.38, 6, 10);
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(legGeo, trouserMat);
    thigh.position.set(0.24, 0.16, side * 0.12);
    thigh.rotation.z = Math.PI / 2 - 0.32;
    group.add(thigh);
    bodyMeshes.push(thigh);

    const shin = new THREE.Mesh(legGeo, trouserMat);
    shin.position.set(0.46, 0.11, side * 0.13);
    shin.rotation.z = -0.45;
    group.add(shin);
    bodyMeshes.push(shin);
  }

  // Subtle tactical ground locator ring beneath sheltered pocket
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.47, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    })
  );
  ring.position.y = 0.025;
  group.add(ring);

  return { group, chest, ring, bodyMeshes };
}

/**
 * Builds an authentic collapsed-building rubble crawl corridor for SARA's Concept Simulation:
 * fractured polygonal concrete slabs, rusted steel girders & rebar grids, masonry/brick rubble,
 * dynamic trailing tether + Dyneema recovery line, suspended concrete dust, and sheltered figures.
 */
export function buildRubbleScene(textures: ProceduralTextureSet): RubbleSimulationRig {
  const group = new THREE.Group();
  group.name = 'Rubble_Concept_Simulation';
  group.visible = false;

  const concreteMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8ccd2'),
    map: textures.concreteAlbedo,
    bumpMap: textures.concreteBump,
    bumpScale: 0.065,
    roughness: 0.94,
    metalness: 0.03,
  });

  const darkConcreteMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8e949e'),
    map: textures.concreteAlbedo,
    bumpMap: textures.concreteBump,
    bumpScale: 0.075,
    roughness: 0.96,
    metalness: 0.04,
  });

  const brickDebrisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7c4a3a'),
    bumpMap: textures.concreteBump,
    bumpScale: 0.05,
    roughness: 0.92,
    metalness: 0.02,
  });

  const rebarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a3928'),
    roughness: 0.72,
    metalness: 0.78,
  });

  const girderMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#47352c'),
    bumpMap: textures.concreteBump,
    bumpScale: 0.02,
    roughness: 0.68,
    metalness: 0.76,
  });

  // Realistic muted matte rescue-clothing materials (NO shiny white or light-blue toy blobs!)
  const jacketAMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#27303a'),
    roughness: 0.95,
    metalness: 0.02,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1f242b'),
    roughness: 0.96,
    metalness: 0.02,
  });
  const hoodAMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d3640'),
    roughness: 0.94,
    metalness: 0.02,
  });
  const jacketBMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a2c32'),
    roughness: 0.95,
    metalness: 0.02,
  });
  const reflectorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#64748b'),
    roughness: 0.55,
    metalness: 0.2,
  });

  // Thermal FLIR ironbow false-color override materials
  const thermalColdMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#18143b'),
    emissive: new THREE.Color('#110d2e'),
    emissiveIntensity: 0.45,
    roughness: 0.85,
  });
  const thermalRebarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d1b5e'),
    emissive: new THREE.Color('#1e1244'),
    emissiveIntensity: 0.4,
    roughness: 0.7,
  });
  const thermalPersonAMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    emissive: new THREE.Color('#f97316'),
    emissiveIntensity: 1.55,
    roughness: 0.3,
  });
  const thermalPersonBMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6d28d9'),
    emissive: new THREE.Color('#4c1d95'),
    emissiveIntensity: 0.6,
    roughness: 0.55,
  });

  const rubbleMeshes: Array<{ mesh: THREE.Mesh; origMat: THREE.Material }> = [];
  const metalMeshes: Array<{ mesh: THREE.Mesh; origMat: THREE.Material }> = [];

  // 1. Dusty uneven concrete collapse floor with scattered sub-layer slabs
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.32, 16), darkConcreteMat);
  floor.position.set(0, -0.58, 0);
  floor.receiveShadow = true;
  group.add(floor);
  rubbleMeshes.push({ mesh: floor, origMat: darkConcreteMat });

  // 2. Sculpted fractured concrete slabs forming an authentic leaning collapse void
  // Foreground (+Z) stays cut open as a clear architectural cross-section so SARA is never occluded
  const slabSpecs: Array<{
    pos: [number, number, number];
    size: [number, number, number];
    rot: [number, number, number];
    seed: number;
    dark?: boolean;
  }> = [
    // Rear collapsed wall slabs (-Z side)
    { pos: [3.8, 0.92, -2.35], size: [5.4, 0.44, 3.0], rot: [0.34, 0.08, -0.11], seed: 101 },
    { pos: [-1.4, 1.12, -2.55], size: [6.4, 0.48, 3.2], rot: [0.28, -0.12, 0.07], seed: 202, dark: true },
    { pos: [-6.6, 0.88, -2.2], size: [5.6, 0.46, 3.0], rot: [0.36, 0.14, -0.08], seed: 303 },
    // Leaning fractured ceiling lintel slabs creating the real tight crawl tunnel overhead
    { pos: [1.4, 1.88, -0.95], size: [4.6, 0.38, 3.1], rot: [0.22, 0.06, -0.17], seed: 404, dark: true },
    { pos: [-4.2, 1.98, -0.82], size: [5.1, 0.42, 3.2], rot: [0.16, -0.1, 0.15], seed: 505 },
    // Low broken concrete curbing on foreground (+Z side, kept well below camera sightline)
    { pos: [3.4, -0.22, 2.55], size: [4.6, 0.38, 1.4], rot: [-0.2, -0.12, 0.08], seed: 606, dark: true },
    { pos: [-2.2, -0.24, 2.65], size: [4.8, 0.36, 1.5], rot: [-0.16, 0.14, -0.06], seed: 707 },
    { pos: [-6.8, -0.2, 2.4], size: [4.4, 0.38, 1.4], rot: [-0.18, -0.08, 0.1], seed: 808, dark: true },
    // Jagged pinch-point concrete chunks that force SARA's cardan joints to weave
    { pos: [1.55, -0.28, 1.15], size: [1.45, 0.34, 0.9], rot: [0.06, 0.35, -0.08], seed: 909 },
    { pos: [-2.4, -0.28, -1.2], size: [1.65, 0.34, 0.95], rot: [-0.04, -0.28, 0.06], seed: 1010, dark: true },
  ];

  slabSpecs.forEach((s) => {
    const mat = s.dark ? darkConcreteMat : concreteMat;
    const slab = new THREE.Mesh(createFracturedSlabGeometry(s.size[0], s.size[1], s.size[2], s.seed), mat);
    slab.position.set(...s.pos);
    slab.rotation.set(...s.rot);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
    rubbleMeshes.push({ mesh: slab, origMat: mat });
  });

  // 3. Collapsed rusted structural steel I-beams bracing the rubble canopy
  const beamA = createSteelIBeam(4.8, girderMat);
  beamA.position.set(-0.6, 1.48, -1.45);
  beamA.rotation.set(0.18, 0.24, -0.22);
  group.add(beamA);
  beamA.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) metalMeshes.push({ mesh: c as THREE.Mesh, origMat: girderMat });
  });

  const beamB = createSteelIBeam(3.6, girderMat);
  beamB.position.set(-5.2, 1.35, -1.55);
  beamB.rotation.set(0.12, -0.35, 0.26);
  group.add(beamB);
  beamB.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) metalMeshes.push({ mesh: c as THREE.Mesh, origMat: girderMat });
  });

  // 4. Protruding twisted steel rebar rods emerging from fractured concrete edges
  const rebarGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.7, 6);
  const rebarCoords: Array<{ pos: [number, number, number]; rot: [number, number, number] }> = [
    { pos: [2.2, 0.85, -1.1], rot: [0.8, 0.2, 1.1] },
    { pos: [1.9, 1.32, -0.9], rot: [0.5, -0.3, 1.3] },
    { pos: [-0.6, 1.45, -1.05], rot: [-0.6, 0.2, -1.1] },
    { pos: [-3.3, 1.25, -1.2], rot: [0.7, 0.4, 0.9] },
    { pos: [-5.1, 1.28, -0.9], rot: [-0.8, -0.2, -1.0] },
    { pos: [4.2, 0.58, -1.2], rot: [-0.5, 0.3, 1.2] },
    { pos: [-1.8, 1.55, -0.6], rot: [0.4, -0.5, 1.35] },
  ];
  rebarCoords.forEach((rc) => {
    const rod = new THREE.Mesh(rebarGeo, rebarMat);
    rod.position.set(...rc.pos);
    rod.rotation.set(...rc.rot);
    group.add(rod);
    metalMeshes.push({ mesh: rod, origMat: rebarMat });
  });

  // 5. Dense angular concrete & broken brick rubble chunks (InstancedMesh, zero draw-call bloat)
  let seed = 4201;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const chunkCount = 130;
  const chunkGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const chunkInst = new THREE.InstancedMesh(chunkGeo, concreteMat, chunkCount);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < chunkCount; i++) {
    const x = -9.5 + rand() * 18.5;
    const zSide = rand() > 0.45 ? -1 : 1;
    // Keep the immediate crawl spline center clean while piling rubble realistically along edges
    const z = zSide * (0.72 + rand() * 2.9);
    const scale = 0.42 + rand() * 1.45;
    dummy.position.set(x, -0.38 + scale * 0.08, z);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.set(scale * (0.75 + rand() * 0.65), scale * (0.48 + rand() * 0.38), scale);
    dummy.updateMatrix();
    chunkInst.setMatrixAt(i, dummy.matrix);
    const luma = 0.52 + rand() * 0.44;
    tint.setRGB(luma, luma * 0.99, luma * 0.97);
    chunkInst.setColorAt(i, tint);
  }
  chunkInst.instanceMatrix.needsUpdate = true;
  if (chunkInst.instanceColor) chunkInst.instanceColor.needsUpdate = true;
  chunkInst.computeBoundingSphere();
  group.add(chunkInst);

  // Scattered broken clay masonry bricks for realistic architectural debris color breakup
  const brickCount = 34;
  const brickGeo = new THREE.BoxGeometry(0.22, 0.09, 0.12);
  const brickInst = new THREE.InstancedMesh(brickGeo, brickDebrisMat, brickCount);
  for (let i = 0; i < brickCount; i++) {
    const x = -8.5 + rand() * 16.5;
    const zSide = rand() > 0.5 ? -1 : 1;
    const z = zSide * (0.85 + rand() * 2.4);
    dummy.position.set(x, -0.38, z);
    dummy.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    dummy.scale.set(0.75 + rand() * 0.5, 0.8 + rand() * 0.3, 0.8 + rand() * 0.4);
    dummy.updateMatrix();
    brickInst.setMatrixAt(i, dummy.matrix);
  }
  brickInst.instanceMatrix.needsUpdate = true;
  brickInst.computeBoundingSphere();
  group.add(brickInst);

  // 6. Two dignified, muted-matte sheltered human silhouettes in rubble pockets
  const personA = createShelteredPerson(jacketAMat, trouserMat, hoodAMat, reflectorMat, 0x22c55e);
  personA.group.position.set(-2.35, -0.42, -1.2);
  personA.group.rotation.y = 0.68;
  group.add(personA.group);

  const personB = createShelteredPerson(jacketBMat, trouserMat, trouserMat, reflectorMat, 0xf59e0b);
  personB.group.position.set(-6.45, -0.42, 0.98);
  personB.group.rotation.y = -0.78;
  group.add(personB.group);

  // 7. Suspended airborne rubble dust motes
  const dustCount = 260;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = -9.5 + rand() * 18;
    dustPositions[i * 3 + 1] = -0.25 + rand() * 2.5;
    dustPositions[i * 3 + 2] = -3.2 + rand() * 6.4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xb8c2ce,
    size: 0.038,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  group.add(dustPoints);

  // 8. Curved crawl spline through rubble gap (+X entrance -> weaving past debris -> Person A -> Person B)
  const crawlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(7.6, 0.06, 0.15),
    new THREE.Vector3(4.3, 0.08, -0.22),
    new THREE.Vector3(1.4, 0.07, -0.48),
    new THREE.Vector3(-0.85, 0.12, 0.28),
    new THREE.Vector3(-3.0, 0.07, 0.12),
    new THREE.Vector3(-5.2, 0.08, -0.32),
    new THREE.Vector3(-7.6, 0.07, 0.06),
  ]);

  // 9. Dynamic trailing USB-Ethernet tether + braided Dyneema recovery line behind SARA's tail!
  const trailCount = 28;
  const tetherPositions = new Float32Array(trailCount * 3);
  const dyneemaPositions = new Float32Array(trailCount * 3);

  const tetherGeo = new THREE.BufferGeometry();
  tetherGeo.setAttribute('position', new THREE.BufferAttribute(tetherPositions, 3));
  const tetherLineMat = new THREE.LineBasicMaterial({ color: 0x1e293b });
  const tetherLine = new THREE.Line(tetherGeo, tetherLineMat);
  tetherLine.frustumCulled = false;

  const dyneemaGeo = new THREE.BufferGeometry();
  dyneemaGeo.setAttribute('position', new THREE.BufferAttribute(dyneemaPositions, 3));
  const dyneemaLineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
  const dyneemaLine = new THREE.Line(dyneemaGeo, dyneemaLineMat);
  dyneemaLine.frustumCulled = false;
  group.add(tetherLine, dyneemaLine);

  const _pt = new THREE.Vector3();
  const updateTrailingLines = (tailU: number) => {
    const startU = Math.max(0.01, Math.min(0.95, tailU));
    const tPos = tetherGeo.attributes.position as THREE.BufferAttribute;
    const dPos = dyneemaGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < trailCount; i++) {
      const f = i / (trailCount - 1);
      const u = Math.max(0.0, startU * (1 - f));
      crawlCurve.getPointAt(u, _pt);
      const dropY = THREE.MathUtils.lerp(0.0, -0.36, Math.min(1, f * 3.5));
      tPos.setXYZ(i, _pt.x, _pt.y + dropY, _pt.z + 0.08 + Math.sin(f * 5) * 0.05);
      dPos.setXYZ(i, _pt.x, _pt.y + dropY + 0.02, _pt.z - 0.08 - Math.sin(f * 4) * 0.04);
    }
    tPos.needsUpdate = true;
    dPos.needsUpdate = true;
  };
  updateTrailingLines(0.15);

  const setThermalMode = (enabled: boolean) => {
    rubbleMeshes.forEach(({ mesh, origMat }) => {
      mesh.material = enabled ? thermalColdMat : origMat;
    });
    chunkInst.material = enabled ? thermalColdMat : concreteMat;
    brickInst.material = enabled ? thermalColdMat : brickDebrisMat;
    metalMeshes.forEach(({ mesh, origMat }) => {
      mesh.material = enabled ? thermalRebarMat : origMat;
    });
    personA.bodyMeshes.forEach((m, idx) => {
      m.material = enabled
        ? thermalPersonAMat
        : idx === 1
          ? reflectorMat
          : idx === 2
            ? hoodAMat
            : idx >= 5
              ? trouserMat
              : jacketAMat;
    });
    personB.bodyMeshes.forEach((m, idx) => {
      m.material = enabled
        ? thermalPersonBMat
        : idx === 1
          ? reflectorMat
          : idx >= 2
            ? trouserMat
            : jacketBMat;
    });
    dustMat.color.setHex(enabled ? 0x6366f1 : 0xb8c2ce);
    dustMat.opacity = enabled ? 0.22 : 0.36;
  };

  const update = (elapsed: number, heartbeatEnabled: boolean) => {
    const breath = 1 + Math.sin(elapsed * 2.4) * 0.035;
    personA.chest.scale.set(breath, 1, breath);

    const ringAMat = personA.ring.material as THREE.MeshBasicMaterial;
    ringAMat.color.setHex(heartbeatEnabled ? 0x22c55e : 0xf59e0b);
    ringAMat.opacity = 0.45 + Math.sin(elapsed * 3.0) * 0.14;

    const ringBMat = personB.ring.material as THREE.MeshBasicMaterial;
    ringBMat.color.setHex(0xf59e0b);
    ringBMat.opacity = 0.38;

    dustPoints.position.y = Math.sin(elapsed * 0.4) * 0.05;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    dustGeo.dispose();
    tetherGeo.dispose();
    dyneemaGeo.dispose();
    concreteMat.dispose();
    darkConcreteMat.dispose();
    brickDebrisMat.dispose();
    rebarMat.dispose();
    girderMat.dispose();
    jacketAMat.dispose();
    trouserMat.dispose();
    hoodAMat.dispose();
    jacketBMat.dispose();
    reflectorMat.dispose();
    thermalColdMat.dispose();
    thermalRebarMat.dispose();
    thermalPersonAMat.dispose();
    thermalPersonBMat.dispose();
    dustMat.dispose();
    tetherLineMat.dispose();
    dyneemaLineMat.dispose();
  };

  return {
    group,
    crawlCurve,
    personAAnchor: personA.group,
    personBAnchor: personB.group,
    personARing: personA.ring,
    personBRing: personB.ring,
    dustPoints,
    update,
    updateTrailingLines,
    setThermalMode,
    dispose,
  };
}
