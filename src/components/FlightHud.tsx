import React, { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  Bomb,
  Camera,
  Compass,
  Crosshair,
  Flame,
  Footprints,
  Fuel,
  Home,
  Map as MapIcon,
  MessageSquare,
  Pause,
  RotateCcw,
  Send,
  ShieldAlert,
  Target,
  Umbrella,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type { ChatMessage, HudSnapshot } from '../types/flight';

interface FlightHudProps {
  hud: HudSnapshot;
  muted: boolean;
  fastMode: boolean;
  chatOpen: boolean;
  messages: ChatMessage[];
  mapExpanded: boolean;
  onSetMinimapCanvas: (el: HTMLCanvasElement | null) => void;
  onCycleMapZoom: () => void;
  onToggleMapExpanded: () => void;
  onToggleChat: () => void;
  onSendChat: (text: string) => void;
  onCycleCamera: () => void;
  onToggleAutoLevel: () => void;
  onCycleMission: () => void;
  onToggleMute: () => void;
  onToggleFastMode: () => void;
  onResetRunway: () => void;
  onOpenLobby: () => void;
  onResume: () => void;
  onPause: () => void;
  onToggleBoard: () => void;
  onFireMissile: () => void;
  onDropBomb: () => void;
  onDeployFlares: () => void;
  onToggleTailhook: () => void;
  onDeployParachute: () => void;
  onVirtualKey: (code: string, down: boolean) => void;
  onAnalog: (x: number, y: number, on: boolean) => void;
  onRudderAnalog: (v: number) => void;
  onTouchThrottle: (thr: number) => void;
  onSummonMegatron: () => void;
}

const CAMERA_LABELS = {
  chase: 'كاميرا المطاردة',
  cockpit: 'داخل القمرة',
  orbit: 'مدار حر',
};

const WEATHER_LABELS = {
  clear: 'CLEAR',
  breezy: 'WINDY',
  foggy: 'FOG',
  storm: 'STORM',
} as const;

const QUICK_COMMANDS = [
  'اركب معي',
  'الحقني',
  'حلق بسوبر هورنت',
  'حلق بالصوخوي',
  'اهبط',
];

const PITCH_RUNGS = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30];

const getDamageColor = (health: number): string => {
  if (health <= 0.01) return '#0f172a';
  if (health < 0.28) return '#ef4444';
  if (health < 0.58) return '#f97316';
  if (health < 0.84) return '#eab308';
  return '#22c55e';
};

export const FlightHud: React.FC<FlightHudProps> = ({
  hud,
  muted,
  fastMode,
  chatOpen,
  messages,
  mapExpanded,
  onSetMinimapCanvas,
  onCycleMapZoom,
  onToggleMapExpanded,
  onToggleChat,
  onSendChat,
  onCycleCamera,
  onToggleAutoLevel,
  onCycleMission,
  onToggleMute,
  onToggleFastMode,
  onResetRunway,
  onOpenLobby,
  onResume,
  onPause,
  onToggleBoard,
  onFireMissile,
  onDropBomb,
  onDeployFlares,
  onToggleTailhook,
  onDeployParachute,
  onVirtualKey,
  onAnalog,
  onRudderAnalog,
  onTouchThrottle,
  onSummonMegatron,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [sprintOn, setSprintOn] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const stickKnobRef = useRef<HTMLDivElement>(null);
  const rudKnobRef = useRef<HTMLDivElement>(null);
  const stickPtrId = useRef(-1);
  const thrPtrId = useRef(-1);
  const rudPtrId = useRef(-1);

  useEffect(() => {
    const coarse =
      window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    setIsTouchDevice(coarse);
  }, []);

  useEffect(() => {
    if (hud.mode !== 'walk' || hud.boarding || hud.phase !== 'playing') {
      if (sprintOn) {
        setSprintOn(false);
        onVirtualKey('ShiftLeft', false);
      }
    }
  }, [hud.mode, hud.boarding, hud.phase, sprintOn, onVirtualKey]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 40);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setInputText('');
  };

  const fly = hud.mode === 'fly';
  const skydive = hud.mode === 'skydive';
  const walk = hud.mode === 'walk';
  const missileReady = hud.missileCooldownPct >= 100;
  const bombReady = hud.bombCooldownPct >= 100;
  const flaresReady = hud.flareCooldownPct >= 100 && hud.flaresCount > 0;
  const cockpitHudVisible = fly && hud.cameraMode === 'cockpit' && !hud.crashed && hud.phase === 'playing';
  const missionPct = Math.min(100, Math.round((hud.mission.progress / Math.max(1, hud.mission.target)) * 100));

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none" dir="rtl">

      {/* Sonic Boom Shockwave Screen Edge Pulse */}
      {fly && hud.sonicBoomFlash > 0.06 && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-sky-200/80"
          style={{
            opacity: hud.sonicBoomFlash,
            boxShadow: 'inset 0 0 60px rgba(186, 230, 253, 0.55)',
          }}
        />
      )}

      {/* True Cockpit Phosphor-Green Fighter HUD */}
      {cockpitHudVisible && (
        <div className="fixed inset-0 pointer-events-none z-10 flex items-center justify-center" dir="ltr">
          <svg
            viewBox="0 0 600 440"
            className="w-[min(86vw,640px)] h-[min(64vh,460px)] overflow-visible"
            style={{ filter: 'drop-shadow(0 0 3px rgba(34,255,102,0.55))' }}
          >
            <defs>
              <clipPath id="cockpit-hud-ladder-clip">
                <rect x="145" y="70" width="310" height="290" rx="8" />
              </clipPath>
            </defs>

            {/* Heading Tape Box */}
            <g transform="translate(300, 32)">
              <rect x="-34" y="-13" width="68" height="22" fill="none" stroke="#22ff66" strokeWidth="1.6" />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fill="#22ff66"
                fontSize="13"
                fontWeight="700"
                fontFamily="monospace"
              >
                {String(hud.headingDeg).padStart(3, '0')}°
              </text>
              <path d="M -5 14 L 0 9 L 5 14" fill="none" stroke="#22ff66" strokeWidth="1.5" />
            </g>

            {/* Top Bank Angle Scale Arc & Pointer */}
            <g transform="translate(300, 220)">
              <path
                d="M -92 -118 A 150 150 0 0 1 92 -118"
                fill="none"
                stroke="#22ff66"
                strokeWidth="1.3"
                strokeDasharray="3 8"
                opacity="0.7"
              />
              <polygon
                points="0,-148 -5,-139 5,-139"
                fill="#22ff66"
                transform={`rotate(${-hud.rollDeg})`}
              />
            </g>

            {/* Clipped Artificial Horizon & Pitch Ladder */}
            <g clipPath="url(#cockpit-hud-ladder-clip)">
              <g
                transform={`translate(300, 220) rotate(${hud.rollDeg}) translate(0, ${
                  hud.pitchDeg * 4.4
                })`}
              >
                {PITCH_RUNGS.map((deg) => {
                  const y = -deg * 4.4;
                  const isZero = deg === 0;
                  const halfW = isZero ? 105 : 44;
                  const gap = isZero ? 22 : 16;
                  const dash = deg < 0 ? '6 4' : undefined;
                  return (
                    <g key={deg} transform={`translate(0, ${y})`}>
                      <line
                        x1={-halfW}
                        y1="0"
                        x2={-gap}
                        y2="0"
                        stroke="#22ff66"
                        strokeWidth={isZero ? '2' : '1.4'}
                        strokeDasharray={dash}
                      />
                      <line
                        x1={gap}
                        y1="0"
                        x2={halfW}
                        y2="0"
                        stroke="#22ff66"
                        strokeWidth={isZero ? '2' : '1.4'}
                        strokeDasharray={dash}
                      />
                      {!isZero && (
                        <>
                          <line
                            x1={-halfW}
                            y1="0"
                            x2={-halfW}
                            y2={deg > 0 ? 6 : -6}
                            stroke="#22ff66"
                            strokeWidth="1.4"
                          />
                          <line
                            x1={halfW}
                            y1="0"
                            x2={halfW}
                            y2={deg > 0 ? 6 : -6}
                            stroke="#22ff66"
                            strokeWidth="1.4"
                          />
                          <text
                            x={-halfW - 6}
                            y="4"
                            textAnchor="end"
                            fill="#22ff66"
                            fontSize="10"
                            fontFamily="monospace"
                          >
                            {Math.abs(deg)}
                          </text>
                          <text
                            x={halfW + 6}
                            y="4"
                            textAnchor="start"
                            fill="#22ff66"
                            fontSize="10"
                            fontFamily="monospace"
                          >
                            {Math.abs(deg)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>

            {/* Center Aircraft Waterline Reference (W Boresight) */}
            <path
              d="M 282 220 L 292 220 L 296 226 L 300 220 L 304 226 L 308 220 L 318 220"
              fill="none"
              stroke="#22ff66"
              strokeWidth="1.8"
            />

            {/* Dynamic Velocity Vector / Flight Path Marker (FPM) */}
            <g
              transform={`translate(${300 + hud.fpmOffsetX * 260}, ${
                220 + hud.fpmOffsetY * 185
              })`}
            >
              <circle cx="0" cy="0" r="8" fill="none" stroke="#22ff66" strokeWidth="1.8" />
              <line x1="-18" y1="0" x2="-8" y2="0" stroke="#22ff66" strokeWidth="1.8" />
              <line x1="8" y1="0" x2="18" y2="0" stroke="#22ff66" strokeWidth="1.8" />
              <line x1="0" y1="-8" x2="0" y2="-16" stroke="#22ff66" strokeWidth="1.8" />
            </g>

            {/* Left Airspeed & Mach / G-Load Block */}
            <g transform="translate(158, 198)">
              <rect x="-46" y="-15" width="66" height="23" fill="rgba(0,22,8,0.48)" stroke="#22ff66" strokeWidth="1.5" />
              <text x="-13" y="2" textAnchor="middle" fill="#22ff66" fontSize="13" fontWeight="700" fontFamily="monospace">
                {hud.speedKnots}
              </text>
              <rect x="-46" y="11" width="66" height="49" rx="3" fill="rgba(0,22,8,0.38)" />
              <text x="-42" y="24" fill="#22ff66" fontSize="9.5" fontFamily="monospace">
                KMH {hud.speedKmh}
              </text>
              <text x="-42" y="39" fill={hud.supersonic ? '#7dd3fc' : '#22ff66'} fontSize="10.5" fontWeight="700" fontFamily="monospace">
                M {hud.machNumber.toFixed(2)}
              </text>
              <text x="-42" y="54" fill={Math.abs(hud.gForce) > 5 ? '#facc15' : '#22ff66'} fontSize="10.5" fontWeight="700" fontFamily="monospace">
                G {hud.gForce.toFixed(1)}
              </text>
            </g>

            {/* Right Altitude, AoA, Fuel & Hook Block */}
            <g transform="translate(442, 198)">
              <rect x="-20" y="-15" width="68" height="23" fill="rgba(0,22,8,0.48)" stroke="#22ff66" strokeWidth="1.5" />
              <text x="14" y="2" textAnchor="middle" fill="#22ff66" fontSize="13" fontWeight="700" fontFamily="monospace">
                {hud.altitudeM}m
              </text>
              <rect x="-20" y="11" width="68" height="62" rx="3" fill="rgba(0,22,8,0.38)" />
              <text x="-16" y="24" fill="#22ff66" fontSize="9.5" fontFamily="monospace">
                V/S {hud.vsiMs}
              </text>
              <text x="-16" y="39" fill={hud.stall ? '#f87171' : '#22ff66'} fontSize="10.5" fontWeight="700" fontFamily="monospace">
                AOA {hud.aoaDeg.toFixed(1)}°
              </text>
              <text x="-16" y="54" fill={hud.fuelPct < 22 ? '#facc15' : '#22ff66'} fontSize="9.5" fontFamily="monospace">
                FUEL {hud.fuelPct}%
              </text>
              <text x="-16" y="68" fill={hud.tailhookDown ? '#facc15' : '#22ff66'} fontSize="9.5" fontWeight="700" fontFamily="monospace">
                {hud.tailhookDown ? 'HOOK DN' : 'HOOK UP'}
              </text>
            </g>
          </svg>
        </div>
      )}

      {/* 3D-Projected Target Lock Diamond Box (Cockpit & Chase HUD) */}
      {fly && hud.lockOnScreen && hud.lockTargetName && !hud.crashed && (
        <div
          className="fixed z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${hud.lockScreenX * 100}%`,
            top: `${hud.lockScreenY * 100}%`,
          }}
          dir="ltr"
        >
          <div
            className={`w-11 h-11 border-2 ${
              hud.boss.lockedByPlayer
                ? 'border-fuchsia-400 rotate-45'
                : hud.cameraMode === 'cockpit'
                  ? 'border-[#22ff66]'
                  : 'border-red-500'
            } flex items-center justify-center`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                hud.boss.lockedByPlayer
                  ? 'bg-fuchsia-400'
                  : hud.cameraMode === 'cockpit'
                    ? 'bg-[#22ff66]'
                    : 'bg-red-500'
              }`}
            />
          </div>
          <div
            className={`mt-1 text-center text-[10px] font-bold font-mono-num whitespace-nowrap ${
              hud.boss.lockedByPlayer
                ? 'text-fuchsia-300'
                : hud.cameraMode === 'cockpit'
                  ? 'text-[#22ff66]'
                  : 'text-red-400'
            }`}
          >
            {hud.boss.lockedByPlayer ? `MEGATRON · ${hud.lockDistM}m` : `${hud.lockDistM}m`}
          </div>
        </div>
      )}

      {/* Megatron Boss Tactical Marker when unlocked & visible on screen */}
      {hud.boss.active &&
        hud.boss.phase !== 'storm' &&
        hud.boss.onScreen &&
        !hud.boss.lockedByPlayer &&
        !hud.crashed && (
          <div
            className="fixed z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${hud.boss.screenX * 100}%`,
              top: `${hud.boss.screenY * 100}%`,
            }}
            dir="ltr"
          >
            <div className="w-10 h-10 border-2 border-purple-400/90 rotate-45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            </div>
            <div className="mt-1.5 text-center text-[10px] font-extrabold font-mono-num text-purple-300 whitespace-nowrap drop-shadow">
              MEGATRON · {hud.boss.distM}m
            </div>
          </div>
        )}

      {/* Unified Responsive Top Bar (Zero Mobile Overlap) */}
      <div
        className="fixed top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 pointer-events-none"
        dir="ltr"
      >
        {/* Top-Left Action Buttons & Radar Minimap */}
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
          <div
            data-ui-interactive="true"
            dir="rtl"
            className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 flex-wrap max-w-full"
          >
            <button
              type="button"
              onClick={onOpenLobby}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-950/82 border border-white/15 text-[11px] sm:text-xs font-bold text-amber-300 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>اللوبي</span>
            </button>

            {fly && (
              <button
                type="button"
                onClick={onCycleCamera}
                title="تبديل الكاميرا (V)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                  hud.cameraMode === 'cockpit'
                    ? 'bg-emerald-600/90 border-emerald-300/70 text-white'
                    : 'bg-slate-950/82 border-white/15 text-white hover:bg-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{CAMERA_LABELS[hud.cameraMode]}</span>
              </button>
            )}

            {fly && hud.hasMissiles && (
              <button
                type="button"
                onClick={onFireMissile}
                disabled={!missileReady}
                title="إطلاق صاروخ تتبعي (X)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  missileReady
                    ? hud.lockTargetName
                      ? 'bg-red-600 border-red-400 text-white hover:bg-red-500'
                      : 'bg-orange-600/90 border-orange-400/60 text-white hover:bg-orange-500'
                    : 'bg-slate-900/75 border-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">صاروخ (X)</span>
                <span className="sm:hidden">صاروخ</span>
              </button>
            )}

            {fly && hud.hasBombs && (
              <button
                type="button"
                onClick={onDropBomb}
                disabled={!bombReady}
                title="قصف بقنابل (B)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  bombReady
                    ? 'bg-amber-600/95 border-amber-300/70 text-white hover:bg-amber-500'
                    : 'bg-slate-900/75 border-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Bomb className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">قصف (B)</span>
                <span className="sm:hidden">قصف</span>
              </button>
            )}

            {fly && (
              <button
                type="button"
                onClick={onDeployFlares}
                disabled={!flaresReady}
                title="إطلاق مشاعل حرارية لتضليل الصواريخ (G)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.missileAlert !== 'none' && flaresReady
                    ? 'bg-yellow-400 border-yellow-100 text-slate-950'
                    : flaresReady
                    ? 'bg-yellow-600/90 border-yellow-300/60 text-white hover:bg-yellow-500'
                    : 'bg-slate-900/75 border-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مشاعل (G) · {hud.flaresCount}</span>
                <span className="sm:hidden">{hud.flaresCount}</span>
              </button>
            )}

            {fly && (
              <button
                type="button"
                onClick={onToggleTailhook}
                title="إنزال خطاف الإيقاف لحاملة الطائرات (H)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.tailhookDown
                    ? 'bg-emerald-500 border-emerald-200 text-slate-950'
                    : 'bg-slate-950/82 border-white/15 text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Anchor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خطاف (H)</span>
              </button>
            )}

            {fly && (
              <button
                type="button"
                onClick={onToggleAutoLevel}
                title="مساعد التوازن التلقائي للأجنحة (L)"
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.autoLevel
                    ? 'bg-sky-500/90 border-sky-200 text-slate-950'
                    : 'bg-slate-950/82 border-white/15 text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">توازن (L)</span>
              </button>
            )}

            {fly && !hud.onGround && (
              <button
                type="button"
                onClick={onToggleBoard}
                title="قفز من الطائرة في الهواء (F)"
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-amber-500/90 border border-amber-300/60 text-[11px] sm:text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <Wind className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">قفز جو (F)</span>
              </button>
            )}

            {skydive && !hud.parachuteOpen && (
              <button
                type="button"
                onClick={onDeployParachute}
                title="فتح المظلة (Space)"
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-orange-500 border border-orange-300 text-[11px] sm:text-xs font-extrabold text-slate-950 hover:bg-orange-400 transition-colors cursor-pointer shadow-lg"
              >
                <Umbrella className="w-3.5 h-3.5" />
                <span>فتح المظلة</span>
              </button>
            )}

            {!hud.boss.active && hud.phase === 'playing' && (
              <button
                type="button"
                onClick={onSummonMegatron}
                title="استدعاء الزعيم الخفي: ميغاترون (K)"
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-purple-700/90 border border-purple-300/70 text-[11px] sm:text-xs font-extrabold text-white hover:bg-purple-600 transition-colors cursor-pointer shadow-lg"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">استدعاء الزعيم: ميغاترون</span>
                <span className="sm:hidden">ميغاترون</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleChat}
              aria-label="دردشة سامي"
              className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                chatOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-950/82 border-white/15 text-white hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">سامي</span>
            </button>

            <button
              type="button"
              onClick={onToggleMapExpanded}
              aria-label="توسيع الخريطة"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/82 border border-white/15 text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label="الصوت"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/82 border border-white/15 text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onResetRunway}
              aria-label="إعادة ضبط"
              title="إعادة للمدرج (R)"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/82 border border-white/15 text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={onPause}
              aria-label="إيقاف مؤقت"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/82 border border-white/15 text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Radar Minimap + Live Mission Tracker */}
          <div className="flex flex-col items-start gap-1.5">
            <canvas
              ref={onSetMinimapCanvas}
              data-ui-interactive="true"
              width={mapExpanded ? 560 : 280}
              height={mapExpanded ? 560 : 280}
              onClick={onCycleMapZoom}
              title="اضغط لتغيير مقياس الرادار"
              className={`pointer-events-auto rounded-xl border-2 border-white/40 bg-slate-900 cursor-pointer shadow-xl transition-all ${
                mapExpanded
                  ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(82vw,82vh,420px)] h-[min(82vw,82vh,420px)] z-40'
                  : 'w-[86px] h-[86px] sm:w-[144px] sm:h-[144px]'
              }`}
            />
            {hud.phase === 'playing' && (
              <div
                data-ui-interactive="true"
                className="pointer-events-auto w-[148px] sm:w-[228px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-white/12 text-white shadow-lg"
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-amber-300 truncate">
                    <Target className="w-3 h-3 shrink-0" />
                    {hud.mission.titleAr}
                  </span>
                  <button
                    type="button"
                    onClick={onCycleMission}
                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-slate-200 cursor-pointer shrink-0"
                  >
                    تبديل
                  </button>
                </div>
                <div className="text-[10px] text-slate-200 truncate mt-0.5">{hud.mission.objectiveAr}</div>
                <div className="flex items-center justify-between gap-2 mt-1 text-[9px] font-mono-num text-slate-300">
                  <span>{hud.mission.distM}m · {hud.mission.bearingDeg}°</span>
                  <span className={hud.mission.completed ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                    {hud.mission.progress}/{hud.mission.target}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/15 overflow-hidden mt-1">
                  <div
                    className={`h-full transition-[width] duration-150 ${
                      hud.mission.completed ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${missionPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Telemetry & Rival Scoreboard */}
        <div
          className="shrink-0 w-[156px] sm:w-[222px] px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-950/82 border border-white/12 text-white shadow-lg"
          dir="ltr"
        >
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 border-b border-white/12 pb-1 mb-1 font-mono-num">
            <span>YOU · SAMI</span>
            <span>FPS {hud.fps}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono-num text-slate-200 mb-1.5">
            <span>Alt: {hud.stats.player.alt}/{hud.stats.sami.alt}</span>
            <span>Spd: {hud.stats.player.spd}/{hud.stats.sami.spd}</span>
            <span>Land: {hud.stats.player.land}/{hud.stats.sami.land}</span>
            <span>Rings: {hud.ringsCollected}/{hud.totalRings}</span>
          </div>

          {fly ? (
            <div className="border-t border-white/12 pt-1 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-amber-300 truncate">
                  {hud.aircraftNameEn}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {hud.afterburner && (
                    <span className="px-1 py-0.2 rounded bg-orange-500/30 text-orange-300 text-[9px] font-extrabold font-mono-num">
                      AB
                    </span>
                  )}
                  {hud.supersonic && (
                    <span className="px-1 py-0.2 rounded bg-sky-500/25 text-sky-300 text-[9px] font-extrabold font-mono-num">
                      MACH {hud.machNumber.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] sm:text-xs font-mono-num">
                <div>
                  <span className="text-slate-400 text-[9px]">TAS </span>
                  <span className="font-bold">{hud.speedKnots}kt</span>
                  <span className="text-slate-400 text-[9px]"> / {hud.speedKmh}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">ALT </span>
                  <span className="font-bold">{hud.altitudeM}m</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">VSI </span>
                  <span
                    className={
                      hud.vsiMs < -12
                        ? 'font-bold text-amber-300'
                        : hud.vsiMs > 12
                        ? 'font-bold text-emerald-300'
                        : 'font-bold'
                    }
                  >
                    {hud.vsiMs >= 0 ? `+${hud.vsiMs}` : hud.vsiMs}m/s
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">AOA </span>
                  <span
                    className={
                      hud.stall
                        ? 'font-bold text-red-400'
                        : Math.abs(hud.aoaDeg) > 13
                        ? 'font-bold text-amber-300'
                        : 'font-bold'
                    }
                  >
                    {hud.aoaDeg.toFixed(1)}°
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">G </span>
                  <span
                    className={
                      Math.abs(hud.gForce) > 6.5
                        ? 'font-bold text-red-400'
                        : Math.abs(hud.gForce) > 4.6
                        ? 'font-bold text-amber-300'
                        : 'font-bold'
                    }
                  >
                    {hud.gForce.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">M </span>
                  <span className={hud.supersonic ? 'font-bold text-sky-300' : 'font-bold'}>
                    {hud.machNumber.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Throttle / Engine Spool & Fuel Bars */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <div className="flex justify-between text-[9px] font-mono-num text-slate-300 mb-0.5">
                    <span>{hud.afterburner ? 'AB' : 'THR'}</span>
                    <span>
                      {hud.spoolPct}%
                      {hud.spoolPct !== hud.throttlePct ? `/${hud.throttlePct}` : ''}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-75"
                      style={{ width: `${hud.throttlePct}%` }}
                    />
                    <div
                      className={`relative h-full transition-[width] duration-75 ${
                        hud.afterburner ? 'bg-orange-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${hud.spoolPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] font-mono-num text-slate-300 mb-0.5">
                    <span>FUEL</span>
                    <span className={hud.fuelPct < 20 ? 'text-red-400 font-bold' : ''}>{hud.fuelPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        hud.fuelPct < 20 ? 'bg-red-500' : 'bg-sky-400'
                      }`}
                      style={{ width: `${hud.fuelPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Aircraft Structural Damage Paperdoll Diagram & Hull Bar */}
              <div className="pt-1 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <svg viewBox="0 0 100 88" className="w-12 h-11 shrink-0">
                    {/* Nose & Central Fuselage */}
                    <path
                      d="M50 4 L56 26 L56 64 L50 70 L44 64 L44 26 Z"
                      fill="#475569"
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                    {/* Cockpit Canopy */}
                    <ellipse cx="50" cy="21" rx="2.6" ry="6.5" fill="#38bdf8" opacity="0.65" />

                    {/* Left Wing */}
                    <path
                      d="M44 33 L6 48 L6 54 L44 48 Z"
                      fill={getDamageColor(hud.damage.leftWing)}
                      stroke="#cbd5e1"
                      strokeWidth="1.1"
                    />

                    {/* Right Wing */}
                    <path
                      d="M56 33 L94 48 L94 54 L56 48 Z"
                      fill={getDamageColor(hud.damage.rightWing)}
                      stroke="#cbd5e1"
                      strokeWidth="1.1"
                    />

                    {/* Tail / Horizontal & Vertical Stabilizers */}
                    <path
                      d="M45 62 L24 75 L24 80 L45 72 L50 82 L55 72 L76 80 L76 75 L55 62 Z"
                      fill={getDamageColor(hud.damage.tail)}
                      stroke="#cbd5e1"
                      strokeWidth="1.1"
                    />

                    {/* Engine Core / Nozzle */}
                    <rect
                      x="45.5"
                      y="52"
                      width="9"
                      height="15"
                      rx="2"
                      fill={hud.engineOverheated ? '#f97316' : getDamageColor(hud.damage.engine)}
                      stroke={hud.engineOverheated ? '#fef08a' : '#e2e8f0'}
                      strokeWidth="1.2"
                    />

                    {/* Landing Gear Indicators (Nose + Main Struts) */}
                    <circle
                      cx="50"
                      cy="14"
                      r="2.4"
                      fill={getDamageColor(hud.damage.gear)}
                      stroke="#0f172a"
                      strokeWidth="0.9"
                    />
                    <circle
                      cx="39"
                      cy="53"
                      r="2.4"
                      fill={getDamageColor(hud.damage.gear)}
                      stroke="#0f172a"
                      strokeWidth="0.9"
                    />
                    <circle
                      cx="61"
                      cy="53"
                      r="2.4"
                      fill={getDamageColor(hud.damage.gear)}
                      stroke="#0f172a"
                      strokeWidth="0.9"
                    />
                  </svg>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-mono-num text-slate-300 mb-0.5">
                      <span>HULL</span>
                      <span
                        className={
                          hud.hullPct < 35
                            ? 'text-red-400 font-bold'
                            : hud.hullPct < 70
                            ? 'text-amber-300 font-bold'
                            : 'text-emerald-400 font-bold'
                        }
                      >
                        {hud.hullPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mb-1">
                      <div
                        className={`h-full transition-[width] duration-75 ${
                          hud.hullPct < 35 ? 'bg-red-500' : hud.hullPct < 70 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${hud.hullPct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-x-1 text-[8px] font-mono-num text-slate-300 leading-tight">
                      <span className={hud.damage.leftWing < 0.7 ? 'text-amber-300 font-bold' : ''}>
                        LW {Math.round(hud.damage.leftWing * 100)}
                      </span>
                      <span className={hud.damage.rightWing < 0.7 ? 'text-amber-300 font-bold' : ''}>
                        RW {Math.round(hud.damage.rightWing * 100)}
                      </span>
                      <span className={hud.damage.tail < 0.7 ? 'text-amber-300 font-bold' : ''}>
                        TL {Math.round(hud.damage.tail * 100)}
                      </span>
                      <span className={hud.engineOverheated || hud.damage.engine < 0.7 ? 'text-orange-400 font-bold' : ''}>
                        ENG {Math.round(hud.damage.engine * 100)}
                      </span>
                      <span className={hud.gearBroken ? 'text-red-400 font-bold' : ''}>
                        GR {Math.round(hud.damage.gear * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-0.5 space-y-0.5 text-[9px] sm:text-[10px] font-mono-num border-t border-white/10">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">FLR [G]</span>
                  <span className="text-yellow-300 font-bold">{hud.flaresCount}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">HOOK [H]</span>
                  <span className={hud.tailhookDown ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {hud.tailhookDown ? 'DOWN' : 'UP'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">AIDS</span>
                  <span className="text-sky-300 font-bold">
                    {hud.autoLevel ? 'LVL' : 'MAN'}
                    {hud.flapsActive ? '·FLP' : ''}
                    {hud.papiSlope !== 'off' ? `·P:${hud.papiSlope.toUpperCase()}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">WX · {WEATHER_LABELS[hud.weatherCondition]}</span>
                  <span
                    className={
                      hud.weatherCondition === 'storm'
                        ? 'text-red-400 font-bold'
                        : hud.weatherCondition === 'foggy' || hud.weatherCondition === 'breezy'
                        ? 'text-amber-300 font-bold'
                        : 'text-emerald-300 font-bold'
                    }
                  >
                    {hud.windSpeedKmh}km/h · {String(hud.windDirDeg).padStart(3, '0')}°
                  </span>
                </div>
                {hud.hasMissiles && (
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={
                        hud.lockTargetName
                          ? 'text-red-400 font-bold truncate max-w-[105px] sm:max-w-[140px]'
                          : 'text-slate-400'
                      }
                    >
                      {hud.lockTargetName ? `LOCK: ${hud.lockTargetName}` : 'MSL [X]'}
                    </span>
                    <span className={missileReady ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                      {missileReady ? 'RDY' : `${hud.missileCooldownPct}%`}
                    </span>
                  </div>
                )}
                {hud.hasBombs && (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400">BOMB [B]</span>
                    <span className={bombReady ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                      {bombReady ? 'ARMED' : `${hud.bombCooldownPct}%`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : skydive ? (
            <div className="border-t border-white/12 pt-1 space-y-1">
              <div className="text-[10px] sm:text-xs font-bold text-orange-300">
                {hud.parachuteOpen ? 'PARACHUTE GLIDE' : 'FREEFALL SKYDIVE'}
              </div>
              <div className="grid grid-cols-3 gap-x-1.5 text-[10px] sm:text-xs font-mono-num">
                <div>
                  <span className="text-slate-400 text-[9px]">S </span>
                  <span className="font-bold">{hud.speedKmh}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">A </span>
                  <span className="font-bold">{hud.altitudeM}m</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px]">V </span>
                  <span className="font-bold">{hud.vsiMs}</span>
                </div>
              </div>
            </div>
          ) : hud.boarding ? (
            <div className="border-t border-white/12 pt-1 text-[10px] sm:text-[11px] text-amber-300 font-semibold text-right" dir="rtl">
              جارٍ الصعود للقمرة...
            </div>
          ) : (
            <div className="border-t border-white/12 pt-1 text-[10px] sm:text-[11px] text-slate-300 text-right" dir="rtl">
              وضع المشي · <kbd className="px-1 bg-white/15 rounded">F</kbd> ركوب
            </div>
          )}
        </div>
      </div>

      {/* Tactical Center Banners: Boss HP Bar / RWR Missile Alert / Tanker Aerial Refuel / Sonic Boom / Carrier Wire */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none max-w-[92vw] ${
          hud.boss.active ? 'top-13 sm:top-14' : 'top-20'
        }`}
      >
        {hud.boss.active && (
          <div
            dir="rtl"
            className="w-[min(88vw,430px)] px-3.5 py-2 rounded-xl bg-slate-950/92 border border-purple-500/75 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-extrabold mb-1.5">
              <div className="flex items-center gap-1.5 text-purple-200 truncate">
                <Zap className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                <span className="truncate">MEGATRON - زعيم السايبرترون</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono-num">
                <span className="px-1.5 py-0.5 rounded bg-purple-900/80 border border-purple-400/40 text-[9px] sm:text-[10px] text-purple-200">
                  {hud.boss.phase === 'storm'
                    ? 'عاصفة برقية'
                    : hud.boss.phase === 'entry'
                      ? 'نيزك ساقط'
                      : hud.boss.phase === 'transform'
                        ? 'تحوّل حركي'
                        : hud.boss.phase === 'dying'
                          ? 'انهيار الطاقة'
                          : hud.boss.mode === 'jet'
                            ? 'طائرة سايبرترون'
                            : 'آلي عملاق'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-300">
                  {hud.boss.distM}m
                </span>
                <span className="text-[10px] sm:text-[11px] text-fuchsia-300">
                  {hud.boss.hp} / {hud.boss.maxHp}
                </span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-900 border border-purple-400/40 overflow-hidden">
              <div
                className="h-full transition-[width] duration-100"
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100))}%`,
                  background: 'linear-gradient(90deg, #9333ea 0%, #db2777 55%, #ef4444 100%)',
                }}
              />
            </div>
          </div>
        )}

        {hud.boss.active && hud.boss.laserWarning && (
          <div className="px-4 py-1.5 rounded-xl border border-fuchsia-300 bg-fuchsia-950/95 text-fuchsia-100 text-xs sm:text-sm font-extrabold shadow-2xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>تحذير! مدفع الاندماج يستهدفك — ناور الآن!</span>
          </div>
        )}

        {fly && hud.missileAlert !== 'none' && (
          <div
            className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-extrabold shadow-2xl flex items-center gap-2 ${
              hud.missileAlert === 'incoming'
                ? 'bg-red-700/95 border-red-300 text-white'
                : 'bg-amber-600/92 border-amber-200 text-slate-950'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {hud.missileAlert === 'incoming'
                ? `تحذير! صاروخ قادم (${hud.incomingMissileDistM}م) — أطلق المشاعل [G]!`
                : 'إنذار قفل الرادار! (MISSILE LOCK)'}
            </span>
          </div>
        )}

        {fly && (hud.refuelConnected || hud.refuelAssist || hud.refuelDistanceM < 750 || hud.fuelPct < 30) && (
          <div
            className={`px-3.5 py-2 rounded-xl shadow-xl min-w-[264px] border transition-colors ${
              hud.refuelConnected
                ? 'bg-emerald-950/92 border-emerald-400 text-emerald-50 shadow-emerald-500/25'
                : hud.refuelAssist
                  ? 'bg-emerald-950/88 border-emerald-400/75 text-emerald-50'
                  : 'bg-slate-950/88 border-sky-400/50 text-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-xs font-bold mb-1">
              <span
                className={`flex items-center gap-1.5 ${
                  hud.refuelConnected || hud.refuelAssist ? 'text-emerald-300' : 'text-sky-300'
                }`}
              >
                <Fuel className="w-3.5 h-3.5" />
                {hud.refuelConnected
                  ? 'التحام مكتمل — شحن سريع (+15%/ث)'
                  : hud.refuelAssist
                    ? 'تثبيت السرعة مفعّل — مد خرطوم الوقود'
                    : 'طائرة الصهريج KC-46'}
              </span>
              <span className="font-mono-num text-[11px] text-slate-200">
                {hud.refuelDistanceM}m
              </span>
            </div>
            {hud.refuelConnected ? (
              <div className="space-y-1">
                <div className="h-2.5 rounded-full bg-emerald-950/85 border border-emerald-500/50 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-75"
                    style={{ width: `${hud.fuelPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono-num text-emerald-300">
                  <span>{hud.fuelPct >= 100 ? 'خزان الوقود ممتلئ 100%' : 'تثبيت تلقائي · جاري الشحن (+15%/ث)'}</span>
                  <span>{hud.fuelPct}%</span>
                </div>
              </div>
            ) : hud.refuelAssist || hud.refuelDockPct > 0 ? (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-emerald-950/70 border border-emerald-500/35 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-75"
                    style={{ width: `${hud.refuelDockPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono-num text-emerald-300">
                  <span>تمديد خرطوم الالتحام التلقائي</span>
                  <span>{hud.refuelDockPct}%</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-300 text-center">
                ادخل الحلقة الخضراء خلف الذيل (ضمن 60م) · 450 كم/س · 1500م
              </div>
            )}
          </div>
        )}

        {fly && hud.arrestedWire && (
          <div className="px-4 py-2 rounded-xl bg-emerald-600/95 border border-emerald-200 text-white text-xs sm:text-sm font-extrabold shadow-xl">
            تم الإمساك بكابل الإيقاف على الحاملة!
          </div>
        )}

        {fly && hud.bolterWarning && (
          <div className="px-4 py-2 rounded-xl bg-red-600/95 border border-red-200 text-white text-xs sm:text-sm font-extrabold shadow-xl">
            BOLTER! أخطأت كابل الإيقاف — ارفع الدفع فوراً للتحليق!
          </div>
        )}

        {fly && hud.sonicBoomFlash > 0.2 && (
          <div className="px-4 py-1.5 rounded-xl bg-sky-500/90 border border-white text-slate-950 text-xs sm:text-sm font-extrabold shadow-xl">
            اختراق حاجز الصوت! MACH {hud.machNumber.toFixed(2)}
          </div>
        )}
      </div>

      {/* Sami Speech Bubble */}
      {hud.bubble.visible && (
        <div
          className="fixed z-30 w-max max-w-[min(78vw,250px)] px-3.5 py-2 rounded-2xl bg-white text-slate-900 text-xs sm:text-sm font-semibold shadow-xl text-center pointer-events-none"
          style={
            hud.bubble.onScreen
              ? {
                  left: `clamp(130px, ${hud.bubble.x}px, calc(100vw - 130px))`,
                  top: `${Math.max(105, hud.bubble.y)}px`,
                  transform: 'translate(-50%, -100%)',
                }
              : {
                  left: '50%',
                  bottom: '92px',
                  transform: 'translateX(-50%)',
                }
          }
        >
          {hud.bubble.text}
        </div>
      )}

      {/* Sami Chat Drawer */}
      {chatOpen && (
        <div
          data-ui-interactive="true"
          className="pointer-events-auto fixed top-16 left-1/2 -translate-x-1/2 w-[min(92vw,400px)] rounded-2xl bg-slate-950/92 border border-white/15 shadow-2xl overflow-hidden z-40"
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/8 border-b border-white/10">
            <div>
              <span className="text-sm font-bold text-white">سامي</span>
              <span className="text-xs text-amber-300 mr-2">· {hud.samiMood}</span>
            </div>
            <button
              type="button"
              onClick={onToggleChat}
              className="text-slate-300 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={chatListRef}
            className="max-h-52 overflow-y-auto p-3 flex flex-col gap-2 text-sm"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`px-3 py-2 rounded-xl max-w-[86%] leading-relaxed ${
                  m.sender === 'sami'
                    ? 'bg-white text-slate-900 self-start'
                    : 'bg-emerald-400 text-slate-950 font-semibold self-end'
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onSendChat(cmd)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                {cmd}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitChat} className="flex items-center gap-2 p-2.5 border-t border-white/10">
            <input
              ref={chatInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتب أمراً أو رسالة لسامي..."
              className="flex-1 min-w-0 bg-white/10 text-white placeholder:text-slate-400 text-sm px-3 py-2 rounded-xl border border-white/10 outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Center Action Prompt */}
      {hud.promptText && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-xs sm:text-sm font-bold text-white shadow-xl text-center max-w-[86vw]">
          {hud.promptText}
        </div>
      )}

      {/* Crash Banner */}
      {hud.crashed && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 px-7 py-4 rounded-2xl bg-red-900/90 border border-red-400/40 text-xl sm:text-2xl font-extrabold text-white shadow-2xl">
          انفجرت الطائرة — جارٍ إعادة التجهيز...
        </div>
      )}

      {/* Concise Bottom Control Hint Bar (Desktop) */}
      {!isTouchDevice && hud.phase === 'playing' && (
        <div className="hidden sm:block fixed bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-slate-950/75 border border-white/10 text-[11px] text-slate-300 max-w-[94vw] truncate">
          {hud.boarding
            ? 'جارٍ الصعود إلى قمرة القيادة...'
            : fly
            ? 'W/S: الأنف · A/D: الالتفاف · Shift/C: الدفع · L: توازن · X: صاروخ · B: قصف · G: مشاعل · H: خطاف · F: قفز · V: القمرة'
            : skydive
            ? hud.parachuteOpen
              ? 'W: غوص سريع · S: فرملة هبوط (Flare) · A/D: التفاف يمين/يسار'
              : 'W: غوص هوائي عمودي · A/D: توجيه · Space: فتح المظلة'
            : 'WASD: المشي · Shift: جري سريع · Space: قفز · F: ركوب الطائرة · T: سامي · M: الخريطة'}
        </div>
      )}

      {/* Mobile Touch Controls */}
      {isTouchDevice && hud.phase === 'playing' && (
        <div data-ui-interactive="true" className="fixed inset-0 pointer-events-none" dir="ltr">
          {/* Virtual Analog Stick */}
          <div
            className="pointer-events-auto absolute left-4 bottom-6 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-950/45 border-2 border-white/30 touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              stickPtrId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const R = rect.width / 2 - 12;
              let dx = (e.clientX - (rect.left + rect.width / 2)) / R;
              let dy = (e.clientY - (rect.top + rect.height / 2)) / R;
              const m = Math.hypot(dx, dy);
              if (m > 1) {
                dx /= m;
                dy /= m;
              }
              if (stickKnobRef.current) {
                stickKnobRef.current.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
              }
              onAnalog(dx, -dy, true);
            }}
            onPointerMove={(e) => {
              if (e.pointerId !== stickPtrId.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const R = rect.width / 2 - 12;
              let dx = (e.clientX - (rect.left + rect.width / 2)) / R;
              let dy = (e.clientY - (rect.top + rect.height / 2)) / R;
              const m = Math.hypot(dx, dy);
              if (m > 1) {
                dx /= m;
                dy /= m;
              }
              if (stickKnobRef.current) {
                stickKnobRef.current.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
              }
              onAnalog(dx, -dy, true);
            }}
            onPointerUp={(e) => {
              if (e.pointerId !== stickPtrId.current) return;
              stickPtrId.current = -1;
              if (stickKnobRef.current) stickKnobRef.current.style.transform = '';
              onAnalog(0, 0, false);
            }}
            onPointerCancel={() => {
              stickPtrId.current = -1;
              if (stickKnobRef.current) stickKnobRef.current.style.transform = '';
              onAnalog(0, 0, false);
            }}
          >
            <div
              ref={stickKnobRef}
              className="absolute left-1/2 top-1/2 w-11 h-11 -ml-5.5 -mt-5.5 rounded-full bg-white/65 pointer-events-none"
            />
          </div>

          {/* Throttle Slider (Fly Mode) */}
          {fly && (
            <div
              className="pointer-events-auto absolute right-20 bottom-18 w-11 h-36 rounded-full bg-slate-950/50 border-2 border-white/30 overflow-hidden touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                thrPtrId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                onTouchThrottle(1 - (e.clientY - r.top) / r.height);
              }}
              onPointerMove={(e) => {
                if (e.pointerId !== thrPtrId.current) return;
                const r = e.currentTarget.getBoundingClientRect();
                onTouchThrottle(1 - (e.clientY - r.top) / r.height);
              }}
              onPointerUp={(e) => {
                if (e.pointerId === thrPtrId.current) thrPtrId.current = -1;
              }}
              onPointerCancel={(e) => {
                if (e.pointerId === thrPtrId.current) thrPtrId.current = -1;
              }}
            >
              <div
                className="absolute left-0 right-0 bottom-0 bg-emerald-400/75 pointer-events-none"
                style={{ height: `${hud.throttlePct}%` }}
              />
              <span className="absolute top-1.5 left-0 right-0 text-center text-[10px] font-bold text-white pointer-events-none">
                دفع
              </span>
            </div>
          )}

          {/* Rudder Slider (Fly Mode) */}
          {fly && (
            <div
              className="pointer-events-auto absolute right-4 bottom-4 w-36 h-10 rounded-full bg-slate-950/50 border-2 border-white/30 touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                rudPtrId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                const half = r.width / 2 - 18;
                const v = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / half));
                if (rudKnobRef.current) rudKnobRef.current.style.transform = `translateX(${v * half}px)`;
                onRudderAnalog(v);
              }}
              onPointerMove={(e) => {
                if (e.pointerId !== rudPtrId.current) return;
                const r = e.currentTarget.getBoundingClientRect();
                const half = r.width / 2 - 18;
                const v = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / half));
                if (rudKnobRef.current) rudKnobRef.current.style.transform = `translateX(${v * half}px)`;
                onRudderAnalog(v);
              }}
              onPointerUp={() => {
                rudPtrId.current = -1;
                if (rudKnobRef.current) rudKnobRef.current.style.transform = '';
                onRudderAnalog(0);
              }}
              onPointerCancel={() => {
                rudPtrId.current = -1;
                if (rudKnobRef.current) rudKnobRef.current.style.transform = '';
                onRudderAnalog(0);
              }}
            >
              <div
                ref={rudKnobRef}
                className="absolute left-1/2 top-1/2 w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/65 pointer-events-none"
              />
            </div>
          )}

          {/* Touch Missile Button (Fly Mode) */}
          {fly && hud.hasMissiles && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onFireMissile}
              className="pointer-events-auto touch-none absolute right-20 bottom-58 w-12 h-12 rounded-full bg-red-600/85 border border-white/35 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
            >
              <span>X</span>
              <span className="text-[10px]">صاروخ</span>
            </button>
          )}

          {/* Touch Bomb Button (Fly Mode) */}
          {fly && hud.hasBombs && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDropBomb}
              className="pointer-events-auto touch-none absolute right-35 bottom-18 w-12 h-12 rounded-full bg-amber-600/90 border border-amber-200/45 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
            >
              <Bomb className="w-4 h-4" />
              <span className="text-[10px]">قصف</span>
            </button>
          )}

          {/* Touch Flares Button (Fly Mode) */}
          {fly && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDeployFlares}
              className={`pointer-events-auto touch-none absolute right-35 bottom-35 w-12 h-12 rounded-full border text-xs font-bold flex flex-col items-center justify-center shadow-lg ${
                hud.missileAlert !== 'none'
                  ? 'bg-yellow-400 border-white text-slate-950'
                  : 'bg-yellow-600/90 border-yellow-200/50 text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span className="text-[9px]">مشاعل</span>
            </button>
          )}

          {/* Touch Tailhook Button (Fly Mode) */}
          {fly && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleTailhook}
              className={`pointer-events-auto touch-none absolute right-35 bottom-52 w-12 h-12 rounded-full border text-xs font-bold flex flex-col items-center justify-center shadow-lg ${
                hud.tailhookDown
                  ? 'bg-emerald-500 border-emerald-200 text-slate-950'
                  : 'bg-slate-950/75 border-white/30 text-white'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span className="text-[9px]">خطاف</span>
            </button>
          )}

          {/* Touch Sprint/Run Toggle Button (Walk Mode) */}
          {walk && !hud.boarding && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const next = !sprintOn;
                setSprintOn(next);
                onVirtualKey('ShiftLeft', next);
              }}
              className={`pointer-events-auto touch-none absolute right-20 bottom-18 w-14 h-14 rounded-full border text-xs font-extrabold flex flex-col items-center justify-center shadow-lg transition-colors ${
                sprintOn
                  ? 'bg-amber-500 border-amber-200 text-slate-950'
                  : 'bg-slate-950/70 border-white/30 text-white'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span className="text-[10px]">{sprintOn ? 'جري ✓' : 'جري'}</span>
            </button>
          )}

          {/* Touch Board / Bailout Button */}
          {!hud.boarding && !skydive && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleBoard}
              className="pointer-events-auto touch-none absolute right-4 bottom-36 w-14 h-14 rounded-full bg-emerald-700/85 border border-white/30 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
            >
              <span>F</span>
              <span className="text-[10px]">{fly ? (hud.onGround ? 'نزول' : 'قفز جو') : 'ركوب'}</span>
            </button>
          )}

          {/* Touch Brake / Jump / Parachute Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (skydive) onDeployParachute();
              else onVirtualKey('Space', true);
            }}
            onPointerUp={() => onVirtualKey('Space', false)}
            onPointerCancel={() => onVirtualKey('Space', false)}
            className={`pointer-events-auto touch-none absolute right-4 bottom-18 w-14 h-14 rounded-full border text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg ${
              skydive && !hud.parachuteOpen
                ? 'bg-orange-500 border-orange-200 text-slate-950'
                : 'bg-slate-950/70 border-white/30 text-white'
            }`}
          >
            <span>⎵</span>
            <span className="text-[10px]">{fly ? 'فرامل' : skydive ? 'مظلة' : 'قفز'}</span>
          </button>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <div
          data-ui-interactive="true"
          className="pointer-events-auto fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white">إيقاف مؤقت</h2>
              <span className="text-xs text-amber-400 font-semibold">{hud.aircraftNameAr}</span>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <div><strong className="text-white">W / S:</strong> رفع وخفض الأنف (أو المشي وتوجيه المظلة)</div>
              <div><strong className="text-white">A / D:</strong> الميلان والالتفاف · <strong className="text-white">Q / E:</strong> توجيه الدفة</div>
              <div><strong className="text-white">Shift / C:</strong> زيادة وتقليل الدفع (أو جري سريع سيراً)</div>
              <div><strong className="text-white">X / B:</strong> صاروخ تتبعي / إلقاء القنابل · <strong className="text-white">G:</strong> إطلاق المشاعل</div>
              <div><strong className="text-white">H / V:</strong> خطاف حاملة الطائرات / تبديل القمرة · <strong className="text-white">L:</strong> توازن تلقائي · <strong className="text-white">F:</strong> قفز بالمظلة · <strong className="text-white">K:</strong> استدعاء ميغاترون</div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer"
              >
                متابعة الطيران
              </button>
              <button
                type="button"
                onClick={onToggleFastMode}
                className={`w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer ${
                  fastMode
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {fastMode ? 'وضع الأداء الفائق (60 FPS): مفعل' : 'تفعيل وضع الأداء الفائق (إيقاف الظلال)'}
              </button>
              <button
                type="button"
                onClick={onResetRunway}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm cursor-pointer"
              >
                إعادة الإقلاع من المدرج
              </button>
              <button
                type="button"
                onClick={onOpenLobby}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-amber-300 font-bold text-sm cursor-pointer"
              >
                العودة إلى لوبي الطائرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
