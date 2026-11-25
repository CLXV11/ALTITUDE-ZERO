import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Plane,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
  Footprints,
  Target,
} from 'lucide-react';
import { AIRCRAFT_CONFIGS } from '../engine/aircraftConfigs';
import { MISSION_OPTIONS } from '../engine/missionSystem';
import type { AircraftId, MissionId, SpawnMode, TimeOfDay } from '../types/flight';

interface LobbyOverlayProps {
  selectedId: AircraftId;
  missionId: MissionId;
  timeOfDay: TimeOfDay;
  spawnMode: SpawnMode;
  muted: boolean;
  fastMode: boolean;
  onSelectAircraft: (id: AircraftId) => void;
  onSelectMission: (id: MissionId) => void;
  onSelectTimeOfDay: (tod: TimeOfDay) => void;
  onSelectSpawnMode: (mode: SpawnMode) => void;
  onToggleMute: () => void;
  onToggleFastMode: () => void;
  onStartFlight: () => void;
}

const TIME_OPTIONS: { id: TimeOfDay; label: string; icon: React.ReactNode }[] = [
  { id: 'dawn', label: 'شروق', icon: <Sunrise className="w-3.5 h-3.5" /> },
  { id: 'noon', label: 'نهار', icon: <Sun className="w-3.5 h-3.5" /> },
  { id: 'dusk', label: 'غروب', icon: <Sunset className="w-3.5 h-3.5" /> },
  { id: 'night', label: 'ليل', icon: <Moon className="w-3.5 h-3.5" /> },
];

export const LobbyOverlay: React.FC<LobbyOverlayProps> = ({
  selectedId,
  missionId,
  timeOfDay,
  spawnMode,
  muted,
  fastMode,
  onSelectAircraft,
  onSelectMission,
  onSelectTimeOfDay,
  onSelectSpawnMode,
  onToggleMute,
  onToggleFastMode,
  onStartFlight,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const selected = AIRCRAFT_CONFIGS.find((a) => a.id === selectedId) || AIRCRAFT_CONFIGS[0];

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6"
      dir="rtl"
    >
      {/* Top Bar: Brand Lockup & Atmosphere Selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div
          data-ui-interactive="true"
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-950/85 border border-white/12 shadow-lg"
        >
          <svg
            viewBox="0 0 40 40"
            className="w-9 h-9 text-amber-400 shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 21L17 17L20 6L23 17L36 21L23 23L26 32L20 27L14 32L17 23L4 21Z"
              fill="currentColor"
              fillOpacity="0.9"
            />
          </svg>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
              أفق السماء
            </h1>
            <p className="text-xs text-slate-300">
              لوبي الطائرات · اسحب للتدوير 360°
            </p>
          </div>
        </div>

        <div
          data-ui-interactive="true"
          className="pointer-events-auto flex items-center gap-2"
        >
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 border border-white/12 shadow-lg">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTimeOfDay(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  timeOfDay === t.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFastMode}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors shadow-lg cursor-pointer whitespace-nowrap ${
              fastMode
                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                : 'bg-slate-950/85 border-white/12 text-slate-200 hover:text-white hover:bg-slate-900'
            }`}
          >
            {fastMode ? 'أداء فائق: مفعل' : 'أداء فائق'}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="p-2.5 rounded-xl bg-slate-950/85 border border-white/12 text-slate-200 hover:text-white hover:bg-slate-900 transition-colors shadow-lg cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom Collapsible Hangar Dock */}
      <div className="flex flex-col items-center w-full">
        <button
          type="button"
          data-ui-interactive="true"
          onClick={() => setCollapsed((v) => !v)}
          className="pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg bg-slate-950/85 border border-b-0 border-white/15 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{collapsed ? 'إظهار لوحة الطائرات' : 'إخفاء اللوحة للمعاينة'}</span>
        </button>

        {!collapsed && (
          <div
            data-ui-interactive="true"
            className="pointer-events-auto w-full max-w-6xl rounded-2xl bg-slate-950/88 border border-white/15 p-3.5 sm:p-4 shadow-2xl"
          >
            {/* Selected Aircraft Info & Launch Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 mb-3 border-b border-white/10">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
                  <span>{selected.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-slate-300">{selected.nameEn}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  {selected.nameAr}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {selected.description}
                </p>
              </div>

              {/* 4 Tabular Spec Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right shrink-0">
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/8">
                  <div className="text-[11px] text-slate-400">السرعة القصوى</div>
                  <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                    {selected.maxSpeedLabel}
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/8">
                  <div className="text-[11px] text-slate-400">باع الجناح</div>
                  <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                    {selected.wingspanLabel}
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/8">
                  <div className="text-[11px] text-slate-400">سقف التحليق</div>
                  <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                    {selected.ceilingLabel}
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/8">
                  <div className="text-[11px] text-slate-400">المحرك</div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate max-w-[130px]">
                    {selected.engineLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* 15 Aircraft Type Cards (Compact 3x5 Hangar Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 mb-3 max-h-[22vh] sm:max-h-none overflow-y-auto pr-0.5">
              {AIRCRAFT_CONFIGS.map((ac) => {
                const active = ac.id === selectedId;
                return (
                  <button
                    key={ac.id}
                    type="button"
                    onClick={() => onSelectAircraft(ac.id)}
                    className={`text-right px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500/22 border-amber-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] text-amber-300 font-semibold truncate">
                        {ac.category}
                      </span>
                      <span className="font-mono-num text-[10px] text-slate-400">
                        {ac.mapLabel}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate">
                      {ac.nameAr}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 5-Mission Selector Strip */}
            <div className="flex items-center gap-1.5 flex-wrap pb-2.5 mb-2.5 border-b border-white/10">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 ml-1">
                <Target className="w-3.5 h-3.5" />
                <span>المهمة:</span>
              </span>
              {MISSION_OPTIONS.map((m) => {
                const active = m.id === missionId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={m.descAr}
                    onClick={() => onSelectMission(m.id)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-500 border-sky-300 text-slate-950 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {m.titleAr}
                  </button>
                );
              })}
            </div>

            {/* Bottom Action Bar: Spawn Mode & Start CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 self-start">
                <button
                  type="button"
                  onClick={() => onSelectSpawnMode('cockpit')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    spawnMode === 'cockpit'
                      ? 'bg-slate-800 text-white border border-white/15'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>إقلاع مباشر من المدرج</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSpawnMode('walk')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    spawnMode === 'walk'
                      ? 'bg-slate-800 text-white border border-white/15'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>التجول في المطار أولاً</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Compass className="w-3.5 h-3.5" />
                  <span>المطار الدولي · القاعدة الجبلية · حاملة الطائرات · جزيرة المدرج</span>
                </span>
                <button
                  type="button"
                  onClick={onStartFlight}
                  className="px-7 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm sm:text-base transition-colors whitespace-nowrap cursor-pointer shadow-lg"
                >
                  ابدأ الطيران الآن
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

