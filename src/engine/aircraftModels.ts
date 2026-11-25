import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AircraftConfig, AircraftId } from '../types/flight';
import type { WorldTextures } from './materials';

export interface ControlSurfaceRig {
  pivot: THREE.Object3D;
  kind: 'aileron' | 'elevator' | 'rudder' | 'canard' | 'decel';
  side: -1 | 0 | 1;
  axis: 'x' | 'y' | 'z';
  maxRad: number;
}

export interface LandingGearRig {
  strutPivot: THREE.Object3D;
  doorPivot?: THREE.Object3D;
  retractAxis: 'x' | 'y' | 'z';
  retractAngle: number;
  doorClosedAngle?: number;
  doorOpenAngle?: number;
  wheels: { mesh: THREE.Object3D; radius: number }[];
  retractable: boolean;
}

export interface AircraftAnimRig {
  controls: ControlSurfaceRig[];
  gears: LandingGearRig[];
  droopNose?: {
    pivot: THREE.Object3D;
    visorMesh?: THREE.Object3D;
    droopRad: number;
  };
  cockpitDetails: THREE.Object3D[];
  canopies: THREE.Object3D[];
}

export interface BuiltAircraftModel {
  group: THREE.Group;
  pilot: THREE.Group;
  pax: THREE.Group | null;
  tailhook?: THREE.Group;
  props: THREE.Object3D[];
  discs: THREE.Mesh[];
  flames: THREE.Mesh[];
  strobes: THREE.Mesh[];
  contactPoints: { v: THREE.Vector3; w: number }[];
  animRig?: AircraftAnimRig;
}

export interface TankerModel {
  group: THREE.Group;
  boomPivot: THREE.Group;
  hoseMesh: THREE.Mesh;
  drogueGroup: THREE.Group;
  drogueMat: THREE.MeshBasicMaterial;
  boomTipMat: THREE.MeshBasicMaterial;
  targetRingGroup: THREE.Group;
  targetRingMat: THREE.MeshBasicMaterial;
  targetHaloMat: THREE.MeshBasicMaterial;
  strobes: THREE.Mesh[];
}

interface AircraftPbrAssets {
  tacticalAlbedo: THREE.CanvasTexture;
  camoAlbedo: THREE.CanvasTexture;
  stealthAlbedo: THREE.CanvasTexture;
  whiteAlbedo: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

let cachedPbrAssets: AircraftPbrAssets | null = null;

function getAircraftPbrAssets(): AircraftPbrAssets {
  if (cachedPbrAssets) return cachedPbrAssets;

  const size = 512;
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const makeCanvas = () => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return { c, ctx: c.getContext('2d')! };
  };

  const tac = makeCanvas();
  const cam = makeCanvas();
  const stl = makeCanvas();
  const wht = makeCanvas();
  const bmp = makeCanvas();
  const rgh = makeCanvas();

  // Base fills
  tac.ctx.fillStyle = '#aeb7c4';
  tac.ctx.fillRect(0, 0, size, size);

  cam.ctx.fillStyle = '#5e819f';
  cam.ctx.fillRect(0, 0, size, size);

  stl.ctx.fillStyle = '#333b48';
  stl.ctx.fillRect(0, 0, size, size);

  wht.ctx.fillStyle = '#edf1f7';
  wht.ctx.fillRect(0, 0, size, size);

  bmp.ctx.fillStyle = '#808080';
  bmp.ctx.fillRect(0, 0, size, size);

  rgh.ctx.fillStyle = '#d8d8d8';
  rgh.ctx.fillRect(0, 0, size, size);

  // Splinter camo polygons on camoAlbedo
  cam.ctx.fillStyle = '#384c63';
  cam.ctx.beginPath();
  cam.ctx.moveTo(0, 60);
  cam.ctx.lineTo(240, 0);
  cam.ctx.lineTo(340, 195);
  cam.ctx.lineTo(75, 290);
  cam.ctx.closePath();
  cam.ctx.fill();
  cam.ctx.fillStyle = '#87a8c4';
  cam.ctx.beginPath();
  cam.ctx.moveTo(250, 220);
  cam.ctx.lineTo(512, 165);
  cam.ctx.lineTo(512, 445);
  cam.ctx.lineTo(205, 512);
  cam.ctx.closePath();
  cam.ctx.fill();

  // Subtle brushed aluminum grain & metallic panel variation
  for (let i = 0; i < 1800; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const len = 8 + rand() * 34;
    const v = 162 + Math.floor(rand() * 32);
    tac.ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.16)`;
    tac.ctx.fillRect(px, py, len, 1.5);
    const rv = 195 + Math.floor(rand() * 48);
    rgh.ctx.fillStyle = `rgba(${rv},${rv},${rv},0.22)`;
    rgh.ctx.fillRect(px, py, len, 2);
  }

  // Individual skin sheet tone modulation & subtle oil/soot weathering streaks
  for (let gx = 0; gx < size; gx += 64) {
    for (let gy = 0; gy < size; gy += 64) {
      const delta = Math.floor((rand() - 0.5) * 20);
      tac.ctx.fillStyle = delta >= 0 ? `rgba(255,255,255,${delta / 255})` : `rgba(15,23,42,${-delta / 220})`;
      tac.ctx.fillRect(gx + 1, gy + 1, 62, 62);
      const rSheet = 205 + Math.floor((rand() - 0.5) * 42);
      rgh.ctx.fillStyle = `rgb(${rSheet},${rSheet},${rSheet})`;
      rgh.ctx.fillRect(gx + 1, gy + 1, 62, 62);
    }
  }

  // Weathering grime streaks trailing aft along panels
  for (let i = 0; i < 42; i++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const slen = 28 + rand() * 72;
    const grad = tac.ctx.createLinearGradient(sx, sy, sx, sy + slen);
    grad.addColorStop(0, 'rgba(30,41,59,0.22)');
    grad.addColorStop(1, 'rgba(30,41,59,0)');
    tac.ctx.fillStyle = grad;
    tac.ctx.fillRect(sx - 1.5, sy, 3, slen);
    wht.ctx.fillStyle = 'rgba(100,116,139,0.08)';
    wht.ctx.fillRect(sx - 1, sy, 2, slen * 0.7);
    rgh.ctx.fillStyle = 'rgba(250,250,250,0.35)';
    rgh.ctx.fillRect(sx - 2, sy, 4, slen);
  }

  // Crisp recessed panel seams & staggered double-row rivets
  const drawSeam = (ctx: CanvasRenderingContext2D, stroke: string, lw: number) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    for (let p = 0; p < size; p += 64) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    ctx.lineWidth = lw * 0.7;
    for (let p = 32; p < size; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
    }
  };
  drawSeam(tac.ctx, 'rgba(20, 28, 40, 0.56)', 1.7);
  drawSeam(cam.ctx, 'rgba(15, 23, 42, 0.5)', 1.6);
  drawSeam(wht.ctx, 'rgba(71, 85, 105, 0.34)', 1.4);
  drawSeam(bmp.ctx, '#262626', 2.2);
  drawSeam(rgh.ctx, '#ffffff', 2.0);

  // Sawtooth RAM access seams on stealthAlbedo
  stl.ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  stl.ctx.lineWidth = 2.0;
  for (let y = 32; y < size; y += 128) {
    stl.ctx.beginPath();
    for (let x = 0; x <= size; x += 32) {
      stl.ctx.lineTo(x, y + (x % 64 === 0 ? -10 : 10));
    }
    stl.ctx.stroke();
  }

  // High-contrast rivets along seams on albedo & raised dots on bump map
  for (let p = 0; p < size; p += 64) {
    for (let k = 6; k < size; k += 10) {
      tac.ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
      tac.ctx.fillRect(p + 3, k, 1.8, 1.8);
      tac.ctx.fillRect(p - 4.5, k, 1.8, 1.8);
      tac.ctx.fillRect(k, p + 3, 1.8, 1.8);
      tac.ctx.fillRect(k, p - 4.5, 1.8, 1.8);

      bmp.ctx.fillStyle = '#cfcfcf';
      bmp.ctx.fillRect(p + 3, k, 2, 2);
      bmp.ctx.fillRect(p - 5, k, 2, 2);
      bmp.ctx.fillRect(k, p + 3, 2, 2);
      bmp.ctx.fillRect(k, p - 5, 2, 2);
    }
  }

  // Maintenance hatches + Intake warning chevrons + Squadron tactical roundel / stencil markings
  const drawHatch = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  };
  drawHatch(tac.ctx, 84, 84, 38, 28, 'rgba(30,41,59,0.65)');
  drawHatch(tac.ctx, 276, 210, 44, 34, 'rgba(30,41,59,0.65)');
  drawHatch(bmp.ctx, 84, 84, 38, 28, '#282828');
  drawHatch(bmp.ctx, 276, 210, 44, 34, '#282828');

  // Red/amber intake danger chevron band + low-vis tactical squadron emblem
  tac.ctx.fillStyle = 'rgba(185, 28, 28, 0.72)';
  tac.ctx.beginPath();
  tac.ctx.moveTo(42, 340);
  tac.ctx.lineTo(74, 356);
  tac.ctx.lineTo(42, 372);
  tac.ctx.lineTo(54, 356);
  tac.ctx.closePath();
  tac.ctx.fill();
  tac.ctx.fillStyle = 'rgba(217, 119, 6, 0.7)';
  tac.ctx.fillRect(42, 378, 30, 4);

  // Low-vis squadron star/bar insignia on tactical panels
  tac.ctx.strokeStyle = 'rgba(30, 41, 59, 0.58)';
  tac.ctx.lineWidth = 2.2;
  tac.ctx.beginPath();
  tac.ctx.arc(384, 128, 16, 0, Math.PI * 2);
  tac.ctx.stroke();
  tac.ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
  tac.ctx.fillRect(352, 124, 16, 8);
  tac.ctx.fillRect(400, 124, 16, 8);

  const finalize = (c: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  };

  cachedPbrAssets = {
    tacticalAlbedo: finalize(tac.c, true),
    camoAlbedo: finalize(cam.c, true),
    stealthAlbedo: finalize(stl.c, true),
    whiteAlbedo: finalize(wht.c, true),
    bumpMap: finalize(bmp.c, false),
    roughnessMap: finalize(rgh.c, false),
  };
  return cachedPbrAssets;
}

interface StaticBatch {
  mat: THREE.Material;
  geos: THREE.BufferGeometry[];
  castShadow: boolean;
}

class StaticModelBuilder {
  private batches = new Map<THREE.Material, StaticBatch>();

  public add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    castShadow = true
  ): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.tangent) g.deleteAttribute('tangent');
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    );
    g.applyMatrix4(m);
    if (sx * sy * sz < 0) {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        for (let k = 0; k < 3; k++) {
          const tmp = pos.array[(i + 1) * 3 + k];
          pos.array[(i + 1) * 3 + k] = pos.array[(i + 2) * 3 + k];
          pos.array[(i + 2) * 3 + k] = tmp;
          if (norm) {
            const nt = norm.array[(i + 1) * 3 + k];
            norm.array[(i + 1) * 3 + k] = norm.array[(i + 2) * 3 + k];
            norm.array[(i + 2) * 3 + k] = nt;
          }
        }
      }
      g.computeVertexNormals();
    }

    let batch = this.batches.get(mat);
    if (!batch) {
      batch = { mat, geos: [], castShadow };
      this.batches.set(mat, batch);
    }
    if (castShadow) batch.castShadow = true;
    batch.geos.push(g);
  }

  public flushInto(parent: THREE.Group): void {
    for (const batch of this.batches.values()) {
      if (batch.geos.length === 0) continue;
      const merged = batch.geos.length === 1 ? batch.geos[0] : mergeGeometries(batch.geos, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, batch.mat);
        mesh.castShadow = batch.castShadow;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
      if (batch.geos.length > 1) {
        for (const g of batch.geos) g.dispose();
      }
    }
    this.batches.clear();
  }
}

function addPart(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
  castShadow = false
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

interface FuselageSection {
  z: number;
  rx: number;
  ry: number;
  yOff?: number;
  chine?: number; // 0..1 sharp side strake flare
  botFlat?: number; // 0..1 belly flattening
  dorsal?: number; // extra spine peak on top
}

/** Smooth cross-section lofted fuselage with aerodynamic chines, belly flattening, and cylindrical UVs */
function createLoftedFuselageGeometry(sections: FuselageSection[], radialSegs = 22): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = radialSegs + 1;
  const zMin = sections[0].z;
  const zSpan = Math.max(0.1, sections[sections.length - 1].z - zMin);

  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    const v = ((s.z - zMin) / zSpan) * 2.4;
    const yOff = s.yOff ?? 0;
    const chine = s.chine ?? 0;
    const botFlat = s.botFlat ?? 0;
    const dorsal = s.dorsal ?? 0;

    for (let ri = 0; ri <= radialSegs; ri++) {
      const uFrac = ri / radialSegs;
      const theta = uFrac * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let x = sinT * s.rx;
      if (chine > 0) {
        const sideWeight = Math.pow(Math.abs(sinT), 3.0);
        x *= 1 + chine * 0.42 * sideWeight;
      }

      let y = cosT * s.ry;
      if (cosT < 0 && botFlat > 0) {
        y *= 1 - botFlat * 0.48 * Math.pow(-cosT, 1.3);
      }
      if (cosT > 0 && dorsal > 0) {
        y += dorsal * Math.pow(cosT, 3.0);
      }
      if (chine > 0) {
        const midWeight = Math.pow(Math.abs(sinT), 2.4);
        y *= 1 - chine * 0.35 * midWeight;
      }

      positions.push(x, y + yOff, s.z);
      uvs.push(uFrac * 2.0, v);
    }
  }

  for (let si = 0; si < sections.length - 1; si++) {
    for (let ri = 0; ri < radialSegs; ri++) {
      const a = si * cols + ri;
      const b = a + 1;
      const c = (si + 1) * cols + ri;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth cambered 3D airfoil wing (single half-wing extending from x=0 to +halfSpan) with optional blended winglet */
function createAirfoilWingGeometry(opts: {
  rootChord: number;
  tipChord: number;
  halfSpan: number;
  sweepBack: number;
  thicknessRoot: number;
  thicknessTip: number;
  camber?: number;
  wingletH?: number;
  wingletSweep?: number;
  wingletCant?: number;
}): THREE.BufferGeometry {
  const {
    rootChord,
    tipChord,
    halfSpan,
    sweepBack,
    thicknessRoot,
    thicknessTip,
    camber = 0.08,
    wingletH = 0,
    wingletSweep = 0.7,
    wingletCant = 0.25,
  } = opts;

  // NACA-style closed profile from trailing edge -> upper -> rounded nose -> lower -> trailing edge
  const profN = 14;
  const profile: [number, number][] = [];
  for (let i = 0; i <= profN; i++) {
    const t = i / profN; // 0 = LE, 1 = TE
    const xc = 0.5 * (1 - Math.cos(t * Math.PI));
    const yt = 5 * (0.2969 * Math.sqrt(Math.max(1e-5, xc)) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1036 * xc * xc * xc * xc);
    const yc = camber * 4 * xc * (1 - xc);
    profile.push([xc - 0.5, yc + yt]);
  }
  for (let i = profN - 1; i >= 0; i--) {
    const t = i / profN;
    const xc = 0.5 * (1 - Math.cos(t * Math.PI));
    const yt = 5 * (0.2969 * Math.sqrt(Math.max(1e-5, xc)) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1036 * xc * xc * xc * xc);
    const yc = camber * 4 * xc * (1 - xc);
    profile.push([xc - 0.5, yc - yt * 0.65]);
  }

  interface RibSpec {
    x: number;
    y: number;
    zOff: number;
    chord: number;
    thick: number;
    tiltZ: number;
  }
  const ribs: RibSpec[] = [];
  const spanSegs = 6;
  for (let si = 0; si <= spanSegs; si++) {
    const f = si / spanSegs;
    const chord = THREE.MathUtils.lerp(rootChord, tipChord, f);
    const thick = THREE.MathUtils.lerp(thicknessRoot, thicknessTip, f);
    const leZ = -rootChord * 0.5 + f * sweepBack;
    ribs.push({ x: f * halfSpan, y: 0, zOff: leZ + chord * 0.5, chord, thick, tiltZ: 0 });
  }
  if (wingletH > 0.05) {
    const tipZ = -rootChord * 0.5 + sweepBack;
    ribs.push({
      x: halfSpan + wingletH * Math.sin(wingletCant) * 0.45,
      y: wingletH * 0.45,
      zOff: tipZ + wingletSweep * 0.45 + tipChord * 0.38,
      chord: tipChord * 0.72,
      thick: thicknessTip * 0.7,
      tiltZ: Math.PI * 0.5 - wingletCant * 0.5,
    });
    ribs.push({
      x: halfSpan + wingletH * Math.sin(wingletCant),
      y: wingletH,
      zOff: tipZ + wingletSweep + tipChord * 0.22,
      chord: tipChord * 0.36,
      thick: thicknessTip * 0.45,
      tiltZ: Math.PI * 0.5 - wingletCant,
    });
  }

  const ringCols = profile.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ri = 0; ri < ribs.length; ri++) {
    const r = ribs[ri];
    const cosT = Math.cos(r.tiltZ);
    const sinT = Math.sin(r.tiltZ);
    const uSpan = r.x / Math.max(1, halfSpan);
    for (let pi = 0; pi < ringCols; pi++) {
      const [pz, py] = profile[pi];
      const lx = -py * r.thick * sinT;
      const ly = py * r.thick * cosT;
      positions.push(r.x + lx, r.y + ly, r.zOff + pz * r.chord);
      uvs.push(uSpan * 1.4, (pi / ringCols) * 1.2);
    }
  }

  for (let ri = 0; ri < ribs.length - 1; ri++) {
    for (let pi = 0; pi < ringCols - 1; pi++) {
      const a = ri * ringCols + pi;
      const b = a + 1;
      const c = (ri + 1) * ringCols + pi;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Cap outer tip
  const lastBase = (ribs.length - 1) * ringCols;
  const tipCenterIdx = positions.length / 3;
  const lastRib = ribs[ribs.length - 1];
  positions.push(lastRib.x, lastRib.y, lastRib.zOff);
  uvs.push(1.4, 0.5);
  for (let pi = 0; pi < ringCols - 1; pi++) {
    indices.push(lastBase + pi, tipCenterIdx, lastBase + pi + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addMirroredWings(
  builder: StaticModelBuilder,
  rootChord: number,
  tipChord: number,
  halfSpan: number,
  sweep: number,
  thickness: number,
  dihedralRad: number,
  mat: THREE.Material,
  y: number,
  z: number,
  wingletH = 0,
  camber = 0.08
): void {
  const rightGeo = createAirfoilWingGeometry({
    rootChord,
    tipChord,
    halfSpan,
    sweepBack: sweep,
    thicknessRoot: thickness,
    thicknessTip: Math.max(0.05, thickness * 0.62),
    camber,
    wingletH,
  });
  builder.add(rightGeo, mat, 0, y, z, 0, 0, dihedralRad, 1, 1, 1, true);
  builder.add(rightGeo, mat, 0, y, z, 0, 0, -dihedralRad, -1, 1, 1, true);
  rightGeo.dispose();
}

/** Smooth sculpted curved Leading-Edge Extension (LEX / strake) lofted from nose cheek into wing root */
function createBlendedStrakeGeometry(
  stations: Array<{ z: number; xIn: number; xOut: number; y: number; thick: number }>
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // Cross-section loop around strake width: inner-top, mid-top, outer-edge, mid-bot, inner-bot, inner-top
  const ringPts = 6;
  const zMin = stations[0].z;
  const zSpan = Math.max(0.1, stations[stations.length - 1].z - zMin);

  for (let si = 0; si < stations.length; si++) {
    const s = stations[si];
    const v = (s.z - zMin) / zSpan;
    const xm = (s.xIn + s.xOut) * 0.5;
    const pts: [number, number][] = [
      [s.xIn, s.y + s.thick * 0.65],
      [xm, s.y + s.thick * 0.55],
      [s.xOut, s.y],
      [xm, s.y - s.thick * 0.45],
      [s.xIn, s.y - s.thick * 0.55],
      [s.xIn, s.y + s.thick * 0.65],
    ];
    for (let pi = 0; pi < ringPts; pi++) {
      positions.push(pts[pi][0], pts[pi][1], s.z);
      uvs.push(pi / (ringPts - 1), v);
    }
  }
  for (let si = 0; si < stations.length - 1; si++) {
    for (let pi = 0; pi < ringPts - 1; pi++) {
      const a = si * ringPts + pi;
      const b = a + 1;
      const c = (si + 1) * ringPts + pi;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth sculpted aerodynamic intake cowl & splitter plate (no plain boxes) */
function addSculptedIntake(
  builder: StaticModelBuilder,
  shellMat: THREE.Material,
  darkMat: THREE.Material,
  chevronMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  len: number,
  yaw = 0
): void {
  const halfL = len * 0.5;
  const cowlGeo = createLoftedFuselageGeometry(
    [
      { z: -halfL - 0.12, rx: w * 0.46, ry: h * 0.46, botFlat: 0.45 },
      { z: -halfL + 0.35, rx: w * 0.52, ry: h * 0.52, botFlat: 0.45 },
      { z: 0, rx: w * 0.52, ry: h * 0.5, botFlat: 0.4 },
      { z: halfL, rx: w * 0.44, ry: h * 0.44, botFlat: 0.3 },
    ],
    14
  );
  builder.add(cowlGeo, shellMat, x, y, z, 0, yaw, 0, 1, 1, 1, false);
  cowlGeo.dispose();

  // Dark intake compressor void & boundary-layer splitter lip
  const mouthGeo = new THREE.CylinderGeometry(w * 0.38, w * 0.36, 0.25, 12).rotateX(Math.PI / 2);
  builder.add(mouthGeo, darkMat, x, y, z - halfL - 0.04, 0, yaw, 0, 1, h / w, 1, false);
  mouthGeo.dispose();

  // Intake danger chevron trim band
  const chevGeo = new THREE.BoxGeometry(0.05, h * 0.42, 0.34);
  const sideSign = x >= 0 ? 1 : -1;
  builder.add(chevGeo, chevronMat, x + sideSign * (w * 0.48), y, z - halfL + 0.45, 0, yaw, 0, 1, 1, 1, false);
  chevGeo.dispose();
}

/** Sculpted bubble / fighter canopy geometry (omega/teardrop profile, FrontSide only) */
function createBubbleCanopyGeometry(rx: number, ry: number, len: number): THREE.BufferGeometry {
  const secs: FuselageSection[] = [
    { z: -len * 0.52, rx: 0.01, ry: 0.01, yOff: -ry * 0.35 },
    { z: -len * 0.34, rx: rx * 0.72, ry: ry * 0.58, yOff: -ry * 0.12 },
    { z: -len * 0.08, rx: rx * 1.0, ry: ry * 1.0, yOff: 0 },
    { z: len * 0.22, rx: rx * 0.92, ry: ry * 0.9, yOff: -ry * 0.04 },
    { z: len * 0.5, rx: rx * 0.48, ry: ry * 0.42, yOff: -ry * 0.18 },
    { z: len * 0.58, rx: 0.01, ry: 0.01, yOff: -ry * 0.28 },
  ];
  return createLoftedFuselageGeometry(secs, 18);
}

/** Segmented titanium converging-diverging exhaust petals around inner flameholder */
function addSegmentedAfterburnerNozzle(
  builder: StaticModelBuilder,
  titaniumMat: THREE.Material,
  darkLinerMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  len: number,
  petalCount = 14
): void {
  const linerGeo = new THREE.CylinderGeometry(radius * 0.84, radius * 0.76, len * 0.95, 16, 1, true).rotateX(Math.PI / 2);
  builder.add(linerGeo, darkLinerMat, x, y, z, 0, 0, 0, 1, 1, 1, false);
  linerGeo.dispose();

  const collarGeo = new THREE.CylinderGeometry(radius * 1.04, radius * 0.98, len * 0.25, 16).rotateX(Math.PI / 2);
  builder.add(collarGeo, titaniumMat, x, y, z - len * 0.36, 0, 0, 0, 1, 1, 1, false);
  collarGeo.dispose();

  const petalW = (Math.PI * 2 * radius) / petalCount * 0.82;
  const petalGeo = new THREE.BoxGeometry(petalW, 0.055, len * 0.88);
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2;
    const px = x + Math.sin(a) * radius * 0.89;
    const py = y + Math.cos(a) * radius * 0.89;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -a));
    const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.14);
    q.multiply(qTilt);
    m.compose(new THREE.Vector3(px, py, z + len * 0.06), q, new THREE.Vector3(1, 1, 1));
    const g = petalGeo.toNonIndexed();
    g.applyMatrix4(m);
    builder.add(g, titaniumMat, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
    g.dispose();
  }
  petalGeo.dispose();
}

/** Articulated bevel-edged control surface (aileron / elevator / rudder / canard / decel) */
function addControlSurface(
  rig: AircraftAnimRig,
  mat: THREE.Material,
  parent: THREE.Object3D,
  kind: ControlSurfaceRig['kind'],
  side: -1 | 0 | 1,
  x: number,
  y: number,
  z: number,
  width: number,
  chord: number,
  thick: number,
  axis: 'x' | 'y' | 'z',
  maxRad: number,
  cantZ = 0
): THREE.Group {
  const mount = new THREE.Group();
  mount.position.set(x, y, z);
  mount.rotation.z = cantZ;
  parent.add(mount);

  const pivot = new THREE.Group();
  mount.add(pivot);

  let geo: THREE.BufferGeometry;
  if (kind === 'rudder') {
    geo = new THREE.BoxGeometry(thick, width, chord);
    const m = addPart(geo, mat, 0, width * 0.5, chord * 0.5, pivot, false);
    void m;
  } else {
    geo = new THREE.BoxGeometry(width, thick, chord);
    const m = addPart(geo, mat, 0, 0, chord * 0.5, pivot, false);
    void m;
  }

  rig.controls.push({ pivot, kind, side, axis, maxRad });
  return pivot;
}

/** Articulated retractable (or fixed) landing gear assembly with hydraulic strut, oleo fork, rotating tire + wheel bay door */
function addLandingGearAssembly(
  rig: AircraftAnimRig,
  radius: number,
  width: number,
  strutHeight: number,
  tireMat: THREE.Material,
  metalMat: THREE.Material,
  doorMat: THREE.Material,
  parent: THREE.Object3D,
  x: number,
  wheelCenterY: number,
  z: number,
  opts: {
    twin?: boolean;
    retractable?: boolean;
    retractAxis?: 'x' | 'y' | 'z';
    retractAngle?: number;
    hasDoor?: boolean;
    doorSide?: -1 | 1;
  } = {}
): void {
  const {
    twin = false,
    retractable = true,
    retractAxis = 'x',
    retractAngle = Math.PI * 0.48,
    hasDoor = retractable,
    doorSide = x >= 0 ? 1 : -1,
  } = opts;

  const topPivotY = wheelCenterY + strutHeight;
  const strutPivot = new THREE.Group();
  strutPivot.position.set(x, topPivotY, z);
  parent.add(strutPivot);

  // Upper main oleo cylinder + lower chrome piston + diagonal drag brace
  addPart(new THREE.CylinderGeometry(width * 0.28, width * 0.24, strutHeight * 0.58, 8), metalMat, 0, -strutHeight * 0.28, 0, strutPivot);
  addPart(new THREE.CylinderGeometry(width * 0.19, width * 0.18, strutHeight * 0.48, 8), metalMat, 0, -strutHeight * 0.72, 0, strutPivot);
  const brace = addPart(new THREE.CylinderGeometry(width * 0.11, width * 0.11, strutHeight * 0.72, 6), metalMat, 0, -strutHeight * 0.42, 0.22, strutPivot);
  brace.rotation.x = 0.48;

  const wheels: { mesh: THREE.Object3D; radius: number }[] = [];
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 14).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, width * 1.07, 10).rotateZ(Math.PI / 2);
  const offsets = twin ? [-width * 0.74, width * 0.74] : [0];
  for (const ox of offsets) {
    const wg = new THREE.Group();
    wg.position.set(ox, -strutHeight, 0);
    addPart(tireGeo, tireMat, 0, 0, 0, wg);
    addPart(hubGeo, metalMat, 0, 0, 0, wg);
    strutPivot.add(wg);
    wheels.push({ mesh: wg, radius });
  }

  let doorPivot: THREE.Object3D | undefined;
  let doorClosedAngle = 0;
  let doorOpenAngle = 0;
  if (hasDoor) {
    doorPivot = new THREE.Group();
    const doorW = Math.max(0.32, width * (twin ? 2.4 : 1.7));
    const doorLen = Math.max(0.65, radius * 2.4);
    doorPivot.position.set(x + doorSide * doorW * 0.48, topPivotY + 0.04, z);
    addPart(new THREE.BoxGeometry(doorW, 0.04, doorLen), doorMat, -doorSide * doorW * 0.48, 0, 0, doorPivot);
    parent.add(doorPivot);
    doorClosedAngle = 0;
    doorOpenAngle = doorSide * 1.48;
  }

  rig.gears.push({
    strutPivot,
    doorPivot,
    retractAxis,
    retractAngle,
    doorClosedAngle,
    doorOpenAngle,
    wheels,
    retractable,
  });
}

function createPilotFigure(helmetCol: number, suitCol: number, lithamCol = 0x1e293b): THREE.Group {
  const g = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: suitCol, roughness: 0.72, metalness: 0.08 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd29c72, roughness: 0.58 });
  const lithamMat = new THREE.MeshStandardMaterial({ color: lithamCol, roughness: 0.85 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: helmetCol, roughness: 0.52, metalness: 0.22 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.92 });

  // Torso & Tactical Flight Harness
  addPart(new THREE.CapsuleGeometry(0.16, 0.28, 4, 8), suitMat, 0, 0.22, 0, g);
  addPart(new THREE.BoxGeometry(0.29, 0.22, 0.22), vestMat, 0, 0.25, 0, g);

  // Sculpted Pilot Head, Oxygen Mask/Litham, Flight Helmet & Reflective Visor
  addPart(new THREE.SphereGeometry(0.14, 12, 10), skinMat, 0, 0.52, 0, g);
  addPart(new THREE.CylinderGeometry(0.142, 0.122, 0.11, 12), lithamMat, 0, 0.46, -0.015, g);
  addPart(new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), wrapMat, 0, 0.54, 0.01, g);
  const visor = addPart(new THREE.CylinderGeometry(0.152, 0.146, 0.075, 12, 1, false, -0.75, 1.5), visorMat, 0, 0.54, -0.015, g);
  visor.rotation.y = Math.PI;
  return g;
}

/** Ejection seat headrest + side rails + illuminated HUD combiner glass inside cockpit */
function addCockpitInterior(
  rig: AircraftAnimRig,
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  hasHud = true
): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  const seatFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.65 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.08 });
  const pullMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.25 });
  const hudFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 });
  const hudGlassMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Armored ejection seat backrest, cushion, side bolsters & yellow pull ring
  addPart(new THREE.BoxGeometry(0.42, 0.68, 0.12), seatFrameMat, 0, 0.34, 0.19, grp);
  addPart(new THREE.BoxGeometry(0.32, 0.22, 0.16), cushionMat, 0, 0.68, 0.14, grp);
  addPart(new THREE.TorusGeometry(0.055, 0.014, 6, 12), pullMat, 0, 0.78, 0.06, grp);
  addPart(new THREE.BoxGeometry(0.48, 0.12, 0.46), cushionMat, 0, 0.02, 0.0, grp);

  if (hasHud) {
    // Glareshield + tilted holographic HUD combiner glass
    addPart(new THREE.BoxGeometry(0.42, 0.14, 0.32), hudFrameMat, 0, 0.26, -0.52, grp);
    const hudGlass = addPart(new THREE.PlaneGeometry(0.24, 0.19), hudGlassMat, 0, 0.43, -0.5, grp);
    hudGlass.rotation.x = -0.58;
    hudGlass.renderOrder = 4;
    const mfdGlow = addPart(
      new THREE.PlaneGeometry(0.32, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.65 }),
      0,
      0.24,
      -0.36,
      grp
    );
    mfdGlow.rotation.x = -0.35;
  }

  parent.add(grp);
  rig.cockpitDetails.push(grp);
}

function createStrobeLights(
  leftPos: [number, number, number],
  rightPos: [number, number, number],
  tailPos: [number, number, number],
  parent: THREE.Object3D
): THREE.Mesh[] {
  const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const s1 = addPart(new THREE.SphereGeometry(0.11, 6, 5), redMat, ...leftPos, parent);
  const s2 = addPart(new THREE.SphereGeometry(0.11, 6, 5), greenMat, ...rightPos, parent);
  const s3 = addPart(new THREE.SphereGeometry(0.12, 6, 5), whiteMat, ...tailPos, parent);
  return [s1, s2, s3];
}

function makePropeller(
  blades: number,
  radius: number,
  bladeMat: THREE.Material,
  spinnerMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D
): { prop: THREE.Group; disc: THREE.Mesh } {
  const prop = new THREE.Group();
  prop.position.set(x, y, z);
  addPart(new THREE.ConeGeometry(radius * 0.18, radius * 0.42, 12).rotateX(-Math.PI / 2), spinnerMat, 0, 0, -radius * 0.12, prop);
  for (let i = 0; i < blades; i++) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.z = (i * Math.PI * 2) / blades;
    const blade = addPart(new THREE.BoxGeometry(radius * 0.11, radius * 0.92, 0.03), bladeMat, 0, radius * 0.48, 0, bladePivot);
    blade.rotation.y = 0.25;
    prop.add(bladePivot);
  }
  parent.add(prop);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  disc.position.set(x, y, z - 0.04);
  parent.add(disc);
  return { prop, disc };
}

function makeGlassMaterial(color: number, opacity = 0.78): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.08,
    metalness: 0.9,
    envMapIntensity: 2.15,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function createAfterburnerMaterial(layer: 0 | 1 | 2, blueCore: boolean): THREE.ShaderMaterial {
  const isInner = layer === 2 ? 1.0 : layer === 1 ? 0.55 : 0.0;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1.0 },
      uInner: { value: isInner },
      uBlueCore: { value: blueCore ? 1.0 : 0.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: `
      uniform float uTime;
      uniform float uPower;
      varying vec2 vUv;
      varying float vAxial;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vAxial = clamp(uv.y, 0.0, 1.0);

        float shimmer = sin(position.z * 8.2 - uTime * 52.0) * 0.032
                      + cos(position.x * 14.0 + uTime * 38.0) * 0.018;
        vec3 displaced = position + vec3(normal.x, normal.y, 0.0) * (shimmer * (0.2 + vAxial * 0.85) * clamp(uPower, 0.2, 1.5));

        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPower;
      uniform float uInner;
      uniform float uBlueCore;
      varying vec2 vUv;
      varying float vAxial;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float facing = pow(clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0), 0.7);
        float nozzleIn = smoothstep(0.0, 0.07, vAxial);
        float tailOut = pow(max(0.0, 1.0 - vAxial), mix(1.35, 1.9, uInner));

        float shockTravel = pow(max(0.0, sin(vAxial * 28.0 - uTime * 46.0) * 0.5 + 0.5), 3.2);
        float shockStanding = pow(max(0.0, sin(vAxial * 22.0 + 0.3) * 0.5 + 0.5), 4.0);
        float shockWeight = (shockStanding * 0.78 + shockTravel * 0.48) * (1.0 - vAxial * 0.6);

        vec3 orangeTip = vec3(0.96, 0.3, 0.05);
        vec3 orangeMid = vec3(1.0, 0.62, 0.14);
        vec3 blueMid = vec3(0.35, 0.78, 1.0);
        vec3 hotNode = mix(vec3(1.0, 0.96, 0.86), vec3(0.86, 0.96, 1.0), uBlueCore);

        vec3 baseCol = mix(orangeMid, blueMid, uBlueCore * (1.0 - vAxial * 0.68));
        vec3 col = mix(baseCol, orangeTip, smoothstep(0.32, 0.94, vAxial));
        col = mix(col, hotNode, clamp(shockWeight * 0.95 + uInner * 0.42 + (1.0 - vAxial) * 0.35, 0.0, 1.0));

        float intensity = facing * nozzleIn * tailOut * (0.58 + shockWeight * 0.95) * clamp(uPower, 0.15, 1.5);
        float alpha = clamp(intensity * mix(0.68, 1.18, uInner), 0.0, 0.94);
        if (alpha < 0.012) discard;

        gl_FragColor = vec4(col * (1.08 + uInner * 0.38), alpha);
      }
    `,
  });
}

function createMachFlameStack(
  parent: THREE.Object3D,
  x: number,
  y: number,
  zNozzleEnd: number,
  radius: number,
  length: number,
  blueCore: boolean,
  flamesOut: THREE.Mesh[]
): void {
  const layers: Array<{ radMul: number; lenMul: number; layerIdx: 0 | 1 | 2 }> = [
    { radMul: 0.96, lenMul: 1.05, layerIdx: 0 },
    { radMul: 0.68, lenMul: 0.82, layerIdx: 1 },
    { radMul: 0.42, lenMul: 0.56, layerIdx: 2 },
  ];
  for (const l of layers) {
    const lLen = length * l.lenMul;
    const geo = new THREE.ConeGeometry(radius * l.radMul, lLen, 12).rotateX(Math.PI / 2);
    const mat = createAfterburnerMaterial(l.layerIdx, blueCore);
    const fl = addPart(geo, mat, x, y, zNozzleEnd + lLen * 0.5, parent);
    fl.visible = false;
    fl.userData.abMat = mat;
    flamesOut.push(fl);
  }
}

function buildF18Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const hornetGray = new THREE.MeshStandardMaterial({
    color: 0xb2becd,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const hornetDark = new THREE.MeshStandardMaterial({
    color: 0x435063,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.028,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0x2a3342, roughness: 0.5, metalness: 0.28 });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.3 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x333944, roughness: 0.24, metalness: 0.92 });
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.3 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const canopyMat = makeGlassMaterial(0xd97706, 0.78);

  // Smooth cross-section lofted fuselage with dorsal spine & flattened intake belly
  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -9.25, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -8.25, rx: 0.25, ry: 0.23, yOff: 0.02 },
      { z: -6.7, rx: 0.54, ry: 0.48, yOff: 0.03, chine: 0.15 },
      { z: -4.2, rx: 0.84, ry: 0.68, yOff: 0.06, chine: 0.35, botFlat: 0.35 },
      { z: -1.4, rx: 1.06, ry: 0.74, yOff: 0.05, chine: 0.45, botFlat: 0.45, dorsal: 0.22 },
      { z: 2.2, rx: 1.12, ry: 0.74, yOff: 0.05, chine: 0.25, botFlat: 0.45, dorsal: 0.28 },
      { z: 5.4, rx: 1.02, ry: 0.66, yOff: 0.03, botFlat: 0.35, dorsal: 0.18 },
      { z: 7.25, rx: 0.68, ry: 0.5, yOff: 0.0 },
      { z: 7.55, rx: 0.01, ry: 0.01, yOff: 0.0 },
    ],
    24
  );
  builder.add(bodyGeo, hornetGray, 0, 0, 0);
  bodyGeo.dispose();

  const radGeo = createLoftedFuselageGeometry(
    [
      { z: -9.32, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -8.35, rx: 0.24, ry: 0.22, yOff: 0.02 },
      { z: -7.0, rx: 0.51, ry: 0.45, yOff: 0.03 },
    ],
    18
  );
  builder.add(radGeo, radomeMat, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  radGeo.dispose();

  // Blended F/A-18E Leading-Edge Extensions (LEX) curving smoothly from cheek into main wing root
  const lexGeo = createBlendedStrakeGeometry([
    { z: -5.35, xIn: 0.52, xOut: 0.78, y: 0.08, thick: 0.12 },
    { z: -4.1, xIn: 0.65, xOut: 1.48, y: 0.08, thick: 0.15 },
    { z: -2.4, xIn: 0.78, xOut: 2.02, y: 0.06, thick: 0.17 },
    { z: -0.9, xIn: 0.86, xOut: 2.15, y: 0.02, thick: 0.16 },
    { z: 0.4, xIn: 0.88, xOut: 1.95, y: -0.02, thick: 0.14 },
  ]);
  builder.add(lexGeo, hornetDark, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  builder.add(lexGeo, hornetDark, 0, 0, 0, 0, 0, 0, -1, 1, 1, true);
  lexGeo.dispose();

  // Cambered swept airfoil wings + stabilators
  addMirroredWings(builder, 3.85, 1.15, 6.75, 2.45, 0.16, -0.02, hornetGray, -0.02, 0.65, 0, 0.08);
  addMirroredWings(builder, 1.95, 0.66, 3.45, 1.35, 0.1, -0.04, hornetGray, -0.06, 6.2, 0, 0.02);

  // Sculpted intakes, twin nacelles, canted vertical fins, pylons & wingtip Sidewinders
  const nacGeo = createLoftedFuselageGeometry(
    [
      { z: -2.2, rx: 0.5, ry: 0.48 },
      { z: 0.0, rx: 0.52, ry: 0.5 },
      { z: 2.1, rx: 0.46, ry: 0.46 },
    ],
    16
  );
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(2.45, 0);
  fin.lineTo(1.22, 2.45);
  fin.lineTo(0.28, 2.45);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.09, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025 }).rotateY(Math.PI / 2);
  const railGeo = new THREE.BoxGeometry(0.12, 0.1, 2.4);
  const pylonGeo = new THREE.BoxGeometry(0.08, 0.34, 1.65);
  const mslBody = new THREE.CylinderGeometry(0.075, 0.075, 2.75, 8).rotateX(Math.PI / 2);
  const mslNose = new THREE.ConeGeometry(0.075, 0.32, 8).rotateX(-Math.PI / 2);
  const tankGeo = new THREE.CapsuleGeometry(0.24, 2.5, 4, 8).rotateX(Math.PI / 2);

  for (const s of [-1, 1] as const) {
    addSculptedIntake(builder, hornetDark, intakeVoid, chevronMat, s * 1.04, -0.14, -1.68, 0.92, 0.66, 3.3, -s * 0.07);
    builder.add(nacGeo, hornetGray, s * 0.62, -0.02, 5.1);
    addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeVoid, s * 0.62, -0.02, 7.5, 0.46, 0.96, 14);
    builder.add(finGeo, hornetDark, s * 0.98, 0.36, 6.15, 0, 0, -s * 0.34);

    // Wingtip Sidewinders + underwing weapon pylons + drop tanks
    builder.add(railGeo, hornetDark, s * 6.76, -0.04, 1.85, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslBody, missileMat, s * 6.86, -0.04, 1.85, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslNose, titaniumMat, s * 6.86, -0.04, 0.32, 0, 0, 0, 1, 1, 1, false);
    builder.add(pylonGeo, hornetDark, s * 2.55, -0.22, 0.9, 0, 0, 0, 1, 1, 1, false);
    builder.add(pylonGeo, hornetDark, s * 4.25, -0.26, 1.45, 0, 0, 0, 1, 1, 1, false);
    builder.add(tankGeo, hornetDark, s * 2.55, -0.46, 0.9, 0, 0, 0, 1, 1, 1, false);

    // Articulated aileron, stabilator & canted rudder
    addControlSurface(rig, hornetDark, G, 'aileron', s, s * 5.2, -0.14, 2.7, 2.15, 0.45, 0.06, 'x', 0.42);
    addControlSurface(rig, hornetDark, G, 'elevator', s, s * 2.1, -0.1, 6.8, 2.1, 0.55, 0.06, 'x', 0.38);
    addControlSurface(rig, hornetDark, G, 'rudder', s, s * 1.4, 0.55, 6.25, 1.8, 0.46, 0.06, 'y', 0.44, -s * 0.34);

    // Retractable Carrier Main Gear (wheel bottom y = -1.54)
    addLandingGearAssembly(rig, 0.34, 0.22, 0.98, tireMat, titaniumMat, hornetGray, G, s * 1.48, -1.2, 1.45, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  nacGeo.dispose();
  finGeo.dispose();
  railGeo.dispose();
  pylonGeo.dispose();
  mslBody.dispose();
  mslNose.dispose();
  tankGeo.dispose();

  addLandingGearAssembly(rig, 0.24, 0.16, 1.05, tireMat, titaniumMat, hornetGray, G, 0, -1.3, -4.6, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  const ctrTank = new THREE.CapsuleGeometry(0.25, 2.6, 4, 8).rotateX(Math.PI / 2);
  builder.add(ctrTank, hornetDark, 0, -0.68, 0.2, 0, 0, 0, 1, 1, 1, false);
  ctrTank.dispose();

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.46, 0.48, 3.1), canopyMat, 0, 0.72, -3.38, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.26, -3.45, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x334155, 0x0f172a);
  pilot.position.set(0, 0.34, -3.45);
  G.add(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 0.62, -0.02, 7.92, 0.4, 4.3, false, flames);
  }

  const strobes = createStrobeLights([-6.85, -0.02, 1.85], [6.85, -0.02, 1.85], [0, 2.88, 5.9], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.48, -1.54, 1.45), w: 1 },
      { v: new THREE.Vector3(1.48, -1.54, 1.45), w: 1 },
      { v: new THREE.Vector3(0, -1.54, -4.6), w: 1 },
      { v: new THREE.Vector3(-6.8, -0.05, 1.85), w: 0 },
      { v: new THREE.Vector3(6.8, -0.05, 1.85), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 7.6), w: 0 },
    ],
  };
}

function buildF35Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const stealthBody = new THREE.MeshStandardMaterial({
    color: 0x5c6675,
    map: pbr.stealthAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const stealthAccent = new THREE.MeshStandardMaterial({
    color: 0x3b4656,
    map: pbr.stealthAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.022,
    roughness: 0.38,
    metalness: 0.55,
  });
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0x26303d, roughness: 0.48, metalness: 0.3 });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45, metalness: 0.3 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.24, metalness: 0.92 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const goldCanopyMat = makeGlassMaterial(0xd97706, 0.78);

  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -8.75, rx: 0.01, ry: 0.01 },
      { z: -7.5, rx: 0.34, ry: 0.24, chine: 0.55 },
      { z: -5.4, rx: 0.78, ry: 0.48, chine: 0.75, botFlat: 0.5 },
      { z: -2.4, rx: 1.18, ry: 0.64, chine: 0.65, botFlat: 0.55, dorsal: 0.2 },
      { z: 1.4, rx: 1.32, ry: 0.66, chine: 0.4, botFlat: 0.55, dorsal: 0.26 },
      { z: 4.8, rx: 1.16, ry: 0.58, botFlat: 0.45, dorsal: 0.16 },
      { z: 6.8, rx: 0.82, ry: 0.52 },
      { z: 7.15, rx: 0.01, ry: 0.01 },
    ],
    24
  );
  builder.add(bodyGeo, stealthBody, 0, 0.04, 0);
  bodyGeo.dispose();

  const noseGeo = createLoftedFuselageGeometry(
    [
      { z: -8.85, rx: 0.01, ry: 0.01 },
      { z: -7.6, rx: 0.34, ry: 0.24, chine: 0.6 },
      { z: -6.3, rx: 0.64, ry: 0.42, chine: 0.7 },
    ],
    18
  );
  builder.add(noseGeo, radomeMat, 0, 0.02, 0, 0, 0, 0, 1, 1, 1, false);
  noseGeo.dispose();

  const eotsGeo = new THREE.OctahedronGeometry(0.22, 0);
  builder.add(eotsGeo, goldCanopyMat, 0, -0.34, -6.45, 0, Math.PI / 4, 0, 1.0, 0.7, 1.3, false);
  eotsGeo.dispose();

  const chineLex = createBlendedStrakeGeometry([
    { z: -4.9, xIn: 0.72, xOut: 1.12, y: 0.02, thick: 0.1 },
    { z: -3.2, xIn: 0.88, xOut: 1.65, y: 0.0, thick: 0.14 },
    { z: -1.1, xIn: 0.96, xOut: 1.85, y: -0.02, thick: 0.14 },
  ]);
  builder.add(chineLex, stealthAccent, 0, 0, 0);
  builder.add(chineLex, stealthAccent, 0, 0, 0, 0, 0, 0, -1, 1, 1);
  chineLex.dispose();

  addMirroredWings(builder, 4.5, 1.5, 6.55, 2.85, 0.16, -0.02, stealthBody, -0.04, 0.65, 0, 0.07);
  addMirroredWings(builder, 2.3, 0.85, 3.7, 1.45, 0.1, -0.03, stealthAccent, -0.04, 5.75, 0, 0.02);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(2.5, 0);
  fin.lineTo(1.15, 2.42);
  fin.lineTo(0.25, 2.42);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);

  for (const s of [-1, 1] as const) {
    addSculptedIntake(builder, stealthAccent, intakeVoid, chevronMat, s * 1.12, -0.08, -1.75, 0.88, 0.64, 3.1, -s * 0.1);
    builder.add(finGeo, stealthAccent, s * 1.12, 0.36, 5.85, 0, 0, -s * 0.38);

    addControlSurface(rig, stealthAccent, G, 'aileron', s, s * 4.8, -0.14, 2.95, 2.2, 0.48, 0.06, 'x', 0.4);
    addControlSurface(rig, stealthAccent, G, 'elevator', s, s * 2.25, -0.1, 6.45, 2.1, 0.56, 0.06, 'x', 0.38);
    addControlSurface(rig, stealthAccent, G, 'rudder', s, s * 1.52, 0.55, 5.95, 1.75, 0.45, 0.06, 'y', 0.42, -s * 0.38);

    addLandingGearAssembly(rig, 0.34, 0.22, 1.0, tireMat, titaniumMat, stealthBody, G, s * 1.48, -1.2, 1.45, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  finGeo.dispose();

  addLandingGearAssembly(rig, 0.24, 0.16, 1.05, tireMat, titaniumMat, stealthBody, G, 0, -1.3, -4.3, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeVoid, 0, 0.02, 7.1, 0.72, 1.25, 16);

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.49, 0.48, 2.95), goldCanopyMat, 0, 0.68, -3.1, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.22, -3.2, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x1e293b, 0x0f172a);
  pilot.position.set(0, 0.3, -3.2);
  G.add(pilot);

  const flames: THREE.Mesh[] = [];
  createMachFlameStack(G, 0, 0.02, 7.65, 0.62, 5.0, false, flames);

  const strobes = createStrobeLights([-6.55, -0.02, 2.6], [6.55, -0.02, 2.6], [0, 2.75, 5.5], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.48, -1.54, 1.45), w: 1 },
      { v: new THREE.Vector3(1.48, -1.54, 1.45), w: 1 },
      { v: new THREE.Vector3(0, -1.54, -4.3), w: 1 },
      { v: new THREE.Vector3(-6.55, -0.04, 2.5), w: 0 },
      { v: new THREE.Vector3(6.55, -0.04, 2.5), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 7.2), w: 0 },
    ],
  };
}

function buildCessnaModel(): BuiltAircraftModel {
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const whitePaint = new THREE.MeshStandardMaterial({
    color: 0xeef3f8,
    map: pbr.whiteAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.018,
    roughness: 0.35,
    metalness: 0.45,
  });
  const crimsonAccent = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.32, metalness: 0.42 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.75 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ee, roughness: 0.18, metalness: 0.9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0x7dd3fc, 0.72);

  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -4.15, rx: 0.01, ry: 0.01, yOff: 0.04 },
      { z: -3.95, rx: 0.42, ry: 0.4, yOff: 0.04 },
      { z: -3.1, rx: 0.68, ry: 0.6, yOff: 0.05, botFlat: 0.35 },
      { z: -1.4, rx: 0.84, ry: 0.78, yOff: 0.1, botFlat: 0.45 },
      { z: 0.25, rx: 0.8, ry: 0.72, yOff: 0.08, botFlat: 0.45 },
      { z: 1.7, rx: 0.58, ry: 0.54, yOff: 0.1 },
      { z: 3.2, rx: 0.36, ry: 0.38, yOff: 0.15 },
      { z: 4.2, rx: 0.18, ry: 0.24, yOff: 0.18 },
      { z: 4.35, rx: 0.01, ry: 0.01, yOff: 0.18 },
    ],
    20
  );
  builder.add(fuseGeo, whitePaint, 0, 0, 0);
  fuseGeo.dispose();

  const cowlGeo = createLoftedFuselageGeometry(
    [
      { z: -4.02, rx: 0.44, ry: 0.42, yOff: 0.04 },
      { z: -2.75, rx: 0.72, ry: 0.62, yOff: 0.05, botFlat: 0.3 },
    ],
    18
  );
  builder.add(cowlGeo, crimsonAccent, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  cowlGeo.dispose();

  addMirroredWings(builder, 1.72, 1.32, 5.45, 0.25, 0.16, 0.035, whitePaint, 0.96, -0.5, 0.16, 0.11);
  const strutGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.55, 6);
  for (const s of [-1, 1] as const) {
    builder.add(strutGeo, darkMetal, s * 2.05, 0.28, -0.45, 0, 0, s * 0.98, 1, 1, 1, false);
    addControlSurface(rig, crimsonAccent, G, 'aileron', s, s * 3.85, 1.06, 0.18, 2.1, 0.34, 0.05, 'x', 0.42);
    addControlSurface(rig, whitePaint, G, 'elevator', s, s * 1.02, 0.18, 4.0, 1.45, 0.32, 0.05, 'x', 0.38);
  }
  strutGeo.dispose();

  addMirroredWings(builder, 1.02, 0.62, 1.85, 0.3, 0.09, 0, whitePaint, 0.18, 3.6);
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.5, 0);
  finShape.lineTo(0.85, 1.45);
  finShape.lineTo(0.1, 1.45);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);
  builder.add(finGeo, crimsonAccent, -0.045, 0.25, 4.25);
  finGeo.dispose();

  addControlSurface(rig, whitePaint, G, 'rudder', 0, 0, 0.28, 4.25, 1.35, 0.34, 0.06, 'y', 0.45);

  const legGeo = new THREE.BoxGeometry(0.08, 0.95, 0.14);
  const spatGeo = new THREE.SphereGeometry(0.32, 10, 8);
  for (const s of [-1, 1] as const) {
    builder.add(legGeo, whitePaint, s * 0.95, -0.72, 0.15, 0, 0, s * 0.42, 1, 1, 1, false);
    builder.add(spatGeo, crimsonAccent, s * 1.24, -1.1, 0.18, 0, 0, 0, 0.65, 0.72, 1.65, false);
    addLandingGearAssembly(rig, 0.28, 0.16, 0.28, tireMat, chromeMat, whitePaint, G, s * 1.24, -1.12, 0.15, {
      retractable: false,
      hasDoor: false,
    });
  }
  legGeo.dispose();
  spatGeo.dispose();
  addLandingGearAssembly(rig, 0.25, 0.14, 0.85, tireMat, chromeMat, whitePaint, G, 0, -1.15, -3.05, {
    retractable: false,
    hasDoor: false,
  });

  builder.flushInto(G);

  const cabinGlass = addPart(createBubbleCanopyGeometry(0.75, 0.56, 2.35), glassMat, 0, 0.54, -0.75, G);
  cabinGlass.renderOrder = 3;
  rig.canopies.push(cabinGlass);

  addCockpitInterior(rig, G, -0.26, 0.12, -0.75, false);
  const pilot = createPilotFigure(0xe2e8f0, 0x1e3a8a, 0x1e293b);
  pilot.position.set(-0.26, 0.18, -0.75);
  G.add(pilot);
  const pax = createPilotFigure(0xf97316, 0x334155, 0x0f172a);
  pax.position.set(0.26, 0.18, -0.75);
  G.add(pax);

  const { prop, disc } = makePropeller(2, 1.15, darkMetal, chromeMat, 0, 0.04, -4.08, G);
  const strobes = createStrobeLights([-5.65, 1.16, -0.65], [5.65, 1.16, -0.65], [0, 1.72, 4.18], G);

  return {
    group: G,
    pilot,
    pax,
    props: [prop],
    discs: [disc],
    flames: [],
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.24, -1.4, 0.15), w: 1 },
      { v: new THREE.Vector3(1.24, -1.4, 0.15), w: 1 },
      { v: new THREE.Vector3(0, -1.4, -3.05), w: 1 },
      { v: new THREE.Vector3(-5.6, 1.1, -0.6), w: 0 },
      { v: new THREE.Vector3(5.6, 1.1, -0.6), w: 0 },
      { v: new THREE.Vector3(0, 0.25, 4.25), w: 0 },
    ],
  };
}

function buildF16Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const stealthGray = new THREE.MeshStandardMaterial({
    color: 0xa0acb9,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.03,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const darkSlate = new THREE.MeshStandardMaterial({
    color: 0x424d5e,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.025,
    roughness: 0.35,
    metalness: 0.55,
  });
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.52, metalness: 0.28 });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.3 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x2f343b, roughness: 0.24, metalness: 0.9 });
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const goldCanopyMat = makeGlassMaterial(0xd97706, 0.78);

  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -8.55, rx: 0.01, ry: 0.01 },
      { z: -7.5, rx: 0.26, ry: 0.24 },
      { z: -5.9, rx: 0.56, ry: 0.48, chine: 0.35 },
      { z: -3.6, rx: 0.88, ry: 0.62, chine: 0.55, botFlat: 0.35 },
      { z: -1.0, rx: 1.08, ry: 0.68, chine: 0.6, dorsal: 0.24 },
      { z: 2.5, rx: 1.02, ry: 0.66, chine: 0.35, dorsal: 0.26 },
      { z: 5.8, rx: 0.84, ry: 0.58, dorsal: 0.18 },
      { z: 7.1, rx: 0.68, ry: 0.54 },
      { z: 7.25, rx: 0.01, ry: 0.01 },
    ],
    22
  );
  builder.add(bodyGeo, stealthGray, 0, 0.02, 0);
  bodyGeo.dispose();

  const radGeo = createLoftedFuselageGeometry(
    [
      { z: -8.62, rx: 0.01, ry: 0.01 },
      { z: -7.6, rx: 0.25, ry: 0.23 },
      { z: -6.2, rx: 0.52, ry: 0.46 },
    ],
    16
  );
  builder.add(radGeo, radomeMat, 0, 0.02, 0, 0, 0, 0, 1, 1, 1, false);
  radGeo.dispose();

  // Sculpted ventral smiling intake scoop
  addSculptedIntake(builder, darkSlate, intakeVoid, chevronMat, 0, -0.76, -2.15, 1.24, 0.64, 3.6, 0);

  // Blended wing-body strake
  const strakeGeo = createBlendedStrakeGeometry([
    { z: -4.4, xIn: 0.52, xOut: 0.88, y: 0.05, thick: 0.1 },
    { z: -2.7, xIn: 0.72, xOut: 1.72, y: 0.02, thick: 0.14 },
    { z: -0.9, xIn: 0.85, xOut: 1.95, y: -0.04, thick: 0.14 },
  ]);
  builder.add(strakeGeo, darkSlate, 0, 0, 0);
  builder.add(strakeGeo, darkSlate, 0, 0, 0, 0, 0, 0, -1, 1, 1);
  strakeGeo.dispose();

  addMirroredWings(builder, 3.75, 1.15, 4.95, 2.7, 0.14, -0.02, stealthGray, -0.08, 0.25, 0, 0.07);
  addMirroredWings(builder, 1.85, 0.65, 2.75, 1.3, 0.09, -0.05, stealthGray, -0.05, 5.45, 0, 0.02);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(2.7, 0);
  fin.lineTo(1.15, 2.65);
  fin.lineTo(0.2, 2.65);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.11, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);
  builder.add(finGeo, darkSlate, -0.055, 0.65, 6.95);
  finGeo.dispose();

  addControlSurface(rig, darkSlate, G, 'rudder', 0, 0, 0.72, 6.95, 2.1, 0.45, 0.06, 'y', 0.44);

  const mslBody = new THREE.CylinderGeometry(0.085, 0.085, 2.95, 8).rotateX(Math.PI / 2);
  const mslNose = new THREE.ConeGeometry(0.085, 0.35, 8).rotateX(-Math.PI / 2);
  const pylonGeo = new THREE.BoxGeometry(0.08, 0.32, 1.5);
  const tankGeo = new THREE.CapsuleGeometry(0.24, 2.6, 4, 8).rotateX(Math.PI / 2);
  for (const s of [-1, 1] as const) {
    builder.add(mslBody, missileMat, s * 5.02, -0.08, 2.45, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslNose, darkSlate, s * 5.02, -0.08, 0.82, 0, 0, 0, 1, 1, 1, false);
    builder.add(pylonGeo, darkSlate, s * 2.15, -0.24, 1.2, 0, 0, 0, 1, 1, 1, false);
    builder.add(tankGeo, darkSlate, s * 2.15, -0.52, 1.2, 0, 0, 0, 1, 1, 1, false);

    addControlSurface(rig, darkSlate, G, 'aileron', s, s * 3.55, -0.15, 2.35, 1.85, 0.38, 0.055, 'x', 0.42);
    addControlSurface(rig, stealthGray, G, 'elevator', s, s * 1.75, -0.12, 6.1, 1.75, 0.48, 0.055, 'x', 0.38);

    addLandingGearAssembly(rig, 0.36, 0.22, 0.95, tireMat, titaniumMat, stealthGray, G, s * 1.18, -1.14, 1.65, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  mslBody.dispose();
  mslNose.dispose();
  pylonGeo.dispose();
  tankGeo.dispose();

  addLandingGearAssembly(rig, 0.28, 0.18, 0.92, tireMat, titaniumMat, stealthGray, G, 0, -1.22, -4.1, {
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeVoid, 0, 0, 7.35, 0.65, 1.12, 16);

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.48, 0.5, 3.15), goldCanopyMat, 0, 0.72, -3.1, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.28, -3.15, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x3f6212, 0x0f172a);
  pilot.position.set(0, 0.36, -3.15);
  G.add(pilot);

  const flames: THREE.Mesh[] = [];
  createMachFlameStack(G, 0, 0, 7.82, 0.56, 4.8, false, flames);

  const strobes = createStrobeLights([-5.08, -0.06, 2.45], [5.08, -0.06, 2.45], [0, 3.32, 6.2], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.18, -1.5, 1.65), w: 1 },
      { v: new THREE.Vector3(1.18, -1.5, 1.65), w: 1 },
      { v: new THREE.Vector3(0, -1.5, -4.1), w: 1 },
      { v: new THREE.Vector3(-5.0, -0.1, 2.4), w: 0 },
      { v: new THREE.Vector3(5.0, -0.1, 2.4), w: 0 },
      { v: new THREE.Vector3(0, 0.2, 7.6), w: 0 },
    ],
  };
}

function buildAirlinerModel(textures: WorldTextures): BuiltAircraftModel {
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const fuselageMat = new THREE.MeshStandardMaterial({
    map: textures.airlinerBody,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.024,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.34,
    metalness: 0.46,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xeef2f6,
    map: pbr.whiteAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.022,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.32,
    metalness: 0.48,
  });
  const wingSilver = new THREE.MeshStandardMaterial({
    color: 0xdbe3ee,
    map: pbr.whiteAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const navyTail = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.02,
    roughness: 0.34,
    metalness: 0.42,
  });
  const nacelleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    map: pbr.whiteAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.022,
    roughness: 0.32,
    metalness: 0.5,
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.14, metalness: 0.94 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.74 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const cockpitGlass = makeGlassMaterial(0x1e293b, 0.76);

  // Smooth lofted widebody fuselage with sculpted nose brow & upswept tailcone
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -17.1, rx: 0.01, ry: 0.01, yOff: -0.28 },
      { z: -16.2, rx: 0.52, ry: 0.48, yOff: -0.22 },
      { z: -14.8, rx: 1.15, ry: 1.05, yOff: -0.1 },
      { z: -12.4, rx: 1.66, ry: 1.62, yOff: 0.0 },
      { z: -9.5, rx: 1.76, ry: 1.78, yOff: 0.02 },
      { z: 6.5, rx: 1.76, ry: 1.78, yOff: 0.02 },
      { z: 12.2, rx: 1.48, ry: 1.52, yOff: 0.12 },
      { z: 16.5, rx: 0.76, ry: 0.82, yOff: 0.28 },
      { z: 19.2, rx: 0.16, ry: 0.18, yOff: 0.42 },
      { z: 19.5, rx: 0.01, ry: 0.01, yOff: 0.44 },
    ],
    26
  );
  builder.add(fuseGeo, fuselageMat, 0, 0, 0);
  fuseGeo.dispose();

  // Cambered swept supercritical wings + raked wingtips + flap track fairings
  addMirroredWings(builder, 5.8, 1.55, 14.8, 6.8, 0.28, 0.09, wingSilver, -0.82, -1.25, 0.72, 0.09);
  const fairingGeo = new THREE.CapsuleGeometry(0.16, 1.65, 4, 8).rotateX(Math.PI / 2);
  for (const s of [-1, 1] as const) {
    for (const fx of [4.2, 8.2, 11.4]) {
      builder.add(fairingGeo, wingSilver, s * fx, -0.78 + fx * 0.085, 1.2 + fx * 0.36, 0, 0, 0, 1, 1, 1, false);
    }
    addControlSurface(rig, wingSilver, G, 'aileron', s, s * 11.8, 0.12, 5.1, 3.2, 0.52, 0.08, 'x', 0.34, s * 0.09);
    addControlSurface(rig, wingSilver, G, 'elevator', s, s * 3.2, 0.78, 17.5, 3.3, 0.62, 0.08, 'x', 0.32, s * 0.08);
  }
  fairingGeo.dispose();

  // Tailplane & tall swept fin with articulated rudder
  addMirroredWings(builder, 3.05, 1.05, 5.85, 2.8, 0.16, 0.08, wingSilver, 0.68, 15.0, 0, 0.02);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(4.8, 0);
  fin.lineTo(1.85, 5.9);
  fin.lineTo(0.25, 5.9);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.24, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05 }).rotateY(Math.PI / 2);
  builder.add(finGeo, navyTail, -0.12, 1.2, 17.8);
  finGeo.dispose();
  addControlSurface(rig, whiteMat, G, 'rudder', 0, 0, 1.5, 17.7, 4.4, 0.85, 0.1, 'y', 0.35);

  // Sculpted GEnx high-bypass turbofan nacelles with chrome lip & chevron exhaust
  const pylonGeo = createBlendedStrakeGeometry([
    { z: -2.2, xIn: -0.18, xOut: 0.18, y: 0.0, thick: 0.62 },
    { z: 0.5, xIn: -0.16, xOut: 0.16, y: 0.18, thick: 0.55 },
    { z: 1.8, xIn: -0.1, xOut: 0.1, y: 0.12, thick: 0.34 },
  ]);
  const nacGeo = createLoftedFuselageGeometry(
    [
      { z: -2.05, rx: 0.98, ry: 0.98 },
      { z: -1.45, rx: 1.12, ry: 1.12 },
      { z: 0.4, rx: 1.08, ry: 1.08 },
      { z: 1.85, rx: 0.86, ry: 0.86 },
      { z: 2.0, rx: 0.72, ry: 0.72 },
    ],
    20
  );
  const lipGeo = new THREE.TorusGeometry(0.99, 0.1, 8, 20);
  const coreGeo = new THREE.CylinderGeometry(0.68, 0.56, 2.8, 16).rotateX(Math.PI / 2);
  for (const s of [-1, 1] as const) {
    const ex = s * 5.6;
    const ey = -1.68;
    const ez = -0.35;
    builder.add(pylonGeo, wingSilver, ex, ey + 0.82, ez + 0.25, 0, 0, 0, 1, 1, 1, false);
    builder.add(nacGeo, nacelleMat, ex, ey, ez);
    builder.add(lipGeo, chromeMat, ex, ey, ez - 2.02, 0, 0, 0, 1, 1, 1, false);
    builder.add(coreGeo, darkMetal, ex, ey, ez + 0.55, 0, 0, 0, 1, 1, 1, false);

    // Retractable 4-wheel bogie main gear (bottom wheel Y = -3.55)
    addLandingGearAssembly(rig, 0.48, 0.26, 2.25, tireMat, darkMetal, whiteMat, G, s * 2.85, -3.07, 1.4, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      doorSide: s,
    });
    addLandingGearAssembly(rig, 0.48, 0.26, 2.25, tireMat, darkMetal, whiteMat, G, s * 2.85, -3.07, 2.55, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      hasDoor: false,
    });
  }
  pylonGeo.dispose();
  nacGeo.dispose();
  lipGeo.dispose();
  coreGeo.dispose();

  addLandingGearAssembly(rig, 0.38, 0.2, 2.1, tireMat, darkMetal, whiteMat, G, 0, -3.17, -11.4, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  builder.flushInto(G);

  // Curved multi-pane flight deck windshield
  const ws = addPart(createBubbleCanopyGeometry(1.18, 0.72, 2.25), cockpitGlass, 0, 0.74, -13.9, G);
  ws.renderOrder = 3;
  rig.canopies.push(ws);

  const props: THREE.Object3D[] = [];
  const discs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const { prop, disc } = makePropeller(6, 0.88, chromeMat, darkMetal, s * 5.6, -1.68, -2.0, G);
    props.push(prop);
    discs.push(disc);
  }

  addCockpitInterior(rig, G, -0.42, 0.14, -14.0, false);
  addCockpitInterior(rig, G, 0.42, 0.14, -14.0, false);

  const pilot = createPilotFigure(0x1e293b, 0x0f172a, 0x0f172a);
  pilot.position.set(-0.42, 0.24, -14.0);
  G.add(pilot);
  const pax = createPilotFigure(0x475569, 0x0f172a, 0x334155);
  pax.position.set(0.42, 0.24, -14.0);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const strobes = createStrobeLights([-15.8, 0.95, 5.4], [15.8, 0.95, 5.4], [0, 6.95, 17.6], G);

  return {
    group: G,
    pilot,
    pax,
    props,
    discs,
    flames: [],
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-2.85, -3.55, 2.0), w: 1 },
      { v: new THREE.Vector3(2.85, -3.55, 2.0), w: 1 },
      { v: new THREE.Vector3(0, -3.55, -11.4), w: 1 },
      { v: new THREE.Vector3(-15.5, 0.8, 5.2), w: 0 },
      { v: new THREE.Vector3(15.5, 0.8, 5.2), w: 0 },
      { v: new THREE.Vector3(0, 0.2, 19.2), w: 0 },
    ],
  };
}

function buildBiplaneModel(): BuiltAircraftModel {
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.02,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.3,
    metalness: 0.45,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.018,
    roughness: 0.36,
    metalness: 0.22,
  });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.24, metalness: 0.78 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.75 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.94 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0xbae6fd, 0.62);

  // Smooth lofted aerobatic fuselage
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -3.45, rx: 0.01, ry: 0.01 },
      { z: -3.22, rx: 0.5, ry: 0.48 },
      { z: -2.2, rx: 0.62, ry: 0.64, botFlat: 0.2 },
      { z: -0.4, rx: 0.58, ry: 0.6, botFlat: 0.2 },
      { z: 1.4, rx: 0.42, ry: 0.46 },
      { z: 2.95, rx: 0.16, ry: 0.24 },
      { z: 3.15, rx: 0.01, ry: 0.01 },
    ],
    18
  );
  builder.add(fuseGeo, crimsonMat, 0, 0, 0);
  fuseGeo.dispose();

  const cowlGeo = new THREE.CylinderGeometry(0.58, 0.6, 0.68, 16).rotateX(Math.PI / 2);
  builder.add(cowlGeo, goldTrim, 0, 0, -2.84);
  cowlGeo.dispose();

  // Cambered upper & lower wings
  addMirroredWings(builder, 1.38, 1.15, 4.15, 0.42, 0.1, 0.015, creamMat, 0.92, -0.65, 0, 0.09);
  addMirroredWings(builder, 1.22, 1.05, 3.75, 0.12, 0.1, 0.04, creamMat, -0.35, -0.45, 0, 0.09);

  const sunGeo = new THREE.BoxGeometry(0.75, 0.11, 1.15);
  const strutGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.28, 6);
  const diagGeo = new THREE.CylinderGeometry(0.028, 0.028, 1.45, 6);
  const cabGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6);
  const legGeo = new THREE.BoxGeometry(0.07, 0.85, 0.12);
  const spatGeo = new THREE.SphereGeometry(0.28, 10, 8);
  for (const s of [-1, 1] as const) {
    builder.add(sunGeo, crimsonMat, s * 2.1, 0.95, -0.82, 0, 0, 0, 1, 1, 1, false);
    builder.add(strutGeo, darkMetal, s * 2.75, 0.28, -0.25, 0, 0, 0, 1, 1, 1, false);
    builder.add(strutGeo, darkMetal, s * 2.75, 0.28, -0.95, 0, 0, 0, 1, 1, 1, false);
    builder.add(diagGeo, darkMetal, s * 2.75, 0.28, -0.6, 0.52, 0, 0, 1, 1, 1, false);
    builder.add(cabGeo, darkMetal, s * 0.48, 0.58, -0.75, 0, 0, 0, 1, 1, 1, false);
    builder.add(legGeo, crimsonMat, s * 0.75, -0.68, -0.5, 0, 0, s * 0.35, 1, 1, 1, false);
    builder.add(spatGeo, crimsonMat, s * 0.98, -1.04, -0.46, 0, 0, 0, 0.58, 0.65, 1.55, false);

    addControlSurface(rig, crimsonMat, G, 'aileron', s, s * 2.85, -0.22, 0.12, 1.45, 0.32, 0.05, 'x', 0.45);
    addControlSurface(rig, creamMat, G, 'elevator', s, s * 0.88, 0.15, 3.05, 1.1, 0.34, 0.05, 'x', 0.42);
    // Fixed landing gear with rotating tires
    addLandingGearAssembly(rig, 0.28, 0.14, 0.55, tireMat, chromeMat, crimsonMat, G, s * 0.98, -1.07, -0.5, {
      retractable: false,
      hasDoor: false,
    });
  }
  sunGeo.dispose();
  strutGeo.dispose();
  diagGeo.dispose();
  cabGeo.dispose();
  legGeo.dispose();
  spatGeo.dispose();

  addMirroredWings(builder, 0.9, 0.55, 1.45, 0.25, 0.07, 0, crimsonMat, 0.14, 2.7, 0, 0.02);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(1.15, 0);
  fin.lineTo(0.65, 1.08);
  fin.lineTo(0.1, 1.08);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }).rotateY(Math.PI / 2);
  builder.add(finGeo, creamMat, -0.04, 0.18, 3.05);
  finGeo.dispose();

  addControlSurface(rig, crimsonMat, G, 'rudder', 0, 0, 0.22, 3.06, 0.95, 0.32, 0.05, 'y', 0.46);
  addLandingGearAssembly(rig, 0.15, 0.08, 0.42, tireMat, darkMetal, crimsonMat, G, 0, -1.2, 2.4, {
    retractable: false,
    hasDoor: false,
  });

  builder.flushInto(G);

  const ws1 = addPart(new THREE.CylinderGeometry(0.32, 0.36, 0.26, 12, 1, false, -1.2, 2.4), glassMat, 0, 0.65, -0.4, G);
  ws1.rotation.x = -0.35;
  const ws2 = addPart(new THREE.CylinderGeometry(0.32, 0.36, 0.26, 12, 1, false, -1.2, 2.4), glassMat, 0, 0.65, 0.75, G);
  ws2.rotation.x = -0.35;
  rig.canopies.push(ws1, ws2);

  addCockpitInterior(rig, G, 0, 0.08, 0.02, false);
  const pilot = createPilotFigure(0x78350f, 0x1e293b, 0x78350f);
  pilot.position.set(0, 0.2, 0.02);
  G.add(pilot);
  const pax = createPilotFigure(0xea580c, 0x334155, 0x1e293b);
  pax.position.set(0, 0.2, 1.05);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const { prop, disc } = makePropeller(2, 1.12, darkMetal, chromeMat, 0, 0, -3.45, G);
  const strobes = createStrobeLights([-4.2, 0.98, -1.0], [4.2, 0.98, -1.0], [0, 1.28, 3.0], G);

  return {
    group: G,
    pilot,
    pax,
    props: [prop],
    discs: [disc],
    flames: [],
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-0.98, -1.35, -0.5), w: 1 },
      { v: new THREE.Vector3(0.98, -1.35, -0.5), w: 1 },
      { v: new THREE.Vector3(0, -1.35, 2.4), w: 1 },
      { v: new THREE.Vector3(-4.1, 0.95, -0.9), w: 0 },
      { v: new THREE.Vector3(4.1, 0.95, -0.9), w: 0 },
      { v: new THREE.Vector3(0, 0.2, 3.2), w: 0 },
    ],
  };
}

function buildHerculesModel(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const tacticalGray = new THREE.MeshStandardMaterial({
    color: 0x76869b,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const darkOlive = new THREE.MeshStandardMaterial({
    color: 0x475569,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughness: 0.42,
    metalness: 0.46,
  });
  const radomeBlack = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.32 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.74 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0xd97706, 0.72);

  // Smooth lofted cargo airframe with flat cargo floor & upswept rear loading ramp
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -12.75, rx: 0.01, ry: 0.01, yOff: -0.25 },
      { z: -12.1, rx: 0.62, ry: 0.58, yOff: -0.22 },
      { z: -10.3, rx: 1.42, ry: 1.24, yOff: -0.05, botFlat: 0.4 },
      { z: -7.5, rx: 1.84, ry: 1.72, yOff: 0.0, botFlat: 0.55 },
      { z: 3.5, rx: 1.86, ry: 1.74, yOff: 0.0, botFlat: 0.55 },
      { z: 7.8, rx: 1.5, ry: 1.42, yOff: 0.22, botFlat: 0.3 },
      { z: 11.2, rx: 0.8, ry: 0.82, yOff: 0.52 },
      { z: 12.4, rx: 0.01, ry: 0.01, yOff: 0.6 },
    ],
    22
  );
  builder.add(fuseGeo, tacticalGray, 0, 0, 0);
  fuseGeo.dispose();

  const noseCap = new THREE.SphereGeometry(0.74, 14, 10);
  builder.add(noseCap, radomeBlack, 0, -0.22, -12.15, 0, 0, 0, 0.94, 0.86, 1.24, false);
  noseCap.dispose();

  addMirroredWings(builder, 4.4, 2.0, 13.8, 1.4, 0.28, 0.03, tacticalGray, 1.42, -1.2, 0, 0.08);
  addMirroredWings(builder, 2.5, 1.15, 5.2, 0.9, 0.14, 0, tacticalGray, 1.05, 10.6, 0, 0.02);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(4.2, 0);
  fin.lineTo(2.1, 5.2);
  fin.lineTo(0.25, 5.2);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04 }).rotateY(Math.PI / 2);
  builder.add(finGeo, darkOlive, -0.11, 1.12, 12.2);
  finGeo.dispose();
  addControlSurface(rig, tacticalGray, G, 'rudder', 0, 0, 1.3, 12.1, 4.2, 0.68, 0.1, 'y', 0.36);

  const nacGeo = createLoftedFuselageGeometry(
    [
      { z: -1.85, rx: 0.52, ry: 0.52 },
      { z: -0.6, rx: 0.58, ry: 0.58 },
      { z: 1.5, rx: 0.46, ry: 0.46 },
      { z: 1.85, rx: 0.34, ry: 0.34 },
    ],
    14
  );
  const scoopGeo = new THREE.BoxGeometry(0.45, 0.34, 1.4);
  const sponsonGeo = new THREE.CapsuleGeometry(0.56, 4.8, 4, 10).rotateX(Math.PI / 2);
  for (const s of [-1, 1] as const) {
    for (const ox of [4.2, 8.1]) {
      const ex = s * ox;
      const ey = 1.18;
      const ez = -2.2 + ox * 0.06;
      builder.add(nacGeo, darkOlive, ex, ey, ez);
      builder.add(scoopGeo, radomeBlack, ex, ey - 0.52, ez - 0.7, 0, 0, 0, 1, 1, 1, false);
    }
    builder.add(sponsonGeo, darkOlive, s * 1.88, -1.08, -0.5);

    addControlSurface(rig, darkOlive, G, 'aileron', s, s * 10.9, 1.75, 0.42, 3.2, 0.48, 0.07, 'x', 0.38);
    addControlSurface(rig, darkOlive, G, 'elevator', s, s * 2.9, 1.12, 12.1, 2.8, 0.5, 0.07, 'x', 0.36);

    // Retractable tandem main gear tucking into side sponsons (bottom wheel Y = -2.55)
    addLandingGearAssembly(rig, 0.48, 0.28, 1.25, tireMat, darkMetal, darkOlive, G, s * 1.95, -2.07, -1.1, {
      retractAxis: 'z',
      retractAngle: s * 1.38,
      doorSide: s,
    });
    addLandingGearAssembly(rig, 0.48, 0.28, 1.25, tireMat, darkMetal, darkOlive, G, s * 1.95, -2.07, 0.45, {
      retractAxis: 'z',
      retractAngle: s * 1.38,
      hasDoor: false,
    });
  }
  nacGeo.dispose();
  scoopGeo.dispose();
  sponsonGeo.dispose();

  addLandingGearAssembly(rig, 0.35, 0.18, 1.25, tireMat, darkMetal, tacticalGray, G, 0, -2.2, -9.8, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.45,
    doorSide: 1,
  });

  builder.flushInto(G);

  const deckGlass = addPart(createBubbleCanopyGeometry(1.18, 0.58, 1.95), glassMat, 0, 0.96, -10.1, G);
  deckGlass.renderOrder = 3;
  rig.canopies.push(deckGlass);

  const props: THREE.Object3D[] = [];
  const discs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    for (const ox of [4.2, 8.1]) {
      const ex = s * ox;
      const ey = 1.18;
      const ez = -2.2 + ox * 0.06;
      const { prop, disc } = makePropeller(4, 1.55, darkMetal, chromeMat, ex, ey, ez - 1.9, G);
      props.push(prop);
      discs.push(disc);
    }
  }

  addCockpitInterior(rig, G, -0.45, 0.46, -10.0, true);
  addCockpitInterior(rig, G, 0.45, 0.46, -10.0, false);
  const pilot = createPilotFigure(0x475569, 0x3f6212, 0x1e293b);
  pilot.position.set(-0.45, 0.58, -10.0);
  G.add(pilot);
  const pax = createPilotFigure(0x64748b, 0x3f6212, 0x0f172a);
  pax.position.set(0.45, 0.58, -10.0);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const strobes = createStrobeLights([-13.8, 1.85, -0.4], [13.8, 1.85, -0.4], [0, 6.25, 12.0], G);

  return {
    group: G,
    pilot,
    pax,
    props,
    discs,
    flames: [],
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.95, -2.55, -0.3), w: 1 },
      { v: new THREE.Vector3(1.95, -2.55, -0.3), w: 1 },
      { v: new THREE.Vector3(0, -2.55, -9.8), w: 1 },
      { v: new THREE.Vector3(-13.8, 1.8, -0.4), w: 0 },
      { v: new THREE.Vector3(13.8, 1.8, -0.4), w: 0 },
      { v: new THREE.Vector3(0, 0.5, 12.3), w: 0 },
    ],
  };
}

function buildB2Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const ramDark = new THREE.MeshStandardMaterial({
    color: 0x262e3a,
    map: pbr.stealthAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.025,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.42,
    metalness: 0.45,
  });
  const ramEdge = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.52, metalness: 0.36 });
  const intakeDark = new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.9, metalness: 0.15 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28, metalness: 0.88 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const cockpitGlass = makeGlassMaterial(0xd97706, 0.78);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 7.6);
  wingShape.lineTo(18.0, -3.9);
  wingShape.lineTo(18.0, -6.5);
  wingShape.lineTo(12.2, -3.1);
  wingShape.lineTo(7.4, -6.1);
  wingShape.lineTo(3.3, -3.6);
  wingShape.lineTo(0, -5.8);
  wingShape.lineTo(-3.3, -3.6);
  wingShape.lineTo(-7.4, -6.1);
  wingShape.lineTo(-12.2, -3.1);
  wingShape.lineTo(-18.0, -6.5);
  wingShape.lineTo(-18.0, -3.9);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    steps: 1,
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.22,
    bevelSize: 0.22,
    bevelSegments: 2,
  });
  wingGeo.rotateX(-Math.PI / 2);
  builder.add(wingGeo, ramDark, 0, -0.2, 0);
  wingGeo.dispose();

  // Smooth lofted chined center fuselage & beaver-tail spine
  const centerLoft = createLoftedFuselageGeometry(
    [
      { z: -7.6, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -6.2, rx: 1.1, ry: 0.46, yOff: 0.16, chine: 0.7, botFlat: 0.55 },
      { z: -3.8, rx: 2.35, ry: 0.78, yOff: 0.26, chine: 0.65, botFlat: 0.6 },
      { z: -0.6, rx: 2.65, ry: 0.82, yOff: 0.26, chine: 0.55, botFlat: 0.55 },
      { z: 3.0, rx: 1.95, ry: 0.58, yOff: 0.22, chine: 0.45, botFlat: 0.5 },
      { z: 5.7, rx: 0.4, ry: 0.18, yOff: 0.14 },
      { z: 5.9, rx: 0.01, ry: 0.01, yOff: 0.12 },
    ],
    22
  );
  builder.add(centerLoft, ramDark, 0, 0, 0);
  centerLoft.dispose();

  const nacelleGeo = createLoftedFuselageGeometry(
    [
      { z: -2.8, rx: 1.05, ry: 0.48, chine: 0.55, botFlat: 0.6 },
      { z: 0.0, rx: 1.15, ry: 0.56, chine: 0.5, botFlat: 0.6 },
      { z: 2.6, rx: 0.98, ry: 0.36, chine: 0.4, botFlat: 0.55 },
    ],
    14
  );
  const intakeLipGeo = new THREE.BoxGeometry(1.9, 0.52, 0.65);
  const intakeVoidGeo = new THREE.BoxGeometry(1.65, 0.34, 0.3);
  const troughGeo = new THREE.BoxGeometry(2.05, 0.18, 2.3);
  for (const s of [-1, 1] as const) {
    const nx = s * 3.15;
    builder.add(nacelleGeo, ramDark, nx, 0.32, 0.15);
    builder.add(intakeLipGeo, ramEdge, nx, 0.52, -2.55, 0, -s * 0.26, 0, 1, 1, 1, false);
    builder.add(intakeVoidGeo, intakeDark, nx, 0.48, -2.8, 0, -s * 0.26, 0, 1, 1, 1, false);
    builder.add(troughGeo, metalMat, nx, 0.35, 2.65, 0, s * 0.22, 0, 1, 1, 1, false);

    // Split flying-wing elevons + outboard drag rudders
    addControlSurface(rig, ramEdge, G, 'elevator', s, s * 5.4, 0.02, 4.7, 3.2, 0.48, 0.08, 'x', 0.35);
    addControlSurface(rig, ramEdge, G, 'aileron', s, s * 10.1, 0.02, 4.1, 3.3, 0.48, 0.08, 'x', 0.38);
    addControlSurface(rig, ramEdge, G, 'decel', s, s * 15.1, 0.02, 4.9, 3.2, 0.52, 0.08, 'x', 0.45);

    // Retractable 4-wheel bogie main gear (bottom wheel Y = -2.35)
    addLandingGearAssembly(rig, 0.44, 0.22, 1.72, tireMat, metalMat, ramDark, G, s * 3.85, -1.91, 0.4, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      doorSide: s,
    });
    addLandingGearAssembly(rig, 0.44, 0.22, 1.72, tireMat, metalMat, ramDark, G, s * 3.85, -1.91, 1.25, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      hasDoor: false,
    });
  }
  nacelleGeo.dispose();
  intakeLipGeo.dispose();
  intakeVoidGeo.dispose();
  troughGeo.dispose();

  addLandingGearAssembly(rig, 0.34, 0.16, 1.82, tireMat, metalMat, ramDark, G, 0, -2.01, -4.45, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.45,
    doorSide: 1,
  });

  builder.flushInto(G);

  const ws = addPart(createBubbleCanopyGeometry(1.12, 0.48, 2.35), cockpitGlass, 0, 0.82, -5.05, G);
  ws.renderOrder = 3;
  rig.canopies.push(ws);

  addCockpitInterior(rig, G, -0.46, 0.25, -5.0, true);
  addCockpitInterior(rig, G, 0.46, 0.25, -5.0, true);
  const pilot = createPilotFigure(0x1e293b, 0x0f172a, 0x0f172a);
  pilot.position.set(-0.46, 0.35, -5.0);
  G.add(pilot);
  const pax = createPilotFigure(0x334155, 0x0f172a, 0x1e293b);
  pax.position.set(0.46, 0.35, -5.0);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const flames: THREE.Mesh[] = [];
  for (const fx of [-3.6, -2.7, 2.7, 3.6]) {
    createMachFlameStack(G, fx, 0.38, 3.3, 0.22, 2.0, true, flames);
  }

  const strobes = createStrobeLights([-17.8, 0.1, -4.8], [17.8, 0.1, -4.8], [0, 0.55, 5.4], G);

  return {
    group: G,
    pilot,
    pax,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-3.85, -2.35, 0.8), w: 1 },
      { v: new THREE.Vector3(3.85, -2.35, 0.8), w: 1 },
      { v: new THREE.Vector3(0, -2.35, -4.45), w: 1 },
      { v: new THREE.Vector3(-17.8, 0, 4.5), w: 0 },
      { v: new THREE.Vector3(17.8, 0, 4.5), w: 0 },
      { v: new THREE.Vector3(0, 0.2, 5.8), w: 0 },
    ],
  };
}

function buildSukhoiModel(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const flankerBlue = new THREE.MeshStandardMaterial({
    color: 0x8ea7c0,
    map: pbr.camoAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const splinterSlate = new THREE.MeshStandardMaterial({
    color: 0x3b4958,
    map: pbr.camoAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.028,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.38,
    metalness: 0.52,
  });
  const bellySky = new THREE.MeshStandardMaterial({
    color: 0x7da7d9,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.024,
    roughness: 0.36,
    metalness: 0.45,
  });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.3 });
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.25 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.22, metalness: 0.92 });
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const canopyMat = makeGlassMaterial(0xd97706, 0.78);

  // Smooth lofted Flanker fuselage with drooping radome, dorsal spine & stinger tail
  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -10.85, rx: 0.01, ry: 0.01, yOff: -0.22 },
      { z: -9.8, rx: 0.24, ry: 0.22, yOff: -0.16 },
      { z: -7.9, rx: 0.54, ry: 0.46, yOff: -0.06, chine: 0.2 },
      { z: -5.6, rx: 0.8, ry: 0.62, yOff: 0.02, chine: 0.35, botFlat: 0.35 },
      { z: -3.0, rx: 0.94, ry: 0.72, yOff: 0.06, chine: 0.4, botFlat: 0.4, dorsal: 0.28 },
      { z: 1.5, rx: 0.98, ry: 0.72, yOff: 0.05, botFlat: 0.4, dorsal: 0.36 },
      { z: 5.2, rx: 0.78, ry: 0.58, yOff: 0.02, dorsal: 0.2 },
      { z: 7.8, rx: 0.38, ry: 0.3, yOff: 0.0 },
      { z: 9.2, rx: 0.1, ry: 0.1, yOff: 0.02 },
      { z: 9.45, rx: 0.01, ry: 0.01, yOff: 0.02 },
    ],
    24
  );
  builder.add(bodyGeo, flankerBlue, 0, 0, 0);
  bodyGeo.dispose();

  const radGeo = createLoftedFuselageGeometry(
    [
      { z: -10.9, rx: 0.01, ry: 0.01, yOff: -0.22 },
      { z: -9.85, rx: 0.23, ry: 0.21, yOff: -0.16 },
      { z: -8.0, rx: 0.52, ry: 0.44, yOff: -0.06 },
    ],
    18
  );
  builder.add(radGeo, radomeMat, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  radGeo.dispose();

  // Blended Flanker Leading-Edge Extensions (LEX) curving from cockpit cheeks into main wing
  const lexGeo = createBlendedStrakeGeometry([
    { z: -6.2, xIn: 0.58, xOut: 0.85, y: 0.02, thick: 0.14 },
    { z: -4.6, xIn: 0.72, xOut: 1.58, y: 0.04, thick: 0.16 },
    { z: -2.8, xIn: 0.84, xOut: 2.1, y: 0.02, thick: 0.17 },
    { z: -1.1, xIn: 0.9, xOut: 2.25, y: -0.02, thick: 0.16 },
  ]);
  builder.add(lexGeo, splinterSlate, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  builder.add(lexGeo, splinterSlate, 0, 0, 0, 0, 0, 0, -1, 1, 1, true);
  lexGeo.dispose();

  // Cambered main wings + stabilators
  addMirroredWings(builder, 4.9, 1.35, 7.35, 3.9, 0.15, -0.015, flankerBlue, -0.05, -0.2, 0, 0.08);
  addMirroredWings(builder, 2.3, 0.75, 3.7, 1.65, 0.1, -0.03, flankerBlue, -0.06, 6.35, 0, 0.02);

  const nacGeo = createLoftedFuselageGeometry(
    [
      { z: -3.5, rx: 0.54, ry: 0.52 },
      { z: 0.0, rx: 0.58, ry: 0.55 },
      { z: 3.4, rx: 0.52, ry: 0.5 },
    ],
    16
  );
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(2.9, 0);
  finShape.lineTo(1.25, 2.85);
  finShape.lineTo(0.25, 2.85);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.11, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);
  const ventralFinGeo = new THREE.BoxGeometry(0.08, 0.75, 1.75);
  const pylonGeo = new THREE.BoxGeometry(0.08, 0.3, 1.75);
  const mslBody = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8).rotateX(Math.PI / 2);
  const mslNose = new THREE.ConeGeometry(0.08, 0.35, 8).rotateX(-Math.PI / 2);

  for (const s of [-1, 1] as const) {
    const ex = s * 1.04;
    addSculptedIntake(builder, splinterSlate, intakeVoid, chevronMat, ex, -0.45, -1.25, 1.04, 0.74, 2.4, 0);
    builder.add(nacGeo, bellySky, ex, -0.32, 3.3);
    addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeVoid, ex, -0.26, 7.25, 0.52, 1.15, 14);
    builder.add(finGeo, flankerBlue, s * 1.32, 0.45, 7.0, 0, 0, -s * 0.06);
    builder.add(ventralFinGeo, splinterSlate, s * 1.12, -0.95, 6.2, -0.2, 0, s * 0.14, 1, 1, 1, false);

    // Underwing & wingtip weapon pylons + R-77/R-73 missiles
    builder.add(pylonGeo, splinterSlate, s * 3.65, -0.25, 1.9, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslBody, missileMat, s * 7.42, -0.1, 3.0, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslNose, radomeMat, s * 7.42, -0.1, 1.45, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslBody, missileMat, s * 3.65, -0.45, 2.1, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslNose, radomeMat, s * 3.65, -0.45, 0.55, 0, 0, 0, 1, 1, 1, false);

    // Articulated forward canards, flaperons, all-moving stabilators & twin rudders
    addControlSurface(rig, splinterSlate, G, 'canard', s, s * 1.48, 0.04, -3.5, 1.65, 0.9, 0.07, 'x', 0.36);
    addControlSurface(rig, flankerBlue, G, 'aileron', s, s * 5.3, -0.12, 3.0, 2.25, 0.48, 0.06, 'x', 0.42);
    addControlSurface(rig, flankerBlue, G, 'elevator', s, s * 2.2, -0.06, 7.25, 2.2, 0.65, 0.07, 'x', 0.38);
    addControlSurface(rig, flankerBlue, G, 'rudder', s, s * 1.38, 0.52, 7.05, 2.15, 0.55, 0.07, 'y', 0.44, -s * 0.06);

    // Retractable main landing gear (bottom wheel Y = -1.72)
    addLandingGearAssembly(rig, 0.4, 0.24, 1.15, tireMat, titaniumMat, bellySky, G, s * 1.65, -1.32, 1.85, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  nacGeo.dispose();
  finGeo.dispose();
  ventralFinGeo.dispose();
  pylonGeo.dispose();
  mslBody.dispose();
  mslNose.dispose();

  addLandingGearAssembly(rig, 0.3, 0.17, 1.18, tireMat, titaniumMat, bellySky, G, 0, -1.42, -5.2, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.5, 0.5, 3.65), canopyMat, 0, 0.82, -4.3, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.25, -4.4, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x1e3a8a, 0x0f172a);
  pilot.position.set(0, 0.35, -4.4);
  G.add(pilot);
  rig.cockpitDetails.push(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 1.04, -0.26, 7.75, 0.45, 5.2, true, flames);
  }

  const strobes = createStrobeLights([-7.48, -0.05, 3.2], [7.48, -0.05, 3.2], [0, 3.35, 6.2], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.65, -1.72, 1.85), w: 1 },
      { v: new THREE.Vector3(1.65, -1.72, 1.85), w: 1 },
      { v: new THREE.Vector3(0, -1.72, -5.2), w: 1 },
      { v: new THREE.Vector3(-7.4, -0.1, 3.2), w: 0 },
      { v: new THREE.Vector3(7.4, -0.1, 3.2), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 9.0), w: 0 },
    ],
  };
}

function buildConcordeModel(): BuiltAircraftModel {
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    map: pbr.whiteAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.022,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.32,
    metalness: 0.5,
  });
  const navyTrim = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.32, metalness: 0.4 });
  const redTrim = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.34 });
  const intakeDark = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.26, metalness: 0.88 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0xd97706, 0.74);

  // Smooth lofted Mach-2 fuselage (from forward cockpit hinge z = -13.3 aft to tailcone z = 20.3)
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -13.5, rx: 1.02, ry: 1.06, yOff: 0.12 },
      { z: -11.4, rx: 1.12, ry: 1.16, yOff: 0.12 },
      { z: 12.2, rx: 1.12, ry: 1.16, yOff: 0.12 },
      { z: 16.2, rx: 0.78, ry: 0.84, yOff: 0.12 },
      { z: 19.6, rx: 0.2, ry: 0.22, yOff: 0.14 },
      { z: 20.3, rx: 0.01, ry: 0.01, yOff: 0.15 },
    ],
    24
  );
  builder.add(fuseGeo, whiteMat, 0, 0, 0);
  fuseGeo.dispose();

  // Animated Drooping Needle Radome + Visor Shield (lowers when gear is deployed!)
  const droopPivot = new THREE.Group();
  droopPivot.position.set(0, 0.12, -13.3);
  const needleGeo = createLoftedFuselageGeometry(
    [
      { z: -8.35, rx: 0.01, ry: 0.01, yOff: -0.18 },
      { z: -7.5, rx: 0.16, ry: 0.16, yOff: -0.15 },
      { z: -5.4, rx: 0.44, ry: 0.42, yOff: -0.1 },
      { z: -2.6, rx: 0.82, ry: 0.78, yOff: -0.04 },
      { z: 0.2, rx: 1.04, ry: 1.06, yOff: 0.0 },
    ],
    20
  );
  const noseMesh = addPart(needleGeo, whiteMat, 0, 0, 0, droopPivot, true);
  void noseMesh;
  // Pitot boom + retractable translucent heat visor inside droop nose group
  addPart(new THREE.CylinderGeometry(0.025, 0.04, 1.35, 8).rotateX(Math.PI / 2), metalMat, 0, -0.18, -8.9, droopPivot, false);
  const visorMesh = addPart(createBubbleCanopyGeometry(0.68, 0.42, 1.95), glassMat, 0, 0.46, -1.65, droopPivot, false);
  visorMesh.renderOrder = 3;
  rig.canopies.push(visorMesh);
  G.add(droopPivot);
  rig.droopNose = { pivot: droopPivot, droopRad: 0.22 };

  // Authentic slender Ogival Compound Delta Wing (silky smooth curveSegments + beveled cambered edge)
  const ogiveShape = new THREE.Shape();
  ogiveShape.moveTo(0, 10.6);
  ogiveShape.bezierCurveTo(2.15, 4.6, 3.65, -1.5, 11.15, -10.5);
  ogiveShape.lineTo(11.15, -12.6);
  ogiveShape.lineTo(0, -12.85);
  ogiveShape.closePath();
  const ogiveGeo = new THREE.ExtrudeGeometry(ogiveShape, {
    steps: 1,
    depth: 0.2,
    curveSegments: 24,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.12,
    bevelSegments: 3,
  }).rotateX(-Math.PI / 2);
  builder.add(ogiveGeo, whiteMat, 0, -0.54, 2.5, 0, 0, 0, 1, 1, 1, true);
  builder.add(ogiveGeo, whiteMat, 0, -0.54, 2.5, 0, 0, 0, -1, 1, 1, true);
  ogiveGeo.dispose();

  // Tail fin with British Airways / Speedbird navy & red livery band + articulated rudder
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(6.2, 0);
  fin.lineTo(2.4, 5.4);
  fin.lineTo(0.4, 5.4);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 }).rotateY(Math.PI / 2);
  builder.add(finGeo, navyTrim, -0.09, 0.88, 18.2);
  finGeo.dispose();
  const redStripe = new THREE.BoxGeometry(0.21, 1.8, 2.2);
  builder.add(redStripe, redTrim, 0, 3.6, 15.8, -0.4, 0, 0, 1, 1, 1, false);
  redStripe.dispose();
  addControlSurface(rig, whiteMat, G, 'rudder', 0, 0, 1.15, 18.1, 4.4, 0.72, 0.09, 'y', 0.34);

  // 4 Underwing Rectangular Olympus 593 Engine Nacelles (paired pods with splitter ramps & segmented nozzles)
  const nacShellGeo = new THREE.BoxGeometry(0.98, 0.88, 6.75);
  const splitterGeo = new THREE.BoxGeometry(0.16, 0.94, 6.85);
  const intakeMouthGeo = new THREE.BoxGeometry(0.84, 0.68, 0.32);
  const rampLipGeo = new THREE.BoxGeometry(0.9, 0.14, 0.55);
  for (const s of [-1, 1] as const) {
    // Center boundary-layer divider wall between paired nacelles
    builder.add(splitterGeo, metalMat, s * 3.8, -1.02, 10.6, 0, 0, 0, 1, 1, 1, false);
    for (const nx of [s * 3.24, s * 4.36]) {
      builder.add(nacShellGeo, whiteMat, nx, -1.02, 10.6);
      builder.add(intakeMouthGeo, intakeDark, nx, -1.02, 7.18, 0, 0, 0, 1, 1, 1, false);
      builder.add(rampLipGeo, redTrim, nx, -0.62, 7.28, 0.18, 0, 0, 1, 1, 1, false);
      addSegmentedAfterburnerNozzle(builder, metalMat, intakeDark, nx, -1.02, 14.15, 0.38, 0.82, 12);
    }

    // Inner & outer elevons
    addControlSurface(rig, whiteMat, G, 'elevator', s, s * 5.6, -0.46, 15.0, 2.6, 0.58, 0.07, 'x', 0.35);
    addControlSurface(rig, whiteMat, G, 'aileron', s, s * 9.0, -0.46, 15.0, 2.8, 0.58, 0.07, 'x', 0.38);

    // Retractable 4-wheel bogie main gear (bottom wheel Y = -2.65)
    addLandingGearAssembly(rig, 0.44, 0.22, 1.75, tireMat, metalMat, whiteMat, G, s * 3.2, -2.21, 5.85, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      doorSide: s,
    });
    addLandingGearAssembly(rig, 0.44, 0.22, 1.75, tireMat, metalMat, whiteMat, G, s * 3.2, -2.21, 6.75, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      hasDoor: false,
    });
  }
  nacShellGeo.dispose();
  splitterGeo.dispose();
  intakeMouthGeo.dispose();
  rampLipGeo.dispose();

  addLandingGearAssembly(rig, 0.34, 0.18, 1.85, tireMat, metalMat, whiteMat, G, 0, -2.31, -11.5, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.45,
    doorSide: 1,
  });

  builder.flushInto(G);

  const ws = addPart(createBubbleCanopyGeometry(0.84, 0.44, 1.95), glassMat, 0, 0.78, -13.65, G);
  ws.renderOrder = 3;
  rig.canopies.push(ws);

  addCockpitInterior(rig, G, -0.35, 0.26, -13.6, true);
  addCockpitInterior(rig, G, 0.35, 0.26, -13.6, false);
  const pilot = createPilotFigure(0xe2e8f0, 0x0f172a, 0x0f172a);
  pilot.position.set(-0.35, 0.35, -13.6);
  G.add(pilot);
  const pax = createPilotFigure(0xe2e8f0, 0x0f172a, 0x1e293b);
  pax.position.set(0.35, 0.35, -13.6);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const flames: THREE.Mesh[] = [];
  for (const fx of [-4.36, -3.24, 3.24, 4.36]) {
    createMachFlameStack(G, fx, -1.02, 14.55, 0.34, 3.8, false, flames);
  }

  const strobes = createStrobeLights([-11.1, -0.45, 14.2], [11.1, -0.45, 14.2], [0, 6.3, 18.0], G);

  return {
    group: G,
    pilot,
    pax,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-3.2, -2.65, 6.2), w: 1 },
      { v: new THREE.Vector3(3.2, -2.65, 6.2), w: 1 },
      { v: new THREE.Vector3(0, -2.65, -11.5), w: 1 },
      { v: new THREE.Vector3(-11.0, -0.5, 14.2), w: 0 },
      { v: new THREE.Vector3(11.0, -0.5, 14.2), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 19.6), w: 0 },
    ],
  };
}

function buildSR71Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const blackbirdMat = new THREE.MeshStandardMaterial({
    color: 0x1b2330,
    map: pbr.stealthAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.025,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.4,
    metalness: 0.5,
  });
  const redStripeMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.25 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.24, metalness: 0.9 });
  const intakeDark = new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.92, metalness: 0.12 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0xd97706, 0.78);

  // Smooth chined lofted fuselage from sharp nose spike to beaver-tail
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -15.5, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -13.6, rx: 0.34, ry: 0.28, yOff: 0.04, chine: 0.65, botFlat: 0.5 },
      { z: -10.5, rx: 0.72, ry: 0.58, yOff: 0.06, chine: 0.75, botFlat: 0.55 },
      { z: -6.5, rx: 0.94, ry: 0.76, yOff: 0.05, chine: 0.7, botFlat: 0.55 },
      { z: 6.5, rx: 0.94, ry: 0.76, yOff: 0.05, chine: 0.6, botFlat: 0.5 },
      { z: 11.8, rx: 0.66, ry: 0.52, yOff: 0.04, chine: 0.45 },
      { z: 14.6, rx: 0.22, ry: 0.18, yOff: 0.02 },
      { z: 15.25, rx: 0.01, ry: 0.01, yOff: 0.02 },
    ],
    22
  );
  builder.add(fuseGeo, blackbirdMat, 0, 0, 0);
  fuseGeo.dispose();

  // Signature wide forebody chines flowing from nose cone back to delta wing leading edge
  const chineGeo = createBlendedStrakeGeometry([
    { z: -14.1, xIn: 0.18, xOut: 0.38, y: 0.02, thick: 0.08 },
    { z: -10.5, xIn: 0.56, xOut: 1.48, y: 0.02, thick: 0.12 },
    { z: -6.5, xIn: 0.78, xOut: 2.05, y: 0.0, thick: 0.14 },
    { z: -2.0, xIn: 0.84, xOut: 2.35, y: -0.02, thick: 0.14 },
  ]);
  builder.add(chineGeo, blackbirdMat, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  builder.add(chineGeo, blackbirdMat, 0, 0, 0, 0, 0, 0, -1, 1, 1, true);
  chineGeo.dispose();

  // Swept double-delta wings
  addMirroredWings(builder, 8.8, 1.65, 8.5, 6.8, 0.16, -0.02, blackbirdMat, -0.06, 6.8, 0, 0.04);

  // Sculpted J58 nacelles with translating inlet shock cones & segmented ejector nozzles
  const nacGeo = createLoftedFuselageGeometry(
    [
      { z: -6.1, rx: 0.88, ry: 0.88 },
      { z: -3.0, rx: 0.98, ry: 0.98 },
      { z: 3.5, rx: 0.96, ry: 0.96 },
      { z: 6.1, rx: 0.88, ry: 0.88 },
    ],
    18
  );
  const coneGeo = new THREE.ConeGeometry(0.62, 2.55, 16).rotateX(-Math.PI / 2);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(3.4, 0);
  fin.lineTo(1.7, 2.75);
  fin.lineTo(0.45, 2.75);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);
  const redBand = new THREE.BoxGeometry(0.14, 0.45, 2.6);

  for (const s of [-1, 1] as const) {
    const nx = s * 3.35;
    builder.add(nacGeo, blackbirdMat, nx, 0.0, 6.8);
    builder.add(coneGeo, titaniumMat, nx, 0.0, -0.35, 0, 0, 0, 1, 1, 1, false);
    addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeDark, nx, 0.0, 13.25, 0.82, 1.35, 16);
    builder.add(finGeo, blackbirdMat, nx, 0.85, 12.2, 0, 0, s * 0.24);
    builder.add(redBand, redStripeMat, nx + s * 0.04, 2.15, 10.6, 0, 0, s * 0.24, 1, 1, 1, false);

    addControlSurface(rig, blackbirdMat, G, 'elevator', s, s * 1.9, -0.04, 14.3, 1.95, 0.55, 0.07, 'x', 0.35);
    addControlSurface(rig, blackbirdMat, G, 'aileron', s, s * 6.0, -0.1, 13.4, 2.8, 0.55, 0.07, 'x', 0.38);
    addControlSurface(rig, blackbirdMat, G, 'rudder', s, nx - s * 0.22, 1.05, 12.6, 2.0, 0.55, 0.07, 'y', 0.42, s * 0.24);

    // Retractable main gear (bottom wheel Y = -1.65)
    addLandingGearAssembly(rig, 0.42, 0.22, 1.15, tireMat, titaniumMat, blackbirdMat, G, nx * 0.72, -1.23, 5.2, {
      twin: true,
      retractAxis: 'z',
      retractAngle: -s * 1.44,
      doorSide: s,
    });
  }
  nacGeo.dispose();
  coneGeo.dispose();
  finGeo.dispose();
  redBand.dispose();

  addLandingGearAssembly(rig, 0.32, 0.16, 1.15, tireMat, titaniumMat, blackbirdMat, G, 0, -1.33, -7.8, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  builder.flushInto(G);

  const canopy1 = addPart(createBubbleCanopyGeometry(0.42, 0.36, 2.35), glassMat, 0, 0.76, -8.8, G);
  canopy1.renderOrder = 3;
  const canopy2 = addPart(createBubbleCanopyGeometry(0.4, 0.34, 2.15), glassMat, 0, 0.72, -6.5, G);
  canopy2.renderOrder = 3;
  rig.canopies.push(canopy1, canopy2);

  addCockpitInterior(rig, G, 0, 0.25, -8.9, true);
  addCockpitInterior(rig, G, 0, 0.25, -6.6, false);
  const pilot = createPilotFigure(0xe2e8f0, 0xd97706, 0x0f172a);
  pilot.position.set(0, 0.35, -8.9);
  G.add(pilot);
  const pax = createPilotFigure(0xf8fafc, 0xd97706, 0x1e293b);
  pax.position.set(0, 0.35, -6.6);
  G.add(pax);
  rig.cockpitDetails.push(pilot, pax);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 3.35, 0, 13.85, 0.62, 6.2, true, flames);
  }

  const strobes = createStrobeLights([-8.45, -0.02, 11.4], [8.45, -0.02, 11.4], [0, 0.45, 14.8], G);

  return {
    group: G,
    pilot,
    pax,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-2.4, -1.65, 5.2), w: 1 },
      { v: new THREE.Vector3(2.4, -1.65, 5.2), w: 1 },
      { v: new THREE.Vector3(0, -1.65, -7.8), w: 1 },
      { v: new THREE.Vector3(-8.4, -0.05, 11.4), w: 0 },
      { v: new THREE.Vector3(8.4, -0.05, 11.4), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 14.8), w: 0 },
    ],
  };
}

function buildF22Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const raptorSilver = new THREE.MeshStandardMaterial({
    color: 0x8590a0,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const raptorDark = new THREE.MeshStandardMaterial({
    color: 0x3b4554,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.38,
    metalness: 0.52,
  });
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.48, metalness: 0.32 });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.3 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.24, metalness: 0.9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const goldCanopyMat = makeGlassMaterial(0xd97706, 0.78);

  // Smooth chined stealth lofted fuselage
  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -9.7, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -8.25, rx: 0.38, ry: 0.24, yOff: 0.02, chine: 0.7 },
      { z: -6.0, rx: 0.88, ry: 0.48, yOff: 0.04, chine: 0.7, botFlat: 0.5 },
      { z: -3.2, rx: 1.24, ry: 0.68, yOff: 0.05, chine: 0.55, botFlat: 0.6 },
      { z: 1.5, rx: 1.38, ry: 0.74, yOff: 0.04, chine: 0.45, botFlat: 0.6 },
      { z: 5.2, rx: 1.25, ry: 0.62, yOff: 0.03, botFlat: 0.5 },
      { z: 6.8, rx: 0.88, ry: 0.42, yOff: 0.0 },
      { z: 7.2, rx: 0.01, ry: 0.01, yOff: 0.0 },
    ],
    24
  );
  builder.add(bodyGeo, raptorSilver, 0, 0, 0);
  bodyGeo.dispose();

  const noseGeo = createLoftedFuselageGeometry(
    [
      { z: -9.75, rx: 0.01, ry: 0.01, yOff: 0.02 },
      { z: -8.25, rx: 0.36, ry: 0.22, yOff: 0.02, chine: 0.7 },
      { z: -6.7, rx: 0.74, ry: 0.42, yOff: 0.04, chine: 0.7 },
    ],
    18
  );
  builder.add(noseGeo, radomeMat, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  noseGeo.dispose();

  // Blended F-22 diamond-planform leading-edge strake
  const lexGeo = createBlendedStrakeGeometry([
    { z: -6.2, xIn: 0.72, xOut: 0.92, y: 0.02, thick: 0.1 },
    { z: -4.4, xIn: 0.96, xOut: 1.62, y: 0.02, thick: 0.14 },
    { z: -2.2, xIn: 1.08, xOut: 1.85, y: 0.0, thick: 0.15 },
    { z: 0.4, xIn: 1.15, xOut: 1.9, y: -0.03, thick: 0.14 },
  ]);
  builder.add(lexGeo, raptorDark, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  builder.add(lexGeo, raptorDark, 0, 0, 0, 0, 0, 0, -1, 1, 1, true);
  lexGeo.dispose();

  addMirroredWings(builder, 5.2, 1.35, 6.75, 3.85, 0.14, -0.02, raptorSilver, -0.05, 0.4, 0, 0.06);
  addMirroredWings(builder, 2.5, 0.85, 3.85, 1.6, 0.1, -0.03, raptorDark, -0.06, 5.75, 0, 0.02);

  // Twin 2D thrust-vectoring rectangular nozzles + canted vertical fins
  const nozGeo = new THREE.BoxGeometry(0.92, 0.46, 1.25);
  const paddleGeo = new THREE.BoxGeometry(0.86, 0.1, 0.72);
  const nozVoidGeo = new THREE.BoxGeometry(0.76, 0.3, 0.25);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(2.7, 0);
  fin.lineTo(1.25, 2.55);
  fin.lineTo(0.25, 2.55);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);

  for (const s of [-1, 1] as const) {
    addSculptedIntake(builder, raptorDark, intakeVoid, chevronMat, s * 1.18, -0.18, -1.8, 0.88, 0.64, 3.3, -s * 0.12);
    builder.add(nozGeo, titaniumMat, s * 0.65, -0.02, 7.05, 0, 0, 0, 1, 1, 1, false);
    builder.add(paddleGeo, titaniumMat, s * 0.65, 0.22, 7.55, -0.14, 0, 0, 1, 1, 1, false);
    builder.add(paddleGeo, titaniumMat, s * 0.65, -0.26, 7.55, 0.14, 0, 0, 1, 1, 1, false);
    builder.add(nozVoidGeo, intakeVoid, s * 0.65, -0.02, 7.58, 0, 0, 0, 1, 1, 1, false);
    builder.add(finGeo, raptorDark, s * 1.22, 0.35, 6.1, 0, 0, -s * 0.46);

    addControlSurface(rig, raptorDark, G, 'aileron', s, s * 5.0, -0.12, 3.55, 2.2, 0.48, 0.06, 'x', 0.42);
    addControlSurface(rig, raptorDark, G, 'elevator', s, s * 2.2, -0.08, 6.95, 2.1, 0.56, 0.06, 'x', 0.38);
    addControlSurface(rig, raptorDark, G, 'rudder', s, s * 1.72, 0.62, 6.25, 1.9, 0.48, 0.06, 'y', 0.42, -s * 0.46);

    // Retractable main landing gear (bottom wheel Y = -1.52)
    addLandingGearAssembly(rig, 0.36, 0.22, 1.02, tireMat, titaniumMat, raptorSilver, G, s * 1.48, -1.16, 1.5, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  nozGeo.dispose();
  paddleGeo.dispose();
  nozVoidGeo.dispose();
  finGeo.dispose();

  addLandingGearAssembly(rig, 0.28, 0.17, 1.05, tireMat, titaniumMat, raptorSilver, G, 0, -1.24, -4.8, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.49, 0.44, 3.35), goldCanopyMat, 0, 0.68, -3.55, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.18, -3.65, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x334155, 0x0f172a);
  pilot.position.set(0, 0.28, -3.65);
  G.add(pilot);
  rig.cockpitDetails.push(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 0.65, -0.02, 7.65, 0.38, 4.5, true, flames);
  }

  const strobes = createStrobeLights([-6.75, -0.04, 3.6], [6.75, -0.04, 3.6], [0, 2.6, 5.4], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.48, -1.52, 1.5), w: 1 },
      { v: new THREE.Vector3(1.48, -1.52, 1.5), w: 1 },
      { v: new THREE.Vector3(0, -1.52, -4.8), w: 1 },
      { v: new THREE.Vector3(-6.75, -0.05, 3.5), w: 0 },
      { v: new THREE.Vector3(6.75, -0.05, 3.5), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 7.2), w: 0 },
    ],
  };
}

function buildA10Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const hogGray = new THREE.MeshStandardMaterial({
    color: 0x768394,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const hogDark = new THREE.MeshStandardMaterial({
    color: 0x475569,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.4,
    metalness: 0.48,
  });
  const oliveOrdnance = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.52, metalness: 0.25 });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.28, metalness: 0.88 });
  const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.22, metalness: 0.92 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const glassMat = makeGlassMaterial(0xd97706, 0.76);

  // Smooth rugged armored fuselage tub with forward chin & tapering aft boom
  const fuseGeo = createLoftedFuselageGeometry(
    [
      { z: -7.95, rx: 0.01, ry: 0.01, yOff: -0.05 },
      { z: -7.05, rx: 0.52, ry: 0.48, yOff: 0.0, botFlat: 0.45 },
      { z: -4.9, rx: 0.84, ry: 0.78, yOff: 0.06, botFlat: 0.5 },
      { z: -1.5, rx: 0.9, ry: 0.86, yOff: 0.06, botFlat: 0.5 },
      { z: 2.6, rx: 0.85, ry: 0.8, yOff: 0.06, botFlat: 0.4 },
      { z: 6.2, rx: 0.54, ry: 0.52, yOff: 0.14 },
      { z: 7.6, rx: 0.16, ry: 0.18, yOff: 0.18 },
      { z: 7.9, rx: 0.01, ry: 0.01, yOff: 0.18 },
    ],
    22
  );
  builder.add(fuseGeo, hogGray, 0, 0, 0);
  fuseGeo.dispose();

  // Prominent 7-Barrel GAU-8 Avenger 30mm Rotary Cannon protruding slightly port of centerline
  const gx = -0.1;
  const gy = -0.35;
  const housingGeo = new THREE.CylinderGeometry(0.24, 0.25, 1.35, 12).rotateX(Math.PI / 2);
  const barrelGeo = new THREE.CylinderGeometry(0.026, 0.026, 1.85, 6).rotateX(Math.PI / 2);
  const muzzleCollarGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.14, 14).rotateX(Math.PI / 2);
  builder.add(housingGeo, titaniumMat, gx, gy, -7.35, 0, 0, 0, 1, 1, 1, false);
  builder.add(barrelGeo, gunSteelMat, gx, gy, -8.05, 0, 0, 0, 1, 1, 1, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    builder.add(barrelGeo, gunSteelMat, gx + Math.cos(a) * 0.125, gy + Math.sin(a) * 0.125, -8.05, 0, 0, 0, 1, 1, 1, false);
  }
  builder.add(muzzleCollarGeo, gunSteelMat, gx, gy, -8.78, 0, 0, 0, 1, 1, 1, false);
  housingGeo.dispose();
  barrelGeo.dispose();
  muzzleCollarGeo.dispose();

  // Thick straight high-lift airfoil wings + straight H-tailplane
  addMirroredWings(builder, 3.05, 2.08, 8.75, 0.35, 0.2, 0.06, hogGray, -0.38, -0.45, 0, 0.1);
  addMirroredWings(builder, 1.65, 1.15, 3.1, 0.15, 0.11, 0, hogGray, 0.32, 6.5, 0, 0.02);

  // High-mounted twin TF34 turbofan pods on blended rear pylons + H-tail twin vertical fins
  const podGeo = createLoftedFuselageGeometry(
    [
      { z: -2.05, rx: 0.66, ry: 0.66 },
      { z: -1.1, rx: 0.72, ry: 0.72 },
      { z: 1.2, rx: 0.66, ry: 0.66 },
      { z: 2.05, rx: 0.48, ry: 0.48 },
    ],
    18
  );
  const intakeRim = new THREE.TorusGeometry(0.65, 0.09, 8, 18);
  const fanCore = new THREE.CylinderGeometry(0.56, 0.56, 0.28, 14).rotateX(Math.PI / 2);
  const spinnerGeo = new THREE.ConeGeometry(0.18, 0.45, 10).rotateX(-Math.PI / 2);
  const pylonGeo = createBlendedStrakeGeometry([
    { z: -1.15, xIn: 0.0, xOut: 0.92, y: 0.0, thick: 0.18 },
    { z: 0.2, xIn: 0.0, xOut: 0.98, y: 0.0, thick: 0.2 },
    { z: 1.25, xIn: 0.0, xOut: 0.85, y: 0.0, thick: 0.16 },
  ]);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(1.75, 0);
  fin.lineTo(1.25, 2.25);
  fin.lineTo(0.25, 2.25);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025 }).rotateY(Math.PI / 2);
  const sponsonGeo = new THREE.CapsuleGeometry(0.32, 1.85, 4, 10).rotateX(Math.PI / 2);
  const pylonOrdGeo = new THREE.BoxGeometry(0.09, 0.34, 1.15);
  const bombGeo = new THREE.CapsuleGeometry(0.18, 1.25, 4, 8).rotateX(Math.PI / 2);
  const bombFinGeo = new THREE.BoxGeometry(0.45, 0.03, 0.32);

  for (const s of [-1, 1] as const) {
    builder.add(pylonGeo, hogDark, s * 0.56, 0.65, 3.2, 0, 0, s * 0.36, s, 1, 1, false);
    builder.add(podGeo, hogGray, s * 1.45, 1.05, 3.2);
    builder.add(intakeRim, titaniumMat, s * 1.45, 1.05, 1.15, 0, 0, 0, 1, 1, 1, false);
    builder.add(fanCore, intakeVoid, s * 1.45, 1.05, 1.32, 0, 0, 0, 1, 1, 1, false);
    builder.add(spinnerGeo, gunSteelMat, s * 1.45, 1.05, 1.12, 0, 0, 0, 1, 1, 1, false);
    builder.add(finGeo, hogDark, s * 2.95, 0.05, 7.15);
    builder.add(sponsonGeo, hogDark, s * 2.65, -0.58, -0.75);

    for (const bx of [4.2, 5.8]) {
      builder.add(pylonOrdGeo, hogDark, s * bx, -0.45, -0.35, 0, 0, 0, 1, 1, 1, false);
      builder.add(bombGeo, oliveOrdnance, s * bx, -0.68, -0.35, 0, 0, 0, 1, 1, 1, false);
      builder.add(bombFinGeo, titaniumMat, s * bx, -0.68, 0.28, 0, 0, 0, 1, 1, 1, false);
    }

    // Articulated ailerons, wingtip split decel-rudders, elevators & iconic H-tail twin rudders
    addControlSurface(rig, hogDark, G, 'aileron', s, s * 6.8, -0.04, 1.75, 2.35, 0.45, 0.07, 'x', 0.42);
    addControlSurface(rig, hogDark, G, 'decel', s, s * 8.65, 0.05, 1.75, 1.15, 0.45, 0.07, 'x', 0.48);
    addControlSurface(rig, hogDark, G, 'elevator', s, s * 1.65, 0.34, 7.75, 2.35, 0.45, 0.06, 'x', 0.38);
    addControlSurface(rig, hogDark, G, 'rudder', s, s * 2.95, 0.35, 7.35, 1.9, 0.46, 0.06, 'y', 0.45);

    // Retractable main landing gear (bottom wheel Y = -1.55)
    addLandingGearAssembly(rig, 0.38, 0.22, 0.95, tireMat, titaniumMat, hogDark, G, s * 2.65, -1.17, -0.75, {
      retractAxis: 'x',
      retractAngle: 1.32,
      doorSide: s,
    });
  }
  podGeo.dispose();
  intakeRim.dispose();
  fanCore.dispose();
  spinnerGeo.dispose();
  pylonGeo.dispose();
  finGeo.dispose();
  sponsonGeo.dispose();
  pylonOrdGeo.dispose();
  bombGeo.dispose();
  bombFinGeo.dispose();

  addLandingGearAssembly(rig, 0.28, 0.16, 0.95, tireMat, titaniumMat, hogGray, G, 0.22, -1.27, -5.25, {
    retractAxis: 'x',
    retractAngle: -1.45,
    doorSide: 1,
  });

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.47, 0.46, 2.85), glassMat, 0, 0.92, -3.4, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.32, -3.5, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x3f6212, 0x1e293b);
  pilot.position.set(0, 0.42, -3.5);
  G.add(pilot);
  rig.cockpitDetails.push(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 1.45, 1.05, 5.25, 0.36, 2.4, false, flames);
  }

  const strobes = createStrobeLights([-8.75, 0.05, -0.2], [8.75, 0.05, -0.2], [2.95, 2.35, 6.5], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-2.65, -1.55, -0.75), w: 1 },
      { v: new THREE.Vector3(2.65, -1.55, -0.75), w: 1 },
      { v: new THREE.Vector3(0.22, -1.55, -5.25), w: 1 },
      { v: new THREE.Vector3(-8.7, 0.0, -0.2), w: 0 },
      { v: new THREE.Vector3(8.7, 0.0, -0.2), w: 0 },
      { v: new THREE.Vector3(0, 0.3, 7.6), w: 0 },
    ],
  };
}

function buildRafaleModel(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const frenchGray = new THREE.MeshStandardMaterial({
    color: 0x8997aa,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.032,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.35,
    metalness: 0.55,
  });
  const darkSlate = new THREE.MeshStandardMaterial({
    color: 0x384557,
    map: pbr.tacticalAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughness: 0.38,
    metalness: 0.52,
  });
  const intakeVoid = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.9, metalness: 0.15 });
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.3 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.22, metalness: 0.92 });
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const canopyMat = makeGlassMaterial(0xd97706, 0.78);

  // Smooth lofted Rafale fuselage with dorsal electronics spine & area-ruled waist
  const bodyGeo = createLoftedFuselageGeometry(
    [
      { z: -8.9, rx: 0.01, ry: 0.01, yOff: 0.0 },
      { z: -7.8, rx: 0.25, ry: 0.23, yOff: 0.0 },
      { z: -6.1, rx: 0.56, ry: 0.48, yOff: 0.02, chine: 0.25 },
      { z: -3.5, rx: 0.84, ry: 0.68, yOff: 0.04, chine: 0.35, botFlat: 0.4, dorsal: 0.22 },
      { z: 1.8, rx: 0.96, ry: 0.74, yOff: 0.04, botFlat: 0.45, dorsal: 0.32 },
      { z: 5.2, rx: 0.84, ry: 0.62, yOff: 0.02, dorsal: 0.24 },
      { z: 6.7, rx: 0.54, ry: 0.42, yOff: 0.0 },
      { z: 7.0, rx: 0.01, ry: 0.01, yOff: 0.0 },
    ],
    24
  );
  builder.add(bodyGeo, frenchGray, 0, 0, 0);
  bodyGeo.dispose();

  const radGeo = createLoftedFuselageGeometry(
    [
      { z: -8.95, rx: 0.01, ry: 0.01 },
      { z: -7.8, rx: 0.24, ry: 0.22 },
      { z: -6.4, rx: 0.5, ry: 0.44 },
    ],
    16
  );
  builder.add(radGeo, darkSlate, 0, 0.0, 0, 0, 0, 0, 1, 1, 1, false);
  radGeo.dispose();

  // Cambered compound delta wing
  addMirroredWings(builder, 5.8, 1.2, 5.55, 4.4, 0.13, -0.02, frenchGray, -0.06, 1.8, 0, 0.07);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(3.2, 0);
  fin.lineTo(1.3, 2.95);
  fin.lineTo(0.25, 2.95);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.11, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateY(Math.PI / 2);
  builder.add(finGeo, frenchGray, -0.055, 0.65, 6.5);
  finGeo.dispose();
  addControlSurface(rig, darkSlate, G, 'rudder', 0, 0, 0.85, 6.55, 2.2, 0.48, 0.06, 'y', 0.42);

  const mslBody = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8).rotateX(Math.PI / 2);
  const mslNose = new THREE.ConeGeometry(0.08, 0.34, 8).rotateX(-Math.PI / 2);
  for (const s of [-1, 1] as const) {
    addSculptedIntake(builder, darkSlate, intakeVoid, chevronMat, s * 0.85, -0.18, -1.8, 0.78, 0.58, 3.2, -s * 0.06);
    addSegmentedAfterburnerNozzle(builder, titaniumMat, intakeVoid, s * 0.46, 0.02, 6.65, 0.4, 1.05, 14);
    builder.add(mslBody, missileMat, s * 5.58, -0.08, 4.0, 0, 0, 0, 1, 1, 1, false);
    builder.add(mslNose, darkSlate, s * 5.58, -0.08, 2.45, 0, 0, 0, 1, 1, 1, false);

    // Articulated forward close-coupled canards + inner/outer elevons
    addControlSurface(rig, frenchGray, G, 'canard', s, s * 1.45, 0.28, -2.55, 1.9, 0.95, 0.07, 'x', 0.38, s * 0.1);
    addControlSurface(rig, darkSlate, G, 'elevator', s, s * 2.2, -0.1, 6.55, 1.9, 0.52, 0.06, 'x', 0.36);
    addControlSurface(rig, darkSlate, G, 'aileron', s, s * 4.4, -0.14, 6.1, 1.95, 0.5, 0.06, 'x', 0.4);

    // Retractable main landing gear (bottom wheel Y = -1.48)
    addLandingGearAssembly(rig, 0.35, 0.2, 0.98, tireMat, titaniumMat, frenchGray, G, s * 1.28, -1.13, 1.6, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  mslBody.dispose();
  mslNose.dispose();

  addLandingGearAssembly(rig, 0.27, 0.16, 0.96, tireMat, titaniumMat, frenchGray, G, 0, -1.21, -4.4, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  const tankGeo = new THREE.CapsuleGeometry(0.26, 2.8, 4, 8).rotateX(Math.PI / 2);
  builder.add(tankGeo, darkSlate, 0, -0.82, 0.2, 0, 0, 0, 1, 1, 1, false);
  tankGeo.dispose();

  builder.flushInto(G);

  const canopy = addPart(createBubbleCanopyGeometry(0.45, 0.45, 3.15), canopyMat, 0, 0.74, -3.25, G);
  canopy.renderOrder = 3;
  rig.canopies.push(canopy);

  addCockpitInterior(rig, G, 0, 0.25, -3.35, true);
  const pilot = createPilotFigure(0xe2e8f0, 0x1e293b, 0x0f172a);
  pilot.position.set(0, 0.36, -3.35);
  G.add(pilot);
  rig.cockpitDetails.push(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    createMachFlameStack(G, s * 0.46, 0.02, 7.15, 0.35, 4.2, false, flames);
  }

  const strobes = createStrobeLights([-5.6, -0.05, 4.1], [5.6, -0.05, 4.1], [0, 3.62, 5.6], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.28, -1.48, 1.6), w: 1 },
      { v: new THREE.Vector3(1.28, -1.48, 1.6), w: 1 },
      { v: new THREE.Vector3(0, -1.48, -4.4), w: 1 },
      { v: new THREE.Vector3(-5.55, -0.08, 4.1), w: 0 },
      { v: new THREE.Vector3(5.55, -0.08, 4.1), w: 0 },
      { v: new THREE.Vector3(0, 0.1, 6.9), w: 0 },
    ],
  };
}

function pushFacetedTri(
  verts: number[],
  uvs: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  nx: number,
  ny: number,
  nz: number
): void {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  const flip = cx * nx + cy * ny + cz * nz < 0;
  const p1 = flip ? c : b;
  const p2 = flip ? b : c;
  verts.push(a[0], a[1], a[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  uvs.push(
    a[0] / 14 + 0.5,
    a[2] / 20 + 0.5,
    p1[0] / 14 + 0.5,
    p1[2] / 20 + 0.5,
    p2[0] / 14 + 0.5,
    p2[2] / 20 + 0.5
  );
}

function buildF117Model(textures: WorldTextures): BuiltAircraftModel {
  void textures;
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const pbr = getAircraftPbrAssets();
  const rig: AircraftAnimRig = { controls: [], gears: [], cockpitDetails: [], canopies: [] };

  const ramMat = new THREE.MeshStandardMaterial({
    color: 0x202732,
    map: pbr.stealthAlbedo,
    bumpMap: pbr.bumpMap,
    bumpScale: 0.026,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.52,
    metalness: 0.36,
  });
  const ramTrim = new THREE.MeshStandardMaterial({
    color: 0x12161d,
    roughness: 0.68,
    metalness: 0.24,
  });
  const intakeVoid = new THREE.MeshStandardMaterial({
    color: 0x06080c,
    roughness: 0.94,
    metalness: 0.08,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.28,
    metalness: 0.88,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.88,
    metalness: 0.05,
  });
  const canopyGlass = makeGlassMaterial(0xb45309, 0.78);

  // Watertight faceted stealth airframe (1 unit = 1m: 20.08m length, 13.20m wingspan)
  const verts: number[] = [];
  const uvs: number[] = [];
  const N0: [number, number, number] = [0, -0.06, -9.85];
  const U1: [number, number, number] = [0, 0.36, -7.15];
  const U2: [number, number, number] = [0, 0.94, -5.85];
  const U3: [number, number, number] = [0, 1.18, -3.7];
  const U4: [number, number, number] = [0, 0.96, 0.4];
  const U5: [number, number, number] = [0, 0.56, 4.7];
  const U6: [number, number, number] = [0, 0.16, 8.3];
  const TN: [number, number, number] = [0, 0.04, 9.75];

  const B1: [number, number, number] = [0, -0.34, -7.15];
  const B2: [number, number, number] = [0, -0.44, -4.4];
  const B3: [number, number, number] = [0, -0.46, 1.6];
  const B4: [number, number, number] = [0, -0.26, 5.9];
  const B5: [number, number, number] = [0, -0.06, 8.3];

  for (const s of [-1, 1] as const) {
    const C1: [number, number, number] = [s * 0.72, -0.06, -7.15];
    const C2: [number, number, number] = [s * 1.48, -0.02, -4.4];
    const S2: [number, number, number] = [s * 0.64, 0.38, -5.85];
    const S3: [number, number, number] = [s * 0.86, 0.58, -3.7];
    const S4: [number, number, number] = [s * 1.56, 0.46, 0.4];
    const S5: [number, number, number] = [s * 1.52, 0.28, 4.7];
    const S6: [number, number, number] = [s * 1.65, 0.14, 8.3];
    const W1: [number, number, number] = [s * 1.72, 0.05, 8.85];
    const W2: [number, number, number] = [s * 2.75, 0.03, 8.85];
    const W3: [number, number, number] = [s * 4.25, -0.05, 6.95];
    const WT1: [number, number, number] = [s * 6.6, -0.16, 7.45];
    const WT2: [number, number, number] = [s * 6.6, -0.16, 8.75];
    const WR: [number, number, number] = [s * 3.18, 0.24, 2.35];
    const WB: [number, number, number] = [s * 3.18, -0.16, 2.35];

    const CF: [number, number, number] = [0, 0.24, -4.95];
    pushFacetedTri(verts, uvs, N0, U1, C1, s * 0.35, 0.9, -0.25);
    pushFacetedTri(verts, uvs, U1, S2, C1, s * 0.7, 0.7, -0.15);
    pushFacetedTri(verts, uvs, C1, S2, C2, s * 0.85, 0.5, -0.1);
    pushFacetedTri(verts, uvs, S2, S3, C2, s * 0.85, 0.55, 0);
    pushFacetedTri(verts, uvs, U1, S2, CF, -s * 0.2, 0.95, 0.1);
    pushFacetedTri(verts, uvs, S2, S3, CF, -s * 0.5, 0.85, 0);
    pushFacetedTri(verts, uvs, S3, U3, CF, -s * 0.2, 0.75, -0.5);

    pushFacetedTri(verts, uvs, U3, U4, S4, s * 0.35, 0.94, 0);
    pushFacetedTri(verts, uvs, U3, S4, S3, s * 0.4, 0.92, 0);
    pushFacetedTri(verts, uvs, U4, U5, S5, s * 0.3, 0.95, 0);
    pushFacetedTri(verts, uvs, U4, S5, S4, s * 0.35, 0.94, 0);
    pushFacetedTri(verts, uvs, U5, U6, S6, s * 0.25, 0.96, 0.05);
    pushFacetedTri(verts, uvs, U5, S6, S5, s * 0.25, 0.96, 0.05);
    pushFacetedTri(verts, uvs, U6, TN, W1, s * 0.1, 0.98, 0.1);
    pushFacetedTri(verts, uvs, U6, W1, S6, s * 0.15, 0.98, 0.1);

    pushFacetedTri(verts, uvs, C2, S3, S4, s * 0.85, 0.5, 0);
    pushFacetedTri(verts, uvs, C2, S4, WR, s * 0.3, 0.95, 0);
    pushFacetedTri(verts, uvs, S4, S5, WR, s * 0.25, 0.96, 0);
    pushFacetedTri(verts, uvs, C2, WR, WT1, s * 0.15, 0.98, -0.05);
    pushFacetedTri(verts, uvs, WR, WT1, WT2, s * 0.15, 0.98, 0);
    pushFacetedTri(verts, uvs, WR, WT2, W3, s * 0.12, 0.98, 0.05);
    pushFacetedTri(verts, uvs, WR, W3, W2, s * 0.1, 0.99, 0.05);
    pushFacetedTri(verts, uvs, S5, WR, W2, s * 0.1, 0.99, 0.05);
    pushFacetedTri(verts, uvs, S5, W2, W1, s * 0.08, 0.99, 0.05);
    pushFacetedTri(verts, uvs, S5, S6, W1, s * 0.15, 0.98, 0.05);

    pushFacetedTri(verts, uvs, N0, C1, B1, s * 0.25, -0.95, -0.15);
    pushFacetedTri(verts, uvs, B1, C1, C2, s * 0.15, -0.98, 0);
    pushFacetedTri(verts, uvs, B1, C2, B2, s * 0.1, -0.99, 0);
    pushFacetedTri(verts, uvs, B2, C2, WB, s * 0.1, -0.99, 0);
    pushFacetedTri(verts, uvs, B2, WB, B3, s * 0.05, -1, 0);
    pushFacetedTri(verts, uvs, C2, WB, WT1, s * 0.1, -0.99, 0);
    pushFacetedTri(verts, uvs, WB, WT1, WT2, s * 0.08, -0.99, 0);
    pushFacetedTri(verts, uvs, WB, WT2, W3, s * 0.08, -0.99, 0);
    pushFacetedTri(verts, uvs, WB, W3, W2, s * 0.06, -0.99, 0);
    pushFacetedTri(verts, uvs, B3, WB, W2, s * 0.05, -1, 0);
    pushFacetedTri(verts, uvs, B3, W2, B4, s * 0.05, -1, 0);
    pushFacetedTri(verts, uvs, B4, W2, W1, s * 0.05, -1, 0);
    pushFacetedTri(verts, uvs, B4, W1, B5, s * 0.04, -1, 0);
    pushFacetedTri(verts, uvs, B5, W1, TN, s * 0.04, -1, 0);
  }

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  hullGeo.computeVertexNormals();
  builder.add(hullGeo, ramMat, 0, 0, 0);
  hullGeo.dispose();

  const intakeCowlingGeo = new THREE.BoxGeometry(0.92, 0.42, 2.3);
  const intakeCavityGeo = new THREE.BoxGeometry(0.8, 0.28, 0.22);
  const grilleSlatGeo = new THREE.BoxGeometry(0.035, 0.28, 0.24);
  const exhaustDeckGeo = new THREE.BoxGeometry(1.42, 0.15, 1.95);
  const exhaustSlotGeo = new THREE.BoxGeometry(1.24, 0.09, 0.25);

  const vTailShape = new THREE.Shape();
  vTailShape.moveTo(0, 0);
  vTailShape.lineTo(3.1, 0);
  vTailShape.lineTo(1.45, 2.38);
  vTailShape.lineTo(0.15, 2.38);
  vTailShape.closePath();
  const vTailGeo = new THREE.ExtrudeGeometry(vTailShape, {
    steps: 1,
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  }).rotateY(Math.PI / 2);

  for (const s of [-1, 1] as const) {
    builder.add(intakeCowlingGeo, ramTrim, s * 1.16, 0.28, -2.55, 0.06, -s * 0.22, 0, 1, 1, 1, true);
    builder.add(intakeCavityGeo, intakeVoid, s * 1.0, 0.28, -3.65, 0.06, -s * 0.22, 0, 1, 1, 1, false);
    for (const gx of [-0.24, 0, 0.24]) {
      builder.add(grilleSlatGeo, ramTrim, s * 1.0 + gx, 0.28, -3.68, 0.06, -s * 0.22, 0, 1, 1, 1, false);
    }

    builder.add(exhaustDeckGeo, titaniumMat, s * 1.06, 0.17, 7.65, -0.04, 0, 0, 1, 1, 1, false);
    builder.add(exhaustSlotGeo, intakeVoid, s * 1.06, 0.18, 8.6, -0.04, 0, 0, 1, 1, 1, false);
    builder.add(vTailGeo, ramMat, s * 1.38, 0.18, 8.35, 0, 0, -s * 0.58, 1, 1, 1, true);

    // Articulated elevons + outward-canted butterfly V-tail ruddervators
    addControlSurface(rig, ramTrim, G, 'elevator', s, s * 2.3, 0.02, 8.9, 1.3, 0.45, 0.06, 'x', 0.34);
    addControlSurface(rig, ramTrim, G, 'aileron', s, s * 5.2, -0.1, 8.15, 2.2, 0.45, 0.06, 'x', 0.38);
    addControlSurface(rig, ramTrim, G, 'rudder', s, s * 1.7, 0.46, 8.6, 1.8, 0.45, 0.06, 'y', 0.42, -s * 0.58);

    // Retractable main landing gear (bottom wheel Y = -1.56)
    addLandingGearAssembly(rig, 0.36, 0.22, 1.15, tireMat, titaniumMat, ramMat, G, s * 1.58, -1.2, 1.55, {
      retractAxis: 'z',
      retractAngle: s * 1.42,
      doorSide: s,
    });
  }
  intakeCowlingGeo.dispose();
  intakeCavityGeo.dispose();
  grilleSlatGeo.dispose();
  exhaustDeckGeo.dispose();
  exhaustSlotGeo.dispose();
  vTailGeo.dispose();

  addLandingGearAssembly(rig, 0.28, 0.17, 1.12, tireMat, titaniumMat, ramMat, G, 0, -1.28, -5.25, {
    twin: true,
    retractAxis: 'x',
    retractAngle: -1.46,
    doorSide: 1,
  });

  const flirBox = new THREE.BoxGeometry(0.42, 0.22, 0.55);
  builder.add(flirBox, ramTrim, 0, 0.28, -7.25, 0.18, 0, 0, 1, 1, 1, false);
  const dlirPod = new THREE.BoxGeometry(0.36, 0.18, 0.65);
  builder.add(dlirPod, ramTrim, 0, -0.44, -6.1, 0, 0, 0, 1, 1, 1, false);
  const pitotGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.62, 6).rotateX(Math.PI / 2);
  for (const px of [-0.14, -0.045, 0.045, 0.14]) {
    builder.add(pitotGeo, titaniumMat, px, -0.05, -10.05, 0, 0, 0, 1, 1, 1, false);
  }
  flirBox.dispose();
  dlirPod.dispose();
  pitotGeo.dispose();

  const centerStrut = new THREE.BoxGeometry(0.07, 0.06, 1.48);
  builder.add(centerStrut, ramTrim, 0, 0.68, -6.48, -0.42, 0, 0, 1, 1, 1, false);
  centerStrut.dispose();

  builder.flushInto(G);

  const glassVerts: number[] = [];
  const glassUvs: number[] = [];
  const gNose: [number, number, number] = [0, 0.365, -7.15];
  const gBrow: [number, number, number] = [0, 0.96, -5.85];
  const gPeak: [number, number, number] = [0, 1.185, -3.7];
  for (const s of [-1, 1] as const) {
    const gSideFwd: [number, number, number] = [s * 0.64, 0.385, -5.85];
    const gSideAft: [number, number, number] = [s * 0.86, 0.585, -3.7];
    pushFacetedTri(glassVerts, glassUvs, gNose, gBrow, gSideFwd, s * 0.35, 0.85, -0.35);
    pushFacetedTri(glassVerts, glassUvs, gBrow, gPeak, gSideAft, s * 0.42, 0.88, -0.05);
    pushFacetedTri(glassVerts, glassUvs, gBrow, gSideAft, gSideFwd, s * 0.5, 0.85, -0.15);
  }
  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassVerts, 3));
  glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(glassUvs, 2));
  glassGeo.computeVertexNormals();
  const canopyMesh = addPart(glassGeo, canopyGlass, 0, 0, 0, G);
  canopyMesh.renderOrder = 3;
  rig.canopies.push(canopyMesh);

  addCockpitInterior(rig, G, 0, 0.22, -4.95, true);
  const pilot = createPilotFigure(0x1e293b, 0x334155, 0x0f172a);
  pilot.position.set(0, 0.28, -4.95);
  G.add(pilot);
  rig.cockpitDetails.push(pilot);

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1] as const) {
    createMachFlameStack(G, s * 1.06, 0.17, 8.7, 0.24, 1.6, true, flames);
  }

  const strobes = createStrobeLights([-6.58, -0.14, 8.05], [6.58, -0.14, 8.05], [0, 0.42, 8.4], G);

  return {
    group: G,
    pilot,
    pax: null,
    props: [],
    discs: [],
    flames,
    strobes,
    animRig: rig,
    contactPoints: [
      { v: new THREE.Vector3(-1.58, -1.56, 1.55), w: 1 },
      { v: new THREE.Vector3(1.58, -1.56, 1.55), w: 1 },
      { v: new THREE.Vector3(0, -1.56, -5.25), w: 1 },
      { v: new THREE.Vector3(-6.6, -0.16, 8.0), w: 0 },
      { v: new THREE.Vector3(6.6, -0.16, 8.0), w: 0 },
      { v: new THREE.Vector3(0, 0.04, 9.75), w: 0 },
    ],
  };
}

function createTailhook(parent: THREE.Group, yPos: number, zPos: number, hookLen: number): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(0, yPos, zPos);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.78 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.45 });
  const bar = addPart(new THREE.CylinderGeometry(0.055, 0.045, hookLen, 8).rotateX(Math.PI / 2), armMat, 0, 0, hookLen * 0.5, pivot);
  void bar;
  const claw = addPart(new THREE.BoxGeometry(0.24, 0.14, 0.36), tipMat, 0, -0.06, hookLen, pivot);
  void claw;
  parent.add(pivot);
  return pivot;
}

export function buildTankerModel(): TankerModel {
  const G = new THREE.Group();
  const builder = new StaticModelBuilder();
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x8a97a8, roughness: 0.36, metalness: 0.38 });
  const darkGrey = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.42, metalness: 0.18 });
  const podDark = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.75 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ee, roughness: 0.18, metalness: 0.9 });
  const glassMat = makeGlassMaterial(0x0284c7, 0.62);

  const fusePts = [
    new THREE.Vector2(0.0, -18.5),
    new THREE.Vector2(1.0, -17.8),
    new THREE.Vector2(2.25, -14.2),
    new THREE.Vector2(2.55, -8.5),
    new THREE.Vector2(2.55, 7.2),
    new THREE.Vector2(1.85, 13.5),
    new THREE.Vector2(0.85, 18.0),
    new THREE.Vector2(0.0, 19.2),
  ];
  const fuseGeo = new THREE.LatheGeometry(fusePts, 20).rotateX(Math.PI / 2);
  builder.add(fuseGeo, greyMat, 0, 0, 0);
  fuseGeo.dispose();

  const bellyStripe = new THREE.BoxGeometry(0.65, 0.12, 22);
  builder.add(bellyStripe, stripeMat, 0, -2.52, -1.5, 0, 0, 0, 1, 1, 1, false);
  const topStripe = new THREE.BoxGeometry(0.42, 0.12, 24);
  builder.add(topStripe, stripeMat, 0, 2.52, -1.0, 0, 0, 0, 1, 1, 1, false);
  bellyStripe.dispose();
  topStripe.dispose();

  addMirroredWings(builder, 6.2, 1.9, 18.5, 8.8, 0.34, 0.055, greyMat, -0.5, -2.2);
  addMirroredWings(builder, 3.4, 1.1, 6.8, 3.2, 0.16, 0.04, greyMat, 0.9, 15.6);

  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(5.6, 0);
  fin.lineTo(7.4, 6.4);
  fin.lineTo(4.2, 6.4);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.24, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }).rotateY(Math.PI / 2);
  builder.add(finGeo, darkGrey, -0.12, 1.2, 18.2);
  finGeo.dispose();

  const engGeo = new THREE.CylinderGeometry(0.75, 0.65, 3.8, 12).rotateX(Math.PI / 2);
  const fanGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.25, 12).rotateX(Math.PI / 2);
  const pylonGeo = new THREE.BoxGeometry(0.28, 1.1, 2.6);
  for (const s of [-1, 1]) {
    for (const [ox, ez] of [
      [5.8, -0.6],
      [10.8, 1.8],
    ] as const) {
      builder.add(pylonGeo, darkGrey, s * ox, -0.95, ez, 0, 0, 0, 1, 1, 1, false);
      builder.add(engGeo, greyMat, s * ox, -1.65, ez - 0.6);
      builder.add(fanGeo, chromeMat, s * ox, -1.65, ez - 2.45, 0, 0, 0, 1, 1, 1, false);
      builder.add(fanGeo, podDark, s * ox, -1.65, ez + 1.32, 0, 0, 0, 0.8, 0.8, 1, false);
    }
  }
  engGeo.dispose();
  fanGeo.dispose();
  pylonGeo.dispose();

  builder.flushInto(G);

  const flightDeck = addPart(new THREE.BoxGeometry(2.3, 0.72, 2.1), glassMat, 0, 1.08, -14.8, G);
  flightDeck.renderOrder = 3;

  const boomPivot = new THREE.Group();
  boomPivot.position.set(0, -1.15, 16.2);
  boomPivot.rotation.x = 0.14;
  addPart(new THREE.CylinderGeometry(0.22, 0.14, 11.5, 10).rotateX(Math.PI / 2), darkGrey, 0, 0, 5.75, boomPivot);
  const finL = addPart(new THREE.BoxGeometry(1.5, 0.06, 0.85), stripeMat, -0.75, 0.35, 9.4, boomPivot);
  finL.rotation.z = -0.45;
  const finR = addPart(new THREE.BoxGeometry(1.5, 0.06, 0.85), stripeMat, 0.75, 0.35, 9.4, boomPivot);
  finR.rotation.z = 0.45;

  // Extendable flexible refueling hose (pivot at z=0 so scale.z extends cleanly toward player)
  const hoseGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });
  const hoseMesh = new THREE.Mesh(hoseGeo, hoseMat);
  hoseMesh.position.set(0, 0, 11.5);
  hoseMesh.scale.z = 7.5;
  boomPivot.add(hoseMesh);

  // Visible glowing refueling basket / drogue trailing behind tail
  const drogueGroup = new THREE.Group();
  drogueGroup.position.set(0, 0, 19.0);
  const basketConeGeo = new THREE.CylinderGeometry(1.45, 0.28, 1.85, 18, 1, true).rotateX(Math.PI / 2);
  const basketConeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });
  const basketCone = new THREE.Mesh(basketConeGeo, basketConeMat);
  basketCone.position.z = 0.92;
  drogueGroup.add(basketCone);

  const drogueMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, fog: false });
  const drogueRim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.14, 10, 28), drogueMat);
  drogueRim.position.z = 1.82;
  drogueGroup.add(drogueRim);

  const boomTipMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, fog: false });
  addPart(new THREE.SphereGeometry(0.34, 10, 8), boomTipMat, 0, 0, 0, drogueGroup);
  boomPivot.add(drogueGroup);
  G.add(boomPivot);

  // Glowing green target ring 45 meters behind tanker's tail (tail ends at z = 19.2 -> z = 64.2)
  const targetRingGroup = new THREE.Group();
  targetRingGroup.position.set(0, -2.5, 64.2);
  const targetRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.86,
    fog: false,
  });
  const targetHaloMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.44, 10, 44), targetRingMat);
  const innerHalo = new THREE.Mesh(new THREE.RingGeometry(7.2, 8.9, 36), targetHaloMat);
  targetRingGroup.add(outerRing, innerHalo);
  const tickGeo = new THREE.BoxGeometry(0.45, 2.1, 0.45);
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(tickGeo, targetRingMat);
    const a = (i * Math.PI) / 2;
    tick.position.set(Math.sin(a) * 9.2, Math.cos(a) * 9.2, 0);
    tick.rotation.z = -a;
    targetRingGroup.add(tick);
  }
  G.add(targetRingGroup);

  const strobes = createStrobeLights([-18.5, 0.55, 7.2], [18.5, 0.55, 7.2], [0, 7.6, 18.2], G);

  return {
    group: G,
    boomPivot,
    hoseMesh,
    drogueGroup,
    drogueMat,
    boomTipMat,
    targetRingGroup,
    targetRingMat,
    targetHaloMat,
    strobes,
  };
}

export function buildAircraftModel(
  id: AircraftId,
  config: AircraftConfig,
  textures: WorldTextures,
  isSoftwareGl: boolean
): BuiltAircraftModel {
  void isSoftwareGl;
  let built: BuiltAircraftModel;
  switch (id) {
    case 'f18':
      built = buildF18Model(textures);
      break;
    case 'f35':
      built = buildF35Model(textures);
      break;
    case 'b2':
      built = buildB2Model(textures);
      break;
    case 'sukhoi':
      built = buildSukhoiModel(textures);
      break;
    case 'f16':
      built = buildF16Model(textures);
      break;
    case 'f22':
      built = buildF22Model(textures);
      break;
    case 'a10':
      built = buildA10Model(textures);
      break;
    case 'rafale':
      built = buildRafaleModel(textures);
      break;
    case 'sr71':
      built = buildSR71Model(textures);
      break;
    case 'f117':
      built = buildF117Model(textures);
      break;
    case 'concorde':
      built = buildConcordeModel();
      break;
    case 'airliner':
      built = buildAirlinerModel(textures);
      break;
    case 'hercules':
      built = buildHerculesModel(textures);
      break;
    case 'cessna':
      built = buildCessnaModel();
      break;
    case 'biplane':
      built = buildBiplaneModel();
      break;
  }

  // Preserve PBR bump/roughness maps and metallic finish while calibrating IBL envMapIntensity (zero extra draw calls)
  const isStealthRam = id === 'f117' || id === 'b2';
  const excludedParts = new Set<THREE.Object3D>([
    built.pilot,
    ...(built.pax ? [built.pax] : []),
    ...built.discs,
    ...built.flames,
    ...built.strobes,
  ]);
  const tunedMats = new Set<THREE.Material>();

  built.group.traverse((obj) => {
    if (obj === built.group) return;
    let cur: THREE.Object3D | null = obj;
    while (cur && cur !== built.group) {
      if (excludedParts.has(cur)) return;
      cur = cur.parent;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const mat = mesh.material;
    if (!(mat instanceof THREE.MeshStandardMaterial) || mat.transparent || tunedMats.has(mat)) {
      return;
    }
    tunedMats.add(mat);

    const isDarkRubberOrVoid =
      mat.roughness > 0.8 && mat.metalness < 0.16 && mat.color.r < 0.14 && mat.color.g < 0.14;
    const isBareMetal = mat.metalness >= 0.72;

    if (isDarkRubberOrVoid) {
      mat.envMapIntensity = 0.85;
    } else if (isBareMetal) {
      mat.roughness = Math.max(0.16, mat.roughness * 0.9);
      mat.envMapIntensity = 1.78;
    } else if (isStealthRam) {
      mat.envMapIntensity = 1.22;
    } else {
      mat.envMapIntensity = 1.55;
    }
  });

  // Upgrade any remaining jet afterburner cones (preserving 3-layer createMachFlameStack shaders)
  if (config.aero.hasAfterburner && built.flames.length > 0) {
    const blueCore = id === 'sukhoi' || id === 'f22' || id === 'sr71';
    const isDualCore = built.flames.length === 2 || (built.flames.length === 4 && id !== 'concorde');
    const disposedOld = new Set<THREE.Material>();
    built.flames.forEach((fl, idx) => {
      if (fl.userData.abMat || fl.geometry.type !== 'ConeGeometry') return;
      const oldMat = fl.material;
      if (!Array.isArray(oldMat) && !disposedOld.has(oldMat)) {
        disposedOld.add(oldMat);
        oldMat.dispose();
      }
      const isInner = isDualCore && idx % 2 === 1;
      const abMat = createAfterburnerMaterial(isInner ? 1 : 0, blueCore);
      fl.material = abMat;
      fl.userData.abMat = abMat;
    });
  }

  const hookZ = Math.max(2.6, config.hz * 0.55);
  const hookY = -Math.max(0.45, config.y0 * 0.38);
  built.tailhook = createTailhook(built.group, hookY, hookZ, Math.min(2.6, Math.max(1.5, config.hz * 0.22)));

  return built;
}
