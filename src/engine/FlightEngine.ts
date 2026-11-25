import * as THREE from 'three';
import {
  AIRCRAFT_CONFIGS,
  HOME_NPC_POS,
  HOME_WALK_POS,
} from './aircraftConfigs';
import {
  buildAircraftModel,
  buildTankerModel,
  type AircraftAnimRig,
  type TankerModel,
} from './aircraftModels';
import { FlightAudio, type ScrapeSurface } from './audio';
import {
  animateCharacter,
  createShadowCircle,
  makeCharacterMesh,
  type ManMesh,
} from './characterModel';
import { createProceduralTextures } from './materials';
import { MissionManager } from './missionSystem';
import {
  buildSamiChatReply,
  getAircraftBySamiAction,
  parseSamiCommand,
  stepAutopilot,
  type SamiAction,
  type SamiState,
} from './samiBrain';
import {
  applyMegatronPose,
  buildMegatronRig,
  MegatronLightningSystem,
  type MegatronRig,
} from './megatronBoss';
import {
  buildWorld,
  groundHeightAt,
  type WorldObjects,
} from './worldBuilder';
import type {
  AircraftConfig,
  AircraftId,
  AircraftInstance,
  CameraMode,
  GamePhase,
  HudSnapshot,
  MegatronPhase,
  MissionId,
  PlayerMode,
  ScoreboardState,
  SpawnMode,
  TimeOfDay,
  WeatherCondition,
} from '../types/flight';

interface BoardingState {
  target: AircraftInstance;
  t: number;
  duration: number;
  startPos: THREE.Vector3;
  doorPos: THREE.Vector3;
  stepPos: THREE.Vector3;
  seatPos: THREE.Vector3;
}

interface HomingMissile {
  active: boolean;
  mesh: THREE.Group;
  plume: THREE.Mesh;
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  target: AircraftInstance | null;
  targetBoss?: boolean;
  flareTarget: FlareInstance | null;
  owner: AircraftInstance | null;
  age: number;
  smokeTimer: number;
  railSide: number;
  railOffset: THREE.Vector3;
  ignited: boolean;
  launchSpeed: number;
}

interface FlareInstance {
  active: boolean;
  mesh: THREE.Mesh;
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  maxAge: number;
  smokeTimer: number;
}

interface TankerState {
  model: TankerModel;
  p: THREE.Vector3;
  q: THREE.Quaternion;
  v: THREE.Vector3;
  angle: number;
  boomTipWorld: THREE.Vector3;
}

interface BombInstance {
  active: boolean;
  mesh: THREE.Group;
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  owner: AircraftInstance;
  age: number;
  whistleTriggered: boolean;
}

interface GroundCrater {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  scale: number;
  smokeAge: number;
  smokeTimer: number;
}

interface SmokeParticle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  rot: number;
  spin: number;
  baseOpacity: number;
  windMul: number;
  buoyancy: number;
  drag: number;
  r: number;
  g: number;
  b: number;
  endR: number;
  endG: number;
  endB: number;
}

interface FireParticle {
  kind: 'fire' | 'flash' | 'spark';
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  rot: number;
  spin: number;
  baseOpacity: number;
  r: number;
  g: number;
  b: number;
  thermalRamp: boolean;
  buoyancy: number;
  gravity: number;
  drag: number;
  emitsSmoke: boolean;
  smokeTrailTimer: number;
  bounceSound: boolean;
}

interface ShockRingParticle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  r: number;
  g: number;
  b: number;
  baseOpacity: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _fAero = new THREE.Vector3();
const _fWorld = new THREE.Vector3();
const _tauLocal = new THREE.Vector3();
const _tauWorld = new THREE.Vector3();
const _relWind = new THREE.Vector3();
const _uWind = new THREE.Vector3();
const _liftDir = new THREE.Vector3();
const _ptOffset = new THREE.Vector3();
const _ptPos = new THREE.Vector3();
const _ptVel = new THREE.Vector3();
const _wWorld = new THREE.Vector3();
const _gearForce = new THREE.Vector3();
const _torqueTmp = new THREE.Vector3();
const _fwdHoriz = new THREE.Vector3();
const _rightHoriz = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, -1);
const LOCAL_FWD = new THREE.Vector3(0, 0, -1);
const LOCAL_AFT = new THREE.Vector3(0, 0, 1);
const _noseDir = new THREE.Vector3();
const _zoneCenter = new THREE.Vector3();
const _hoseTargetLocal = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camLocalTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _camSimPos = new THREE.Vector3();
const _anchorPos = new THREE.Vector3();
const _anchorQuat = new THREE.Quaternion();
const _lightFwd = new THREE.Vector3();
const _lightRight = new THREE.Vector3();
const _lightUp = new THREE.Vector3();
const _focusRender = new THREE.Vector3();
const _snappedTarget = new THREE.Vector3();
const _ptColor = new THREE.Color();
const _ringMat4 = new THREE.Matrix4();
const _camRight = new THREE.Vector3();
const _toJet = new THREE.Vector3();
const _wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

function createTurbulentSmokeTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const hash = (ix: number, iy: number): number => {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };

  const noise2D = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  const fbm = (x: number, y: number): number => {
    let v = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 4; o++) {
      v += amp * noise2D(x * freq, y * freq);
      freq *= 2.04;
      amp *= 0.5;
    }
    return v;
  };

  const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const off = (py * size + px) * 4;

      if (r >= 0.98) {
        data[off] = 220;
        data[off + 1] = 220;
        data[off + 2] = 220;
        data[off + 3] = 0;
        continue;
      }

      // Multi-layered domain warping for jagged, billowing turbulent wisps (zero hard circles)
      const warpX = fbm(nx * 2.1 + 4.3, ny * 2.1 + 1.9) - 0.5;
      const warpY = fbm(nx * 2.1 + 9.7, ny * 2.1 + 6.4) - 0.5;
      const wx = nx * 2.25 + warpX * 1.15;
      const wy = ny * 2.25 + warpY * 1.15;

      const turb = fbm(wx * 1.9 + 2.1, wy * 1.9 + 5.4);
      const fine = fbm(wx * 4.4 + 11.3, wy * 4.4 + 8.7);
      const ang = Math.atan2(ny, nx);
      const lobeWarp = Math.sin(ang * 3.0 + turb * 4.2) * 0.08 + Math.cos(ang * 5.0 - fine * 3.5) * 0.05;

      const warpedR = r + (turb - 0.52) * 0.44 + (fine - 0.5) * 0.2 + lobeWarp;
      const outerFade = 1 - smoothstep(0.5, 0.96, r);
      const bodyMask = 1 - smoothstep(0.14, 0.88, warpedR);
      const alpha = Math.max(0, Math.min(1, bodyMask * outerFade * (0.42 + 0.68 * Math.pow(turb, 0.85)) * (0.72 + 0.35 * fine)));

      const shade = Math.max(175, Math.min(255, Math.round(196 + turb * 42 + fine * 22 - ny * 14)));
      data[off] = shade;
      data[off + 1] = shade;
      data[off + 2] = shade;
      data[off + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createScorchCraterTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const hash = (ix: number, iy: number): number => {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };

  const noise2D = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  const fbm = (x: number, y: number): number => {
    let v = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 4; o++) {
      v += amp * noise2D(x * freq, y * freq);
      freq *= 2.05;
      amp *= 0.5;
    }
    return v;
  };

  const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const off = (py * size + px) * 4;

      if (r >= 0.98) {
        data[off] = 18;
        data[off + 1] = 15;
        data[off + 2] = 12;
        data[off + 3] = 0;
        continue;
      }

      const ang = Math.atan2(ny, nx);
      const rayNoise = fbm(Math.cos(ang) * 4.5 + 3.1, Math.sin(ang) * 4.5 + 7.4);
      const fine = fbm(nx * 5.8 + 12.2, ny * 5.8 + 4.9);
      const streaks = fbm(Math.cos(ang) * 9.0 + r * 2.2, Math.sin(ang) * 9.0 + r * 2.2);

      const warpedR = r + (rayNoise - 0.5) * 0.28 + (streaks - 0.5) * 0.18 + (fine - 0.5) * 0.08;
      const outerFade = 1 - smoothstep(0.56, 0.96, r);
      const decalMask = 1 - smoothstep(0.28, 0.88, warpedR);
      const pitCore = 1 - smoothstep(0.05, 0.38, warpedR);
      const ejectaRing = smoothstep(0.24, 0.42, warpedR) * (1 - smoothstep(0.45, 0.72, warpedR));

      // High-contrast charred pit center, soot ejecta rays, and scorched earth rim
      const rCol = Math.round(10 + pitCore * -4 + ejectaRing * 34 + fine * 14);
      const gCol = Math.round(9 + pitCore * -3 + ejectaRing * 26 + fine * 10);
      const bCol = Math.round(8 + pitCore * -2 + ejectaRing * 18 + fine * 8);
      const alpha = Math.max(0, Math.min(1, decalMask * outerFade * (0.78 + 0.28 * streaks) + pitCore * 0.25));

      data[off] = Math.max(4, Math.min(68, rCol));
      data[off + 1] = Math.max(4, Math.min(54, gCol));
      data[off + 2] = Math.max(4, Math.min(44, bCol));
      data[off + 3] = Math.round(alpha * 245);
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function detectSoftwareWebGL(): boolean {
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
    return false;
  }
}

function getWingtipLocal(id: AircraftId, config: AircraftConfig): readonly [number, number, number] {
  switch (id) {
    case 'f18':
      return [6.75, -0.02, 1.85];
    case 'f35':
      return [6.55, -0.02, 2.6];
    case 'b2':
      return [17.8, 0.0, -4.8];
    case 'sukhoi':
      return [7.42, -0.1, 3.0];
    case 'f16':
      return [5.02, -0.08, 2.45];
    case 'f22':
      return [6.75, -0.04, 3.6];
    case 'a10':
      return [8.75, 0.05, -0.2];
    case 'rafale':
      return [5.58, -0.05, 4.1];
    case 'sr71':
      return [8.45, -0.02, 11.4];
    case 'f117':
      return [6.58, -0.15, 8.1];
    case 'concorde':
      return [11.1, -0.45, 14.2];
    case 'airliner':
      return [15.5, 0.8, 5.2];
    case 'hercules':
      return [13.8, 1.8, -0.4];
    case 'cessna':
      return [5.6, 1.15, -0.65];
    case 'biplane':
      return [4.15, 0.96, -1.0];
    default:
      return [config.hx * 0.96, 0, config.hz * 0.22];
  }
}

const TRAIL_POINTS = 38;

class WingtipTrail {
  public readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly simPts: THREE.Vector3[];
  private readonly sideDirs: THREE.Vector3[];
  private readonly nodeAlphas: Float32Array;
  private head = 0;
  private count = 0;
  private sampleTimer = 0;
  private readonly lastPos = new THREE.Vector3();
  private readonly tmpLeft = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.simPts = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3());
    this.sideDirs = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3(1, 0, 0));
    this.nodeAlphas = new Float32Array(TRAIL_POINTS);

    this.positions = new Float32Array(TRAIL_POINTS * 2 * 3);
    this.alphas = new Float32Array(TRAIL_POINTS * 2);
    const uvs = new Float32Array(TRAIL_POINTS * 2 * 2);
    const indices = new Uint16Array((TRAIL_POINTS - 1) * 6);

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const vCoord = i / (TRAIL_POINTS - 1);
      uvs[i * 4] = 0;
      uvs[i * 4 + 1] = vCoord;
      uvs[i * 4 + 2] = 1;
      uvs[i * 4 + 3] = vCoord;
      if (i < TRAIL_POINTS - 1) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        const o = i * 6;
        indices[o] = a;
        indices[o + 1] = b;
        indices[o + 2] = c;
        indices[o + 3] = b;
        indices[o + 4] = d;
        indices[o + 5] = c;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const alphaAttr = new THREE.BufferAttribute(this.alphas, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);
    this.geometry.setAttribute('aAlpha', alphaAttr);
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xf1f5f9) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vAlpha = aAlpha;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          float edge = smoothstep(0.0, 0.48, vUv.x) * smoothstep(1.0, 0.52, vUv.x);
          float a = vAlpha * edge;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.sampleTimer = 0;
    this.nodeAlphas.fill(0);
    this.mesh.visible = false;
  }

  public update(
    dt: number,
    emitting: boolean,
    intensity: number,
    worldPosSim: THREE.Vector3,
    sideAxis: THREE.Vector3,
    renderOrigin: THREE.Vector3,
    tintColor: THREE.Color
  ): void {
    this.material.uniforms.uColor.value.copy(tintColor).lerp(_trailWhite, 0.72);
    this.sampleTimer += dt;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - i + TRAIL_POINTS) % TRAIL_POINTS;
      this.nodeAlphas[idx] = Math.max(0, this.nodeAlphas[idx] - dt * 1.15);
    }

    if (emitting) {
      const movedSq = this.count === 0 ? 999 : this.lastPos.distanceToSquared(worldPosSim);
      if (this.count === 0 || (this.sampleTimer >= 0.018 && movedSq > 1.2) || movedSq > 36) {
        this.sampleTimer = 0;
        this.head = (this.head + 1) % TRAIL_POINTS;
        if (this.count < TRAIL_POINTS) this.count++;
        this.simPts[this.head].copy(worldPosSim);
        this.sideDirs[this.head].copy(sideAxis);
        this.nodeAlphas[this.head] = THREE.MathUtils.clamp(intensity, 0.08, 0.52);
        this.lastPos.copy(worldPosSim);
      } else {
        this.simPts[this.head].copy(worldPosSim);
        this.sideDirs[this.head].copy(sideAxis);
        this.nodeAlphas[this.head] = Math.max(this.nodeAlphas[this.head], THREE.MathUtils.clamp(intensity, 0.08, 0.52));
      }
    }

    if (this.count < 2) {
      this.mesh.visible = false;
      return;
    }

    let anyVisible = false;
    const halfWidth = 0.24;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const srcIdx = i < this.count ? (this.head - i + TRAIL_POINTS) % TRAIL_POINTS : (this.head - (this.count - 1) + TRAIL_POINTS) % TRAIL_POINTS;
      const ageFade = i < this.count ? 1 - i / (TRAIL_POINTS - 1) : 0;
      const a = i < this.count ? this.nodeAlphas[srcIdx] * ageFade : 0;
      if (a > 0.012) anyVisible = true;

      const w = halfWidth * (0.45 + (1 - ageFade) * 1.45);
      const pt = this.simPts[srcIdx];
      const sd = this.sideDirs[srcIdx];
      this.tmpLeft.copy(pt).sub(renderOrigin).addScaledVector(sd, -w);
      this.tmpRight.copy(pt).sub(renderOrigin).addScaledVector(sd, w);

      const pOff = i * 6;
      this.positions[pOff] = this.tmpLeft.x;
      this.positions[pOff + 1] = this.tmpLeft.y;
      this.positions[pOff + 2] = this.tmpLeft.z;
      this.positions[pOff + 3] = this.tmpRight.x;
      this.positions[pOff + 4] = this.tmpRight.y;
      this.positions[pOff + 5] = this.tmpRight.z;

      const aOff = i * 2;
      this.alphas[aOff] = a;
      this.alphas[aOff + 1] = a;
    }

    if (!anyVisible) {
      this.count = 0;
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const _trailWhite = new THREE.Color(0xf8fafc);
const _wingAxis = new THREE.Vector3();
const _wingPosL = new THREE.Vector3();
const _wingPosR = new THREE.Vector3();
const _bossStormTop = new THREE.Color(0x1a0e2e);
const _bossStormHor = new THREE.Color(0x3a2a50);
const _bossStormCloudTop = new THREE.Color(0x312344);
const _bossStormCloudShadow = new THREE.Color(0x150e20);
const _bossMuzzleWorld = new THREE.Vector3();
const _bossAimVec = new THREE.Vector3();
const _bossCenterPos = new THREE.Vector3();
const _bossTargetVel = new THREE.Vector3();

export class FlightEngine {
  private container: HTMLElement;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cam: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private isSoftwareGl: boolean;
  private world: WorldObjects;
  private aircraft: AircraftInstance[];
  private cur: AircraftInstance;
  private manM: ManMesh;
  private npcM: ManMesh;
  public audio = new FlightAudio();

  private phase: GamePhase = 'lobby';
  private mode: PlayerMode = 'walk';
  private cameraMode: CameraMode = 'chase';
  private timeOfDay: TimeOfDay = 'noon';
  private selectedLobbyId: AircraftId = 'f18';
  private autoLevel = true;
  private flapsActive = false;
  private papiSlope: 'high' | 'on' | 'low' | 'off' = 'off';
  private tireSmokeTimer = 0;
  private missionMgr = new MissionManager();

  private man = { p: new THREE.Vector3(...HOME_WALK_POS), yaw: 0, vy: 0, anim: 0, moving: false };
  private walkSpeedRatio = 0;
  private manV = new THREE.Vector3();
  private parachuteOpen = false;
  private chuteInflate = 0;
  private skydiveBank = 0;
  private diveRatio = 0;
  private flareActive = false;
  private boarding: BoardingState | null = null;

  private npc: SamiState = {
    p: new THREE.Vector3(...HOME_NPC_POS),
    yaw: 0,
    anim: 0,
    mv: false,
    tg: new THREE.Vector3(...HOME_NPC_POS),
    wait: 1,
    st: 'idle',
    ac: null,
    hold: 0,
    vy: 0,
    jn: 0,
    then: null,
    wt: 0,
    hh: 0,
    seek: false,
    rode: false,
    mood: 'واثق',
  };

  private stats: ScoreboardState = {
    player: { alt: 0, spd: 0, land: 0, crash: 0, rings: 0 },
    sami: { alt: 0, spd: 0, land: 0, crash: 0, rings: 0 },
  };
  private ringsCollected = 0;

  private missiles: HomingMissile[] = [];
  private flares: FlareInstance[] = [];
  private bombs: BombInstance[] = [];
  private static readonly SMOKE_CAP = 640;
  private static readonly FIRE_CAP = 360;
  private static readonly RING_CAP = 24;
  private static readonly CRATER_CAP = 40;
  private smokeTex!: THREE.CanvasTexture;
  private craterTex!: THREE.CanvasTexture;
  private smokeMesh!: THREE.InstancedMesh;
  private smokeMat!: THREE.ShaderMaterial;
  private smokeParamAttr!: THREE.InstancedBufferAttribute;
  private smokeColorAttr!: THREE.InstancedBufferAttribute;
  private smokeActive: SmokeParticle[] = [];
  private smokeFree: SmokeParticle[] = [];
  private fireMesh!: THREE.InstancedMesh;
  private fireMat!: THREE.ShaderMaterial;
  private fireParamAttr!: THREE.InstancedBufferAttribute;
  private fireColorAttr!: THREE.InstancedBufferAttribute;
  private fireActive: FireParticle[] = [];
  private fireFree: FireParticle[] = [];
  private ringMesh!: THREE.InstancedMesh;
  private ringMat!: THREE.ShaderMaterial;
  private ringParamAttr!: THREE.InstancedBufferAttribute;
  private ringColorAttr!: THREE.InstancedBufferAttribute;
  private ringActive: ShockRingParticle[] = [];
  private ringFree: ShockRingParticle[] = [];
  private craterMesh!: THREE.InstancedMesh;
  private craters: GroundCrater[] = [];
  private craterWriteIdx = 0;
  private cratersDirty = false;
  private missileCooldown = 0;
  private missileSide = 1;
  private bombCooldown = 0;
  private bombSide = 1;
  private flareCooldown = 0;
  private flaresCount = 24;
  private samiLockTimer = 0;
  private samiMissileCooldown = 8.0;
  private missileAlert: 'none' | 'lock' | 'incoming' = 'none';
  private incomingMissileDistM = 0;
  private tailhookDown = false;
  private arrestedWireEngaged = false;
  private arrestedWireTimer = 0;
  private bolterWarningTimer = 0;
  private carrierTrapCooldown = 0;
  private tanker!: TankerState;
  private tankerZoneTarget = new THREE.Vector3(1250, 1497.5, 64.2);
  private fuelPct = 100;
  private refuelAssist = false;
  private refuelConnected = false;
  private refuelProgress = 0;
  private refuelHoseExtend = 0;
  private refuelDockTimer = 0;
  private refuelFullChimed = false;
  private refuelDistanceM = 9999;
  private gForce = 1.0;
  private prevPlayerV = new THREE.Vector3();
  private vaporCone!: THREE.Group;
  private vaporConeMats: THREE.ShaderMaterial[] = [];
  private wingtipTrails: [WingtipTrail, WingtipTrail] | null = null;
  private speedStreakMesh!: THREE.InstancedMesh;
  private speedStreakMat!: THREE.ShaderMaterial;
  private pmremGenerator!: THREE.PMREMGenerator;
  private envScene!: THREE.Scene;
  private envDomeMat!: THREE.ShaderMaterial;
  private envDomeGeo!: THREE.BufferGeometry;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private cockpitRig!: THREE.Group;
  private animRigs = new Map<
    AircraftInstance,
    { rig: AircraftAnimRig; gearAnim: number; ctrl: THREE.Vector3; decelAnim: number }
  >();
  private flybyPrevClosing = new Map<AircraftInstance, number>();
  private flybyPrevMach = new Map<AircraftInstance, number>();
  private flybyBoomCooldown = new Map<AircraftInstance, number>();
  private wasSupersonic = false;
  private sonicBoomFlash = 0;
  private lockedTarget: AircraftInstance | null = null;
  private camShake = 0;
  private scrapeAudioTimer = 0;
  private scrapeContactIntensity = 0;
  private scrapeContactSpeed = 0;
  private scrapeContactSurface: ScrapeSurface = 'ground';
  private scrapeContactDistScale = 1;
  private scrapeContactTimeout = 0;

  // Dynamic weather state (randomly evolving wind, fog, clouds & airframe turbulence)
  private weatherCondition: WeatherCondition = 'clear';
  private weatherTimer = 26;
  private weatherWindVec = new THREE.Vector3(3.4, 0, -1.6);
  private weatherTargetWind = new THREE.Vector3(3.4, 0, -1.6);
  private weatherFogMul = 1.0;
  private weatherTargetFogMul = 1.0;
  private weatherCloudScale = 0.9;
  private weatherTargetCloudScale = 0.9;
  private weatherOvercast = 0.08;
  private weatherTargetOvercast = 0.08;
  private weatherTurbulence = 0.12;
  private weatherTargetTurbulence = 0.12;
  private weatherGustVec = new THREE.Vector3();
  private weatherStreakTimer = 0;

  // Megatron Hidden Boss Encounter State
  private megatronRig!: MegatronRig;
  private bossLightning!: MegatronLightningSystem;
  private bossWarningLaser!: THREE.Mesh;
  private bossWarningLaserMat!: THREE.MeshBasicMaterial;
  private bossPlasmaBolts: {
    active: boolean;
    p: THREE.Vector3;
    v: THREE.Vector3;
    age: number;
    maxAge: number;
    mesh: THREE.Group;
  }[] = [];
  private boss = {
    phase: 'idle' as MegatronPhase,
    mode: 'jet' as 'mech' | 'jet',
    hp: 5000,
    maxHp: 5000,
    p: new THREE.Vector3(410, 2400, -440),
    v: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    jetRoll: 0,
    transformT: 0,
    phaseTimer: 0,
    stormBlend: 0,
    lightningTimer: 0,
    stageFlags: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    roarPlayed: false,
    attackTimer: 1.6,
    chargeTimer: 0,
    burstLeft: 0,
    burstCooldown: 0,
    leapActive: false,
    leapVy: 0,
    leapVx: 0,
    leapVz: 0,
    leapCooldown: 3.0,
    stompTimer: 0,
    recoilTimer: 0,
    staggerTimer: 0,
    jetMissileCooldown: 2.2,
    jetStrafeTimer: 0,
    walkCycle: 0,
    walkSpeed: 0,
    landingSite: new THREE.Vector3(410, 0, -440),
    entryStart: new THREE.Vector3(1200, 2350, -1850),
    lockedByPlayer: false,
    altitudeAutoTriggered: false,
    dyingBurstTimer: 0,
  };

  private keys: Record<string, number> = {};
  private analog = { x: 0, y: 0, rud: 0, on: false };
  private jumps: number[] = [];

  private isTouchGpu =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  private sq = new THREE.Quaternion();
  private camYaw = 0;
  private camYawTarget = 0;
  private camPitch = 0.34;
  private camPitchTarget = 0.34;
  private flyYaw = 0;
  private flyYawTarget = 0;
  private flyPitch = 0;
  private flyPitchTarget = 0;
  private flyIdle = 0;
  private camZoom = 1;
  private camZoomTarget = 1;
  private lobbyOrbitYaw = 0.65;
  private lobbyOrbitYawTarget = 0.65;
  private lobbyOrbitPitch = 0.24;
  private lobbyOrbitPitchTarget = 0.24;
  private lobbyFocusPos = new THREE.Vector3();
  private renderOrigin = new THREE.Vector3();
  private camAnchor = new THREE.Object3D();
  private camAnchorOwner: AircraftInstance | null = null;
  private shadowOwner: AircraftInstance | null = null;
  private camLocalLag = new THREE.Vector3(0, 4.5, 16);
  private camRelOffset = new THREE.Vector3(0, 4.5, 16);
  private camLookRel = new THREE.Vector3(0, 0.5, -18);
  private camGroundLift = 0;
  private drag = false;
  private dragId = -1;
  private lx = 0;
  private ly = 0;
  private mapZoomIdx = 1;
  private mapBig = false;

  private bubTxt = '';
  private bubT = 0;
  private talkCD = 0;
  private seenTalk: Record<string, number> = {};
  private invT = 0;
  private stallT = 0;
  private plAir = false;
  private leadAlt = '';
  private wasGround = true;

  private static readonly FIXED_DT = 1 / 120;
  private physAccum = 0;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private fpsTimer = 0;
  private frameCounter = 0;
  private fps = 60;
  private hudTimer = 0;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onSamiMessage: (text: string) => void;
  private onContextLostCb: (lost: boolean) => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onSamiMessage: (text: string) => void,
    onContextLost: (lost: boolean) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onSamiMessage = onSamiMessage;
    this.onContextLostCb = onContextLost;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const maxDpr = this.isTouchGpu ? 1.15 : 1.5;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, maxDpr));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Procedural sky-dome environment map for realistic metallic fuselage & canopy reflections
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.envScene = new THREE.Scene();
    this.envDomeGeo = new THREE.SphereGeometry(20, 24, 16);
    this.envDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x10356e) },
        uHorizonColor: { value: new THREE.Color(0x76a8dc) },
        uGroundColor: { value: new THREE.Color(0x283623) },
        uSunDir: { value: new THREE.Vector3(0.45, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfff0d1) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uGroundColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 sky = mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.58));
          vec3 earth = mix(uHorizonColor * 0.72, uGroundColor, pow(clamp(-h * 1.4, 0.0, 1.0), 0.7));
          vec3 col = h >= 0.0 ? sky : earth;
          float sunDot = max(0.0, dot(d, normalize(uSunDir)));
          col += uSunColor * (pow(sunDot, 16.0) * 0.55 + pow(sunDot, 140.0) * 2.4);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.envScene.add(new THREE.Mesh(this.envDomeGeo, this.envDomeMat));

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.cam = new THREE.PerspectiveCamera(60, w / h, 2.0, 60000);
    this.scene.add(this.cam);

    this.hemi = new THREE.HemisphereLight(0x7ec0ff, 0x2b3828, 0.82);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d1, 1.48);
    this.sun.position.set(320, 480, 220);
    if (!this.isSoftwareGl) {
      const shadowRes = this.isTouchGpu ? 1024 : 2048;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(shadowRes, shadowRes);
      this.sun.shadow.radius = this.isTouchGpu ? 1.8 : 2.4;
      this.sun.shadow.camera.near = 25;
      this.sun.shadow.camera.far = 880;
      const d = 125;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Cool sky fill / silhouette rim light opposite the sun for AAA depth separation
    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.34);
    this.fillLight.position.set(-280, 180, -240);
    this.scene.add(this.fillLight);

    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const textures = createProceduralTextures(maxAniso);
    this.world = buildWorld(this.scene, textures, this.isSoftwareGl);
    // Attach sky dome to scene root (outside world.root) so Floating Origin never shifts the horizon sky
    this.scene.add(this.world.skyMesh);
    this.world.applyTimeOfDay(this.timeOfDay, this.scene, this.sun, this.hemi);
    this.updateSkyEnvironment(this.timeOfDay);
    this.pickRandomWeather(true);
    this.weatherWindVec.copy(this.weatherTargetWind);
    this.weatherFogMul = this.weatherTargetFogMul;
    this.weatherCloudScale = this.weatherTargetCloudScale;
    this.weatherOvercast = this.weatherTargetOvercast;
    this.weatherTurbulence = this.weatherTargetTurbulence;

    this.aircraft = AIRCRAFT_CONFIGS.map((cfg) => {
      const built = buildAircraftModel(cfg.id, cfg, textures, this.isSoftwareGl);
      this.scene.add(built.group);
      const q = new THREE.Quaternion().setFromAxisAngle(_up, cfg.spawnYaw);
      const staticSag = cfg.aero.gearMaxTravelM * 0.35;
      const spawnP = new THREE.Vector3(cfg.spawnPos[0], cfg.spawnPos[1] - staticSag, cfg.spawnPos[2]);
      const inst: AircraftInstance = {
        config: cfg,
        group: built.group,
        pilot: built.pilot,
        pax: built.pax,
        tailhook: built.tailhook,
        props: built.props,
        discs: built.discs,
        flames: built.flames,
        strobes: built.strobes,
        contactPoints: built.contactPoints,
        spawn: spawnP.clone(),
        spawnYaw: cfg.spawnYaw,
        p: spawnP.clone(),
        prevP: spawnP.clone(),
        renderP: spawnP.clone(),
        q,
        prevQ: q.clone(),
        renderQ: q.clone(),
        v: new THREE.Vector3(),
        w: new THREE.Vector3(),
        thr: 0,
        spool: 0,
        ground: true,
        crash: 0,
        hull: 100,
        damage: {
          leftWing: 1.0,
          rightWing: 1.0,
          tail: 1.0,
          engine: 1.0,
          gear: 1.0,
        },
        engineOverheat: 0,
        engineSputterTimer: 0,
        abandoned: false,
        aoa: 0,
        fwd: 0,
        tas: 0,
        liftLoadG: 1,
        sh: createShadowCircle(this.scene),
        ai: null,
        inp: { p: 0, r: 0, y: 0, thr: 0, brake: 0 },
      };
      if (built.animRig) {
        this.animRigs.set(inst, {
          rig: built.animRig,
          gearAnim: 1,
          ctrl: new THREE.Vector3(),
          decelAnim: 0,
        });
      }
      return inst;
    });

    this.cur = this.aircraft.find((a) => a.config.id === this.selectedLobbyId) || this.aircraft[0];
    this.syncCamAnchor();
    this.lobbyFocusPos.copy(this.cur.p);

    // Aerial Refueling KC-46 Stratotanker (closed racetrack orbit at 1,500 m, 450 km/h within 4 km of airfield)
    const tankerModel = buildTankerModel();
    tankerModel.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = false;
      }
    });
    this.scene.add(tankerModel.group);
    this.tanker = {
      model: tankerModel,
      p: new THREE.Vector3(1250, 1500, 0),
      q: new THREE.Quaternion(),
      v: new THREE.Vector3(0, 0, -125),
      angle: 0,
      boomTipWorld: new THREE.Vector3(1250, 1494, 35),
    };

    // Multi-Layered Mach 1 Prandtl-Glauert Condensation Cloud (Custom Scrolling FBM Shader)
    this.vaporCone = new THREE.Group();
    this.vaporCone.visible = false;
    this.vaporConeMats = [];

    const createVaporShaderMat = (
      maxAlpha: number,
      flowSpeed: number,
      noiseScale: number,
      additive: boolean
    ) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uDensity: { value: 0 },
          uWeatherBoost: { value: 1 },
          uMaxAlpha: { value: maxAlpha },
          uFlowSpeed: { value: flowSpeed },
          uNoiseScale: { value: noiseScale },
          uTint: { value: new THREE.Color(0xf8fafc) },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          void main() {
            vUv = uv;
            // Subtle Prandtl-Glauert curved shock profile instead of flat rigid cone
            float axial = 1.0 - uv.y;
            float flare = 1.0 + sin(axial * 3.14159265) * 0.16;
            vec3 pos = vec3(position.x * flare, position.y * flare, position.z);
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uDensity;
          uniform float uWeatherBoost;
          uniform float uMaxAlpha;
          uniform float uFlowSpeed;
          uniform float uNoiseScale;
          uniform vec3 uTint;

          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          float hash3(vec3 p) {
            p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }

          float noise3(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
              ),
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
              ),
              f.z
            );
          }

          float fbm(vec3 p) {
            float v = 0.0;
            float a = 0.52;
            for (int i = 0; i < 4; i++) {
              v += a * noise3(p);
              p = p * 2.05 + vec3(13.7, 7.3, 5.1);
              a *= 0.5;
            }
            return v;
          }

          void main() {
            float axial = 1.0 - vUv.y;
            float ang = vUv.x * 6.28318530718;
            // Seamless periodic radial coordinates prevent any cone seam
            vec2 ring = vec2(cos(ang), sin(ang));

            vec3 flowCoord = vec3(
              ring.x * uNoiseScale,
              ring.y * uNoiseScale,
              axial * (uNoiseScale * 2.1) - uTime * uFlowSpeed
            );
            float nCoarse = fbm(flowCoord);
            float nFine = fbm(flowCoord * 2.15 + vec3(0.0, 0.0, -uTime * uFlowSpeed * 0.6));
            float mist = smoothstep(0.24, 0.84, nCoarse * 0.66 + nFine * 0.34);

            // Soft feathered leading shock front and wispy trailing skirt
            float axialFade = smoothstep(0.0, 0.24, axial) * smoothstep(1.0, 0.34, axial);

            // Grazing-angle Fresnel limb brightening for volumetric condensed vapor look
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndotv = abs(dot(viewDir, normalize(vWorldNormal)));
            float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 1.3);
            float radialBody = mix(0.32, 1.0, fresnel);

            float alpha = clamp(axialFade * radialBody * mist * uDensity * uWeatherBoost, 0.0, uMaxAlpha);
            if (alpha < 0.005) discard;

            vec3 mistCol = mix(uTint * 0.9, vec3(0.97, 0.99, 1.0), 0.42 + 0.45 * fresnel);
            gl_FragColor = vec4(mistCol, alpha);
          }
        `,
      });

    const outerConeGeo = new THREE.CylinderGeometry(0.14, 1.0, 1.0, 44, 14, true).rotateX(-Math.PI / 2);
    const outerConeMat = createVaporShaderMat(0.62, 7.6, 2.35, false);
    const outerConeMesh = new THREE.Mesh(outerConeGeo, outerConeMat);
    outerConeMesh.scale.set(6.8, 6.8, 8.6);
    outerConeMesh.position.z = 2.1;
    outerConeMesh.renderOrder = 6;

    const innerCollarGeo = new THREE.CylinderGeometry(0.18, 0.95, 1.0, 40, 10, true).rotateX(-Math.PI / 2);
    const innerCollarMat = createVaporShaderMat(0.38, 10.4, 3.2, true);
    const innerCollarMesh = new THREE.Mesh(innerCollarGeo, innerCollarMat);
    innerCollarMesh.scale.set(4.8, 4.8, 5.2);
    innerCollarMesh.position.z = 1.25;
    innerCollarMesh.renderOrder = 7;

    this.vaporConeMats.push(outerConeMat, innerCollarMat);
    this.vaporCone.add(outerConeMesh, innerCollarMesh);
    this.scene.add(this.vaporCone);

    this.wingtipTrails = [new WingtipTrail(this.scene), new WingtipTrail(this.scene)];

    // 3D Cockpit Frame & Green HUD Combiner Glass attached cleanly to camera
    this.cockpitRig = new THREE.Group();
    this.cockpitRig.visible = false;
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.2 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.6 });
    const glareshield = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.35), dashMat);
    glareshield.position.set(0, -0.34, -0.78);
    glareshield.rotation.x = 0.14;
    const hudFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.02), trimMat);
    hudFrameL.position.set(-0.29, -0.06, -0.72);
    hudFrameL.rotation.x = -0.32;
    const hudFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.02), trimMat);
    hudFrameR.position.set(0.29, -0.06, -0.72);
    hudFrameR.rotation.x = -0.32;
    const hudGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.27),
      new THREE.MeshBasicMaterial({
        color: 0x22ff66,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    hudGlass.position.set(0, -0.06, -0.72);
    hudGlass.rotation.x = -0.32;
    const canopyBowL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.85, 0.045), dashMat);
    canopyBowL.position.set(-0.56, 0.08, -0.62);
    canopyBowL.rotation.z = -0.26;
    const canopyBowR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.85, 0.045), dashMat);
    canopyBowR.position.set(0.56, 0.08, -0.62);
    canopyBowR.rotation.z = 0.26;
    const canopyArchTop = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.038, 0.045), dashMat);
    canopyArchTop.position.set(0, 0.45, -0.62);
    this.cockpitRig.add(glareshield, hudFrameL, hudFrameR, hudGlass, canopyBowL, canopyBowR, canopyArchTop);
    this.cam.add(this.cockpitRig);

    // Normal realistic human pilot figures wearing dark litham
    this.manM = makeCharacterMesh(this.scene, 0x1e3a8a, 0x1e293b, 0x0f172a, true);
    this.npcM = makeCharacterMesh(this.scene, 0xc2410c, 0x334155, 0x1e293b, false);

    // Megatron Hidden Boss Articulated Rig, Branching Lightning System & Warning Laser Sight
    this.megatronRig = buildMegatronRig();
    this.megatronRig.root.visible = false;
    this.scene.add(this.megatronRig.root);
    this.bossLightning = new MegatronLightningSystem(this.scene);

    const laserGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 8).rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, 0.5);
    this.bossWarningLaserMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.bossWarningLaser = new THREE.Mesh(laserGeo, this.bossWarningLaserMat);
    this.bossWarningLaser.visible = false;
    this.bossWarningLaser.frustumCulled = false;
    this.scene.add(this.bossWarningLaser);

    const plasmaCoreGeo = new THREE.SphereGeometry(0.95, 10, 8);
    const plasmaHaloGeo = new THREE.SphereGeometry(2.1, 10, 8);
    const plasmaCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfdf4ff,
      toneMapped: false,
    });
    const plasmaHaloMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < 16; i++) {
      const pg = new THREE.Group();
      pg.add(new THREE.Mesh(plasmaCoreGeo, plasmaCoreMat), new THREE.Mesh(plasmaHaloGeo, plasmaHaloMat));
      pg.visible = false;
      this.scene.add(pg);
      this.bossPlasmaBolts.push({
        active: false,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 0,
        maxAge: 5.5,
        mesh: pg,
      });
    }

    this.initPools();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.cam);
    }

    this.bindEvents();
    this.scheduleNextFrame();
  }

  private initPools(): void {
    const mBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.25 });
    const mNoseMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const mFinMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const bodyGeo = new THREE.CylinderGeometry(0.11, 0.11, 3.1, 8).rotateX(Math.PI / 2);
    const noseGeo = new THREE.ConeGeometry(0.11, 0.55, 8).rotateX(-Math.PI / 2);
    const finGeo = new THREE.BoxGeometry(0.56, 0.03, 0.42);
    const plumeGeo = new THREE.ConeGeometry(0.24, 2.5, 8).rotateX(Math.PI / 2);

    for (let i = 0; i < 10; i++) {
      const mg = new THREE.Group();
      mg.visible = false;
      mg.add(new THREE.Mesh(bodyGeo, mBodyMat));
      const mn = new THREE.Mesh(noseGeo, mNoseMat);
      mn.position.z = -1.82;
      mg.add(mn);
      const f1 = new THREE.Mesh(finGeo, mFinMat);
      f1.position.z = 1.25;
      mg.add(f1);
      const f2 = new THREE.Mesh(finGeo, mFinMat);
      f2.position.z = 1.25;
      f2.rotation.z = Math.PI / 2;
      mg.add(f2);
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.z = 2.75;
      plume.visible = false;
      mg.add(plume);
      this.scene.add(mg);

      this.missiles.push({
        active: false,
        mesh: mg,
        plume,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        target: null,
        flareTarget: null,
        owner: this.aircraft[0],
        age: 0,
        smokeTimer: 0,
        railSide: 1,
        railOffset: new THREE.Vector3(),
        ignited: false,
        launchSpeed: 0,
      });
    }

    const flareGeo = new THREE.SphereGeometry(0.45, 8, 6);
    for (let i = 0; i < 36; i++) {
      const fMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.96 });
      const fm = new THREE.Mesh(flareGeo, fMat);
      fm.visible = false;
      this.scene.add(fm);
      this.flares.push({
        active: false,
        mesh: fm,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 0,
        maxAge: 3.4,
        smokeTimer: 0,
      });
    }

    const bombOliveMat = new THREE.MeshStandardMaterial({ color: 0x3f4a36, roughness: 0.48, metalness: 0.35 });
    const bombStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const bombBodyGeo = new THREE.CapsuleGeometry(0.22, 1.35, 4, 8).rotateX(Math.PI / 2);
    const bombRingGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.14, 8).rotateX(Math.PI / 2);
    const bombFinGeo = new THREE.BoxGeometry(0.68, 0.04, 0.45);
    for (let i = 0; i < 16; i++) {
      const bg = new THREE.Group();
      bg.visible = false;
      bg.add(new THREE.Mesh(bombBodyGeo, bombOliveMat));
      const stripe = new THREE.Mesh(bombRingGeo, bombStripeMat);
      stripe.position.z = -0.35;
      bg.add(stripe);
      const bf1 = new THREE.Mesh(bombFinGeo, mFinMat);
      bf1.position.z = 0.72;
      bg.add(bf1);
      const bf2 = new THREE.Mesh(bombFinGeo, mFinMat);
      bf2.position.z = 0.72;
      bf2.rotation.z = Math.PI / 2;
      bg.add(bf2);
      this.scene.add(bg);
      this.bombs.push({
        active: false,
        mesh: bg,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        owner: this.aircraft[0],
        age: 0,
        whistleTriggered: false,
      });
    }

    this.smokeTex = createTurbulentSmokeTexture();

    const billboardGeo = new THREE.PlaneGeometry(1, 1);
    const smokeGeo = billboardGeo.clone();
    this.smokeParamAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.SMOKE_CAP * 4), 4);
    this.smokeParamAttr.setUsage(THREE.DynamicDrawUsage);
    this.smokeColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.SMOKE_CAP * 3), 3);
    this.smokeColorAttr.setUsage(THREE.DynamicDrawUsage);
    smokeGeo.setAttribute('aParam', this.smokeParamAttr);
    smokeGeo.setAttribute('aColor', this.smokeColorAttr);

    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.smokeTex },
        uFogColor: { value: new THREE.Color(0x74a9dd) },
        uFogDensity: { value: 0.000105 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aParam;
        attribute vec3 aColor;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vDist;
        void main() {
          vUv = uv;
          vColor = aColor;
          vOpacity = aParam.z;
          vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float c = cos(aParam.y);
          float s = sin(aParam.y);
          vec2 rotated = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aParam.x;
          mvCenter.xy += rotated;
          vDist = length(mvCenter.xyz);
          gl_Position = projectionMatrix * mvCenter;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uTex;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vDist;
        void main() {
          #include <logdepthbuf_fragment>
          vec4 tex = texture2D(uTex, vUv);
          float alpha = tex.a * vOpacity;
          if (alpha < 0.008) discard;
          vec3 col = tex.rgb * vColor;
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, this.smokeMat, FlightEngine.SMOKE_CAP);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.renderOrder = 6;
    this.smokeMesh.count = 0;
    const smokeMatArr = this.smokeMesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < FlightEngine.SMOKE_CAP; i++) {
      const b = i * 16;
      smokeMatArr[b] = 1;
      smokeMatArr[b + 5] = 1;
      smokeMatArr[b + 10] = 1;
      smokeMatArr[b + 15] = 1;
      this.smokeFree.push({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        startScale: 1,
        endScale: 4,
        rot: 0,
        spin: 0,
        baseOpacity: 0.5,
        windMul: 0.7,
        buoyancy: 1.5,
        drag: 1.4,
        r: 0.5,
        g: 0.5,
        b: 0.5,
        endR: 0.5,
        endG: 0.5,
        endB: 0.5,
      });
    }
    this.scene.add(this.smokeMesh);

    const fireGeo = billboardGeo.clone();
    this.fireParamAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.FIRE_CAP * 4), 4);
    this.fireParamAttr.setUsage(THREE.DynamicDrawUsage);
    this.fireColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.FIRE_CAP * 3), 3);
    this.fireColorAttr.setUsage(THREE.DynamicDrawUsage);
    fireGeo.setAttribute('aParam', this.fireParamAttr);
    fireGeo.setAttribute('aColor', this.fireColorAttr);

    this.fireMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.smokeTex },
        uFogDensity: { value: 0.000105 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aParam;
        attribute vec3 aColor;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vMode;
        varying float vDist;
        void main() {
          vUv = uv;
          vColor = aColor;
          vOpacity = aParam.z;
          vMode = aParam.w;
          vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float c = cos(aParam.y);
          float s = sin(aParam.y);
          vec2 rotated = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aParam.x;
          mvCenter.xy += rotated;
          vDist = length(mvCenter.xyz);
          gl_Position = projectionMatrix * mvCenter;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uTex;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vMode;
        varying float vDist;
        void main() {
          #include <logdepthbuf_fragment>
          vec4 tex = texture2D(uTex, vUv);
          vec2 centered = (vUv - 0.5) * 2.0;
          float rad = length(centered);
          float softCore = exp(-rad * rad * 4.5) * smoothstep(1.0, 0.25, rad);
          float turbulent = tex.a * (0.65 + 0.55 * softCore);
          float alpha = mix(turbulent, max(softCore * 1.15, tex.a * 0.45), vMode) * vOpacity;
          if (alpha < 0.008) discard;
          float fogAtten = exp(-uFogDensity * uFogDensity * vDist * vDist * 0.65);
          vec3 col = vColor * (0.9 + tex.r * 0.45) * alpha * fogAtten;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.fireMesh = new THREE.InstancedMesh(fireGeo, this.fireMat, FlightEngine.FIRE_CAP);
    this.fireMesh.frustumCulled = false;
    this.fireMesh.renderOrder = 7;
    this.fireMesh.count = 0;
    const fireMatArr = this.fireMesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < FlightEngine.FIRE_CAP; i++) {
      const b = i * 16;
      fireMatArr[b] = 1;
      fireMatArr[b + 5] = 1;
      fireMatArr[b + 10] = 1;
      fireMatArr[b + 15] = 1;
      this.fireFree.push({
        kind: 'fire',
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        startScale: 1,
        endScale: 5,
        rot: 0,
        spin: 0,
        baseOpacity: 1,
        r: 1,
        g: 0.6,
        b: 0.2,
        thermalRamp: false,
        buoyancy: 0,
        gravity: 0,
        drag: 1.5,
        emitsSmoke: false,
        smokeTrailTimer: 0,
        bounceSound: false,
      });
    }
    this.scene.add(this.fireMesh);

    const ringGeo = new THREE.RingGeometry(0.62, 1.0, 40).rotateX(-Math.PI / 2);
    this.ringParamAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.RING_CAP * 4), 4);
    this.ringParamAttr.setUsage(THREE.DynamicDrawUsage);
    this.ringColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(FlightEngine.RING_CAP * 3), 3);
    this.ringColorAttr.setUsage(THREE.DynamicDrawUsage);
    ringGeo.setAttribute('aParam', this.ringParamAttr);
    ringGeo.setAttribute('aColor', this.ringColorAttr);

    this.ringMat = new THREE.ShaderMaterial({
      uniforms: {},
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aParam;
        attribute vec3 aColor;
        varying float vOpacity;
        varying vec3 vColor;
        varying float vBand;
        void main() {
          vOpacity = aParam.x;
          vColor = aColor;
          float r = length(position.xz);
          vBand = clamp((r - 0.62) / 0.38, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying float vOpacity;
        varying vec3 vColor;
        varying float vBand;
        void main() {
          #include <logdepthbuf_fragment>
          float wave = sin(vBand * 3.14159265);
          float alpha = wave * wave * vOpacity;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(vColor * alpha, alpha);
        }
      `,
    });

    this.ringMesh = new THREE.InstancedMesh(ringGeo, this.ringMat, FlightEngine.RING_CAP);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 5;
    this.ringMesh.count = 0;
    for (let i = 0; i < FlightEngine.RING_CAP; i++) {
      this.ringFree.push({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        age: 0,
        maxAge: 0.6,
        startScale: 1,
        endScale: 30,
        r: 1,
        g: 0.9,
        b: 0.7,
        baseOpacity: 0.85,
      });
    }
    this.scene.add(this.ringMesh);
    billboardGeo.dispose();

    // Persistent Ground Scorch Craters (InstancedMesh up to 40 craters)
    this.craterTex = createScorchCraterTexture();
    const craterGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const craterMat = new THREE.MeshStandardMaterial({
      map: this.craterTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.96,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.craterMesh = new THREE.InstancedMesh(craterGeo, craterMat, FlightEngine.CRATER_CAP);
    this.craterMesh.frustumCulled = false;
    this.craterMesh.renderOrder = 2;
    this.craterMesh.count = 0;
    this.scene.add(this.craterMesh);

    // High-Speed Camera-Space Wind / Speed Streaks (44 GPU-driven instances, zero per-frame CPU cost)
    const streakCount = 44;
    const streakGeo = new THREE.PlaneGeometry(1, 1);
    const streakSeeds = new Float32Array(streakCount * 4);
    for (let i = 0; i < streakCount; i++) {
      const ang = (i / streakCount) * Math.PI * 2 + (i % 3) * 0.27;
      const rad = 4.4 + ((i * 37) % 100) * 0.055;
      const zOff = ((i * 53) % 100) * 0.48;
      const spdScale = 0.78 + ((i * 19) % 100) * 0.0052;
      streakSeeds[i * 4] = ang;
      streakSeeds[i * 4 + 1] = rad;
      streakSeeds[i * 4 + 2] = zOff;
      streakSeeds[i * 4 + 3] = spdScale;
    }
    const streakSeedAttr = new THREE.InstancedBufferAttribute(streakSeeds, 4);
    streakGeo.setAttribute('aSeed', streakSeedAttr);
    this.speedStreakMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeedRatio: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(0xe0f2fe) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uSpeedRatio;
        varying vec2 vUv;
        varying float vDepthFade;
        void main() {
          vUv = uv;
          float c = cos(aSeed.x);
          float s = sin(aSeed.x);
          vec3 radialDir = vec3(c, s, 0.0);
          vec3 tangentDir = vec3(-s, c, 0.0);
          float zLoop = mod(aSeed.z + uTime * (42.0 + uSpeedRatio * 76.0) * aSeed.w, 48.0) - 46.0;
          float zLen = (3.4 + uSpeedRatio * 10.5) * aSeed.w;
          vec3 localPos = radialDir * aSeed.y + tangentDir * (position.x * 0.042) + vec3(0.0, 0.0, zLoop + position.y * zLen);
          vDepthFade = smoothstep(-46.0, -30.0, zLoop) * smoothstep(1.2, -4.0, zLoop);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vDepthFade;
        void main() {
          float lenFade = sin(vUv.y * 3.14159265);
          float edgeFade = sin(vUv.x * 3.14159265);
          float alpha = lenFade * lenFade * edgeFade * vDepthFade * uOpacity;
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
    });
    this.speedStreakMesh = new THREE.InstancedMesh(streakGeo, this.speedStreakMat, streakCount);
    this.speedStreakMesh.frustumCulled = false;
    this.speedStreakMesh.renderOrder = 8;
    this.speedStreakMesh.visible = false;
    for (let i = 0; i < streakCount; i++) {
      _ringMat4.identity();
      this.speedStreakMesh.setMatrixAt(i, _ringMat4);
    }
    this.speedStreakMesh.instanceMatrix.needsUpdate = true;
    this.cam.add(this.speedStreakMesh);
  }

  private spawnSmoke(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    maxAge: number,
    baseOpacity = 0.56,
    windMul = 0.75,
    buoyancy = 1.6,
    drag = 1.35,
    endColorHex?: number
  ): void {
    let pt = this.smokeFree.pop();
    if (!pt) {
      if (this.smokeActive.length === 0) return;
      // Recycle oldest active smoke puff if pool is saturated
      pt = this.smokeActive.shift()!;
    }
    pt.p.set(x, y, z);
    pt.v.set(vx, vy, vz);
    pt.age = 0;
    pt.maxAge = Math.max(0.05, maxAge);
    pt.startScale = startScale;
    pt.endScale = endScale;
    pt.rot = Math.random() * Math.PI * 2;
    pt.spin = (Math.random() - 0.5) * 1.35;
    pt.baseOpacity = baseOpacity;
    pt.windMul = windMul;
    pt.buoyancy = buoyancy;
    pt.drag = drag;
    _ptColor.setHex(colorHex);
    pt.r = _ptColor.r;
    pt.g = _ptColor.g;
    pt.b = _ptColor.b;
    if (endColorHex !== undefined) {
      _ptColor.setHex(endColorHex);
      pt.endR = _ptColor.r;
      pt.endG = _ptColor.g;
      pt.endB = _ptColor.b;
    } else {
      pt.endR = pt.r;
      pt.endG = pt.g;
      pt.endB = pt.b;
    }
    this.smokeActive.push(pt);
  }

  private spawnFire(
    kind: 'fire' | 'flash' | 'spark',
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    maxAge: number,
    baseOpacity = 1.0,
    thermalRamp = false,
    buoyancy = 0,
    gravity = 0,
    drag = 1.5,
    emitsSmoke = false,
    bounceSound = false
  ): void {
    let pt = this.fireFree.pop();
    if (!pt) {
      if (this.fireActive.length === 0) return;
      pt = this.fireActive.shift()!;
    }
    pt.kind = kind;
    pt.p.set(x, y, z);
    pt.v.set(vx, vy, vz);
    pt.age = 0;
    pt.maxAge = Math.max(0.04, maxAge);
    pt.startScale = startScale;
    pt.endScale = endScale;
    pt.rot = Math.random() * Math.PI * 2;
    pt.spin = kind === 'spark' ? (Math.random() - 0.5) * 6.0 : (Math.random() - 0.5) * 2.2;
    pt.baseOpacity = baseOpacity;
    _ptColor.setHex(colorHex);
    pt.r = _ptColor.r;
    pt.g = _ptColor.g;
    pt.b = _ptColor.b;
    pt.thermalRamp = thermalRamp;
    pt.buoyancy = buoyancy;
    pt.gravity = gravity;
    pt.drag = drag;
    pt.emitsSmoke = emitsSmoke;
    pt.smokeTrailTimer = Math.random() * 0.035;
    pt.bounceSound = bounceSound;
    this.fireActive.push(pt);
  }

  private spawnRing(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    maxAge: number,
    baseOpacity = 0.85
  ): void {
    let pt = this.ringFree.pop();
    if (!pt) {
      if (this.ringActive.length === 0) return;
      pt = this.ringActive.shift()!;
    }
    pt.p.set(x, y, z);
    pt.v.set(vx, vy, vz);
    pt.age = 0;
    pt.maxAge = Math.max(0.08, maxAge);
    pt.startScale = startScale;
    pt.endScale = endScale;
    _ptColor.setHex(colorHex);
    pt.r = _ptColor.r;
    pt.g = _ptColor.g;
    pt.b = _ptColor.b;
    pt.baseOpacity = baseOpacity;
    this.ringActive.push(pt);
  }

  private spawnParticle(
    kind: 'fire' | 'smoke' | 'spark' | 'ring',
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    startScale: number,
    endScale: number,
    maxAge: number
  ): void {
    if (kind === 'smoke') {
      this.spawnSmoke(x, y, z, vx, vy, vz, color, startScale, endScale, maxAge, 0.54, 0.72, 1.5, 1.4);
    } else if (kind === 'ring') {
      this.spawnRing(x, y, z, vx, vy, vz, color, startScale, endScale, maxAge, 0.78);
    } else if (kind === 'spark') {
      this.spawnFire('spark', x, y, z, vx, vy, vz, color, startScale * 1.45, endScale * 1.2, maxAge, 0.98, false, 0, 24, 0.8, false, true);
    } else {
      this.spawnFire('fire', x, y, z, vx, vy, vz, color, startScale * 1.3, endScale * 1.2, maxAge, 0.92, false, 2.5, 0, 1.5, false, false);
    }
  }

  private spawnScrapeSparks(
    pos: THREE.Vector3,
    intensity = 0.6,
    normal?: THREE.Vector3,
    surface: ScrapeSurface = 'building',
    speedMs = 30,
    forceImpact = false
  ): void {
    const nx = normal ? normal.x : 0;
    const ny = normal ? normal.y : 1;
    const nz = normal ? normal.z : 0;
    const count = intensity > 0.78 ? 10 : intensity > 0.45 ? 6 : 3;
    const speedBoost = 10 + intensity * 24;
    for (let i = 0; i < count; i++) {
      const spreadX = (Math.random() - 0.5) * speedBoost;
      const spreadY = 3 + Math.random() * speedBoost * 0.7;
      const spreadZ = (Math.random() - 0.5) * speedBoost;
      const color = i % 3 === 0 ? 0xfef9c3 : i % 3 === 1 ? 0xfacc15 : 0xf97316;
      this.spawnParticle(
        'spark',
        pos.x + (Math.random() - 0.5) * 1.1,
        pos.y + Math.random() * 0.45,
        pos.z + (Math.random() - 0.5) * 1.1,
        nx * speedBoost * 0.65 + spreadX,
        Math.max(1.5, ny * speedBoost * 0.55 + spreadY),
        nz * speedBoost * 0.65 + spreadZ,
        color,
        0.26 + intensity * 0.16,
        0.05,
        0.28 + Math.random() * 0.24
      );
    }
    if (intensity > 0.55) {
      this.spawnParticle(
        'smoke',
        pos.x + (Math.random() - 0.5) * 1.4,
        pos.y + 0.35,
        pos.z + (Math.random() - 0.5) * 1.4,
        nx * 4 + (Math.random() - 0.5) * 4,
        2.5 + Math.random() * 3.5,
        nz * 4 + (Math.random() - 0.5) * 4,
        0x64748b,
        0.85,
        3.8,
        0.72 + Math.random() * 0.3
      );
    }

    const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(pos);
    const distScale = THREE.MathUtils.clamp(1 - camDist / 1600, 0.15, 1);

    if (speedMs > 4) {
      this.scrapeContactIntensity = Math.max(this.scrapeContactIntensity, intensity);
      this.scrapeContactSpeed = Math.max(this.scrapeContactSpeed, speedMs);
      this.scrapeContactSurface = surface;
      this.scrapeContactDistScale = Math.max(this.scrapeContactDistScale, distScale);
      this.scrapeContactTimeout = 0.12;
    }

    if (forceImpact || this.scrapeAudioTimer <= 0) {
      this.scrapeAudioTimer = forceImpact ? 0.085 : 0.115;
      this.audio.playMetallicImpact(intensity, surface, speedMs, distScale);
    } else {
      this.audio.playSparkCrackle(intensity, count, distScale);
    }
  }

  private spawnTireSmoke(
    pos: THREE.Vector3,
    intensity = 0.7,
    force = false,
    speedMs = 45
  ): void {
    if (!force && this.tireSmokeTimer > 0) return;
    if (!force) this.tireSmokeTimer = 0.045;
    const count = force ? 4 : 2;
    for (let i = 0; i < count; i++) {
      this.spawnSmoke(
        pos.x + (Math.random() - 0.5) * 1.6,
        pos.y + 0.2 + Math.random() * 0.25,
        pos.z + (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * (3 + intensity * 4),
        1.1 + Math.random() * (2.2 + intensity * 2.4),
        (Math.random() - 0.5) * (3 + intensity * 4),
        i % 2 === 0 ? 0xe2e8f0 : 0xcbd5e1,
        0.75 + intensity * 0.55,
        3.6 + intensity * 2.8,
        0.65 + Math.random() * 0.4,
        0.46,
        0.95,
        1.2,
        1.8
      );
    }
    if (force || intensity > 0.48) {
      const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(pos);
      const distScale = THREE.MathUtils.clamp(1 - camDist / 1400, 0.18, 1);
      this.audio.playTireScreech(intensity, speedMs, distScale);
    }
  }

  private spawnGroundCrater(x: number, z: number, diameter = 35): void {
    const landY = groundHeightAt(x, z);
    if (landY < -0.25) return; // Only persist charred earth decals on solid land/terrain

    const hL = groundHeightAt(x - 4, z);
    const hR = groundHeightAt(x + 4, z);
    const hD = groundHeightAt(x, z - 4);
    const hU = groundHeightAt(x, z + 4);
    _a.set(hL - hR, 8.0, hD - hU).normalize();
    _q.setFromUnitVectors(_up, _a);
    _dq.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    _q.multiply(_dq);

    const pos = new THREE.Vector3(x, landY + 0.16, z);
    if (this.craters.length < FlightEngine.CRATER_CAP) {
      this.craters.push({
        p: pos,
        q: _q.clone(),
        scale: diameter,
        smokeAge: 0,
        smokeTimer: 0.05,
      });
    } else {
      const slot = this.craters[this.craterWriteIdx];
      slot.p.copy(pos);
      slot.q.copy(_q);
      slot.scale = diameter;
      slot.smokeAge = 0;
      slot.smokeTimer = 0.05;
      this.craterWriteIdx = (this.craterWriteIdx + 1) % FlightEngine.CRATER_CAP;
    }
    this.cratersDirty = true;
  }

  private spawnExplosion(pos: THREE.Vector3, scale = 1, isHeavyBomb = false): void {
    const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(pos);
    const distScale = THREE.MathUtils.clamp(1 - camDist / 4200, 0.14, 1);

    if (isHeavyBomb) {
      this.audio.playBombExplosion(distScale, camDist);
      const shakeProximity = THREE.MathUtils.clamp(1 - camDist / 2400, 0, 1);
      if (shakeProximity > 0.01) {
        this.camShake = Math.max(this.camShake, shakeProximity * shakeProximity * 2.85);
      }
    } else {
      this.audio.playExplosion(distScale, camDist);
      const shakeProximity = THREE.MathUtils.clamp(1 - camDist / 1600, 0, 1);
      if (shakeProximity > 0.01) {
        this.camShake = Math.max(this.camShake, shakeProximity * shakeProximity * 1.65 * scale);
      }
    }

    const fScale = isHeavyBomb ? scale * 2.4 : scale;

    // Stage 1: Core Flash & Expanding Shockwave Ring (80m ground dust shockwave ring on bomb impact)
    this.spawnFire('flash', pos.x, pos.y + 0.5, pos.z, 0, 1.5, 0, 0xfffbeb, 2.6 * fScale, 20.0 * fScale, isHeavyBomb ? 0.28 : 0.18, 1.0, false, 0, 0, 1.0, false, false);
    this.spawnFire('flash', pos.x, pos.y + 0.8, pos.z, 0, 2.2, 0, 0xfde047, 2.0 * fScale, 14.0 * fScale, isHeavyBomb ? 0.42 : 0.28, 0.94, false, 1.5, 0, 1.2, false, false);
    this.spawnRing(
      pos.x,
      Math.max(pos.y, groundHeightAt(pos.x, pos.z) + 0.55),
      pos.z,
      0,
      0.15,
      0,
      isHeavyBomb ? 0xd6b88d : 0xfed7aa,
      isHeavyBomb ? 4.0 : 2.2 * scale,
      isHeavyBomb ? 80.0 : 44 * scale,
      isHeavyBomb ? 0.92 : 0.56,
      isHeavyBomb ? 0.95 : 0.88
    );
    if (isHeavyBomb) {
      this.spawnRing(
        pos.x,
        Math.max(pos.y, groundHeightAt(pos.x, pos.z) + 0.85),
        pos.z,
        0,
        0.35,
        0,
        0xfdba74,
        3.2,
        56.0,
        0.68,
        0.9
      );
    }

    // Stage 2: Boiling Fireball (overlapping additive sprites with thermal white->orange->crimson->soot ramp)
    const fireCount = isHeavyBomb ? 20 : 15;
    for (let i = 0; i < fireCount; i++) {
      const ang = (i / fireCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const radial = (0.35 + Math.random() * 0.65) * 16 * fScale;
      const rise = 6 + Math.random() * 18 * fScale;
      this.spawnFire(
        'fire',
        pos.x + (Math.random() - 0.5) * 2.8 * fScale,
        pos.y + Math.random() * 2.4 * fScale,
        pos.z + (Math.random() - 0.5) * 2.8 * fScale,
        Math.cos(ang) * radial,
        rise,
        Math.sin(ang) * radial,
        0xfffbeb,
        (2.0 + Math.random() * 1.6) * fScale,
        (9.5 + Math.random() * 6.5) * fScale,
        (isHeavyBomb ? 1.15 : 0.72) + Math.random() * 0.55,
        0.96,
        true,
        7.5 + Math.random() * 6.5,
        0,
        1.75,
        false,
        false
      );
    }

    // Stage 3: Flying Burning Debris & Sparks (glowing shrapnel particles leaving thin dark smoke trails)
    const debrisCount = isHeavyBomb ? 40 : 32;
    for (let i = 0; i < debrisCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (14 + Math.random() * 34) * (isHeavyBomb ? 1.65 : scale);
      const vy = (12 + Math.random() * 32) * (isHeavyBomb ? 1.65 : scale);
      const sparkColor = i % 3 === 0 ? 0xfffbeb : i % 3 === 1 ? 0xfbbf24 : 0xf97316;
      this.spawnFire(
        'spark',
        pos.x + (Math.random() - 0.5) * 2.8 * scale,
        pos.y + 0.5 + Math.random() * 1.8 * scale,
        pos.z + (Math.random() - 0.5) * 2.8 * scale,
        Math.cos(ang) * spd,
        vy,
        Math.sin(ang) * spd,
        sparkColor,
        (0.6 + Math.random() * 0.5) * (isHeavyBomb ? 1.65 : Math.min(1.8, scale)),
        0.18,
        (isHeavyBomb ? 1.15 : 0.85) + Math.random() * 0.8,
        1.0,
        false,
        0,
        24,
        0.45,
        true,
        false
      );
    }

    // Stage 4: Lingering Heavy Black Smoke Plume & Ground Dust Billows
    const smokeCount = isHeavyBomb ? 20 : 14;
    for (let i = 0; i < smokeCount; i++) {
      const frac = i / smokeCount;
      const ang = Math.random() * Math.PI * 2;
      const isDustRing = isHeavyBomb && i < 6;
      const spread = isDustRing ? 22 + Math.random() * 16 : (1.5 + Math.random() * 8.0) * fScale;
      const startColor = isDustRing
        ? 0x78716c
        : i % 3 === 0
          ? 0x334155
          : i % 3 === 1
            ? 0x1e293b
            : 0x111827;
      this.spawnSmoke(
        pos.x + (Math.random() - 0.5) * 5.0 * fScale,
        pos.y + (isDustRing ? 1.0 : 0.8 + frac * 4.5 * fScale),
        pos.z + (Math.random() - 0.5) * 5.0 * fScale,
        Math.cos(ang) * spread,
        isDustRing ? 2.5 + Math.random() * 4.0 : 6.0 + frac * 12.0 * fScale + Math.random() * 5.0,
        Math.sin(ang) * spread,
        startColor,
        (3.2 + Math.random() * 1.8) * (isDustRing ? 2.2 : fScale),
        (15.0 + Math.random() * 11.0) * (isDustRing ? 2.4 : fScale),
        (isDustRing ? 2.6 : 4.3) + Math.random() * 1.4,
        isDustRing ? 0.58 : 0.78,
        1.05,
        isDustRing ? 1.2 : 3.6 + Math.random() * 2.2,
        1.15,
        isDustRing ? 0x57534e : 0x0b0f17
      );
    }
  }

  private getBossCenterPos(out: THREE.Vector3): THREE.Vector3 {
    const heightOffset = this.boss.mode === 'mech' ? 14.5 : 2.5;
    return out.set(this.boss.p.x, this.boss.p.y + heightOffset, this.boss.p.z);
  }

  private isBossTargetable(): boolean {
    return (
      this.boss.phase === 'transform' ||
      this.boss.phase === 'mech' ||
      this.boss.phase === 'jet'
    );
  }

  private findLockTarget(): AircraftInstance | null {
    this.boss.lockedByPlayer = false;
    if (this.mode !== 'fly' || !this.cur.config.hasMissiles || this.cur.crash > 0) return null;
    _fwd.set(0, 0, -1).applyQuaternion(this.cur.q);
    let best: AircraftInstance | null = null;
    let bestScore = -Infinity;

    for (const a of this.aircraft) {
      if (a === this.cur || a.crash > 0 || a.abandoned) continue;
      _c.copy(a.p).sub(this.cur.p);
      const dist = _c.length();
      if (dist < 15 || dist > 3200) continue;
      _c.divideScalar(dist);
      const dot = _fwd.dot(_c);
      if (dot < 0.74) continue;
      const score = dot * 2.0 - dist / 3200 + (a.ai ? 0.45 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }

    if (this.isBossTargetable()) {
      this.getBossCenterPos(_bossCenterPos);
      _c.copy(_bossCenterPos).sub(this.cur.p);
      const dist = _c.length();
      if (dist >= 25 && dist <= 4500) {
        _c.divideScalar(dist);
        const dot = _fwd.dot(_c);
        if (dot >= 0.7) {
          const bossScore = dot * 2.2 - dist / 4500 + 0.75;
          if (bossScore > bestScore) {
            this.boss.lockedByPlayer = true;
            return null;
          }
        }
      }
    }
    return best;
  }

  public fireMissile(): void {
    if (this.phase !== 'playing' || this.mode !== 'fly' || this.boarding) return;
    if (!this.cur.config.hasMissiles || this.cur.crash > 0 || this.missileCooldown > 0) return;

    const slot = this.missiles.find((m) => !m.active);
    if (!slot) return;

    this.audio.unlock();
    this.missileCooldown = 2.0;
    this.missileSide *= -1;
    const target = this.findLockTarget();
    const lockBoss = this.boss.lockedByPlayer && this.isBossTargetable();

    // Mount directly on alternating underwing pylon
    const wingOff = Math.min(4.2, this.cur.config.hx * 0.42) * this.missileSide;
    slot.railSide = this.missileSide;
    slot.railOffset.set(wingOff, -0.72, 0.25);

    _a.copy(slot.railOffset).applyQuaternion(this.cur.q).add(this.cur.p);
    _noseDir.copy(LOCAL_FWD).applyQuaternion(this.cur.q).normalize();
    const fwdVel = Math.max(40, this.cur.v.dot(_noseDir));

    slot.active = true;
    slot.owner = this.cur;
    slot.target = lockBoss ? null : target;
    slot.targetBoss = lockBoss;
    slot.flareTarget = null;
    slot.age = 0;
    slot.smokeTimer = 0;
    slot.ignited = false;
    slot.launchSpeed = fwdVel;
    slot.p.copy(_a);
    slot.v.copy(this.cur.v).addScaledVector(_noseDir, 24);
    slot.q.copy(this.cur.q);
    slot.mesh.position.copy(slot.p).sub(this.renderOrigin);
    slot.mesh.quaternion.copy(slot.q);
    slot.plume.visible = false; // Ignites after 0.18s rail-slide & drop
    slot.mesh.visible = true;

    // Asymmetric airframe recoil impulse from sudden wing weapon detachment
    this.cur.w.z += this.missileSide * 0.04;
    this.cur.w.x += 0.025;

    this.audio.playMissileLaunch(1, 0);
  }

  public deployFlares(): void {
    if (this.phase !== 'playing' || this.mode !== 'fly' || this.boarding) return;
    if (this.cur.crash > 0 || this.flareCooldown > 0 || this.flaresCount <= 0) return;

    this.audio.unlock();
    const burst = Math.min(4, this.flaresCount);
    let firstFlare: FlareInstance | null = null;
    _fwd.set(0, 0, -1).applyQuaternion(this.cur.q);

    for (let i = 0; i < burst; i++) {
      const fl = this.flares.find((f) => !f.active);
      if (!fl) break;
      const side = i % 2 === 0 ? -1 : 1;
      const spreadX = side * (3.2 + i * 0.8);
      _a.set(side * 1.4, -0.7, 2.0).applyQuaternion(this.cur.q).add(this.cur.p);
      _b.set(spreadX * 8, -9 - i * 2.5, 16).applyQuaternion(this.cur.q);

      fl.active = true;
      fl.age = 0;
      fl.maxAge = 3.2 + Math.random() * 0.6;
      fl.smokeTimer = 0;
      fl.p.copy(_a);
      fl.v.copy(this.cur.v).multiplyScalar(0.82).add(_b);
      fl.mesh.position.copy(fl.p).sub(this.renderOrigin);
      (fl.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      fl.mesh.scale.setScalar(1.1);
      fl.mesh.visible = true;
      if (!firstFlare) firstFlare = fl;
    }

    if (!firstFlare) return;
    this.flaresCount = Math.max(0, this.flaresCount - 1);
    this.flareCooldown = 1.4;
    this.audio.playFlareDeploy();

    // Lure active missiles targeting the player aircraft
    for (const m of this.missiles) {
      if (m.active && m.target === this.cur && !m.flareTarget) {
        if (m.p.distanceTo(this.cur.p) < 1800) {
          m.flareTarget = firstFlare;
          m.target = null;
        }
      }
    }
  }

  public toggleTailhook(): void {
    if (this.phase !== 'playing' || this.mode !== 'fly' || this.boarding) return;
    if (this.cur.crash > 0) return;
    this.audio.unlock();
    this.tailhookDown = !this.tailhookDown;
    this.audio.playTone(this.tailhookDown ? 185 : 240, 0.09, 'triangle', 0.14);
  }

  public toggleAutoLevel(): void {
    this.autoLevel = !this.autoLevel;
    this.audio.playTone(this.autoLevel ? 520 : 340, 0.08, 'triangle', 0.12);
    this.emitHud();
  }

  public selectMission(id: MissionId): void {
    this.missionMgr.selectMission(id);
    this.emitHud();
  }

  public cycleMission(): void {
    this.missionMgr.cycleMission();
    this.emitHud();
  }

  public dropBomb(): void {
    if (this.phase !== 'playing' || this.mode !== 'fly' || this.boarding) return;
    if (!this.cur.config.hasBombs || this.cur.crash > 0 || this.bombCooldown > 0) return;

    const releaseCount =
      this.cur.config.id === 'b2' ||
      this.cur.config.id === 'f117' ||
      this.cur.config.id === 'a10' ||
      this.cur.config.id === 'hercules'
        ? 2
        : 1;
    let dropped = 0;
    this.audio.unlock();

    for (let i = 0; i < releaseCount; i++) {
      const slot = this.bombs.find((b) => !b.active);
      if (!slot) break;
      this.bombSide *= -1;
      const latOff = releaseCount > 1 ? this.bombSide * Math.min(2.2, this.cur.config.hx * 0.2) : 0;
      const zOff = i === 1 ? 1.4 : 0.2;
      _a.set(latOff, -1.05, zOff).applyQuaternion(this.cur.q).add(this.cur.p);
      _b.set(0, -2.6 - i * 1.1, 0).applyQuaternion(this.cur.q);

      slot.active = true;
      slot.owner = this.cur;
      slot.age = 0;
      slot.whistleTriggered = false;
      slot.p.copy(_a);
      // Inherit exact aircraft velocity plus downward ejector impulse
      slot.v.copy(this.cur.v).add(_b);
      slot.q.copy(this.cur.q);
      slot.mesh.position.copy(slot.p).sub(this.renderOrigin);
      slot.mesh.quaternion.copy(slot.q);
      slot.mesh.visible = true;
      dropped++;

      if (latOff !== 0) {
        this.cur.w.z += Math.sign(latOff) * 0.04;
      }
      this.cur.w.x += 0.04;
    }

    if (dropped > 0) {
      this.bombCooldown = 1.6;
      this.audio.playBombDrop();
    }
  }

  public deployParachute(): void {
    if (this.phase !== 'playing' || this.mode !== 'skydive' || this.parachuteOpen) return;
    this.parachuteOpen = true;
    this.chuteInflate = 0.12;
    this.audio.playParachuteOpen();
    this.say('chute', 'فتح المظلة', 'تم فتح المظلة! W للغوص، A/D للالتفاف، وS لفرملة الهبوط بسلاسة.', 4, true);
  }

  public setPerformanceMode(fast: boolean): void {
    if (this.isSoftwareGl) return;
    this.renderer.shadowMap.enabled = !fast;
    this.sun.castShadow = !fast;
    const maxDpr = this.isTouchGpu ? 1.15 : 1.35;
    this.renderer.setPixelRatio(fast ? 1 : Math.min(window.devicePixelRatio, maxDpr));
    this.onResize();
  }

  public setMinimapCanvas(canvas: HTMLCanvasElement | null): void {
    this.minimapCanvas = canvas;
  }

  public setMapExpanded(expanded: boolean): void {
    this.mapBig = expanded;
    if (this.minimapCanvas) {
      this.minimapCanvas.width = expanded ? 560 : 280;
      this.minimapCanvas.height = expanded ? 560 : 280;
    }
  }

  public cycleMapZoom(): void {
    this.mapZoomIdx = (this.mapZoomIdx + 1) % 3;
  }

  private updateSkyEnvironment(tod: TimeOfDay): void {
    this.envDomeMat.uniforms.uTopColor.value.copy(this.world.skyUniforms.uTopColor.value);
    this.envDomeMat.uniforms.uHorizonColor.value.copy(this.world.skyUniforms.uHorizonColor.value);
    this.envDomeMat.uniforms.uSunDir.value.copy(this.world.skyUniforms.uSunDir.value);
    this.envDomeMat.uniforms.uSunColor.value.copy(this.world.skyUniforms.uSunColor.value);
    const groundHex =
      tod === 'night' ? 0x050914 : tod === 'dawn' || tod === 'dusk' ? 0x1d1b24 : 0x2a3826;
    this.envDomeMat.uniforms.uGroundColor.value.setHex(groundHex);

    const nextTarget = this.pmremGenerator.fromScene(this.envScene, 0.035);
    this.scene.environment = nextTarget.texture;
    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
    }
    this.envRenderTarget = nextTarget;
  }

  public selectLobbyAircraft(id: AircraftId): void {
    this.selectedLobbyId = id;
    const found = this.aircraft.find((a) => a.config.id === id);
    if (found) {
      this.cur = found;
      this.syncCamAnchor();
      this.camZoom = 1;
      this.camZoomTarget = 1;
      this.wingtipTrails?.forEach((t) => t.clear());
    }
  }

  public setTimeOfDay(tod: TimeOfDay): void {
    this.timeOfDay = tod;
    this.world.applyTimeOfDay(tod, this.scene, this.sun, this.hemi);
    if (tod === 'night') {
      this.fillLight.color.setHex(0x475569);
      this.fillLight.intensity = 0.22;
      this.fillLight.position.set(-220, 180, 240);
    } else if (tod === 'dawn' || tod === 'dusk') {
      this.fillLight.color.setHex(0x7dd3fc);
      this.fillLight.intensity = 0.3;
      this.fillLight.position.set(tod === 'dawn' ? -320 : 320, 160, 220);
    } else {
      this.fillLight.color.setHex(0x93c5fd);
      this.fillLight.intensity = 0.34;
      this.fillLight.position.set(-280, 180, -240);
    }
    this.world.applyWeather(
      this.weatherFogMul,
      this.weatherCloudScale,
      this.weatherOvercast,
      this.weatherWindVec.x,
      this.weatherWindVec.z,
      0,
      this.elapsed,
      this.scene,
      this.sun,
      this.hemi
    );
    this.updateSkyEnvironment(tod);
  }

  private pickRandomWeather(initial = false): void {
    const pool: WeatherCondition[] = ['clear', 'breezy', 'foggy', 'storm'];
    let next: WeatherCondition;
    if (initial) {
      next = Math.random() < 0.6 ? 'clear' : 'breezy';
    } else {
      const others = pool.filter((w) => w !== this.weatherCondition);
      next = others[Math.floor(Math.random() * others.length)];
    }
    this.weatherCondition = next;
    this.weatherTimer = 28 + Math.random() * 24;

    const angle = Math.random() * Math.PI * 2;
    let spd = 4;
    if (next === 'clear') {
      spd = 3 + Math.random() * 4.5;
      this.weatherTargetFogMul = 0.92 + Math.random() * 0.22;
      this.weatherTargetCloudScale = 0.8 + Math.random() * 0.16;
      this.weatherTargetOvercast = 0.04 + Math.random() * 0.08;
      this.weatherTargetTurbulence = 0.06 + Math.random() * 0.09;
    } else if (next === 'breezy') {
      spd = 12.5 + Math.random() * 8.5;
      this.weatherTargetFogMul = 1.25 + Math.random() * 0.35;
      this.weatherTargetCloudScale = 1.02 + Math.random() * 0.16;
      this.weatherTargetOvercast = 0.22 + Math.random() * 0.16;
      this.weatherTargetTurbulence = 0.36 + Math.random() * 0.18;
    } else if (next === 'foggy') {
      spd = 6 + Math.random() * 5.5;
      this.weatherTargetFogMul = 2.85 + Math.random() * 0.95;
      this.weatherTargetCloudScale = 1.18 + Math.random() * 0.16;
      this.weatherTargetOvercast = 0.58 + Math.random() * 0.2;
      this.weatherTargetTurbulence = 0.26 + Math.random() * 0.16;
    } else {
      spd = 21 + Math.random() * 11;
      this.weatherTargetFogMul = 2.15 + Math.random() * 0.6;
      this.weatherTargetCloudScale = 1.3 + Math.random() * 0.2;
      this.weatherTargetOvercast = 0.78 + Math.random() * 0.17;
      this.weatherTargetTurbulence = 0.76 + Math.random() * 0.24;
    }

    this.weatherTargetWind.set(Math.cos(angle) * spd, 0, Math.sin(angle) * spd);

    if (!initial && this.phase === 'playing') {
      const msgMap: Record<WeatherCondition, [string, string]> = {
        clear: ['صفاء الأجواء', 'تبددت الغيوم وعادت السماء صافية والرياح هادئة.'],
        breezy: ['رياح جانبية نشطة', 'هبات رياح متغيرة! انتبه لانجراف الطائرة أثناء المناورة والهبوط.'],
        foggy: ['ضباب كثيف', 'موجة ضباب كثيف تغطي المنطقة وتنخفض الرؤية الأفقية.'],
        storm: ['عاصفة جوية', 'تحذير جوي: عاصفة هوائية قوية واضطرابات جوية تؤثر على استقرار الطائرة!'],
      };
      const [lbl, txt] = msgMap[next];
      this.say(`wx_${next}`, lbl, txt, 12, false);
    }
  }

  private stepWeather(dt: number): void {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.pickRandomWeather(false);
    }

    const blend = 1 - Math.exp(-0.24 * dt);
    this.weatherWindVec.lerp(this.weatherTargetWind, blend);
    this.weatherFogMul += (this.weatherTargetFogMul - this.weatherFogMul) * blend;
    this.weatherCloudScale += (this.weatherTargetCloudScale - this.weatherCloudScale) * blend;
    this.weatherOvercast += (this.weatherTargetOvercast - this.weatherOvercast) * blend;
    this.weatherTurbulence += (this.weatherTargetTurbulence - this.weatherTurbulence) * blend;

    // Multi-harmonic turbulent wind gusts (zero GC)
    const t = this.elapsed;
    const gustAmp = 1.5 + this.weatherTurbulence * 11.5;
    this.weatherGustVec.set(
      (Math.sin(t * 1.15) * 0.6 + Math.sin(t * 2.7 + 1.3) * 0.4) * gustAmp,
      (Math.sin(t * 1.85 + 0.7) * 0.55 + Math.cos(t * 3.4) * 0.45) * (0.8 + this.weatherTurbulence * 6.5),
      (Math.cos(t * 1.05 + 2.1) * 0.6 + Math.sin(t * 2.4) * 0.4) * gustAmp
    );

    this.world.applyWeather(
      this.weatherFogMul + this.boss.stormBlend * 1.45,
      this.weatherCloudScale + this.boss.stormBlend * 0.45,
      Math.max(this.weatherOvercast, this.boss.stormBlend * 0.96),
      this.weatherWindVec.x + this.weatherGustVec.x * 0.4,
      this.weatherWindVec.z + this.weatherGustVec.z * 0.4,
      dt,
      this.elapsed,
      this.scene,
      this.sun,
      this.hemi
    );

    if (this.boss.stormBlend > 0.005) {
      const sb = this.boss.stormBlend;
      this.world.skyUniforms.uTopColor.value.lerp(_bossStormTop, sb * 0.92);
      this.world.skyUniforms.uHorizonColor.value.lerp(_bossStormHor, sb * 0.9);
      this.world.cloudUniforms.uTopColor.value.lerp(_bossStormCloudTop, sb * 0.88);
      this.world.cloudUniforms.uShadowColor.value.lerp(_bossStormCloudShadow, sb * 0.92);
      this.world.cloudUniforms.uFogColor.value.copy(this.world.skyUniforms.uHorizonColor.value);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(this.world.skyUniforms.uHorizonColor.value);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.world.skyUniforms.uHorizonColor.value);
        this.scene.fog.density *= 1 + sb * 0.55;
      }
      this.sun.intensity *= 1 - sb * 0.52;
      this.hemi.intensity *= 1 - sb * 0.25;
    }

    // Visual airborne mist / wind-gust streaks streaming past the aircraft
    if (this.weatherStreakTimer > 0) {
      this.weatherStreakTimer = Math.max(0, this.weatherStreakTimer - dt);
    }
    if (
      this.phase === 'playing' &&
      this.mode === 'fly' &&
      !this.boarding &&
      !this.cur.ground &&
      this.cur.crash <= 0 &&
      this.cur.fwd > 22 &&
      (this.weatherTurbulence > 0.25 || this.weatherFogMul > 1.7) &&
      this.weatherStreakTimer <= 0
    ) {
      this.weatherStreakTimer = this.weatherTurbulence > 0.6 ? 0.065 : 0.12;
      _a.copy(LOCAL_FWD).applyQuaternion(this.cur.q);
      const ahead = 24 + Math.random() * 18;
      const spreadX = (Math.random() - 0.5) * 26;
      const spreadY = (Math.random() - 0.5) * 14;
      const spreadZ = (Math.random() - 0.5) * 26;
      this.spawnParticle(
        'smoke',
        this.cur.p.x + _a.x * ahead + spreadX,
        this.cur.p.y + _a.y * ahead + spreadY,
        this.cur.p.z + _a.z * ahead + spreadZ,
        this.weatherWindVec.x * 1.35 + this.weatherGustVec.x * 0.7,
        this.weatherGustVec.y * 0.4,
        this.weatherWindVec.z * 1.35 + this.weatherGustVec.z * 0.7,
        this.weatherCondition === 'storm' ? 0x94a3b8 : 0xe2e8f0,
        0.45,
        2.1 + this.weatherTurbulence * 1.4,
        0.34 + Math.random() * 0.2
      );
    }
  }

  public startFromLobby(aircraftId: AircraftId, spawnMode: SpawnMode): void {
    this.audio.unlock();
    this.resetAll(false);
    this.selectedLobbyId = aircraftId;
    const chosen = this.aircraft.find((a) => a.config.id === aircraftId) || this.aircraft[0];
    this.cur = chosen;
    this.syncCamAnchor();
    this.renderOrigin.set(0, 0, 0);
    this.world.root.position.set(0, 0, 0);
    this.world.setOceanOrigin(0, 0);
    this.world.oceanMesh.position.set(0, -0.45, 0);
    this.world.root.updateMatrixWorld(true);
    this.phase = 'playing';

    if (spawnMode === 'cockpit') {
      const staticSag = chosen.config.aero.gearMaxTravelM * 0.35;
      chosen.p.set(0, chosen.config.y0 - staticSag, 140);
      chosen.prevP.copy(chosen.p);
      chosen.renderP.copy(chosen.p);
      chosen.q.identity();
      chosen.prevQ.copy(chosen.q);
      chosen.renderQ.copy(chosen.q);
      chosen.v.set(0, 0, 0);
      chosen.w.set(0, 0, 0);
      this.resetAircraftDamage(chosen);
      chosen.thr = 0;
      chosen.spool = 0;
      chosen.tas = 0;
      chosen.fwd = 0;
      chosen.aoa = 0;
      chosen.liftLoadG = 1;
      chosen.ground = true;
      this.gForce = 1;
      this.physAccum = 0;
      this.sq.copy(chosen.q);
      this.mode = 'fly';
      this.cameraMode = 'chase';
      this.flyYaw = 0;
      this.flyYawTarget = 0;
      this.flyPitch = 0;
      this.flyPitchTarget = 0;
      this.flyIdle = 0;
      this.camZoom = 1;
      this.camZoomTarget = 1;
      this.camGroundLift = 0;
      this.camLocalLag.set(chosen.config.cam[0], chosen.config.cam[1], chosen.config.cam[2]);
      this.camRelOffset.copy(this.camLocalLag);
      this.camLookRel.set(0, 0.55, -chosen.config.cam[2] * 1.45);
      this.cam.position.copy(chosen.p).add(this.camRelOffset);
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(0, chosen.config.y0 + 0.55, 140 - chosen.config.cam[2] * 1.45);
      this.say(
        'start',
        'اللاعب بدأ الرحلة على المدرج الرئيسي',
        `مرحباً بك يا كابتن! ${chosen.config.nameAr} جاهزة للإقلاع على المدرج 36.`,
        0,
        true
      );
    } else {
      this.mode = 'walk';
      const offX = Math.min(6.5, chosen.config.board * 0.55);
      const offZ = Math.min(4.8, chosen.config.board * 0.42);
      const wx = chosen.p.x - offX;
      const wz = chosen.p.z + offZ;
      this.man.p.set(wx, Math.max(0, groundHeightAt(wx, wz)), wz);
      this.man.yaw = Math.atan2(-(chosen.p.x - this.man.p.x), -(chosen.p.z - this.man.p.z));
      this.camYaw = this.man.yaw;
      this.camYawTarget = this.man.yaw;
      this.camPitch = 0.34;
      this.camPitchTarget = 0.34;
      this.camZoom = 1;
      this.camZoomTarget = 1;
      this.camGroundLift = 0;
      const cp = Math.cos(this.camPitch);
      this.camRelOffset.set(
        Math.sin(this.camYaw) * cp * 5.2,
        Math.sin(this.camPitch) * 5.2 + 1.5,
        Math.cos(this.camYaw) * cp * 5.2
      );
      this.say(
        'greet',
        'اللاعب في ساحة المطار',
        'أهلاً بك في المطار! اقترب من أي طائرة واضغط F لمشهد الصعود إلى القمرة.',
        0,
        true
      );
    }
    this.emitHud();
  }

  public openLobby(): void {
    this.phase = 'lobby';
    this.resetAll(true);
    this.cur = this.aircraft.find((a) => a.config.id === this.selectedLobbyId) || this.aircraft[0];
    this.camZoom = 1;
    this.camZoomTarget = 1;
    this.lobbyFocusPos.copy(this.cur.p);
    this.audio.updateEngine(false, this.cur.config.id, 0, 0, false);
    this.audio.updateMetallicFriction(false);
    this.emitHud();
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase !== 'playing') {
      this.clearKeys();
      this.scrapeContactTimeout = 0;
      this.scrapeContactIntensity = 0;
      this.audio.updateEngine(false, this.cur.config.id, 0, 0, false);
      this.audio.updateMetallicFriction(false);
    }
    this.emitHud();
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'cockpit', 'orbit'];
    this.cameraMode = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.camGroundLift = 0;
    if (this.cameraMode === 'orbit') {
      _fwd.set(0, 0, -1).applyQuaternion(this.cur.q);
      const backYaw = Math.atan2(-_fwd.x, -_fwd.z);
      this.camYaw = backYaw;
      this.camYawTarget = backYaw;
      this.camPitch = 0.28;
      this.camPitchTarget = 0.28;
      const dist = this.cur.config.cam[2] * 1.2 * this.camZoom;
      const cp = Math.cos(this.camPitch);
      this.camRelOffset.set(
        Math.sin(this.camYaw) * cp * dist,
        Math.sin(this.camPitch) * dist + 1.5,
        Math.cos(this.camYaw) * cp * dist
      );
    } else if (this.cameraMode === 'chase') {
      this.sq.copy(this.cur.renderQ);
      this.flyYaw = 0;
      this.flyYawTarget = 0;
      this.flyPitch = 0;
      this.flyPitchTarget = 0;
      this.camLocalLag
        .set(this.cur.config.cam[0], this.cur.config.cam[1], this.cur.config.cam[2])
        .multiplyScalar(this.camZoom);
      this.camRelOffset.copy(this.camLocalLag).applyQuaternion(this.sq);
      this.camLookRel.set(0, 0.55, -this.cur.config.cam[2] * 1.45);
    }
    this.emitHud();
    return this.cameraMode;
  }

  public resetAll(keepSelected = true): void {
    for (const a of this.aircraft) {
      a.ai = null;
      a.abandoned = false;
      this.resetAircraftDamage(a);
      a.p.copy(a.spawn);
      a.prevP.copy(a.spawn);
      a.renderP.copy(a.spawn);
      a.q.setFromAxisAngle(_up, a.spawnYaw);
      a.prevQ.copy(a.q);
      a.renderQ.copy(a.q);
      a.v.set(0, 0, 0);
      a.w.set(0, 0, 0);
      a.thr = 0;
      a.spool = 0;
      a.tas = 0;
      a.fwd = 0;
      a.aoa = 0;
      a.liftLoadG = 1;
      a.crash = 0;
      a.ground = true;
      a.inp.p = 0;
      a.inp.r = 0;
      a.inp.y = 0;
      a.inp.brake = 0;
      const animState = this.animRigs.get(a);
      if (animState) {
        animState.gearAnim = 1;
        animState.ctrl.set(0, 0, 0);
        animState.decelAnim = 0;
      }
    }
    this.physAccum = 0;
    for (const m of this.missiles) {
      m.active = false;
      m.target = null;
      m.targetBoss = false;
      m.flareTarget = null;
      m.mesh.visible = false;
    }
    for (const fl of this.flares) {
      fl.active = false;
      fl.mesh.visible = false;
    }
    for (const bm of this.bombs) {
      bm.active = false;
      bm.mesh.visible = false;
    }
    for (const pb of this.bossPlasmaBolts) {
      pb.active = false;
      pb.mesh.visible = false;
    }
    this.boss.phase = 'idle';
    this.boss.mode = 'jet';
    this.boss.hp = this.boss.maxHp;
    this.boss.stormBlend = 0;
    this.boss.lockedByPlayer = false;
    this.boss.altitudeAutoTriggered = false;
    this.megatronRig.root.visible = false;
    this.bossWarningLaser.visible = false;
    for (const tg of this.world.targets) {
      tg.destroyed = false;
      this.world.setTargetVisible(tg.id, true);
    }
    while (this.smokeActive.length > 0) {
      this.smokeFree.push(this.smokeActive.pop()!);
    }
    this.smokeMesh.count = 0;
    while (this.fireActive.length > 0) {
      this.fireFree.push(this.fireActive.pop()!);
    }
    this.fireMesh.count = 0;
    while (this.ringActive.length > 0) {
      this.ringFree.push(this.ringActive.pop()!);
    }
    this.ringMesh.count = 0;
    this.craters.length = 0;
    this.craterWriteIdx = 0;
    this.cratersDirty = false;
    this.craterMesh.count = 0;
    if (!keepSelected) {
      this.cur = this.aircraft[0];
    }
    this.syncCamAnchor();
    this.renderOrigin.set(0, 0, 0);
    this.world.root.position.set(0, 0, 0);
    this.world.setOceanOrigin(0, 0);
    this.world.oceanMesh.position.set(0, -0.45, 0);
    this.world.root.updateMatrixWorld(true);
    this.sq.copy(this.cur.q);
    this.camLocalLag.set(this.cur.config.cam[0], this.cur.config.cam[1], this.cur.config.cam[2]);
    this.mode = 'walk';
    this.boarding = null;
    this.scrapeContactTimeout = 0;
    this.scrapeContactIntensity = 0;
    this.audio.updateMetallicFriction(false);
    this.bombCooldown = 0;
    this.missileCooldown = 0;
    this.flareCooldown = 0;
    this.flaresCount = 24;
    this.samiLockTimer = 0;
    this.samiMissileCooldown = 8.0;
    this.missileAlert = 'none';
    this.incomingMissileDistM = 0;
    this.tailhookDown = false;
    this.arrestedWireEngaged = false;
    this.arrestedWireTimer = 0;
    this.bolterWarningTimer = 0;
    this.carrierTrapCooldown = 0;
    this.fuelPct = 100;
    this.refuelAssist = false;
    this.refuelConnected = false;
    this.refuelProgress = 0;
    this.refuelHoseExtend = 0;
    this.refuelDockTimer = 0;
    this.refuelFullChimed = false;
    this.refuelDistanceM = 9999;
    this.gForce = 1.0;
    this.flapsActive = false;
    this.papiSlope = 'off';
    this.tireSmokeTimer = 0;
    this.missionMgr.reset();
    this.prevPlayerV.set(0, 0, 0);
    this.wasSupersonic = false;
    this.sonicBoomFlash = 0;
    this.flybyPrevClosing.clear();
    this.flybyPrevMach.clear();
    this.flybyBoomCooldown.clear();
    if (this.vaporCone) this.vaporCone.visible = false;
    this.wingtipTrails?.forEach((t) => t.clear());
    if (this.cockpitRig) this.cockpitRig.visible = false;
    this.parachuteOpen = false;
    this.chuteInflate = 0;
    this.skydiveBank = 0;
    this.diveRatio = 0;
    this.flareActive = false;
    this.walkSpeedRatio = 0;
    this.manM.g.scale.setScalar(1);
    this.man.p.set(...HOME_WALK_POS);
    this.man.vy = 0;
    this.manV.set(0, 0, 0);
    this.man.yaw = 0;
    this.camYaw = 0;
    this.camYawTarget = 0;
    this.camPitch = 0.34;
    this.camPitchTarget = 0.34;
    this.flyYaw = 0;
    this.flyYawTarget = 0;
    this.flyPitch = 0;
    this.flyPitchTarget = 0;
    this.camZoom = 1;
    this.camZoomTarget = 1;
    this.camGroundLift = 0;
    this.camShake = 0;
    this.npc.p.set(...HOME_NPC_POS);
    this.npc.st = 'idle';
    this.npc.ac = null;
    this.npc.seek = false;
    this.npc.rode = false;
    this.wasGround = true;
    this.plAir = false;
  }

  public resetToRunway(): void {
    this.startFromLobby(this.cur.config.id, this.mode === 'walk' ? 'walk' : 'cockpit');
  }

  public setVirtualKey(code: string, down: boolean): void {
    this.audio.unlock();
    this.keys[code] = down ? 1 : 0;
  }

  public setAnalog(x: number, y: number, on: boolean): void {
    this.audio.unlock();
    this.analog.x = x;
    this.analog.y = y;
    this.analog.on = on;
  }

  public setRudderAnalog(rud: number): void {
    this.analog.rud = rud;
  }

  public setTouchThrottle(thr: number): void {
    if (this.mode === 'fly') {
      this.cur.thr = THREE.MathUtils.clamp(thr, 0, 1);
    }
  }

  public toggleBoard(): void {
    if (this.phase !== 'playing' || this.boarding || (this.mode === 'fly' && this.cur.crash > 0)) return;
    this.audio.unlock();

    if (this.mode === 'walk') {
      const b = this.nearestAircraft();
      if (b) {
        // Glitch-free 3-stage Aircraft Boarding Cutscene
        b.v.set(0, 0, 0);
        b.w.set(0, 0, 0);
        const sideDir =
          _b.copy(this.man.p).sub(b.p).dot(_a.set(1, 0, 0).applyQuaternion(b.q)) >= 0 ? 1 : -1;

        const sideOffset = Math.min(Math.max(1.9, b.config.ex * 0.4), 3.4);
        const doorZ = b.config.cockpitOffset[2] + 0.75;
        const doorPos = new THREE.Vector3(sideDir * sideOffset, 0, doorZ).applyQuaternion(b.q).add(b.p);
        doorPos.y = Math.max(0, this.surfaceHeightAt(doorPos.x, doorPos.z, b.p.y + 1));

        const stepPos = new THREE.Vector3(
          sideDir * 0.9,
          b.config.cockpitOffset[1] + 0.18,
          b.config.cockpitOffset[2] + 0.15
        )
          .applyQuaternion(b.q)
          .add(b.p);

        const seatPos = new THREE.Vector3(
          b.config.cockpitOffset[0],
          b.config.cockpitOffset[1] - 0.65,
          b.config.cockpitOffset[2]
        )
          .applyQuaternion(b.q)
          .add(b.p);

        this.manV.set(0, 0, 0);
        this.man.vy = 0;
        this.boarding = {
          target: b,
          t: 0,
          duration: 1.35,
          startPos: this.man.p.clone(),
          doorPos,
          stepPos,
          seatPos,
        };
        this.audio.playTone(220, 0.14, 'triangle', 0.12);
      }
      return;
    }

    if (this.mode === 'fly') {
      const alt = Math.max(0, this.cur.p.y - this.surfaceHeightAt(this.cur.p.x, this.cur.p.z, this.cur.p.y) - this.cur.config.y0);
      if (this.cur.ground && this.cur.v.length() < 10 && alt < 3) {
        this.mode = 'walk';
        this.cur.thr = 0;
        _a.set(this.cur.config.ex, 0, 0).applyQuaternion(this.cur.q);
        const nx = this.cur.p.x + _a.x;
        const nz = this.cur.p.z + _a.z;
        this.man.p.set(nx, Math.max(0, this.surfaceHeightAt(nx, nz, this.cur.p.y + 1)), nz);
        this.man.vy = 0;
        this.manV.set(0, 0, 0);
        this.walkSpeedRatio = 0;
        this.manM.g.scale.setScalar(1);
        this.wingtipTrails?.forEach((t) => t.clear());
      } else {
        // GTA-style Mid-Air Bailout
        this.wingtipTrails?.forEach((t) => t.clear());
        this.cur.abandoned = true;
        this.cur.thr = 0;
        this.mode = 'skydive';
        this.parachuteOpen = false;
        this.chuteInflate = 0;
        this.skydiveBank = 0;
        this.diveRatio = 0;
        this.flareActive = false;

        _a.set(this.cur.config.ex * 0.55, 2.8, 0).applyQuaternion(this.cur.q);
        this.man.p.copy(this.cur.p).add(_a);
        this.manV.copy(this.cur.v).multiplyScalar(0.52);
        this.manV.y = Math.max(this.manV.y, 2) + 6.5;
        _fwd.set(0, 0, -1).applyQuaternion(this.cur.q);
        this.man.yaw = Math.atan2(-_fwd.x, -_fwd.z);
        this.camYaw = this.man.yaw;
        this.camYawTarget = this.man.yaw;
        this.camPitch = 0.25;
        this.camPitchTarget = 0.25;
        this.camZoom = 1;
        this.camZoomTarget = 1;
        this.camGroundLift = 0;
        const cp = Math.cos(this.camPitch);
        this.camRelOffset.set(
          Math.sin(this.camYaw) * cp * 5.6,
          Math.sin(this.camPitch) * 5.6 + 1.35,
          Math.cos(this.camYaw) * cp * 5.6
        );
        this.manM.g.scale.setScalar(1);
        this.audio.playTone(320, 0.22, 'sawtooth', 0.22);
        this.say(
          'bailout',
          'قفز اللاعب من الطائرة في الهواء',
          'قفزتَ من الطائرة في الجو! W للغوص السريع، وزر Space لفتح المظلة!',
          3,
          true
        );
      }
    }
  }

  private stepBoarding(dt: number): void {
    const bd = this.boarding;
    if (!bd) return;
    bd.t += dt / bd.duration;
    const u = THREE.MathUtils.clamp(bd.t, 0, 1);

    if (u < 0.56) {
      // Stage 1: Walk smoothly toward cockpit ladder/door
      const k = u / 0.56;
      const smooth = k * k * (3 - 2 * k);
      this.man.p.lerpVectors(bd.startPos, bd.doorPos, smooth);
      const dx = bd.doorPos.x - this.man.p.x;
      const dz = bd.doorPos.z - this.man.p.z;
      if (dx * dx + dz * dz > 0.006) {
        this.turnCharacter(this.man, dx, dz, dt * 1.8);
      }
      this.walkSpeedRatio = 0.78;
      this.man.anim += 8.2 * dt;
      this.manM.g.scale.setScalar(1);
    } else if (u < 0.8) {
      // Stage 2: Clean step/hop up onto wing/canopy sill
      const k = (u - 0.56) / 0.24;
      const smooth = k * k * (3 - 2 * k);
      this.man.p.lerpVectors(bd.doorPos, bd.stepPos, smooth);
      this.man.p.y += Math.sin(k * Math.PI) * 0.28;
      const dx = bd.stepPos.x - bd.doorPos.x;
      const dz = bd.stepPos.z - bd.doorPos.z;
      if (dx * dx + dz * dz > 0.004) {
        this.turnCharacter(this.man, dx, dz, dt * 2.0);
      }
      this.walkSpeedRatio = 0.35;
      this.man.anim += 6.0 * dt;
      this.manM.g.scale.setScalar(1);
    } else {
      // Stage 3: Settle cleanly into pilot seat facing nose (-Z)
      const k = (u - 0.8) / 0.2;
      const smooth = k * k * (3 - 2 * k);
      this.man.p.lerpVectors(bd.stepPos, bd.seatPos, smooth);
      _fwd.set(0, 0, -1).applyQuaternion(bd.target.q);
      this.turnCharacter(this.man, _fwd.x, _fwd.z, dt * 2.6);
      this.walkSpeedRatio = 0;
      this.manM.g.scale.setScalar(1 - smooth * 0.16);
    }

    if (bd.t >= 1) {
      const b = bd.target;
      this.boarding = null;
      this.manM.g.scale.setScalar(1);
      this.cur = b;
      this.selectedLobbyId = b.config.id;
      this.mode = 'fly';
      b.abandoned = false;
      b.thr = 0;
      b.spool = 0;
      b.prevP.copy(b.p);
      b.renderP.copy(b.p);
      b.prevQ.copy(b.q);
      b.renderQ.copy(b.q);
      this.sq.copy(b.q);
      this.flyYaw = 0;
      this.flyYawTarget = 0;
      this.flyPitch = 0;
      this.flyPitchTarget = 0;
      this.flyIdle = 0;
      this.camGroundLift = 0;
      this.camRelOffset
        .set(b.config.cam[0], b.config.cam[1], b.config.cam[2])
        .multiplyScalar(this.camZoom)
        .applyQuaternion(this.sq);
      this.camLookRel.set(0, 0.55, -b.config.cam[2] * 1.45);
      this.walkSpeedRatio = 0;
      this.audio.playTouchdown();

      if (b.config.id === 'b2') {
        this.say('b2', 'اللاعب ركب الشبحية B-2', 'القاذفة الشبحية B-2 جاهزة! اضغط B للقصف أو X للصواريخ.', 10, true);
      } else if (b.config.id === 'sukhoi') {
        this.say('su35', 'اللاعب ركب صوخوي Su-35', 'صوخوي Su-35 جاهزة! جرب الصعود العمودي والقصف والقتال الجوي.', 10, true);
      } else if (b.config.id === 'f22') {
        this.say('f22', 'اللاعب ركب F-22 رابتور', 'المقاتلة الشبحية F-22 رابتور جاهزة للتفوق الجوي!', 10, true);
      } else if (b.config.id === 'a10') {
        this.say('a10', 'اللاعب ركب A-10 ثاندر بولت', 'A-10 ثاندر بولت جاهزة! اضغط B لقصف الأهداف الأرضية.', 10, true);
      } else if (b.config.id === 'rafale') {
        this.say('rafale', 'اللاعب ركب رافال', 'المقاتلة الفرنسية رافال جاهزة للمهام المتعددة!', 10, true);
      } else if (b.config.id === 'f18') {
        this.say('f18', 'اللاعب ركب سوبر هورنت F/A-18', 'سوبر هورنت جاهزة لحاملة الطائرات! أنزل الخطاف [H] عند الهبوط.', 10, true);
      } else if (b.config.id === 'f35') {
        this.say('f35', 'اللاعب ركب F-35 لايتنينغ', 'F-35 لايتنينغ الشبحية جاهزة للإقلاع والعمليات الدقيقة!', 10, true);
      } else if (b.config.id === 'f117') {
        this.say('f117', 'اللاعب ركب الشبحية F-117 نايت هوك', 'الشبحية F-117 نايت هوك جاهزة! تصميم مضلع شبح وسرعة تحت صوتية عالية، اضغط B للقصف.', 10, true);
      } else if (b.config.id === 'f16') {
        this.say('jet', 'اللاعب ركب مقاتلة F-16', 'مقاتلة F-16 جاهزة للإقلاع!', 10, true);
      }
    }
  }

  public sendChatToSami(text: string): { reply: string; mood: string } {
    const action = parseSamiCommand(text);
    const note = this.executeSamiAction(action);
    const status = this.getSamiStatusText();
    const res = buildSamiChatReply(text, action, this.cur.config.nameAr, status);
    const finalReply = note || res.reply;
    this.npc.mood = res.mood;
    this.bubTxt = finalReply.slice(0, 140);
    this.bubT = 6.5;
    return { reply: finalReply, mood: res.mood };
  }

  private getSamiStatusText(): string {
    if (this.npc.st === 'pilot' && this.npc.ac) return `أقود ${this.npc.ac.config.nameAr}`;
    if (this.npc.st === 'ride' && this.npc.ac) return `راكب معك في ${this.npc.ac.config.nameAr}`;
    if (this.npc.st === 'go') return 'في طريقي إلى الطائرة';
    return 'أنتظرك في المطار';
  }

  private executeSamiAction(act: SamiAction): string {
    const pil = this.npc.st === 'pilot' && this.npc.ac && this.npc.ac.ai;
    const ph = pil && this.npc.ac?.ai ? this.npc.ac.ai.ph : '';
    const busyAir = ['takeoff', 'climb', 'approach', 'final', 'rollout', 'taxi'].includes(ph);

    const board = (a: AircraftInstance, then: 'ride' | 'follow' | 'recalt' | 'recspd' | 'orbit' | null): string => {
      if (pil) return 'أنا أقود طائرة حالياً، دعني أهبط أولاً.';
      if (this.npc.st === 'go') return 'أنا في طريقي للطائرة الآن.';
      if (this.mode === 'fly' && this.cur === a && then !== 'ride') {
        return 'أنت تقود هذه الطائرة بنفسك، اختر لي طائرة أخرى.';
      }
      if (a.crash > 0 || a.abandoned) return 'الطائرة غير متاحة حالياً، انتظر لحظة.';
      this.npc.st = 'go';
      this.npc.ac = a;
      this.npc.then = then === 'ride' ? null : then;
      (this.npc as SamiState & { wantRide?: boolean }).wantRide = then === 'ride';
      return '';
    };

    if (
      act === 'fly_small' ||
      act === 'fly_f16' ||
      act === 'fly_sukhoi' ||
      act === 'fly_b2' ||
      act === 'fly_f22' ||
      act === 'fly_a10' ||
      act === 'fly_rafale' ||
      act === 'fly_f18' ||
      act === 'fly_f35' ||
      act === 'fly_concorde' ||
      act === 'fly_sr71' ||
      act === 'fly_airliner' ||
      act === 'fly_biplane' ||
      act === 'fly_hercules'
    ) {
      const target = getAircraftBySamiAction(act, this.aircraft) || this.aircraft[0];
      if (pil && this.npc.ac === target) {
        if (!busyAir && this.npc.ac.ai) this.npc.ac.ai.ph = 'cruise';
        return '';
      }
      return board(target, null);
    }

    if (act === 'ride') {
      if (pil) return 'أنا في الجو الآن بطائرة أخرى!';
      if (this.mode === 'fly' && (!this.cur.ground || this.cur.v.length() > 8)) {
        return this.executeSamiAction('follow');
      }
      const pp = this.mode === 'fly' ? this.cur.p : this.man.p;
      let chosen: AircraftInstance | null = null;
      if (this.mode === 'fly') {
        chosen = this.cur;
      } else {
        let bestD = Infinity;
        for (const b of this.aircraft) {
          if (b.config.seats < 2) continue;
          const d = Math.hypot(b.p.x - pp.x, b.p.z - pp.z);
          if (d < bestD) {
            bestD = d;
            chosen = b;
          }
        }
      }
      if (!chosen || chosen.config.seats < 2) return 'هذه المقاتلة بمقعد واحد فقط!';
      if (this.npc.st === 'ride' && this.npc.ac === chosen) return 'أنا جالس بجانبك بالفعل!';
      return board(chosen, 'ride');
    }

    if (act === 'follow') {
      if (pil && this.npc.ac?.ai) {
        if (ph === 'takeoff' || ph === 'climb') this.npc.ac.ai.then = 'follow';
        else if (!busyAir) this.npc.ac.ai.ph = 'follow';
        return '';
      }
      const altPlane = this.aircraft.find((a) => a !== this.cur && !a.abandoned) || this.aircraft[0];
      return board(altPlane, 'follow');
    }

    if (act === 'record_alt' || act === 'record_speed') {
      const ph2 = act === 'record_alt' ? 'recalt' : 'recspd';
      if (pil && this.npc.ac?.ai) {
        if (ph === 'takeoff' || ph === 'climb') this.npc.ac.ai.then = ph2;
        else if (!busyAir) {
          this.npc.ac.ai.ph = ph2;
          this.npc.ac.ai.t0 = 0;
        }
        return '';
      }
      const fast =
        this.aircraft.find((a) => (a.config.id === 'sr71' || a.config.id === 'sukhoi') && a !== this.cur) ||
        this.aircraft.find((a) => a !== this.cur)!;
      return board(fast, ph2);
    }

    if (act === 'circle') {
      if (pil && this.npc.ac?.ai) {
        if (ph === 'takeoff' || ph === 'climb') this.npc.ac.ai.then = 'orbit';
        else if (!busyAir) this.npc.ac.ai.ph = 'orbit';
        return '';
      }
      const altPlane = this.aircraft.find((a) => a !== this.cur && !a.abandoned) || this.aircraft[0];
      return board(altPlane, 'orbit');
    }

    if (act === 'land' || act === 'return') {
      if (pil && this.npc.ac?.ai) {
        if (ph === 'takeoff' || ph === 'climb') this.npc.ac.ai.then = 'approach';
        else if (!busyAir) this.npc.ac.ai.ph = 'approach';
        if (act === 'return') this.npc.ac.ai.back = true;
        return '';
      }
      if (act === 'return') {
        this.npc.tg.set(...HOME_NPC_POS);
        this.npc.st = 'walk';
        this.npc.wt = 40;
        this.npc.hh = 0;
        return '';
      }
      return 'أنا على الأرض بالفعل!';
    }

    if (act === 'come') {
      if (pil) return 'أنا أقود طائرة في الجو حالياً!';
      const pp = this.mode === 'fly' ? this.cur.p : this.man.p;
      this.npc.tg.set(pp.x + 3.5, 0, pp.z + 3.5);
      this.npc.st = 'walk';
      this.npc.wt = 20;
      this.npc.hh = 0;
      return '';
    }

    if (act === 'away') {
      if (pil) return '';
      const pp = this.mode === 'fly' ? this.cur.p : this.man.p;
      let dx = this.npc.p.x - pp.x;
      let dz = this.npc.p.z - pp.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      this.npc.tg.set(this.npc.p.x + dx * 35, 0, this.npc.p.z + dz * 35);
      this.npc.st = 'walk';
      this.npc.wt = 20;
      this.npc.hh = 30;
      return '';
    }

    if (act === 'jump') {
      if (pil) return 'أنا داخل القمرة ولا أستطيع القفز!';
      this.npc.jn = 3;
      return '';
    }

    return '';
  }

  private say(key: string, _desc: string, text: string, gap = 40, force = false): void {
    const t = performance.now() / 1000;
    if (!force && (this.talkCD > 0 || (this.seenTalk[key] && t - this.seenTalk[key] < gap))) {
      return;
    }
    this.seenTalk[key] = t;
    this.talkCD = 9;
    this.bubTxt = text;
    this.bubT = 6.2;
    this.onSamiMessage(text);
  }

  private surfaceHeightAt(x: number, z: number, currentY: number): number {
    let h = groundHeightAt(x, z);
    for (const pad of this.world.helipads) {
      if (
        Math.abs(x - pad.x) <= pad.halfW &&
        Math.abs(z - pad.z) <= pad.halfL &&
        currentY >= pad.y - 3.5
      ) {
        h = Math.max(h, pad.y);
      }
    }
    return h;
  }

  private resolveBuildingCollisionForPlane(a: AircraftInstance, dt: number): boolean {
    const pad = Math.min(a.config.hx * 0.42, 4.2);
    if (a.p.y > 142) return false;
    for (const b of this.world.colliders) {
      const ex = b.hw + pad;
      const ez = b.hd + pad;
      const dx = a.p.x - b.x;
      const dz = a.p.z - b.z;
      if (a.p.y < b.h + 1.2 && Math.abs(dx) < ex && Math.abs(dz) < ez) {
        const penX = ex - Math.abs(dx);
        const penZ = ez - Math.abs(dz);
        const penY = b.h + 1.2 - a.p.y;
        let nx = 0;
        let ny = 0;
        let nz = 0;

        if (penY < penX && penY < penZ && a.p.y > b.h - 4) {
          ny = 1;
          a.p.y = b.h + 1.55;
        } else if (penX < penZ) {
          nx = dx >= 0 ? 1 : -1;
          a.p.x = b.x + nx * (ex + 0.35);
        } else {
          nz = dz >= 0 ? 1 : -1;
          a.p.z = b.z + nz * (ez + 0.35);
        }

        // Normal closing velocity into the building face
        const vn = -(a.v.x * nx + a.v.y * ny + a.v.z * nz);
        if (vn > 36) {
          // Violent direct head-on slam -> fatal crash & explosion!
          this.crashAircraft(a);
          return true;
        }

        // Strong, sharp restitution bounce (restitution = 0.56..0.68) with tangential-only scrape friction
        if (vn > 0) {
          const restitution = vn > 14 ? 0.68 : 0.56;
          const impulse = (1 + restitution) * vn;
          a.v.x += nx * impulse;
          a.v.y += ny * impulse;
          a.v.z += nz * impulse;
        }
        const vDotN = a.v.x * nx + a.v.y * ny + a.v.z * nz;
        const tanDrag = Math.max(0.68, 1 - 2.8 * dt);
        a.v.x = (a.v.x - nx * vDotN) * tanDrag + nx * vDotN;
        a.v.y = (a.v.y - ny * vDotN) * tanDrag + ny * vDotN;
        a.v.z = (a.v.z - nz * vDotN) * tanDrag + nz * vDotN;

        const sideSign = nx !== 0 ? -nx : dx >= 0 ? 1 : -1;
        a.w.y += sideSign * Math.min(1.6, 0.35 + Math.max(0, vn) * 0.045);
        a.w.z += (nx !== 0 ? -nx : Math.random() - 0.5) * Math.min(1.3, 0.25 + Math.max(0, vn) * 0.035);

        _q.copy(a.q).invert();
        _c.set(a.p.x - nx * pad, a.p.y - ny * 0.8, a.p.z - nz * pad).sub(a.p).applyQuaternion(_q);
        this.inflictComponentDamage(a, _c, Math.max(0.04, vn * 0.015), 'impact');
        this.camShake = Math.max(this.camShake, Math.min(0.85, 0.2 + Math.max(0, vn) * 0.032));
        this.spawnScrapeSparks(
          _c.set(a.p.x - nx * pad, a.p.y - ny * 0.8, a.p.z - nz * pad),
          Math.min(1, 0.42 + Math.max(0, vn) * 0.028),
          _d.set(nx, ny, nz),
          'building',
          a.v.length(),
          vn > 8
        );
        if (a.hull <= 0) {
          return true;
        }
      }
    }
    return false;
  }

  private hitsBuildingPoint(x: number, y: number, z: number, pad = 1.2): boolean {
    if (y > 140) return false;
    for (const b of this.world.colliders) {
      if (y < b.h && Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad) {
        return true;
      }
    }
    return false;
  }

  private nearestAircraft(): AircraftInstance | null {
    let best: AircraftInstance | null = null;
    let bd = Infinity;
    for (const a of this.aircraft) {
      if (a.ai || a.abandoned) continue;
      const d = this.man.p.distanceTo(a.p);
      if (d < a.config.board && d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  private pushOut(pos: THREE.Vector3, a: AircraftInstance): void {
    if (pos.y > groundHeightAt(pos.x, pos.z) + 1.5) return;
    _q.copy(a.q).invert();
    _a.copy(pos).sub(a.p).applyQuaternion(_q);
    const hx = a.config.hx;
    const hz = a.config.hz;
    if (Math.abs(_a.x) < hx && Math.abs(_a.z) < hz) {
      const px = hx - Math.abs(_a.x);
      const pz = hz - Math.abs(_a.z);
      if (px < pz) _a.x = Math.sign(_a.x || 1) * hx;
      else _a.z = Math.sign(_a.z || 1) * hz;
      _a.applyQuaternion(a.q).add(a.p);
      pos.x = _a.x;
      pos.z = _a.z;
    }
  }

  private turnCharacter(o: { yaw: number }, dx: number, dz: number, dt: number): void {
    let d = Math.atan2(-dx, -dz) - o.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.yaw += d * Math.min(1, 10 * dt);
  }

  private stepMan(dt: number): void {
    const f = THREE.MathUtils.clamp(
      (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0) + this.analog.y,
      -1,
      1
    );
    const r = THREE.MathUtils.clamp(
      (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0) + this.analog.x,
      -1,
      1
    );
    const s = Math.sin(this.camYaw);
    const co = Math.cos(this.camYaw);
    const sprint = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    const maxSp = sprint ? 11.5 : 5.2;

    let targetVx = 0;
    let targetVz = 0;
    if (f || r) {
      const l = Math.hypot(f, r);
      const mag = this.analog.on ? Math.min(1, l) : 1;
      const dx = (-s * f + co * r) / l;
      const dz = (-co * f - s * r) / l;
      targetVx = dx * maxSp * mag;
      targetVz = dz * maxSp * mag;
      this.turnCharacter(this.man, dx, dz, dt);
    }

    // Responsive human acceleration/deceleration momentum
    const accel = f || r ? 14 : 16;
    const k = 1 - Math.exp(-accel * dt);
    this.manV.x += (targetVx - this.manV.x) * k;
    this.manV.z += (targetVz - this.manV.z) * k;

    const horizSp = Math.hypot(this.manV.x, this.manV.z);
    this.man.moving = horizSp > 0.25;
    this.walkSpeedRatio = THREE.MathUtils.clamp(horizSp / 9.2, 0, 1.25);
    if (this.man.moving) {
      this.man.p.x += this.manV.x * dt;
      this.man.p.z += this.manV.z * dt;
      this.man.anim += (3.6 + horizSp * 1.35) * dt;
    }

    const gh = Math.max(0, this.surfaceHeightAt(this.man.p.x, this.man.p.z, this.man.p.y + 1));
    if (this.keys.Space && this.man.p.y <= gh + 0.05) {
      this.man.vy = 5.4;
      this.jumps.push(performance.now());
    }
    this.man.vy -= 13.5 * dt;
    this.man.p.y += this.man.vy * dt;
    if (this.man.p.y < gh) {
      this.man.p.y = gh;
      this.man.vy = 0;
    }
    for (const a of this.aircraft) this.pushOut(this.man.p, a);
  }

  private stepSkydive(dt: number): void {
    const f = THREE.MathUtils.clamp(
      (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0) + this.analog.y,
      -1,
      1
    );
    const turnIn = THREE.MathUtils.clamp(
      (this.keys.KeyA ? 1 : 0) - (this.keys.KeyD ? 1 : 0) - this.analog.x,
      -1,
      1
    );

    if (this.parachuteOpen) {
      // Smooth canopy inflation & turn banking
      this.chuteInflate = Math.min(1, this.chuteInflate + dt * 1.65);
      this.flareActive = f < -0.25; // S key pulls steering toggles down to flare!
      const diveBoost = f > 0.25 ? f : 0;

      // Turn heading & bank canopy smoothly into turn
      this.man.yaw = _wrap(this.man.yaw + turnIn * 1.32 * dt);
      const targetBank = turnIn * 0.44;
      this.skydiveBank += (targetBank - this.skydiveBank) * Math.min(1, 5 * dt);

      // True Ram-Air Aerodynamics (3.5:1 Glide Ratio + Flare Lift + Gentle Wind Drift)
      const fx = -Math.sin(this.man.yaw);
      const fz = -Math.cos(this.man.yaw);
      const targetFwdSpd = this.flareActive ? 5.2 : 13.5 + diveBoost * 7.5;
      const targetSink = this.flareActive ? -1.15 : -4.0 - diveBoost * 3.8;

      const windX = this.weatherWindVec.x * 0.45;
      const windZ = this.weatherWindVec.z * 0.45;
      const kHoriz = 1 - Math.exp(-3.0 * dt);
      this.manV.x += (fx * targetFwdSpd + windX - this.manV.x) * kHoriz;
      this.manV.z += (fz * targetFwdSpd + windZ - this.manV.z) * kHoriz;

      // Smooth aerodynamic shock deceleration as canopy catches air from freefall
      const kVert = 1 - Math.exp((this.chuteInflate < 0.7 ? -5.5 : -4.0) * dt);
      this.manV.y += (targetSink - this.manV.y) * kVert;
    } else {
      // Real Freefall Gravity & Quadratic Air Drag Physics!
      const diveIn = THREE.MathUtils.clamp(f, 0, 1); // W = head-down dive!
      this.diveRatio += (diveIn - this.diveRatio) * Math.min(1, 4.5 * dt);
      this.flareActive = false;

      // Turn heading smoothly in freefall & bank torso
      this.man.yaw = _wrap(this.man.yaw + turnIn * 1.85 * dt);
      const targetBank = turnIn * 0.52;
      this.skydiveBank += (targetBank - this.skydiveBank) * Math.min(1, 5.5 * dt);

      // Forward horizontal tracking velocity (head-down tracks faster forward too)
      const fx = -Math.sin(this.man.yaw);
      const fz = -Math.cos(this.man.yaw);
      const trackFwd = 13.0 + this.diveRatio * 14.0 + (f < -0.2 ? -6.0 : 0);
      this.manV.x += (fx * trackFwd - this.manV.x) * (1 - Math.exp(-2.0 * dt));
      this.manV.z += (fz * trackFwd - this.manV.z) * (1 - Math.exp(-2.0 * dt));

      // Quadratic aerodynamic drag opposing vertical fall:
      // Belly-to-earth CdA=0.56 -> v_term ≈ 48 m/s (~175 km/h)
      // Head-down dive CdA=0.21 -> v_term ≈ 78 m/s (~280 km/h)
      const CdA = THREE.MathUtils.lerp(0.56, 0.21, this.diveRatio);
      const vSq = this.manV.y * this.manV.y;
      const dragUp = (0.5 * 1.225 * CdA * vSq) / 80;
      this.manV.y += (-9.81 + Math.sign(-this.manV.y) * dragUp) * dt;
    }

    this.man.p.addScaledVector(this.manV, dt);

    const gh = groundHeightAt(this.man.p.x, this.man.p.z);
    const surf = Math.max(0, this.surfaceHeightAt(this.man.p.x, this.man.p.z, this.man.p.y + 1));

    if (this.man.p.y <= surf + 0.05) {
      if (gh < -0.5 && surf < 1) {
        this.spawnExplosion(this.man.p, 0.4);
        this.mode = 'walk';
        this.parachuteOpen = false;
        this.man.p.set(...HOME_WALK_POS);
        this.manV.set(0, 0, 0);
        this.say('splash', 'هبوط في البحر', 'هبطتَ في البحر وتم إنقاذك إلى المطار!', 5, true);
        return;
      }

      if (!this.parachuteOpen && Math.abs(this.manV.y) > 20) {
        this.spawnExplosion(this.man.p, 0.65);
        this.audio.playCrash();
        this.mode = 'walk';
        this.parachuteOpen = false;
        this.man.p.set(...HOME_WALK_POS);
        this.manV.set(0, 0, 0);
        this.say('hardland', 'سقوط قوي بدون مظلة', 'نسيت فتح المظلة! تم نقلك للمطار بسلام.', 5, true);
      } else {
        this.man.p.y = surf;
        this.man.vy = 0;
        this.manV.set(0, 0, 0);
        this.mode = 'walk';
        this.parachuteOpen = false;
        this.chuteInflate = 0;
        this.audio.playTouchdown();
        this.say('safeland', 'هبوط مظلي ناجح', 'هبوط مظلي سلس ومحترف!', 8, true);
      }
    }
  }

  private stepNpc(dt: number): void {
    const npc = this.npc as SamiState & { wantRide?: boolean };
    if (npc.st === 'pilot' && npc.ac) {
      npc.p.set(npc.ac.p.x, npc.ac.p.y, npc.ac.p.z);
      npc.mv = false;
      if (npc.ac.ai?.ph === 'taxi' && npc.ac.v.length() < 2.2) {
        this.stats.sami.land++;
        npc.ac.ai = null;
        npc.st = 'idle';
        const exited = npc.ac;
        npc.ac = null;
        exited.thr = 0;
        _a.set(exited.config.ex, 0, 0).applyQuaternion(exited.q);
        npc.p.set(exited.p.x + _a.x, groundHeightAt(exited.p.x + _a.x, exited.p.z + _a.z), exited.p.z + _a.z);
        this.say('landed', 'سامي هبط', 'هبطتُ بسلام تام! دورك الآن لتُظهر مهارتك.', 10, true);
      }
      return;
    }
    if (npc.st === 'ride' && npc.ac) {
      const a = npc.ac;
      npc.p.set(a.p.x, a.p.y, a.p.z);
      npc.mv = false;
      npc.vy = 0;
      if (this.mode === 'fly' && this.cur === a) npc.rode = true;
      const gone = !npc.rode && this.mode === 'walk' && Math.hypot(this.man.p.x - a.p.x, this.man.p.z - a.p.z) > 150;
      if ((npc.rode && !(this.mode === 'fly' && this.cur === a)) || (this.mode === 'fly' && this.cur !== a) || gone) {
        npc.st = 'idle';
        npc.ac = null;
        npc.rode = false;
        _a.set(-a.config.ex, 0, 0).applyQuaternion(a.q);
        npc.p.set(a.p.x + _a.x, groundHeightAt(a.p.x + _a.x, a.p.z + _a.z), a.p.z + _a.z);
      }
      return;
    }

    const gh = Math.max(0, groundHeightAt(npc.p.x, npc.p.z));
    npc.vy -= 13 * dt;
    npc.p.y += npc.vy * dt;
    if (npc.p.y <= gh) {
      npc.p.y = gh;
      npc.vy = 0;
      if (npc.jn > 0) {
        npc.vy = 5.2;
        npc.jn--;
      }
    }

    if (npc.st === 'walk') {
      const tx = npc.tg.x - npc.p.x;
      const tz = npc.tg.z - npc.p.z;
      const d = Math.hypot(tx, tz) || 1;
      npc.wt -= dt;
      if (d < 1.3 || npc.wt <= 0) {
        npc.st = 'idle';
        npc.hold = npc.hh || 0;
        npc.mv = false;
        return;
      }
      npc.p.x += (tx / d) * 3.5 * dt;
      npc.p.z += (tz / d) * 3.5 * dt;
      this.turnCharacter(npc, tx, tz, dt);
      npc.mv = true;
      npc.anim += 8.2 * dt;
      for (const b of this.aircraft) this.pushOut(npc.p, b);
      return;
    }

    if (npc.st === 'go' && npc.ac) {
      const a = npc.ac;
      const ax = a.p.x - npc.p.x;
      const az = a.p.z - npc.p.z;
      const d = Math.hypot(ax, az) || 1;
      if (npc.wantRide && (a.v.length() > 7 || !a.ground)) {
        npc.st = 'idle';
        npc.ac = null;
        npc.wantRide = false;
        this.executeSamiAction('follow');
        return;
      }
      if (this.mode === 'fly' && this.cur === a && !npc.wantRide) {
        npc.st = 'idle';
        npc.ac = null;
        return;
      }
      if (d < Math.max(a.config.hx, a.config.hz) + 2.8) {
        if (npc.wantRide) {
          npc.st = 'ride';
          npc.rode = false;
          npc.wantRide = false;
          npc.mv = false;
          this.say('ridein', 'صعد سامي كراكب', 'صعدتُ بجانبك! هيا بنا إلى السماء يا كابتن.', 0, true);
          return;
        }
        npc.st = 'pilot';
        a.abandoned = false;
        a.ai = {
          ph: 'takeoff',
          i: 0,
          then: npc.then || null,
          from: { x: a.spawn.x, z: a.spawn.z },
        };
        npc.then = null;
        a.inp = { p: 0, r: 0, y: 0, thr: 0, brake: 1 };
        npc.mv = false;
        return;
      }
      npc.p.x += (ax / d) * 4.4 * dt;
      npc.p.z += (az / d) * 4.4 * dt;
      this.turnCharacter(npc, ax, az, dt);
      npc.mv = true;
      npc.anim += 9.5 * dt;
      for (const b of this.aircraft) this.pushOut(npc.p, b);
      return;
    }

    let sp = 0;
    let dx = 0;
    let dz = 0;
    let face: THREE.Vector3 | null = null;
    for (const a of this.aircraft) {
      const ax = npc.p.x - a.p.x;
      const az = npc.p.z - a.p.z;
      const d = Math.hypot(ax, az) || 1;
      if (a.v.length() > 6 && a.p.y < 14 && d < a.config.hz + 14) {
        dx = ax / d;
        dz = az / d;
        sp = 6;
        this.say('danger', 'طائرة مسرعة قرب سامي', 'انتبه! كدتَ تصدمني!', 25);
      }
    }

    const pp = this.mode === 'fly' ? this.cur.p : this.man.p;
    const pd = Math.hypot(pp.x - npc.p.x, pp.z - npc.p.z) || 1;
    if (!sp) {
      if (npc.hold > 0) {
        npc.hold -= dt;
        face = pp;
      } else if (this.mode === 'walk' && pd > 6) {
        dx = (pp.x - npc.p.x) / pd;
        dz = (pp.z - npc.p.z) / pd;
        sp = pd > 40 ? 5.5 : 2.8;
        if (!npc.seek && pd > 60) {
          npc.seek = true;
          this.say('seek', 'ابتعد اللاعب', 'أين ذهبتَ؟ أنا قادم إليك!', 60);
        }
      } else if (this.mode === 'walk') {
        face = pp;
        if (npc.seek) {
          npc.seek = false;
          this.say('found', 'وجد اللاعب', 'وجدتُك! أي طائرة سنقود الآن؟', 30);
        }
      } else if (this.mode === 'fly' || this.mode === 'skydive') {
        face = pp;
      } else {
        npc.wait -= dt;
        if (npc.wait <= 0) {
          npc.tg.set(HOME_NPC_POS[0] + (Math.random() - 0.5) * 36, 0, HOME_NPC_POS[2] + (Math.random() - 0.5) * 28);
          npc.wait = 3 + Math.random() * 4;
        }
        const tx = npc.tg.x - npc.p.x;
        const tz = npc.tg.z - npc.p.z;
        const td = Math.hypot(tx, tz);
        if (td > 1) {
          dx = tx / td;
          dz = tz / td;
          sp = 1.6;
        } else {
          face = pp;
        }
      }
    }

    if (sp) {
      npc.p.x += dx * sp * dt;
      npc.p.z += dz * sp * dt;
      this.turnCharacter(npc, dx, dz, dt);
    } else if (face) {
      const fx = face.x - npc.p.x;
      const fz = face.z - npc.p.z;
      const o = Math.sin(performance.now() / 1700) * 0.25;
      const cs = Math.cos(o);
      const sn = Math.sin(o);
      this.turnCharacter(npc, fx * cs - fz * sn, fx * sn + fz * cs, dt);
    }
    npc.mv = sp > 0;
    if (npc.mv) npc.anim += (3.2 + sp * 1.45) * dt;
    for (const a of this.aircraft) this.pushOut(npc.p, a);
  }

  private resetAircraftDamage(a: AircraftInstance): void {
    a.hull = 100;
    a.damage.leftWing = 1.0;
    a.damage.rightWing = 1.0;
    a.damage.tail = 1.0;
    a.damage.engine = 1.0;
    a.damage.gear = 1.0;
    a.engineOverheat = 0;
    a.engineSputterTimer = 0;
  }

  private inflictComponentDamage(
    a: AircraftInstance,
    localImpact: THREE.Vector3,
    dmgAmount: number,
    source: 'impact' | 'missile' | 'bomb' | 'hardLanding' = 'impact'
  ): void {
    if (a.crash > 0) return;
    const hz = a.config.hz;

    if (source === 'hardLanding') {
      a.damage.gear = Math.max(0, a.damage.gear - dmgAmount);
    } else {
      // Local physical zone triage (wings deform/lose lift without snapping off)
      if (localImpact.x < -1.1 && Math.abs(localImpact.z) < hz * 0.9) {
        a.damage.leftWing = Math.max(0.05, a.damage.leftWing - dmgAmount);
      } else if (localImpact.x > 1.1 && Math.abs(localImpact.z) < hz * 0.9) {
        a.damage.rightWing = Math.max(0.05, a.damage.rightWing - dmgAmount);
      }

      if (localImpact.z > hz * 0.25) {
        a.damage.tail = Math.max(0, a.damage.tail - dmgAmount * 0.85);
      }

      if (localImpact.z > 0 && Math.abs(localImpact.x) < 2.0) {
        a.damage.engine = Math.max(0, a.damage.engine - dmgAmount * 0.9);
      }

      if (Math.abs(localImpact.y) < 1.0 && a.ground) {
        a.damage.gear = Math.max(0, a.damage.gear - dmgAmount * 0.6);
      }
    }

    a.hull = Math.max(
      0,
      Math.round(
        (a.damage.leftWing * 0.25 +
          a.damage.rightWing * 0.25 +
          a.damage.tail * 0.2 +
          a.damage.engine * 0.2 +
          a.damage.gear * 0.1) *
          100
      )
    );

    if (a.hull <= 0) {
      this.crashAircraft(a, source === 'missile');
    }
  }

  private crashAircraft(a: AircraftInstance, fromMissile = false): void {
    if (a.crash > 0) return;
    this.spawnExplosion(a.p, a.config.hx > 10 ? 1.7 : 1.25);

    if (a.abandoned) {
      a.abandoned = false;
      this.resetAircraftDamage(a);
      a.p.copy(a.spawn);
      a.prevP.copy(a.spawn);
      a.renderP.copy(a.spawn);
      a.q.setFromAxisAngle(_up, a.spawnYaw);
      a.prevQ.copy(a.q);
      a.renderQ.copy(a.q);
      a.v.set(0, 0, 0);
      a.w.set(0, 0, 0);
      a.thr = 0;
      a.spool = 0;
      a.tas = 0;
      a.fwd = 0;
      a.aoa = 0;
      a.liftLoadG = 1;
      a.ground = true;
      this.say('planecrash', 'انفجار الطائرة المتروكة', 'بوووم! تحطمت الطائرة التي قفزتَ منها وانفجرت!', 5, true);
      return;
    }

    if (a.ai) {
      this.stats.sami.crash++;
      this.resetAircraftDamage(a);
      a.p.copy(a.spawn);
      a.prevP.copy(a.spawn);
      a.renderP.copy(a.spawn);
      a.q.setFromAxisAngle(_up, a.spawnYaw);
      a.prevQ.copy(a.q);
      a.renderQ.copy(a.q);
      a.v.set(0, 0, 0);
      a.w.set(0, 0, 0);
      a.thr = 0;
      a.spool = 0;
      a.tas = 0;
      a.fwd = 0;
      a.aoa = 0;
      a.liftLoadG = 1;
      a.ground = true;
      a.ai = null;
      this.npc.st = 'idle';
      this.npc.ac = null;
      this.npc.p.set(...HOME_NPC_POS);
      this.say(
        'aicrash',
        'تحطمت طائرة سامي',
        fromMissile
          ? 'يا للهول! أصبتَ طائرتي بالصاروخ التتبعي، نجوتُ بالمظلة!'
          : 'يا إلهي! اصطدام قوي للغاية، نجوتُ بأعجوبة.',
        6,
        true
      );
      return;
    }

    if (this.mode === 'fly' && a === this.cur) {
      this.stats.player.crash++;
      a.crash = 2.8;
      a.hull = 0;
      a.damage.leftWing = 0;
      a.damage.rightWing = 0;
      a.damage.tail = 0;
      a.damage.engine = 0;
      a.damage.gear = 0;
      a.thr = 0;
      a.spool = 0;
      this.audio.playCrash();
      this.say('crash', 'تحطمت الطائرة', 'اصطدام عنيف! سنعيد تجهيز الطائرة على المدرج.', 5, true);
      return;
    }

    this.resetAircraftDamage(a);
    a.p.copy(a.spawn);
    a.prevP.copy(a.spawn);
    a.renderP.copy(a.spawn);
    a.q.setFromAxisAngle(_up, a.spawnYaw);
    a.prevQ.copy(a.q);
    a.renderQ.copy(a.q);
    a.v.set(0, 0, 0);
    a.w.set(0, 0, 0);
    a.thr = 0;
    a.spool = 0;
    a.tas = 0;
    a.fwd = 0;
    a.aoa = 0;
    a.liftLoadG = 1;
    a.ground = true;
  }

  private stepPlane(a: AircraftInstance, dt: number): void {
    const c = a.config;
    const aero = c.aero;
    const pil = this.mode === 'fly' && a === this.cur;
    const ai = !!a.ai;
    const aban = !!a.abandoned;
    const fly = pil || ai || aban;

    if (!fly && a.ground && a.crash <= 0) {
      const surfBelowParked = this.surfaceHeightAt(a.p.x, a.p.z, a.p.y);
      const parkedY = surfBelowParked + c.y0 - aero.gearMaxTravelM * 0.35;
      if (a.v.lengthSq() < 1.5) {
        a.v.set(0, 0, 0);
        a.w.set(0, 0, 0);
        a.p.y += (parkedY - a.p.y) * Math.min(1, 14 * dt);
        a.thr = 0;
        a.spool = 0;
        a.tas = 0;
        a.fwd = 0;
        a.aoa = 0;
        a.liftLoadG = 1;
        return;
      }
    }

    if (a.crash > 0) {
      a.crash -= dt;
      a.spool = Math.max(0, a.spool - 2 * dt);
      a.v.multiplyScalar(Math.max(0, 1 - 3 * dt));
      if (a.crash <= 0) {
        this.startFromLobby(a.config.id, 'cockpit');
      }
      return;
    }

    // 1. Throttle Demand & Realistic Jet/Prop Engine Spool Lag
    if (aban) {
      a.thr = 0;
    } else if (ai) {
      stepAutopilot(a, this.mode, this.cur, this.man.p);
      a.thr = THREE.MathUtils.clamp(a.inp.thr, 0, 1);
    } else if (pil) {
      if (this.keys.ShiftLeft || this.keys.ShiftRight) a.thr += 0.68 * dt;
      if (this.keys.KeyC) a.thr -= 0.72 * dt;
      a.thr = THREE.MathUtils.clamp(a.thr, 0, 1);
    } else {
      a.thr = 0;
    }

    if (pil && this.fuelPct <= 0) {
      a.thr = 0;
    }

    const tauSpool =
      a.thr >= a.spool
        ? Math.max(0.22, aero.spoolUpTimeS * 0.34)
        : Math.max(0.22, aero.spoolDownTimeS * 0.34);
    a.spool = THREE.MathUtils.clamp(a.spool + (a.thr - a.spool) * (1 - Math.exp(-dt / tauSpool)), 0, 1);

    // Afterburner & fuel burn simulation
    const drySpool = aero.hasAfterburner ? Math.min(1, a.spool / 0.82) : a.spool;
    const abRatio = aero.hasAfterburner && a.spool > 0.82 ? (a.spool - 0.82) / 0.18 : 0;
    if (pil && fly) {
      const wingLeak =
        (a.damage.leftWing < 0.78 ? (0.78 - a.damage.leftWing) * 0.85 : 0) +
        (a.damage.rightWing < 0.78 ? (0.78 - a.damage.rightWing) * 0.85 : 0);
      const burnRate = (0.04 + drySpool * drySpool * 0.15 + abRatio * 0.78 + wingLeak) * dt;
      if (!this.refuelConnected && !this.refuelAssist) {
        this.fuelPct = Math.max(0, this.fuelPct - burnRate);
      }
      if (this.fuelPct <= 0) {
        a.thr = 0;
        a.spool *= Math.exp(-1.5 * dt);
        this.say(
          'nofuel',
          'نفد الوقود',
          'نفد الوقود تماماً! اقترب من طائرة الصهريج لإعادة التعبئة في الجو أو اهبط فوراً.',
          18
        );
      }
      this.prevPlayerV.copy(a.v);
    }

    // 2. Standard Atmosphere: Exponential Air Density rho(h) & Speed of Sound
    const altM = Math.max(0, a.p.y - c.y0);
    const rho = 1.225 * Math.exp(-altM / 8500);
    const speedOfSound = Math.max(295, 340.3 - 0.004 * Math.min(altM, 11000));

    // Relative wind in aircraft local frame (locked to zero when parked/stationary on ground so wind never lifts parked planes)
    _q.copy(a.q).invert();
    const groundSpd = a.v.length();
    const groundParkedLock = a.ground && groundSpd < 15 && a.thr <= 0.5;
    const windWeight = groundParkedLock ? 0 : a.ground ? 0.08 : 1.0;
    _relWind.set(
      (this.weatherWindVec.x + this.weatherGustVec.x) * windWeight,
      this.weatherGustVec.y * windWeight,
      (this.weatherWindVec.z + this.weatherGustVec.z) * windWeight
    );
    const lv = _a.copy(a.v).sub(_relWind).applyQuaternion(_q);
    const tas = lv.length();
    const fwd = -lv.z;
    const sp = groundSpd;
    a.tas = tas;
    a.fwd = fwd;

    const qDyn = 0.5 * rho * tas * tas;
    const mach = tas / speedOfSound;
    const aoa =
      tas > 1.8 ? Math.atan2(-lv.y, fwd >= 0 ? Math.max(0.35, fwd) : Math.min(-0.35, fwd)) : 0;
    const beta = tas > 1.8 ? Math.atan2(lv.x, Math.max(1.5, Math.abs(fwd))) : 0;
    a.aoa = aoa;

    // 3. Pilot / AI Control Inputs
    let pIn = 0;
    let rIn = 0;
    let yIn = 0;
    if (ai) {
      pIn = a.inp.p;
      rIn = a.inp.r;
      yIn = a.inp.y;
    } else if (pil) {
      pIn = THREE.MathUtils.clamp((this.keys.KeyS ? 1 : 0) - (this.keys.KeyW ? 1 : 0) - this.analog.y, -1, 1);
      rIn = THREE.MathUtils.clamp((this.keys.KeyA ? 1 : 0) - (this.keys.KeyD ? 1 : 0) - this.analog.x, -1, 1);
      yIn = THREE.MathUtils.clamp(
        (this.keys.ArrowLeft || this.keys.KeyQ ? 1 : 0) - (this.keys.ArrowRight || this.keys.KeyE ? 1 : 0) - this.analog.rud,
        -1,
        1
      );
      a.inp.p = pIn;
      a.inp.r = rIn;
      a.inp.y = yIn;
      a.inp.brake = this.keys.Space ? 1 : 0;
    } else if (aban) {
      pIn = -0.25;
      rIn = 0.18;
      a.inp.p = pIn;
      a.inp.r = rIn;
      a.inp.y = 0;
    } else {
      a.inp.p = 0;
      a.inp.r = 0;
      a.inp.y = 0;
      a.inp.brake = 0;
    }

    // 4. Flaps, Ground Effect, Lift Curve & Stall Physics
    const surfBelow = this.surfaceHeightAt(a.p.x, a.p.z, a.p.y);
    const clearance = Math.max(0, a.p.y - c.y0 - surfBelow);
    const flapsOn = pil && (a.ground || (clearance < 160 && fwd < c.rot * 1.45 && fwd > 10));
    if (pil) {
      this.flapsActive = flapsOn;
    }

    const wingspan = Math.max(6, c.hx * 2);
    const geRatio = clearance < wingspan ? 1 - clearance / wingspan : 0;

    const stallRad = (aero.stallAoADeg * Math.PI) / 180;
    const stallStart = stallRad * 1.12;
    const stallSeverity = tas > 14 ? THREE.MathUtils.smoothstep(Math.abs(aoa), stallStart, stallStart + 0.22) : 0;

    const clFlaps = flapsOn ? 0.34 : 0;
    const clLinear = THREE.MathUtils.clamp(
      aero.cl0 + clFlaps + aero.clAlpha * aoa,
      -aero.clMax * 0.85,
      aero.clMax + clFlaps
    );
    const clPostStall = 0.96 * Math.sin(2 * aoa);
    const cl = THREE.MathUtils.lerp(clLinear, clPostStall, stallSeverity * 0.82);

    // 5. Four Aerodynamic Forces (Lift, Drag, Thrust, Gravity) with Component Damage
    const leftWingCl = 0.15 + 0.85 * a.damage.leftWing;
    const rightWingCl = 0.15 + 0.85 * a.damage.rightWing;
    const avgWingCl = (leftWingCl + rightWingCl) * 0.5;

    // Parasitic drag asymmetry
    const leftExtraCd = (1 - a.damage.leftWing) * 0.065;
    const rightExtraCd = (1 - a.damage.rightWing) * 0.065;
    const cdDamage = (leftExtraCd + rightExtraCd) * 0.5;

    const kInduced = 0.68 / (Math.PI * aero.aspectRatio * aero.oswaldEff);
    const cdInduced = kInduced * cl * cl * (1 - 0.38 * geRatio);
    const cdWave =
      mach > 0.92
        ? (c.id === 'sr71' || c.id === 'concorde' ? 0.009 : 0.024) *
          Math.pow(Math.min(mach - 0.92, 0.78), 1.55)
        : 0;
    const cdStall = 0.42 * stallSeverity * Math.sin(aoa) * Math.sin(aoa) + 0.1 * stallSeverity;
    const cdFlaps = flapsOn && !a.ground ? 0.02 : 0;
    const airbrakeOn = pil && !a.ground && !!this.keys.Space;
    const cdAirbrake = airbrakeOn ? 0.048 : 0;
    const gearAnimState = this.animRigs.get(a);
    const gearExtended = gearAnimState ? gearAnimState.gearAnim : 0;
    const gearOverspeed = !a.ground && gearExtended > 0.14 && (mach > 0.46 || tas > 152);
    const cdGear = !a.ground && gearExtended > 0.05 ? gearExtended * (gearOverspeed ? 0.058 : 0.022) : 0;
    const cdTotal = aero.cd0 + cdFlaps + cdAirbrake + cdGear + cdInduced + cdWave + cdStall + cdDamage;

    // Engine thrust with damage, intermittent sputter, and afterburner overheat
    let sputterMult = 1.0;
    if (a.damage.engine < 0.75 && a.spool > 0.08) {
      a.engineSputterTimer -= dt;
      if (a.engineSputterTimer <= 0) {
        if (a.engineSputterTimer < -0.32) {
          a.engineSputterTimer = 0.8 + Math.random() * (1.6 * a.damage.engine);
        } else {
          sputterMult = 0.25 + a.damage.engine * 0.35;
          if (pil) this.audio.playEngineSputter();
        }
      }
    }

    if (abRatio > 0.05 && a.damage.engine < 0.9) {
      a.engineOverheat = Math.min(1.0, a.engineOverheat + (0.12 + (1 - a.damage.engine) * 0.22) * dt);
    } else {
      a.engineOverheat = Math.max(0, a.engineOverheat - 0.08 * dt);
    }
    const isOverheated = a.engineOverheat >= 0.95;
    const overheatMult = isOverheated ? 0.2 : 1.0;

    const lapseExp = c.id === 'sr71' || c.id === 'concorde' ? 0.55 : 0.72;
    const altThrustFactor = Math.pow(rho / 1.225, lapseExp);
    let thrustN = 0;
    if (aero.hasAfterburner) {
      if (a.spool <= 0.82) {
        thrustN = aero.maxDryThrustN * Math.pow(drySpool, 1.35) * altThrustFactor;
      } else {
        thrustN = THREE.MathUtils.lerp(aero.maxDryThrustN, aero.maxAbThrustN, abRatio) * altThrustFactor;
      }
      if (c.id === 'sr71' || c.id === 'concorde') {
        thrustN *= 1 + THREE.MathUtils.clamp((mach - 0.85) * 0.25, 0, 0.38);
      }
    } else {
      thrustN = aero.maxDryThrustN * Math.pow(a.spool, 1.35) * altThrustFactor;
      if (aero.compMach < 0.75) {
        // Propeller efficiency taper with forward speed
        thrustN *= Math.max(0.28, 1 - 0.48 * Math.min(1.2, tas / aero.maxSpeedMs));
      }
    }
    thrustN *= a.damage.engine * sputterMult * overheatMult;
    if (pil && this.fuelPct <= 0) thrustN = 0;

    const liftMag = groundParkedLock ? 0 : qDyn * aero.wingAreaM2 * cl * avgWingCl * (1 + 0.18 * geRatio);
    const dragMag = qDyn * aero.wingAreaM2 * cdTotal;
    const sideForce = groundParkedLock ? 0 : -qDyn * aero.wingAreaM2 * 0.44 * Math.sin(beta);

    _fAero.set(sideForce, 0, -thrustN);
    if (tas > 0.2) {
      _uWind.copy(lv).divideScalar(tas);
      // Drag directly opposes relative airflow
      _fAero.addScaledVector(_uWind, -dragMag);
      // Lift acts perpendicular to airflow toward local +Y
      _liftDir.set(0, 1, 0).addScaledVector(_uWind, -_uWind.y);
      if (_liftDir.lengthSq() > 1e-5) {
        _liftDir.normalize();
      } else {
        _liftDir.set(0, 0, -1);
      }
      _fAero.addScaledVector(_liftDir, liftMag);
    }

    const weightN = aero.massKg * 9.81;
    const aeroLoadG = _fAero.y / weightN;

    // 6. Control Surface Torque, Supersonic Compression, Stability, Damping & Inertia
    const compFactor =
      mach > aero.compMach ? 1 / (1 + Math.pow((mach - aero.compMach) * 1.45, 1.4)) : 1.0;
    const thrustVecWash =
      c.id === 'sukhoi' || c.id === 'f22' ? thrustN * 0.015 : aero.compMach < 0.75 ? thrustN * 0.075 : 0;
    const qEff = (qDyn / (1 + qDyn / 18500)) * compFactor + thrustVecWash;
    const aoaStickTaper = a.ground ? 1 : 1 - THREE.MathUtils.smoothstep(Math.abs(aoa), stallRad * 0.9, stallRad * 1.5) * 0.45;

    // Control authorities scaled by remaining control surfaces
    const pitchAuth = 0.2 + 0.8 * a.damage.tail;
    const yawAuth = 0.15 + 0.85 * a.damage.tail;
    const rollAuth = THREE.MathUtils.clamp(0.12 + 0.44 * a.damage.leftWing + 0.44 * a.damage.rightWing, 0.12, 1.0);

    let tauX = pIn * aero.controlTorque[0] * qEff * aoaStickTaper * pitchAuth;
    let tauY = yIn * aero.controlTorque[1] * qEff * yawAuth;
    let tauZ = rIn * aero.controlTorque[2] * qEff * rollAuth;

    // Aerodynamic asymmetric roll torque from damaged/sheared wings
    const wingArmX = Math.max(2.4, c.hx * 0.52);
    const deltaLift = qDyn * (aero.wingAreaM2 * 0.5) * cl * (rightWingCl - leftWingCl);
    tauZ += deltaLift * wingArmX;

    // Aerodynamic asymmetric yaw torque from parasitic drag difference
    const deltaDrag = qDyn * (aero.wingAreaM2 * 0.5) * (leftExtraCd - rightExtraCd);
    tauY += deltaDrag * wingArmX;

    // Natural aerodynamic pitch stability & progressive stall nose-drop + mild wing drop
    const stabQ = qDyn / (1 + qDyn / 24000);
    tauX -= aoa * aero.controlTorque[0] * 0.34 * stabQ * pitchAuth;
    if (stallSeverity > 0.01) {
      tauX -= Math.sign(aoa || 1) * stallSeverity * aero.inertia[0] * 0.42 * pitchAuth;
      const wingDropBias =
        Math.sin(this.elapsed * 1.4 + a.p.x * 0.05) * 0.7 + (a.w.z >= 0 ? 0.2 : -0.2);
      tauZ += wingDropBias * stallSeverity * aero.inertia[2] * 0.38;
    }

    // Directional fin stability & dihedral roll coupling
    tauY -= Math.sin(beta) * aero.controlTorque[1] * 1.45 * stabQ * (0.2 + 0.8 * a.damage.tail);
    tauZ -= Math.sin(beta) * aero.controlTorque[2] * 0.16 * stabQ;

    // Directional stability collapse and uncommanded fishtailing if tail damaged
    if (a.damage.tail < 0.55 && tas > 16) {
      const fishtailFreq = 2.6 + tas * 0.012;
      const fishtailAmp = (0.55 - a.damage.tail) * 1.5;
      tauY += Math.sin(this.elapsed * fishtailFreq) * fishtailAmp * aero.controlTorque[1] * qEff * 0.35;
    }

    // Atmospheric weather gust torque in flight (faded near runway)
    const altTurbFade = THREE.MathUtils.smoothstep(clearance, 24, 110);
    if (!a.ground && fly && !aban && this.weatherTurbulence > 0.05 && altTurbFade > 0.01 && qEff > 80) {
      const inCloudBoost = a.p.y > 380 && a.p.y < 1040 ? 1.25 : 1.0;
      const turbScale = this.weatherTurbulence * inCloudBoost * altTurbFade * (pil ? 1.0 : 0.4);
      const tPhase = this.elapsed;
      const gustRoll =
        (Math.sin(tPhase * 1.25 + a.p.x * 0.004) * 0.65 + Math.cos(tPhase * 2.15) * 0.35) *
        0.065 *
        turbScale;
      const gustPitch =
        (Math.sin(tPhase * 1.05 + a.p.z * 0.004) * 0.6 + Math.sin(tPhase * 1.95 + 1.2) * 0.4) *
        0.032 *
        turbScale;
      const gustYaw = Math.cos(tPhase * 0.95 + 0.6) * 0.025 * turbScale;
      tauZ += gustRoll * aero.controlTorque[2] * qEff;
      tauX += gustPitch * aero.controlTorque[0] * qEff;
      tauY += gustYaw * aero.controlTorque[1] * qEff;
      if (pil && turbScale > 0.68) {
        this.camShake = Math.max(this.camShake, Math.min(0.055, (turbScale - 0.68) * 0.09));
      }
    }

    // Subtle high-frequency transonic airframe buffeting during Mach 0.96..1.05 crossing
    if (!a.ground && fly && !aban && mach >= 0.96 && mach <= 1.05) {
      const transonicPeak = Math.sin(THREE.MathUtils.clamp((mach - 0.96) / 0.09, 0, 1) * Math.PI);
      const tBuf = this.elapsed * 42 + a.spawnYaw;
      tauZ += Math.sin(tBuf) * 0.028 * transonicPeak * aero.controlTorque[2] * qEff;
      tauX += Math.cos(tBuf * 1.37) * 0.016 * transonicPeak * aero.controlTorque[0] * qEff;
      if (pil) {
        this.camShake = Math.max(this.camShake, 0.016 + transonicPeak * 0.042);
      }
    }

    // Critically-damped Auto-Level wing trim & gentle pitch stability when stick is centered
    _e.setFromQuaternion(a.q, 'YXZ');
    if (pil && !ai && !aban && !a.ground && this.autoLevel && tas > 25) {
      if (Math.abs(rIn) < 0.06) {
        tauZ += THREE.MathUtils.clamp(-_e.z * 0.58 - a.w.z * 0.35, -0.35, 0.35) * aero.controlTorque[2] * qEff;
      }
      if (Math.abs(pIn) < 0.06 && Math.abs(_e.x) < 0.38) {
        tauX += THREE.MathUtils.clamp(-_e.x * 0.14 - a.w.x * 0.25, -0.14, 0.14) * aero.controlTorque[0] * qEff;
      }
    }

    // Aerodynamic angular damping (-dampRate * rho * V * w)
    const rhoV = rho * Math.max(24, tas);
    const tailDampFactor = 0.25 + 0.75 * a.damage.tail;
    tauX -= aero.dampRate[0] * 1.28 * rhoV * a.w.x * tailDampFactor;
    tauY -= aero.dampRate[1] * 1.25 * rhoV * a.w.y * tailDampFactor;
    tauZ -= aero.dampRate[2] * 1.15 * rhoV * a.w.z * rollAuth;

    // 7. World Forces & Spring-Damper Landing Gear Struts
    _fWorld.copy(_fAero).applyQuaternion(a.q);
    _fWorld.y -= weightN;

    _tauLocal.set(tauX, tauY, tauZ);
    _tauWorld.copy(_tauLocal).applyQuaternion(a.q);
    _wWorld.copy(a.w).applyQuaternion(a.q);

    _fwdHoriz.set(0, 0, -1).applyQuaternion(a.q);
    _fwdHoriz.y = 0;
    if (_fwdHoriz.lengthSq() > 1e-5) _fwdHoriz.normalize();
    else _fwdHoriz.set(0, 0, -1);
    _rightHoriz.set(1, 0, 0).applyQuaternion(a.q);
    _rightHoriz.y = 0;
    if (_rightHoriz.lengthSq() > 1e-5) _rightHoriz.normalize();
    else _rightHoriz.set(1, 0, 0);

    const prevGround = a.ground;
    const br = pil ? !!this.keys.Space : ai ? !!a.inp.brake : true;
    const staticSag = aero.gearMaxTravelM * 0.35;

    // Static tricycle weight distribution matching wheel lever arms (0 net resting pitch torque)
    let zMainSum = 0;
    let zMainCount = 0;
    let zNose = -3.5;
    for (const cp of a.contactPoints) {
      if (!cp.w) continue;
      if (cp.v.z < -0.5) {
        zNose = cp.v.z;
      } else {
        zMainSum += cp.v.z;
        zMainCount++;
      }
    }
    const zMain = zMainCount > 0 ? Math.max(0.05, zMainSum / zMainCount) : 1.2;
    const noseShare = THREE.MathUtils.clamp(zMain / Math.max(0.25, zMain - zNose), 0.04, 0.45);
    const mainShare = (1 - noseShare) / Math.max(1, zMainCount);

    let gearForceTotalUp = 0;
    let wheelContactCount = 0;
    let maxWheelPen = -Infinity;
    let maxBodyPen = -Infinity;
    let wheelHit = false;
    let wheelPointX = a.p.x;
    let wheelPointY = a.p.y;
    let wheelPointZ = a.p.z;
    let bodyHit = false;
    let bodyLocalX = 0;
    let hitPointX = a.p.x;
    let hitPointY = a.p.y;
    let hitPointZ = a.p.z;

    for (const cp of a.contactPoints) {
      _ptOffset.copy(cp.v).applyQuaternion(a.q);
      _ptPos.copy(a.p).add(_ptOffset);
      const surfY = this.surfaceHeightAt(_ptPos.x, _ptPos.z, a.p.y);
      const pen = surfY - _ptPos.y;

      // Velocity of contact point: v + w x r
      _ptVel.crossVectors(_wWorld, _ptOffset).add(a.v);

      if (cp.w) {
        if (pen > maxWheelPen) maxWheelPen = pen;
        if (pen > 0) {
          wheelContactCount++;
          wheelHit = true;
          wheelPointX = _ptPos.x;
          wheelPointY = surfY;
          wheelPointZ = _ptPos.z;

          const isNose = cp.v.z < -0.5;
          const share = isNose ? noseShare : mainShare;
          const isGearBroken = a.damage.gear < 0.35;
          const kWheel = ((weightN * share) / staticSag) * (isGearBroken ? 1.9 : 1.0);
          const cWheel = 2 * (isGearBroken ? 0.32 : 0.9) * Math.sqrt(kWheel * aero.massKg * share);

          // Spring-damper oleo strut vertical force (collapsed strut gives hard unyielding bottom contact)
          const fn = Math.max(0, kWheel * pen - cWheel * _ptVel.y);
          _gearForce.set(0, fn, 0);

          // Nosewheel steering on front strut (lost if gear is collapsed)
          const steerAngle = isNose && !isGearBroken ? yIn * 0.36 : 0;
          const cosS = Math.cos(steerAngle);
          const sinS = Math.sin(steerAngle);
          // Steered tire basis in horizontal plane
          const tireFwdX = _fwdHoriz.x * cosS - _rightHoriz.x * sinS;
          const tireFwdZ = _fwdHoriz.z * cosS - _rightHoriz.z * sinS;
          const tireRightX = _rightHoriz.x * cosS + _fwdHoriz.x * sinS;
          const tireRightZ = _rightHoriz.z * cosS + _fwdHoriz.z * sinS;

          const vTireFwd = _ptVel.x * tireFwdX + _ptVel.z * tireFwdZ;
          const vTireLat = _ptVel.x * tireRightX + _ptVel.z * tireRightZ;

          const fLat = -THREE.MathUtils.clamp(vTireLat * aero.massKg * share * 6.5, -fn * 0.88, fn * 0.88);
          // Severe belly-scraping sliding friction (0.74) if gear is collapsed, or parking-brake hold when stationary on apron
          const parkingBrake = groundParkedLock && a.thr <= 0.05;
          const muLong = isGearBroken ? 0.74 : parkingBrake ? 0.85 : 0.012 + (br ? 0.44 : 0);
          const fLong = -THREE.MathUtils.clamp(vTireFwd * 3.0, -1, 1) * fn * muLong;

          _gearForce.x += tireFwdX * fLong + tireRightX * fLat;
          _gearForce.z += tireFwdZ * fLong + tireRightZ * fLat;

          // Continuous spark shower if sliding with collapsed landing gear
          if (isGearBroken && sp > 4) {
            this.spawnScrapeSparks(_c.set(wheelPointX, wheelPointY + 0.1, wheelPointZ), 0.48, _d.set(0, 1, 0), 'ground', sp, false);
          }

          _fWorld.add(_gearForce);
          gearForceTotalUp += fn;

          // Torque r x F_gear (pitch arm calibrated to realistic CG ahead of main gear)
          _torqueTmp.crossVectors(_ptOffset, _gearForce);
          const gearPitchProj = _torqueTmp.dot(_rightHoriz);
          _torqueTmp.addScaledVector(_rightHoriz, -0.64 * gearPitchProj);
          _tauWorld.add(_torqueTmp);
        }
      } else {
        if (pen > maxBodyPen) {
          maxBodyPen = pen;
          hitPointX = _ptPos.x;
          hitPointY = surfY;
          hitPointZ = _ptPos.z;
        }
        if (pen > 0) {
          bodyHit = true;
          if (Math.abs(cp.v.x) > Math.abs(bodyLocalX)) bodyLocalX = cp.v.x;
        }
      }
    }

    const maxPenetration = Math.max(maxWheelPen, maxBodyPen);
    a.ground = prevGround
      ? wheelContactCount > 0 || (maxPenetration > -0.08 && a.v.y <= 0.9)
      : maxPenetration > 0;

    // 8. Integrate Rigid-Body Linear & Angular Motion (F/m & I^-1 * tau)
    const invMass = 1 / aero.massKg;
    a.v.addScaledVector(_fWorld, invMass * dt);
    const vSafetyCap = Math.max(c.vmax * 1.25, aero.maxSpeedMs * 1.15);
    if (a.v.length() > vSafetyCap) a.v.setLength(vSafetyCap);

    // Mobile-friendly Velocity-Match Stabilization inside tanker 60m assist zone
    if (pil && this.refuelAssist && !a.ground) {
      const velDamp = 1 - Math.exp(-4.2 * dt);
      a.v.x += (this.tanker.v.x - a.v.x) * velDamp;
      a.v.z += (this.tanker.v.z - a.v.z) * velDamp;
      const altErr = this.tankerZoneTarget.y - a.p.y;
      const targetVy = THREE.MathUtils.clamp(altErr * 1.35, -14, 14);
      a.v.y += (targetVy - a.v.y) * (1 - Math.exp(-4.8 * dt));
      a.w.multiplyScalar(Math.exp(-5.0 * dt));
    }

    a.p.addScaledVector(a.v, dt);

    // Transform total torque back to local body axes & apply Euler's equation
    _tauLocal.copy(_tauWorld).applyQuaternion(_q);
    const ix = aero.inertia[0];
    const iy = aero.inertia[1];
    const iz = aero.inertia[2];
    const alphaX = (_tauLocal.x - (iz - iy) * a.w.y * a.w.z) / ix;
    const alphaY = (_tauLocal.y - (ix - iz) * a.w.z * a.w.x) / iy;
    const alphaZ = (_tauLocal.z - (iy - ix) * a.w.x * a.w.y) / iz;

    a.w.x = THREE.MathUtils.clamp(a.w.x + alphaX * dt, -10, 10);
    a.w.y = THREE.MathUtils.clamp(a.w.y + alphaY * dt, -8, 8);
    a.w.z = THREE.MathUtils.clamp(a.w.z + alphaZ * dt, -12, 12);
    _dq.setFromEuler(_e.set(a.w.x * dt, a.w.y * dt, a.w.z * dt, 'XYZ'));
    a.q.multiply(_dq).normalize();

    if (pil && this.refuelAssist && !a.ground) {
      const stickEffort = Math.min(1, Math.hypot(pIn, rIn) * 1.8);
      if (stickEffort < 0.85) {
        a.q.slerp(this.tanker.q, (1 - stickEffort) * (1 - Math.exp(-1.9 * dt)));
      }
    }

    // Hard strut stop & ground/water/body impact checks
    if (maxWheelPen > aero.gearMaxTravelM * 1.18) {
      a.p.y += maxWheelPen - aero.gearMaxTravelM * 1.18;
    } else if (maxBodyPen > 0) {
      a.p.y += maxBodyPen;
    }

    if (maxPenetration > 0) {
      const groundH = groundHeightAt(a.p.x, a.p.z);
      const overCarrier = this.surfaceHeightAt(a.p.x, a.p.z, a.p.y) > 2;
      const verticalImpact = -a.v.y;

      if (aban && (verticalImpact > 5 || sp > 14)) {
        this.crashAircraft(a);
        return;
      }

      if (fly && groundH < -1 && !overCarrier && a.p.y < c.y0 + 1.5 && (verticalImpact > 6 || sp > 18)) {
        this.crashAircraft(a);
        return;
      }

      _e.setFromQuaternion(a.q, 'YXZ');
      const severeNoseDive = _e.x < -0.58 && sp > 48;
      if (fly && (verticalImpact > 21.5 || severeNoseDive)) {
        this.crashAircraft(a);
        return;
      }

      // Landing gear structural failure on hard touchdown (vertical descent > 5 m/s or steep bank angle > 22 deg)
      if (fly && wheelHit && (!prevGround || verticalImpact > 4.2)) {
        const bankAngle = Math.abs(_e.z);
        if (verticalImpact > 5.0 || bankAngle > 0.38) {
          const gearDmg = Math.min(1.0, (verticalImpact - 4.2) * 0.28 + (bankAngle > 0.38 ? 0.45 : 0));
          this.inflictComponentDamage(a, _c.set(0, -1, 0), gearDmg, 'hardLanding');
          if (a.damage.gear < 0.35 && pil) {
            this.audio.playStructuralSnap();
            this.camShake = Math.max(this.camShake, 0.75);
          }
        }
      }

      // Tire smoke puff + rubber chirp on touchdown or hard gear bounce
      if (fly && wheelHit && (!prevGround || verticalImpact > 2.8) && sp > 14) {
        this.spawnTireSmoke(
          _c.set(wheelPointX, wheelPointY + 0.12, wheelPointZ),
          THREE.MathUtils.clamp(0.45 + verticalImpact * 0.08 + sp * 0.004, 0.45, 1.0),
          !prevGround,
          sp
        );
      }

      if (fly && bodyHit && sp > 6) {
        this.spawnScrapeSparks(
          _c.set(hitPointX, hitPointY + 0.2, hitPointZ),
          Math.min(1, 0.4 + sp / 55 + verticalImpact * 0.03),
          _d.set(0, 1, 0),
          overCarrier ? 'carrier' : 'ground',
          sp,
          !prevGround || verticalImpact > 5
        );
        a.v.x *= Math.max(0.75, 1 - 2.6 * dt);
        a.v.z *= Math.max(0.75, 1 - 2.6 * dt);
        if (Math.abs(bodyLocalX) > 2.2) {
          const sign = Math.sign(bodyLocalX);
          a.w.z += sign * 1.45 * dt;
          a.w.y -= sign * 0.85 * dt;
        }
        _q.copy(a.q).invert();
        _c.set(hitPointX, hitPointY, hitPointZ).sub(a.p).applyQuaternion(_q);
        const dmg = (verticalImpact > 5 ? verticalImpact * 0.04 : 0.015) + (sp > 20 ? 0.16 * dt : 0.04 * dt);
        this.inflictComponentDamage(a, _c, dmg, 'impact');
        this.camShake = Math.max(this.camShake, Math.min(0.6, sp * 0.008 + verticalImpact * 0.035));
        if (a.hull <= 0) {
          return;
        }
        if (a.v.y < 0 && verticalImpact > 2.0) {
          a.v.y = Math.min(26, verticalImpact * 0.56);
          this.camShake = Math.max(this.camShake, Math.min(0.65, verticalImpact * 0.038));
        } else if (a.v.y < 0) {
          a.v.y = 0;
        }
      } else if (fly && maxWheelPen > aero.gearMaxTravelM * 1.15 && verticalImpact > 8.0) {
        // Bottomed-out landing gear slam: structural damage + spark burst + bounce
        this.inflictComponentDamage(a, _c.set(0, -1, 0), (verticalImpact - 7.5) * 0.08, 'hardLanding');
        this.camShake = Math.max(this.camShake, Math.min(0.72, (verticalImpact - 8.0) * 0.055));
        this.spawnScrapeSparks(
          _c.set(wheelPointX, wheelPointY + 0.15, wheelPointZ),
          0.72,
          _d.set(0, 1, 0),
          overCarrier ? 'carrier' : 'ground',
          sp,
          true
        );
        if (a.hull <= 0) {
          return;
        }
        if (a.v.y < 0) {
          a.v.y = Math.min(22, verticalImpact * 0.45);
        }
      } else if (maxWheelPen > aero.gearMaxTravelM * 1.15 && a.v.y < 0) {
        a.v.y = 0;
      }
    }

    // 9. Carrier Arrestor Wire (-4G braking within 80m), Ground Braking Smoke & PAPI Lights
    if (!a.ground && pil) {
      this.arrestedWireEngaged = false;
    }
    if (a.ground && a.crash <= 0) {
      _e.setFromQuaternion(a.q, 'YXZ');
      const car = this.world.carrier;
      const onCarrierDeck =
        pil &&
        Math.abs(a.p.x - car.x) <= car.halfW - 1.5 &&
        Math.abs(a.p.z - car.z) <= car.halfL - 2 &&
        Math.abs(a.p.y - (car.deckY + c.y0)) < 2.6;

      if (pil && this.arrestedWireEngaged) {
        if (!onCarrierDeck || !this.tailhookDown) {
          this.arrestedWireEngaged = false;
        } else if (sp <= 1.2) {
          a.v.set(0, 0, 0);
          a.w.set(0, 0, 0);
          a.thr = 0;
          this.arrestedWireEngaged = false;
          this.carrierTrapCooldown = 5.0;
          this.tailhookDown = false;
          this.missionMgr.markCarrierTrapped();
          this.say(
            'trap',
            'إيقاف بكابل الحاملة',
            'إمساك مثالي بكابل الإيقاف على حاملة الطائرات! هبوط أسطوري يا كابتن.',
            10,
            true
          );
        } else {
          a.thr = 0;
          a.spool *= Math.exp(-7 * dt);
          const arrestDecel = Math.max(4.0 * 9.81, (sp * sp) / (2 * 72));
          const nextSp = Math.max(0, sp - arrestDecel * dt);
          a.v.multiplyScalar(nextSp / sp);
          this.camShake = Math.max(this.camShake, 0.42);
          this.arrestedWireTimer = 2.6;
          this.spawnTireSmoke(_c.set(a.p.x, car.deckY + 0.15, a.p.z), 0.9, false, sp);
        }
      } else if (onCarrierDeck && sp > 14 && this.carrierTrapCooldown <= 0) {
        const nearWire = car.wireZ.some((wz) => Math.abs(a.p.z - wz) < 14);
        if (nearWire) {
          const aligned = Math.abs(_e.z) < 0.35;
          if (this.tailhookDown && aligned && sp < 105) {
            this.arrestedWireEngaged = true;
            a.thr = 0;
            a.spool *= Math.exp(-7 * dt);
            const arrestDecel = Math.max(4.0 * 9.81, (sp * sp) / (2 * 72));
            const nextSp = Math.max(0, sp - arrestDecel * dt);
            a.v.multiplyScalar(nextSp / sp);
            this.camShake = Math.max(this.camShake, 0.55);
            this.arrestedWireTimer = 2.6;
            this.audio.playArrestorTrap();
            this.spawnTireSmoke(_c.set(a.p.x, car.deckY + 0.15, a.p.z), 0.95, true, sp);
          } else {
            this.carrierTrapCooldown = 3.0;
            this.bolterWarningTimer = 2.5;
            this.say(
              'bolter',
              'تحذير بولتر (Bolter)',
              'أخطأت كابل الإيقاف أو لم تنزل الخطاف (H)! ارفع الدفع فوراً وحلّق مجدداً!',
              6,
              true
            );
          }
        }
      }

      if (pil && br && sp > 22) {
        const groundSurfaceY = this.surfaceHeightAt(a.p.x, a.p.z, a.p.y);
        this.spawnTireSmoke(
          _c.set(a.p.x, groundSurfaceY + 0.15, a.p.z),
          THREE.MathUtils.clamp(sp / 85, 0.4, 1.0),
          false,
          sp
        );
      }

      if (a.ground && groundParkedLock && a.thr <= 0.05 && sp < 1.2) {
        a.v.x *= Math.max(0, 1 - 12 * dt);
        a.v.z *= Math.max(0, 1 - 12 * dt);
        a.w.multiplyScalar(Math.max(0, 1 - 12 * dt));
      }

      if (!fly && a.v.lengthSq() < 0.04) {
        a.v.set(0, 0, 0);
        a.w.set(0, 0, 0);
      }
    }

    // 10. Real-Time G-Force (Lift / Weight) & Sonic Boom Detection
    const rawG = a.ground ? aeroLoadG + gearForceTotalUp / weightN : aeroLoadG;
    a.liftLoadG = THREE.MathUtils.clamp(rawG, -6.5, 13.5);

    if (pil && fly && a.crash <= 0) {
      if (!a.ground && Math.abs(a.p.x) < 320 && a.p.z > -2800 && a.p.z < 900 && clearance < 420) {
        const distThresh = Math.max(45, Math.abs(a.p.z));
        const glideAngle = Math.atan2(clearance, distThresh);
        this.papiSlope = glideAngle > 0.074 ? 'high' : glideAngle < 0.036 ? 'low' : 'on';
      } else {
        this.papiSlope = 'off';
      }
      this.world.updatePapiLights(this.papiSlope);

      this.gForce += (a.liftLoadG - this.gForce) * (1 - Math.exp(-10 * dt));
      this.audio.updateGForce(this.gForce);

      if (Math.abs(this.gForce) > 6.8 && !a.ground) {
        this.camShake = Math.max(this.camShake, Math.min(0.11, (Math.abs(this.gForce) - 6.8) * 0.025));
      }

      const supersonicNow = mach >= 1.0 && tas >= speedOfSound;
      if (supersonicNow && !this.wasSupersonic && !a.ground) {
        this.audio.playSonicBoom(1, 0);
        this.sonicBoomFlash = 1.0;
        this.camShake = Math.max(this.camShake, 0.34);
        this.spawnParticle('ring', a.p.x, a.p.y, a.p.z, 0, 0, 0, 0xffffff, 2.5, 28, 0.52);
        this.say(
          'sonic',
          'اختراق حاجز الصوت',
          'بوووم! اخترقت حاجز الصوت (Mach 1) وبدأ انضغاط موجات الصدمة!',
          20,
          true
        );
      }
      this.wasSupersonic = supersonicNow;
    }

    // Carrier Hull Side Collision (sharp bounce against carrier steel walls beneath deck)
    const car = this.world.carrier;
    if (
      fly &&
      a.p.y < car.deckY - 1.2 &&
      Math.abs(a.p.x - car.x) < car.halfW + Math.min(a.config.hx * 0.4, 3.8) &&
      Math.abs(a.p.z - car.z) < car.halfL + 4
    ) {
      const dx = a.p.x - car.x;
      const dz = a.p.z - car.z;
      const penX = car.halfW + 3.5 - Math.abs(dx);
      const penZ = car.halfL + 3.5 - Math.abs(dz);
      let nx = 0;
      let nz = 0;
      if (penX < penZ) {
        nx = dx >= 0 ? 1 : -1;
        a.p.x = car.x + nx * (car.halfW + 3.85);
      } else {
        nz = dz >= 0 ? 1 : -1;
        a.p.z = car.z + nz * (car.halfL + 3.85);
      }
      const vn = -(a.v.x * nx + a.v.z * nz);
      if (vn > 34) {
        this.crashAircraft(a);
        return;
      }
      if (vn > 0) {
        const restitution = 0.65;
        const imp = (1 + restitution) * vn;
        a.v.x += nx * imp;
        a.v.z += nz * imp;
      }
      const vDotN = a.v.x * nx + a.v.z * nz;
      const tanDrag = 0.82;
      a.v.x = (a.v.x - nx * vDotN) * tanDrag + nx * vDotN;
      a.v.z = (a.v.z - nz * vDotN) * tanDrag + nz * vDotN;
      _q.copy(a.q).invert();
      _c.set(a.p.x - nx * 2.5, a.p.y, a.p.z - nz * 2.5).sub(a.p).applyQuaternion(_q);
      this.inflictComponentDamage(a, _c, Math.max(0.04, vn * 0.015), 'impact');
      this.camShake = Math.max(this.camShake, Math.min(0.8, 0.25 + Math.max(0, vn) * 0.03));
      this.spawnScrapeSparks(
        _c.set(a.p.x - nx * 2.5, a.p.y, a.p.z - nz * 2.5),
        Math.min(1, 0.55 + Math.max(0, vn) * 0.02),
        _d.set(nx, 0.25, nz),
        'carrier',
        a.v.length(),
        vn > 8
      );
      if (a.hull <= 0) {
        return;
      }
    }

    // Building & Skyscraper Collisions (sharp bounce & directional sparks on medium hits; explosion on violent impact)
    if (fly && this.resolveBuildingCollisionForPlane(a, dt)) {
      return;
    }
  }

  private checkAircraftCollisions(): void {
    for (let i = 0; i < this.aircraft.length; i++) {
      const a = this.aircraft[i];
      if (a.crash > 0) continue;
      const aMoving = (this.mode === 'fly' && a === this.cur) || !!a.ai || !!a.abandoned || a.v.lengthSq() > 36;
      if (!aMoving) continue;

      for (let j = i + 1; j < this.aircraft.length; j++) {
        const b = this.aircraft[j];
        if (b.crash > 0) continue;
        const minHoriz = (a.config.hx + b.config.hx) * 0.42;
        const dy = a.p.y - b.p.y;
        if (Math.abs(dy) > 5.0) continue;
        const dx = a.p.x - b.p.x;
        const dz = a.p.z - b.p.z;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minHoriz * minHoriz) continue;

        const dist = Math.sqrt(distSq) || 0.1;
        _c.set(dx / dist, 0, dz / dist); // normal pointing from b to a
        _d.copy(a.v).sub(b.v);
        const relClosing = -_d.dot(_c);

        if (relClosing > 34) {
          // Violent high-speed collision -> explosion!
          this.crashAircraft(a);
          this.crashAircraft(b);
          return;
        }

        // Sharp elastic bounce apart + tangential scrape + metallic sparks!
        const overlap = minHoriz - dist + 0.25;
        a.p.addScaledVector(_c, overlap * 0.55);
        b.p.addScaledVector(_c, -overlap * 0.55);
        if (relClosing > 0) {
          const impulse = (1 + 0.62) * relClosing * 0.5;
          a.v.addScaledVector(_c, impulse);
          b.v.addScaledVector(_c, -impulse);
        }
        a.v.multiplyScalar(0.9);
        b.v.multiplyScalar(0.9);
        const dmg = Math.max(0.04, relClosing * 0.015);
        _q.copy(a.q).invert();
        _ptOffset.copy(b.p).sub(a.p).applyQuaternion(_q);
        this.inflictComponentDamage(a, _ptOffset, dmg, 'impact');
        _q.copy(b.q).invert();
        _ptOffset.copy(a.p).sub(b.p).applyQuaternion(_q);
        this.inflictComponentDamage(b, _ptOffset, dmg, 'impact');
        this.spawnScrapeSparks(
          _a.copy(a.p).lerp(b.p, 0.5),
          Math.min(1, 0.55 + Math.max(0, relClosing) * 0.02),
          _c,
          'aircraft',
          Math.max(a.v.length(), b.v.length()),
          relClosing > 5
        );
      }
    }
  }

  private stepFlares(dt: number): void {
    for (const fl of this.flares) {
      if (!fl.active) continue;
      fl.age += dt;
      if (fl.age >= fl.maxAge) {
        fl.active = false;
        fl.mesh.visible = false;
        continue;
      }
      fl.v.y -= 9.81 * dt;
      fl.v.multiplyScalar(Math.max(0.88, 1 - 0.85 * dt));
      fl.p.addScaledVector(fl.v, dt);
      fl.mesh.position.copy(fl.p).sub(this.renderOrigin);
      const t = fl.age / fl.maxAge;
      fl.mesh.scale.setScalar(THREE.MathUtils.lerp(1.2, 0.35, t));
      (fl.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.85;

      fl.smokeTimer += dt;
      if (fl.smokeTimer >= 0.055) {
        fl.smokeTimer = 0;
        this.spawnParticle('smoke', fl.p.x, fl.p.y, fl.p.z, 0, 1.5, 0, 0xfef3c7, 0.45, 2.2, 0.55);
      }
    }
  }

  private fireSamiMissile(from: AircraftInstance, target: AircraftInstance): void {
    const slot = this.missiles.find((m) => !m.active);
    if (!slot) return;
    _noseDir.copy(LOCAL_FWD).applyQuaternion(from.q).normalize();
    const fwdVel = Math.max(40, from.v.dot(_noseDir));
    slot.railSide = Math.random() > 0.5 ? 1 : -1;
    slot.railOffset.set(Math.min(4.2, from.config.hx * 0.42) * slot.railSide, -0.72, 0.25);
    _a.copy(slot.railOffset).applyQuaternion(from.q).add(from.p);

    slot.active = true;
    slot.owner = from;
    slot.target = target;
    slot.targetBoss = false;
    slot.flareTarget = null;
    slot.age = 0;
    slot.smokeTimer = 0;
    slot.ignited = false;
    slot.launchSpeed = fwdVel;
    slot.p.copy(_a);
    slot.v.copy(from.v).addScaledVector(_noseDir, 24);
    slot.q.copy(from.q);
    slot.mesh.position.copy(slot.p).sub(this.renderOrigin);
    slot.mesh.quaternion.copy(slot.q);
    slot.plume.visible = false;
    slot.mesh.visible = true;

    const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(slot.p);
    const distScale = THREE.MathUtils.clamp(1 - camDist / 3200, 0.16, 1);
    this.audio.playMissileLaunch(distScale, camDist);
  }

  public summonMegatron(): void {
    if (this.phase !== 'playing') return;
    if (this.boss.phase !== 'idle' && this.boss.phase !== 'defeated') return;

    this.audio.unlock();
    const playerPos = this.mode === 'fly' ? this.cur.p : this.man.p;
    const defaultSiteX = 410;
    const defaultSiteZ = -440;
    let siteX = defaultSiteX;
    let siteZ = defaultSiteZ;

    if (Math.hypot(playerPos.x - defaultSiteX, playerPos.z - defaultSiteZ) > 3600) {
      _fwd.set(0, 0, -1).applyQuaternion(this.cur.q);
      const tryX = playerPos.x + _fwd.x * 1100;
      const tryZ = playerPos.z + _fwd.z * 1100;
      if (groundHeightAt(tryX, tryZ) > 0.5) {
        siteX = tryX;
        siteZ = tryZ;
      }
    }
    const siteY = Math.max(0.5, groundHeightAt(siteX, siteZ));
    this.boss.landingSite.set(siteX, siteY, siteZ);
    this.boss.entryStart.set(siteX + 950, siteY + 2350, siteZ - 1450);

    this.boss.phase = 'storm';
    this.boss.mode = 'jet';
    this.boss.hp = this.boss.maxHp;
    this.boss.p.copy(this.boss.entryStart);
    this.boss.v.set(0, 0, 0);
    this.boss.transformT = 0;
    this.boss.phaseTimer = 0;
    this.boss.lightningTimer = 0.55;
    this.boss.stageFlags = [false, false, false, false];
    this.boss.roarPlayed = false;
    this.boss.attackTimer = 1.6;
    this.boss.chargeTimer = 0;
    this.boss.burstLeft = 0;
    this.boss.burstCooldown = 0;
    this.boss.leapActive = false;
    this.boss.leapCooldown = 2.8;
    this.boss.stompTimer = 0;
    this.boss.recoilTimer = 0;
    this.boss.staggerTimer = 0;
    this.boss.jetMissileCooldown = 2.5;
    this.boss.jetStrafeTimer = 0;
    this.boss.dyingBurstTimer = 0;
    this.boss.lockedByPlayer = false;
    this.megatronRig.root.visible = false;
    this.bossWarningLaser.visible = false;

    this.bossLightning.triggerStrike(siteX, siteY + 1150, siteZ, siteY, 210);
    this.audio.playThunder(1.05, 0);
    this.camShake = Math.max(this.camShake, 0.8);
    this.say(
      'megatron_summon',
      'تحذير حرج: عاصفة سايبرترون!',
      'تحذير! السماء تتلبد بالعواصف — كيان فضائي هائل يهبط من الغلاف الجوي: ميغاترون قادم!',
      8,
      true
    );
    this.emitHud();
  }

  private damageMegatron(amount: number, hitPos: THREE.Vector3): void {
    if (!this.isBossTargetable() || this.boss.hp <= 0) return;
    this.boss.hp = Math.max(0, this.boss.hp - Math.round(amount));
    this.boss.staggerTimer = Math.max(this.boss.staggerTimer, 0.45);
    this.spawnExplosion(hitPos, 1.15);
    this.bossLightning.triggerFlashAt(hitPos.x, hitPos.y, hitPos.z, 12);

    if (this.boss.hp <= 0) {
      this.boss.phase = 'dying';
      this.boss.phaseTimer = 0;
      this.boss.dyingBurstTimer = 0.08;
      this.boss.chargeTimer = 0;
      this.boss.burstLeft = 0;
      this.boss.lockedByPlayer = false;
      this.bossWarningLaser.visible = false;
      this.audio.playMegatronRoar();
      this.say(
        'megatron_dying',
        'انهيار ميغاترون!',
        'إصابة قاتلة! دروع ميغاترون تنهار بالطاقة الكهربائية!',
        6,
        true
      );
    }
  }

  private fireBossMissile(fromPos: THREE.Vector3, initVel: THREE.Vector3, target: AircraftInstance): void {
    const slot = this.missiles.find((m) => !m.active);
    if (!slot) return;
    _noseDir.copy(initVel).normalize();
    slot.active = true;
    slot.owner = null;
    slot.target = target;
    slot.targetBoss = false;
    slot.flareTarget = null;
    slot.age = 0.22; // Already ignited alien plasma rocket
    slot.smokeTimer = 0;
    slot.ignited = true;
    slot.launchSpeed = initVel.length();
    slot.p.copy(fromPos);
    slot.v.copy(initVel);
    slot.q.setFromUnitVectors(LOCAL_FWD, _noseDir);
    slot.mesh.position.copy(slot.p).sub(this.renderOrigin);
    slot.mesh.quaternion.copy(slot.q);
    slot.plume.visible = true;
    slot.mesh.visible = true;

    const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(slot.p);
    this.audio.playMissileLaunch(THREE.MathUtils.clamp(1 - camDist / 3400, 0.25, 1), camDist);
  }

  private fireBossPlasmaBolt(fromPos: THREE.Vector3, targetPos: THREE.Vector3, speed = 460): void {
    const slot = this.bossPlasmaBolts.find((b) => !b.active);
    if (!slot) return;
    _bossAimVec.copy(targetPos).sub(fromPos);
    const d = Math.max(1, _bossAimVec.length());
    _bossAimVec.divideScalar(d);
    // Slight realistic scatter
    _bossAimVec.x += (Math.random() - 0.5) * 0.032;
    _bossAimVec.y += (Math.random() - 0.5) * 0.026;
    _bossAimVec.z += (Math.random() - 0.5) * 0.032;
    _bossAimVec.normalize();

    slot.active = true;
    slot.age = 0;
    slot.maxAge = 5.0;
    slot.p.copy(fromPos);
    slot.v.copy(_bossAimVec).multiplyScalar(speed);
    slot.mesh.position.copy(slot.p).sub(this.renderOrigin);
    slot.mesh.visible = true;

    this.spawnFire('flash', fromPos.x, fromPos.y, fromPos.z, 0, 0, 0, 0xe879f9, 3.2, 11.5, 0.16, 1.0, false, 0, 0, 1.0, false, false);
    this.bossLightning.triggerFlashAt(fromPos.x, fromPos.y, fromPos.z, 14);
    const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(fromPos);
    this.audio.playFusionCannonFire(THREE.MathUtils.clamp(1 - camDist / 3200, 0.25, 1));
  }

  private stepBossPlasmaBolts(dt: number): void {
    for (const pb of this.bossPlasmaBolts) {
      if (!pb.active) continue;
      pb.age += dt;
      if (pb.age >= pb.maxAge) {
        pb.active = false;
        pb.mesh.visible = false;
        continue;
      }
      pb.p.addScaledVector(pb.v, dt);
      pb.mesh.position.copy(pb.p).sub(this.renderOrigin);

      if (Math.random() < dt * 32) {
        this.spawnFire('fire', pb.p.x, pb.p.y, pb.p.z, 0, 0, 0, 0xc084fc, 1.3, 2.8, 0.14, 0.85, false, 0, 0, 1.0, false, false);
      }

      if (this.mode === 'fly' && this.cur.crash <= 0 && pb.p.distanceTo(this.cur.p) < 19) {
        pb.active = false;
        pb.mesh.visible = false;
        this.spawnExplosion(pb.p, 1.45);
        _q.copy(this.cur.q).invert();
        _ptOffset.copy(pb.p).sub(this.cur.p).applyQuaternion(_q);
        this.inflictComponentDamage(this.cur, _ptOffset, 0.28, 'missile');
        this.camShake = Math.max(this.camShake, 1.4);
        continue;
      }

      const surfY = this.surfaceHeightAt(pb.p.x, pb.p.z, pb.p.y);
      if (pb.p.y <= surfY + 0.5) {
        pb.active = false;
        pb.mesh.visible = false;
        this.spawnExplosion(pb.p, 1.15);
      }
    }
  }

  private stepBoss(dt: number): void {
    const b = this.boss;
    const playerPos = this.mode === 'fly' ? this.cur.p : this.man.p;

    // Optional altitude trigger once per session if player climbs past 3,000m
    if (
      b.phase === 'idle' &&
      !b.altitudeAutoTriggered &&
      this.mode === 'fly' &&
      playerPos.y > 3000
    ) {
      b.altitudeAutoTriggered = true;
      this.summonMegatron();
      return;
    }

    const stormActive =
      b.phase === 'storm' ||
      b.phase === 'entry' ||
      b.phase === 'transform' ||
      b.phase === 'mech' ||
      b.phase === 'jet' ||
      b.phase === 'dying';
    const targetStorm = stormActive ? 1 : 0;
    b.stormBlend += (targetStorm - b.stormBlend) * (1 - Math.exp((stormActive ? -1.4 : -0.45) * dt));

    // Random jagged storm lightning strikes during active encounter
    if (stormActive) {
      b.lightningTimer -= dt;
      if (b.lightningTimer <= 0) {
        b.lightningTimer = b.phase === 'storm' ? 0.55 + Math.random() * 0.6 : 2.4 + Math.random() * 3.0;
        const ang = Math.random() * Math.PI * 2;
        const rad = 180 + Math.random() * 1400;
        const lx = b.p.x + Math.cos(ang) * rad;
        const lz = b.p.z + Math.sin(ang) * rad;
        const ly = Math.max(0, groundHeightAt(lx, lz));
        this.bossLightning.triggerStrike(lx, ly + 1150, lz, ly, 190);
        const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(_a.set(lx, ly + 150, lz));
        this.audio.playThunder(THREE.MathUtils.clamp(1.1 - camDist / 4500, 0.3, 1.1), camDist);
      }
    }

    if (b.stompTimer > 0) b.stompTimer = Math.max(0, b.stompTimer - dt * 2.2);
    if (b.recoilTimer > 0) b.recoilTimer = Math.max(0, b.recoilTimer - dt * 4.5);
    if (b.staggerTimer > 0) b.staggerTimer = Math.max(0, b.staggerTimer - dt * 2.4);

    if (b.phase === 'idle' || b.phase === 'defeated') {
      this.megatronRig.root.visible = false;
      this.bossWarningLaser.visible = false;
      return;
    }

    b.phaseTimer += dt;

    if (b.phase === 'storm') {
      this.megatronRig.root.visible = false;
      if (b.phaseTimer >= 2.2) {
        b.phase = 'entry';
        b.phaseTimer = 0;
        b.p.copy(b.entryStart);
        b.mode = 'jet';
        b.transformT = 0;
        this.megatronRig.root.visible = true;
        this.audio.playSonicBoom(1.0, 400);
      }
      return;
    }

    if (b.phase === 'entry') {
      const dur = 2.85;
      const u = THREE.MathUtils.clamp(b.phaseTimer / dur, 0, 1);
      const eased = u * u * (0.4 + 0.6 * u);
      b.p.lerpVectors(b.entryStart, b.landingSite, eased);
      _a.copy(b.landingSite).sub(b.entryStart).normalize();
      b.yaw = Math.atan2(-_a.x, -_a.z);
      b.pitch = Math.asin(THREE.MathUtils.clamp(_a.y, -0.95, 0.95));
      b.jetRoll = this.elapsed * 3.2;
      b.transformT = 0;

      // Fiery purple re-entry meteor trail & sparks
      if (Math.random() < dt * 65) {
        this.spawnFire(
          'fire',
          b.p.x + (Math.random() - 0.5) * 6,
          b.p.y + (Math.random() - 0.5) * 6,
          b.p.z + (Math.random() - 0.5) * 6,
          -_a.x * 45 + (Math.random() - 0.5) * 20,
          -_a.y * 45 + (Math.random() - 0.5) * 20,
          -_a.z * 45 + (Math.random() - 0.5) * 20,
          Math.random() > 0.35 ? 0xc084fc : 0xf472b6,
          4.5,
          14.5,
          0.35,
          0.95,
          false,
          4,
          0,
          1.2,
          false,
          false
        );
        this.spawnSmoke(
          b.p.x,
          b.p.y,
          b.p.z,
          (Math.random() - 0.5) * 14,
          4,
          (Math.random() - 0.5) * 14,
          0x4c1d95,
          4.2,
          18.0,
          1.8,
          0.68,
          0.6,
          2.2,
          1.2,
          0x1e1b4b
        );
      }

      if (u >= 1) {
        // Colossal meteor ground impact!
        b.p.copy(b.landingSite);
        b.phase = 'transform';
        b.phaseTimer = 0;
        b.pitch = 0;
        b.jetRoll = 0;
        b.yaw = Math.atan2(-(playerPos.x - b.p.x), -(playerPos.z - b.p.z));
        this.audio.playMeteorImpact(1.15);
        this.spawnExplosion(b.p, 2.8, true);
        this.spawnGroundCrater(b.p.x, b.p.z, 68);
        this.spawnRing(b.p.x, b.p.y + 1.0, b.p.z, 0, 0.25, 0, 0xc084fc, 8, 155, 1.25, 0.95);
        this.bossLightning.triggerStrike(b.p.x, b.p.y + 980, b.p.z, b.p.y + 4, 130);
        this.camShake = Math.max(this.camShake, 3.6);
      }
      return;
    }

    if (b.phase === 'transform') {
      const dur = 3.5;
      const u = THREE.MathUtils.clamp(b.phaseTimer / dur, 0, 1);
      b.transformT = u;
      b.mode = u > 0.5 ? 'mech' : 'jet';
      const targetYaw = Math.atan2(-(playerPos.x - b.p.x), -(playerPos.z - b.p.z));
      b.yaw += _wrap(targetYaw - b.yaw) * Math.min(1, 2.5 * dt);

      const thresholds = [0.06, 0.28, 0.56, 0.80];
      for (let si = 0; si < 4; si++) {
        if (!b.stageFlags[si] && u >= thresholds[si]) {
          b.stageFlags[si] = true;
          this.audio.playMegatronTransformStage(si);
          this.bossLightning.triggerFlashAt(b.p.x, b.p.y + 12, b.p.z, 12);
          for (let sp = 0; sp < 14; sp++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 12 + Math.random() * 24;
            this.spawnFire(
              'spark',
              b.p.x + (Math.random() - 0.5) * 7,
              b.p.y + 5 + Math.random() * 16,
              b.p.z + (Math.random() - 0.5) * 7,
              Math.cos(ang) * spd,
              8 + Math.random() * 18,
              Math.sin(ang) * spd,
              sp % 2 === 0 ? 0x38bdf8 : 0xd946ef,
              1.1,
              0.25,
              0.55,
              1.0,
              false,
              0,
              22,
              0.8,
              false,
              false
            );
          }
        }
      }

      if (!b.roarPlayed && u >= 0.90) {
        b.roarPlayed = true;
        b.stompTimer = 1.0;
        this.audio.playMegatronRoar();
        this.spawnRing(b.p.x, b.p.y + 0.8, b.p.z, 0, 0.2, 0, 0xe879f9, 5, 92, 0.95, 0.9);
        this.camShake = Math.max(this.camShake, 2.1);
        this.say(
          'megatron_rise',
          'MEGATRON — زعيم السايبرترون!',
          'لقد تحوّل ميغاترون إلى هيئته القتالية العملاقة! استهدفه بالصواريخ [X] والقنابل [B]!',
          8,
          true
        );
      }

      if (u >= 1) {
        b.phase = 'mech';
        b.mode = 'mech';
        b.phaseTimer = 0;
        b.transformT = 1;
        b.attackTimer = 1.4;
      }
      return;
    }

    if (b.phase === 'mech') {
      b.mode = 'mech';
      b.transformT = Math.min(1, b.transformT + dt * 1.15);
      b.pitch = 0;
      b.jetRoll = 0;

      const dx = playerPos.x - b.p.x;
      const dz = playerPos.z - b.p.z;
      const horizDist = Math.hypot(dx, dz);
      const dist3d = b.p.distanceTo(playerPos);
      const targetYaw = Math.atan2(-dx, -dz);
      b.yaw += _wrap(targetYaw - b.yaw) * Math.min(1, 2.6 * dt);

      // Handle Jet-Assisted Rocket Leap or Ground Stride
      if (b.leapActive) {
        b.leapVy -= 34 * dt;
        b.p.x += b.leapVx * dt;
        b.p.y += b.leapVy * dt;
        b.p.z += b.leapVz * dt;
        if (Math.random() < dt * 45) {
          this.spawnFire('fire', b.p.x, b.p.y + 8, b.p.z, 0, -14, 0, 0xc084fc, 2.8, 7.5, 0.25, 0.9, false, 2, 0, 1.2, false, false);
        }
        const gY = Math.max(0.4, groundHeightAt(b.p.x, b.p.z));
        if (b.p.y <= gY && b.leapVy < 0) {
          b.p.y = gY;
          b.leapActive = false;
          b.stompTimer = 0.95;
          this.spawnRing(b.p.x, b.p.y + 0.7, b.p.z, 0, 0.2, 0, 0xd6b88d, 5, 78, 0.85, 0.85);
          this.camShake = Math.max(this.camShake, 1.35);
          this.audio.playMeteorImpact(0.42);
        }
      } else {
        b.leapCooldown -= dt;
        if (b.leapCooldown <= 0 && horizDist > 260 && horizDist < 1400 && b.chargeTimer <= 0) {
          b.leapActive = true;
          b.leapCooldown = 7.5 + Math.random() * 3.5;
          const jumpHeading = targetYaw + (Math.random() > 0.5 ? 0.55 : -0.55);
          b.leapVx = -Math.sin(jumpHeading) * 145;
          b.leapVz = -Math.cos(jumpHeading) * 145;
          b.leapVy = 54;
          this.audio.playSonicBoom(0.45, dist3d);
        } else {
          // Stride slowly toward tactical firing angle if not charging
          const moveSpd = horizDist > 340 && b.chargeTimer <= 0 ? 22 : 0;
          b.walkSpeed += ((moveSpd > 0 ? 1 : 0) - b.walkSpeed) * Math.min(1, 5 * dt);
          if (moveSpd > 0) {
            b.walkCycle += dt * 4.2;
            const nx = b.p.x - Math.sin(b.yaw) * moveSpd * dt;
            const nz = b.p.z - Math.cos(b.yaw) * moveSpd * dt;
            const ny = groundHeightAt(nx, nz);
            if (ny > 0.2) {
              b.p.set(nx, ny, nz);
            }
          }
        }
      }

      // Fusion Cannon Aim, Warning Laser Sight & Burst Plasma Cannon Fire
      if (b.chargeTimer > 0) {
        b.chargeTimer -= dt;
        if (b.chargeTimer <= 0) {
          b.burstLeft = 3;
          b.burstCooldown = 0;
        }
      } else if (b.burstLeft > 0) {
        b.burstCooldown -= dt;
        if (b.burstCooldown <= 0) {
          b.burstLeft--;
          b.burstCooldown = 0.24;
          b.recoilTimer = 1.0;
          this.megatronRig.root.updateMatrixWorld(true);
          this.megatronRig.muzzleAnchor.getWorldPosition(_bossMuzzleWorld).add(this.renderOrigin);
          // Lead target slightly
          const leadT = THREE.MathUtils.clamp(dist3d / 460, 0.05, 1.3);
          const tv = this.mode === 'fly' ? this.cur.v : this.manV;
          _a.copy(playerPos).addScaledVector(tv, leadT * 0.55);
          this.fireBossPlasmaBolt(_bossMuzzleWorld, _a, 465);
        }
      } else {
        b.attackTimer -= dt;
        if (b.attackTimer <= 0 && dist3d < 2200) {
          b.chargeTimer = 0.95;
          b.attackTimer = 2.8 + Math.random() * 1.4;
          this.audio.playFusionCannonCharge();
        }
      }

      // Switch to Cybertronian Jet Mode if player speeds far away!
      if (!b.leapActive && dist3d > 1450 && b.phaseTimer > 5.0 && b.chargeTimer <= 0) {
        b.phase = 'jet';
        b.phaseTimer = 0;
        b.jetStrafeTimer = 0;
        b.leapActive = false;
        _a.copy(playerPos).sub(b.p).normalize();
        b.v.copy(_a).multiplyScalar(280);
        b.v.y = 140;
        this.audio.playMegatronTransformStage(2);
      }
      return;
    }

    if (b.phase === 'jet') {
      b.mode = 'jet';
      b.transformT = Math.max(0, b.transformT - dt * 1.05);
      b.jetStrafeTimer += dt;

      // Mach 3 Cybertronian Jet pursuit!
      _a.set(playerPos.x, Math.max(playerPos.y + 45, groundHeightAt(playerPos.x, playerPos.z) + 180), playerPos.z).sub(b.p);
      const distToPlayer = Math.max(1, _a.length());
      _a.divideScalar(distToPlayer);

      const desiredSpeed = distToPlayer > 1600 ? 960 : 540; // Up to ~Mach 3!
      const curSpd = Math.max(220, b.v.length());
      _b.copy(b.v).divideScalar(curSpd);
      _c.copy(_b).lerp(_a, Math.min(1, 1.35 * dt)).normalize();
      const nextSpd = THREE.MathUtils.lerp(curSpd, desiredSpeed, Math.min(1, 1.8 * dt));
      b.v.copy(_c).multiplyScalar(nextSpd);
      b.p.addScaledVector(b.v, dt);

      const minTerrainY = groundHeightAt(b.p.x, b.p.z) + 120;
      if (b.p.y < minTerrainY) {
        b.p.y = minTerrainY;
        b.v.y = Math.max(b.v.y, 45);
      }

      b.yaw = Math.atan2(-_c.x, -_c.z);
      b.pitch = Math.asin(THREE.MathUtils.clamp(_c.y, -0.85, 0.85));
      const crossTurn = _b.x * _a.z - _b.z * _a.x;
      b.jetRoll += (THREE.MathUtils.clamp(crossTurn * 4.5, -1.1, 1.1) - b.jetRoll) * Math.min(1, 5 * dt);

      // Purple jet vapor trail
      if (Math.random() < dt * 45) {
        this.spawnSmoke(b.p.x, b.p.y, b.p.z, 0, 1, 0, 0x9333ea, 2.2, 8.5, 1.1, 0.48, 0.5, 0.6, 1.2, 0x3b0764);
      }

      // Launch missile volleys in Jet Mode
      b.jetMissileCooldown -= dt;
      if (b.jetMissileCooldown <= 0 && this.mode === 'fly' && !this.cur.ground && distToPlayer > 280 && distToPlayer < 3200) {
        b.jetMissileCooldown = 4.6;
        _d.copy(b.v).normalize().multiplyScalar(Math.max(280, nextSpd * 0.65));
        this.fireBossMissile(b.p, _d, this.cur);
      }

      // Dive back & transform to Mech when close to player & low over land
      if (b.jetStrafeTimer > 5.5 && distToPlayer < 880) {
        const landHere = groundHeightAt(b.p.x, b.p.z);
        if (landHere > 0.5) {
          b.p.y = landHere;
          b.v.set(0, 0, 0);
          b.pitch = 0;
          b.jetRoll = 0;
          b.phase = 'mech';
          b.phaseTimer = 0;
          b.stompTimer = 1.0;
          this.audio.playMegatronTransformStage(3);
          this.spawnRing(b.p.x, b.p.y + 0.8, b.p.z, 0, 0.2, 0, 0xc084fc, 4, 72, 0.85, 0.85);
          this.camShake = Math.max(this.camShake, 1.2);
        }
      }
      return;
    }

    if (b.phase === 'dying') {
      b.staggerTimer = 1.0;
      b.dyingBurstTimer -= dt;
      if (b.dyingBurstTimer <= 0) {
        b.dyingBurstTimer = 0.22 + Math.random() * 0.14;
        _a.set(
          b.p.x + (Math.random() - 0.5) * 14,
          b.p.y + 4 + Math.random() * 20,
          b.p.z + (Math.random() - 0.5) * 14
        );
        this.spawnExplosion(_a, 1.1);
        this.bossLightning.triggerFlashAt(_a.x, _a.y, _a.z, 18);
      }

      if (b.phaseTimer >= 2.8) {
        // Colossal purple-orange supernova!
        this.getBossCenterPos(_bossCenterPos);
        this.audio.playMegatronDefeatExplosion();
        this.spawnExplosion(_bossCenterPos, 4.2, true);
        this.spawnRing(_bossCenterPos.x, _bossCenterPos.y, _bossCenterPos.z, 0, 0.25, 0, 0xe879f9, 10, 220, 1.6, 1.0);
        this.spawnRing(_bossCenterPos.x, _bossCenterPos.y, _bossCenterPos.z, 0, 0.4, 0, 0xfbbf24, 6, 165, 1.25, 0.95);
        for (let i = 0; i < 36; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 30 + Math.random() * 75;
          this.spawnFire(
            'fire',
            _bossCenterPos.x,
            _bossCenterPos.y,
            _bossCenterPos.z,
            Math.cos(ang) * spd,
            (Math.random() - 0.25) * 65,
            Math.sin(ang) * spd,
            i % 2 === 0 ? 0xd946ef : 0xf97316,
            4.5,
            24,
            1.65,
            1.0,
            false,
            12,
            0,
            1.1,
            false,
            false
          );
        }
        this.bossLightning.triggerFlashAt(_bossCenterPos.x, _bossCenterPos.y, _bossCenterPos.z, 36);
        this.camShake = Math.max(this.camShake, 4.2);
        this.megatronRig.root.visible = false;
        this.bossWarningLaser.visible = false;
        b.phase = 'defeated';
        b.phaseTimer = 0;
        b.lockedByPlayer = false;
        this.say(
          'megatron_win',
          'تم القضاء على ميغاترون!',
          'انفجار هائل! دمرتَ زعيم السايبرترون ميغاترون وأنقذت السماء — العاصفة تنقشع الآن!',
          12,
          true
        );
      }
    }
  }

  private stepSamiCombat(dt: number): void {
    this.missileAlert = 'none';
    this.incomingMissileDistM = 0;

    if (this.samiMissileCooldown > 0) {
      this.samiMissileCooldown = Math.max(0, this.samiMissileCooldown - dt);
    }

    if (this.mode !== 'fly' || this.cur.crash > 0 || this.cur.ground) {
      this.samiLockTimer = 0;
      return;
    }

    // Track nearest enemy missile incoming toward player aircraft
    let minDist = Infinity;
    for (const m of this.missiles) {
      if (m.active && m.target === this.cur && !m.flareTarget) {
        const d = m.p.distanceTo(this.cur.p);
        if (d < minDist) minDist = d;
      }
    }
    if (minDist < Infinity) {
      this.missileAlert = 'incoming';
      this.incomingMissileDistM = Math.round(minDist);
    }

    // When Sami pilots an aircraft in the air within combat range, Sami locks and fires homing missiles!
    const samiAc = this.npc.st === 'pilot' && this.npc.ac && !this.npc.ac.ground && this.npc.ac.crash <= 0 ? this.npc.ac : null;
    if (samiAc && this.samiMissileCooldown <= 0) {
      const dist = samiAc.p.distanceTo(this.cur.p);
      if (dist > 85 && dist < 2400 && !this.cur.ground) {
        this.samiLockTimer += dt;
        if (this.missileAlert === 'none') this.missileAlert = 'lock';
        if (this.samiLockTimer >= 2.3) {
          this.samiLockTimer = 0;
          this.samiMissileCooldown = 11.5;
          this.fireSamiMissile(samiAc, this.cur);
          this.say('samifire', 'سامي أطلق صاروخاً', 'تم قفل الرادار عليك! أطلقت صاروخاً تتبعياً، استخدم المشاعل (G) الآن!', 7, true);
        }
      } else {
        this.samiLockTimer = Math.max(0, this.samiLockTimer - dt * 1.5);
      }
    } else {
      this.samiLockTimer = Math.max(0, this.samiLockTimer - dt * 2.0);
    }

    if (this.missileAlert !== 'none') {
      this.audio.updateMissileWarning(this.missileAlert, this.incomingMissileDistM);
    }
  }

  private stepTankerAndRefuel(dt: number): void {
    // KC-46 Stratotanker flies a steady, predictable closed racetrack orbit near main airfield at 450 km/h (125 m/s) & 1,500 m
    const cx = 200;
    const cz = -1300;
    const straightLen = 2600;
    const halfLen = straightLen * 0.5;
    const turnR = 1050;
    const arcLen = Math.PI * turnR;
    const perimeter = straightLen * 2 + arcLen * 2;
    const speed = 125;

    this.tanker.angle = (this.tanker.angle + speed * dt) % perimeter;
    const s = this.tanker.angle;

    let nx = cx + turnR;
    let nz = cz;
    let tx = 0;
    let tz = -1;
    let bankAngle = 0;

    if (s < straightLen) {
      nx = cx + turnR;
      nz = cz + halfLen - s;
      tx = 0;
      tz = -1;
      bankAngle = 0;
    } else if (s < straightLen + arcLen) {
      const th = (s - straightLen) / turnR;
      nx = cx + Math.cos(th) * turnR;
      nz = cz - halfLen - Math.sin(th) * turnR;
      tx = -Math.sin(th);
      tz = -Math.cos(th);
      bankAngle = 0.22 * Math.sin(th);
    } else if (s < straightLen * 2 + arcLen) {
      const u = s - (straightLen + arcLen);
      nx = cx - turnR;
      nz = cz - halfLen + u;
      tx = 0;
      tz = 1;
      bankAngle = 0;
    } else {
      const th = (s - (straightLen * 2 + arcLen)) / turnR;
      nx = cx - Math.cos(th) * turnR;
      nz = cz + halfLen + Math.sin(th) * turnR;
      tx = Math.sin(th);
      tz = Math.cos(th);
      bankAngle = 0.22 * Math.sin(th);
    }

    this.tanker.p.set(nx, 1500, nz);
    this.tanker.v.set(tx * speed, 0, tz * speed);
    const yaw = Math.atan2(-tx, -tz);
    this.tanker.q.setFromEuler(_e.set(0, yaw, bankAngle, 'YXZ'));

    // Center of the glowing green target ring (45 m behind tanker tail)
    _zoneCenter.set(0, -2.5, 64.2).applyQuaternion(this.tanker.q).add(this.tanker.p);
    this.tankerZoneTarget.copy(_zoneCenter);

    const model = this.tanker.model;
    const tipMat = model.boomTipMat;
    const drogueMat = model.drogueMat;
    const ringMat = model.targetRingMat;
    const haloMat = model.targetHaloMat;

    const fly = this.mode === 'fly' && this.cur.crash <= 0;
    const zoneDist = fly ? this.cur.p.distanceTo(_zoneCenter) : this.man.p.distanceTo(_zoneCenter);
    this.refuelDistanceM = Math.round(zoneDist);

    const inAssistZone = fly && zoneDist <= 60 && !this.cur.ground;
    if (inAssistZone) {
      if (!this.refuelAssist) {
        this.refuelAssist = true;
        this.audio.playTone(520, 0.08, 'sine', 0.12);
      }
      this.refuelHoseExtend = Math.min(1, this.refuelHoseExtend + dt / 1.15);
      this.refuelDockTimer = this.refuelHoseExtend * 3.0;

      if (this.refuelHoseExtend >= 0.88 && !this.refuelConnected) {
        this.refuelConnected = true;
        this.refuelFullChimed = false;
        this.audio.playRefuelContact(true, false);
        this.say(
          'refuel_conn',
          'التحام تلقائي بأنبوب الوقود',
          'تم تثبيت السرعة ومد خرطوم الوقود بنجاح! جاري التعبئة السريعة (+15%/ث).',
          8,
          true
        );
      }

      if (this.refuelConnected) {
        // Rapid assisted refueling (+15% fuel/sec)
        this.fuelPct = Math.min(100, this.fuelPct + 15.0 * dt);
        this.refuelProgress = this.fuelPct / 100;

        if (this.fuelPct >= 99.95 && !this.refuelFullChimed) {
          this.refuelFullChimed = true;
          this.fuelPct = 100;
          this.flaresCount = 24;
          this.resetAircraftDamage(this.cur);
          this.missionMgr.markRefuelComplete();
          this.audio.playRefuelContact(true, true);
          this.say('refuel_done', 'اكتمل التزود بالوقود 100%', 'تم شحن الوقود والمشاعل بالكامل بنجاح!', 10, true);
        }
      }
    } else {
      if (this.refuelConnected) {
        this.refuelConnected = false;
        this.audio.playRefuelContact(false, false);
      }
      this.refuelAssist = false;
      this.refuelHoseExtend = Math.max(0, this.refuelHoseExtend - dt * 1.1);
      this.refuelDockTimer = this.refuelHoseExtend * 3.0;
      this.refuelProgress = 0;
      this.refuelFullChimed = false;
    }

    // Animate trailing drogue hose extending to dock cleanly onto player's nose
    _hoseTargetLocal.set(0, -2.5, 19.0);
    if (fly && this.refuelHoseExtend > 0.01) {
      const noseOffZ = -Math.min(5.2, this.cur.config.hz * 0.42);
      _a.set(0, 0.35, noseOffZ).applyQuaternion(this.cur.q).add(this.cur.p);
      _a.sub(this.tanker.p);
      _q.copy(this.tanker.q).invert();
      _a.applyQuaternion(_q);
      _a.x -= model.boomPivot.position.x;
      _a.y -= model.boomPivot.position.y;
      _a.z -= model.boomPivot.position.z;
      if (_a.z > 13.0 && _a.length() < 85) {
        _hoseTargetLocal.lerp(_a, this.refuelHoseExtend);
      }
    }

    const totalBoomLen = Math.max(15.5, _hoseTargetLocal.length());
    _b.copy(_hoseTargetLocal).divideScalar(totalBoomLen);
    model.boomPivot.quaternion.setFromUnitVectors(LOCAL_AFT, _b);
    const hoseLen = Math.max(4.0, totalBoomLen - 11.5);
    model.hoseMesh.scale.z = hoseLen;
    model.drogueGroup.position.set(0, 0, 11.5 + hoseLen);

    // Update glowing ring & drogue colors/pulse
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4.2);
    ringMat.color.setHex(this.refuelConnected ? 0x4ade80 : 0x22c55e);
    ringMat.opacity = inAssistZone ? 0.96 : 0.72 + pulse * 0.16;
    haloMat.opacity = inAssistZone ? 0.34 : 0.14 + pulse * 0.08;
    model.targetRingGroup.scale.setScalar(inAssistZone ? 0.92 : 1.0 + pulse * 0.04);

    const drogueHex = this.refuelConnected ? 0x22c55e : inAssistZone ? 0x4ade80 : 0xfacc15;
    drogueMat.color.setHex(drogueHex);
    tipMat.color.setHex(drogueHex);

    model.group.position.copy(this.tanker.p).sub(this.renderOrigin);
    model.group.quaternion.copy(this.tanker.q);
    model.group.updateMatrixWorld(true);
    this.tanker.boomTipWorld
      .set(0, 0, 11.5 + hoseLen)
      .applyMatrix4(model.boomPivot.matrixWorld)
      .add(this.renderOrigin);
  }

  private stepMissiles(dt: number): void {
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.age += dt;
      if (m.age > 12) {
        m.active = false;
        m.plume.visible = false;
        m.mesh.visible = false;
        continue;
      }

      // Phase 1: 0.18s Pre-Ignition Underwing Rail-Slide + Slight Downward Release Drop (-1.5 m/s)
      if (m.age < 0.18) {
        m.plume.visible = false;
        if (m.owner && m.owner.crash <= 0) {
          const slideDist = (m.age / 0.18) * 3.8;
          const dropOffset = 1.5 * m.age + 0.5 * 9.81 * m.age * m.age * 0.25;
          _a.set(m.railOffset.x, m.railOffset.y - dropOffset, m.railOffset.z - slideDist)
            .applyQuaternion(m.owner.q)
            .add(m.owner.p);
          m.p.copy(_a);
          m.q.copy(m.owner.q);

          _noseDir.copy(LOCAL_FWD).applyQuaternion(m.owner.q).normalize();
          _b.copy(_up).applyQuaternion(m.owner.q);
          m.v.copy(m.owner.v).addScaledVector(_noseDir, 22).addScaledVector(_b, -1.5);
        } else {
          m.v.y -= 9.81 * dt;
          m.p.addScaledVector(m.v, dt);
        }
        m.mesh.position.copy(m.p).sub(this.renderOrigin);
        m.mesh.quaternion.copy(m.q);
        continue;
      }

      // Phase 2: Main Rocket Motor Ignition at t = 0.18s
      const burnAge = m.age - 0.18;
      if (!m.ignited) {
        m.ignited = true;
        m.plume.visible = true;
        _a.set(0, 0, 2.2).applyQuaternion(m.q).add(m.p);
        this.spawnFire('flash', _a.x, _a.y, _a.z, m.v.x * 0.25, m.v.y * 0.25, m.v.z * 0.25, 0xfffbeb, 1.4, 6.2, 0.14, 1.0, false, 0, 0, 1.2, false, false);
        this.spawnSmoke(_a.x, _a.y, _a.z, m.v.x * 0.15, m.v.y * 0.15 + 1.2, m.v.z * 0.15, 0xf8fafc, 1.1, 4.4, 1.2, 0.75, 0.8, 1.2, 1.6, 0xcbd5e1);
      }

      const motorActive = burnAge < 5.5;
      m.plume.visible = motorActive;
      if (motorActive) {
        const flicker = 0.92 + Math.sin(this.elapsed * 68 + m.age * 23) * 0.18;
        m.plume.scale.set(flicker, flicker, 1.05 + Math.cos(this.elapsed * 54) * 0.24);
      }

      const curSpd = Math.max(40, m.v.length());
      const targetSpd = motorActive
        ? Math.min(840, curSpd + 440 * dt)
        : Math.max(420, curSpd - 32 * dt);

      _a.copy(m.v).divideScalar(curSpd);
      _tauLocal.set(0, 0, 0);

      // Proportional Navigation (PN) Guidance with aerodynamic turn-rate & G-limits
      let guidTargetPos: THREE.Vector3 | null = null;
      let guidTargetVel: THREE.Vector3 | null = null;
      let maxG = 30;
      if (m.flareTarget && m.flareTarget.active) {
        guidTargetPos = m.flareTarget.p;
        guidTargetVel = m.flareTarget.v;
        maxG = 36;
      } else if (m.targetBoss && this.isBossTargetable()) {
        guidTargetPos = this.getBossCenterPos(_bossCenterPos);
        guidTargetVel = _bossTargetVel.copy(this.boss.v);
        maxG = 32;
      } else if (m.target && m.target.crash <= 0) {
        guidTargetPos = m.target.p;
        guidTargetVel = m.target.v;
        maxG = 30;
      }

      if (guidTargetPos && guidTargetVel) {
        _b.copy(guidTargetPos).sub(m.p);
        const dist = Math.max(1, _b.length());
        _b.divideScalar(dist); // LOS unit vector

        // Relative velocity & Line-of-Sight angular rate vector d(losDir)/dt
        _c.copy(guidTargetVel).sub(m.v);
        const closingVel = Math.max(curSpd * 0.45, -_c.dot(_b));
        _e2.copy(_c).addScaledVector(_b, -_c.dot(_b)).divideScalar(Math.max(dist, 24));

        // Pure/True PN acceleration (N = 4.2) + gentle off-boresight capture bias
        _tauLocal.copy(_e2).multiplyScalar(4.2 * closingVel);
        _tauLocal.addScaledVector(_b, curSpd * 0.85);
        // Project perpendicular to velocity vector
        _tauLocal.addScaledVector(_a, -_tauLocal.dot(_a));

        const authFactor = Math.min(1, curSpd / 250);
        const maxLatAccel = maxG * 9.81 * authFactor;
        const latLen = _tauLocal.length();
        if (latLen > maxLatAccel && latLen > 0.001) {
          _tauLocal.multiplyScalar(maxLatAccel / latLen);
        }
        m.v.addScaledVector(_tauLocal, dt);
      }

      m.v.y -= 9.81 * dt * 0.25;
      const newSpd = m.v.length();
      if (newSpd > 1) {
        m.v.multiplyScalar(targetSpd / newSpd);
      }

      m.p.addScaledVector(m.v, dt);

      // Realistic body pitch/yaw lag & slight angle-of-attack lead into turns
      if (m.v.lengthSq() > 1) {
        _d.copy(m.v).normalize();
        if (_tauLocal.lengthSq() > 4) {
          _d.addScaledVector(_tauLocal, 0.00055).normalize();
        }
        _q.setFromUnitVectors(LOCAL_FWD, _d);
        m.q.slerp(_q, 1 - Math.exp(-12.5 * dt));
      }
      m.mesh.position.copy(m.p).sub(this.renderOrigin);
      m.mesh.quaternion.copy(m.q);

      // Intense white-orange exhaust plume + thick turbulent white smoke ribbon trail
      if (motorActive) {
        m.smokeTimer += dt;
        if (m.smokeTimer >= 0.017) {
          m.smokeTimer = 0;
          _ptOffset.set(0, 0, 2.25).applyQuaternion(m.q).add(m.p);
          this.spawnSmoke(
            _ptOffset.x + (Math.random() - 0.5) * 0.35,
            _ptOffset.y + (Math.random() - 0.5) * 0.35,
            _ptOffset.z + (Math.random() - 0.5) * 0.35,
            (Math.random() - 0.5) * 2.4,
            0.9 + Math.random() * 1.1,
            (Math.random() - 0.5) * 2.4,
            0xf8fafc,
            0.72,
            4.8,
            1.38,
            0.68,
            0.85,
            1.1,
            1.6,
            0xcbd5e1
          );
          if (Math.random() < 0.72) {
            this.spawnFire(
              'fire',
              _ptOffset.x,
              _ptOffset.y,
              _ptOffset.z,
              m.v.x * 0.05,
              m.v.y * 0.05,
              m.v.z * 0.05,
              Math.random() > 0.45 ? 0xfff7ed : 0xfb923c,
              0.78,
              1.65,
              0.085,
              0.92,
              false,
              0,
              0,
              1.0,
              false,
              false
            );
          }
        }
      }

      if (m.flareTarget && m.flareTarget.active && m.p.distanceTo(m.flareTarget.p) < 10) {
        m.active = false;
        m.plume.visible = false;
        m.mesh.visible = false;
        m.flareTarget.active = false;
        m.flareTarget.mesh.visible = false;
        this.spawnExplosion(m.p, 0.85);
        continue;
      }

      if (m.owner !== null && this.isBossTargetable()) {
        this.getBossCenterPos(_bossCenterPos);
        if (m.p.distanceTo(_bossCenterPos) < 25) {
          m.active = false;
          m.plume.visible = false;
          m.mesh.visible = false;
          this.damageMegatron(420, m.p);
          continue;
        }
      }

      let hitPlane: AircraftInstance | null = null;
      for (const a of this.aircraft) {
        if (a.crash > 0) continue;
        if (a === m.owner && m.age < 0.85) continue;
        const hitRadius = Math.max(9.5, a.config.hx * 0.65);
        if (m.p.distanceTo(a.p) < hitRadius) {
          hitPlane = a;
          break;
        }
      }

      if (hitPlane) {
        m.active = false;
        m.plume.visible = false;
        m.mesh.visible = false;
        this.spawnExplosion(m.p, 1.4);
        _q.copy(hitPlane.q).invert();
        _ptOffset.copy(m.p).sub(hitPlane.p).applyQuaternion(_q);
        this.inflictComponentDamage(hitPlane, _ptOffset, 0.72, 'missile');

        if (hitPlane === this.cur && this.mode === 'fly') {
          this.camShake = Math.max(this.camShake, 1.3);
          if (hitPlane.hull > 0) {
            this.say('mhit', 'إصابة صاروخية!', 'أُصِبت طائرتك بصاروخ معادٍ! تضررت الأنظمة الهيكلية، تفقّد رسم العطل!', 5, true);
          }
        }
        continue;
      }

      const surfY = this.surfaceHeightAt(m.p.x, m.p.z, m.p.y);
      if (m.p.y <= surfY + 0.4 || this.hitsBuildingPoint(m.p.x, m.p.y, m.p.z, 1.2)) {
        m.active = false;
        m.plume.visible = false;
        m.mesh.visible = false;
        this.spawnExplosion(m.p, 1.3);
        this.spawnGroundCrater(m.p.x, m.p.z, 35);
      }
    }
  }

  private detonateBomb(bm: BombInstance): void {
    bm.active = false;
    bm.mesh.visible = false;
    this.spawnExplosion(bm.p, 2.0, true);
    this.spawnGroundCrater(bm.p.x, bm.p.z, 35);

    if (this.isBossTargetable()) {
      this.getBossCenterPos(_bossCenterPos);
      const bossDist = bm.p.distanceTo(_bossCenterPos);
      if (bossDist < 78) {
        this.damageMegatron((1 - bossDist / 78) * 950, bm.p);
      }
    }

    // Blast damage to aircraft within 65m (excluding dropping aircraft right after release)
    for (const a of this.aircraft) {
      if (a.crash > 0) continue;
      if (a === bm.owner && bm.age < 1.0) continue;
      const dist = bm.p.distanceTo(a.p);
      if (dist < 65) {
        const dmg = (1 - dist / 65) * 1.65;
        _q.copy(a.q).invert();
        _ptOffset.copy(bm.p).sub(a.p).applyQuaternion(_q);
        this.inflictComponentDamage(a, _ptOffset, dmg, 'bomb');
      }
    }

    // Destroy fuel depot / practice targets within 55m blast radius
    let hitTarget = false;
    for (const tg of this.world.targets) {
      if (tg.destroyed) continue;
      if (bm.p.distanceTo(tg.pos) < 55) {
        tg.destroyed = true;
        this.world.setTargetVisible(tg.id, false);
        hitTarget = true;
        this.spawnExplosion(tg.pos, 1.75);
        this.spawnGroundCrater(tg.pos.x, tg.pos.z, 35);
      }
    }
    if (hitTarget) {
      const left = this.world.targets.filter((t) => !t.destroyed).length;
      this.say(
        'bombhit',
        'إصابة هدف أرضي بالقنابل',
        left > 0
          ? `إصابة دقيقة! تبقى ${left} أهداف أرضية في الميدان.`
          : 'تدمير كامل! دمرتَ جميع الأهداف الأرضية بنجاح!',
        4,
        true
      );
    }
  }

  private stepBombs(dt: number): void {
    for (const bm of this.bombs) {
      if (!bm.active) continue;
      bm.age += dt;
      if (bm.age > 28) {
        bm.active = false;
        bm.mesh.visible = false;
        continue;
      }

      // Ballistic gravity & quadratic aerodynamic drag
      const spd = bm.v.length();
      const dragDecel = 0.00018 * spd;
      bm.v.multiplyScalar(Math.max(0.92, 1 - (0.028 + dragDecel) * dt));
      bm.v.y -= 9.81 * dt;
      bm.p.addScaledVector(bm.v, dt);

      // Pitch nose-down gradually toward velocity vector under gravity/drag
      if (bm.v.lengthSq() > 1) {
        _d.copy(bm.v).normalize();
        _q.setFromUnitVectors(LOCAL_FWD, _d);
        bm.q.slerp(_q, Math.min(1, 3.4 * dt));
      }
      bm.mesh.position.copy(bm.p).sub(this.renderOrigin);
      bm.mesh.quaternion.copy(bm.q);

      const surfY = this.surfaceHeightAt(bm.p.x, bm.p.z, bm.p.y);
      const agl = Math.max(0, bm.p.y - surfY);

      // High-altitude descending aerodynamic whistle before impact
      if (!bm.whistleTriggered && (bm.v.y < -22 || (bm.age > 0.7 && agl < 520))) {
        bm.whistleTriggered = true;
        const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(bm.p);
        if (camDist < 2600) {
          const vyDown = Math.max(0, -bm.v.y);
          const estTime = (vyDown + Math.sqrt(vyDown * vyDown + 2 * 9.81 * agl)) / 9.81;
          const distScale = THREE.MathUtils.clamp(1 - camDist / 2600, 0.16, 1);
          this.audio.playBombWhistle(distScale, estTime);
        }
      }

      // Direct hit on any target pod or aircraft
      let impact = false;
      for (const tg of this.world.targets) {
        if (!tg.destroyed && bm.p.distanceTo(tg.pos) < tg.radius) {
          impact = true;
          break;
        }
      }
      if (!impact && bm.age > 0.45) {
        for (const a of this.aircraft) {
          if (a.crash > 0 || (a === bm.owner && bm.age < 1.0)) continue;
          if (bm.p.distanceTo(a.p) < Math.max(8, a.config.hx * 0.6)) {
            impact = true;
            break;
          }
        }
      }

      if (impact || bm.p.y <= surfY + 0.35 || this.hitsBuildingPoint(bm.p.x, bm.p.y, bm.p.z, 1.0)) {
        this.detonateBomb(bm);
      }
    }
  }

  private stepParticles(dt: number): void {
    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (fog) {
      this.smokeMat.uniforms.uFogColor.value.copy(fog.color);
      this.smokeMat.uniforms.uFogDensity.value = fog.density;
      this.fireMat.uniforms.uFogDensity.value = fog.density;
    }

    const windX = this.weatherWindVec.x + this.weatherGustVec.x * 0.35;
    const windZ = this.weatherWindVec.z + this.weatherGustVec.z * 0.35;

    // 1. Update Turbulent Smoke Billboard Pool
    const prevSmokeCount = this.smokeMesh.count;
    for (let i = this.smokeActive.length - 1; i >= 0; i--) {
      const pt = this.smokeActive[i];
      pt.age += dt;
      if (pt.age >= pt.maxAge) {
        const last = this.smokeActive.pop()!;
        if (i < this.smokeActive.length) this.smokeActive[i] = last;
        this.smokeFree.push(pt);
        continue;
      }
      const t = pt.age / pt.maxAge;
      pt.v.y += pt.buoyancy * dt;
      pt.v.multiplyScalar(Math.max(0, 1 - pt.drag * dt));
      pt.p.x += (pt.v.x + windX * pt.windMul) * dt;
      pt.p.y += pt.v.y * dt;
      pt.p.z += (pt.v.z + windZ * pt.windMul) * dt;
      pt.rot += pt.spin * dt;
    }

    const smokeCount = this.smokeActive.length;
    if (smokeCount > 0 || prevSmokeCount > 0) {
      const sMatArr = this.smokeMesh.instanceMatrix.array as Float32Array;
      const sParamArr = this.smokeParamAttr.array as Float32Array;
      const sColorArr = this.smokeColorAttr.array as Float32Array;
      for (let i = 0; i < smokeCount; i++) {
        const pt = this.smokeActive[i];
        const t = pt.age / pt.maxAge;
        const sc = THREE.MathUtils.lerp(pt.startScale, pt.endScale, Math.pow(t, 0.56));
        const fadeIn = Math.min(1, t / 0.08);
        const fadeOut = Math.pow(1 - t, 1.35);
        const op = pt.baseOpacity * fadeIn * fadeOut;

        const mBase = i * 16;
        sMatArr[mBase + 12] = pt.p.x - this.renderOrigin.x;
        sMatArr[mBase + 13] = pt.p.y - this.renderOrigin.y;
        sMatArr[mBase + 14] = pt.p.z - this.renderOrigin.z;

        const pBase = i * 4;
        sParamArr[pBase] = sc;
        sParamArr[pBase + 1] = pt.rot;
        sParamArr[pBase + 2] = op;
        sParamArr[pBase + 3] = 0;

        const cBase = i * 3;
        sColorArr[cBase] = THREE.MathUtils.lerp(pt.r, pt.endR, t);
        sColorArr[cBase + 1] = THREE.MathUtils.lerp(pt.g, pt.endG, t);
        sColorArr[cBase + 2] = THREE.MathUtils.lerp(pt.b, pt.endB, t);
      }
      this.smokeMesh.count = smokeCount;
      if (smokeCount > 0) {
        this.smokeMesh.instanceMatrix.needsUpdate = true;
        this.smokeParamAttr.needsUpdate = true;
        this.smokeColorAttr.needsUpdate = true;
      }
    }

    // 2. Update Additive Core Flash, Boiling Fireballs & Flying Burning Shrapnel
    const prevFireCount = this.fireMesh.count;
    for (let i = this.fireActive.length - 1; i >= 0; i--) {
      const pt = this.fireActive[i];
      pt.age += dt;
      if (pt.age >= pt.maxAge) {
        const last = this.fireActive.pop()!;
        if (i < this.fireActive.length) this.fireActive[i] = last;
        this.fireFree.push(pt);
        continue;
      }

      if (pt.kind === 'spark') {
        pt.v.y -= pt.gravity * dt;
        pt.v.multiplyScalar(Math.max(0, 1 - pt.drag * dt));
        pt.p.addScaledVector(pt.v, dt);

        const gy = groundHeightAt(pt.p.x, pt.p.z);
        if (pt.p.y < gy + 0.08 && pt.v.y < 0) {
          const bounceVy = -pt.v.y;
          pt.p.y = gy + 0.08;
          pt.v.y = bounceVy * 0.42;
          pt.v.x *= 0.72;
          pt.v.z *= 0.72;
          if (pt.bounceSound && bounceVy > 3.2) {
            const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(pt.p);
            if (camDist < 420) {
              this.audio.playSparkBounce(
                THREE.MathUtils.clamp(1 - camDist / 420, 0.15, 1),
                THREE.MathUtils.clamp(bounceVy / 18, 0.25, 1)
              );
            }
          }
        }

        if (pt.emitsSmoke && pt.v.lengthSq() > 18) {
          pt.smokeTrailTimer -= dt;
          if (pt.smokeTrailTimer <= 0) {
            pt.smokeTrailTimer = 0.048 + Math.random() * 0.025;
            this.spawnSmoke(
              pt.p.x,
              pt.p.y,
              pt.p.z,
              pt.v.x * 0.08 + (Math.random() - 0.5) * 1.4,
              1.1 + Math.random() * 1.2,
              pt.v.z * 0.08 + (Math.random() - 0.5) * 1.4,
              0x1e293b,
              0.42,
              2.1,
              0.85 + Math.random() * 0.45,
              0.44,
              0.7,
              1.6,
              1.5,
              0x0f172a
            );
          }
        }
      } else {
        pt.v.y += pt.buoyancy * dt;
        pt.v.multiplyScalar(Math.max(0, 1 - pt.drag * dt));
        pt.p.addScaledVector(pt.v, dt);
      }
      pt.rot += pt.spin * dt;
    }

    const fireCount = this.fireActive.length;
    if (fireCount > 0 || prevFireCount > 0) {
      const fMatArr = this.fireMesh.instanceMatrix.array as Float32Array;
      const fParamArr = this.fireParamAttr.array as Float32Array;
      const fColorArr = this.fireColorAttr.array as Float32Array;
      for (let i = 0; i < fireCount; i++) {
        const pt = this.fireActive[i];
        const t = pt.age / pt.maxAge;
        const sc = THREE.MathUtils.lerp(
          pt.startScale,
          pt.endScale,
          pt.kind === 'flash' ? Math.pow(t, 0.45) : Math.pow(t, 0.65)
        );
        const op =
          pt.kind === 'flash'
            ? pt.baseOpacity * Math.pow(1 - t, 1.8)
            : pt.baseOpacity * Math.min(1, t / 0.06) * Math.pow(1 - t, 1.15);

        const mBase = i * 16;
        fMatArr[mBase + 12] = pt.p.x - this.renderOrigin.x;
        fMatArr[mBase + 13] = pt.p.y - this.renderOrigin.y;
        fMatArr[mBase + 14] = pt.p.z - this.renderOrigin.z;

        const pBase = i * 4;
        fParamArr[pBase] = sc;
        fParamArr[pBase + 1] = pt.rot;
        fParamArr[pBase + 2] = op;
        fParamArr[pBase + 3] = pt.kind === 'fire' ? 0.0 : 1.0;

        const cBase = i * 3;
        if (pt.thermalRamp) {
          // Boiling fireball thermal curve: white-hot -> bright orange -> deep crimson -> dark soot
          if (t < 0.18) {
            const k = t / 0.18;
            fColorArr[cBase] = 1.0;
            fColorArr[cBase + 1] = THREE.MathUtils.lerp(0.98, 0.56, k);
            fColorArr[cBase + 2] = THREE.MathUtils.lerp(0.86, 0.12, k);
          } else if (t < 0.52) {
            const k = (t - 0.18) / 0.34;
            fColorArr[cBase] = THREE.MathUtils.lerp(1.0, 0.82, k);
            fColorArr[cBase + 1] = THREE.MathUtils.lerp(0.56, 0.14, k);
            fColorArr[cBase + 2] = THREE.MathUtils.lerp(0.12, 0.05, k);
          } else {
            const k = (t - 0.52) / 0.48;
            fColorArr[cBase] = THREE.MathUtils.lerp(0.82, 0.12, k);
            fColorArr[cBase + 1] = THREE.MathUtils.lerp(0.14, 0.04, k);
            fColorArr[cBase + 2] = THREE.MathUtils.lerp(0.05, 0.03, k);
          }
        } else {
          fColorArr[cBase] = pt.r;
          fColorArr[cBase + 1] = pt.g;
          fColorArr[cBase + 2] = pt.b;
        }
      }
      this.fireMesh.count = fireCount;
      if (fireCount > 0) {
        this.fireMesh.instanceMatrix.needsUpdate = true;
        this.fireParamAttr.needsUpdate = true;
        this.fireColorAttr.needsUpdate = true;
      }
    }

    // 3. Update Expanding Shockwave Rings Pool
    const prevRingCount = this.ringMesh.count;
    for (let i = this.ringActive.length - 1; i >= 0; i--) {
      const pt = this.ringActive[i];
      pt.age += dt;
      if (pt.age >= pt.maxAge) {
        const last = this.ringActive.pop()!;
        if (i < this.ringActive.length) this.ringActive[i] = last;
        this.ringFree.push(pt);
        continue;
      }
      pt.p.addScaledVector(pt.v, dt);
    }

    const ringCount = this.ringActive.length;
    if (ringCount > 0 || prevRingCount > 0) {
      const rParamArr = this.ringParamAttr.array as Float32Array;
      const rColorArr = this.ringColorAttr.array as Float32Array;
      for (let i = 0; i < ringCount; i++) {
        const pt = this.ringActive[i];
        const t = pt.age / pt.maxAge;
        const sc = THREE.MathUtils.lerp(pt.startScale, pt.endScale, Math.pow(t, 0.46));
        const op = pt.baseOpacity * Math.pow(1 - t, 1.4);

        _ringMat4.makeScale(sc, sc, sc);
        _ringMat4.setPosition(
          pt.p.x - this.renderOrigin.x,
          pt.p.y - this.renderOrigin.y,
          pt.p.z - this.renderOrigin.z
        );
        this.ringMesh.setMatrixAt(i, _ringMat4);

        const pBase = i * 4;
        rParamArr[pBase] = op;
        rParamArr[pBase + 1] = 0;
        rParamArr[pBase + 2] = 0;
        rParamArr[pBase + 3] = 0;

        const cBase = i * 3;
        rColorArr[cBase] = pt.r;
        rColorArr[cBase + 1] = pt.g;
        rColorArr[cBase + 2] = pt.b;
      }
      this.ringMesh.count = ringCount;
      if (ringCount > 0) {
        this.ringMesh.instanceMatrix.needsUpdate = true;
        this.ringParamAttr.needsUpdate = true;
        this.ringColorAttr.needsUpdate = true;
      }
    }

    // 4. Emit Lingering Smoldering Smoke Wisps from Ground Craters for 25 seconds
    for (let i = 0; i < this.craters.length; i++) {
      const c = this.craters[i];
      if (c.smokeAge >= 25) continue;
      c.smokeAge += dt;
      c.smokeTimer -= dt;
      if (c.smokeTimer <= 0) {
        c.smokeTimer = 0.28 + Math.random() * 0.22;
        const camDist = _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(c.p);
        if (camDist < 3600) {
          const fade = Math.max(0.2, 1 - c.smokeAge / 25);
          this.spawnSmoke(
            c.p.x + (Math.random() - 0.5) * 4.2,
            c.p.y + 0.4,
            c.p.z + (Math.random() - 0.5) * 4.2,
            (Math.random() - 0.5) * 1.4,
            1.8 + Math.random() * 1.6,
            (Math.random() - 0.5) * 1.4,
            0x334155,
            1.25 * fade + 0.6,
            5.8 * fade + 2.0,
            2.6 + Math.random() * 1.1,
            0.36 * fade + 0.08,
            0.9,
            1.35,
            1.2,
            0x1e293b
          );
        }
      }
    }
  }

  private collectedRingMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.7,
  });

  private checkSkyRings(): void {
    if (this.mode !== 'fly' || this.cur.crash > 0) return;
    for (const ring of this.world.rings) {
      if (ring.collected) continue;
      if (this.cur.p.distanceTo(ring.pos) < ring.radius) {
        ring.collected = true;
        this.ringsCollected++;
        this.stats.player.rings++;
        this.audio.playRingChime();
        ring.mesh.material = this.collectedRingMat;
        ring.mesh.scale.setScalar(0.65);
        this.say('ring', 'حلّق عبر حلقة جوية', `ممتاز! اجتزت الحلقة ${this.ringsCollected} من ${this.world.rings.length}.`, 4, true);
      }
    }
  }

  private watchEvents(dt: number): void {
    this.talkCD -= dt;
    const a = this.cur;
    if (this.mode === 'fly' && a.crash <= 0) {
      const alt = Math.round(Math.max(0, a.p.y - a.config.y0));
      const spd = Math.round(a.v.length() * 3.6);
      if (alt > this.stats.player.alt) this.stats.player.alt = alt;
      if (spd > this.stats.player.spd) this.stats.player.spd = spd;
      if (!a.ground && alt > 18) this.plAir = true;
      if (this.plAir && a.ground) {
        this.plAir = false;
        this.stats.player.land++;
        this.audio.playTouchdown();
        const hb = this.world.highlandBase;
        const onHighland =
          Math.abs(a.p.x - hb.x) <= hb.halfW &&
          Math.abs(a.p.z - hb.z) <= hb.halfL &&
          Math.abs(a.p.y - (hb.y + a.config.y0)) < 3.5;
        if (onHighland && this.missionMgr.markHighlandLanded()) {
          this.say('highland', 'هبوط القاعدة الجبلية', 'ممتاز! وصلت وهبطت بنجاح على مدرج القاعدة الجبلية!', 10, true);
        } else {
          this.say('touchdown', 'هبوط ناجح', 'هبوط سلس وممتاز على المدرج!', 15);
        }
      }
      if (!this.wasGround && a.ground && a.v.length() > 15) {
        this.audio.playTouchdown();
      }
      this.wasGround = a.ground;

      _a.set(0, 1, 0).applyQuaternion(a.q);
      this.invT = _a.y < -0.35 && !a.ground ? this.invT + dt : 0;
      if (this.invT > 1.4) this.say('inv', 'طيران مقلوب', 'طيران مقلوب رائع! أصابني الدوار وأنا أشاهدك.');

      this.stallT = a.aoa > a.config.st && !a.ground && a.fwd > 5 ? this.stallT + dt : 0;
      if (this.stallT > 1.1) this.say('stall', 'انهيار الرفع', 'تحذير! السرعة منخفضة، اخفض الأنف وزد الدفع!');

      const dNpc = Math.hypot(a.p.x - this.npc.p.x, a.p.z - this.npc.p.z);
      if (alt > 2 && alt < 35 && dNpc < 95 && a.v.length() > 28) {
        this.say('low', 'تحليق منخفض فوق سامي', 'يا إلهي! مررت فوق رأسي مباشرة!');
      }
      if (alt > 1600) this.say('high', 'ارتفاع شاهق', 'وصلت إلى طبقة عالية جداً في السماء!', 90);
    } else {
      this.invT = 0;
      this.stallT = 0;
      this.plAir = false;
    }

    if (this.npc.st === 'pilot' && this.npc.ac) {
      const b = this.npc.ac;
      const alt = Math.round(Math.max(0, b.p.y - b.config.y0));
      const spd = Math.round(b.v.length() * 3.6);
      if (alt > this.stats.sami.alt) this.stats.sami.alt = alt;
      if (spd > this.stats.sami.spd) this.stats.sami.spd = spd;
    }

    const la = this.stats.player.alt === this.stats.sami.alt ? '' : this.stats.sami.alt > this.stats.player.alt ? 's' : 'p';
    if (la && la !== this.leadAlt && this.stats.player.alt > 25 && this.stats.sami.alt > 25) {
      if (this.leadAlt) {
        this.say(
          'lead',
          'تبدل الصدارة',
          la === 's' ? 'تجاوزتك في الارتفاع الآن يا كابتن!' : 'أحسنت! كسرت رقمي في الارتفاع، سألاحقك!',
          20
        );
      }
      this.leadAlt = la;
    }

    const now = performance.now();
    while (this.jumps.length && now - this.jumps[0] > 8000) this.jumps.shift();
    if (this.jumps.length >= 4) this.say('jump', 'قفز متكرر', 'ما بك تقفز هكذا؟ الطائرات تنتظرك!');
  }

  private drawMinimap(): void {
    const mc = this.minimapCanvas;
    if (!mc) return;
    const mx = mc.getContext('2d');
    if (!mx) return;

    const MAPR = [550, 1800, 5600];
    const S = mc.width;
    const R = MAPR[this.mapZoomIdx];
    const s = S / 2 / R;
    const u = S / 50;
    const fly = this.mode === 'fly';
    const pp = fly ? this.cur.p : this.man.p;
    const X = (x: number) => S / 2 + (x - pp.x) * s;
    const Z = (z: number) => S / 2 + (z - pp.z) * s;

    mx.clearRect(0, 0, S, S);
    mx.fillStyle = '#2d4c2b';
    mx.fillRect(0, 0, S, S);
    const desertStartZ = Z(4500);
    if (desertStartZ < S) {
      mx.fillStyle = '#8b6d43';
      mx.fillRect(0, Math.max(0, desertStartZ), S, S - Math.max(0, desertStartZ));
    }
    const coastX = X(1160);
    if (coastX < S) {
      mx.fillStyle = '#074775';
      mx.fillRect(Math.max(0, coastX), 0, S - Math.max(0, coastX), S);
    }

    // Offshore Tropical Island
    mx.fillStyle = '#3f6a39';
    mx.beginPath();
    mx.ellipse(X(2900), Z(-1400), 680 * s, 860 * s, 0, 0, Math.PI * 2);
    mx.fill();

    // Highland, Northern Mountain & Desert Base plateaus
    mx.fillStyle = '#475569';
    mx.fillRect(X(-2955), Z(-4040), 110 * s, 1280 * s);
    mx.fillRect(X(-3285), Z(-17320), 170 * s, 1640 * s);
    mx.fillRect(X(-1535), Z(14760), 270 * s, 1480 * s);

    const g = R > 2200 ? 1200 : R > 700 ? 400 : 120;
    mx.strokeStyle = 'rgba(255,255,255,0.1)';
    mx.lineWidth = 1;
    for (let gx = Math.floor((pp.x - R) / g) * g; gx <= pp.x + R; gx += g) {
      mx.beginPath();
      mx.moveTo(X(gx), 0);
      mx.lineTo(X(gx), S);
      mx.stroke();
    }
    for (let gz = Math.floor((pp.z - R) / g) * g; gz <= pp.z + R; gz += g) {
      mx.beginPath();
      mx.moveTo(0, Z(gz));
      mx.lineTo(S, Z(gz));
      mx.stroke();
    }

    // Coastal city zone
    mx.fillStyle = 'rgba(148,163,184,0.42)';
    mx.fillRect(X(520), Z(-1150), 620 * s, 1700 * s);

    // Runways (Main, Parallel, Highland, Island, Northern Military, Desert Radar) & Carrier
    mx.fillStyle = '#1e293b';
    mx.fillRect(X(-27), Z(-3000), 54 * s, 3400 * s);
    mx.fillRect(X(-214), Z(-2500), 48 * s, 2900 * s);
    mx.fillRect(X(-2918), Z(-4000), 36 * s, 1200 * s);
    mx.fillRect(X(2883), Z(-1860), 34 * s, 920 * s);
    mx.fillRect(X(-3220), Z(-17270), 40 * s, 1540 * s);
    mx.fillRect(X(-1421), Z(14810), 42 * s, 1380 * s);
    const car = this.world.carrier;
    mx.fillStyle = '#64748b';
    mx.fillRect(X(car.x - car.halfW), Z(car.z - car.halfL), car.halfW * 2 * s, car.halfL * 2 * s);

    for (const r of this.world.rings) {
      const rx = X(r.pos.x);
      const rz = Z(r.pos.z);
      if (rx < -10 || rx > S + 10 || rz < -10 || rz > S + 10) continue;
      mx.strokeStyle = r.collected ? '#22c55e' : '#f59e0b';
      mx.lineWidth = 1.5;
      mx.beginPath();
      mx.arc(rx, rz, u * 0.7, 0, Math.PI * 2);
      mx.stroke();
    }

    for (const tg of this.world.targets) {
      if (tg.destroyed) continue;
      const tx = X(tg.pos.x);
      const tz = Z(tg.pos.z);
      if (tx < -8 || tx > S + 8 || tz < -8 || tz > S + 8) continue;
      mx.fillStyle = '#ef4444';
      mx.fillRect(tx - u * 0.42, tz - u * 0.42, u * 0.84, u * 0.84);
    }

    const drawMarker = (
      x: number,
      z: number,
      ang: number,
      col: string,
      sz: number,
      lab: string,
      ringCol: string | null
    ) => {
      let px = X(x);
      let pz = Z(z);
      const out = px < u || pz < u || px > S - u || pz > S - u;
      px = THREE.MathUtils.clamp(px, u, S - u);
      pz = THREE.MathUtils.clamp(pz, u, S - u);
      mx.save();
      mx.globalAlpha = out ? 0.65 : 1;
      if (ringCol) {
        mx.strokeStyle = ringCol;
        mx.lineWidth = u * 0.32;
        mx.beginPath();
        mx.arc(px, pz, sz * 1.65, 0, Math.PI * 2);
        mx.stroke();
      }
      mx.translate(px, pz);
      mx.rotate(ang);
      mx.fillStyle = col;
      mx.strokeStyle = '#0f172a';
      mx.lineWidth = u * 0.18;
      mx.beginPath();
      mx.moveTo(sz, 0);
      mx.lineTo(-sz * 0.7, sz * 0.7);
      mx.lineTo(-sz * 0.4, 0);
      mx.lineTo(-sz * 0.7, -sz * 0.7);
      mx.closePath();
      mx.fill();
      mx.stroke();
      mx.restore();
      if (lab && this.mapBig) {
        mx.fillStyle = '#f8fafc';
        mx.font = `${Math.round(u * 1.4)}px sans-serif`;
        mx.fillText(lab, px + sz * 1.3, pz - sz * 1.2);
      }
    };

    for (const a of this.aircraft) {
      const fw = _a.set(0, 0, -1).applyQuaternion(a.q);
      const ring =
        fly && this.cur === a
          ? '#4ade80'
          : this.lockedTarget === a
          ? '#ef4444'
          : (this.npc.st === 'pilot' || this.npc.st === 'ride') && this.npc.ac === a
          ? '#fb923c'
          : null;
      drawMarker(
        a.p.x,
        a.p.z,
        Math.atan2(fw.z, fw.x),
        a.config.mapColor,
        u * a.config.mapScale,
        a.config.mapLabel,
        ring
      );
    }

    mx.fillStyle = '#ef4444';
    for (const m of this.missiles) {
      if (!m.active) continue;
      mx.beginPath();
      mx.arc(X(m.p.x), Z(m.p.z), u * 0.45, 0, Math.PI * 2);
      mx.fill();
    }

    if (
      this.boss.phase !== 'idle' &&
      this.boss.phase !== 'defeated'
    ) {
      let bx = X(this.boss.p.x);
      let bz = Z(this.boss.p.z);
      bx = THREE.MathUtils.clamp(bx, u * 1.4, S - u * 1.4);
      bz = THREE.MathUtils.clamp(bz, u * 1.4, S - u * 1.4);
      const pulseR = u * (1.2 + 0.35 * Math.sin(this.elapsed * 8));
      mx.save();
      mx.strokeStyle = '#e879f9';
      mx.lineWidth = u * 0.32;
      mx.beginPath();
      mx.arc(bx, bz, pulseR * 1.4, 0, Math.PI * 2);
      mx.stroke();
      mx.fillStyle = '#a855f7';
      mx.beginPath();
      mx.moveTo(bx, bz - pulseR);
      mx.lineTo(bx + pulseR * 0.85, bz);
      mx.lineTo(bx, bz + pulseR);
      mx.lineTo(bx - pulseR * 0.85, bz);
      mx.closePath();
      mx.fill();
      if (this.mapBig) {
        mx.fillStyle = '#f5d0fe';
        mx.font = `bold ${Math.round(u * 1.45)}px sans-serif`;
        mx.fillText('MEGATRON', bx + pulseR * 1.5, bz - pulseR * 0.8);
      }
      mx.restore();
    }

    mx.fillStyle = '#facc15';
    for (const bm of this.bombs) {
      if (!bm.active) continue;
      mx.beginPath();
      mx.arc(X(bm.p.x), Z(bm.p.z), u * 0.48, 0, Math.PI * 2);
      mx.fill();
    }

    mx.fillStyle = '#fef08a';
    for (const fl of this.flares) {
      if (!fl.active) continue;
      mx.beginPath();
      mx.arc(X(fl.p.x), Z(fl.p.z), u * 0.38, 0, Math.PI * 2);
      mx.fill();
    }

    drawMarker(
      this.tanker.p.x,
      this.tanker.p.z,
      Math.atan2(this.tanker.v.z, this.tanker.v.x),
      '#38bdf8',
      u * 1.45,
      'TNKR',
      '#7dd3fc'
    );

    if (!fly) {
      drawMarker(
        this.man.p.x,
        this.man.p.z,
        Math.atan2(-Math.cos(this.man.yaw), -Math.sin(this.man.yaw)),
        '#4ade80',
        u * 1.1,
        '',
        null
      );
    }

    if (this.npc.st !== 'pilot' && this.npc.st !== 'ride') {
      const px = THREE.MathUtils.clamp(X(this.npc.p.x), u, S - u);
      const pz = THREE.MathUtils.clamp(Z(this.npc.p.z), u, S - u);
      mx.fillStyle = '#fb923c';
      mx.strokeStyle = '#000';
      mx.lineWidth = u * 0.18;
      mx.beginPath();
      mx.arc(px, pz, u * 0.75, 0, Math.PI * 2);
      mx.fill();
      mx.stroke();
    }

    // Active Mission Waypoint Guide Line & Reticle
    const mSnap = this.missionMgr.buildSnapshot(pp, this.tanker.p, this.world);
    const mwx = THREE.MathUtils.clamp(X(mSnap.targetX), u, S - u);
    const mwz = THREE.MathUtils.clamp(Z(mSnap.targetZ), u, S - u);
    mx.save();
    mx.setLineDash([u * 0.7, u * 0.5]);
    mx.strokeStyle = mSnap.completed ? '#4ade80' : '#facc15';
    mx.lineWidth = Math.max(1.2, u * 0.2);
    mx.beginPath();
    mx.moveTo(S / 2, S / 2);
    mx.lineTo(mwx, mwz);
    mx.stroke();
    mx.setLineDash([]);
    mx.beginPath();
    mx.arc(mwx, mwz, u * 1.15, 0, Math.PI * 2);
    mx.stroke();
    mx.restore();

    mx.fillStyle = '#f8fafc';
    mx.font = `bold ${Math.round(u * 1.9)}px sans-serif`;
    mx.textAlign = 'center';
    mx.fillText('N', S / 2, u * 2.2);
    mx.textAlign = 'left';
    mx.font = `${Math.round(u * 1.6)}px monospace`;
    mx.fillText(`${R}m`, u * 0.8, S - u * 0.8);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (dt > 0) {
      this.elapsed += dt;
      this.world.update(dt, this.elapsed);
      if (this.phase === 'playing' && Math.abs(this.world.carrier.dz) > 1e-6) {
        const car = this.world.carrier;
        for (const a of this.aircraft) {
          if (
            a.ground &&
            a.crash <= 0 &&
            Math.abs(a.p.x - car.x) <= car.halfW &&
            Math.abs(a.p.z - car.z) <= car.halfL &&
            Math.abs(a.p.y - (car.deckY + a.config.y0)) < 3.0
          ) {
            a.p.z += car.dz;
            a.prevP.z += car.dz;
            a.renderP.z += car.dz;
          }
        }
        if (
          this.mode === 'walk' &&
          !this.boarding &&
          Math.abs(this.man.p.x - car.x) <= car.halfW &&
          Math.abs(this.man.p.z - car.z) <= car.halfL &&
          Math.abs(this.man.p.y - car.deckY) < 3.0
        ) {
          this.man.p.z += car.dz;
        }
      }
      this.stepWeather(dt);

      if (this.missileCooldown > 0) {
        this.missileCooldown = Math.max(0, this.missileCooldown - dt);
      }
      if (this.bombCooldown > 0) {
        this.bombCooldown = Math.max(0, this.bombCooldown - dt);
      }
      if (this.flareCooldown > 0) {
        this.flareCooldown = Math.max(0, this.flareCooldown - dt);
      }
      if (this.arrestedWireTimer > 0) {
        this.arrestedWireTimer = Math.max(0, this.arrestedWireTimer - dt);
      }
      if (this.bolterWarningTimer > 0) {
        this.bolterWarningTimer = Math.max(0, this.bolterWarningTimer - dt);
      }
      if (this.carrierTrapCooldown > 0) {
        this.carrierTrapCooldown = Math.max(0, this.carrierTrapCooldown - dt);
      }
      if (this.sonicBoomFlash > 0) {
        this.sonicBoomFlash = Math.max(0, this.sonicBoomFlash - 1.3 * dt);
      }
      if (this.scrapeAudioTimer > 0) {
        this.scrapeAudioTimer = Math.max(0, this.scrapeAudioTimer - dt);
      }
      if (this.scrapeContactTimeout > 0) {
        this.scrapeContactTimeout = Math.max(0, this.scrapeContactTimeout - dt);
        if (this.scrapeContactTimeout <= 0) {
          this.scrapeContactIntensity = 0;
          this.scrapeContactSpeed = 0;
        }
      }
      if (this.tireSmokeTimer > 0) {
        this.tireSmokeTimer = Math.max(0, this.tireSmokeTimer - dt);
      }
      if (this.camShake > 0) {
        this.camShake = Math.max(0, this.camShake - 2.6 * dt);
      }

      if (this.phase === 'playing') {
        if (this.boarding) {
          this.stepBoarding(dt);
          this.stepNpc(dt);
          this.stepBombs(dt);
          this.stepParticles(dt);
          for (const a of this.aircraft) {
            a.renderP.copy(a.p);
            a.renderQ.copy(a.q);
          }
        } else {
          // Fixed-timestep rigid-body accumulator (120 Hz) with clamped accumulation
          this.physAccum = Math.min(this.physAccum + dt, 0.08);
          const fdt = FlightEngine.FIXED_DT;
          while (this.physAccum >= fdt) {
            for (const a of this.aircraft) {
              a.prevP.copy(a.p);
              a.prevQ.copy(a.q);
            }
            for (const a of this.aircraft) this.stepPlane(a, fdt);
            this.checkAircraftCollisions();
            if (this.mode === 'walk') this.stepMan(fdt);
            else if (this.mode === 'skydive') this.stepSkydive(fdt);
            this.stepNpc(fdt);
            this.stepMissiles(fdt);
            this.stepFlares(fdt);
            this.stepBombs(fdt);
            this.physAccum -= fdt;
          }
          const alpha = THREE.MathUtils.clamp(this.physAccum / fdt, 0, 1);
          for (const a of this.aircraft) {
            a.renderP.lerpVectors(a.prevP, a.p, alpha);
            a.renderQ.slerpQuaternions(a.prevQ, a.q, alpha);
          }
          this.stepTankerAndRefuel(dt);
          this.stepSamiCombat(dt);
          this.stepBoss(dt);
          this.stepBossPlasmaBolts(dt);
          this.stepParticles(dt);
          this.lockedTarget = this.findLockTarget();
          this.checkSkyRings();
          this.watchEvents(dt);
        }
      } else {
        for (const a of this.aircraft) {
          a.renderP.copy(a.p);
          a.renderQ.copy(a.q);
        }
      }

      this.updateFloatingOrigin();
      this.updateVisuals(dt);
      this.updateCamera(dt);
      this.updateSunShadowTarget();
      this.renderer.render(this.scene, this.cam);

      if (this.phase === 'playing') {
        if (this.mode === 'skydive') {
          this.audio.updateSkydiveWind(true, this.manV.length(), this.parachuteOpen);
        } else {
          const stallRad = (this.cur.config.aero.stallAoADeg * Math.PI) / 180;
          const stalling =
            this.mode === 'fly' &&
            Math.abs(this.cur.aoa) > stallRad &&
            !this.cur.ground &&
            this.cur.tas > 12;
          this.audio.updateEngine(
            this.mode === 'fly' && !this.boarding && this.cur.crash <= 0,
            this.cur.config.id,
            this.cur.spool,
            this.cur.tas || this.cur.v.length(),
            stalling,
            this.cur.ground,
            this.gForce
          );
          const frictionActive =
            !this.boarding &&
            this.mode === 'fly' &&
            this.cur.crash <= 0 &&
            this.scrapeContactTimeout > 0 &&
            this.scrapeContactIntensity > 0.02;
          this.audio.updateMetallicFriction(
            frictionActive,
            this.scrapeContactIntensity,
            this.scrapeContactSpeed,
            this.scrapeContactSurface,
            this.scrapeContactDistScale
          );
          this.scrapeContactIntensity *= Math.max(0, 1 - 6.5 * dt);
        }

        // Real-Time External Jet Flyby Doppler, Jet Wash Crackle & Supersonic Shock Passage
        _camSimPos.copy(this.cam.position).add(this.renderOrigin);
        _camRight.set(1, 0, 0).applyQuaternion(this.cam.quaternion);

        let bestFlybyDist = 1800;
        let bestClosing = 0;
        let bestSpeed = 0;
        let bestThr = 0;
        let bestMilitary = false;
        let bestPan = 0;
        let hasFlyby = false;

        for (const a of this.aircraft) {
          const prevCd = this.flybyBoomCooldown.get(a) ?? 0;
          if (prevCd > 0) this.flybyBoomCooldown.set(a, Math.max(0, prevCd - dt));

          const isPlayerActive = a === this.cur && this.mode === 'fly' && !this.boarding;
          if (isPlayerActive || a.crash > 0 || a.ground) {
            this.flybyPrevClosing.delete(a);
            this.flybyPrevMach.delete(a);
            continue;
          }
          const spd = a.tas || a.v.length();
          if (spd < 25) continue;

          _toJet.copy(a.p).sub(_camSimPos);
          const dist = _toJet.length();
          if (dist < 1e-3) continue;
          _toJet.divideScalar(dist);
          const closingSpeed = -a.v.dot(_toJet);

          const altM = Math.max(0, a.p.y - a.config.y0);
          const sos = Math.max(295, 340.3 - 0.004 * Math.min(altM, 11000));
          const mach = spd / sos;
          const prevClosing = this.flybyPrevClosing.get(a);
          const prevMach = this.flybyPrevMach.get(a) ?? mach;

          // Ground/observer sonic boom when Mach >= 1.0 shock cone sweeps past or jet breaks Mach 1 nearby
          const coneSwept = prevClosing !== undefined && prevClosing > 15 && closingSpeed <= 15;
          const brokeMachNearby = prevMach < 1.0 && mach >= 1.0 && dist < 2600;
          if (mach >= 1.0 && dist < 2400 && (coneSwept || brokeMachNearby)) {
            const cd = this.flybyBoomCooldown.get(a) ?? 0;
            if (cd <= 0) {
              this.audio.playSonicBoom(THREE.MathUtils.clamp(1 - dist / 2400, 0.2, 1), dist);
              this.flybyBoomCooldown.set(a, 5.5);
            }
          }
          this.flybyPrevClosing.set(a, closingSpeed);
          this.flybyPrevMach.set(a, mach);

          if (dist < bestFlybyDist) {
            bestFlybyDist = dist;
            bestClosing = closingSpeed;
            bestSpeed = spd;
            bestThr = a.spool;
            bestMilitary =
              a.config.aero.hasAfterburner || a.config.id === 'a10' || a.config.id === 'b2' || a.config.id === 'f117';
            bestPan = _toJet.dot(_camRight);
            hasFlyby = true;
          }
        }

        // Also include KC-46 Stratotanker in flyby Doppler channel
        _toJet.copy(this.tanker.p).sub(_camSimPos);
        const tankerDist = _toJet.length();
        if (tankerDist > 1e-3 && tankerDist < bestFlybyDist) {
          _toJet.divideScalar(tankerDist);
          bestFlybyDist = tankerDist;
          bestClosing = -this.tanker.v.dot(_toJet);
          bestSpeed = this.tanker.v.length();
          bestThr = 0.72;
          bestMilitary = false;
          bestPan = _toJet.dot(_camRight);
          hasFlyby = true;
        }

        this.audio.updateFlyby(
          hasFlyby,
          bestFlybyDist,
          bestClosing,
          bestSpeed,
          bestThr,
          bestMilitary,
          bestPan
        );
      } else {
        this.audio.updateMetallicFriction(false);
        this.audio.updateFlyby(false, 9999, 0, 0, 0, false, 0);
      }

      this.frameCounter++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.5) {
        this.fps = Math.round(this.frameCounter / this.fpsTimer);
        this.frameCounter = 0;
        this.fpsTimer = 0;
      }

      this.hudTimer += dt;
      if (this.hudTimer >= 0.09) {
        this.hudTimer = 0;
        this.drawMinimap();
        this.emitHud();
      }
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(this.tick, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private syncAircraftShadowCasters(): void {
    if (this.shadowOwner === this.cur) return;
    this.shadowOwner = this.cur;
    for (const a of this.aircraft) {
      const shouldCast = a === this.cur && !this.isSoftwareGl;
      a.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          if (obj.userData.origCastShadow === undefined) {
            obj.userData.origCastShadow = obj.castShadow;
          }
          obj.castShadow = shouldCast && !!obj.userData.origCastShadow;
        }
      });
    }
  }

  private syncCamAnchor(): void {
    if (this.camAnchorOwner !== this.cur) {
      this.camAnchorOwner = this.cur;
      this.camAnchor.position.set(0, 0, 0);
      this.camAnchor.rotation.set(0, 0, 0);
      this.camAnchor.quaternion.identity();
      this.cur.group.add(this.camAnchor);
    }
    this.syncAircraftShadowCasters();
  }

  private updateFloatingOrigin(): void {
    const focus =
      this.phase === 'lobby'
        ? this.cur.renderP
        : this.boarding
          ? this.boarding.target.renderP
          : this.mode === 'fly'
            ? this.cur.renderP
            : this.man.p;

    // Dynamically follow player X/Z in 500m snapped increments so the ocean stretches seamlessly to the horizon
    const oceanSnapX = Math.round(focus.x / 500) * 500;
    const oceanSnapZ = Math.round(focus.z / 500) * 500;
    if (this.world.oceanMesh.position.x !== oceanSnapX || this.world.oceanMesh.position.z !== oceanSnapZ) {
      this.world.oceanMesh.position.set(oceanSnapX, -0.45, oceanSnapZ);
    }

    const dx = focus.x - this.renderOrigin.x;
    const dz = focus.z - this.renderOrigin.z;
    if (dx * dx + dz * dz <= 5000 * 5000) return;

    this.renderOrigin.set(Math.round(focus.x), 0, Math.round(focus.z));
    this.world.root.position.set(-this.renderOrigin.x, 0, -this.renderOrigin.z);
    this.world.setOceanOrigin(this.renderOrigin.x, this.renderOrigin.z);
    this.world.root.updateMatrixWorld(true);
    this.cratersDirty = true;
  }

  private updateVisuals(dt: number): void {
    const fly = this.phase === 'playing' && this.mode === 'fly' && !this.boarding;
    const strobeOn = Math.floor(this.elapsed * 2.5) % 4 === 0;
    this.syncCamAnchor();

    for (const a of this.aircraft) {
      a.group.position.copy(a.renderP).sub(this.renderOrigin);
      a.group.quaternion.copy(a.renderQ);
      a.group.updateMatrixWorld(true);

      const active = (fly && a === this.cur && a.crash <= 0) || !!a.ai;
      const lobbyIdle = this.phase === 'lobby' && a === this.cur;

      const spinRate = active ? 14 + a.spool * 75 : lobbyIdle ? 10 : 0;
      for (const prop of a.props) {
        prop.rotation.z += spinRate * dt;
      }
      for (const disc of a.discs) {
        (disc.material as THREE.MeshBasicMaterial).opacity = active ? 0.14 + a.spool * 0.16 : lobbyIdle ? 0.08 : 0;
      }

      const showFlame =
        active &&
        a.damage.engine > 0.2 &&
        a.engineOverheat < 0.95 &&
        (a.config.aero.hasAfterburner ? a.spool > 0.78 : a.spool > 0.85);
      const abBoost = a.config.aero.hasAfterburner && a.spool > 0.82 ? (a.spool - 0.82) / 0.18 : 0;
      const abPower = THREE.MathUtils.clamp((a.spool - 0.76) / 0.24, 0.16, 1.35);
      const abFlicker = 0.94 + Math.sin(this.elapsed * 44 + a.spawnYaw) * 0.05 + Math.random() * 0.08;
      for (const fl of a.flames) {
        fl.visible = showFlame;
        if (showFlame) {
          fl.scale.set(
            1 + abBoost * 0.18,
            1 + abBoost * 0.18,
            0.76 + a.spool * 0.48 + abBoost * 0.52 * abFlicker
          );
          const abMat = fl.userData.abMat as THREE.ShaderMaterial | undefined;
          if (abMat) {
            abMat.uniforms.uTime.value = this.elapsed + a.spawnYaw;
            abMat.uniforms.uPower.value = abPower * abFlicker;
          }
        }
      }

      for (const st of a.strobes) {
        st.visible = strobeOn || this.timeOfDay === 'night' || this.timeOfDay === 'dusk';
      }

      const boardingThis = !!(this.boarding && this.boarding.target === a);
      const inCockpitHere = fly && a === this.cur && this.cameraMode === 'cockpit';
      a.pilot.visible =
        (((fly && a === this.cur) || !!a.ai || this.phase === 'lobby') &&
          !a.abandoned &&
          !boardingThis &&
          !inCockpitHere);
      if (a.pax) a.pax.visible = this.npc.st === 'ride' && this.npc.ac === a && !a.abandoned;

      if (a.tailhook) {
        const targetHookRot = a === this.cur && this.tailhookDown ? 0.65 : 0;
        a.tailhook.rotation.x += (targetHookRot - a.tailhook.rotation.x) * Math.min(1, 8 * dt);
      }

      const animState = this.animRigs.get(a);
      if (animState) {
        const { rig } = animState;
        const ctrlBlend = Math.min(1, 12 * dt);
        animState.ctrl.x += (a.inp.p - animState.ctrl.x) * ctrlBlend;
        animState.ctrl.y += (a.inp.r - animState.ctrl.y) * ctrlBlend;
        animState.ctrl.z += (a.inp.y - animState.ctrl.z) * ctrlBlend;
        const brakeTarget =
          (a === this.cur && fly && !!this.keys.Space) || (!!a.ai && a.inp.brake > 0.5) ? 1 : 0;
        animState.decelAnim += (brakeTarget - animState.decelAnim) * Math.min(1, 9 * dt);

        const pVal = animState.ctrl.x;
        const rVal = animState.ctrl.y;
        const yVal = animState.ctrl.z;
        for (const cs of rig.controls) {
          if (cs.kind === 'aileron') {
            cs.pivot.rotation[cs.axis] = rVal * cs.side * cs.maxRad;
          } else if (cs.kind === 'elevator') {
            cs.pivot.rotation[cs.axis] = -pVal * cs.maxRad;
          } else if (cs.kind === 'canard') {
            cs.pivot.rotation[cs.axis] = pVal * cs.maxRad;
          } else if (cs.kind === 'rudder') {
            cs.pivot.rotation[cs.axis] = -yVal * cs.maxRad;
          } else if (cs.kind === 'decel') {
            cs.pivot.rotation[cs.axis] =
              -animState.decelAnim * cs.maxRad + rVal * cs.side * cs.maxRad * 0.35;
          }
        }

        const groundBelow = this.surfaceHeightAt(a.renderP.x, a.renderP.z, a.renderP.y);
        const clearance = Math.max(0, a.renderP.y - a.config.y0 - groundBelow);
        const aSpd = a.tas || a.v.length();
        const aSos = Math.max(295, 340.3 - 0.004 * Math.min(Math.max(0, a.renderP.y - a.config.y0), 11000));
        const aMach = aSpd / aSos;
        const overspeedGear = !a.ground && (aSpd > Math.max(155, a.config.rot * 2.15) || aMach > 0.48);
        const gearTarget =
          this.phase === 'lobby' ||
          a.ground ||
          a.crash > 0 ||
          a.abandoned ||
          (!overspeedGear && clearance < 26 && a.fwd < a.config.rot * 1.32) ||
          (!overspeedGear && a === this.cur && this.flapsActive && clearance < 160)
            ? 1
            : 0;
        const gearStep = Math.min(1, dt * (overspeedGear ? 1.25 : 0.85));
        if (animState.gearAnim < gearTarget) {
          animState.gearAnim = Math.min(gearTarget, animState.gearAnim + gearStep);
        } else if (animState.gearAnim > gearTarget) {
          animState.gearAnim = Math.max(gearTarget, animState.gearAnim - gearStep);
        }
        if (overspeedGear && animState.gearAnim > 0.22 && a === this.cur && fly) {
          this.audio.playGearOverspeedWarning();
          this.camShake = Math.max(this.camShake, 0.03 * animState.gearAnim);
        }

        const retractT = 1 - animState.gearAnim;
        const doorT = THREE.MathUtils.clamp(animState.gearAnim * 1.5, 0, 1);
        for (const g of rig.gears) {
          if (g.retractable) {
            g.strutPivot.rotation[g.retractAxis] = retractT * g.retractAngle;
          }
          if (g.doorPivot) {
            g.doorPivot.rotation.z = THREE.MathUtils.lerp(g.doorClosedAngle ?? 0, g.doorOpenAngle ?? 0, doorT);
          }
          if (a.ground && animState.gearAnim > 0.7 && Math.abs(a.fwd) > 0.15) {
            for (const wh of g.wheels) {
              wh.mesh.rotation.x -= (a.fwd * dt) / Math.max(0.15, wh.radius);
            }
          }
        }

        if (rig.droopNose) {
          rig.droopNose.pivot.rotation.x = -animState.gearAnim * rig.droopNose.droopRad;
        }

        for (const cpy of rig.canopies) {
          cpy.visible = !inCockpitHere;
        }
        for (const det of rig.cockpitDetails) {
          det.visible = !inCockpitHere;
        }
      }

      // 3D Structural Damage Smoke, Fire & Wing Fuel Leak Vapor Particles
      if (this.phase === 'playing' && a.crash <= 0 && (a === this.cur || a.ai || a.abandoned)) {
        const hz = a.config.hz;
        const hx = a.config.hx;

        // Damaged / Overheated Engine smoke & fire
        if ((a.damage.engine < 0.78 || a.engineOverheat >= 0.9) && Math.random() < dt * 26) {
          _ptOffset.set(0, 0, hz * 0.72).applyQuaternion(a.renderQ).add(a.renderP);
          const engineCrit = a.damage.engine < 0.42 || a.engineOverheat >= 0.92;
          this.spawnParticle(
            'smoke',
            _ptOffset.x,
            _ptOffset.y,
            _ptOffset.z,
            a.v.x * 0.15 + (Math.random() - 0.5) * 1.6,
            1.4 + Math.random() * 1.4,
            a.v.z * 0.15 + (Math.random() - 0.5) * 1.6,
            engineCrit ? 0x1e293b : 0x64748b,
            0.55,
            engineCrit ? 4.4 : 2.8,
            0.95
          );
          if (engineCrit && Math.random() < 0.7) {
            this.spawnParticle(
              'fire',
              _ptOffset.x,
              _ptOffset.y,
              _ptOffset.z,
              a.v.x * 0.25,
              0.8,
              a.v.z * 0.25,
              Math.random() > 0.4 ? 0xf97316 : 0xfacc15,
              0.42,
              1.65,
              0.24
            );
          }
        }

        // Left Wing fuel leak vapor particles
        if (a.damage.leftWing < 0.78 && Math.random() < dt * 22) {
          _ptOffset.set(-hx * 0.55, 0, 0.2).applyQuaternion(a.renderQ).add(a.renderP);
          this.spawnParticle(
            'smoke',
            _ptOffset.x,
            _ptOffset.y,
            _ptOffset.z,
            a.v.x * 0.12 + (Math.random() - 0.5),
            0.6,
            a.v.z * 0.12 + (Math.random() - 0.5),
            0xe0f2fe,
            0.3,
            1.7,
            0.6
          );
        }

        // Right Wing fuel leak vapor particles
        if (a.damage.rightWing < 0.78 && Math.random() < dt * 22) {
          _ptOffset.set(hx * 0.55, 0, 0.2).applyQuaternion(a.renderQ).add(a.renderP);
          this.spawnParticle(
            'smoke',
            _ptOffset.x,
            _ptOffset.y,
            _ptOffset.z,
            a.v.x * 0.12 + (Math.random() - 0.5),
            0.6,
            a.v.z * 0.12 + (Math.random() - 0.5),
            0xe0f2fe,
            0.3,
            1.7,
            0.6
          );
        }

        // Tail / Hydraulic damage smoke
        if (a.damage.tail < 0.65 && Math.random() < dt * 16) {
          _ptOffset.set(0, 0.6, hz * 0.85).applyQuaternion(a.renderQ).add(a.renderP);
          this.spawnParticle(
            'smoke',
            _ptOffset.x,
            _ptOffset.y,
            _ptOffset.z,
            a.v.x * 0.1,
            1.0,
            a.v.z * 0.1,
            0x475569,
            0.35,
            2.4,
            0.72
          );
        }
      }

      const groundY = this.surfaceHeightAt(a.renderP.x, a.renderP.z, a.renderP.y);
      const alt = Math.max(0, a.renderP.y - groundY - a.config.y0);
      _a.set(0, 0, -1).applyQuaternion(a.renderQ);
      a.sh.position.set(a.renderP.x - this.renderOrigin.x, groundY + 0.09, a.renderP.z - this.renderOrigin.z);
      a.sh.rotation.y = Math.atan2(-_a.x, -_a.z);
      const sc = 1 + alt * 0.004;
      a.sh.scale.set(a.config.sh[0] * sc, 1, a.config.sh[1] * sc);
      (a.sh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.36 - alt * 0.0007, 0.06, 0.36);
    }

    // Transonic Prandtl-Glauert Vapor Cone (Smoothly scaled ONLY between Mach 0.96 and Mach 1.05, peaking at Mach 1.00)
    const curTas = this.cur.tas || this.cur.v.length();
    const curAltM = Math.max(0, this.cur.renderP.y - this.cur.config.y0);
    const curSos = Math.max(295, 340.3 - 0.004 * Math.min(curAltM, 11000));
    const curMach = curTas / curSos;
    const machDensity =
      curMach >= 0.96 && curMach <= 1.05
        ? curMach <= 1.0
          ? THREE.MathUtils.smoothstep(curMach, 0.96, 1.0)
          : 1.0 - THREE.MathUtils.smoothstep(curMach, 1.0, 1.05)
        : 0;
    const showCone =
      fly &&
      this.cur.crash <= 0 &&
      !this.cur.ground &&
      this.cameraMode !== 'cockpit' &&
      machDensity > 0.01;
    this.vaporCone.visible = showCone;
    if (showCone) {
      const weatherBoost =
        this.weatherCondition === 'storm'
          ? 1.55
          : this.weatherCondition === 'foggy'
            ? 1.3
            : this.weatherCondition === 'breezy'
              ? 1.08
              : 1.0;
      // Anchor around mid-fuselage / wing root
      _ptOffset.set(0, 0.12, this.cur.config.hz * 0.08).applyQuaternion(this.cur.renderQ);
      this.vaporCone.position.copy(this.cur.renderP).add(_ptOffset).sub(this.renderOrigin);
      this.vaporCone.quaternion.copy(this.cur.renderQ);

      const sizeBase = Math.max(0.75, this.cur.config.hx / 7.5);
      const radialScale = sizeBase * (0.78 + 0.34 * machDensity) * (1 + (weatherBoost - 1) * 0.18);
      const lengthScale = sizeBase * (0.55 + 0.68 * machDensity) * (1 + (weatherBoost - 1) * 0.25);
      this.vaporCone.scale.set(radialScale, radialScale, lengthScale);

      const skyTint = this.world.skyUniforms.uHorizonColor.value;
      for (const mat of this.vaporConeMats) {
        mat.uniforms.uTime.value = this.elapsed;
        mat.uniforms.uDensity.value = machDensity;
        mat.uniforms.uWeatherBoost.value = weatherBoost;
        mat.uniforms.uTint.value.copy(skyTint).lerp(_ptColor.set(0xffffff), 0.72);
      }
    }

    // High-G / High-AoA Wingtip Vapor Trails (Floating-Origin safe triangle-strip ribbons)
    if (this.wingtipTrails) {
      const highG = Math.abs(this.gForce) > 2.35;
      const highAoA = Math.abs(this.cur.aoa) > 0.145;
      const transonicPull = curMach >= 0.84 && Math.abs(this.gForce) > 1.75;
      const emitTrails =
        fly &&
        this.cur.crash <= 0 &&
        !this.cur.ground &&
        curTas > 55 &&
        (highG || highAoA || transonicPull);

      const gWeight = THREE.MathUtils.clamp((Math.abs(this.gForce) - 2.0) / 4.2, 0, 0.48);
      const aoaWeight = THREE.MathUtils.clamp((Math.abs(this.cur.aoa) - 0.12) / 0.2, 0, 0.48);
      const trailIntensity = Math.min(0.5, Math.max(gWeight, aoaWeight));

      const [wx, wy, wz] = getWingtipLocal(this.cur.config.id, this.cur.config);
      _wingAxis.set(1, 0, 0).applyQuaternion(this.cur.renderQ);
      _wingPosL.set(-wx, wy, wz).applyQuaternion(this.cur.renderQ).add(this.cur.renderP);
      _wingPosR.set(wx, wy, wz).applyQuaternion(this.cur.renderQ).add(this.cur.renderP);

      const trailTint = this.world.skyUniforms.uHorizonColor.value;
      this.wingtipTrails[0].update(
        dt,
        emitTrails,
        trailIntensity,
        _wingPosL,
        _wingAxis,
        this.renderOrigin,
        trailTint
      );
      this.wingtipTrails[1].update(
        dt,
        emitTrails,
        trailIntensity,
        _wingPosR,
        _wingAxis,
        this.renderOrigin,
        trailTint
      );
    }

    // High-Speed Peripheral Wind / Speed Streaks
    const streakSpeedRatio = THREE.MathUtils.clamp((curTas - 105) / 280, 0, 1);
    const showStreaks =
      this.phase === 'playing' &&
      fly &&
      !this.boarding &&
      this.cur.crash <= 0 &&
      !this.cur.ground &&
      streakSpeedRatio > 0.02;
    this.speedStreakMesh.visible = showStreaks;
    if (showStreaks) {
      this.speedStreakMat.uniforms.uTime.value = this.elapsed;
      this.speedStreakMat.uniforms.uSpeedRatio.value = streakSpeedRatio;
      this.speedStreakMat.uniforms.uOpacity.value =
        streakSpeedRatio * (0.28 + this.weatherTurbulence * 0.14);
      this.speedStreakMat.uniforms.uColor.value
        .copy(this.world.skyUniforms.uHorizonColor.value)
        .lerp(_ptColor.set(0xffffff), 0.78);
    }

    // 3D Cockpit Glare-Shield & Canopy Frame
    this.cockpitRig.visible = fly && this.cameraMode === 'cockpit' && this.cur.crash <= 0;

    // Tanker Wingtip Strobes
    for (const st of this.tanker.model.strobes) {
      st.visible = strobeOn || this.timeOfDay === 'night' || this.timeOfDay === 'dusk';
    }

    // Sync active missiles, bombs, boss rig, lightning, plasma bolts, and craters with floating origin
    for (const m of this.missiles) {
      if (m.active) {
        m.mesh.position.copy(m.p).sub(this.renderOrigin);
      }
    }
    for (const bm of this.bombs) {
      if (bm.active) {
        bm.mesh.position.copy(bm.p).sub(this.renderOrigin);
      }
    }
    for (const pb of this.bossPlasmaBolts) {
      if (pb.active) {
        pb.mesh.position.copy(pb.p).sub(this.renderOrigin);
      }
    }
    this.bossLightning.update(dt, this.renderOrigin);

    if (this.megatronRig.root.visible) {
      const b = this.boss;
      const playerPos = this.mode === 'fly' ? this.cur.renderP : this.man.p;
      this.megatronRig.root.position.copy(b.p).sub(this.renderOrigin);
      this.megatronRig.root.rotation.set(b.pitch, b.yaw, 0, 'YXZ');

      const toPlayerX = playerPos.x - b.p.x;
      const toPlayerZ = playerPos.z - b.p.z;
      const worldAimYaw = Math.atan2(-toPlayerX, -toPlayerZ);
      const localAimYaw = _wrap(worldAimYaw - b.yaw);
      const horizD = Math.max(1, Math.hypot(toPlayerX, toPlayerZ));
      const localAimPitch = Math.atan2(playerPos.y - (b.p.y + 18), horizD);
      const groundHere = Math.max(0, groundHeightAt(b.p.x, b.p.z));
      this.megatronRig.shadowBlob.position.y = Math.max(0.14, groundHere - b.p.y + 0.14);

      applyMegatronPose(this.megatronRig, b.transformT, {
        elapsed: this.elapsed,
        aimYaw: localAimYaw,
        aimPitch: localAimPitch,
        leapFactor: b.leapActive ? 1.0 : 0.0,
        stompFactor: b.stompTimer,
        cannonCharge: b.chargeTimer > 0 ? THREE.MathUtils.clamp(1 - b.chargeTimer / 0.95, 0.15, 1) : b.burstLeft > 0 ? 1 : 0,
        recoil: b.recoilTimer,
        stagger: b.staggerTimer,
        walkCycle: b.walkCycle,
        walkSpeed: b.walkSpeed,
        jetRoll: b.jetRoll,
        reentryGlow: b.phase === 'entry' ? 1.0 : 0.0,
      });

      if (b.phase === 'mech' && b.chargeTimer > 0) {
        this.megatronRig.root.updateMatrixWorld(true);
        this.megatronRig.muzzleAnchor.getWorldPosition(_bossMuzzleWorld); // already in render coords
        _a.copy(playerPos).sub(this.renderOrigin);
        const beamDist = Math.max(5, _bossMuzzleWorld.distanceTo(_a));
        this.bossWarningLaser.visible = true;
        this.bossWarningLaser.position.copy(_bossMuzzleWorld);
        this.bossWarningLaser.lookAt(_a);
        const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 42);
        this.bossWarningLaser.scale.set(1 + (1 - b.chargeTimer) * 0.6, 1 + (1 - b.chargeTimer) * 0.6, beamDist);
        this.bossWarningLaserMat.opacity = 0.55 + 0.4 * pulse;
      } else {
        this.bossWarningLaser.visible = false;
      }
    } else {
      this.bossWarningLaser.visible = false;
    }
    if (this.cratersDirty) {
      this.cratersDirty = false;
      for (let i = 0; i < this.craters.length; i++) {
        const c = this.craters[i];
        _a.copy(c.p).sub(this.renderOrigin);
        _b.set(c.scale, 1, c.scale);
        _ringMat4.compose(_a, c.q, _b);
        this.craterMesh.setMatrixAt(i, _ringMat4);
      }
      this.craterMesh.count = this.craters.length;
      if (this.craters.length > 0) {
        this.craterMesh.instanceMatrix.needsUpdate = true;
      }
    }

    const manGh = Math.max(0, this.surfaceHeightAt(this.man.p.x, this.man.p.z, this.man.p.y + 1));
    const boardingClimb = !!(this.boarding && this.boarding.t > 0.56 && this.boarding.t < 0.84);
    const inAirWalk = (this.mode === 'walk' && !this.boarding && this.man.p.y > manGh + 0.16) || boardingClimb;
    animateCharacter(
      this.manM,
      this.man.p,
      this.man.yaw,
      this.man.anim,
      this.walkSpeedRatio,
      inAirWalk,
      this.phase === 'playing' && (!fly || !!this.boarding),
      this.elapsed,
      this.mode === 'skydive',
      this.parachuteOpen,
      this.chuteInflate,
      this.skydiveBank,
      this.diveRatio,
      this.flareActive
    );
    this.manM.g.position.sub(this.renderOrigin);
    this.manM.sh.position.sub(this.renderOrigin);
    animateCharacter(
      this.npcM,
      this.npc.p,
      this.npc.yaw,
      this.npc.anim,
      this.npc.mv ? 0.65 : 0,
      false,
      this.phase === 'playing' && this.npc.st !== 'pilot' && this.npc.st !== 'ride',
      this.elapsed,
      false,
      false,
      0,
      0,
      0,
      false
    );
    this.npcM.g.position.sub(this.renderOrigin);
    this.npcM.sh.position.sub(this.renderOrigin);
    if (this.bubT > 0) this.bubT -= dt;
  }

  private updateCamera(dt: number): void {
    this.syncCamAnchor();
    const expAlpha = (lambda: number) => 1 - Math.exp(-lambda * dt);
    this.camZoom += (this.camZoomTarget - this.camZoom) * expAlpha(12);

    const isCockpitView =
      this.phase === 'playing' && !this.boarding && this.mode === 'fly' && this.cameraMode === 'cockpit';
    const desiredNear = isCockpitView ? 0.35 : 2.0;
    let projDirty = false;
    if (Math.abs(this.cam.near - desiredNear) > 0.01) {
      this.cam.near = desiredNear;
      projDirty = true;
    }

    if (this.phase === 'lobby') {
      const target = this.cur;
      this.lobbyFocusPos.lerp(target.p, expAlpha(8));
      if (!this.drag) {
        this.lobbyOrbitYawTarget += dt * 0.22;
      }
      this.lobbyOrbitYaw += _wrap(this.lobbyOrbitYawTarget - this.lobbyOrbitYaw) * expAlpha(11);
      this.lobbyOrbitPitch += (this.lobbyOrbitPitchTarget - this.lobbyOrbitPitch) * expAlpha(11);
      const dist = Math.max(target.config.cam[2] * 1.15, 11) * this.camZoom;
      const cp = Math.cos(this.lobbyOrbitPitch);
      _camTarget.set(
        Math.sin(this.lobbyOrbitYaw) * cp * dist,
        Math.sin(this.lobbyOrbitPitch) * dist + target.config.y0 * 0.85,
        Math.cos(this.lobbyOrbitYaw) * cp * dist
      );
      this.camRelOffset.lerp(_camTarget, expAlpha(10));
      _anchorPos.copy(this.lobbyFocusPos).sub(this.renderOrigin);
      this.cam.position.copy(_anchorPos).add(this.camRelOffset);
      this.cam.position.y = Math.max(this.cam.position.y, 1.2);
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(_anchorPos.x, _anchorPos.y + 0.6, _anchorPos.z);
      if (Math.abs(this.cam.fov - 52) > 0.05) {
        this.cam.fov += (52 - this.cam.fov) * expAlpha(5);
        projDirty = true;
      }
    } else if (this.boarding) {
      const b = this.boarding.target;
      const c = b.config;
      const u = THREE.MathUtils.clamp(this.boarding.t, 0, 1);
      const blend = THREE.MathUtils.smoothstep(u, 0.42, 1.0);
      const sideSign =
        _b.copy(this.boarding.startPos).sub(b.renderP).dot(_a.set(1, 0, 0).applyQuaternion(b.renderQ)) >= 0 ? 1 : -1;

      _camTarget
        .set(sideSign * Math.min(c.ex * 0.85, 7.2), 3.4, c.cockpitOffset[2] - 4.5)
        .applyQuaternion(b.renderQ);
      _d.set(c.cam[0], c.cam[1], c.cam[2]).applyQuaternion(b.renderQ);
      _camTarget.lerp(_d, blend);
      this.camRelOffset.lerp(_camTarget, expAlpha(10));
      _anchorPos.copy(b.renderP).sub(this.renderOrigin);
      this.cam.position.copy(_anchorPos).add(this.camRelOffset);
      _camSimPos.copy(this.cam.position).add(this.renderOrigin);
      this.cam.position.y = Math.max(
        this.cam.position.y,
        this.surfaceHeightAt(_camSimPos.x, _camSimPos.z, b.renderP.y + 1) + 1.1
      );

      _lookTarget.set(this.man.p.x, this.man.p.y + 1.2, this.man.p.z).sub(this.renderOrigin);
      _c.set(0, 0.55, -c.cam[2] * 1.45).applyQuaternion(b.renderQ).add(_anchorPos);
      _lookTarget.lerp(_c, blend);
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(_lookTarget);
    } else if (this.mode === 'fly') {
      const c = this.cur.config;
      // Parented camAnchor provides the exact interpolated visual transform of the aircraft
      this.camAnchor.getWorldPosition(_anchorPos);
      this.camAnchor.getWorldQuaternion(_anchorQuat);

      if (this.cameraMode === 'cockpit') {
        _camTarget.set(...c.cockpitOffset).applyQuaternion(_anchorQuat).add(_anchorPos);
        this.cam.position.copy(_camTarget);
        _lookTarget.set(0, c.cockpitOffset[1] - 0.1, -40).applyQuaternion(_anchorQuat).add(_anchorPos);
        this.cam.up.copy(_up).applyQuaternion(_anchorQuat);
        this.cam.lookAt(_lookTarget);
        const fv = 72 + THREE.MathUtils.clamp(this.cur.v.length() * c.fovk, 0, 12);
        if (Math.abs(this.cam.fov - fv) > 0.05) {
          this.cam.fov += (fv - this.cam.fov) * expAlpha(4);
          projDirty = true;
        }
      } else if (this.cameraMode === 'orbit') {
        this.camYaw += _wrap(this.camYawTarget - this.camYaw) * expAlpha(14);
        this.camPitch += (this.camPitchTarget - this.camPitch) * expAlpha(14);
        const dist = c.cam[2] * 1.2 * this.camZoom;
        const cp = Math.cos(this.camPitch);
        _camTarget.set(
          Math.sin(this.camYaw) * cp * dist,
          Math.sin(this.camPitch) * dist + 1.5,
          Math.cos(this.camYaw) * cp * dist
        );
        this.camRelOffset.lerp(_camTarget, expAlpha(16));
        this.cam.position.copy(_anchorPos).add(this.camRelOffset);
        _camSimPos.copy(this.cam.position).add(this.renderOrigin);
        const minGroundY = groundHeightAt(_camSimPos.x, _camSimPos.z) + 1.2;
        const neededLift = Math.max(0, minGroundY - this.cam.position.y);
        this.camGroundLift += (neededLift - this.camGroundLift) * expAlpha(neededLift > this.camGroundLift ? 28 : 10);
        this.cam.position.y += this.camGroundLift;
        this.cam.up.set(0, 1, 0);
        this.cam.lookAt(_anchorPos);
      } else {
        // Lockstep chase rig: exponential smoothing in local space before world rotation prevents chord-cutting & FPS jitter
        this.sq.slerp(_anchorQuat, expAlpha(9.5));
        if (!this.drag) {
          this.flyIdle += dt;
          if (this.flyIdle > 1.6) {
            this.flyYawTarget = _wrap(this.flyYawTarget);
            const kk = Math.exp(-2.2 * dt);
            this.flyYawTarget *= kk;
            this.flyPitchTarget *= kk;
          }
        }
        this.flyYaw += _wrap(this.flyYawTarget - this.flyYaw) * expAlpha(14);
        this.flyPitch += (this.flyPitchTarget - this.flyPitch) * expAlpha(14);

        _camLocalTarget
          .set(c.cam[0], c.cam[1], c.cam[2])
          .multiplyScalar(this.camZoom)
          .applyQuaternion(_dq.setFromEuler(_e.set(-this.flyPitch, this.flyYaw, 0, 'YXZ')));
        this.camLocalLag.lerp(_camLocalTarget, expAlpha(18));
        this.camRelOffset.copy(this.camLocalLag).applyQuaternion(this.sq);
        this.cam.position.copy(_anchorPos).add(this.camRelOffset);

        _camSimPos.copy(this.cam.position).add(this.renderOrigin);
        const minGroundY = groundHeightAt(_camSimPos.x, _camSimPos.z) + 0.9;
        const neededLift = Math.max(0, minGroundY - this.cam.position.y);
        this.camGroundLift += (neededLift - this.camGroundLift) * expAlpha(neededLift > this.camGroundLift ? 28 : 10);
        this.cam.position.y += this.camGroundLift;

        const ko = THREE.MathUtils.smoothstep(Math.abs(this.flyYaw) + Math.abs(this.flyPitch), 0.14, 0.92);
        this.camLookRel.lerp(
          _d.set(0, 0.55, -c.cam[2] * 1.45 * (1 - ko)),
          expAlpha(12)
        );
        _lookTarget.copy(this.camLookRel).applyQuaternion(this.sq).add(_anchorPos);

        _b.set(0, 1, 0).applyQuaternion(this.sq);
        const upBlend = 0.52 * (1 - ko * 0.78);
        this.cam.up.copy(_up).lerp(_b, upBlend);
        if (this.cam.up.lengthSq() < 0.04) {
          this.cam.up.set(1, 0, 0).applyQuaternion(this.sq);
        } else {
          this.cam.up.normalize();
        }
        this.cam.lookAt(_lookTarget);
        const fv = 64 + THREE.MathUtils.clamp(this.cur.v.length() * c.fovk, 0, 15);
        if (Math.abs(this.cam.fov - fv) > 0.05) {
          this.cam.fov += (fv - this.cam.fov) * expAlpha(4);
          projDirty = true;
        }
      }
    } else if (this.mode === 'skydive') {
      if (!this.drag) {
        const yawDiff = _wrap(this.man.yaw - this.camYawTarget);
        this.camYawTarget += yawDiff * expAlpha(3.2);
      }
      this.camYaw += _wrap(this.camYawTarget - this.camYaw) * expAlpha(14);
      this.camPitch += (this.camPitchTarget - this.camPitch) * expAlpha(14);
      const d = (this.parachuteOpen ? 10.5 : 5.6 + this.diveRatio * 1.5) * this.camZoom;
      const cp = Math.cos(this.camPitch);
      _camTarget.set(
        Math.sin(this.camYaw) * cp * d,
        Math.sin(this.camPitch) * d + (this.parachuteOpen ? 2.5 : 1.35),
        Math.cos(this.camYaw) * cp * d
      );
      this.camRelOffset.lerp(_camTarget, expAlpha(12));
      _anchorPos.copy(this.man.p).sub(this.renderOrigin);
      this.cam.position.copy(_anchorPos).add(this.camRelOffset);
      _camSimPos.copy(this.cam.position).add(this.renderOrigin);
      const minGroundY = groundHeightAt(_camSimPos.x, _camSimPos.z) + 0.6;
      const neededLift = Math.max(0, minGroundY - this.cam.position.y);
      this.camGroundLift += (neededLift - this.camGroundLift) * expAlpha(neededLift > this.camGroundLift ? 28 : 10);
      this.cam.position.y += this.camGroundLift;
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(_anchorPos.x, _anchorPos.y + (this.parachuteOpen ? 2.0 : 0.8), _anchorPos.z);
      const targetFov = this.parachuteOpen ? 64 : 74 + this.diveRatio * 14;
      if (Math.abs(this.cam.fov - targetFov) > 0.05) {
        this.cam.fov += (targetFov - this.cam.fov) * expAlpha(4);
        projDirty = true;
      }
    } else {
      this.camYaw += _wrap(this.camYawTarget - this.camYaw) * expAlpha(16);
      this.camPitch += (this.camPitchTarget - this.camPitch) * expAlpha(16);
      const d = 5.2 * this.camZoom;
      const cp = Math.cos(this.camPitch);
      _camTarget.set(
        Math.sin(this.camYaw) * cp * d,
        Math.sin(this.camPitch) * d + 1.5,
        Math.cos(this.camYaw) * cp * d
      );
      this.camRelOffset.lerp(_camTarget, expAlpha(16));
      _anchorPos.copy(this.man.p).sub(this.renderOrigin);
      this.cam.position.copy(_anchorPos).add(this.camRelOffset);
      _camSimPos.copy(this.cam.position).add(this.renderOrigin);
      this.cam.position.y = Math.max(
        this.cam.position.y,
        groundHeightAt(_camSimPos.x, _camSimPos.z) + 0.5
      );
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(_anchorPos.x, _anchorPos.y + 1.4, _anchorPos.z);
      if (Math.abs(this.cam.fov - 60) > 0.05) {
        this.cam.fov += (60 - this.cam.fov) * expAlpha(5);
        projDirty = true;
      }
    }

    if (projDirty) {
      this.cam.updateProjectionMatrix();
    }

    if (this.camShake > 0.008 && this.phase === 'playing' && !this.boarding) {
      const amp = Math.min(0.85, this.camShake) * 0.42;
      const t = this.elapsed;
      this.cam.position.x += Math.sin(t * 37.0) * amp;
      this.cam.position.y += Math.cos(t * 43.0 + 1.1) * amp * 0.85;
      this.cam.position.z += Math.sin(t * 31.0 + 2.3) * amp * 0.6;
    }

    this.cam.updateMatrixWorld();
    this.world.skyMesh.position.copy(this.cam.position);
  }

  private updateSunShadowTarget(): void {
    if (this.isSoftwareGl) return;
    const focusSim = this.phase === 'lobby' ? this.cur.renderP : this.mode === 'fly' ? this.cur.renderP : this.man.p;
    _focusRender.copy(focusSim).sub(this.renderOrigin);

    const offset = _c.set(320, 480, 220);
    if (this.timeOfDay === 'dawn') offset.set(550, 140, -280);
    else if (this.timeOfDay === 'dusk') offset.set(-520, 120, -240);
    else if (this.timeOfDay === 'night') offset.set(240, 380, -320);

    // Snap directional shadow target to texel grid increments in light-view orthonormal space
    // so ground/building shadows never shimmer or crawl when banking or turning
    _lightFwd.copy(offset).normalize();
    _lightRight.crossVectors(_up, _lightFwd).normalize();
    _lightUp.crossVectors(_lightFwd, _lightRight).normalize();

    const shadowRes = this.isTouchGpu ? 1024 : 2048;
    const texelStep = 250 / shadowRes;
    const u = Math.round(_focusRender.dot(_lightRight) / texelStep) * texelStep;
    const v = Math.round(_focusRender.dot(_lightUp) / texelStep) * texelStep;
    const wDepth = _focusRender.dot(_lightFwd);

    _snappedTarget
      .set(0, 0, 0)
      .addScaledVector(_lightRight, u)
      .addScaledVector(_lightUp, v)
      .addScaledVector(_lightFwd, wDepth);

    this.sun.target.position.copy(_snappedTarget);
    this.sun.position.copy(_snappedTarget).add(offset);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  private emitHud(): void {
    const a = this.cur;
    const fly = this.mode === 'fly';
    const sky = this.mode === 'skydive';
    const alt = sky
      ? Math.max(0, this.man.p.y - Math.max(0, groundHeightAt(this.man.p.x, this.man.p.z)))
      : Math.max(0, a.p.y - groundHeightAt(a.p.x, a.p.z) - a.config.y0);
    const speedMs = sky ? this.manV.length() : a.v.length();
    _a.set(0, 0, -1).applyQuaternion(a.q);
    const hdgRad = sky ? -this.man.yaw : Math.atan2(_a.x, -_a.z);
    const headingDeg = ((Math.round((hdgRad * 180) / Math.PI) % 360) + 360) % 360;

    let promptText = '';
    if (this.phase === 'playing') {
      if (this.boarding) {
        promptText = `جاري الصعود إلى ${this.boarding.target.config.nameAr}...`;
      } else if (sky) {
        promptText = this.parachuteOpen
          ? 'المظلة مفتوحة — W: غوص · A/D: التفاف · S: فرملة هبوط ناعمة'
          : 'سقوط حر! W: غوص سريع · A/D: توجيه · Space: فتح المظلة';
      } else if (!fly) {
        const b = this.nearestAircraft();
        if (b) promptText = `اضغط F لركوب ${b.config.nameAr}`;
      } else if (a.crash <= 0) {
        if (a.ground && speedMs < 10) {
          promptText = 'اضغط F للنزول من الطائرة';
        } else if (this.lockedTarget) {
          promptText = `تم القفل على ${this.lockedTarget.config.mapLabel} — اضغط X لإطلاق صاروخ`;
        }
      }
    }

    let bubVisible = false;
    let bubX = window.innerWidth / 2;
    let bubY = 90;
    let onScreen = false;
    if (this.phase === 'playing' && this.bubT > 0) {
      _proj.set(this.npc.p.x, this.npc.p.y + 2.4, this.npc.p.z).sub(this.renderOrigin).project(this.cam);
      onScreen =
        _proj.z < 1 &&
        Math.abs(_proj.x) < 1.05 &&
        _proj.y > -1 &&
        _proj.y < 1.05 &&
        _camSimPos.copy(this.cam.position).add(this.renderOrigin).distanceTo(this.npc.p) < 140;
      bubVisible = true;
      if (onScreen) {
        bubX = (_proj.x * 0.5 + 0.5) * window.innerWidth;
        bubY = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
      }
    }

    let lockScreenX = 0.5;
    let lockScreenY = 0.5;
    let lockOnScreen = false;
    let lockDistM = 0;
    let lockTargetName = this.lockedTarget ? this.lockedTarget.config.nameAr : '';
    if (fly && this.boss.lockedByPlayer && this.isBossTargetable()) {
      this.getBossCenterPos(_bossCenterPos);
      lockDistM = Math.round(a.p.distanceTo(_bossCenterPos));
      lockTargetName = 'MEGATRON - زعيم السايبرترون';
      _proj.copy(_bossCenterPos).sub(this.renderOrigin).project(this.cam);
      if (_proj.z < 1 && Math.abs(_proj.x) <= 0.96 && Math.abs(_proj.y) <= 0.96) {
        lockOnScreen = true;
        lockScreenX = _proj.x * 0.5 + 0.5;
        lockScreenY = -_proj.y * 0.5 + 0.5;
      }
    } else if (fly && this.lockedTarget) {
      lockDistM = Math.round(a.p.distanceTo(this.lockedTarget.p));
      _proj.copy(this.lockedTarget.renderP).sub(this.renderOrigin).project(this.cam);
      if (_proj.z < 1 && Math.abs(_proj.x) <= 0.96 && Math.abs(_proj.y) <= 0.96) {
        lockOnScreen = true;
        lockScreenX = _proj.x * 0.5 + 0.5;
        lockScreenY = -_proj.y * 0.5 + 0.5;
      }
    }

    let bossOnScreen = false;
    let bossScreenX = 0.5;
    let bossScreenY = 0.5;
    this.getBossCenterPos(_bossCenterPos);
    const bossDistM = Math.round(a.p.distanceTo(_bossCenterPos));
    if (this.megatronRig.root.visible) {
      _proj.copy(_bossCenterPos).sub(this.renderOrigin).project(this.cam);
      if (_proj.z < 1 && Math.abs(_proj.x) <= 0.96 && Math.abs(_proj.y) <= 0.96) {
        bossOnScreen = true;
        bossScreenX = _proj.x * 0.5 + 0.5;
        bossScreenY = -_proj.y * 0.5 + 0.5;
      }
    }

    // Cockpit Pitch, Roll & Velocity Vector (FPM) projection
    _e.setFromQuaternion(a.q, 'YXZ');
    const pitchDeg = Math.round((_e.x * 180) / Math.PI * 10) / 10;
    const rollDeg = Math.round((_e.z * 180) / Math.PI * 10) / 10;
    const aoaDeg = Math.round((a.aoa * 180) / Math.PI * 10) / 10;

    let fpmOffsetX = 0;
    let fpmOffsetY = 0;
    if (fly && speedMs > 8) {
      _proj.copy(a.renderP).addScaledVector(a.v, 3).sub(this.renderOrigin).project(this.cam);
      if (_proj.z < 1) {
        fpmOffsetX = THREE.MathUtils.clamp(_proj.x, -0.45, 0.45);
        fpmOffsetY = THREE.MathUtils.clamp(-_proj.y, -0.45, 0.45);
      }
    }

    const nearCarrierDistM = Math.round(
      Math.hypot(a.p.x - this.world.carrier.x, a.p.z - this.world.carrier.z)
    );
    const playerPos = fly ? a.p : this.man.p;
    const mission = this.missionMgr.buildSnapshot(playerPos, this.tanker.p, this.world);
    const distMainAir = Math.hypot(playerPos.x, playerPos.z + 1300);
    const distHighAir = Math.hypot(playerPos.x - this.world.highlandBase.x, playerPos.z - this.world.highlandBase.z);
    const distIslAir = Math.hypot(playerPos.x - this.world.islandRunway.x, playerPos.z - this.world.islandRunway.z);
    const distNorthAir = Math.hypot(
      playerPos.x - this.world.northernAirstrip.x,
      playerPos.z - this.world.northernAirstrip.z
    );
    const distDesertAir = Math.hypot(
      playerPos.x - this.world.desertRadarBase.x,
      playerPos.z - this.world.desertRadarBase.z
    );
    const nearestAirportDistM = Math.round(
      Math.min(distMainAir, distHighAir, distIslAir, distNorthAir, distDesertAir)
    );

      const trueAirspeed = fly && !a.ground ? Math.max(a.tas, speedMs) : speedMs;
      const altM = Math.max(0, alt);
      const sos = Math.max(295, 340.3 - 0.004 * Math.min(altM, 11000));
      const machNum = trueAirspeed / sos;
      const stallRad = (a.config.aero.stallAoADeg * Math.PI) / 180;

      this.onHudUpdate({
        phase: this.phase,
        mode: this.mode,
        cameraMode: this.cameraMode,
        aircraftId: a.config.id,
        aircraftNameAr: a.config.nameAr,
        aircraftNameEn: a.config.nameEn,
        hasMissiles: !!a.config.hasMissiles,
        missileCooldownPct: Math.round((1 - this.missileCooldown / 2.0) * 100),
        hasBombs: !!a.config.hasBombs,
        bombCooldownPct: Math.round((1 - this.bombCooldown / 1.6) * 100),
        flaresCount: this.flaresCount,
        flareCooldownPct: Math.round((1 - this.flareCooldown / 1.4) * 100),
        missileAlert: this.missileAlert,
        incomingMissileDistM: this.incomingMissileDistM,
        tailhookDown: this.tailhookDown,
        nearCarrierDistM,
        arrestedWire: this.arrestedWireTimer > 0,
        bolterWarning: this.bolterWarningTimer > 0,
        fuelPct: Math.round(this.fuelPct),
        refuelDistanceM: this.refuelDistanceM,
        refuelAssist: this.refuelAssist,
        refuelConnected: this.refuelConnected,
        refuelProgressPct: Math.round(this.refuelProgress * 100),
        refuelDockPct: Math.round(this.refuelHoseExtend * 100),
        gForce: Math.round(this.gForce * 10) / 10,
        machNumber: Math.round(machNum * 100) / 100,
        supersonic: machNum >= 1.0,
        sonicBoomFlash: this.sonicBoomFlash,
        pitchDeg,
        rollDeg,
        aoaDeg,
        fpmOffsetX,
        fpmOffsetY,
        lockScreenX,
        lockScreenY,
        lockOnScreen,
        lockDistM,
        lockTargetName,
        parachuteOpen: this.parachuteOpen,
        boarding: !!this.boarding,
        hullPct: Math.max(0, Math.round(a.hull)),
        damage: { ...a.damage },
        engineOverheated: fly && a.engineOverheat >= 0.92,
        gearBroken: fly && a.damage.gear < 0.35,
        speedKmh: Math.round(trueAirspeed * 3.6),
        speedKnots: Math.round(trueAirspeed * 1.94384),
        altitudeM: Math.round(alt),
        vsiMs: Math.round(sky ? this.manV.y : a.v.y),
        headingDeg,
        throttlePct: Math.round(a.thr * 100),
        spoolPct: Math.round(a.spool * 100),
        afterburner: fly && a.config.aero.hasAfterburner && a.spool > 0.82 && a.crash <= 0,
        stall: fly && Math.abs(a.aoa) > stallRad && !a.ground && trueAirspeed > 12,
        onGround: fly ? a.ground : false,
        crashed: fly && a.crash > 0,
      autoLevel: this.autoLevel,
      flapsActive: fly ? this.flapsActive : false,
      papiSlope: fly ? this.papiSlope : 'off',
      weatherCondition: this.weatherCondition,
      windSpeedKmh: Math.round(Math.hypot(this.weatherWindVec.x, this.weatherWindVec.z) * 3.6),
      windDirDeg:
        ((Math.round((Math.atan2(this.weatherWindVec.x, -this.weatherWindVec.z) * 180) / Math.PI) % 360) + 360) %
        360,
      turbulencePct: Math.round(this.weatherTurbulence * 100),
      fps: this.fps,
      promptText,
      samiMood: this.npc.mood,
      samiStatus: this.getSamiStatusText(),
      stats: {
        player: { ...this.stats.player },
        sami: { ...this.stats.sami },
      },
      ringsCollected: this.ringsCollected,
      totalRings: this.world.rings.length,
      mission,
      bubble: {
        visible: bubVisible,
        text: onScreen ? this.bubTxt : `سامي: ${this.bubTxt}`,
        x: bubX,
        y: bubY,
        onScreen,
      },
      nearestAirportDistM,
      boss: {
        active: this.boss.phase !== 'idle' && this.boss.phase !== 'defeated',
        phase: this.boss.phase,
        mode: this.boss.mode,
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        distM: bossDistM,
        onScreen: bossOnScreen,
        screenX: bossScreenX,
        screenY: bossScreenY,
        lockedByPlayer: this.boss.lockedByPlayer,
        laserWarning: this.boss.phase === 'mech' && this.boss.chargeTimer > 0,
      },
    });
  }

  private clearKeys(): void {
    for (const k in this.keys) this.keys[k] = 0;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    this.audio.unlock();
    this.keys[e.code] = 1;
    if (e.repeat) return;

    if (this.phase === 'playing') {
      if (e.code === 'KeyF') this.toggleBoard();
      if (e.code === 'KeyX') this.fireMissile();
      if (e.code === 'KeyB') this.dropBomb();
      if (e.code === 'KeyG') this.deployFlares();
      if (e.code === 'KeyH') this.toggleTailhook();
      if (e.code === 'KeyL') this.toggleAutoLevel();
      if (e.code === 'KeyK') this.summonMegatron();
      if (e.code === 'Space' && this.mode === 'skydive') this.deployParachute();
      if (e.code === 'KeyR') this.resetToRunway();
      if (e.code === 'KeyV' && this.mode === 'fly') this.cycleCameraMode();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = 0;
  };

  private onBlur = (): void => {
    this.clearKeys();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.drag) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-ui-interactive="true"]')) return;
    this.audio.unlock();
    this.drag = true;
    this.dragId = e.pointerId;
    this.lx = e.clientX;
    this.ly = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.dragId) return;
    const dx = THREE.MathUtils.clamp(e.clientX - this.lx, -70, 70);
    const dy = THREE.MathUtils.clamp(e.clientY - this.ly, -70, 70);
    this.lx = e.clientX;
    this.ly = e.clientY;
    if (this.phase === 'lobby') {
      this.lobbyOrbitYawTarget -= dx * 0.0065;
      this.lobbyOrbitPitchTarget = THREE.MathUtils.clamp(this.lobbyOrbitPitchTarget + dy * 0.005, 0.05, 1.15);
    } else if (this.mode === 'fly' && this.cameraMode === 'chase') {
      this.flyYawTarget -= dx * 0.0055;
      this.flyPitchTarget = THREE.MathUtils.clamp(this.flyPitchTarget + dy * 0.0055, -0.45, 1.15);
      this.flyIdle = 0;
    } else {
      this.camYawTarget -= dx * 0.0055;
      this.camPitchTarget = THREE.MathUtils.clamp(this.camPitchTarget + dy * 0.0055, -0.05, 1.3);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) this.drag = false;
  };

  private onWheel = (e: WheelEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-ui-interactive="true"]')) return;
    this.camZoomTarget = THREE.MathUtils.clamp(this.camZoomTarget * (1 + e.deltaY * 0.001), 0.5, 2.8);
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLostCb(true);
  };

  private onContextRestored = (): void => {
    this.onContextLostCb(false);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.wingtipTrails?.forEach((t) => t.dispose());
    this.bossLightning?.dispose();
    this.smokeTex?.dispose();
    this.craterTex?.dispose();
    this.envRenderTarget?.dispose();
    this.envDomeGeo?.dispose();
    this.envDomeMat?.dispose();
    this.pmremGenerator?.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
