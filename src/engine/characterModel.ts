import * as THREE from 'three';
import { groundHeightAt } from './worldBuilder';

export interface ManMesh {
  g: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  l: THREE.Group;
  shinL: THREE.Group;
  r: THREE.Group;
  shinR: THREE.Group;
  al: THREE.Group;
  foreL: THREE.Group;
  ar: THREE.Group;
  foreR: THREE.Group;
  chute: THREE.Group;
  sh: THREE.Mesh;
}

export function createShadowCircle(scene: THREE.Scene): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  scene.add(m);
  return m;
}

/**
 * Builds an articulated, realistic human pilot character wearing a tactical face-wrap litham (لثام).
 * Local forward direction is -Z so character faces ahead naturally on ground and inside cockpits.
 */
export function makeCharacterMesh(
  scene: THREE.Scene,
  jacketColor: number,
  pantsColor: number,
  lithamColor: number,
  withParachute: boolean
): ManMesh {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.58, metalness: 0.08 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.14 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.78, metalness: 0.05 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd29c72, roughness: 0.58, metalness: 0.02 });
  const lithamMat = new THREE.MeshStandardMaterial({ color: lithamColor, roughness: 0.84, metalness: 0.03 });
  const lithamFoldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(lithamColor).multiplyScalar(0.84),
    roughness: 0.88,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.78 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.72, metalness: 0.1 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.82, metalness: 0.12 });
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x17120e });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.85 });

  // Upper Body Group (pivoted at hip y = 0.88)
  const body = new THREE.Group();
  body.position.set(0, 0.88, 0);
  g.add(body);

  // Pelvis & Tactical Belt + Metal Buckle
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.148, 0.16, 12), pantsMat);
  pelvis.position.set(0, 0.02, 0);
  body.add(pelvis);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.164, 0.164, 0.048, 12), beltMat);
  belt.position.set(0, 0.095, 0);
  body.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.042, 0.03), buckleMat);
  buckle.position.set(0, 0.095, -0.158);
  body.add(buckle);

  // Athletic Human Torso + Ribcage + Shoulders + Tactical Flight Vest
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.145, 0.18, 12), shirtMat);
  waist.scale.set(1.06, 1.0, 0.68);
  waist.position.set(0, 0.19, 0);
  body.add(waist);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.168, 0.22, 6, 12), jacketMat);
  chest.scale.set(1.18, 1.0, 0.68);
  chest.position.set(0, 0.37, 0);
  chest.castShadow = true;
  body.add(chest);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.27, 0.235), vestMat);
  vest.position.set(0, 0.365, -0.005);
  vest.castShadow = true;
  body.add(vest);

  // Chest pockets & zipper placket on front (-Z)
  for (const s of [-1, 1]) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.024), beltMat);
    pocket.position.set(s * 0.075, 0.37, -0.122);
    body.add(pocket);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.4, 0.255), beltMat);
    strap.position.set(s * 0.095, 0.36, 0);
    body.add(strap);

    const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), jacketMat);
    shoulderPad.scale.set(1.05, 0.88, 0.92);
    shoulderPad.position.set(s * 0.205, 0.51, 0);
    body.add(shoulderPad);
  }

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.118, 0.068, 12), jacketMat);
  collar.position.set(0, 0.565, 0);
  body.add(collar);

  // Compact Parachute Rig Pack on Back (+Z)
  const chutePack = new THREE.Mesh(new THREE.BoxGeometry(0.265, 0.37, 0.125), vestMat);
  chutePack.position.set(0, 0.365, 0.135);
  chutePack.castShadow = true;
  body.add(chutePack);

  // Realistic Forward-Facing Human Head (-Z) with Draped Litham (لثام)
  const head = new THREE.Group();
  head.position.set(0, 0.615, 0);
  body.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.068, 0.11, 10), skinMat);
  neck.position.set(0, 0.045, 0);
  head.add(neck);

  // Sculpted cranium + defined jawline + ears
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.116, 16, 14), skinMat);
  skull.scale.set(0.88, 1.05, 0.96);
  skull.position.set(0, 0.178, 0);
  skull.castShadow = true;
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.064, 0.082, 12), skinMat);
  jaw.scale.set(0.95, 1, 1.02);
  jaw.position.set(0, 0.118, -0.015);
  head.add(jaw);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skinMat);
    ear.scale.set(0.45, 1.15, 0.72);
    ear.position.set(s * 0.104, 0.172, 0.012);
    head.add(ear);
  }

  // Expressive Eyes & Eyebrows cleanly facing -Z above the litham edge!
  for (const s of [-1, 1]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), scleraMat);
    sclera.scale.set(1.25, 0.78, 0.55);
    sclera.position.set(s * 0.038, 0.194, -0.104);
    head.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), pupilMat);
    iris.scale.set(1, 1, 0.6);
    iris.position.set(s * 0.038, 0.194, -0.111);
    head.add(iris);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.009, 0.014), hairMat);
    brow.position.set(s * 0.038, 0.214, -0.105);
    brow.rotation.z = -s * 0.08;
    head.add(brow);
  }

  // Subtle upper nose bridge emerging under litham wrap
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.036, 0.028), lithamMat);
  noseBridge.position.set(0, 0.165, -0.118);
  head.add(noseBridge);

  // Authentic Woven Litham (لثام) covering lower face (nose/cheeks/mouth/chin), neck & crown head-wrap
  const neckDrape = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.116, 0.09, 14), lithamMat);
  neckDrape.position.set(0, 0.058, 0.004);
  head.add(neckDrape);

  // Draped lower-face cloth mask leaving upper eyes & forehead cleanly visible
  const faceWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.114, 0.096, 0.095, 16),
    lithamMat
  );
  faceWrap.scale.set(0.95, 1, 1.08);
  faceWrap.position.set(0, 0.132, -0.01);
  faceWrap.rotation.x = 0.08; // slightly angled down over the bridge of nose & chin
  faceWrap.castShadow = true;
  head.add(faceWrap);

  // Front pleated cloth folds across the litham mask for crisp realism
  for (let i = 0; i < 2; i++) {
    const fold = new THREE.Mesh(
      new THREE.TorusGeometry(0.106, 0.013, 6, 16),
      lithamFoldMat
    );
    fold.rotation.x = Math.PI / 2 + 0.08;
    fold.position.set(0, 0.106 + i * 0.036, -0.014);
    head.add(fold);
  }

  // Head-wrap crown / keffiyeh fold on top & sides + hair peak
  const crownBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.112, 0.022, 8, 18),
    lithamFoldMat
  );
  crownBand.rotation.x = Math.PI / 2 - 0.12;
  crownBand.position.set(0, 0.238, 0.012);
  head.add(crownBand);

  const headCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.121, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
    lithamMat
  );
  headCap.position.set(0, 0.212, 0.012);
  headCap.rotation.x = 0.12;
  head.add(headCap);

  // Trailing draped cloth tails down the side/back (+Z)
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.035), lithamMat);
  scarfTail.position.set(0.055, 0.11, 0.105);
  scarfTail.rotation.set(0.22, -0.25, -0.18);
  head.add(scarfTail);

  // Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm + Cuff + Tactical Glove)
  const makeArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.225, 0.515, 0);
    body.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.18, 4, 10), jacketMat);
    upper.position.set(0, -0.125, 0);
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.255, 0);
    shoulder.add(elbow);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.165, 4, 10), jacketMat);
    fore.position.set(0, -0.115, 0);
    elbow.add(fore);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.035, 10), beltMat);
    cuff.position.set(0, -0.205, 0);
    elbow.add(cuff);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.075, 0.068), gloveMat);
    hand.position.set(0, -0.25, -0.008);
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Articulated Legs (Hip -> Thigh -> Knee + Pad -> Shin + Combat Boot facing -Z)
  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.098, 0.88, 0);
    g.add(hip);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.26, 4, 10), pantsMat);
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.43, 0);
    hip.add(knee);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.09, 0.045), beltMat);
    kneePad.position.set(0, -0.01, -0.062);
    knee.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.26, 4, 10), pantsMat);
    shin.position.set(0, -0.185, 0);
    shin.castShadow = true;
    knee.add(shin);

    const bootUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.11, 10), bootMat);
    bootUpper.position.set(0, -0.34, 0);
    knee.add(bootUpper);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.085, 0.225), bootMat);
    bootSole.position.set(0, -0.408, -0.042);
    knee.add(bootSole);

    return { hip, knee };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Curved 9-Cell Ram-Air Parachute Canopy + Wingtip Stabilizers + 8 Risers
  const chute = new THREE.Group();
  chute.position.set(0, 1.38, 0);
  chute.visible = false;
  if (withParachute) {
    const canopyOrange = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65, side: THREE.DoubleSide });
    const canopyWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, side: THREE.DoubleSide });
    const canopyNavy = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65, side: THREE.DoubleSide });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });

    const cells = 9;
    const cellW = 0.72;
    for (let i = 0; i < cells; i++) {
      const t = i - (cells - 1) / 2;
      const mat = i === 0 || i === cells - 1 ? canopyNavy : i % 2 === 0 ? canopyOrange : canopyWhite;
      const cell = new THREE.Mesh(new THREE.BoxGeometry(cellW, 0.24, 2.3), mat);
      const archY = 3.6 - t * t * 0.062;
      cell.position.set(t * 0.68, archY, 0.05);
      cell.rotation.z = -t * 0.095;
      cell.castShadow = true;
      chute.add(cell);
    }

    for (const s of [-1, 1]) {
      const stab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 2.2), canopyNavy);
      stab.position.set(s * 3.1, 2.38, 0.05);
      stab.rotation.z = s * 0.35;
      chute.add(stab);
    }

    const lineGeo = new THREE.CylinderGeometry(0.012, 0.012, 3.35, 4);
    for (const s of [-1, 1]) {
      for (const lx of [0.8, 2.2]) {
        for (const lz of [-0.65, 0.72]) {
          const line = new THREE.Mesh(lineGeo, lineMat);
          line.position.set(s * (0.2 + lx * 0.48), 1.85, lz * 0.45);
          line.rotation.z = -s * (lx * 0.24);
          line.rotation.x = lz * 0.25;
          chute.add(line);
        }
      }
    }
  }
  g.add(chute);

  const sh = createShadowCircle(scene);
  sh.scale.set(0.48, 1, 0.48);
  scene.add(g);

  return {
    g,
    body,
    head,
    l: leftLeg.hip,
    shinL: leftLeg.knee,
    r: rightLeg.hip,
    shinR: rightLeg.knee,
    al: leftArm.shoulder,
    foreL: leftArm.elbow,
    ar: rightArm.shoulder,
    foreR: rightArm.elbow,
    chute,
    sh,
  };
}

export function animateCharacter(
  m: ManMesh,
  pos: THREE.Vector3,
  yaw: number,
  anim: number,
  speedRatio: number,
  inAirWalk: boolean,
  visible: boolean,
  elapsed: number,
  skydive: boolean,
  parachuteOpen: boolean,
  chuteInflate: number,
  skydiveBank: number,
  diveRatio: number,
  flareActive: boolean
): void {
  m.g.visible = visible;
  m.sh.visible = visible;
  if (!visible) {
    m.chute.visible = false;
    return;
  }

  m.g.position.copy(pos);
  m.g.rotation.set(0, yaw, 0);
  const gh = groundHeightAt(pos.x, pos.z);
  const alt = Math.max(0, pos.y - gh);
  m.sh.position.set(pos.x, gh + 0.06, pos.z);
  const shScale = skydive ? Math.max(0.25, 0.72 - alt * 0.002) : 0.48;
  m.sh.scale.set(shScale, 1, shScale);
  (m.sh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.36 - alt * 0.001, 0.08, 0.36);

  if (skydive) {
    m.chute.visible = parachuteOpen;
    if (parachuteOpen) {
      m.chute.scale.set(0.35 + chuteInflate * 0.65, 0.3 + chuteInflate * 0.7, 0.4 + chuteInflate * 0.6);
      m.chute.rotation.set(flareActive ? -0.16 : 0.06, 0, skydiveBank * 0.65);

      const swingRoll = skydiveBank * 0.5 + Math.sin(elapsed * 2.1) * 0.03;
      m.g.rotation.z = swingRoll;
      m.body.position.set(0, 0.88, 0);
      m.body.rotation.set(flareActive ? -0.15 : 0.05, 0, 0);
      m.head.rotation.set(0.1, skydiveBank * -0.4, 0);

      const legLift = flareActive ? 0.48 : 0.18;
      m.l.rotation.set(legLift, 0, 0.06);
      m.r.rotation.set(legLift * 0.85, 0, -0.06);
      m.shinL.rotation.set(-0.35, 0, 0);
      m.shinR.rotation.set(-0.28, 0, 0);

      const pullL = flareActive ? 0.65 : Math.max(0, -skydiveBank) * 0.7;
      const pullR = flareActive ? 0.65 : Math.max(0, skydiveBank) * 0.7;
      m.al.rotation.set(2.35 - pullL, 0, 0.28);
      m.ar.rotation.set(2.35 - pullR, 0, -0.28);
      m.foreL.rotation.set(0.45 + pullL * 0.4, 0, 0);
      m.foreR.rotation.set(0.45 + pullR * 0.4, 0, 0);
    } else {
      const flutter = Math.sin(elapsed * 18) * 0.045;
      const pitchPose = THREE.MathUtils.lerp(-1.38, -2.18, diveRatio);
      m.g.rotation.z = skydiveBank * 0.68;
      m.body.position.set(0, 0.88, 0);
      m.body.rotation.set(pitchPose, 0, 0);
      m.head.rotation.set(0.58 - diveRatio * 0.18, skydiveBank * -0.25, 0);

      const legSpread = THREE.MathUtils.lerp(0.22, 0.06, diveRatio);
      const thighPitch = THREE.MathUtils.lerp(-1.62, -2.15, diveRatio);
      m.l.rotation.set(thighPitch + flutter, 0, -legSpread);
      m.r.rotation.set(thighPitch - flutter, 0, legSpread);
      const kneeBend = THREE.MathUtils.lerp(-0.65, -0.15, diveRatio);
      m.shinL.rotation.set(kneeBend, 0, 0);
      m.shinR.rotation.set(kneeBend, 0, 0);

      const armSpread = THREE.MathUtils.lerp(1.42, 0.2, diveRatio);
      const armPitch = THREE.MathUtils.lerp(0.28, -0.18, diveRatio);
      const elbowSweepZ = THREE.MathUtils.lerp(1.42, 0.05, diveRatio);
      const elbowBendX = THREE.MathUtils.lerp(0.35, 0.2, diveRatio);
      m.al.rotation.set(armPitch + flutter, 0, -armSpread);
      m.ar.rotation.set(armPitch - flutter, 0, armSpread);
      m.foreL.rotation.set(elbowBendX, 0, -elbowSweepZ);
      m.foreR.rotation.set(elbowBendX, 0, elbowSweepZ);
    }
    return;
  }

  m.chute.visible = false;

  if (inAirWalk) {
    m.body.position.set(0, 0.88, 0);
    m.body.rotation.set(0.12, 0, 0);
    m.head.rotation.set(0.05, 0, 0);
    m.l.rotation.set(0.45, 0, -0.05);
    m.r.rotation.set(-0.22, 0, 0.05);
    m.shinL.rotation.set(-0.75, 0, 0);
    m.shinR.rotation.set(-0.45, 0, 0);
    m.al.rotation.set(0.55, 0, -0.25);
    m.ar.rotation.set(-0.25, 0, 0.25);
    m.foreL.rotation.set(0.65, 0, 0);
    m.foreR.rotation.set(0.55, 0, 0);
    return;
  }

  if (speedRatio > 0.05) {
    const stride = THREE.MathUtils.clamp(speedRatio, 0.25, 1.15);
    const sL = Math.sin(anim);
    const cL = Math.cos(anim);
    const sR = Math.sin(anim + Math.PI);
    const cR = Math.cos(anim + Math.PI);

    m.body.position.set(0, 0.88 + Math.abs(sL) * 0.032 * stride, 0);
    m.body.rotation.set(0.08 * stride, -sL * 0.06 * stride, 0);
    m.head.rotation.set(-0.04 * stride, sL * 0.05 * stride, 0);

    m.l.rotation.set(sL * 0.62 * stride, 0, -0.02);
    m.r.rotation.set(sR * 0.62 * stride, 0, 0.02);

    const kneeL = Math.max(0, cL) * 0.85 * stride + 0.08;
    const kneeR = Math.max(0, cR) * 0.85 * stride + 0.08;
    m.shinL.rotation.set(-kneeL, 0, 0);
    m.shinR.rotation.set(-kneeR, 0, 0);

    const armAmp = 0.52 * stride;
    m.al.rotation.set(-sL * armAmp, 0, -0.06);
    m.ar.rotation.set(-sR * armAmp, 0, 0.06);

    m.foreL.rotation.set(0.24 + Math.max(0, -sL) * 0.45 * stride, 0, 0);
    m.foreR.rotation.set(0.24 + Math.max(0, -sR) * 0.45 * stride, 0, 0);
  } else {
    const breath = Math.sin(elapsed * 2.0);
    m.body.position.set(0, 0.88 + breath * 0.01, 0);
    m.body.rotation.set(0, Math.sin(elapsed * 0.5) * 0.03, 0);
    m.head.rotation.set(Math.sin(elapsed * 0.7) * 0.04, Math.sin(elapsed * 0.85) * 0.28, 0);

    m.l.rotation.set(0.02, 0, -0.03);
    m.r.rotation.set(-0.02, 0, 0.03);
    m.shinL.rotation.set(-0.05, 0, 0);
    m.shinR.rotation.set(-0.05, 0, 0);

    m.al.rotation.set(breath * 0.02, 0, -0.08);
    m.ar.rotation.set(-breath * 0.02, 0, 0.08);
    m.foreL.rotation.set(0.18, 0, 0);
    m.foreR.rotation.set(0.18, 0, 0);
  }
}
