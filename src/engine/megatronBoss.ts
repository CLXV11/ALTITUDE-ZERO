import * as THREE from 'three';

export interface MegatronRig {
  root: THREE.Group;
  chassis: THREE.Group;
  torsoPivot: THREE.Group;
  chestL: THREE.Group;
  chestR: THREE.Group;
  coreReactor: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  neckPivot: THREE.Group;
  headGroup: THREE.Group;
  eyeMat: THREE.MeshBasicMaterial;
  wingPackPivot: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  thrusterFlameL: THREE.Mesh;
  thrusterFlameR: THREE.Mesh;
  thrusterFlameMat: THREE.MeshBasicMaterial;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  upperArmL: THREE.Group;
  upperArmR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  cannonPivot: THREE.Group;
  cannonBarrel: THREE.Group;
  cannonCoreMat: THREE.MeshBasicMaterial;
  muzzleAnchor: THREE.Object3D;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  reentryCone: THREE.Mesh;
  reentryMat: THREE.ShaderMaterial;
  shadowBlob: THREE.Mesh;
}

export interface MegatronPoseInput {
  elapsed: number;
  aimYaw: number; // local yaw toward player (rad)
  aimPitch: number; // local pitch toward player (rad)
  leapFactor: number; // 0..1 while jumping through the air
  stompFactor: number; // 0..1 shock stomp impact compression
  cannonCharge: number; // 0..1 charge glow & barrel extension
  recoil: number; // 0..1 fusion cannon kickback
  stagger: number; // 0..1 hit/dying shake
  walkCycle: number; // stride phase
  walkSpeed: number; // 0..1
  jetRoll: number; // bank angle in jet mode
  reentryGlow: number; // 0..1 fiery purple meteor sheath
}

function makeWingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.4);
  shape.lineTo(side * 12.8, -5.4);
  shape.lineTo(side * 14.2, -9.2);
  shape.lineTo(side * 6.5, -7.8);
  shape.lineTo(side * 3.8, -11.4);
  shape.lineTo(0, -8.5);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.18,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.21, 0);
  return geo;
}

function makeChestPlateGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(side * 3.1, 0.6);
  shape.lineTo(side * 3.4, 4.1);
  shape.lineTo(side * 1.1, 6.2);
  shape.lineTo(0, 5.1);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.5,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.22,
    bevelSegments: 2,
  });
  geo.translate(0, -2.2, -0.75);
  return geo;
}

export function buildMegatronRig(): MegatronRig {
  const root = new THREE.Group();
  root.name = 'megatron-boss-root';

  const armorDarkMat = new THREE.MeshStandardMaterial({
    color: 0x262b38,
    metalness: 0.88,
    roughness: 0.28,
    envMapIntensity: 1.45,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x11151f,
    metalness: 0.78,
    roughness: 0.45,
    envMapIntensity: 1.1,
  });
  const silverEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x7a889e,
    metalness: 0.94,
    roughness: 0.19,
    envMapIntensity: 1.65,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x9333ea,
    emissive: 0xa855f7,
    emissiveIntensity: 3.4,
    metalness: 0.3,
    roughness: 0.2,
    toneMapped: false,
  });
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xff2233,
    toneMapped: false,
  });
  const cannonCoreMat = new THREE.MeshBasicMaterial({
    color: 0xd946ef,
    toneMapped: false,
  });
  const thrusterFlameMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  // Ground contact shadow blob
  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x040711,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  shadowBlob.position.y = 0.14;
  root.add(shadowBlob);

  // Pelvis / Chassis root
  const chassis = new THREE.Group();
  chassis.position.set(0, 13.5, 0);
  root.add(chassis);

  const pelvisBlock = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.7, 4.1), frameMat);
  const pelvisBelt = new THREE.Mesh(new THREE.BoxGeometry(6.1, 1.3, 4.4), armorDarkMat);
  pelvisBelt.position.set(0, 0.35, 0);
  const pelvisCrest = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), silverEdgeMat);
  pelvisCrest.scale.set(0.95, 1.3, 0.7);
  pelvisCrest.position.set(0, -0.1, -2.1);
  chassis.add(pelvisBlock, pelvisBelt, pelvisCrest);

  // Torso Pivot
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 1.35, 0);
  chassis.add(torsoPivot);

  const waistPistonL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 3.2, 8), silverEdgeMat);
  waistPistonL.position.set(-1.7, 1.3, -0.7);
  const waistPistonR = waistPistonL.clone();
  waistPistonR.position.x = 1.7;
  const abdomen = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.3, 3.5), frameMat);
  abdomen.position.set(0, 1.8, 0);

  const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(7.6, 5.2, 4.8), armorDarkMat);
  upperTorso.position.set(0, 5.4, 0.1);
  const collarArmor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.4, 4.3), silverEdgeMat);
  collarArmor.position.set(0, 8.2, 0.15);

  const coreReactor = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 1), coreMat);
  coreReactor.scale.set(1.0, 1.25, 0.65);
  coreReactor.position.set(0, 5.3, -2.35);

  torsoPivot.add(waistPistonL, waistPistonR, abdomen, upperTorso, collarArmor, coreReactor);

  // Split Nosecone Chest Plates (fold inward/forward in Jet mode, flare into broad armored chest in Mech mode)
  const chestL = new THREE.Group();
  chestL.position.set(-0.6, 5.1, -2.15);
  const chestPlateL = new THREE.Mesh(makeChestPlateGeometry(-1), armorDarkMat);
  const chestTrimL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.45), silverEdgeMat);
  chestTrimL.position.set(-1.6, 1.4, -0.85);
  chestTrimL.rotation.z = -0.35;
  chestL.add(chestPlateL, chestTrimL);

  const chestR = new THREE.Group();
  chestR.position.set(0.6, 5.1, -2.15);
  const chestPlateR = new THREE.Mesh(makeChestPlateGeometry(1), armorDarkMat);
  const chestTrimR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.45), silverEdgeMat);
  chestTrimR.position.set(1.6, 1.4, -0.85);
  chestTrimR.rotation.z = 0.35;
  chestR.add(chestPlateR, chestTrimR);

  torsoPivot.add(chestL, chestR);

  // Cybertronian Head & Crested Helmet
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 8.6, -0.15);
  torsoPivot.add(neckPivot);

  const headGroup = new THREE.Group();
  neckPivot.add(headGroup);

  const neckCol = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 1.4, 8), frameMat);
  neckCol.position.set(0, 0.6, 0);
  const cranium = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.6, 2.5), armorDarkMat);
  cranium.position.set(0, 2.0, 0);
  const helmetBrow = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.85, 2.85), silverEdgeMat);
  helmetBrow.position.set(0, 2.9, -0.08);
  helmetBrow.rotation.x = 0.16;

  // Angular Cybertronian horns/crown crests
  const hornGeo = new THREE.ConeGeometry(0.45, 2.3, 4);
  const hornL = new THREE.Mesh(hornGeo, silverEdgeMat);
  hornL.position.set(-1.25, 3.85, 0.1);
  hornL.rotation.set(-0.22, 0, 0.34);
  const hornR = hornL.clone();
  hornR.position.x = 1.25;
  hornR.rotation.z = -0.34;
  const centerCrest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.65, 2.4), silverEdgeMat);
  centerCrest.position.set(0, 3.7, 0.15);

  const facePlate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.55), frameMat);
  facePlate.position.set(0, 1.75, -1.18);
  const jawGuard = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 0.9), silverEdgeMat);
  jawGuard.position.set(0, 1.1, -1.05);

  // Glowing crimson optics
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.25), eyeMat);
  eyeL.position.set(-0.48, 2.15, -1.42);
  eyeL.rotation.z = -0.18;
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.48;
  eyeR.rotation.z = 0.18;

  headGroup.add(neckCol, cranium, helmetBrow, hornL, hornR, centerCrest, facePlate, jawGuard, eyeL, eyeR);

  // Backpack Wing & Dual Jet Thruster Rig
  const wingPackPivot = new THREE.Group();
  wingPackPivot.position.set(0, 5.8, 2.45);
  torsoPivot.add(wingPackPivot);

  const spineHub = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.8, 2.2), frameMat);
  wingPackPivot.add(spineHub);

  const wingL = new THREE.Group();
  wingL.position.set(-1.6, 0.8, 0.6);
  const wingMeshL = new THREE.Mesh(makeWingGeometry(-1), armorDarkMat);
  const wingEdgeL = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.3, 0.7), silverEdgeMat);
  wingEdgeL.position.set(-6.4, 0.2, -3.5);
  wingEdgeL.rotation.y = 0.44;
  wingL.add(wingMeshL, wingEdgeL);

  const wingR = new THREE.Group();
  wingR.position.set(1.6, 0.8, 0.6);
  const wingMeshR = new THREE.Mesh(makeWingGeometry(1), armorDarkMat);
  const wingEdgeR = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.3, 0.7), silverEdgeMat);
  wingEdgeR.position.set(6.4, 0.2, -3.5);
  wingEdgeR.rotation.y = -0.44;
  wingR.add(wingMeshR, wingEdgeR);
  wingPackPivot.add(wingL, wingR);

  const buildThrusterPod = (x: number): THREE.Mesh => {
    const pod = new THREE.Group();
    pod.position.set(x, -0.5, 1.3);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.3, 4.4, 10), armorDarkMat);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.9, 10), silverEdgeMat);
    nozzle.position.y = -2.35;
    const glow = new THREE.Mesh(new THREE.ConeGeometry(0.92, 5.2, 10), thrusterFlameMat);
    glow.rotation.x = Math.PI;
    glow.position.y = -4.9;
    pod.add(housing, nozzle, glow);
    wingPackPivot.add(pod);
    return glow;
  };
  const thrusterFlameL = buildThrusterPod(-1.65);
  const thrusterFlameR = buildThrusterPod(1.65);

  // Arms & Right-Forearm Fusion Cannon
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 5.0, 6.7, 0);
    torsoPivot.add(shoulder);

    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 4.0), armorDarkMat);
    pauldron.position.set(side * 0.45, 0.4, 0);
    pauldron.rotation.z = -side * 0.24;
    const pauldronSpike = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 4), silverEdgeMat);
    pauldronSpike.position.set(side * 1.6, 1.9, 0);
    pauldronSpike.rotation.z = -side * 0.52;
    const joint = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), frameMat);
    shoulder.add(pauldron, pauldronSpike, joint);

    const upperArm = new THREE.Group();
    shoulder.add(upperArm);
    const bicep = new THREE.Mesh(new THREE.BoxGeometry(1.85, 4.1, 2.0), frameMat);
    bicep.position.set(0, -2.2, 0);
    const bicepPlate = new THREE.Mesh(new THREE.BoxGeometry(2.15, 3.0, 2.25), silverEdgeMat);
    bicepPlate.position.set(side * 0.15, -2.2, 0);
    upperArm.add(bicep, bicepPlate);

    const forearm = new THREE.Group();
    forearm.position.set(0, -4.4, 0);
    upperArm.add(forearm);
    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(2.35, 4.5, 2.55), armorDarkMat);
    gauntlet.position.set(0, -2.25, 0);
    const clawBlock = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.4, 1.95), frameMat);
    clawBlock.position.set(0, -4.9, 0);
    forearm.add(gauntlet, clawBlock);
    for (let ci = -1; ci <= 1; ci++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.35, 4), silverEdgeMat);
      claw.rotation.x = Math.PI;
      claw.position.set(ci * 0.5, -5.85, -0.3);
      forearm.add(claw);
    }

    return { shoulder, upperArm, forearm };
  };

  const armL = buildArm(-1);
  const armR = buildArm(1);

  // Iconic Massive Right-Forearm Fusion Cannon
  const cannonPivot = new THREE.Group();
  cannonPivot.position.set(1.5, -2.2, -0.15);
  armR.forearm.add(cannonPivot);

  const cannonBody = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 5.4, 10), armorDarkMat);
  cannonBody.rotation.x = Math.PI / 2;
  const cannonHousing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.4, 4.2), frameMat);
  const cannonCore = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 3.2, 10), cannonCoreMat);
  cannonCore.rotation.x = Math.PI / 2;
  cannonCore.position.set(0, 0.45, -1.2);
  cannonPivot.add(cannonBody, cannonHousing, cannonCore);

  const cannonBarrel = new THREE.Group();
  cannonBarrel.position.set(0, 0, -2.8);
  cannonPivot.add(cannonBarrel);
  const barrelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 1.02, 5.2, 10), silverEdgeMat);
  barrelTube.rotation.x = Math.PI / 2;
  barrelTube.position.set(0, 0, -2.2);
  const barrelShroud = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.35, 4.4), armorDarkMat);
  barrelShroud.position.set(0, 0.2, -1.9);
  const barrelMuzzleGlow = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.16, 8, 16), cannonCoreMat);
  barrelMuzzleGlow.position.set(0, 0, -4.8);
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0, -5.1);
  cannonBarrel.add(barrelTube, barrelShroud, barrelMuzzleGlow, muzzleAnchor);

  // Heavy Articulated Mech Legs (telescope into rear engine pods in Jet mode!)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 2.1, -0.9, 0);
    chassis.add(hip);

    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), frameMat);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(2.55, 6.0, 2.8), armorDarkMat);
    thigh.position.set(0, -3.1, 0);
    const thighArmor = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.6, 1.4), silverEdgeMat);
    thighArmor.position.set(0, -3.0, -1.0);
    hip.add(hipJoint, thigh, thighArmor);

    const knee = new THREE.Group();
    knee.position.set(0, -6.2, 0);
    hip.add(knee);

    const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.1), silverEdgeMat);
    kneeGuard.position.set(0, 0.4, -1.2);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(3.15, 6.2, 3.6), armorDarkMat);
    shin.position.set(0, -3.1, 0.25);
    const calfBooster = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 3.4, 8), frameMat);
    calfBooster.position.set(0, -2.5, 2.1);
    calfBooster.rotation.x = 0.18;
    knee.add(kneeGuard, shin, calfBooster);

    const foot = new THREE.Group();
    foot.position.set(0, -6.2, 0.15);
    knee.add(foot);
    const ankle = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 3.2), frameMat);
    ankle.position.set(0, -0.35, 0);
    const toeL = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.0, 3.2), silverEdgeMat);
    toeL.position.set(-0.75, -0.65, -1.4);
    const toeR = toeL.clone();
    toeR.position.x = 0.75;
    const heel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.2), armorDarkMat);
    heel.position.set(0, -0.65, 1.35);
    foot.add(ankle, toeL, toeR, heel);

    return { hip, knee, foot };
  };

  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // Fiery Purple Re-Entry Meteor Sheath Shader Cone
  const reentryMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        float streak = sin(vUv.x * 38.0 + uTime * 16.0) * 0.5 + 0.5;
        float streak2 = cos(vUv.x * 22.0 - uTime * 24.0 + vUv.y * 8.0) * 0.5 + 0.5;
        float axial = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
        float fres = pow(1.0 - abs(vNormalView.z), 1.4);
        vec3 col = mix(vec3(0.55, 0.12, 0.98), vec3(1.0, 0.65, 0.95), streak * streak2);
        float alpha = axial * (0.35 + 0.65 * fres) * (0.45 + 0.55 * streak) * uIntensity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const reentryGeo = new THREE.ConeGeometry(13.5, 42, 24, 1, true);
  reentryGeo.rotateX(Math.PI / 2);
  const reentryCone = new THREE.Mesh(reentryGeo, reentryMat);
  reentryCone.visible = false;
  root.add(reentryCone);

  return {
    root,
    chassis,
    torsoPivot,
    chestL,
    chestR,
    coreReactor,
    coreMat,
    neckPivot,
    headGroup,
    eyeMat,
    wingPackPivot,
    wingL,
    wingR,
    thrusterFlameL,
    thrusterFlameR,
    thrusterFlameMat,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    upperArmL: armL.upperArm,
    upperArmR: armR.upperArm,
    forearmL: armL.forearm,
    forearmR: armR.forearm,
    cannonPivot,
    cannonBarrel,
    cannonCoreMat,
    muzzleAnchor,
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
    footL: legL.foot,
    footR: legR.foot,
    reentryCone,
    reentryMat,
    shadowBlob,
  };
}

const smoothRange = (t: number, a: number, b: number): number => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export function applyMegatronPose(
  rig: MegatronRig,
  transformT: number,
  p: MegatronPoseInput
): void {
  const t = THREE.MathUtils.clamp(transformT, 0, 1);
  const stUnlatch = smoothRange(t, 0.0, 0.28);
  const stLegs = smoothRange(t, 0.18, 0.58);
  const stTorso = smoothRange(t, 0.25, 0.68);
  const stHead = smoothRange(t, 0.54, 0.84);
  const stCannon = smoothRange(t, 0.72, 1.0);

  const mechWeight = smoothRange(t, 0.65, 1.0);
  const jetWeight = 1 - smoothRange(t, 0.0, 0.35);

  const breathe = Math.sin(p.elapsed * 2.4) * 0.25 * mechWeight;
  const staggerX = p.stagger > 0.01 ? Math.sin(p.elapsed * 42) * p.stagger * 0.35 : 0;
  const staggerZ = p.stagger > 0.01 ? Math.cos(p.elapsed * 37) * p.stagger * 0.28 : 0;

  // Chassis vertical lift: Jet centers near 2.4m above origin, Mech lifts during transform then plants at 13.5m
  const transformLift = Math.sin(t * Math.PI) * 3.8;
  const stompDip = p.stompFactor * 2.2;
  const crouchDip = p.leapFactor * 0.8;
  rig.chassis.position.set(
    staggerX,
    THREE.MathUtils.lerp(2.4, 13.5, stLegs) + transformLift - stompDip + breathe - crouchDip,
    staggerZ
  );
  rig.chassis.rotation.set(
    THREE.MathUtils.lerp(0, 0.08 * p.stompFactor - p.leapFactor * 0.12, mechWeight),
    0,
    jetWeight * p.jetRoll + staggerZ * 0.35
  );

  // Torso pitches from horizontal jet hull (-PI/2) upright to vertical battle torso (0)
  const idleYaw = THREE.MathUtils.clamp(p.aimYaw, -1.1, 1.1) * mechWeight;
  rig.torsoPivot.rotation.set(
    THREE.MathUtils.lerp(-Math.PI / 2, 0.06 + p.stompFactor * 0.16 - p.stagger * 0.25, stTorso),
    idleYaw * 0.55,
    staggerZ * 0.2
  );

  // Split nosecone chest armor opens outward on unlatch & settles into wide pectoral plates
  const chestFlare = Math.sin(stUnlatch * Math.PI) * 0.35;
  rig.chestL.rotation.set(
    THREE.MathUtils.lerp(-0.45, 0.08, stTorso),
    THREE.MathUtils.lerp(0.62, -0.18 - chestFlare, stUnlatch),
    THREE.MathUtils.lerp(-0.18, 0.08, stTorso)
  );
  rig.chestR.rotation.set(
    THREE.MathUtils.lerp(-0.45, 0.08, stTorso),
    THREE.MathUtils.lerp(-0.62, 0.18 + chestFlare, stUnlatch),
    THREE.MathUtils.lerp(0.18, -0.08, stTorso)
  );

  // Head rises out of chest collar and locks eyes onto player
  rig.neckPivot.position.set(0, THREE.MathUtils.lerp(6.4, 8.6, stHead), THREE.MathUtils.lerp(0.9, -0.15, stHead));
  rig.neckPivot.scale.setScalar(THREE.MathUtils.lerp(0.35, 1.0, stHead));
  rig.headGroup.rotation.set(
    THREE.MathUtils.clamp(p.aimPitch, -0.55, 0.65) * mechWeight,
    idleYaw * 0.45,
    0
  );
  rig.eyeMat.color.setHex(stHead > 0.25 ? 0xff1f3d : 0x450a0a);

  // Wings sweep wide in Jet mode, fold diagonally back onto dorsal jetpack in Mech mode
  rig.wingPackPivot.rotation.set(
    THREE.MathUtils.lerp(Math.PI / 2, 0.12, stTorso),
    0,
    0
  );
  rig.wingL.rotation.set(
    THREE.MathUtils.lerp(0, -1.08, stUnlatch),
    THREE.MathUtils.lerp(0, -0.35, stUnlatch),
    THREE.MathUtils.lerp(0, 0.92, stUnlatch)
  );
  rig.wingR.rotation.set(
    THREE.MathUtils.lerp(0, -1.08, stUnlatch),
    THREE.MathUtils.lerp(0, 0.35, stUnlatch),
    THREE.MathUtils.lerp(0, -0.92, stUnlatch)
  );

  const jetFlameOn = jetWeight > 0.2 || p.leapFactor > 0.15 || p.reentryGlow > 0.05;
  const flamePulse = 0.88 + Math.sin(p.elapsed * 48) * 0.18;
  const flameScale = jetFlameOn ? (jetWeight * 1.65 + p.leapFactor * 1.4 + p.reentryGlow * 1.8) * flamePulse : 0.001;
  rig.thrusterFlameL.visible = jetFlameOn;
  rig.thrusterFlameR.visible = jetFlameOn;
  rig.thrusterFlameL.scale.set(1, Math.max(0.01, flameScale), 1);
  rig.thrusterFlameR.scale.set(1, Math.max(0.01, flameScale), 1);

  // Arms: tucked along jet intakes at t=0, broad menacing stance + aimed right Fusion Cannon at t=1
  const walkArmSwing = Math.sin(p.walkCycle) * 0.32 * p.walkSpeed * mechWeight;
  rig.shoulderL.position.set(THREE.MathUtils.lerp(-3.2, -5.1, stUnlatch), 6.7, 0);
  rig.shoulderR.position.set(THREE.MathUtils.lerp(3.2, 5.1, stUnlatch), 6.7, 0);

  rig.upperArmL.rotation.set(
    THREE.MathUtils.lerp(1.48, 0.22 + walkArmSwing - p.leapFactor * 0.7, stTorso),
    0,
    THREE.MathUtils.lerp(-0.1, -0.26 - p.stompFactor * 0.25, stUnlatch)
  );
  rig.forearmL.rotation.set(
    THREE.MathUtils.lerp(0.1, -0.58 - p.leapFactor * 0.4, stCannon),
    0,
    THREE.MathUtils.lerp(0, 0.18, stCannon)
  );

  // Right arm raises and aims Fusion Cannon toward player!
  const cannonAimX = THREE.MathUtils.lerp(1.48, 1.32 + THREE.MathUtils.clamp(p.aimPitch, -0.7, 0.8) - p.recoil * 0.24, stCannon);
  rig.upperArmR.rotation.set(
    cannonAimX,
    idleYaw * 0.38 * stCannon,
    THREE.MathUtils.lerp(0.1, 0.16, stUnlatch)
  );
  rig.forearmR.rotation.set(
    THREE.MathUtils.lerp(0.1, -0.22 + p.recoil * 0.18, stCannon),
    0,
    0
  );
  rig.cannonPivot.rotation.set(
    THREE.MathUtils.lerp(-1.55, 1.35, stCannon),
    0,
    0
  );
  rig.cannonBarrel.position.z = THREE.MathUtils.lerp(-1.2, -2.8 - p.cannonCharge * 0.55 + p.recoil * 1.15, stCannon);

  // Purple emissive pulse on Reactor Core & Fusion Cannon
  const chargeGlow = 1.8 + p.cannonCharge * 5.2 + Math.sin(p.elapsed * 6.5) * 0.4;
  rig.coreMat.emissiveIntensity = chargeGlow;
  rig.cannonCoreMat.color.setHex(p.cannonCharge > 0.35 ? 0xf0abfc : 0xc026d3);

  // Legs: tucked horizontally rearward (+Z) as twin jet engine nacelles at t=0 -> wide mech battle stance at t=1
  const strideL = Math.sin(p.walkCycle) * 0.38 * p.walkSpeed * mechWeight;
  const strideR = -strideL;
  const kneeBend = p.stompFactor * 0.55 + p.leapFactor * 0.65;

  rig.hipL.rotation.set(
    THREE.MathUtils.lerp(Math.PI / 2, -0.06 + strideL - kneeBend * 0.45, stLegs),
    0,
    THREE.MathUtils.lerp(-0.04, -0.14, stLegs)
  );
  rig.hipR.rotation.set(
    THREE.MathUtils.lerp(Math.PI / 2, -0.06 + strideR - kneeBend * 0.45, stLegs),
    0,
    THREE.MathUtils.lerp(0.04, 0.14, stLegs)
  );
  rig.kneeL.rotation.set(
    THREE.MathUtils.lerp(0.04, 0.12 + kneeBend + Math.max(0, -strideL) * 0.45, stLegs),
    0,
    0
  );
  rig.kneeR.rotation.set(
    THREE.MathUtils.lerp(0.04, 0.12 + kneeBend + Math.max(0, -strideR) * 0.45, stLegs),
    0,
    0
  );
  rig.footL.rotation.set(THREE.MathUtils.lerp(0.95, -0.06 - kneeBend * 0.35, stLegs), 0, 0);
  rig.footR.rotation.set(THREE.MathUtils.lerp(0.95, -0.06 - kneeBend * 0.35, stLegs), 0, 0);

  // Re-entry plasma sheath
  rig.reentryCone.visible = p.reentryGlow > 0.02;
  if (rig.reentryCone.visible) {
    rig.reentryMat.uniforms.uTime.value = p.elapsed;
    rig.reentryMat.uniforms.uIntensity.value = p.reentryGlow;
    rig.reentryCone.position.set(0, 2.2, 1.5);
  }
}

export interface LightningBoltSlot {
  coreLine: THREE.LineSegments;
  glowLine: THREE.LineSegments;
  corePos: Float32Array;
  glowPos: Float32Array;
  coreMat: THREE.LineBasicMaterial;
  glowMat: THREE.LineBasicMaterial;
  worldOrigin: THREE.Vector3;
  age: number;
  maxAge: number;
  active: boolean;
}

export class MegatronLightningSystem {
  public readonly bolts: LightningBoltSlot[] = [];
  public readonly flashLight: THREE.PointLight;
  private readonly scene: THREE.Scene;
  private flashIntensity = 0;
  private readonly flashWorldPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.flashLight = new THREE.PointLight(0xd8b4fe, 0, 4800, 1.15);
    scene.add(this.flashLight);

    // 4 pooled branching lightning bolt rigs (46 segments each = 92 vertices * 3 floats)
    const maxSegs = 46;
    for (let i = 0; i < 4; i++) {
      const corePos = new Float32Array(maxSegs * 2 * 3);
      const glowPos = new Float32Array(maxSegs * 2 * 3);
      const coreGeo = new THREE.BufferGeometry();
      coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
      coreGeo.setDrawRange(0, 0);

      const glowGeo = new THREE.BufferGeometry();
      glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
      glowGeo.setDrawRange(0, 0);

      const coreMat = new THREE.LineBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowMat = new THREE.LineBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const coreLine = new THREE.LineSegments(coreGeo, coreMat);
      const glowLine = new THREE.LineSegments(glowGeo, glowMat);
      coreLine.frustumCulled = false;
      glowLine.frustumCulled = false;
      coreLine.visible = false;
      glowLine.visible = false;
      scene.add(glowLine);
      scene.add(coreLine);

      this.bolts.push({
        coreLine,
        glowLine,
        corePos,
        glowPos,
        coreMat,
        glowMat,
        worldOrigin: new THREE.Vector3(),
        age: 0,
        maxAge: 0.35,
        active: false,
      });
    }
  }

  public triggerStrike(startX: number, startY: number, startZ: number, endY: number, spread = 180): void {
    const slot = this.bolts.find((b) => !b.active) || this.bolts[0];
    slot.active = true;
    slot.age = 0;
    slot.maxAge = 0.28 + Math.random() * 0.18;
    slot.worldOrigin.set(startX, 0, startZ);

    const mainSteps = 18;
    let cx = 0;
    let cz = 0;
    let segIdx = 0;
    const maxSegs = 46;

    const pushSeg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, jit: number) => {
      if (segIdx >= maxSegs) return;
      const base = segIdx * 6;
      slot.corePos[base] = ax;
      slot.corePos[base + 1] = ay;
      slot.corePos[base + 2] = az;
      slot.corePos[base + 3] = bx;
      slot.corePos[base + 4] = by;
      slot.corePos[base + 5] = bz;

      slot.glowPos[base] = ax + jit;
      slot.glowPos[base + 1] = ay;
      slot.glowPos[base + 2] = az - jit;
      slot.glowPos[base + 3] = bx + jit;
      slot.glowPos[base + 4] = by;
      slot.glowPos[base + 5] = bz - jit;
      segIdx++;
    };

    for (let i = 0; i < mainSteps && segIdx < maxSegs; i++) {
      const f0 = i / mainSteps;
      const f1 = (i + 1) / mainSteps;
      const y0 = THREE.MathUtils.lerp(startY, endY, f0);
      const y1 = THREE.MathUtils.lerp(startY, endY, f1);
      const nx = i === mainSteps - 1 ? cx * 0.5 : cx + (Math.random() - 0.5) * spread;
      const nz = i === mainSteps - 1 ? cz * 0.5 : cz + (Math.random() - 0.5) * spread;
      pushSeg(cx, y0, cz, nx, y1, nz, (Math.random() - 0.5) * 4.5);

      // Jagged side branches
      if (i > 1 && i < mainSteps - 3 && Math.random() < 0.45 && segIdx + 3 < maxSegs) {
        let bx = nx;
        let by = y1;
        let bz = nz;
        const dirX = (Math.random() - 0.5) * spread * 1.4;
        const dirZ = (Math.random() - 0.5) * spread * 1.4;
        for (let b = 0; b < 3; b++) {
          const nbx = bx + dirX * 0.55 + (Math.random() - 0.5) * spread * 0.4;
          const nby = by - (startY - endY) * 0.055;
          const nbz = bz + dirZ * 0.55 + (Math.random() - 0.5) * spread * 0.4;
          pushSeg(bx, by, bz, nbx, nby, nbz, 3.2);
          bx = nbx;
          by = nby;
          bz = nbz;
        }
      }
      cx = nx;
      cz = nz;
    }

    (slot.coreLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (slot.glowLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    slot.coreLine.geometry.setDrawRange(0, segIdx * 2);
    slot.glowLine.geometry.setDrawRange(0, segIdx * 2);
    slot.coreLine.visible = true;
    slot.glowLine.visible = true;

    this.flashWorldPos.set(startX, (startY + endY) * 0.55, startZ);
    this.flashIntensity = 22.0;
  }

  public triggerFlashAt(x: number, y: number, z: number, intensity = 16): void {
    this.flashWorldPos.set(x, y, z);
    this.flashIntensity = Math.max(this.flashIntensity, intensity);
  }

  public update(dt: number, renderOrigin: THREE.Vector3): void {
    if (this.flashIntensity > 0.05) {
      this.flashIntensity *= Math.exp(-10.5 * dt);
      this.flashLight.intensity = this.flashIntensity;
      this.flashLight.position.copy(this.flashWorldPos).sub(renderOrigin);
    } else {
      this.flashIntensity = 0;
      this.flashLight.intensity = 0;
    }

    for (const slot of this.bolts) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= slot.maxAge) {
        slot.active = false;
        slot.coreLine.visible = false;
        slot.glowLine.visible = false;
        continue;
      }
      const life = slot.age / slot.maxAge;
      const flicker = Math.sin(slot.age * 110) > -0.25 ? 1.0 : 0.3;
      const fade = (1 - life) * flicker;
      slot.coreMat.opacity = fade;
      slot.glowMat.opacity = fade * 0.85;
      slot.coreLine.position.copy(slot.worldOrigin).sub(renderOrigin);
      slot.glowLine.position.copy(slot.worldOrigin).sub(renderOrigin);
    }
  }

  public dispose(): void {
    this.scene.remove(this.flashLight);
    for (const slot of this.bolts) {
      this.scene.remove(slot.coreLine);
      this.scene.remove(slot.glowLine);
      slot.coreLine.geometry.dispose();
      slot.glowLine.geometry.dispose();
      slot.coreMat.dispose();
      slot.glowMat.dispose();
    }
  }
}
