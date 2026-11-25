import { useCallback, useEffect, useRef, useState } from 'react';
import { FlightHud } from './components/FlightHud';
import { LobbyOverlay } from './components/LobbyOverlay';
import { FlightEngine } from './engine/FlightEngine';
import type {
  AircraftId,
  ChatMessage,
  HudSnapshot,
  MissionId,
  SpawnMode,
  TimeOfDay,
} from './types/flight';

const INITIAL_HUD: HudSnapshot = {
  phase: 'lobby',
  mode: 'walk',
  cameraMode: 'chase',
  aircraftId: 'f18',
  aircraftNameAr: 'F/A-18E سوبر هورنت',
  aircraftNameEn: 'F/A-18E Super Hornet',
  hasMissiles: true,
  missileCooldownPct: 100,
  hasBombs: true,
  bombCooldownPct: 100,
  flaresCount: 24,
  flareCooldownPct: 100,
  missileAlert: 'none',
  incomingMissileDistM: 0,
  tailhookDown: false,
  nearCarrierDistM: 1850,
  arrestedWire: false,
  bolterWarning: false,
  fuelPct: 100,
  refuelDistanceM: 1600,
  refuelAssist: false,
  refuelDockPct: 0,
  refuelConnected: false,
  refuelProgressPct: 0,
  gForce: 1.0,
  machNumber: 0,
  supersonic: false,
  sonicBoomFlash: 0,
  pitchDeg: 0,
  rollDeg: 0,
  aoaDeg: 0,
  fpmOffsetX: 0,
  fpmOffsetY: 0,
  lockScreenX: 0.5,
  lockScreenY: 0.5,
  lockOnScreen: false,
  lockDistM: 0,
  lockTargetName: '',
  parachuteOpen: false,
  boarding: false,
  hullPct: 100,
  damage: {
    leftWing: 1.0,
    rightWing: 1.0,
    tail: 1.0,
    engine: 1.0,
    gear: 1.0,
  },
  engineOverheated: false,
  gearBroken: false,
  speedKmh: 0,
  speedKnots: 0,
  altitudeM: 0,
  vsiMs: 0,
  headingDeg: 0,
  throttlePct: 0,
  spoolPct: 0,
  afterburner: false,
  stall: false,
  onGround: true,
  crashed: false,
  autoLevel: true,
  flapsActive: false,
  papiSlope: 'off',
  weatherCondition: 'clear',
  windSpeedKmh: 13,
  windDirDeg: 119,
  turbulencePct: 12,
  fps: 60,
  promptText: '',
  samiMood: 'واثق',
  samiStatus: 'أنتظرك في المطار',
  stats: {
    player: { alt: 0, spd: 0, land: 0, crash: 0, rings: 0 },
    sami: { alt: 0, spd: 0, land: 0, crash: 0, rings: 0 },
  },
  ringsCollected: 0,
  totalRings: 16,
  mission: {
    id: 'rings',
    titleAr: 'سباق الحلقات الجوي',
    objectiveAr: 'توجّه نحو الحلقة 1 من 16',
    progress: 0,
    target: 16,
    completed: false,
    targetX: 0,
    targetY: 95,
    targetZ: -450,
    distM: 590,
    bearingDeg: 0,
  },
  bubble: { visible: false, text: '', x: 0, y: 0, onScreen: false },
  nearestAirportDistM: 0,
  boss: {
    active: false,
    phase: 'idle',
    mode: 'jet',
    hp: 5000,
    maxHp: 5000,
    distM: 0,
    onScreen: false,
    screenX: 0.5,
    screenY: 0.5,
    lockedByPlayer: false,
    laserWarning: false,
  },
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FlightEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftId>('f18');
  const [selectedMission, setSelectedMission] = useState<MissionId>('rings');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('noon');
  const [spawnMode, setSpawnMode] = useState<SpawnMode>('cockpit');
  const [muted, setMuted] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'sami',
      text: 'أهلاً بك يا كابتن! أنا سامي، منافسك في سماء المطار. اختر طائرتك ومهمتك وهيا نقلع!',
    },
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new FlightEngine(
      container,
      (snapshot) => setHud(snapshot),
      (samiText) => {
        setMessages((prev) => [
          ...prev.slice(-40),
          { id: `s-${Date.now()}-${Math.random()}`, sender: 'sami', text: samiText },
        ]);
      },
      (lost) => setContextLost(lost)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectAircraft = useCallback((id: AircraftId) => {
    setSelectedAircraft(id);
    engineRef.current?.selectLobbyAircraft(id);
  }, []);

  const handleSelectMission = useCallback((id: MissionId) => {
    setSelectedMission(id);
    engineRef.current?.selectMission(id);
  }, []);

  const handleCycleMission = useCallback(() => {
    const next = engineRef.current?.cycleMission();
    if (next) setSelectedMission(next);
  }, []);

  const handleSelectTimeOfDay = useCallback((tod: TimeOfDay) => {
    setTimeOfDay(tod);
    engineRef.current?.setTimeOfDay(tod);
  }, []);

  const handleStartFlight = useCallback(() => {
    setChatOpen(false);
    setMapExpanded(false);
    engineRef.current?.selectMission(selectedMission);
    engineRef.current?.startFromLobby(selectedAircraft, spawnMode);
  }, [selectedAircraft, selectedMission, spawnMode]);

  const handleOpenLobby = useCallback(() => {
    setChatOpen(false);
    setMapExpanded(false);
    engineRef.current?.openLobby();
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.audio.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleFastMode = useCallback(() => {
    setFastMode((prev) => {
      const next = !prev;
      engineRef.current?.setPerformanceMode(next);
      return next;
    });
  }, []);

  const handleToggleMapExpanded = useCallback(() => {
    setMapExpanded((prev) => {
      const next = !prev;
      engineRef.current?.setMapExpanded(next);
      return next;
    });
  }, []);

  const handleSendChat = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev.slice(-40),
      { id: `p-${Date.now()}`, sender: 'player', text },
    ]);
    const res = engineRef.current?.sendChatToSami(text);
    if (res?.reply) {
      setMessages((prev) => [
        ...prev.slice(-40),
        { id: `s-${Date.now()}-${Math.random()}`, sender: 'sami', text: res.reply },
      ]);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') {
          setChatOpen(false);
        }
        return;
      }

      if (hud.phase === 'lobby' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        handleStartFlight();
        return;
      }

      if (e.code === 'Escape' && !e.repeat) {
        if (chatOpen) {
          setChatOpen(false);
        } else if (mapExpanded) {
          handleToggleMapExpanded();
        } else if (hud.phase === 'playing') {
          engineRef.current?.setPhase('paused');
        } else if (hud.phase === 'paused') {
          engineRef.current?.setPhase('playing');
        }
        return;
      }

      if (hud.phase === 'playing' && !e.repeat) {
        if (e.code === 'KeyT') {
          e.preventDefault();
          setChatOpen((v) => !v);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          handleToggleMapExpanded();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, chatOpen, mapExpanded, handleStartFlight, handleToggleMapExpanded]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL Viewport */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">تم تعليق العرض ثلاثي الأبعاد مؤقتاً</h2>
          <p className="text-sm text-slate-300">يرجى الانتظار ريثما تتم استعادة سياق WebGL...</p>
        </div>
      )}

      {/* Hangar Lobby Overlay */}
      {hud.phase === 'lobby' && (
        <LobbyOverlay
          selectedId={selectedAircraft}
          missionId={selectedMission}
          timeOfDay={timeOfDay}
          spawnMode={spawnMode}
          muted={muted}
          fastMode={fastMode}
          onSelectAircraft={handleSelectAircraft}
          onSelectMission={handleSelectMission}
          onSelectTimeOfDay={handleSelectTimeOfDay}
          onSelectSpawnMode={setSpawnMode}
          onToggleMute={handleToggleMute}
          onToggleFastMode={handleToggleFastMode}
          onStartFlight={handleStartFlight}
        />
      )}

      {/* Live Flight / Walk HUD */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <FlightHud
          hud={hud}
          muted={muted}
          fastMode={fastMode}
          chatOpen={chatOpen}
          messages={messages}
          mapExpanded={mapExpanded}
          onSetMinimapCanvas={(el) => engineRef.current?.setMinimapCanvas(el)}
          onCycleMapZoom={() => engineRef.current?.cycleMapZoom()}
          onToggleMapExpanded={handleToggleMapExpanded}
          onToggleChat={() => setChatOpen((v) => !v)}
          onSendChat={handleSendChat}
          onCycleCamera={() => engineRef.current?.cycleCameraMode()}
          onToggleAutoLevel={() => engineRef.current?.toggleAutoLevel()}
          onCycleMission={handleCycleMission}
          onToggleMute={handleToggleMute}
          onToggleFastMode={handleToggleFastMode}
          onResetRunway={() => engineRef.current?.resetToRunway()}
          onOpenLobby={handleOpenLobby}
          onResume={() => engineRef.current?.setPhase('playing')}
          onPause={() => engineRef.current?.setPhase('paused')}
          onToggleBoard={() => engineRef.current?.toggleBoard()}
          onFireMissile={() => engineRef.current?.fireMissile()}
          onDropBomb={() => engineRef.current?.dropBomb()}
          onDeployFlares={() => engineRef.current?.deployFlares()}
          onToggleTailhook={() => engineRef.current?.toggleTailhook()}
          onDeployParachute={() => engineRef.current?.deployParachute()}
          onSummonMegatron={() => engineRef.current?.summonMegatron()}
          onVirtualKey={(code, down) => engineRef.current?.setVirtualKey(code, down)}
          onAnalog={(x, y, on) => engineRef.current?.setAnalog(x, y, on)}
          onRudderAnalog={(v) => engineRef.current?.setRudderAnalog(v)}
          onTouchThrottle={(t) => engineRef.current?.setTouchThrottle(t)}
        />
      )}
    </div>
  );
}

