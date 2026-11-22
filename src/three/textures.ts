import * as THREE from 'three';

export interface ProceduralTextureSet {
  brushedAlAlbedo: THREE.CanvasTexture;
  brushedAlBump: THREE.CanvasTexture;
  brushedAlRoughness: THREE.CanvasTexture;
  tpuBump: THREE.CanvasTexture;
  pcbGreenAlbedo: THREE.CanvasTexture;
  pcbBlueAlbedo: THREE.CanvasTexture;
  concreteAlbedo: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function createRng(initialSeed: number): () => number {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * Generates high-resolution, 100% procedural PBR maps:
 * - CNC brushed Aluminium 6061 albedo, bump & roughness maps (machined grain + lathe bands)
 * - Vulcanized TPU 95A micro-stipple & ribbed traction texture
 * - Realistic FR4 PCB silkscreen/copper-trace textures
 * - Coarse fractured concrete & rubble aggregate albedo + bump maps
 * - Soft radial contact shadow
 */
export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const rand = createRng(1337);

  // 1. CNC Brushed Aluminium 6061 (Albedo + Bump + Roughness) — 512x512
  const [alColCanvas, alColCtx] = makeCanvas(512, 512);
  const [alBumpCanvas, alBumpCtx] = makeCanvas(512, 512);
  const [alRoughCanvas, alRoughCtx] = makeCanvas(512, 512);

  alColCtx.fillStyle = '#aeb8c4';
  alColCtx.fillRect(0, 0, 512, 512);
  alBumpCtx.fillStyle = '#808080';
  alBumpCtx.fillRect(0, 0, 512, 512);
  alRoughCtx.fillStyle = '#565656'; // ~0.34 base roughness
  alRoughCtx.fillRect(0, 0, 512, 512);

  // Subtle machined turning / milling bands
  for (let y = 0; y < 512; y += 2) {
    const wave = Math.sin(y * 0.24) * 5 + Math.sin(y * 1.1) * 3;
    const c = Math.round(174 + wave);
    alColCtx.fillStyle = `rgb(${c - 4},${c},${c + 7})`;
    alColCtx.fillRect(0, y, 512, 2);

    const b = Math.round(128 + wave * 1.4);
    alBumpCtx.fillStyle = `rgb(${b},${b},${b})`;
    alBumpCtx.fillRect(0, y, 512, 1);
  }

  // Fine directional brushed metallic scratches
  for (let i = 0; i < 2200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 35 + rand() * 210;
    const delta = (rand() - 0.5) * 44;
    const colV = Math.max(120, Math.min(220, Math.round(176 + delta)));
    alColCtx.strokeStyle = `rgba(${colV - 3},${colV},${colV + 6},0.34)`;
    alColCtx.lineWidth = rand() > 0.82 ? 1.5 : 0.85;
    alColCtx.beginPath();
    alColCtx.moveTo(x, y);
    alColCtx.lineTo(x + len, y);
    alColCtx.stroke();

    const bumpV = Math.max(70, Math.min(185, Math.round(128 + delta * 1.3)));
    alBumpCtx.strokeStyle = `rgba(${bumpV},${bumpV},${bumpV},0.48)`;
    alBumpCtx.beginPath();
    alBumpCtx.moveTo(x, y);
    alBumpCtx.lineTo(x + len, y);
    alBumpCtx.stroke();

    const roughV = Math.max(48, Math.min(130, Math.round(82 - delta * 0.85)));
    alRoughCtx.strokeStyle = `rgba(${roughV},${roughV},${roughV},0.45)`;
    alRoughCtx.beginPath();
    alRoughCtx.moveTo(x, y);
    alRoughCtx.lineTo(x + len, y);
    alRoughCtx.stroke();
  }

  // Crisp subtle panel seam hairlines for realistic machined housings
  alColCtx.strokeStyle = 'rgba(42,50,62,0.35)';
  alColCtx.lineWidth = 1.5;
  for (const sy of [128, 384]) {
    alColCtx.beginPath();
    alColCtx.moveTo(0, sy);
    alColCtx.lineTo(512, sy);
    alColCtx.stroke();
  }

  const brushedAlAlbedo = new THREE.CanvasTexture(alColCanvas);
  brushedAlAlbedo.colorSpace = THREE.SRGBColorSpace;
  brushedAlAlbedo.wrapS = THREE.RepeatWrapping;
  brushedAlAlbedo.wrapT = THREE.RepeatWrapping;
  brushedAlAlbedo.repeat.set(2, 2);
  brushedAlAlbedo.anisotropy = maxAnisotropy;

  const brushedAlBump = new THREE.CanvasTexture(alBumpCanvas);
  brushedAlBump.wrapS = THREE.RepeatWrapping;
  brushedAlBump.wrapT = THREE.RepeatWrapping;
  brushedAlBump.repeat.set(2, 2);
  brushedAlBump.anisotropy = maxAnisotropy;

  const brushedAlRoughness = new THREE.CanvasTexture(alRoughCanvas);
  brushedAlRoughness.wrapS = THREE.RepeatWrapping;
  brushedAlRoughness.wrapT = THREE.RepeatWrapping;
  brushedAlRoughness.repeat.set(2, 2);
  brushedAlRoughness.anisotropy = maxAnisotropy;

  // 2. TPU 95A grippy vulcanized micro-stipple & ribbed traction bump — 256x256
  const [tpuCanvas, tpuCtx] = makeCanvas(256, 256);
  tpuCtx.fillStyle = '#767676';
  tpuCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const x = Math.floor(rand() * 256);
    const y = Math.floor(rand() * 256);
    const v = 72 + Math.floor(rand() * 98);
    tpuCtx.fillStyle = `rgb(${v},${v},${v})`;
    tpuCtx.fillRect(x, y, 2, 2);
  }
  tpuCtx.fillStyle = 'rgba(225,225,225,0.28)';
  for (let y = 0; y < 256; y += 14) {
    tpuCtx.fillRect(0, y, 256, 4);
  }
  const tpuBump = new THREE.CanvasTexture(tpuCanvas);
  tpuBump.wrapS = THREE.RepeatWrapping;
  tpuBump.wrapT = THREE.RepeatWrapping;
  tpuBump.repeat.set(3, 3);
  tpuBump.anisotropy = maxAnisotropy;

  // 3. Detailed FR4 PCB Silkscreen & Copper Traces (Green & Blue)
  const makePcbTex = (baseHex: string, traceHex: string): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Copper trace bus lines
    ctx.strokeStyle = traceHex;
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const x0 = Math.floor(rand() * 16) * 16;
      const y0 = Math.floor(rand() * 16) * 16;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const midX = x0 + (rand() > 0.5 ? 32 : -32);
      ctx.lineTo(midX, y0);
      ctx.lineTo(midX + 16, y0 + 16);
      ctx.lineTo(midX + 64, y0 + 16);
      ctx.stroke();
    }

    // Gold plated vias & SMD pads
    ctx.fillStyle = '#d4af37';
    for (let i = 0; i < 60; i++) {
      const vx = 8 + Math.floor(rand() * 240);
      const vy = 8 + Math.floor(rand() * 240);
      ctx.fillRect(vx, vy, 4, 4);
    }

    // Crisp white silkscreen component outlines
    ctx.strokeStyle = 'rgba(240,245,250,0.65)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const bx = 12 + Math.floor(rand() * 200);
      const by = 12 + Math.floor(rand() * 200);
      ctx.strokeRect(bx, by, 14 + Math.floor(rand() * 28), 10 + Math.floor(rand() * 18));
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const pcbGreenAlbedo = makePcbTex('#145232', '#1f7a4b');
  const pcbBlueAlbedo = makePcbTex('#153d73', '#235ba6');

  // 4. High-Detail Fractured Concrete, Dust & Aggregate (512x512)
  const [concCanvas, concCtx] = makeCanvas(512, 512);
  const [concBumpCanvas, concBumpCtx] = makeCanvas(512, 512);

  concCtx.fillStyle = '#4f5359';
  concCtx.fillRect(0, 0, 512, 512);
  concBumpCtx.fillStyle = '#808080';
  concBumpCtx.fillRect(0, 0, 512, 512);

  // Large dusty mottling patches (soot, damp cement, pale plaster dust)
  for (let i = 0; i < 140; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 18 + rand() * 58;
    const shade = 44 + Math.floor(rand() * 56);
    const warm = Math.floor((rand() - 0.45) * 14);
    const g = concCtx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(${shade + warm},${shade + Math.floor(warm * 0.6)},${shade},0.28)`);
    g.addColorStop(1, 'rgba(60,64,70,0)');
    concCtx.fillStyle = g;
    concCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Coarse gravel / aggregate pebbles & pits
  for (let i = 0; i < 9500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const sz = 1 + rand() * 5.5;
    const v = 38 + Math.floor(rand() * 78);
    const tint = Math.floor((rand() - 0.5) * 10);
    concCtx.fillStyle = `rgb(${v + tint},${v + Math.floor(tint * 0.5)},${v})`;
    concCtx.fillRect(x, y, sz, sz);

    const bv = 60 + Math.floor(rand() * 135);
    concBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    concBumpCtx.fillRect(x, y, sz, sz);
  }

  // Sharp branching structural cracks
  for (let c = 0; c < 22; c++) {
    let cx = rand() * 512;
    let cy = rand() * 512;
    concCtx.strokeStyle = 'rgba(15,17,22,0.72)';
    concCtx.lineWidth = 1 + rand() * 1.6;
    concBumpCtx.strokeStyle = 'rgba(18,18,18,0.88)';
    concBumpCtx.lineWidth = 2.2;
    concCtx.beginPath();
    concBumpCtx.beginPath();
    concCtx.moveTo(cx, cy);
    concBumpCtx.moveTo(cx, cy);
    for (let s = 0; s < 7; s++) {
      cx += (rand() - 0.5) * 56;
      cy += (rand() - 0.5) * 56;
      concCtx.lineTo(cx, cy);
      concBumpCtx.lineTo(cx, cy);
    }
    concCtx.stroke();
    concBumpCtx.stroke();
  }

  const concreteAlbedo = new THREE.CanvasTexture(concCanvas);
  concreteAlbedo.colorSpace = THREE.SRGBColorSpace;
  concreteAlbedo.wrapS = THREE.RepeatWrapping;
  concreteAlbedo.wrapT = THREE.RepeatWrapping;
  concreteAlbedo.repeat.set(6, 6);
  concreteAlbedo.anisotropy = maxAnisotropy;

  const concreteBump = new THREE.CanvasTexture(concBumpCanvas);
  concreteBump.wrapS = THREE.RepeatWrapping;
  concreteBump.wrapT = THREE.RepeatWrapping;
  concreteBump.repeat.set(6, 6);
  concreteBump.anisotropy = maxAnisotropy;

  // 5. Soft radial contact shadow plane texture
  const [shCanvas, shCtx] = makeCanvas(256, 256);
  const grad = shCtx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.78)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.36)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shCanvas);

  return {
    brushedAlAlbedo,
    brushedAlBump,
    brushedAlRoughness,
    tpuBump,
    pcbGreenAlbedo,
    pcbBlueAlbedo,
    concreteAlbedo,
    concreteBump,
    contactShadow,
    dispose: () => {
      brushedAlAlbedo.dispose();
      brushedAlBump.dispose();
      brushedAlRoughness.dispose();
      tpuBump.dispose();
      pcbGreenAlbedo.dispose();
      pcbBlueAlbedo.dispose();
      concreteAlbedo.dispose();
      concreteBump.dispose();
      contactShadow.dispose();
    },
  };
}
