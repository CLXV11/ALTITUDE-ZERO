import type * as THREE from 'three';
import type { MissionId, MissionSnapshot } from '../types/flight';
import type { WorldObjects } from './worldBuilder';

export interface MissionOption {
  id: MissionId;
  titleAr: string;
  descAr: string;
}

export const MISSION_OPTIONS: MissionOption[] = [
  {
    id: 'rings',
    titleAr: 'سباق الحلقات الجوي',
    descAr: 'اجتز الحلقات المضيئة المنتشرة فوق المطار والمدينة والبحر.',
  },
  {
    id: 'bombing',
    titleAr: 'تدمير مستودعات الوقود',
    descAr: 'حلّق نحو حقول الأهداف الأرضية ودمرها باستخدام القنابل [B].',
  },
  {
    id: 'carrier',
    titleAr: 'هبوط حاملة الطائرات',
    descAr: 'أنزل خطاف الإيقاف [H] واهبط بدقة على سطح حاملة الطائرات.',
  },
  {
    id: 'highland',
    titleAr: 'رحلة القاعدة الجبلية',
    descAr: 'اقطع الممر الجبلي شمال غرب واهبط بسلاسة في القاعدة الجبلية.',
  },
  {
    id: 'refuel',
    titleAr: 'التزود بالوقود في الجو',
    descAr: 'حلّق داخل الحلقة الخضراء (ضمن 60م) خلف الصهريج KC-46 على ارتفاع 1500م للتثبيت والتزود السريع.',
  },
];

export class MissionManager {
  private activeId: MissionId = 'rings';
  private carrierLanded = false;
  private highlandLanded = false;
  private refuelCompleted = false;

  public getActiveId(): MissionId {
    return this.activeId;
  }

  public selectMission(id: MissionId): void {
    this.activeId = id;
  }

  public cycleMission(): MissionId {
    const idx = MISSION_OPTIONS.findIndex((m) => m.id === this.activeId);
    this.activeId = MISSION_OPTIONS[(idx + 1) % MISSION_OPTIONS.length].id;
    return this.activeId;
  }

  public reset(): void {
    this.carrierLanded = false;
    this.highlandLanded = false;
    this.refuelCompleted = false;
  }

  public markCarrierTrapped(): boolean {
    if (this.carrierLanded) return false;
    this.carrierLanded = true;
    return true;
  }

  public markHighlandLanded(): boolean {
    if (this.highlandLanded) return false;
    this.highlandLanded = true;
    return true;
  }

  public markRefuelComplete(): boolean {
    if (this.refuelCompleted) return false;
    this.refuelCompleted = true;
    return true;
  }

  public buildSnapshot(
    playerPos: THREE.Vector3,
    tankerPos: THREE.Vector3,
    world: WorldObjects
  ): MissionSnapshot {
    let titleAr = '';
    let objectiveAr = '';
    let progress = 0;
    let target = 1;
    let completed = false;
    let targetX = 0;
    let targetY = 120;
    let targetZ = -500;

    if (this.activeId === 'rings') {
      titleAr = 'سباق الحلقات الجوي';
      target = world.rings.length;
      progress = world.rings.filter((r) => r.collected).length;
      completed = progress >= target;
      const nextRing = world.rings.find((r) => !r.collected);
      if (nextRing) {
        targetX = nextRing.pos.x;
        targetY = nextRing.pos.y;
        targetZ = nextRing.pos.z;
        objectiveAr = `توجّه نحو الحلقة ${progress + 1} من ${target}`;
      } else {
        objectiveAr = 'أتممت جميع الحلقات الجوية ببراعة!';
      }
    } else if (this.activeId === 'bombing') {
      titleAr = 'قصف مستودعات الأعداء';
      target = world.targets.length;
      progress = world.targets.filter((t) => t.destroyed).length;
      completed = progress >= target;
      let nearest = world.targets.find((t) => !t.destroyed) || null;
      let bestD = Infinity;
      for (const tg of world.targets) {
        if (tg.destroyed) continue;
        const d = playerPos.distanceTo(tg.pos);
        if (d < bestD) {
          bestD = d;
          nearest = tg;
        }
      }
      if (nearest) {
        targetX = nearest.pos.x;
        targetY = nearest.pos.y;
        targetZ = nearest.pos.z;
        objectiveAr = `اقصف الأهداف بمفتاح [B] (${progress}/${target})`;
      } else {
        objectiveAr = 'تم تدمير جميع أهداف الميدان بنجاح!';
      }
    } else if (this.activeId === 'carrier') {
      titleAr = 'هبوط حاملة الطائرات';
      progress = this.carrierLanded ? 1 : 0;
      target = 1;
      completed = this.carrierLanded;
      targetX = world.carrier.x;
      targetY = world.carrier.deckY + 2;
      targetZ = world.carrier.z;
      objectiveAr = this.carrierLanded
        ? 'تم الإمساك بكابل الحاملة بنجاح!'
        : 'أنزل الخطاف [H] واهبط على سطح الحاملة';
    } else if (this.activeId === 'highland') {
      titleAr = 'مهمة القاعدة الجبلية';
      progress = this.highlandLanded ? 1 : 0;
      target = 1;
      completed = this.highlandLanded;
      targetX = world.highlandBase.x;
      targetY = world.highlandBase.y + 4;
      targetZ = world.highlandBase.z;
      objectiveAr = this.highlandLanded
        ? 'تم الهبوط بنجاح في القاعدة الجبلية!'
        : 'اتجه نحو مدرج القاعدة الجبلية واهبط عليه';
    } else {
      titleAr = 'التزود بالوقود جواً';
      progress = this.refuelCompleted ? 1 : 0;
      target = 1;
      completed = this.refuelCompleted;
      targetX = tankerPos.x;
      targetY = tankerPos.y;
      targetZ = tankerPos.z;
      objectiveAr = this.refuelCompleted
        ? 'تم التزود بالوقود بنسبة 100%!'
        : 'ادخل الحلقة الخضراء خلف الصهريج KC-46 (ارتفاع 1500م · 450 كم/س)';
    }

    const dx = targetX - playerPos.x;
    const dz = targetZ - playerPos.z;
    const distM = Math.round(Math.hypot(dx, playerPos.y - targetY, dz));
    const bearingRad = Math.atan2(dx, -dz);
    const bearingDeg = ((Math.round((bearingRad * 180) / Math.PI) % 360) + 360) % 360;

    return {
      id: this.activeId,
      titleAr,
      objectiveAr,
      progress,
      target,
      completed,
      targetX,
      targetY,
      targetZ,
      distM,
      bearingDeg,
    };
  }
}
