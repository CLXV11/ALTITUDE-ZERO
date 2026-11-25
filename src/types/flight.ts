import type * as THREE from 'three';

export type AircraftId =
  | 'cessna'
  | 'f16'
  | 'sukhoi'
  | 'b2'
  | 'f22'
  | 'a10'
  | 'rafale'
  | 'f18'
  | 'airliner'
  | 'f35'
  | 'biplane'
  | 'hercules'
  | 'concorde'
  | 'sr71'
  | 'f117';

export type AircraftCategory =
  | 'طائرة خفيفة'
  | 'مقاتلة نفاثة'
  | 'مقاتلة سيادة جوية'
  | 'مقاتلة شبحية'
  | 'مقاتلة متعددة المهام'
  | 'مقاتلة بحرية'
  | 'طائرة دعم وقصف'
  | 'طائرة قصف شبحية'
  | 'قاذفة شبحية'
  | 'طائرة ركاب'
  | 'طائرة فوق صوتية'
  | 'طائرة استطلاع'
  | 'طائرة بهلوانية'
  | 'طائرة شحن';

export type TimeOfDay = 'dawn' | 'noon' | 'dusk' | 'night';

export type SpawnMode = 'cockpit' | 'walk';

export type GamePhase = 'lobby' | 'playing' | 'paused';

export type CameraMode = 'chase' | 'cockpit' | 'orbit';

export type PlayerMode = 'walk' | 'fly' | 'skydive';

export type MissionId = 'rings' | 'bombing' | 'carrier' | 'highland' | 'refuel';

export type WeatherCondition = 'clear' | 'breezy' | 'foggy' | 'storm';

export interface MissionSnapshot {
  id: MissionId;
  titleAr: string;
  objectiveAr: string;
  progress: number;
  target: number;
  completed: boolean;
  targetX: number;
  targetY: number;
  targetZ: number;
  distM: number;
  bearingDeg: number;
}

export interface AutopilotProfile {
  tAlt: number;
  vt: number;
  vc: number;
  bk: number;
  vap: number;
  L: number;
  mp: number;
  az: number;
  aAlt: number;
  ad: number;
  cs: number;
  fl: number;
  cap: number;
}

export interface AeroSpec {
  massKg: number;
  wingAreaM2: number;
  aspectRatio: number;
  oswaldEff: number;
  inertia: [number, number, number]; // [Ixx pitch, Iyy yaw, Izz roll] in kg*m^2
  maxDryThrustN: number;
  hasAfterburner: boolean;
  maxAbThrustN: number;
  spoolUpTimeS: number;
  spoolDownTimeS: number;
  cd0: number;
  cl0: number;
  clAlpha: number;
  clMax: number;
  stallAoADeg: number;
  maxSpeedMs: number;
  controlTorque: [number, number, number]; // [pitch, yaw, roll] scale
  dampRate: [number, number, number]; // [pitch, yaw, roll] aerodynamic damping
  compMach: number; // control compression onset Mach
  gearMaxTravelM: number;
}

export interface AircraftConfig {
  id: AircraftId;
  nameAr: string;
  nameEn: string;
  category: AircraftCategory;
  description: string;
  wingspanLabel: string;
  maxSpeedLabel: string;
  engineLabel: string;
  ceilingLabel: string;
  hasMissiles?: boolean;
  hasBombs?: boolean;
  seats: number;
  aero: AeroSpec;
  T: number;
  tv: number;
  drag: number;
  k: number;
  Cl0: number;
  sl: number;
  st: number;
  pr: number;
  rr: number;
  yr: number;
  vr: number;
  rot: number;
  brake: number;
  pmax: number;
  vmax: number;
  hx: number;
  hz: number;
  ex: number;
  cam: [number, number, number];
  cockpitOffset: [number, number, number];
  fovk: number;
  y0: number;
  sh: [number, number];
  board: number;
  mapColor: string;
  mapLabel: string;
  mapScale: number;
  spawnPos: [number, number, number];
  spawnYaw: number;
  ap: AutopilotProfile;
}

export interface ContactPoint {
  v: THREE.Vector3;
  w: number; // 1 = wheel/skid, 0 = fuselage/wingtip
}

export interface AutopilotState {
  ph:
    | 'takeoff'
    | 'climb'
    | 'cruise'
    | 'follow'
    | 'recalt'
    | 'recspd'
    | 'orbit'
    | 'approach'
    | 'final'
    | 'rollout'
    | 'taxi';
  i: number;
  then: AutopilotState['ph'] | null;
  from: { x: number; z: number };
  t0?: number;
  back?: boolean;
}

export interface AircraftDamageState {
  leftWing: number; // 0.0 (severed) to 1.0 (intact)
  rightWing: number; // 0.0 (severed) to 1.0 (intact)
  tail: number; // 0.0 (destroyed) to 1.0 (intact)
  engine: number; // 0.0 (dead/on fire) to 1.0 (intact)
  gear: number; // 0.0 (collapsed/snapped) to 1.0 (intact)
}

export interface AircraftInstance {
  config: AircraftConfig;
  group: THREE.Group;
  pilot: THREE.Group;
  pax: THREE.Group | null;
  tailhook?: THREE.Group;
  props: THREE.Object3D[];
  discs: THREE.Mesh[];
  flames: THREE.Mesh[];
  strobes: THREE.Mesh[];
  contactPoints: ContactPoint[];
  spawn: THREE.Vector3;
  spawnYaw: number;
  p: THREE.Vector3;
  prevP: THREE.Vector3;
  renderP: THREE.Vector3;
  q: THREE.Quaternion;
  prevQ: THREE.Quaternion;
  renderQ: THREE.Quaternion;
  v: THREE.Vector3;
  w: THREE.Vector3; // body-local angular velocity (rad/s)
  thr: number; // throttle demand (0..1)
  spool: number; // actual turbine/engine power state (0..1)
  ground: boolean;
  crash: number;
  hull: number;
  damage: AircraftDamageState;
  engineOverheat: number; // 0.0 to 1.0
  engineSputterTimer: number; // countdown seconds
  abandoned?: boolean;
  aoa: number;
  fwd: number;
  tas: number;
  liftLoadG: number;
  sh: THREE.Mesh;
  ai: AutopilotState | null;
  inp: { p: number; r: number; y: number; thr: number; brake: number };
}

export interface PilotStats {
  alt: number;
  spd: number;
  land: number;
  crash: number;
  rings: number;
}

export interface ScoreboardState {
  player: PilotStats;
  sami: PilotStats;
}

export interface BubbleState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  onScreen: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'sami' | 'player';
  text: string;
}

export type MegatronPhase =
  | 'idle'
  | 'storm'
  | 'entry'
  | 'transform'
  | 'mech'
  | 'jet'
  | 'dying'
  | 'defeated';

export interface MegatronHudState {
  active: boolean;
  phase: MegatronPhase;
  mode: 'mech' | 'jet';
  hp: number;
  maxHp: number;
  distM: number;
  onScreen: boolean;
  screenX: number;
  screenY: number;
  lockedByPlayer: boolean;
  laserWarning: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: PlayerMode;
  cameraMode: CameraMode;
  aircraftId: AircraftId;
  aircraftNameAr: string;
  aircraftNameEn: string;
  hasMissiles: boolean;
  missileCooldownPct: number;
  hasBombs: boolean;
  bombCooldownPct: number;
  flaresCount: number;
  flareCooldownPct: number;
  missileAlert: 'none' | 'lock' | 'incoming';
  incomingMissileDistM: number;
  tailhookDown: boolean;
  nearCarrierDistM: number;
  arrestedWire: boolean;
  bolterWarning: boolean;
  fuelPct: number;
  refuelDistanceM: number;
  refuelAssist: boolean;
  refuelDockPct: number;
  refuelConnected: boolean;
  refuelProgressPct: number;
  gForce: number;
  machNumber: number;
  supersonic: boolean;
  sonicBoomFlash: number;
  pitchDeg: number;
  rollDeg: number;
  aoaDeg: number;
  fpmOffsetX: number;
  fpmOffsetY: number;
  lockScreenX: number;
  lockScreenY: number;
  lockOnScreen: boolean;
  lockDistM: number;
  lockTargetName: string;
  parachuteOpen: boolean;
  boarding: boolean;
  hullPct: number;
  damage: AircraftDamageState;
  engineOverheated: boolean;
  gearBroken: boolean;
  speedKmh: number;
  speedKnots: number;
  altitudeM: number;
  vsiMs: number;
  headingDeg: number;
  throttlePct: number;
  spoolPct: number;
  afterburner: boolean;
  stall: boolean;
  onGround: boolean;
  crashed: boolean;
  autoLevel: boolean;
  flapsActive: boolean;
  papiSlope: 'high' | 'on' | 'low' | 'off';
  weatherCondition: WeatherCondition;
  windSpeedKmh: number;
  windDirDeg: number;
  turbulencePct: number;
  fps: number;
  promptText: string;
  samiMood: string;
  samiStatus: string;
  stats: ScoreboardState;
  ringsCollected: number;
  totalRings: number;
  mission: MissionSnapshot;
  bubble: BubbleState;
  nearestAirportDistM: number;
  boss: MegatronHudState;
}
