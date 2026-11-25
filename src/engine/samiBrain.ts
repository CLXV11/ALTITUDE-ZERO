import * as THREE from 'three';
import type { AircraftId, AircraftInstance, AutopilotState, PlayerMode } from '../types/flight';

export type SamiAction =
  | 'none'
  | 'fly_small'
  | 'fly_f16'
  | 'fly_f18'
  | 'fly_f35'
  | 'fly_f117'
  | 'fly_sukhoi'
  | 'fly_b2'
  | 'fly_concorde'
  | 'fly_sr71'
  | 'fly_airliner'
  | 'fly_biplane'
  | 'fly_f22'
  | 'fly_a10'
  | 'fly_rafale'
  | 'fly_hercules'
  | 'land'
  | 'return'
  | 'ride'
  | 'follow'
  | 'jump'
  | 'away'
  | 'come'
  | 'circle'
  | 'record_alt'
  | 'record_speed';

export interface SamiState {
  p: THREE.Vector3;
  yaw: number;
  anim: number;
  mv: boolean;
  tg: THREE.Vector3;
  wait: number;
  st: 'idle' | 'walk' | 'go' | 'pilot' | 'ride';
  ac: AircraftInstance | null;
  hold: number;
  vy: number;
  jn: number;
  then: AutopilotState['ph'] | null;
  wt: number;
  hh: number;
  seek: boolean;
  rode: boolean;
  mood: string;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

export function parseSamiCommand(text: string): SamiAction {
  const t = text.trim();
  const has = (list: string[]) => list.some((s) => t.includes(s));

  if (has(['اصعد', 'اركب', 'اطلع', 'تعال']) && has(['معي', 'معيا', 'بجانبي'])) return 'ride';
  if (has(['الحقني', 'الحق', 'اتبعني', 'تبعني', 'لحق', 'رافقني'])) return 'follow';
  if (has(['ارجع', 'رجع', 'عود', 'عد']) && has(['اقلع', 'قلع', 'مكان', 'المطار', 'القاعدة'])) return 'return';
  if (has(['انزل', 'اهبط', 'هبط', 'هبوط', 'land'])) return 'land';
  if (has(['اقفز', 'نط', 'قفز', 'jump'])) return 'jump';
  if (has(['ابتعد', 'بعيد', 'روح'])) return 'away';
  if (has(['تعال', 'اقترب', 'هنا'])) return 'come';
  if (has(['لف', 'دور', 'دوّر', 'دائرة', 'circle'])) return 'circle';
  if (has(['ارتفاع', 'سقف', 'أعلى'])) return 'record_alt';
  if (has(['سرعة', 'أسرع', 'سباق'])) return 'record_speed';
  if (has(['سوق', 'طير', 'حلق', 'اقلع', 'قلع', 'fly'])) {
    if (has(['f18', 'F-18', 'F/A-18', 'هورنت', 'سوبر هورنت'])) return 'fly_f18';
    if (has(['f35', 'F-35', 'لايتنينغ', 'الشبح F-35'])) return 'fly_f35';
    if (has(['f117', 'F-117', 'f-117', 'نايت هوك', 'هوك'])) return 'fly_f117';
    if (has(['b2', 'B-2', 'b-2', 'شبحية', 'سبيريت'])) return 'fly_b2';
    if (has(['f22', 'F-22', 'f-22', 'رابتور'])) return 'fly_f22';
    if (has(['a10', 'A-10', 'a-10', 'ثاندر', 'قصف'])) return 'fly_a10';
    if (has(['رافال', 'rafale'])) return 'fly_rafale';
    if (has(['صوخوي', 'سوخوي', 'سو', 'su35', 'su-35', 'sukhoi', 'فلانكر'])) return 'fly_sukhoi';
    if (has(['كونكورد', 'concorde'])) return 'fly_concorde';
    if (has(['sr71', 'sr-71', 'بلاكبيرد', 'استطلاع'])) return 'fly_sr71';
    if (has(['هيركوليز', 'شحن', 'نقل', 'c130', 'C-130'])) return 'fly_hercules';
    if (has(['سطحين', 'مجنح', 'بهلوان', 'biplane', 'بيتس'])) return 'fly_biplane';
    if (has(['ركاب', 'بوينغ', 'مدني', '787', 'airliner'])) return 'fly_airliner';
    if (has(['حربي', 'مقاتل', 'f16', 'F-16', 'f-16', 'فالكون'])) return 'fly_f16';
    return 'fly_small';
  }
  return 'none';
}

export function buildSamiChatReply(text: string, action: SamiAction, playerAircraftName: string, samiStatus: string): { reply: string; mood: string } {
  const t = text.trim();
  if (action === 'ride') {
    return { reply: 'موافق تماماً! سأصعد بجانبك الآن، أرني مهاراتك في الإقلاع.', mood: 'متحمس' };
  }
  if (action === 'follow') {
    return { reply: 'حسناً! سأقلع بطائرتي وأطير في تشكيل جوي بجانبك مباشرة.', mood: 'منافس' };
  }
  if (action === 'fly_f18') {
    return { reply: 'F/A-18E سوبر هورنت! اختيار بحري رائع، سأقلع وأستعد للهبوط على حاملة الطائرات.', mood: 'واثق' };
  }
  if (action === 'fly_f35') {
    return { reply: 'الشبح F-35C لايتنينغ! أحدث مقاتلة شبحية بحرية جاهزة للتحليق الآن.', mood: 'غامض' };
  }
  if (action === 'fly_f117') {
    return { reply: 'الشبح F-117A نايت هوك! أسطورة القصف الشبحي المضلع جاهزة للتحليق الليلي.', mood: 'غامض' };
  }
  if (action === 'fly_b2') {
    return { reply: 'القاذفة الشبحية B-2 سبيريت! سأقلع بها وأختفي عن شاشات الرادار.', mood: 'غامض' };
  }
  if (action === 'fly_f22') {
    return { reply: 'المقاتلة الشبحية F-22 رابتور! سأسيطر على السماء بسرعة ومناورة فائقة.', mood: 'واثق' };
  }
  if (action === 'fly_a10') {
    return { reply: 'طائرة الدعم الأرضي A-10 ثاندر بولت! جاهزة للقصف الدقيق!', mood: 'جريء' };
  }
  if (action === 'fly_rafale') {
    return { reply: 'المقاتلة رافال بجنيحاتها الأمامية الرشيقة! هيا إلى السماء.', mood: 'متحمس' };
  }
  if (action === 'fly_sukhoi') {
    return { reply: 'صوخوي Su-35! استعد لمشاهدة الدفع الموجه والصعود العمودي الحاد!', mood: 'جريء' };
  }
  if (action === 'fly_concorde') {
    return { reply: 'كونكورد الأسرع من الصوت! سأكسر حاجز الصوت فوق المحيط.', mood: 'متحمس' };
  }
  if (action === 'fly_sr71') {
    return { reply: 'الطائرة الخارقة SR-71 بلاكبيرد! لا أحد يستطيع اللحاق بي على ارتفاع شاهق.', mood: 'واثق' };
  }
  if (action === 'fly_f16') {
    return { reply: 'سأستقل المقاتلة F-16 الآن! استعد لمشاهدة الحارق اللاحق.', mood: 'جريء' };
  }
  if (action === 'fly_airliner') {
    return { reply: 'سأتولى قيادة طائرة الركاب بوينغ 787، رحلة هادئة ومهيبة!', mood: 'مركز' };
  }
  if (action === 'fly_hercules') {
    return { reply: 'سأحلق بطائرة النقل C-130 هيركوليز ذات الأربعة محركات.', mood: 'واثق' };
  }
  if (action === 'fly_biplane') {
    return { reply: 'الطائرة البهلوانية ذات السطحين! حان وقت الاستعراض الجوي.', mood: 'مرح' };
  }
  if (action === 'fly_small') {
    return { reply: 'حسناً، سأقلع بطائرة السيسنا الخفيفة في جولة حول المطار.', mood: 'رايق' };
  }
  if (action === 'land' || action === 'return') {
    return { reply: 'علم، سأبدأ إجراءات الاقتراب والهبوط على المدرج الرئيسي 36L.', mood: 'منضبط' };
  }
  if (action === 'circle') {
    return { reply: 'سأحافظ على مسار دائري فوق المطار وأراقبك من الأعلى.', mood: 'يقظ' };
  }
  if (action === 'record_alt') {
    return { reply: 'تحدّي الارتفاع؟ سأصعد إلى أقصى سقف ممكن لأكسر رقمك!', mood: 'متحدٍ' };
  }
  if (action === 'record_speed') {
    return { reply: 'تحدي السرعة! سأدفع المحرك إلى أقصى طاقة الآن.', mood: 'متحمس' };
  }
  if (action === 'jump') {
    return { reply: 'ههه! قفزة سريعة لإحماء العضلات قبل الطيران.', mood: 'مازح' };
  }
  if (action === 'come') {
    return { reply: 'أنا قادم إليك الآن على ساحة المطار.', mood: 'ودود' };
  }
  if (action === 'away') {
    return { reply: 'حسناً، سأبتعد قليلاً لأترك لك مساحة كافية للإقلاع.', mood: 'متفهم' };
  }
  if (t.includes('مرحبا') || t.includes('سلام') || t.includes('هلا') || t.includes('أهلا')) {
    return { reply: `أهلاً بك يا كابتن! لدينا 15 طائرة نفاثة ومدنية جاهزة، وأنا ${samiStatus}. هل تتحداني في المهام؟`, mood: 'مرحب' };
  }
  if (t.includes('كيف') || t.includes('مساعدة') || t.includes('تحكم')) {
    return { reply: 'W/S: الأنف، A/D: الالتفاف، L: توازن تلقائي، X: صاروخ، B: قصف، H: خطاف الحاملة، F: ركوب/قفز بالمظلة!', mood: 'ناصح' };
  }
  if (t.includes('جزيرة') || t.includes('حاملة') || t.includes('جبال') || t.includes('قاعدة')) {
    return { reply: 'جرّب التحليق شرقاً نحو حاملة الطائرات وجزيرة المدرج، أو شمال غرب نحو القاعدة الجبلية المتقدمة!', mood: 'مستكشف' };
  }
  return {
    reply: `سمعتك جيداً! قل لي "حلق بسوبر هورنت" أو "حلق بـ F-35" أو "الحقني" بينما تقود ${playerAircraftName}.`,
    mood: 'متفاعل',
  };
}

export function stepAutopilot(
  a: AircraftInstance,
  mode: PlayerMode,
  playerAircraft: AircraftInstance,
  manPos: THREE.Vector3
): void {
  const c = a.config;
  const ai = a.ai;
  if (!ai) return;
  const inp = a.inp;
  const fw = _v1.set(0, 0, -1).applyQuaternion(a.q);
  const rt = _v2.set(1, 0, 0).applyQuaternion(a.q);
  const hdg = Math.atan2(-fw.x, -fw.z);
  const pitchCur = Math.asin(THREE.MathUtils.clamp(fw.y, -1, 1));
  const bankL = Math.asin(THREE.MathUtils.clamp(rt.y, -1, 1));
  const alt = a.p.y - c.y0;
  const sp = a.v.length();
  const P = c.ap;
  const toward = (x: number, z: number) => Math.atan2(-(x - a.p.x), -(z - a.p.z));

  let hT = 0;
  let vsd = 0;
  let spd = P.vt;
  let base = 0.55;
  let idle = false;
  inp.brake = 0;

  // Fixed-Wing Autopilot
  if (ai.ph === 'takeoff') {
    if (a.ground) {
      const he = wrapAngle(-hdg);
      inp.thr = Math.abs(he) < 0.7 ? 1 : 0.42;
      inp.p = a.fwd > c.rot * 0.95 ? 0.55 : 0;
      inp.r = 0;
      inp.y = THREE.MathUtils.clamp(he * 2.1, -1, 1);
      return;
    }
    ai.ph = 'climb';
  }

  if (ai.ph === 'climb') {
    vsd = P.vc;
    spd = P.cs;
    base = 0.82;
    if (alt > P.tAlt - 15 || (ai.then === 'approach' && alt > 30)) {
      ai.ph = ai.then || 'cruise';
    }
  } else if (ai.ph === 'cruise') {
    const wx = 0;
    const wz = ai.i ? 600 : -P.L;
    hT = toward(wx, wz);
    vsd = THREE.MathUtils.clamp((P.tAlt - alt) * 0.2, -P.vc, P.vc);
    if ((wx - a.p.x) * fw.x + (wz - a.p.z) * fw.z < 0) ai.i ^= 1;
  } else if (ai.ph === 'taxi') {
    const fr = ai.from;
    const dist = Math.hypot(fr.x - a.p.x, fr.z - a.p.z);
    const he = wrapAngle(toward(fr.x, fr.z) - hdg);
    inp.p = 0;
    inp.r = 0;
    inp.y = THREE.MathUtils.clamp(he * 2, -1, 1);
    const st = dist < 12 ? 0 : dist < 50 ? 3.5 : 7;
    inp.thr = st ? THREE.MathUtils.clamp(0.4 / c.T + (st - sp) * 0.05, 0, 0.6) : 0;
    inp.brake = dist < 12 || sp > st + 3 ? 1 : 0;
    return;
  } else if (ai.ph === 'follow') {
    const pp = mode === 'fly' && playerAircraft !== a ? playerAircraft : null;
    if (pp) {
      const pf = _v3.set(0, 0, -1).applyQuaternion(pp.q);
      const pr = _v4.set(1, 0, 0).applyQuaternion(pp.q);
      const tx = pp.p.x + pr.x * 30 - pf.x * 26;
      const tz = pp.p.z + pr.z * 30 - pf.z * 26;
      const dist = Math.hypot(tx - a.p.x, tz - a.p.z);
      hT = toward(tx, tz);
      const tA = Math.max(65, pp.p.y - pp.config.y0 + 5);
      vsd = THREE.MathUtils.clamp((tA - alt) * 0.25, -P.vc * 2, P.vc * 2);
      spd = THREE.MathUtils.clamp(pp.v.length() + (dist - 32) * 0.1, P.vap, c.vmax * 0.9);
    } else {
      hT = toward(manPos.x, manPos.z);
      vsd = THREE.MathUtils.clamp((130 - alt) * 0.2, -P.vc, P.vc);
      spd = P.vt;
    }
  } else if (ai.ph === 'recalt') {
    hT = 0;
    vsd = P.vc * 1.3;
    spd = P.cs;
    base = 0.92;
    if (alt > P.cap - 8) ai.ph = 'cruise';
  } else if (ai.ph === 'recspd') {
    const wz = ai.i ? 600 : -P.L;
    hT = toward(0, wz);
    vsd = THREE.MathUtils.clamp((P.tAlt - alt) * 0.2, -P.vc, P.vc);
    spd = 999;
    base = 1;
    if (-a.p.x * fw.x + (wz - a.p.z) * fw.z < 0) ai.i ^= 1;
    if (!ai.t0) ai.t0 = performance.now();
    if (performance.now() - ai.t0 > 35000) {
      ai.ph = 'cruise';
      ai.t0 = 0;
    }
  } else if (ai.ph === 'orbit') {
    hT = hdg + 1.4;
    vsd = THREE.MathUtils.clamp((P.tAlt - alt) * 0.2, -P.vc, P.vc);
  } else if (ai.ph === 'approach') {
    hT = toward(0, P.az);
    vsd = THREE.MathUtils.clamp((P.aAlt - alt) * 0.2, -P.vc * 1.2, P.vc);
    spd = P.vap + P.ad;
    if ((0 - a.p.x) * fw.x + (P.az - a.p.z) * fw.z < 0 || Math.hypot(a.p.x, P.az - a.p.z) < 250) {
      ai.ph = 'final';
    }
  } else if (ai.ph === 'final') {
    const z = a.p.z;
    const glide = Math.max(0, (z - 200) * 0.06);
    const gA = Math.abs(a.p.x) < 200 ? glide : Math.max(glide, 60);
    hT = z > 450 ? toward(0, z - 700) : 0;
    vsd = THREE.MathUtils.clamp(-a.fwd * 0.06 + (gA - alt) * 0.25, P.fl, 3);
    spd = P.vap;
    if (alt < 9) {
      vsd = -0.9;
      idle = true;
    }
    if (a.ground) ai.ph = 'rollout';
  } else if (ai.ph === 'rollout') {
    inp.thr = 0;
    inp.brake = 1;
    inp.p = 0;
    inp.r = 0;
    inp.y = THREE.MathUtils.clamp(wrapAngle(-hdg) * 2, -1, 1);
    return;
  }

  const targetBank = THREE.MathUtils.clamp(wrapAngle(hT - hdg) * 1.45, -P.bk, P.bk);
  inp.r = THREE.MathUtils.clamp((targetBank - bankL) * 2.4 - a.w.z * 0.42, -1, 1);
  inp.y = THREE.MathUtils.clamp(wrapAngle(hT - hdg) * 0.35, -0.4, 0.4);
  const climbAngleTarget = THREE.MathUtils.clamp(Math.atan2(vsd, Math.max(a.fwd, c.vr * 0.85)) + 0.055, -0.34, 0.42);
  const pitchCmd = (climbAngleTarget - pitchCur) * 2.4 + (vsd - a.v.y) * 0.025 - a.w.x * 0.45;
  inp.p = THREE.MathUtils.clamp(pitchCmd, -P.mp, P.mp);
  inp.thr = idle ? 0 : THREE.MathUtils.clamp(base + (spd - sp) * 0.035, 0.12, 1);
}

export function getAircraftBySamiAction(action: SamiAction, aircraftList: AircraftInstance[]): AircraftInstance | null {
  const map: Partial<Record<SamiAction, AircraftId>> = {
    fly_small: 'cessna',
    fly_f16: 'f16',
    fly_f18: 'f18',
    fly_f35: 'f35',
    fly_f117: 'f117',
    fly_f22: 'f22',
    fly_a10: 'a10',
    fly_rafale: 'rafale',
    fly_sukhoi: 'sukhoi',
    fly_b2: 'b2',
    fly_concorde: 'concorde',
    fly_sr71: 'sr71',
    fly_airliner: 'airliner',
    fly_biplane: 'biplane',
    fly_hercules: 'hercules',
  };
  const id = map[action];
  if (!id) return null;
  return aircraftList.find((a) => a.config.id === id) || null;
}
