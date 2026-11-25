import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TimeOfDay } from '../types/flight';
import type { WorldTextures } from './materials';

export interface SkyRing {
  id: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  radius: number;
  collected: boolean;
}

export interface HelipadDeck {
  x: number;
  z: number;
  halfW: number;
  halfL: number;
  y: number;
}

export interface BuildingCollider {
  x: number;
  z: number;
  hw: number;
  hd: number;
  h: number;
}

export interface BombTarget {
  id: number;
  pos: THREE.Vector3;
  radius: number;
  destroyed: boolean;
}

export interface AirfieldBounds {
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfL: number;
}

export interface WorldObjects {
  root: THREE.Group;
  radarDish: THREE.Object3D;
  windsock: THREE.Object3D;
  clouds: THREE.InstancedMesh;
  oceanMesh: THREE.Mesh;
  setOceanOrigin: (rx: number, rz: number) => void;
  skyMesh: THREE.Mesh;
  skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uNightFactor: { value: number };
  };
  cloudUniforms: {
    uTopColor: { value: THREE.Color };
    uShadowColor: { value: THREE.Color };
    uFogColor: { value: THREE.Color };
    uFogDensity: { value: number };
    uOvercast: { value: number };
  };
  runwayLights: THREE.InstancedMesh;
  updatePapiLights: (slope: 'high' | 'on' | 'low' | 'off') => void;
  setTargetVisible: (id: number, visible: boolean) => void;
  nightGlowMats: THREE.MeshStandardMaterial[];
  rings: SkyRing[];
  targets: BombTarget[];
  helipads: HelipadDeck[];
  colliders: BuildingCollider[];
  carrier: { x: number; z: number; dz: number; halfW: number; halfL: number; deckY: number; wireZ: number[] };
  highlandBase: AirfieldBounds;
  islandRunway: AirfieldBounds;
  northernAirstrip: AirfieldBounds;
  desertRadarBase: AirfieldBounds;
  applyTimeOfDay: (
    tod: TimeOfDay,
    scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight
  ) => void;
  applyWeather: (
    fogMul: number,
    cloudScale: number,
    overcast: number,
    windX: number,
    windZ: number,
    dt: number,
    elapsed: number,
    scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight
  ) => void;
  update: (dt: number, elapsed: number) => void;
}

const _turbDummy = new THREE.Object3D();
const _papiColor = new THREE.Color();
const _targetDummy = new THREE.Object3D();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * valueNoise(x * freq, z * freq);
    freq *= 2.05;
    amp *= 0.5;
  }
  return v;
}

/**
 * Deterministic terrain height across the 80km x 80km open world:
 * - Main Coastal Mega-Airport plateau at y=0 (dual parallel runways + terminals + hangars)
 * - Highland Forward Airbase plateau at (-2900, -3400), y=145m
 * - Northern Mountain Range & High-Altitude Military Airstrip at (-3200, -16500), y=340m
 * - Southern Desert Dunes & Radar Base plateau at (-1400, 15500), y=32m
 * - Offshore Tropical Island & Airstrip at (2900, -1400), y=14m
 * - Endless ocean east of x > 1160 & surrounding outer continental coastline
 */
export function groundHeightAt(x: number, z: number): number {
  // Fast-path flat plateau for Mega-Airport
  if (x >= -330 && x <= 340 && z >= -3250 && z <= 560) {
    return 0;
  }

  // Fast-path flat plateau for Highland Forward Airbase (x=-2900, z=-3400, y=145)
  if (Math.abs(x + 2900) <= 55 && Math.abs(z + 3400) <= 640) {
    return 145;
  }

  // Fast-path flat plateau for Northern High-Altitude Military Airstrip (x=-3200, z=-16500, y=340)
  if (Math.abs(x + 3200) <= 85 && Math.abs(z + 16500) <= 820) {
    return 340;
  }

  // Fast-path flat plateau for Southern Desert Radar Base (x=-1400, z=15500, y=32)
  if (Math.abs(x + 1400) <= 135 && Math.abs(z - 15500) <= 740) {
    return 32;
  }

  // Fast-path flat plateau for Offshore Island Runway (x=2900, z=-1400, y=14)
  if (Math.abs(x - 2900) <= 52 && Math.abs(z + 1400) <= 490) {
    return 14;
  }

  // 1. Airport & Downtown Flat Mask (y = 0)
  const airX = x < -330 ? smoothstep(-330, -640, x) : x > 340 ? smoothstep(340, 620, x) : 0;
  const airZ = z > 560 ? smoothstep(560, 960, z) : z < -3250 ? smoothstep(-3250, -3700, z) : 0;
  const outsideAirport = Math.max(airX, airZ);

  // Coastal city flat zone: x in [520, 1140], z in [-1150, 550]
  const inCityX = 1 - smoothstep(300, 460, Math.abs(x - 830));
  const inCityZ = 1 - smoothstep(820, 1080, Math.abs(z + 300));
  const cityFlat = inCityX * inCityZ;

  // 2. Alpine Mountain Ranges (west x < -650, expansive northern alpine range z < -3450, central-south hills)
  const westFactor = smoothstep(-620, -1950, x) * (1 - smoothstep(4200, 7600, z));
  const northFactor = smoothstep(-3450, -5800, z);
  const southHills = smoothstep(1050, 2400, z) * (1 - smoothstep(4200, 6200, z)) * (1 - smoothstep(900, 1500, x));
  const mtnMask = Math.max(westFactor, northFactor, southHills * 0.65);

  let h = 0;
  if (mtnMask > 0.001) {
    const n1 = fbm(x * 0.00048 + 3.1, z * 0.00048 - 1.7);
    const n2 = fbm(x * 0.00145 - 5.4, z * 0.00145 + 2.3);
    const ridge = 1 - Math.abs(n1 * 2 - 1);
    const northBoost = smoothstep(-5000, -14000, z) * 240;
    const peak = Math.pow(ridge, 1.38) * (580 + northBoost) + n2 * 125;
    // Mountain Canyon Pass leading toward Highland Base
    const canyonMask = 1 - smoothstep(120, 320, Math.abs(z + 1500 - Math.sin(x * 0.002) * 260));
    h += peak * mtnMask * (1 - canyonMask * 0.72);
  }

  // Rolling countryside meadows outside airport, city & desert
  const desertMask = smoothstep(4200, 7400, z) * (1 - smoothstep(950, 1300, x));
  const meadowN = fbm(x * 0.0011 + 11.2, z * 0.0011 + 7.8);
  h += Math.max(0, (meadowN - 0.4) * 38) * outsideAirport * (1 - cityFlat) * (1 - desertMask);

  // Southern Desert wind-sculpted sand dunes & mesas (z > 4200)
  if (desertMask > 0.001) {
    const duneBase = fbm(x * 0.00075 - 2.4, z * 0.00075 + 4.9);
    const duneWave = Math.sin(x * 0.0042 + z * 0.0028 + duneBase * 4.5) * 0.5 + 0.5;
    const mesa = smoothstep(0.66, 0.78, fbm(x * 0.00032 + 8.1, z * 0.00032 - 3.6)) * 55;
    const desertH = 14 + duneBase * 34 + duneWave * 16 + mesa;
    h = THREE.MathUtils.lerp(h, desertH, desertMask);
  }

  // Blend in Highland Base plateau cleanly (x=-2900, z=-3400, y=145)
  const highDx = smoothstep(55, 290, Math.abs(x + 2900));
  const highDz = smoothstep(640, 920, Math.abs(z + 3400));
  const highBlend = 1 - Math.max(highDx, highDz);
  if (highBlend > 0) {
    h = THREE.MathUtils.lerp(h, 145, highBlend);
  }

  // Blend in Northern Military Airstrip plateau cleanly (x=-3200, z=-16500, y=340)
  const northBaseDx = smoothstep(85, 360, Math.abs(x + 3200));
  const northBaseDz = smoothstep(820, 1180, Math.abs(z + 16500));
  const northBaseBlend = 1 - Math.max(northBaseDx, northBaseDz);
  if (northBaseBlend > 0) {
    h = THREE.MathUtils.lerp(h, 340, northBaseBlend);
  }

  // Blend in Southern Desert Radar Base plateau cleanly (x=-1400, z=15500, y=32)
  const desertBaseDx = smoothstep(135, 420, Math.abs(x + 1400));
  const desertBaseDz = smoothstep(740, 1080, Math.abs(z - 15500));
  const desertBaseBlend = 1 - Math.max(desertBaseDx, desertBaseDz);
  if (desertBaseBlend > 0) {
    h = THREE.MathUtils.lerp(h, 32, desertBaseBlend);
  }

  // 3. Ocean Coastline Slope (east x > 1150) & Continental Perimeter Shelf (80km landmass drops into endless sea)
  const eastCoast = smoothstep(1150, 1420, x);
  const westCoast = smoothstep(-32000, -37500, x);
  const northCoast = smoothstep(-33500, -38500, z);
  const southCoast = smoothstep(32000, 37500, z);
  const coastT = Math.max(eastCoast, westCoast, northCoast, southCoast);
  if (coastT > 0) {
    h = THREE.MathUtils.lerp(h, -11, coastT);
  }

  // 4. Offshore Tropical Island & Airfield at (x=2900, z=-1400)
  const dxIsl = (x - 2900) / 720;
  const dzIsl = (z + 1400) / 900;
  const islDist = Math.hypot(dxIsl, dzIsl);
  if (islDist < 1.18) {
    const islShape = 1 - smoothstep(0.65, 1.12, islDist);
    const stripMask =
      (1 - smoothstep(52, 130, Math.abs(x - 2900))) *
      (1 - smoothstep(490, 620, Math.abs(z + 1400)));
    const islBump = fbm(x * 0.0025, z * 0.0025) * 42;
    const islH = -11 + islShape * (25 + islBump * (1 - stripMask));
    h = Math.max(h, islH);
  }

  h *= outsideAirport * (1 - cityFlat * 0.96);
  return h;
}

export function buildWorld(
  scene: THREE.Scene,
  textures: WorldTextures,
  isSoftwareGl: boolean
): WorldObjects {
  void isSoftwareGl;
  const root = new THREE.Group();
  root.frustumCulled = true;
  scene.add(root);

  const airportChunk = new THREE.Group();
  airportChunk.frustumCulled = true;
  const cityChunk = new THREE.Group();
  cityChunk.frustumCulled = true;
  const natureChunk = new THREE.Group();
  natureChunk.frustumCulled = true;
  const carrierChunk = new THREE.Group();
  carrierChunk.frustumCulled = true;
  root.add(airportChunk, cityChunk, natureChunk, carrierChunk);

  const helipads: HelipadDeck[] = [];
  const colliders: BuildingCollider[] = [];
  const nightGlowMats: THREE.MeshStandardMaterial[] = [];

  // 1. Physical-Inspired Rayleigh / Mie Atmospheric Sky Dome + Glowing Sun Disc & Lens Halo
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x0c3473) },
    uHorizonColor: { value: new THREE.Color(0x7fb4e8) },
    uSunColor: { value: new THREE.Color(0xfff2d6) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.55, -0.35).normalize() },
    uNightFactor: { value: 0.0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNightFactor;
      varying vec3 vWorldPos;

      float hgPhase(float cosTheta, float g) {
        float g2 = g * g;
        return (1.0 - g2) / (4.0 * 3.14159 * pow(max(0.001, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
      }

      float starHash(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        vec3 sunDir = normalize(uSunDir);
        float elev = max(dir.y, 0.0);
        float cosTheta = dot(dir, sunDir);

        // Rayleigh atmospheric airmass scattering: deep sapphire zenith -> pale azure -> warm golden-blue horizon
        float rayleighT = exp(-elev * 3.6);
        vec3 midSky = mix(uTopColor, uHorizonColor, 0.52);
        vec3 col = mix(uTopColor, midSky, smoothstep(0.0, 0.46, rayleighT));
        col = mix(col, uHorizonColor, pow(1.0 - elev, 2.25));

        // Mie golden-amber horizon forward scattering toward the sun azimuth
        float sunElev = max(sunDir.y, 0.0);
        float horHaze = pow(1.0 - elev, 4.0);
        float mieHor = pow(max(0.0, cosTheta * 0.5 + 0.5), 2.4) * horHaze;
        vec3 warmHorizon = mix(uHorizonColor * 1.12, uSunColor * 1.08, clamp(0.52 - sunElev * 0.22, 0.12, 0.72));
        col = mix(col, warmHorizon, clamp(mieHor * 0.68 + horHaze * 0.26, 0.0, 0.88));

        // High-altitude wispy cirrus streaks
        float c1 = sin(dir.x * 11.0 + dir.z * 6.5) * cos(dir.z * 13.0 - dir.x * 4.5);
        float c2 = sin(dir.x * 23.0 - dir.z * 15.0) * 0.5;
        float cirrus = max(0.0, c1 + c2 * 0.5) * smoothstep(0.06, 0.42, elev) * (1.0 - smoothstep(0.55, 0.95, elev));
        col += mix(uHorizonColor, vec3(0.95, 0.97, 1.0), 0.48) * cirrus * (0.065 * (1.0 - uNightFactor * 0.75));

        // Crisp procedural night starfield
        if (uNightFactor > 0.05 && dir.y > 0.02) {
          vec3 grid = floor(dir * 260.0);
          float h = starHash(grid);
          if (h > 0.9935) {
            float tw = (h - 0.9935) / 0.0065;
            col += vec3(0.82, 0.90, 1.0) * tw * uNightFactor * smoothstep(0.02, 0.24, dir.y) * 1.1;
          }
        }

        // Henyey-Greenstein Mie solar aureole + crisp solar disc
        float mieHalo = hgPhase(cosTheta, 0.72) * 0.24 + hgPhase(cosTheta, 0.94) * 0.52;
        col += uSunColor * mieHalo * (0.48 + horHaze * 0.56);
        col += uSunColor * smoothstep(0.9988, 0.99972, cosTheta) * (1.65 - uNightFactor * 0.65);

        // Sub-horizon ground bounce tint
        if (dir.y < 0.0) {
          col = mix(col, uHorizonColor * 0.46, smoothstep(0.0, -0.22, dir.y));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(52000, 28, 18), skyMat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1;

  // Additive Sun Glow & Anamorphic Lens Halo billboard anchored inside skyMesh
  const sunHaloUniforms = {
    uColor: { value: new THREE.Color(0xfff2d6) },
    uOpacity: { value: 0.92 },
  };
  const sunHaloMat = new THREE.ShaderMaterial({
    uniforms: sunHaloUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float core = exp(-r * r * 36.0) * 1.15;
        float corona = exp(-r * 4.8) * 0.42;
        float streak = exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 2.2) * 0.24;
        float ring = exp(-pow((r - 0.52) * 12.0, 2.0)) * 0.08;
        float glow = (core + corona + streak + ring) * smoothstep(1.0, 0.15, r) * uOpacity;
        if (glow < 0.004) discard;
        gl_FragColor = vec4(uColor * glow, glow);
      }
    `,
  });
  const sunHaloMesh = new THREE.Mesh(new THREE.PlaneGeometry(14500, 14500), sunHaloMat);
  sunHaloMesh.frustumCulled = false;
  sunHaloMesh.renderOrder = -1;
  skyMesh.add(sunHaloMesh);
  root.add(skyMesh);

  // 2. Vast Sculpted Terrain (80km x 80km) with Multi-Layered Procedural Satellite Terrain Shader & Detail Normal Map
  const TERRAIN_SIZE = 80000;
  const SEG = 240;
  textures.grass.repeat.set(1060, 1060);
  textures.terrainDetailNormal.repeat.set(1500, 1500);
  const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i) - 1600;
    pos.setZ(i, vz);
    pos.setY(i, groundHeightAt(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.grass,
    normalMap: textures.terrainDetailNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.9,
    metalness: 0.02,
  });
  terrainMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTerrainWorldPos = position;
        vTerrainWorldNormal = normal;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNormal;

        float tHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float tNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x),
            mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float tFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * tNoise(p);
            p *= 2.07;
            a *= 0.5;
          }
          return v;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 wp = vTerrainWorldPos.xz;
        float alt = vTerrainWorldPos.y;
        float flatMask = clamp(normalize(vTerrainWorldNormal).y, 0.0, 1.0);

        // Satellite multi-scale biome noise & agricultural field mosaic
        float macroN = tFbm(wp * 0.0014 + vec2(2.3, 5.1));
        float patchN = tFbm(wp * 0.0062 - vec2(4.7, 1.9));
        float microN = tNoise(wp * 0.032 + vec2(patchN * 2.1));
        float gridCell = tHash(floor(wp * 0.0038 + vec2(patchN * 0.55)));

        // Rich eye-comfortable palette: golden beach sand, lush plains, desert dunes, stratified cliffs & alpine snow
        vec3 cGrass = vec3(0.22, 0.38, 0.16);
        vec3 cLush = vec3(0.12, 0.27, 0.12);
        vec3 cMeadow = vec3(0.30, 0.42, 0.19);
        vec3 cDirt = vec3(0.39, 0.32, 0.21);
        vec3 cFieldGreen = vec3(0.26, 0.40, 0.17);
        vec3 cSand = vec3(0.78, 0.67, 0.47);
        vec3 cDesertSand = vec3(0.76, 0.59, 0.38);
        vec3 cDesertDune = vec3(0.62, 0.43, 0.25);
        vec3 cRockDark = vec3(0.20, 0.22, 0.26);
        vec3 cRockWarm = vec3(0.34, 0.28, 0.23);
        vec3 cRockLight = vec3(0.42, 0.44, 0.48);
        vec3 cSnow = vec3(0.90, 0.94, 0.98);

        vec3 valleyCol = mix(cGrass, cLush, smoothstep(0.25, 0.72, macroN));
        valleyCol = mix(valleyCol, cMeadow, smoothstep(0.55, 0.85, patchN) * 0.45);
        float fieldMask = smoothstep(0.86, 0.97, flatMask) * (1.0 - smoothstep(35.0, 105.0, alt));
        vec3 agriCol = mix(cFieldGreen, cDirt, smoothstep(0.42, 0.78, gridCell));
        valleyCol = mix(valleyCol, agriCol, fieldMask * 0.48 * smoothstep(0.3, 0.7, patchN));

        // Southern Desert biome transition (z > 4000)
        float desertBiome = smoothstep(4000.0, 7200.0, wp.y) * (1.0 - smoothstep(1050.0, 1250.0, wp.x));
        float duneRipple = sin(wp.x * 0.025 + wp.y * 0.018 + patchN * 4.0) * 0.5 + 0.5;
        vec3 desertCol = mix(cDesertDune, cDesertSand, macroN * 0.65 + duneRipple * 0.35);
        valleyCol = mix(valleyCol, desertCol, desertBiome * 0.92);

        // Exclude flat airport tarmac zone from coastal sand
        float notAirport = max(
          smoothstep(350.0, 440.0, abs(wp.x)),
          max(smoothstep(560.0, 660.0, wp.y), smoothstep(-3240.0, -3340.0, -wp.y))
        );

        // Golden coastal beach sand along every natural shoreline & tropical island near sea level
        float seaLevelBand = smoothstep(-2.2, 0.25, alt) * (1.0 - smoothstep(1.3, 5.4, alt));
        float coastalSandMask = seaLevelBand * smoothstep(0.72, 0.94, flatMask) * notAirport;
        valleyCol = mix(valleyCol, cSand * (0.94 + microN * 0.12), coastalSandMask * 0.90);

        // Subtle asphalt road network weaving through valleys and south to desert radar base
        float roadBand1 = 1.0 - smoothstep(4.5, 9.5, abs(wp.x - 460.0 - sin(wp.y * 0.0018) * 55.0));
        float roadBand2 = 1.0 - smoothstep(4.5, 9.5, abs(wp.y + 420.0 - cos(wp.x * 0.0016) * 65.0));
        float roadBand3 = 1.0 - smoothstep(4.0, 9.0, abs(wp.x + 620.0 - sin(wp.y * 0.0014) * 90.0));
        float roadMask = max(roadBand1, max(roadBand2, roadBand3)) * smoothstep(0.92, 0.99, flatMask) * (1.0 - smoothstep(1100.0, 1180.0, wp.x)) * (1.0 - smoothstep(45.0, 110.0, alt)) * notAirport;
        valleyCol = mix(valleyCol, vec3(0.14, 0.16, 0.19), roadMask * 0.88);

        // Stratified rocky mountain cliffs & canyon walls (Ace Combat style layered rock)
        float strataWave = sin(alt * 0.24 + macroN * 6.0) * 0.5 + 0.5;
        float strata = tNoise(vec2(wp.x * 0.011 + wp.y * 0.011, alt * 0.13)) * 0.68 + strataWave * 0.32;
        vec3 rockCol = mix(cRockDark, cRockLight, smoothstep(0.22, 0.82, strata));
        rockCol = mix(rockCol, cRockWarm, smoothstep(0.35, 0.78, patchN) * 0.42);
        rockCol = mix(rockCol, vec3(0.48, 0.34, 0.22), desertBiome * 0.62);
        float slopeRock = smoothstep(0.89, 0.56, flatMask);
        float altRock = smoothstep(105.0, 245.0, alt);
        vec3 tCol = mix(valleyCol, rockCol, clamp(max(slopeRock, altRock * 0.88), 0.0, 1.0));

        // Crisp high-altitude alpine snow settling on mountain ridges & plateaus
        float snowLine = 272.0 + (macroN - 0.5) * 38.0;
        float snowMask = smoothstep(snowLine, snowLine + 115.0, alt) * smoothstep(0.42, 0.76, flatMask) * (1.0 - desertBiome);
        tCol = mix(tCol, cSnow, clamp(snowMask, 0.0, 1.0));

        diffuseColor.rgb *= tCol;`
      );
  };
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.castShadow = false;
  terrainMesh.receiveShadow = true;
  terrainMesh.frustumCulled = true;
  natureChunk.add(terrainMesh);

  // 3. Endless Animated Ocean with Dual-Scrolling Normal Ripples, Fresnel Sky Reflections, Shoreline Foam & Specular Sun Glint
  const oceanUniforms = {
    uOceanTime: { value: 0 },
    uRenderOrigin: { value: new THREE.Vector2(0, 0) },
    uOceanSunDir: { value: new THREE.Vector3(0.4, 0.55, -0.35).normalize() },
    uOceanSunColor: { value: new THREE.Color(0xfff2d6) },
    uOceanHorizonColor: { value: new THREE.Color(0x7fb4e8) },
  };
  const oceanGeo = new THREE.PlaneGeometry(130000, 130000, 1, 1);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughness: 0.14,
    metalness: 0.38,
    envMapIntensity: 1.55,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOceanTime = oceanUniforms.uOceanTime;
    shader.uniforms.uRenderOrigin = oceanUniforms.uRenderOrigin;
    shader.uniforms.uOceanSunDir = oceanUniforms.uOceanSunDir;
    shader.uniforms.uOceanSunColor = oceanUniforms.uOceanSunColor;
    shader.uniforms.uOceanHorizonColor = oceanUniforms.uOceanHorizonColor;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 uRenderOrigin;
        varying vec2 vOceanWorldXZ;
        varying vec3 vOceanToCam;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 oceanWorldPos = modelMatrix * vec4(position, 1.0);
        vOceanWorldXZ = oceanWorldPos.xz + uRenderOrigin;
        vOceanToCam = cameraPosition - oceanWorldPos.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uOceanTime;
        uniform vec3 uOceanSunDir;
        uniform vec3 uOceanSunColor;
        uniform vec3 uOceanHorizonColor;
        varying vec2 vOceanWorldXZ;
        varying vec3 vOceanToCam;
        vec2 oceanWaveTilt;`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `oceanWaveTilt = vec2(0.0);
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec2 wUv1 = vOceanWorldXZ * 0.0044 + vec2(uOceanTime * 0.022, uOceanTime * 0.014);
          vec2 wUv2 = vOceanWorldXZ * 0.0112 + vec2(-uOceanTime * 0.026, uOceanTime * 0.019);
          vec3 mapN1 = texture2D(normalMap, wUv1).xyz * 2.0 - 1.0;
          vec3 mapN2 = texture2D(normalMap, wUv2).xyz * 2.0 - 1.0;
          oceanWaveTilt = (mapN1.xy * 0.62 + mapN2.xy * 0.48) * normalScale;
          vec3 mapN = normalize(vec3(oceanWaveTilt, 1.0));
          normal = normalize(tbn * mapN);
        #endif`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Deep navy open water -> turquoise coastal shallows (eastern shore & tropical island)
        float eastShallow = 1.0 - smoothstep(1150.0, 1560.0, vOceanWorldXZ.x);
        float islDistO = length((vOceanWorldXZ - vec2(2900.0, -1400.0)) / vec2(740.0, 920.0));
        float islShallow = 1.0 - smoothstep(0.88, 1.28, islDistO);
        float shallowMask = clamp(max(eastShallow, islShallow), 0.0, 1.0);
        vec3 deepWater = vec3(0.018, 0.112, 0.222);
        vec3 shallowWater = vec3(0.048, 0.365, 0.435);
        diffuseColor.rgb = mix(deepWater, shallowWater, shallowMask * 0.88);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 viewDirW = normalize(vViewPosition);
        float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(normal, viewDirW), 0.0), 4.5);
        vec3 skyReflect = mix(vec3(0.05, 0.20, 0.36), uOceanHorizonColor, 0.74);
        totalEmissiveRadiance += skyReflect * fresnel * 0.46;

        // Crisp sun specular glitter path shimmering across animated ocean waves
        vec3 wV = normalize(vOceanToCam);
        vec3 wL = normalize(uOceanSunDir);
        vec3 wN = normalize(vec3(oceanWaveTilt.x * 0.62, 1.0, oceanWaveTilt.y * 0.62));
        vec3 wH = normalize(wL + wV);
        float ndh = max(dot(wN, wH), 0.0);
        float sunVis = smoothstep(-0.02, 0.12, wL.y);
        float specGlint = pow(ndh, 210.0) * 2.15 + pow(ndh, 28.0) * 0.22;
        totalEmissiveRadiance += uOceanSunColor * specGlint * sunVis;

        // Animated shoreline surf foam along east coastline & tropical island
        float coastLine = smoothstep(1165.0, 1225.0, vOceanWorldXZ.x) * (1.0 - smoothstep(1260.0, 1390.0, vOceanWorldXZ.x));
        float islFoam = smoothstep(0.94, 1.02, islDistO) * (1.0 - smoothstep(1.06, 1.16, islDistO));
        float surfBand = sin(vOceanWorldXZ.x * 0.085 - uOceanTime * 1.9 + sin(vOceanWorldXZ.y * 0.015) * 2.0) * 0.5 + 0.5;
        float foam = clamp((coastLine + islFoam) * smoothstep(0.40, 0.92, surfBand), 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.86, 0.93, 0.98) * foam * 0.46;`
      );
  };
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(0, -0.45, 0);
  oceanMesh.castShadow = false;
  oceanMesh.receiveShadow = false;
  oceanMesh.frustumCulled = false;
  natureChunk.add(oceanMesh);

  function setOceanOrigin(rx: number, rz: number): void {
    oceanUniforms.uRenderOrigin.value.set(rx, rz);
  }

  const bakeTransformedGeo = (
    geo: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    uvScaleU = 1,
    uvScaleV = 1
  ): THREE.BufferGeometry => {
    const dummyObj = new THREE.Object3D();
    dummyObj.position.set(x, y, z);
    dummyObj.rotation.set(rx, ry, rz);
    dummyObj.updateMatrix();
    geo.applyMatrix4(dummyObj.matrix);
    if (uvScaleU !== 1 || uvScaleV !== 1) {
      const uv = geo.attributes.uv;
      if (uv) {
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) * uvScaleU, uv.getY(i) * uvScaleV);
        }
      }
    }
    return geo;
  };

  const safeMerge = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
    const hasNonIndexed = geos.some((g) => !g.index);
    const normalized = hasNonIndexed
      ? geos.map((g) => {
          if (!g.index) return g;
          const nonIdx = g.toNonIndexed();
          g.dispose();
          return nonIdx;
        })
      : geos;
    const merged = mergeGeometries(normalized, false);
    normalized.forEach((g) => g.dispose());
    if (!merged) {
      throw new Error('Failed to merge geometries');
    }
    return merged;
  };

  // 4. Enlarged Mega-Airport Complex (Batched Surfaces + Instanced Markings/Lights/Props)
  const apronMat = new THREE.MeshStandardMaterial({
    map: textures.apron,
    normalMap: textures.asphaltNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.82,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  textures.apron.repeat.set(28, 36);
  const apronGeos = [
    bakeTransformedGeo(new THREE.PlaneGeometry(340, 540), 20, 0.03, 70, -Math.PI / 2, 0, 0),
    bakeTransformedGeo(
      new THREE.PlaneGeometry(82, 160),
      -2840,
      145.06,
      -3280,
      -Math.PI / 2,
      0,
      0,
      82 / 340,
      160 / 540
    ),
    bakeTransformedGeo(
      new THREE.PlaneGeometry(96, 220),
      -3120,
      340.06,
      -16380,
      -Math.PI / 2,
      0,
      0,
      96 / 340,
      220 / 540
    ),
    bakeTransformedGeo(
      new THREE.PlaneGeometry(160, 280),
      -1290,
      32.06,
      15460,
      -Math.PI / 2,
      0,
      0,
      160 / 340,
      280 / 540
    ),
  ];
  const mergedApronGeo = mergeGeometries(apronGeos, false);
  apronGeos.forEach((g) => g.dispose());
  const apronMesh = new THREE.Mesh(mergedApronGeo, apronMat);
  apronMesh.castShadow = false;
  apronMesh.receiveShadow = true;
  apronMesh.frustumCulled = true;
  airportChunk.add(apronMesh);

  // All 6 Runways merged into a single draw call with calibrated UV repeat
  textures.runway.repeat.set(1, 3400 / 72);
  const runwayMat = new THREE.MeshStandardMaterial({
    map: textures.runway,
    normalMap: textures.asphaltNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.72,
    metalness: 0.1,
    envMapIntensity: 1.15,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const runwayGeos = [
    bakeTransformedGeo(new THREE.PlaneGeometry(54, 3400), 0, 0.055, -1300, -Math.PI / 2),
    bakeTransformedGeo(new THREE.PlaneGeometry(48, 2900), -190, 0.052, -1050, -Math.PI / 2, 0, 0, 1, 2900 / 3400),
    bakeTransformedGeo(new THREE.PlaneGeometry(36, 1200), -2900, 145.1, -3400, -Math.PI / 2, 0, 0, 1, 1200 / 3400),
    bakeTransformedGeo(new THREE.PlaneGeometry(34, 920), 2900, 14.1, -1400, -Math.PI / 2, 0, 0, 1, 920 / 3400),
    bakeTransformedGeo(new THREE.PlaneGeometry(40, 1540), -3200, 340.1, -16500, -Math.PI / 2, 0, 0, 1, 1540 / 3400),
    bakeTransformedGeo(new THREE.PlaneGeometry(42, 1380), -1400, 32.1, 15500, -Math.PI / 2, 0, 0, 1, 1380 / 3400),
  ];
  const mergedRunwayGeo = mergeGeometries(runwayGeos, false);
  runwayGeos.forEach((g) => g.dispose());
  const runwayMesh = new THREE.Mesh(mergedRunwayGeo, runwayMat);
  runwayMesh.castShadow = false;
  runwayMesh.receiveShadow = true;
  runwayMesh.frustumCulled = true;
  airportChunk.add(runwayMesh);

  // Parallel Taxiways & Cross Connectors merged into 1 draw call
  const taxiMat = new THREE.MeshStandardMaterial({
    color: 0x262d37,
    normalMap: textures.asphaltNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.8,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const taxiGeos = [
    bakeTransformedGeo(new THREE.PlaneGeometry(24, 3100), 78, 0.04, -1150, -Math.PI / 2),
    bakeTransformedGeo(new THREE.PlaneGeometry(24, 2800), -75, 0.04, -1000, -Math.PI / 2),
  ];
  for (const cz of [280, -450, -1450, -2450]) {
    taxiGeos.push(bakeTransformedGeo(new THREE.PlaneGeometry(310, 22), -60, 0.042, cz, -Math.PI / 2));
  }
  const mergedTaxiGeo = mergeGeometries(taxiGeos, false);
  taxiGeos.forEach((g) => g.dispose());
  const taxiMesh = new THREE.Mesh(mergedTaxiGeo, taxiMat);
  taxiMesh.castShadow = false;
  taxiMesh.receiveShadow = true;
  taxiMesh.frustumCulled = true;
  airportChunk.add(taxiMesh);

  // Threshold Piano Keys (InstancedMesh)
  const markMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const markInst = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.4, 22).rotateX(-Math.PI / 2),
    markMat,
    24
  );
  markInst.castShadow = false;
  markInst.receiveShadow = false;
  markInst.frustumCulled = true;
  const markDummy = new THREE.Object3D();
  let markIdx = 0;
  for (const [rx, rz] of [
    [0, 370],
    [0, -2970],
    [-190, 370],
    [-190, -2470],
  ]) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      markDummy.position.set(rx + i * 5.8, 0.065, rz);
      markDummy.updateMatrix();
      markInst.setMatrixAt(markIdx++, markDummy.matrix);
    }
  }
  markInst.instanceMatrix.needsUpdate = true;
  markInst.computeBoundingSphere();
  airportChunk.add(markInst);

  // Concrete Embankment Foundation Pads & Distant Outpost Structures merged cleanly (no castShadow)
  const embankmentMat = new THREE.MeshStandardMaterial({
    color: 0x3f4754,
    roughness: 0.88,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const embankGeos = [
    bakeTransformedGeo(new THREE.BoxGeometry(58, 4.0, 1230), -2900, 143.05, -3400),
    bakeTransformedGeo(new THREE.BoxGeometry(54, 3.0, 950), 2900, 12.55, -1400),
    bakeTransformedGeo(new THREE.BoxGeometry(72, 4.5, 1580), -3200, 337.8, -16500),
    bakeTransformedGeo(new THREE.BoxGeometry(92, 4.5, 1420), -1400, 29.8, 15500),
    // Northern Military Airstrip concrete bunkers & control tower
    bakeTransformedGeo(new THREE.BoxGeometry(28, 10, 42), -3115, 345.0, -16440),
    bakeTransformedGeo(new THREE.BoxGeometry(28, 10, 42), -3115, 345.0, -16330),
    bakeTransformedGeo(new THREE.CylinderGeometry(3.8, 5.2, 34, 10), -3110, 357.0, -16540),
    // Southern Desert Radar Base command buildings, watchtowers & radar pedestals
    bakeTransformedGeo(new THREE.BoxGeometry(36, 11, 52), -1275, 37.5, 15430),
    bakeTransformedGeo(new THREE.BoxGeometry(28, 9, 34), -1275, 36.5, 15520),
    bakeTransformedGeo(new THREE.CylinderGeometry(8, 11, 14, 14), -1220, 39.0, 15360),
    bakeTransformedGeo(new THREE.CylinderGeometry(5, 7, 11, 12), -1210, 37.5, 15590),
    bakeTransformedGeo(new THREE.CylinderGeometry(5, 7, 11, 12), -1515, 37.5, 15520),
  ];
  const mergedEmbankGeo = safeMerge(embankGeos);
  const embankMesh = new THREE.Mesh(mergedEmbankGeo, embankmentMat);
  embankMesh.castShadow = false;
  embankMesh.receiveShadow = true;
  embankMesh.frustumCulled = true;
  airportChunk.add(embankMesh);

  // Desert Geodesic Radome & Early-Warning Radar Dishes (single merged white mesh)
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.42, metalness: 0.18 });
  const radomeGeos = [
    bakeTransformedGeo(new THREE.IcosahedronGeometry(16, 2), -1220, 56, 15360),
    bakeTransformedGeo(new THREE.SphereGeometry(7.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), -1210, 44, 15590, 0.75, 0.4, 0),
    bakeTransformedGeo(new THREE.SphereGeometry(7.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), -1515, 44, 15520, 0.75, -0.5, 0),
    bakeTransformedGeo(new THREE.CylinderGeometry(6.8, 4.2, 4.2, 10), -3110, 375.5, -16540),
  ];
  const mergedRadomeGeo = safeMerge(radomeGeos);
  const radomeMesh = new THREE.Mesh(mergedRadomeGeo, radomeMat);
  radomeMesh.castShadow = false;
  radomeMesh.frustumCulled = true;
  airportChunk.add(radomeMesh);

  helipads.push({ x: -2900, z: -3400, halfW: 48, halfL: 610, y: 145.08 });
  helipads.push({ x: 2900, z: -1400, halfW: 45, halfL: 465, y: 14.08 });
  helipads.push({ x: -3200, z: -16500, halfW: 65, halfL: 780, y: 340.08 });
  helipads.push({ x: -1400, z: 15500, halfW: 110, halfL: 700, y: 32.08 });

  // Emissive Runway Edge & Approach Lights across all 6 Runways (InstancedMesh, no shadows)
  const lightGeo = new THREE.SphereGeometry(0.46, 6, 5);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 2.6,
    roughness: 0.2,
  });
  const lightPositions: THREE.Vector3[] = [];
  for (let z = -2980; z <= 380; z += 75) {
    lightPositions.push(new THREE.Vector3(-27.5, 0.35, z));
    lightPositions.push(new THREE.Vector3(27.5, 0.35, z));
  }
  for (let z = -2480; z <= 380; z += 80) {
    lightPositions.push(new THREE.Vector3(-214.5, 0.35, z));
    lightPositions.push(new THREE.Vector3(-165.5, 0.35, z));
  }
  for (let z = -3980; z <= -2820; z += 75) {
    lightPositions.push(new THREE.Vector3(-2918.5, 145.45, z));
    lightPositions.push(new THREE.Vector3(-2881.5, 145.45, z));
  }
  for (let z = -1840; z <= -960; z += 70) {
    lightPositions.push(new THREE.Vector3(2882.5, 14.45, z));
    lightPositions.push(new THREE.Vector3(2917.5, 14.45, z));
  }
  for (let z = -17250; z <= -15750; z += 85) {
    lightPositions.push(new THREE.Vector3(-3220.5, 340.45, z));
    lightPositions.push(new THREE.Vector3(-3179.5, 340.45, z));
  }
  for (let z = 14830; z <= 16170; z += 85) {
    lightPositions.push(new THREE.Vector3(-1421.5, 32.45, z));
    lightPositions.push(new THREE.Vector3(-1378.5, 32.45, z));
  }
  const runwayLights = new THREE.InstancedMesh(lightGeo, lightMat, lightPositions.length);
  runwayLights.castShadow = false;
  runwayLights.receiveShadow = false;
  runwayLights.frustumCulled = true;
  const dummy = new THREE.Object3D();
  lightPositions.forEach((lp, idx) => {
    dummy.position.copy(lp);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    runwayLights.setMatrixAt(idx, dummy.matrix);
  });
  runwayLights.instanceMatrix.needsUpdate = true;
  runwayLights.computeBoundingSphere();
  airportChunk.add(runwayLights);

  // Glowing Threshold Green Bars + ALS Centerline Approach Lights (Single Batched InstancedMesh)
  const appLightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
  });
  const appCoords: { x: number; y: number; z: number; hex: number; sx: number }[] = [];
  for (let i = -3; i <= 3; i++) {
    appCoords.push({ x: i * 6.5, y: 0.42, z: 398, hex: 0x22c55e, sx: 1.4 });
    appCoords.push({ x: i * 6.5, y: 0.42, z: -2998, hex: 0xef4444, sx: 1.4 });
  }
  for (let k = 1; k <= 8; k++) {
    const az = 420 + k * 42;
    appCoords.push({ x: 0, y: 0.55 + k * 0.08, z: az, hex: k <= 3 ? 0xfbbf24 : 0xf8fafc, sx: 2.8 });
    if (k % 2 === 0) {
      appCoords.push({ x: -8.5, y: 0.55 + k * 0.08, z: az, hex: 0xf8fafc, sx: 1.1 });
      appCoords.push({ x: 8.5, y: 0.55 + k * 0.08, z: az, hex: 0xf8fafc, sx: 1.1 });
    }
  }
  const approachInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.32, 1.1), appLightMat, appCoords.length);
  approachInst.castShadow = false;
  approachInst.receiveShadow = false;
  approachInst.frustumCulled = true;
  const appCol = new THREE.Color();
  const appBaseColors: THREE.Color[] = [];
  appCoords.forEach((ac, idx) => {
    dummy.position.set(ac.x, ac.y, ac.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(ac.sx, 1, 1);
    dummy.updateMatrix();
    approachInst.setMatrixAt(idx, dummy.matrix);
    const baseC = new THREE.Color(ac.hex).multiplyScalar(1.8);
    appBaseColors.push(baseC);
    approachInst.setColorAt(idx, baseC);
  });
  approachInst.instanceMatrix.needsUpdate = true;
  if (approachInst.instanceColor) approachInst.instanceColor.needsUpdate = true;
  approachInst.computeBoundingSphere();
  airportChunk.add(approachInst);

  // 4-Light PAPI Precision Approach Slope Bars (Batched InstancedMesh)
  const papiHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const papiHousingInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.85, 1.4), papiHousingMat, 4);
  papiHousingInst.castShadow = false;
  papiHousingInst.frustumCulled = true;
  const papiLightInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.62, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    4
  );
  papiLightInst.castShadow = false;
  papiLightInst.frustumCulled = true;
  for (let i = 0; i < 4; i++) {
    const px = -35 - i * 4.2;
    const pz = 110;
    dummy.position.set(px, 0.45, pz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    papiHousingInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, 0.85, pz);
    dummy.updateMatrix();
    papiLightInst.setMatrixAt(i, dummy.matrix);
    _papiColor.setHex(i < 2 ? 0xef4444 : 0xf8fafc);
    papiLightInst.setColorAt(i, _papiColor);
  }
  papiHousingInst.instanceMatrix.needsUpdate = true;
  papiHousingInst.computeBoundingSphere();
  papiLightInst.instanceMatrix.needsUpdate = true;
  if (papiLightInst.instanceColor) papiLightInst.instanceColor.needsUpdate = true;
  papiLightInst.computeBoundingSphere();
  airportChunk.add(papiHousingInst, papiLightInst);

  function updatePapiLights(slope: 'high' | 'on' | 'low' | 'off'): void {
    for (let pi = 0; pi < 4; pi++) {
      if (slope === 'high') _papiColor.setHex(0xf8fafc);
      else if (slope === 'low') _papiColor.setHex(0xef4444);
      else _papiColor.setHex(pi < 2 ? 0xf8fafc : 0xef4444);
      papiLightInst.setColorAt(pi, _papiColor);
    }
    if (papiLightInst.instanceColor) papiLightInst.instanceColor.needsUpdate = true;
  }

  // Hangars: Main Hangar casts shadows; remaining 3 hangars are batched into InstancedMeshes with castShadow = false
  const hangarRoofMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.42, metalness: 0.62 });
  const hangarWallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.38 });
  const hangarGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.4,
    roughness: 0.32,
  });
  nightGlowMats.push(hangarGlowMat);

  const hangarCoords: [number, number, number][] = [
    [-265, 0, 85], // Main Hangar (only hangar casting shadows)
    [-265, 0, 225],
    [255, 0, 235],
    [-2800, 145, -3280],
  ];
  const hangarWallGeo = new THREE.BoxGeometry(44, 13, 62);
  const hangarVaultGeo = new THREE.CylinderGeometry(22, 22, 62, 16, 1, false, 0, Math.PI)
    .rotateZ(Math.PI / 2)
    .rotateY(Math.PI / 2);
  hangarVaultGeo.scale(1, 0.55, 1);

  // Main hangar (casts shadows)
  const [mhx, mhy, mhz] = hangarCoords[0];
  const mainHangarWalls = new THREE.Mesh(hangarWallGeo, hangarWallMat);
  mainHangarWalls.position.set(mhx, mhy + 6.5, mhz);
  mainHangarWalls.castShadow = true;
  mainHangarWalls.receiveShadow = true;
  mainHangarWalls.frustumCulled = true;
  const mainHangarVault = new THREE.Mesh(hangarVaultGeo, hangarRoofMat);
  mainHangarVault.position.set(mhx, mhy + 13, mhz);
  mainHangarVault.castShadow = true;
  mainHangarVault.receiveShadow = false;
  mainHangarVault.frustumCulled = true;
  airportChunk.add(mainHangarWalls, mainHangarVault);
  colliders.push({ x: mhx, z: mhz, hw: 22, hd: 31, h: 24 });

  // Other 3 hangars batched in InstancedMeshes (castShadow = false)
  const otherHangars = hangarCoords.slice(1);
  const otherWallsInst = new THREE.InstancedMesh(hangarWallGeo, hangarWallMat, otherHangars.length);
  otherWallsInst.castShadow = false;
  otherWallsInst.receiveShadow = true;
  otherWallsInst.frustumCulled = true;
  const otherRoofsInst = new THREE.InstancedMesh(hangarVaultGeo, hangarRoofMat, otherHangars.length);
  otherRoofsInst.castShadow = false;
  otherRoofsInst.frustumCulled = true;

  otherHangars.forEach(([hx, hy, hz], idx) => {
    dummy.position.set(hx, hy + 6.5, hz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    otherWallsInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(hx, hy + 13, hz);
    dummy.updateMatrix();
    otherRoofsInst.setMatrixAt(idx, dummy.matrix);

    if (hy === 0) {
      colliders.push({ x: hx, z: hz, hw: 22, hd: 31, h: 24 });
    }
  });
  otherWallsInst.instanceMatrix.needsUpdate = true;
  otherWallsInst.computeBoundingSphere();
  otherRoofsInst.instanceMatrix.needsUpdate = true;
  otherRoofsInst.computeBoundingSphere();
  airportChunk.add(otherWallsInst, otherRoofsInst);

  // All 4 Hangar Glow Strips in 1 InstancedMesh
  const hangarGlowInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 9, 44), hangarGlowMat, hangarCoords.length);
  hangarGlowInst.castShadow = false;
  hangarGlowInst.frustumCulled = true;
  hangarCoords.forEach(([hx, hy, hz], idx) => {
    dummy.position.set(hx + (hx > 0 ? -22.1 : 22.1), hy + 4.8, hz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    hangarGlowInst.setMatrixAt(idx, dummy.matrix);
  });
  hangarGlowInst.instanceMatrix.needsUpdate = true;
  hangarGlowInst.computeBoundingSphere();
  airportChunk.add(hangarGlowInst);

  // Modern International Terminal Concourse + ATC Tower (Merged Static Geometry + Instanced Jetbridges, no castShadow)
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.68, metalness: 0.14 });
  const cabGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.3,
    roughness: 0.16,
    metalness: 0.62,
  });
  nightGlowMats.push(cabGlassMat);

  // Merge static concrete parts (Terminal body + ATC Tower shaft + Windsock pole + Bridge concrete piers)
  const concreteGeos = [
    bakeTransformedGeo(new THREE.BoxGeometry(48, 17, 210), 265, 8.5, -15),
    bakeTransformedGeo(new THREE.CylinderGeometry(4.6, 6.0, 44, 12), 215, 22, 140),
    bakeTransformedGeo(new THREE.CylinderGeometry(0.14, 0.18, 9, 8), -44, 4.5, 220),
    bakeTransformedGeo(new THREE.BoxGeometry(22, 14, 44), 1420, 5, -1400),
    bakeTransformedGeo(new THREE.BoxGeometry(22, 14, 44), 1980, 5, -1400),
  ];
  const mergedConcreteGeo = safeMerge(concreteGeos);
  const concreteStaticMesh = new THREE.Mesh(mergedConcreteGeo, concreteMat);
  concreteStaticMesh.castShadow = false;
  concreteStaticMesh.receiveShadow = true;
  concreteStaticMesh.frustumCulled = true;
  airportChunk.add(concreteStaticMesh);

  // Merge terminal glass + ATC tower pod
  const glassGeos = [
    bakeTransformedGeo(new THREE.BoxGeometry(1.4, 11.5, 198), 265 - 24.2, 8.8, -15),
    bakeTransformedGeo(new THREE.CylinderGeometry(9.2, 5.8, 5.2, 12), 215, 46.5, 140),
  ];
  const mergedGlassGeo = safeMerge(glassGeos);
  const glassStaticMesh = new THREE.Mesh(mergedGlassGeo, cabGlassMat);
  glassStaticMesh.castShadow = false;
  glassStaticMesh.frustumCulled = true;
  airportChunk.add(glassStaticMesh);

  // Terminal Roof + Giant Red Suspension Bridge (Iconic Red H-Towers, Raised 32.5m Deck, Catenary & Suspender Cables)
  const terminalRoofMesh = new THREE.Mesh(
    bakeTransformedGeo(new THREE.BoxGeometry(62, 1.8, 224), 260, 17.6, -15),
    hangarRoofMat
  );
  terminalRoofMesh.castShadow = false;
  terminalRoofMesh.frustumCulled = true;
  airportChunk.add(terminalRoofMesh);

  const bridgeRedMat = new THREE.MeshStandardMaterial({ color: 0xc8232c, roughness: 0.42, metalness: 0.45 });
  const bridgeCableMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ec, roughness: 0.32, metalness: 0.72 });
  const bridgeRoadMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    normalMap: textures.asphaltNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.78,
    metalness: 0.08,
  });

  const bridgeRedGeos: THREE.BufferGeometry[] = [
    // Side safety truss girders along full 1140m raised span (y=32.5m so aircraft can fly underneath!)
    bakeTransformedGeo(new THREE.BoxGeometry(1140, 2.6, 1.4), 1700, 32.2, -1400 - 13.0),
    bakeTransformedGeo(new THREE.BoxGeometry(1140, 2.6, 1.4), 1700, 32.2, -1400 + 13.0),
  ];
  const bridgeCableGeos: THREE.BufferGeometry[] = [];
  const bridgeTowerXs = [1420, 1980];
  for (const tx of bridgeTowerXs) {
    // Twin vertical red steel tower legs + 3 cross struts reaching y = 134m
    bridgeRedGeos.push(bakeTransformedGeo(new THREE.BoxGeometry(6.8, 126, 5.2), tx, 71, -1400 - 13.8));
    bridgeRedGeos.push(bakeTransformedGeo(new THREE.BoxGeometry(6.8, 126, 5.2), tx, 71, -1400 + 13.8));
    bridgeRedGeos.push(bakeTransformedGeo(new THREE.BoxGeometry(5.6, 4.8, 28.0), tx, 24, -1400));
    bridgeRedGeos.push(bakeTransformedGeo(new THREE.BoxGeometry(5.2, 5.2, 28.0), tx, 74, -1400));
    bridgeRedGeos.push(bakeTransformedGeo(new THREE.BoxGeometry(5.2, 6.2, 28.0), tx, 124, -1400));
    colliders.push({ x: tx, z: -1400, hw: 5.5, hd: 16.5, h: 134 });
  }

  // Parabolic main suspension cables across central span (1420..1980) & side spans (1140..1420, 1980..2260)
  const bridgeCableY = (x: number): number => {
    if (x >= 1420 && x <= 1980) {
      const u = (x - 1700) / 280;
      return 39 + u * u * 93;
    }
    const towerX = x < 1420 ? 1420 : 1980;
    const anchorX = x < 1420 ? 1140 : 2260;
    const u = Math.min(1, Math.abs(x - towerX) / Math.abs(anchorX - towerX));
    return 132 - Math.pow(u, 0.82) * 97;
  };
  const segCount = 28;
  const xMinBr = 1140;
  const xMaxBr = 2260;
  const dxBr = (xMaxBr - xMinBr) / segCount;
  for (let i = 0; i < segCount; i++) {
    const x0 = xMinBr + i * dxBr;
    const x1 = x0 + dxBr;
    const y0 = bridgeCableY(x0);
    const y1 = bridgeCableY(x1);
    const xm = (x0 + x1) * 0.5;
    const ym = (y0 + y1) * 0.5;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (const sideZ of [-13.8, 13.8]) {
      bridgeCableGeos.push(
        bakeTransformedGeo(new THREE.CylinderGeometry(0.65, 0.65, len + 0.6, 6), xm, ym, -1400 + sideZ, 0, 0, ang - Math.PI / 2)
      );
    }
  }
  const mergedBridgeRed = safeMerge(bridgeRedGeos);
  const bridgeRedMesh = new THREE.Mesh(mergedBridgeRed, bridgeRedMat);
  bridgeRedMesh.castShadow = false;
  bridgeRedMesh.receiveShadow = true;
  bridgeRedMesh.frustumCulled = true;

  const mergedBridgeCable = safeMerge(bridgeCableGeos);
  const bridgeCableMesh = new THREE.Mesh(mergedBridgeCable, bridgeCableMat);
  bridgeCableMesh.castShadow = false;
  bridgeCableMesh.frustumCulled = true;

  const bridgeDeckMesh = new THREE.Mesh(new THREE.BoxGeometry(1140, 2.2, 26), bridgeRoadMat);
  bridgeDeckMesh.position.set(1700, 31.5, -1400);
  bridgeDeckMesh.castShadow = false;
  bridgeDeckMesh.receiveShadow = true;
  bridgeDeckMesh.frustumCulled = true;

  // Instanced vertical suspender cables & deck streetlights + red tower aviation beacons
  const suspenderCount = 26 * 2;
  const suspenderInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 5), bridgeCableMat, suspenderCount);
  suspenderInst.castShadow = false;
  suspenderInst.frustumCulled = true;
  let sIdx = 0;
  for (let i = 1; i <= 26; i++) {
    const sx = 1158 + i * 40;
    const cy = bridgeCableY(sx);
    const h = Math.max(1.5, cy - 32.5);
    for (const sideZ of [-13.5, 13.5]) {
      dummy.position.set(sx, 32.5 + h * 0.5, -1400 + sideZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      suspenderInst.setMatrixAt(sIdx++, dummy.matrix);
    }
  }
  suspenderInst.instanceMatrix.needsUpdate = true;
  suspenderInst.computeBoundingSphere();

  const bridgeLampMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });
  nightGlowMats.push(bridgeLampMat);
  const bridgeLampInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 6, 5), bridgeLampMat, 36);
  bridgeLampInst.castShadow = false;
  bridgeLampInst.frustumCulled = true;
  let blIdx = 0;
  for (let i = 0; i < 18; i++) {
    const lx = 1180 + i * 60;
    for (const sideZ of [-11.5, 11.5]) {
      dummy.position.set(lx, 36.2, -1400 + sideZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bridgeLampInst.setMatrixAt(blIdx++, dummy.matrix);
    }
  }
  bridgeLampInst.instanceMatrix.needsUpdate = true;
  bridgeLampInst.computeBoundingSphere();

  const bridgeBeaconInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.3, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    4
  );
  bridgeBeaconInst.castShadow = false;
  bridgeBeaconInst.frustumCulled = true;
  let bbIdx = 0;
  for (const tx of bridgeTowerXs) {
    for (const sideZ of [-13.8, 13.8]) {
      dummy.position.set(tx, 135.5, -1400 + sideZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bridgeBeaconInst.setMatrixAt(bbIdx++, dummy.matrix);
    }
  }
  bridgeBeaconInst.instanceMatrix.needsUpdate = true;
  bridgeBeaconInst.computeBoundingSphere();

  airportChunk.add(bridgeRedMesh, bridgeCableMesh, bridgeDeckMesh, suspenderInst, bridgeLampInst, bridgeBeaconInst);
  helipads.push({ x: 1700, z: -1400, halfW: 565, halfL: 13, y: 32.6 });

  // 5 Passenger Boarding Jetbridges + Cabs (InstancedMesh)
  const bridgeInst = new THREE.InstancedMesh(new THREE.BoxGeometry(22, 3.2, 3.6), hangarRoofMat, 5);
  bridgeInst.castShadow = false;
  bridgeInst.frustumCulled = true;
  const cabInst = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 4.0, 4.6), hangarWallMat, 5);
  cabInst.castShadow = false;
  cabInst.frustumCulled = true;
  for (let i = 0; i < 5; i++) {
    const jz = -15 + (i - 2) * 38;
    dummy.position.set(265 - 34, 6.2, jz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    bridgeInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(265 - 45, 6.0, jz);
    dummy.updateMatrix();
    cabInst.setMatrixAt(i, dummy.matrix);
  }
  bridgeInst.instanceMatrix.needsUpdate = true;
  bridgeInst.computeBoundingSphere();
  cabInst.instanceMatrix.needsUpdate = true;
  cabInst.computeBoundingSphere();
  airportChunk.add(bridgeInst, cabInst);

  colliders.push({ x: 265, z: -15, hw: 26, hd: 108, h: 19 });
  colliders.push({ x: 215, z: 140, hw: 9, hd: 9, h: 52 });

  // ATC Tower Roof Cap & Rotating Radar Bar
  const towerRoofCap = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 9.6, 2.0, 12), hangarWallMat);
  towerRoofCap.position.set(215, 50.0, 140);
  towerRoofCap.castShadow = false;
  towerRoofCap.frustumCulled = true;
  airportChunk.add(towerRoofCap);

  const radarDish = new THREE.Group();
  radarDish.position.set(215, 52.4, 140);
  const radarBar = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.3 })
  );
  radarBar.castShadow = false;
  radarBar.frustumCulled = true;
  radarDish.add(radarBar);
  airportChunk.add(radarDish);

  // Airport Service Vehicles & Parked Static Apron Props (InstancedMesh batches, no castShadow)
  const truckMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.3 });
  const truckInst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 2.2, 5.8), truckMat, 10);
  truckInst.castShadow = false;
  truckInst.frustumCulled = true;
  for (let i = 0; i < 10; i++) {
    dummy.position.set(i < 5 ? 185 : -148, 1.1, -90 + (i % 5) * 68);
    dummy.rotation.set(0, (i % 3) * 0.4, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    truckInst.setMatrixAt(i, dummy.matrix);
  }
  truckInst.instanceMatrix.needsUpdate = true;
  truckInst.computeBoundingSphere();
  airportChunk.add(truckInst);

  const staticPropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.25 });
  const staticPropCoords: [number, number, number, number, number, number, number][] = [
    [182, 0.9, 60, 2.2, 1.8, 3.6, 0x38bdf8],
    [186, 0.9, 66, 2.2, 1.8, 3.6, 0x38bdf8],
    [182, 0.9, 130, 2.4, 1.8, 4.0, 0x94a3b8],
    [187, 0.9, 138, 2.4, 1.8, 4.0, 0x94a3b8],
    [-218, 0.9, 85, 3.2, 2.0, 3.2, 0xeab308],
    [-218, 0.9, 95, 3.2, 2.0, 3.2, 0xeab308],
    [-218, 0.9, 215, 3.2, 2.0, 3.2, 0xeab308],
    [-218, 0.9, 225, 3.2, 2.0, 3.2, 0xeab308],
    [206, 0.9, 220, 3.0, 2.0, 4.2, 0x64748b],
    [206, 0.9, 232, 3.0, 2.0, 4.2, 0x64748b],
    [-145, 0.9, -20, 2.2, 1.8, 3.4, 0x475569],
    [-145, 0.9, 45, 2.2, 1.8, 3.4, 0x475569],
  ];
  const staticPropInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), staticPropMat, staticPropCoords.length);
  staticPropInst.castShadow = false;
  staticPropInst.frustumCulled = true;
  const propCol = new THREE.Color();
  staticPropCoords.forEach(([px, py, pz, sx, sy, sz, hex], idx) => {
    dummy.position.set(px, py, pz);
    dummy.rotation.set(0, (idx % 4) * 0.25, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    staticPropInst.setMatrixAt(idx, dummy.matrix);
    propCol.setHex(hex);
    staticPropInst.setColorAt(idx, propCol);
  });
  staticPropInst.instanceMatrix.needsUpdate = true;
  if (staticPropInst.instanceColor) staticPropInst.instanceColor.needsUpdate = true;
  staticPropInst.computeBoundingSphere();
  airportChunk.add(staticPropInst);

  // Windsock near Main Runway 36L Threshold
  const windsock = new THREE.Group();
  windsock.position.set(-44, 8.8, 220);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 3.4, 10, 1, true).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide, roughness: 0.7 })
  );
  sock.position.x = 1.7;
  sock.castShadow = false;
  sock.frustumCulled = true;
  windsock.add(sock);
  airportChunk.add(windsock);

  // 5. Moving Full-Scale Supercarrier Strike Group (330m x 75m, night deck guidance lights, wake & escorts)
  const carrierGroup = new THREE.Group();
  carrierGroup.position.set(1850, 0, 200);
  carrierChunk.add(carrierGroup);

  const wakeUniforms = {
    uTime: { value: 0 },
  };
  const shipWakeMat = new THREE.ShaderMaterial({
    uniforms: wakeUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float along = 1.0 - vUv.y;
        float across = abs(vUv.x - 0.5) * 2.0;
        float vEdge = smoothstep(0.0, 0.14, across) * exp(-pow((across - along * 0.55) * 4.5, 2.0));
        float centerFoam = exp(-across * across * 9.0) * 0.65;
        float ripple = 0.72 + 0.28 * sin(along * 26.0 - uTime * 3.8);
        float fadeTail = (1.0 - smoothstep(0.15, 1.0, along)) * smoothstep(0.0, 0.08, along);
        float alpha = clamp((vEdge * 0.75 + centerFoam) * ripple * fadeTail, 0.0, 0.78);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(vec3(0.90, 0.96, 1.0), alpha);
      }
    `,
  });
  const carrierWakeMat = new THREE.ShaderMaterial({
    uniforms: wakeUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float along = 1.0 - vUv.y;
        float across = abs(vUv.x - 0.5) * 2.0;
        float vEdge = exp(-pow((across - (0.18 + along * 0.52)) * 4.8, 2.0));
        float centerFoam = exp(-across * across * 7.5) * 0.58;
        float ripple = 0.74 + 0.26 * sin(along * 32.0 - uTime * 4.2);
        float fadeTail = (1.0 - smoothstep(0.12, 1.0, along)) * smoothstep(0.0, 0.06, along);
        float alpha = clamp((vEdge * 0.8 + centerFoam) * ripple * fadeTail, 0.0, 0.82);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(vec3(0.90, 0.96, 1.0), alpha);
      }
    `,
  });

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.65, metalness: 0.42 });
  const deckMat = new THREE.MeshStandardMaterial({ map: textures.carrierDeck, roughness: 0.78, metalness: 0.12 });
  const carrierGeosHull = [
    // Main armored lower hull (48m beam x 17.6m draft-to-hangar x 316m length)
    bakeTransformedGeo(new THREE.BoxGeometry(48, 17.6, 316), 0, 8.8, 0),
    // Flared port & starboard flight-deck sponsons
    bakeTransformedGeo(new THREE.BoxGeometry(16, 4.4, 240), -29.5, 15.6, 18),
    bakeTransformedGeo(new THREE.BoxGeometry(15, 4.4, 260), 29.0, 15.6, 6),
    // Multi-tier starboard control island superstructure & radar mast
    bakeTransformedGeo(new THREE.BoxGeometry(11.5, 22, 42), 28.5, 29.5, -14),
    bakeTransformedGeo(new THREE.BoxGeometry(8.2, 9.5, 16), 28.5, 43.0, -18),
    bakeTransformedGeo(new THREE.CylinderGeometry(0.65, 1.4, 15, 8), 28.5, 52.0, -16),
    // Jet Blast Deflectors (forward catapult stations)
    bakeTransformedGeo(new THREE.BoxGeometry(9.5, 2.2, 0.8), -8, 19.3, -46, -0.45, 0, 0),
    bakeTransformedGeo(new THREE.BoxGeometry(9.5, 2.2, 0.8), 9, 19.3, -42, -0.45, 0, 0),
  ];
  const mergedCarrierHull = safeMerge(carrierGeosHull);
  const carrierHullMesh = new THREE.Mesh(mergedCarrierHull, hullMat);
  carrierHullMesh.castShadow = false;
  carrierHullMesh.receiveShadow = true;
  carrierHullMesh.frustumCulled = true;

  // Full 330m x 75m Flight Deck (top surface at y = 18.5)
  const flightDeck = new THREE.Mesh(new THREE.BoxGeometry(75, 1.4, 330), deckMat);
  flightDeck.position.set(0, 17.8, 0);
  flightDeck.castShadow = false;
  flightDeck.receiveShadow = true;
  flightDeck.frustumCulled = true;

  // Angled Landing Deck Overlay (-9 deg canted port-forward) + Foul Lines & Centerline
  const angledStripMat = new THREE.MeshStandardMaterial({
    map: textures.runway,
    roughness: 0.78,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const angledDeckStrip = new THREE.Mesh(new THREE.PlaneGeometry(34, 245), angledStripMat);
  angledDeckStrip.rotation.set(-Math.PI / 2, 0, 0.145);
  angledDeckStrip.position.set(-6.5, 18.53, 36);
  angledDeckStrip.castShadow = false;
  angledDeckStrip.receiveShadow = true;
  angledDeckStrip.frustumCulled = true;

  const islandBridge = new THREE.Mesh(new THREE.BoxGeometry(12.2, 3.8, 18), cabGlassMat);
  islandBridge.position.set(28.5, 36.5, -12);
  islandBridge.castShadow = false;
  islandBridge.frustumCulled = true;

  // Carrier stern white water wake
  const carrierWakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(110, 320).rotateX(-Math.PI / 2), carrierWakeMat);
  carrierWakeMesh.position.set(0, 0.18, 300);
  carrierWakeMesh.frustumCulled = true;
  carrierGroup.add(carrierHullMesh, flightDeck, angledDeckStrip, islandBridge, carrierWakeMesh);

  // 4 Steel Arrestor Wires + 8 Deck Anchors near the stern (y = 18.64)
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.22 });
  const wireAnchorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
  const localWireZ = [84, 98, 112, 126];
  const cableInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.14, 0.14, 42, 8).rotateZ(Math.PI / 2),
    wireMat,
    localWireZ.length
  );
  cableInst.castShadow = false;
  cableInst.frustumCulled = true;
  const anchorInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.4, 1.4), wireAnchorMat, localWireZ.length * 2);
  anchorInst.castShadow = false;
  anchorInst.frustumCulled = true;
  localWireZ.forEach((wz, wi) => {
    const wireCenterX = -4.5;
    dummy.position.set(wireCenterX, 18.64, wz);
    dummy.rotation.set(0, 0.145, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    cableInst.setMatrixAt(wi, dummy.matrix);
    [-21.5, 21.5].forEach((ax, ai) => {
      const cosA = Math.cos(0.145);
      const sinA = Math.sin(0.145);
      dummy.position.set(wireCenterX + ax * cosA, 18.62, wz - ax * sinA);
      dummy.updateMatrix();
      anchorInst.setMatrixAt(wi * 2 + ai, dummy.matrix);
    });
  });
  cableInst.instanceMatrix.needsUpdate = true;
  cableInst.computeBoundingSphere();
  anchorInst.instanceMatrix.needsUpdate = true;
  anchorInst.computeBoundingSphere();
  carrierGroup.add(cableInst, anchorInst);

  // Night Carrier Deck Guidance Lights (deck perimeter, angled centerline & stern approach bars + island mast beacon)
  const carrierLightCoords: { x: number; y: number; z: number; hex: number; sx: number }[] = [];
  for (let lz = -148; lz <= 148; lz += 24) {
    carrierLightCoords.push({ x: -36.5, y: 18.7, z: lz, hex: 0xfef08a, sx: 1.0 });
    carrierLightCoords.push({ x: 36.5, y: 18.7, z: lz, hex: 0xfef08a, sx: 1.0 });
  }
  for (let k = 0; k < 10; k++) {
    const lz = 145 - k * 24;
    const lx = -6.5 - (lz - 36) * Math.sin(0.145);
    carrierLightCoords.push({ x: lx, y: 18.68, z: lz, hex: k < 2 ? 0x22c55e : 0x38bdf8, sx: 1.5 });
  }
  carrierLightCoords.push({ x: -16, y: 18.7, z: 162, hex: 0xef4444, sx: 2.2 });
  carrierLightCoords.push({ x: 4, y: 18.7, z: 162, hex: 0xef4444, sx: 2.2 });
  carrierLightCoords.push({ x: 28.5, y: 60.0, z: -16, hex: 0xef4444, sx: 1.4 });
  const carrierLightsInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.9, 0.35, 1.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    carrierLightCoords.length
  );
  carrierLightsInst.castShadow = false;
  carrierLightsInst.frustumCulled = true;
  const clCol = new THREE.Color();
  carrierLightCoords.forEach((lc, idx) => {
    dummy.position.set(lc.x, lc.y, lc.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(lc.sx, 1, 1);
    dummy.updateMatrix();
    carrierLightsInst.setMatrixAt(idx, dummy.matrix);
    clCol.setHex(lc.hex).multiplyScalar(1.65);
    carrierLightsInst.setColorAt(idx, clCol);
  });
  carrierLightsInst.instanceMatrix.needsUpdate = true;
  if (carrierLightsInst.instanceColor) carrierLightsInst.instanceColor.needsUpdate = true;
  carrierLightsInst.computeBoundingSphere();
  carrierGroup.add(carrierLightsInst);

  // Port-side Optical Landing System (Fresnel Ball)
  const olsPole = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.6, 1.4), hangarWallMat);
  olsPole.position.set(-34.5, 20.3, 68);
  olsPole.castShadow = false;
  olsPole.frustumCulled = true;
  const olsDatum = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 0.35), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  olsDatum.position.set(-34.5, 20.5, 68.75);
  olsDatum.frustumCulled = true;
  const olsBall = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  olsBall.position.set(-34.5, 20.5, 68.95);
  olsBall.frustumCulled = true;
  carrierGroup.add(olsPole, olsDatum, olsBall);

  const carrierHelipad: HelipadDeck = { x: 1850, z: 200, halfW: 37.5, halfL: 165, y: 18.5 };
  helipads.push(carrierHelipad);
  const carrierIslandCollider: BuildingCollider = { x: 1878.5, z: 186, hw: 5.8, hd: 21.0, h: 46 };
  colliders.push(carrierIslandCollider);
  const carrierMeta = {
    x: 1850,
    z: 200,
    dz: 0,
    halfW: 37.5,
    halfL: 165,
    deckY: 18.5,
    wireZ: localWireZ.map((wz) => 200 + wz),
  };

  // 2 Escort Guided-Missile Destroyers batched into InstancedMeshes inside moving carrierGroup
  const escortCoords: [number, number][] = [
    [-240, -220],
    [260, -240],
  ];
  const dHullInst = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 7.5, 108), hullMat, escortCoords.length);
  const dSuperInst = new THREE.InstancedMesh(new THREE.BoxGeometry(10.5, 8.5, 36), concreteMat, escortCoords.length);
  const dMastInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 1.2, 11, 8), hullMat, escortCoords.length);
  const dWakeInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(36, 150).rotateX(-Math.PI / 2), shipWakeMat, escortCoords.length);
  dHullInst.castShadow = false;
  dSuperInst.castShadow = false;
  dMastInst.castShadow = false;
  dWakeInst.castShadow = false;
  dHullInst.frustumCulled = true;
  dSuperInst.frustumCulled = true;
  dMastInst.frustumCulled = true;
  dWakeInst.frustumCulled = true;
  escortCoords.forEach(([dx, dz], idx) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(dx, 3.5, dz);
    dummy.updateMatrix();
    dHullInst.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(dx, 10.5, dz - 6);
    dummy.updateMatrix();
    dSuperInst.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(dx, 19.5, dz - 10);
    dummy.updateMatrix();
    dMastInst.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(dx, 0.16, dz + 122);
    dummy.updateMatrix();
    dWakeInst.setMatrixAt(idx, dummy.matrix);
  });
  dHullInst.instanceMatrix.needsUpdate = true;
  dSuperInst.instanceMatrix.needsUpdate = true;
  dMastInst.instanceMatrix.needsUpdate = true;
  dWakeInst.instanceMatrix.needsUpdate = true;
  dHullInst.computeBoundingSphere();
  dSuperInst.computeBoundingSphere();
  dMastInst.computeBoundingSphere();
  dWakeInst.computeBoundingSphere();
  carrierGroup.add(dHullInst, dSuperInst, dMastInst, dWakeInst);

  // 6. Sleek Coastal City Skyline (100% InstancedMesh: Buildings incl. Hero Tower + Rooftops + Beacons, castShadow = false)
  const cityPositions: { x: number; z: number; w: number; d: number; h: number; hue: number }[] = [];
  for (let i = 0; i < 72; i++) {
    const col = i % 8;
    const row = Math.floor(i / 8);
    let bx = 590 + col * 64 + (hash2(i, 1) - 0.5) * 18;
    let bz = -980 + row * 125 + (hash2(i, 2) - 0.5) * 26;
    const bw = 24 + hash2(i, 3) * 22;
    const bd = 24 + hash2(i, 4) * 22;
    const bh = 38 + Math.pow(hash2(i, 5), 1.35) * 185;
    if (Math.abs(bx - 820) < 46 + bw * 0.5 && Math.abs(bz + 240) < 46 + bd * 0.5) {
      bx += bx < 820 ? -62 : 62;
    }
    cityPositions.push({ x: bx, z: bz, w: bw, d: bd, h: bh, hue: i });
  }
  // Include Hero Rooftop Tower directly in cityMesh InstancedMesh
  cityPositions.push({ x: 820, z: -240, w: 46, d: 46, h: 145, hue: 99 });

  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const bMat = new THREE.MeshStandardMaterial({
    map: textures.buildingFacade,
    roughnessMap: textures.buildingRoughness,
    roughness: 1.0,
    metalness: 0.72,
    envMapIntensity: 1.48,
    emissiveMap: textures.buildingEmissive,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.14,
  });
  nightGlowMats.push(bMat);
  const cityMesh = new THREE.InstancedMesh(bGeo, bMat, cityPositions.length);
  cityMesh.castShadow = false;
  cityMesh.receiveShadow = true;
  cityMesh.frustumCulled = true;

  const roofCapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.65 });
  const roofCapInst = new THREE.InstancedMesh(bGeo, roofCapMat, cityPositions.length - 1);
  roofCapInst.castShadow = false;
  roofCapInst.frustumCulled = true;

  const tallCount = cityPositions.filter((c, i) => i < cityPositions.length - 1 && c.h > 125).length;
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
  const beaconInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 6, 5), beaconMat, Math.max(1, tallCount));
  beaconInst.castShadow = false;
  beaconInst.frustumCulled = true;

  const bCol = new THREE.Color();
  let beaconIdx = 0;
  cityPositions.forEach((bp, i) => {
    const isHero = i === cityPositions.length - 1;
    dummy.position.set(bp.x, bp.h * 0.5, bp.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(bp.w, bp.h, bp.d);
    dummy.updateMatrix();
    cityMesh.setMatrixAt(i, dummy.matrix);
    if (isHero) {
      bCol.setHex(0xffffff);
      colliders.push({ x: 820, z: -240, hw: 23, hd: 23, h: 144.5 });
    } else {
      bCol.setHSL(0.59 + hash2(bp.hue, 6) * 0.04, 0.14, 0.48 + hash2(bp.hue, 7) * 0.2);
      dummy.position.set(bp.x, bp.h + 1.6, bp.z);
      dummy.scale.set(bp.w * 0.62, 3.2, bp.d * 0.62);
      dummy.updateMatrix();
      roofCapInst.setMatrixAt(i, dummy.matrix);

      if (bp.h > 125 && beaconIdx < tallCount) {
        dummy.position.set(bp.x, bp.h + 4.0, bp.z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        beaconInst.setMatrixAt(beaconIdx++, dummy.matrix);
      }
      colliders.push({ x: bp.x, z: bp.z, hw: bp.w * 0.5, hd: bp.d * 0.5, h: bp.h });
    }
    cityMesh.setColorAt(i, bCol);
  });
  cityMesh.instanceMatrix.needsUpdate = true;
  if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true;
  cityMesh.computeBoundingSphere();
  roofCapInst.instanceMatrix.needsUpdate = true;
  roofCapInst.computeBoundingSphere();
  beaconInst.instanceMatrix.needsUpdate = true;
  beaconInst.computeBoundingSphere();
  cityChunk.add(cityMesh, roofCapInst, beaconInst);

  const hPad = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72 })
  );
  hPad.position.set(820, 145.6, -240);
  hPad.castShadow = false;
  hPad.receiveShadow = true;
  hPad.frustumCulled = true;
  cityChunk.add(hPad);
  helipads.push({ x: 820, z: -240, halfW: 16, halfL: 16, y: 146.2 });

  // 7. Instanced Forest Trees (no castShadow, frustumCulled = true)
  const treePositions: { x: number; y: number; z: number; s: number; h: number }[] = [];
  for (let i = 0; i < 2400 && treePositions.length < 880; i++) {
    const tx = (hash2(i * 1.7, 9.2) - 0.5) * 12400;
    const tz = (hash2(i * 2.3, 4.1) - 0.5) * 12400 - 1500;
    if (tx > -380 && tx < 420 && tz > -3300 && tz < 620) continue;
    if (tx > 500 && tx < 1180 && tz > -1150 && tz < 560) continue;
    if (Math.abs(tx + 2900) < 95 && Math.abs(tz + 3400) < 680) continue;
    if (Math.abs(tx - 2900) < 90 && Math.abs(tz + 1400) < 520) continue;
    const ty = groundHeightAt(tx, tz);
    if (ty < 2.2 || ty > 235) continue;
    treePositions.push({
      x: tx,
      y: ty,
      z: tz,
      s: 0.85 + hash2(i, 11) * 0.85,
      h: hash2(i, 17),
    });
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.45, 0.78, 4.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3228, roughness: 0.92 }),
    treePositions.length
  );
  trunkMesh.castShadow = false;
  trunkMesh.receiveShadow = false;
  trunkMesh.frustumCulled = true;
  const foliageMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(4.4, 14, 6),
    new THREE.MeshStandardMaterial({ color: 0x1e4d2b, roughness: 0.88 }),
    treePositions.length
  );
  foliageMesh.castShadow = false;
  foliageMesh.receiveShadow = false;
  foliageMesh.frustumCulled = true;
  const tCol = new THREE.Color();
  treePositions.forEach((tp, idx) => {
    dummy.position.set(tp.x, tp.y + 2.3 * tp.s, tp.z);
    dummy.rotation.set(0, tp.h * Math.PI * 2, 0);
    dummy.scale.setScalar(tp.s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tp.x, tp.y + 9.6 * tp.s, tp.z);
    dummy.updateMatrix();
    foliageMesh.setMatrixAt(idx, dummy.matrix);
    tCol.setHSL(0.32 + (tp.h - 0.5) * 0.05, 0.45, 0.22 + tp.h * 0.12);
    foliageMesh.setColorAt(idx, tCol);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  foliageMesh.instanceMatrix.needsUpdate = true;
  if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
  trunkMesh.computeBoundingSphere();
  foliageMesh.computeBoundingSphere();
  natureChunk.add(trunkMesh, foliageMesh);

  // 7b. Instanced Coastal & Mountain Boulders / Rocks (single InstancedMesh draw call, castShadow = false)
  const rockPositions: { x: number; y: number; z: number; sx: number; sy: number; sz: number; h: number; desert: boolean }[] = [];
  for (let i = 0; i < 1600 && rockPositions.length < 400; i++) {
    const rx = (hash2(i * 2.1, 13.7) - 0.5) * 14500;
    const rz = (hash2(i * 1.9, 27.3) - 0.5) * 14500 - 1500;
    if (rx > -380 && rx < 420 && rz > -3300 && rz < 620) continue;
    if (rx > 500 && rx < 1180 && rz > -1150 && rz < 560) continue;
    if (Math.abs(rx + 2900) < 120 && Math.abs(rz + 3400) < 700) continue;
    if (Math.abs(rx - 2900) < 110 && Math.abs(rz + 1400) < 540) continue;
    const ry = groundHeightAt(rx, rz);
    if (ry < 0.3 || ry > 420) continue;
    const baseS = 2.6 + Math.pow(hash2(i, 41), 1.6) * 8.5;
    rockPositions.push({
      x: rx,
      y: ry,
      z: rz,
      sx: baseS * (0.85 + hash2(i, 43) * 0.65),
      sy: baseS * (0.55 + hash2(i, 47) * 0.55),
      sz: baseS * (0.85 + hash2(i, 53) * 0.65),
      h: hash2(i, 59),
      desert: rz > 4200,
    });
  }
  const boulderInst = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.04 }),
    Math.max(1, rockPositions.length)
  );
  boulderInst.castShadow = false;
  boulderInst.receiveShadow = true;
  boulderInst.frustumCulled = true;
  rockPositions.forEach((rp, idx) => {
    dummy.position.set(rp.x, rp.y + rp.sy * 0.35, rp.z);
    dummy.rotation.set(rp.h * 2.1, rp.h * Math.PI * 2, rp.h * 1.3);
    dummy.scale.set(rp.sx, rp.sy, rp.sz);
    dummy.updateMatrix();
    boulderInst.setMatrixAt(idx, dummy.matrix);
    if (rp.desert) tCol.setHSL(0.08, 0.28, 0.42 + rp.h * 0.14);
    else if (rp.y < 5.5) tCol.setHSL(0.10, 0.14, 0.36 + rp.h * 0.16);
    else tCol.setHSL(0.60, 0.08, 0.28 + rp.h * 0.18);
    boulderInst.setColorAt(idx, tCol);
  });
  boulderInst.instanceMatrix.needsUpdate = true;
  if (boulderInst.instanceColor) boulderInst.instanceColor.needsUpdate = true;
  boulderInst.computeBoundingSphere();
  natureChunk.add(boulderInst);

  // 8. Offshore & Mountain Ridge Wind Turbines (2 InstancedMeshes total: 8 Masts + 24 Animated Blades)
  const turbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.34, metalness: 0.25 });
  const turbCoords: [number, number, number][] = [
    [-580, Math.max(0, groundHeightAt(-580, -320)), -320],
    [-610, Math.max(0, groundHeightAt(-610, -680)), -680],
    [-640, Math.max(0, groundHeightAt(-640, -1040)), -1040],
    [-670, Math.max(0, groundHeightAt(-670, -1400)), -1400],
    [1460, Math.max(0, groundHeightAt(1460, -450)), -450],
    [1490, Math.max(0, groundHeightAt(1490, -780)), -780],
    [1520, Math.max(0, groundHeightAt(1520, -1100)), -1100],
    [1550, Math.max(0, groundHeightAt(1550, -1450)), -1450],
  ];
  const turbineMastInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 1.85, 62, 10), turbMat, turbCoords.length);
  turbineMastInst.castShadow = false;
  turbineMastInst.frustumCulled = true;
  const bladeGeo = new THREE.BoxGeometry(1.15, 26, 0.38).translate(0, 13, 0);
  const turbineBladeInst = new THREE.InstancedMesh(bladeGeo, turbMat, turbCoords.length * 3);
  turbineBladeInst.castShadow = false;
  turbineBladeInst.frustumCulled = true;

  let turbineAngle = 0;
  turbCoords.forEach(([wx, wy, wz], ti) => {
    dummy.position.set(wx, wy + 31, wz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    turbineMastInst.setMatrixAt(ti, dummy.matrix);

    for (let b = 0; b < 3; b++) {
      dummy.position.set(wx, wy + 62, wz + 1.5);
      dummy.rotation.set(0, 0, (b * Math.PI * 2) / 3);
      dummy.updateMatrix();
      turbineBladeInst.setMatrixAt(ti * 3 + b, dummy.matrix);
    }
  });
  turbineMastInst.instanceMatrix.needsUpdate = true;
  turbineMastInst.computeBoundingSphere();
  turbineBladeInst.instanceMatrix.needsUpdate = true;
  turbineBladeInst.computeBoundingSphere();
  natureChunk.add(turbineMastInst, turbineBladeInst);

  // 8b. Coastal Lighthouses with Rotating Volumetric Light Beams (3 scenic coastal headlands)
  const lhCoords: [number, number, number][] = [
    [1190, Math.max(1.5, groundHeightAt(1190, 490)), 490],
    [1205, Math.max(1.5, groundHeightAt(1205, -1820)), -1820],
    [2340, Math.max(2.0, groundHeightAt(2340, -1040)), -1040],
  ];
  const lhWhiteInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.6, 4.0, 28, 12), concreteMat, lhCoords.length);
  const lhRedInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.9, 3.4, 8, 12), bridgeRedMat, lhCoords.length);
  const lhLanternInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, toneMapped: false }),
    lhCoords.length
  );
  lhWhiteInst.castShadow = false;
  lhRedInst.castShadow = false;
  lhLanternInst.castShadow = false;
  lhWhiteInst.frustumCulled = true;
  lhRedInst.frustumCulled = true;
  lhLanternInst.frustumCulled = true;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamConeGeo = new THREE.ConeGeometry(22, 320, 14, 1, true);
  beamConeGeo.translate(0, -160, 0);
  beamConeGeo.rotateX(-Math.PI / 2);
  const lighthouseBeams: THREE.Group[] = [];

  lhCoords.forEach(([lx, ly, lz], idx) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(lx, ly + 14, lz);
    dummy.updateMatrix();
    lhWhiteInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(lx, ly + 17, lz);
    dummy.updateMatrix();
    lhRedInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(lx, ly + 29.5, lz);
    dummy.updateMatrix();
    lhLanternInst.setMatrixAt(idx, dummy.matrix);

    const beamPivot = new THREE.Group();
    beamPivot.position.set(lx, ly + 29.5, lz);
    beamPivot.rotation.y = idx * 2.1;
    const beamFwd = new THREE.Mesh(beamConeGeo, beamMat);
    const beamBack = new THREE.Mesh(beamConeGeo, beamMat);
    beamBack.rotation.y = Math.PI;
    beamPivot.add(beamFwd, beamBack);
    natureChunk.add(beamPivot);
    lighthouseBeams.push(beamPivot);
  });
  lhWhiteInst.instanceMatrix.needsUpdate = true;
  lhWhiteInst.computeBoundingSphere();
  lhRedInst.instanceMatrix.needsUpdate = true;
  lhRedInst.computeBoundingSphere();
  lhLanternInst.instanceMatrix.needsUpdate = true;
  lhLanternInst.computeBoundingSphere();
  natureChunk.add(lhWhiteInst, lhRedInst, lhLanternInst);

  // 8c. Moving Coastal Ships & Patrol Boats with White Wakes (100% InstancedMesh)
  interface SeaVessel {
    x: number;
    baseZ: number;
    zMin: number;
    zMax: number;
    dir: 1 | -1;
    speed: number;
    scale: number;
    phase: number;
  }
  const seaVessels: SeaVessel[] = [
    { x: 1460, baseZ: -2600, zMin: -4200, zMax: -1650, dir: 1, speed: 12.5, scale: 1.15, phase: 0.2 },
    { x: 1580, baseZ: 950, zMin: 600, zMax: 3200, dir: -1, speed: 11.0, scale: 1.0, phase: 1.4 },
    { x: 2450, baseZ: 700, zMin: -500, zMax: 2600, dir: 1, speed: 14.5, scale: 0.9, phase: 2.1 },
    { x: 3550, baseZ: -600, zMin: -2800, zMax: 1600, dir: -1, speed: 13.5, scale: 1.25, phase: 0.8 },
    { x: 1440, baseZ: 2100, zMin: 900, zMax: 3800, dir: 1, speed: 16.0, scale: 0.72, phase: 3.1 },
    { x: 2280, baseZ: -2900, zMin: -4600, zMax: -1950, dir: -1, speed: 12.0, scale: 1.05, phase: 1.9 },
    { x: 3850, baseZ: -1900, zMin: -3900, zMax: 800, dir: 1, speed: 15.0, scale: 1.3, phase: 2.6 },
  ];
  const shipHullInst = new THREE.InstancedMesh(new THREE.BoxGeometry(13, 6.2, 74), hullMat, seaVessels.length);
  const shipCabinInst = new THREE.InstancedMesh(new THREE.BoxGeometry(9.5, 6.8, 18), concreteMat, seaVessels.length);
  const shipCargoInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(8.8, 4.2, 34),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }),
    seaVessels.length
  );
  const shipWakeInst = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(34, 130).rotateX(-Math.PI / 2),
    shipWakeMat,
    seaVessels.length
  );
  [shipHullInst, shipCabinInst, shipCargoInst, shipWakeInst].forEach((m) => {
    m.castShadow = false;
    m.frustumCulled = false;
  });
  const cargoColors = [0xb91c1c, 0x0284c7, 0xd97706, 0x15803d, 0x334155, 0x0f766e, 0xc2410c];
  seaVessels.forEach((sv, idx) => {
    tCol.setHex(cargoColors[idx % cargoColors.length]);
    shipCargoInst.setColorAt(idx, tCol);
  });
  if (shipCargoInst.instanceColor) shipCargoInst.instanceColor.needsUpdate = true;
  natureChunk.add(shipHullInst, shipCabinInst, shipCargoInst, shipWakeInst);

  // 9. Multi-Layered Volumetric-Style Cumulus Billboard Clouds (3 Altitude Layers, Single InstancedMesh Draw Call)
  const clusterCount = 96;
  const puffsPerCluster = 6;
  const cloudUniforms = {
    uCloudTex: { value: textures.cloudPuff },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, -0.35).normalize() },
    uSunColor: { value: new THREE.Color(0xfff5db) },
    uTopColor: { value: new THREE.Color(0xf8fafc) },
    uShadowColor: { value: new THREE.Color(0x667b96) },
    uFogColor: { value: new THREE.Color(0x7fb4e8) },
    uFogDensity: { value: 0.000095 },
    uCloudDrift: { value: new THREE.Vector2(0, 0) },
    uCloudScale: { value: 1.0 },
    uCloudDropY: { value: 0.0 },
    uOvercast: { value: 0.08 },
  };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform vec2 uCloudDrift;
      uniform float uCloudScale;
      uniform float uCloudDropY;
      varying vec2 vUv;
      varying float vDist;
      varying float vSunFacing;
      uniform vec3 uSunDir;

      void main() {
        vUv = uv;
        vec3 instPos = instanceMatrix[3].xyz;
        float sx = length(instanceMatrix[0].xyz) * uCloudScale;
        float sy = length(instanceMatrix[1].xyz) * (0.9 + uCloudScale * 0.18);

        // Seamless wrapping cloud drift inside 20km world box
        vec2 drifted = mod(instPos.xz + uCloudDrift + 10000.0, 20000.0) - 10000.0;
        vec3 worldCenter = vec3(drifted.x, instPos.y - uCloudDropY, drifted.y);

        vec4 mvCenter = modelViewMatrix * vec4(worldCenter, 1.0);
        mvCenter.xy += position.xy * vec2(sx, sy);
        vDist = length(mvCenter.xyz);

        vec3 toCloud = normalize((modelMatrix * vec4(worldCenter, 1.0)).xyz - cameraPosition);
        vSunFacing = dot(toCloud, normalize(uSunDir));
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudTex;
      uniform vec3 uSunColor;
      uniform vec3 uTopColor;
      uniform vec3 uShadowColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uOvercast;
      varying vec2 vUv;
      varying float vDist;
      varying float vSunFacing;

      void main() {
        vec4 tex = texture2D(uCloudTex, vUv);
        float alpha = tex.a * (0.78 + uOvercast * 0.18);
        if (alpha < 0.024) discard;

        // Multi-tone Ace Combat cloud shading: luminous sunlit crowns, steel-blue undersides + golden Mie rim
        float topGrad = smoothstep(0.14, 0.86, vUv.y);
        float silverLining = pow(max(0.0, vSunFacing), 3.6) * 0.36 * (1.0 - tex.a * 0.42);
        vec3 litTop = mix(uTopColor, uSunColor, 0.28);
        vec3 col = mix(uShadowColor, litTop, topGrad) + uSunColor * silverLining;

        // Smooth distance & exponential fog fade so far clouds dissolve softly into horizon
        float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
        float farFade = 1.0 - smoothstep(11500.0, 19500.0, vDist);
        col = mix(col, uFogColor, clamp(fogF, 0.0, 0.92));
        gl_FragColor = vec4(col, alpha * farFade);
      }
    `,
  });
  const clouds = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    cloudMat,
    clusterCount * puffsPerCluster
  );
  let cIdx = 0;
  for (let i = 0; i < clusterCount; i++) {
    const cx = (hash2(i, 31) - 0.5) * 18000;
    const cz = (hash2(i, 37) - 0.5) * 18000 - 1500;
    const layer = i % 10;
    // 3 altitude strata: low mist/cumulus (390..580m), mid cumulus towers (670..1140m), high deck (1420..1950m)
    const cy =
      layer < 3
        ? 390 + hash2(i, 41) * 190
        : layer < 8
          ? 670 + hash2(i, 41) * 470
          : 1420 + hash2(i, 41) * 530;
    const baseW = layer >= 8 ? 380 + hash2(i, 43) * 420 : 250 + hash2(i, 43) * 340;
    const baseH = layer >= 8 ? 70 + hash2(i, 47) * 75 : 105 + hash2(i, 47) * 115;
    for (let p = 0; p < puffsPerCluster; p++) {
      const ang = p === 0 ? 0 : (p / (puffsPerCluster - 1)) * Math.PI * 2 + hash2(i, p * 7);
      const rad = p === 0 ? 0 : (0.28 + hash2(i + p, 19) * 0.28) * baseW;
      const offX = Math.cos(ang) * rad;
      const offZ = Math.sin(ang) * rad * 0.8;
      const offY = p === 0 ? baseH * 0.26 : (p % 2 === 0 ? 12 : -18);
      const puffScale = p === 0 ? 1.12 : 0.70 + hash2(i + p, 23) * 0.28;
      dummy.position.set(cx + offX, cy + offY, cz + offZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(baseW * puffScale, baseH * puffScale, 1);
      dummy.updateMatrix();
      clouds.setMatrixAt(cIdx++, dummy.matrix);
    }
  }
  clouds.instanceMatrix.needsUpdate = true;
  clouds.frustumCulled = false;
  root.add(clouds);

  // 10. Aerial Checkpoint Rings (Expanded World Circuit)
  const ringCoords: [number, number, number][] = [
    [0, 120, -650],
    [0, 190, -1850],
    [-750, 260, -2400],
    [-1950, 310, -2950],
    [-2900, 280, -3400],
    [-1250, 250, -1450],
    [450, 210, -520],
    [820, 240, -240],
    [1520, 160, 120],
    [1850, 105, 200],
    [2450, 150, -620],
    [2900, 130, -1400],
  ];
  const ringGeo = new THREE.TorusGeometry(26, 1.4, 8, 24);
  const uncollectedRingMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    metalness: 0.7,
  });
  const rings: SkyRing[] = ringCoords.map((rc, idx) => {
    const m = new THREE.Mesh(ringGeo, uncollectedRingMat);
    m.position.set(rc[0], rc[1], rc[2]);
    if (idx > 0) {
      const prev = ringCoords[idx - 1];
      m.lookAt(prev[0], prev[1], prev[2]);
    }
    root.add(m);
    return {
      id: idx,
      mesh: m,
      pos: new THREE.Vector3(rc[0], rc[1], rc[2]),
      radius: 30,
      collected: false,
    };
  });

  // 11. Destructible Ground Bombing Targets (Batched into 3 InstancedMeshes, castShadow = false)
  const targetCoords: [number, number][] = [
    [-420, -650],
    [-465, -700],
    [-420, -750],
    [-520, -1550],
    [-570, -1600],
    [-520, -1650],
    [2760, -1180],
    [2760, -1250],
  ];
  const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42, metalness: 0.35 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 });
  const padInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(8.5, 9.2, 0.7, 12), padMat, targetCoords.length);
  const tankInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(3.4, 3.4, 6.2, 12), tankMat, targetCoords.length);
  const bandInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(3.52, 3.52, 1.1, 12), bandMat, targetCoords.length);
  padInst.castShadow = false;
  tankInst.castShadow = false;
  bandInst.castShadow = false;
  padInst.frustumCulled = true;
  tankInst.frustumCulled = true;
  bandInst.frustumCulled = true;

  const targetHeights = targetCoords.map(([tx, tz]) => Math.max(0, groundHeightAt(tx, tz)));
  const targets: BombTarget[] = targetCoords.map(([tx, tz], id) => {
    const ty = targetHeights[id];
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(tx, ty + 0.35, tz);
    dummy.updateMatrix();
    padInst.setMatrixAt(id, dummy.matrix);

    dummy.position.set(tx, ty + 3.8, tz);
    dummy.updateMatrix();
    tankInst.setMatrixAt(id, dummy.matrix);

    dummy.position.set(tx, ty + 4.2, tz);
    dummy.updateMatrix();
    bandInst.setMatrixAt(id, dummy.matrix);

    return {
      id,
      pos: new THREE.Vector3(tx, ty + 3.2, tz),
      radius: 17,
      destroyed: false,
    };
  });
  padInst.instanceMatrix.needsUpdate = true;
  padInst.computeBoundingSphere();
  tankInst.instanceMatrix.needsUpdate = true;
  tankInst.computeBoundingSphere();
  bandInst.instanceMatrix.needsUpdate = true;
  bandInst.computeBoundingSphere();
  natureChunk.add(padInst, tankInst, bandInst);

  function setTargetVisible(id: number, visible: boolean): void {
    const coords = targetCoords[id];
    if (!coords) return;
    const [tx, tz] = coords;
    const ty = targetHeights[id];
    _targetDummy.rotation.set(0, 0, 0);
    _targetDummy.scale.setScalar(visible ? 1 : 0);
    _targetDummy.position.set(tx, ty + 3.8, tz);
    _targetDummy.updateMatrix();
    tankInst.setMatrixAt(id, _targetDummy.matrix);
    _targetDummy.position.set(tx, ty + 4.2, tz);
    _targetDummy.updateMatrix();
    bandInst.setMatrixAt(id, _targetDummy.matrix);
    tankInst.instanceMatrix.needsUpdate = true;
    bandInst.instanceMatrix.needsUpdate = true;
  }

  let baseTopHex = 0x183e74;
  let baseHorHex = 0x6b9ed4;
  let baseSunInt = 1.28;
  let baseHemiInt = 0.72;
  let baseFogDensity = 0.000105;
  let isNightTod = false;
  let cloudDriftX = 0;
  let cloudDriftZ = 0;

  const baseTopColor = new THREE.Color(baseTopHex);
  const baseHorColor = new THREE.Color(baseHorHex);
  const overcastTopColor = new THREE.Color(0x334155);
  const overcastHorColor = new THREE.Color(0x64748b);
  const nightOvercastTop = new THREE.Color(0x030712);
  const nightOvercastHor = new THREE.Color(0x0f172a);
  const dayCloudTop = new THREE.Color(0xf8fafc);
  const stormCloudTop = new THREE.Color(0x94a3b8);
  const nightCloudTop = new THREE.Color(0x334155);
  const nightStormCloudTop = new THREE.Color(0x1e293b);
  const dayCloudShadow = new THREE.Color(0x6b7f99);
  const stormCloudShadow = new THREE.Color(0x475569);
  const nightCloudShadow = new THREE.Color(0x111827);

  function applyTimeOfDay(
    tod: TimeOfDay,
    targetScene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight
  ) {
    // Rich Ace Combat cinematic color palette with atmospheric depth
    baseTopHex = 0x0c3473;
    baseHorHex = 0x7fb4e8;
    let sunHex = 0xfff2d6;
    let sunPos: [number, number, number] = [340, 490, 220];
    baseSunInt = 1.56;
    let hemiSky = 0x87c6ff;
    let hemiGnd = 0x2f3e28;
    baseHemiInt = 0.86;
    baseFogDensity = 0.000092;
    let nightGlow = 0.16;
    isNightTod = false;

    if (tod === 'dawn') {
      baseTopHex = 0x112b68;
      baseHorHex = 0xe58c52;
      sunHex = 0xffc87d;
      sunPos = [560, 128, -280];
      baseSunInt = 1.42;
      hemiSky = 0xfdba74;
      hemiGnd = 0x2d2a2e;
      baseHemiInt = 0.76;
      baseFogDensity = 0.00012;
      nightGlow = 0.62;
    } else if (tod === 'dusk') {
      baseTopHex = 0x1a1548;
      baseHorHex = 0xd9616c;
      sunHex = 0xff9678;
      sunPos = [-540, 92, -240];
      baseSunInt = 1.28;
      hemiSky = 0xfb7185;
      hemiGnd = 0x1e202c;
      baseHemiInt = 0.68;
      baseFogDensity = 0.000135;
      nightGlow = 0.92;
    } else if (tod === 'night') {
      baseTopHex = 0x020617;
      baseHorHex = 0x0c1936;
      sunHex = 0x93c5fd;
      sunPos = [240, 380, -320];
      baseSunInt = 0.56;
      hemiSky = 0x3b4d68;
      hemiGnd = 0x090d16;
      baseHemiInt = 0.52;
      baseFogDensity = 0.000165;
      nightGlow = 1.85;
      isNightTod = true;
    }

    baseTopColor.setHex(baseTopHex);
    baseHorColor.setHex(baseHorHex);

    skyUniforms.uTopColor.value.copy(baseTopColor);
    skyUniforms.uHorizonColor.value.copy(baseHorColor);
    skyUniforms.uSunColor.value.setHex(sunHex);
    skyUniforms.uSunDir.value.set(...sunPos).normalize();
    skyUniforms.uNightFactor.value = isNightTod ? 1.0 : tod === 'dusk' ? 0.25 : 0.0;

    sunHaloMesh.position.copy(skyUniforms.uSunDir.value).multiplyScalar(43000);
    sunHaloMesh.lookAt(0, 0, 0);
    sunHaloUniforms.uColor.value.setHex(sunHex);
    sunHaloUniforms.uOpacity.value = isNightTod ? 0.32 : tod === 'noon' ? 0.85 : 1.05;

    beamMat.opacity = isNightTod ? 0.28 : tod === 'dawn' || tod === 'dusk' ? 0.19 : 0.075;

    cloudUniforms.uSunDir.value.copy(skyUniforms.uSunDir.value);
    cloudUniforms.uSunColor.value.setHex(sunHex);
    oceanUniforms.uOceanSunDir.value.copy(skyUniforms.uSunDir.value);
    oceanUniforms.uOceanSunColor.value.setHex(sunHex);
    oceanUniforms.uOceanHorizonColor.value.copy(baseHorColor);

    sun.color.setHex(sunHex);
    sun.position.set(...sunPos);
    sun.intensity = baseSunInt;
    hemi.color.setHex(hemiSky);
    hemi.groundColor.setHex(hemiGnd);
    hemi.intensity = baseHemiInt;

    if (targetScene.background instanceof THREE.Color) {
      targetScene.background.copy(baseHorColor);
    } else {
      targetScene.background = baseHorColor.clone();
    }
    if (targetScene.fog instanceof THREE.FogExp2) {
      targetScene.fog.color.copy(baseHorColor);
      targetScene.fog.density = baseFogDensity;
    } else {
      targetScene.fog = new THREE.FogExp2(baseHorHex, baseFogDensity);
    }
    for (const m of nightGlowMats) {
      m.emissiveIntensity = m === bMat ? nightGlow * 0.58 : nightGlow;
    }
    const edgeHex = tod === 'night' || tod === 'dusk' ? 0xfef08a : 0xe0f2fe;
    lightMat.color.setHex(edgeHex);
    lightMat.emissive.setHex(tod === 'night' || tod === 'dusk' ? 0xfbbf24 : 0xbae6fd);
    lightMat.emissiveIntensity = tod === 'night' || tod === 'dusk' ? 3.6 : 1.9;
  }

  function applyWeather(
    fogMul: number,
    cloudScale: number,
    overcast: number,
    windX: number,
    windZ: number,
    dt: number,
    elapsed: number,
    targetScene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight
  ) {
    const oc = THREE.MathUtils.clamp(overcast, 0, 1);
    const targetTop = isNightTod ? nightOvercastTop : overcastTopColor;
    const targetHor = isNightTod ? nightOvercastHor : overcastHorColor;

    skyUniforms.uTopColor.value.copy(baseTopColor).lerp(targetTop, oc * 0.72);
    skyUniforms.uHorizonColor.value.copy(baseHorColor).lerp(targetHor, oc * 0.8);
    oceanUniforms.uOceanHorizonColor.value.copy(skyUniforms.uHorizonColor.value);
    oceanUniforms.uOceanTime.value = elapsed;
    wakeUniforms.uTime.value = elapsed;

    if (targetScene.background instanceof THREE.Color) {
      targetScene.background.copy(skyUniforms.uHorizonColor.value);
    }
    const activeFogDensity = baseFogDensity * THREE.MathUtils.clamp(fogMul, 0.7, 4.2);
    if (targetScene.fog instanceof THREE.FogExp2) {
      targetScene.fog.color.copy(skyUniforms.uHorizonColor.value);
      targetScene.fog.density = activeFogDensity;
    }

    sun.intensity = baseSunInt * (1 - oc * 0.44);
    hemi.intensity = baseHemiInt * (1 - oc * 0.16);
    sunHaloUniforms.uOpacity.value = (isNightTod ? 0.32 : 0.92) * (1 - oc * 0.72);

    const clDayTop = isNightTod ? nightCloudTop : dayCloudTop;
    const clStormTop = isNightTod ? nightStormCloudTop : stormCloudTop;
    const clShadow = isNightTod ? nightCloudShadow : dayCloudShadow;
    cloudUniforms.uTopColor.value.copy(clDayTop).lerp(clStormTop, oc);
    cloudUniforms.uShadowColor.value.copy(clShadow).lerp(stormCloudShadow, oc * 0.8);
    cloudUniforms.uFogColor.value.copy(skyUniforms.uHorizonColor.value);
    cloudUniforms.uFogDensity.value = activeFogDensity;
    cloudUniforms.uOvercast.value = oc;

    const cScale = THREE.MathUtils.clamp(cloudScale, 0.7, 1.65);
    cloudUniforms.uCloudScale.value = cScale;
    cloudUniforms.uCloudDropY.value = oc * 95;

    // GPU-driven cloud drift driven directly by live wind vector (20km seamless wrap)
    cloudDriftX = ((cloudDriftX + windX * 1.15 * dt) % 20000 + 20000) % 20000;
    cloudDriftZ = ((cloudDriftZ + windZ * 1.15 * dt) % 20000 + 20000) % 20000;
    cloudUniforms.uCloudDrift.value.set(cloudDriftX, cloudDriftZ);

    // Windsock aligns downwind and inflates horizontally with wind speed
    const windSpd = Math.hypot(windX, windZ);
    const windNorm = THREE.MathUtils.clamp(windSpd / 28, 0, 1);
    const targetYaw = Math.atan2(-windX, -windZ);
    windsock.rotation.y = targetYaw + Math.sin(elapsed * (2.2 + windNorm * 4.5)) * (0.06 + windNorm * 0.12);
    windsock.rotation.z =
      THREE.MathUtils.lerp(-0.52, 0.04, windNorm) +
      Math.sin(elapsed * (3.2 + windNorm * 8.0)) * (0.04 + windNorm * 0.09);

    const turbineSpin = dt * (0.75 + windSpd * 0.16);
    turbineAngle += turbineSpin;
    for (let ti = 0; ti < turbCoords.length; ti++) {
      const [wx, wy, wz] = turbCoords[ti];
      for (let b = 0; b < 3; b++) {
        _turbDummy.position.set(wx, wy + 62, wz + 1.5);
        _turbDummy.rotation.set(0, 0, turbineAngle + (b * Math.PI * 2) / 3);
        _turbDummy.scale.setScalar(1);
        _turbDummy.updateMatrix();
        turbineBladeInst.setMatrixAt(ti * 3 + b, _turbDummy.matrix);
      }
    }
    turbineBladeInst.instanceMatrix.needsUpdate = true;

    // Subtle wind-driven ocean wave ripple animation (seamless UV offset fallback + shader clock)
    textures.waterNormal.offset.x = (textures.waterNormal.offset.x + (0.012 + windX * 0.0012) * dt) % 1;
    textures.waterNormal.offset.y = (textures.waterNormal.offset.y + (0.008 + windZ * 0.0012) * dt) % 1;
  }

  function update(dt: number, elapsed: number) {
    radarDish.rotation.y += dt * 1.4;
    for (const ring of rings) {
      if (!ring.collected) {
        ring.mesh.rotation.z += dt * 0.8;
      }
    }

    // 1. Slow patrol cruise for the Supercarrier Strike Group (syncing deck, wires, helipad & island collider)
    const prevZ = carrierMeta.z;
    const nextZ = 200 - 380 * (0.5 - 0.5 * Math.cos(elapsed * 0.016));
    carrierMeta.z = nextZ;
    carrierMeta.dz = nextZ - prevZ;
    carrierGroup.position.z = nextZ;
    carrierHelipad.z = nextZ;
    carrierIslandCollider.z = nextZ - 14;
    for (let wi = 0; wi < localWireZ.length; wi++) {
      carrierMeta.wireZ[wi] = nextZ + localWireZ[wi];
    }
    if (rings[9] && !rings[9].collected) {
      rings[9].pos.z = nextZ;
      rings[9].mesh.position.z = nextZ;
    }

    // 2. Rotate coastal lighthouse beams smoothly
    for (let li = 0; li < lighthouseBeams.length; li++) {
      lighthouseBeams[li].rotation.y += dt * (0.85 + li * 0.12);
    }

    // 3. Cruise coastal cargo & patrol ships with animated water wakes
    for (let si = 0; si < seaVessels.length; si++) {
      const sv = seaVessels[si];
      const span = sv.zMax - sv.zMin;
      const tPos = ((elapsed * sv.speed + sv.phase * span) % (span * 2));
      const fwd = tPos < span;
      const curZ = fwd ? sv.zMin + tPos : sv.zMax - (tPos - span);
      const yaw = fwd ? Math.PI : 0;
      const bob = Math.sin(elapsed * 1.6 + sv.phase * 4.0) * 0.25;
      const roll = Math.sin(elapsed * 1.1 + sv.phase * 3.0) * 0.025;
      const dirSign = fwd ? 1 : -1;

      _turbDummy.rotation.set(0, yaw, roll);
      _turbDummy.scale.setScalar(sv.scale);
      _turbDummy.position.set(sv.x, 1.8 * sv.scale + bob, curZ);
      _turbDummy.updateMatrix();
      shipHullInst.setMatrixAt(si, _turbDummy.matrix);

      _turbDummy.position.set(sv.x, 7.2 * sv.scale + bob, curZ - dirSign * 18 * sv.scale);
      _turbDummy.updateMatrix();
      shipCabinInst.setMatrixAt(si, _turbDummy.matrix);

      _turbDummy.position.set(sv.x, 5.8 * sv.scale + bob, curZ + dirSign * 10 * sv.scale);
      _turbDummy.updateMatrix();
      shipCargoInst.setMatrixAt(si, _turbDummy.matrix);

      _turbDummy.rotation.set(0, yaw, 0);
      _turbDummy.position.set(sv.x, 0.15, curZ - dirSign * 92 * sv.scale);
      _turbDummy.updateMatrix();
      shipWakeInst.setMatrixAt(si, _turbDummy.matrix);
    }
    shipHullInst.instanceMatrix.needsUpdate = true;
    shipCabinInst.instanceMatrix.needsUpdate = true;
    shipCargoInst.instanceMatrix.needsUpdate = true;
    shipWakeInst.instanceMatrix.needsUpdate = true;

    // 4. Sequenced "Rabbit" Strobe Pulse down ALS Approach Lights + Gentle Breathing Threshold Glow
    const seqRow = 8 - Math.floor((elapsed * 6.5) % 9);
    const breath = 0.88 + Math.sin(elapsed * 3.4) * 0.18;
    for (let i = 0; i < appCoords.length; i++) {
      if (i < 14) {
        appCol.copy(appBaseColors[i]).multiplyScalar(breath);
      } else {
        const az = appCoords[i].z;
        const row = Math.round((az - 420) / 42);
        const isRabbit = row === seqRow;
        appCol.copy(appBaseColors[i]).multiplyScalar(isRabbit ? 2.4 : 0.72);
      }
      approachInst.setColorAt(i, appCol);
    }
    if (approachInst.instanceColor) approachInst.instanceColor.needsUpdate = true;
  }

  return {
    root,
    radarDish,
    windsock,
    clouds,
    oceanMesh,
    setOceanOrigin,
    skyMesh,
    skyUniforms,
    cloudUniforms,
    runwayLights,
    updatePapiLights,
    setTargetVisible,
    nightGlowMats,
    rings,
    targets,
    helipads,
    colliders,
    carrier: carrierMeta,
    highlandBase: { x: -2900, y: 145, z: -3400, halfW: 38, halfL: 600 },
    islandRunway: { x: 2900, y: 14, z: -1400, halfW: 34, halfL: 460 },
    northernAirstrip: { x: -3200, y: 340, z: -16500, halfW: 40, halfL: 770 },
    desertRadarBase: { x: -1400, y: 32, z: 15500, halfW: 42, halfL: 690 },
    applyTimeOfDay,
    applyWeather,
    update,
  };
}
