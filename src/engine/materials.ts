import * as THREE from 'three';

export interface WorldTextures {
  runway: THREE.CanvasTexture;
  apron: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  terrainDetailNormal: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture;
  airlinerBody: THREE.CanvasTexture;
  buildingFacade: THREE.CanvasTexture;
  buildingRoughness: THREE.CanvasTexture;
  buildingEmissive: THREE.CanvasTexture;
  carrierDeck: THREE.CanvasTexture;
  jetMetal: THREE.CanvasTexture;
  stealthRam: THREE.CanvasTexture;
  camoBlue: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  cloudPuff: THREE.CanvasTexture;
}

function makeNormalFromHeight(
  size: number,
  heightAt: (u: number, v: number) => number,
  strength: number,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const data = img.data;
  const h = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      h[y * size + x] = heightAt(x / size, v);
    }
  }

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (h[y * size + xp] - h[y * size + xm]) * strength;
      const dy = (h[yp * size + x] - h[ym * size + x]) * strength;
      const inv = 1 / Math.hypot(-dx, -dy, 1.0);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((-dx * inv) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((-dy * inv) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((1.0 * inv) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): WorldTextures {
  // Deterministic PRNG for clean, repeatable surface detail
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Weathered Tactical Runway Asphalt Texture (512x1024) with heavy tire touchdown skid marks & crisp markings
  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 1024;
  const rg = rc.getContext('2d')!;
  rg.fillStyle = '#1d222b';
  rg.fillRect(0, 0, 512, 1024);

  // Fine asphalt aggregate grit + subtle concrete seam joints
  for (let i = 0; i < 16000; i++) {
    const shade = 22 + Math.floor(rand() * 24);
    rg.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
    rg.fillRect(rand() * 512, rand() * 1024, 2, 2);
  }
  rg.strokeStyle = 'rgba(10, 14, 20, 0.35)';
  rg.lineWidth = 2;
  for (let y = 0; y < 1024; y += 64) {
    rg.beginPath();
    rg.moveTo(0, y);
    rg.lineTo(512, y);
    rg.stroke();
  }

  // Realistic layered tire skid marks & rubber buildup along wheel tracks + centerline wear
  for (let i = 0; i < 64; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tx = 256 + side * (34 + (rand() - 0.5) * 32);
    const ty = rand() * 880;
    const len = 70 + rand() * 220;
    const alpha = 0.08 + rand() * 0.22;
    const grad = rg.createLinearGradient(tx, ty, tx, ty + len);
    grad.addColorStop(0, 'rgba(8, 10, 14, 0)');
    grad.addColorStop(0.18, `rgba(8, 10, 14, ${alpha})`);
    grad.addColorStop(0.7, `rgba(10, 12, 16, ${alpha * 0.7})`);
    grad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    rg.fillStyle = grad;
    rg.fillRect(tx - 2.5, ty, 3 + rand() * 4, len);
  }
  // Broad heavy landing zone rubber darkening
  const rubberL = rg.createLinearGradient(170, 0, 232, 0);
  rubberL.addColorStop(0, 'rgba(10, 12, 16, 0)');
  rubberL.addColorStop(0.5, 'rgba(10, 12, 16, 0.44)');
  rubberL.addColorStop(1, 'rgba(10, 12, 16, 0)');
  rg.fillStyle = rubberL;
  rg.fillRect(170, 0, 62, 1024);

  const rubberR = rg.createLinearGradient(280, 0, 342, 0);
  rubberR.addColorStop(0, 'rgba(10, 12, 16, 0)');
  rubberR.addColorStop(0.5, 'rgba(10, 12, 16, 0.44)');
  rubberR.addColorStop(1, 'rgba(10, 12, 16, 0)');
  rg.fillStyle = rubberR;
  rg.fillRect(280, 0, 62, 1024);

  // Crisp edge lines, centerline dashes & weathered aiming markers
  rg.fillStyle = '#e5e7eb';
  rg.fillRect(16, 0, 10, 1024);
  rg.fillRect(486, 0, 10, 1024);
  for (let y = 24; y < 1024; y += 128) {
    rg.fillRect(249, y, 14, 74);
  }
  // Subtle dirt shoulder along very edges
  rg.fillStyle = 'rgba(72, 66, 54, 0.35)';
  rg.fillRect(0, 0, 14, 1024);
  rg.fillRect(498, 0, 14, 1024);

  const runway = new THREE.CanvasTexture(rc);
  runway.colorSpace = THREE.SRGBColorSpace;
  runway.wrapS = runway.wrapT = THREE.RepeatWrapping;
  runway.anisotropy = maxAnisotropy;

  // 2. Deeper Concrete Apron Grid Texture (with expansion joints & subtle oil/tire stains)
  const ac = document.createElement('canvas');
  ac.width = 256;
  ac.height = 256;
  const ag = ac.getContext('2d')!;
  ag.fillStyle = '#4e5662';
  ag.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const v = 64 + Math.floor(rand() * 26);
    ag.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ag.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  ag.strokeStyle = 'rgba(18,22,30,0.58)';
  ag.lineWidth = 2;
  for (let p = 0; p <= 256; p += 64) {
    ag.beginPath();
    ag.moveTo(p, 0);
    ag.lineTo(p, 256);
    ag.stroke();
    ag.beginPath();
    ag.moveTo(0, p);
    ag.lineTo(256, p);
    ag.stroke();
  }
  // Subtle taxiway oil sheen patches
  for (let i = 0; i < 8; i++) {
    const ox = rand() * 256;
    const oy = rand() * 256;
    const rad = 10 + rand() * 18;
    const og = ag.createRadialGradient(ox, oy, 1, ox, oy, rad);
    og.addColorStop(0, 'rgba(18, 22, 28, 0.22)');
    og.addColorStop(1, 'rgba(18, 22, 28, 0)');
    ag.fillStyle = og;
    ag.fillRect(ox - rad, oy - rad, rad * 2, rad * 2);
  }
  const apron = new THREE.CanvasTexture(ac);
  apron.colorSpace = THREE.SRGBColorSpace;
  apron.wrapS = apron.wrapT = THREE.RepeatWrapping;
  apron.anisotropy = maxAnisotropy;

  // 3. Satellite-Style Multi-Tone Terrain Albedo Detail Texture (512x512, neutral luminance for shader blending)
  const gc = document.createElement('canvas');
  gc.width = 512;
  gc.height = 512;
  const gg = gc.getContext('2d')!;
  gg.fillStyle = '#c4cab8';
  gg.fillRect(0, 0, 512, 512);
  // Broad organic vegetation & soil blotches
  for (let i = 0; i < 180; i++) {
    const bx = rand() * 512;
    const by = rand() * 512;
    const br = 18 + rand() * 48;
    const tone = 165 + Math.floor(rand() * 68);
    const bg = gg.createRadialGradient(bx, by, 2, bx, by, br);
    bg.addColorStop(0, `rgba(${tone - 8}, ${tone + 6}, ${tone - 16}, 0.28)`);
    bg.addColorStop(1, `rgba(${tone - 8}, ${tone + 6}, ${tone - 16}, 0)`);
    gg.fillStyle = bg;
    gg.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // Crisp micro grit & grass blades for low-altitude speed sensation
  for (let i = 0; i < 18000; i++) {
    const v = 138 + Math.floor(rand() * 92);
    gg.fillStyle = `rgba(${v},${v + 5},${v - 10},0.34)`;
    gg.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  const grass = new THREE.CanvasTexture(gc);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(240, 240);
  grass.anisotropy = maxAnisotropy;

  // 3b. High-Frequency Terrain & Cliff Detail Normal Map (linear NoColorSpace)
  const tau = Math.PI * 2;
  const terrainDetailNormal = makeNormalFromHeight(
    256,
    (u, v) => {
      const n1 = Math.sin(tau * (u * 5 + v * 3)) * 0.25 + Math.cos(tau * (u * 9 - v * 7)) * 0.18;
      const n2 = Math.sin(tau * (u * 17 + v * 13)) * 0.12 + Math.cos(tau * (u * 29 - v * 23)) * 0.08;
      const strata = Math.sin(tau * (v * 6 + Math.sin(tau * u * 2) * 0.25)) * 0.22;
      return n1 + n2 + strata;
    },
    1.85,
    340,
    340,
    maxAnisotropy
  );

  // 3c. Runway & Tarmac Micro-Grain Asphalt Normal Map (linear NoColorSpace)
  const asphaltNormal = makeNormalFromHeight(
    256,
    (u, v) => {
      const grain =
        Math.sin(tau * (u * 23 + v * 19)) * 0.18 +
        Math.cos(tau * (u * 41 - v * 37)) * 0.14 +
        Math.sin(tau * (u * 67 + v * 53)) * 0.1;
      const seam = Math.exp(-Math.pow((v * 4) % 1 - 0.5, 2) * 280) * -0.32;
      return grain + seam;
    },
    1.5,
    8,
    180,
    maxAnisotropy
  );

  // 4. Airliner Fuselage Texture (crisp windows + navy/amber cheatline)
  const bc = document.createElement('canvas');
  bc.width = 512;
  bc.height = 128;
  const bg = bc.getContext('2d')!;
  bg.fillStyle = '#e8edf2';
  bg.fillRect(0, 0, 512, 128);
  bg.fillStyle = '#94a3b8';
  bg.fillRect(0, 82, 512, 46);
  bg.fillStyle = '#172554';
  bg.fillRect(0, 68, 512, 8);
  bg.fillStyle = '#d97706';
  bg.fillRect(0, 76, 512, 3);
  bg.fillStyle = '#0f172a';
  for (let x = 24; x < 488; x += 14) {
    bg.beginPath();
    bg.roundRect(x, 42, 7, 11, 3);
    bg.fill();
  }
  const airlinerBody = new THREE.CanvasTexture(bc);
  airlinerBody.colorSpace = THREE.SRGBColorSpace;
  airlinerBody.anisotropy = maxAnisotropy;

  // 5. Sharp Glass Skyscraper Curtain-Wall Facade + Paired Roughness & Interior Emissive Maps
  const fc = document.createElement('canvas');
  fc.width = 512;
  fc.height = 1024;
  const fg = fc.getContext('2d')!;

  const frc = document.createElement('canvas');
  frc.width = 512;
  frc.height = 1024;
  const frg = frc.getContext('2d')!;

  const fec = document.createElement('canvas');
  fec.width = 512;
  fec.height = 1024;
  const feg = fec.getContext('2d')!;

  fg.fillStyle = '#141c2b';
  fg.fillRect(0, 0, 512, 1024);
  frg.fillStyle = '#d8d8d8'; // matte concrete/aluminum mullions (roughness ~0.85)
  frg.fillRect(0, 0, 512, 1024);
  feg.fillStyle = '#000000';
  feg.fillRect(0, 0, 512, 1024);

  for (let y = 8; y < 1014; y += 32) {
    // Structural spandrel band between floors
    fg.fillStyle = '#1d283b';
    fg.fillRect(0, y + 22, 512, 8);
    frg.fillStyle = '#999999';
    frg.fillRect(0, y + 22, 512, 8);

    for (let x = 8; x < 504; x += 32) {
      const r = rand();
      const litWarm = r > 0.78;
      const skyBlue = !litWarm && r > 0.36;

      // Specular glass gradient inside each window pane
      const wg = fg.createLinearGradient(x, y, x + 24, y + 20);
      if (litWarm) {
        wg.addColorStop(0, '#c89e5a');
        wg.addColorStop(1, '#7a5d32');
      } else if (skyBlue) {
        wg.addColorStop(0, '#4f86aa');
        wg.addColorStop(1, '#25435c');
      } else {
        wg.addColorStop(0, '#2a3d55');
        wg.addColorStop(1, '#121c2c');
      }
      fg.fillStyle = wg;
      fg.fillRect(x, y, 24, 20);

      // Subtle vertical window mullion sheen highlight
      fg.fillStyle = 'rgba(200, 228, 255, 0.16)';
      fg.fillRect(x + 2, y + 2, 4, 16);

      // Mirror-smooth roughness (~0.10) on glass panes for crisp sun & sky glints
      frg.fillStyle = '#1a1a1a';
      frg.fillRect(x, y, 24, 20);

      // Selective interior warm office lights for dusk/night depth
      if (litWarm) {
        feg.fillStyle = r > 0.89 ? '#ffdca0' : '#b88642';
        feg.fillRect(x + 2, y + 2, 20, 16);
      } else if (r > 0.64) {
        feg.fillStyle = '#244763';
        feg.fillRect(x + 2, y + 2, 20, 16);
      }
    }
  }
  const buildingFacade = new THREE.CanvasTexture(fc);
  buildingFacade.colorSpace = THREE.SRGBColorSpace;
  buildingFacade.wrapS = buildingFacade.wrapT = THREE.RepeatWrapping;
  buildingFacade.anisotropy = maxAnisotropy;

  const buildingRoughness = new THREE.CanvasTexture(frc);
  buildingRoughness.colorSpace = THREE.NoColorSpace;
  buildingRoughness.wrapS = buildingRoughness.wrapT = THREE.RepeatWrapping;
  buildingRoughness.anisotropy = maxAnisotropy;

  const buildingEmissive = new THREE.CanvasTexture(fec);
  buildingEmissive.colorSpace = THREE.SRGBColorSpace;
  buildingEmissive.wrapS = buildingEmissive.wrapT = THREE.RepeatWrapping;
  buildingEmissive.anisotropy = maxAnisotropy;

  // 6. Aircraft Carrier Flight Deck Texture (dark non-skid steel + tire tracks + crisp deck markings)
  const cc = document.createElement('canvas');
  cc.width = 256;
  cc.height = 512;
  const cg = cc.getContext('2d')!;
  cg.fillStyle = '#252c37';
  cg.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 3400; i++) {
    const v = 32 + Math.floor(rand() * 18);
    cg.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    cg.fillRect(rand() * 256, rand() * 512, 2, 2);
  }
  cg.fillStyle = 'rgba(8, 10, 14, 0.35)';
  cg.fillRect(96, 20, 64, 420);
  cg.fillStyle = '#eab308';
  cg.fillRect(10, 0, 5, 512);
  cg.fillRect(241, 0, 5, 512);
  cg.fillStyle = '#e2e8f0';
  for (let y = 16; y < 512; y += 64) {
    cg.fillRect(124, y, 8, 36);
  }
  cg.fillStyle = '#dc2626';
  cg.fillRect(30, 0, 4, 512);
  const carrierDeck = new THREE.CanvasTexture(cc);
  carrierDeck.colorSpace = THREE.SRGBColorSpace;
  carrierDeck.anisotropy = maxAnisotropy;

  // 7. Aerospace Jet Metal Panel-Line & Rivet Texture
  const jc = document.createElement('canvas');
  jc.width = 256;
  jc.height = 256;
  const jg = jc.getContext('2d')!;
  jg.fillStyle = '#8b95a5';
  jg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const v = 122 + Math.floor(rand() * 22);
    jg.fillStyle = `rgba(${v},${v + 4},${v + 9},0.26)`;
    jg.fillRect(rand() * 256, rand() * 256, 4, 4);
  }
  jg.strokeStyle = 'rgba(26,34,48,0.52)';
  jg.lineWidth = 1.5;
  for (let p = 0; p < 256; p += 32) {
    jg.beginPath();
    jg.moveTo(p, 0);
    jg.lineTo(p, 256);
    jg.stroke();
    jg.beginPath();
    jg.moveTo(0, p);
    jg.lineTo(256, p);
    jg.stroke();
  }
  jg.fillStyle = 'rgba(51,65,85,0.42)';
  jg.fillRect(42, 42, 22, 18);
  jg.fillRect(172, 138, 28, 16);
  const jetMetal = new THREE.CanvasTexture(jc);
  jetMetal.colorSpace = THREE.SRGBColorSpace;
  jetMetal.wrapS = jetMetal.wrapT = THREE.RepeatWrapping;
  jetMetal.repeat.set(2, 2);
  jetMetal.anisotropy = maxAnisotropy;

  // 8. Dark Stealth RAM Coating Texture
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 256;
  const sg = sc.getContext('2d')!;
  sg.fillStyle = '#252b35';
  sg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const v = 30 + Math.floor(rand() * 18);
    sg.fillStyle = `rgba(${v},${v + 3},${v + 7},0.45)`;
    sg.fillRect(rand() * 256, rand() * 256, 3, 3);
  }
  sg.strokeStyle = 'rgba(71,85,105,0.45)';
  sg.lineWidth = 2;
  for (let y = 16; y < 256; y += 64) {
    sg.beginPath();
    for (let x = 0; x <= 256; x += 32) {
      sg.lineTo(x, y + (x % 64 === 0 ? -7 : 7));
    }
    sg.stroke();
  }
  const stealthRam = new THREE.CanvasTexture(sc);
  stealthRam.colorSpace = THREE.SRGBColorSpace;
  stealthRam.wrapS = stealthRam.wrapT = THREE.RepeatWrapping;
  stealthRam.repeat.set(2, 2);
  stealthRam.anisotropy = maxAnisotropy;

  // 9. Splinter Camo Blue Texture (Su-35S Flanker-E)
  const cmc = document.createElement('canvas');
  cmc.width = 256;
  cmc.height = 256;
  const cmg = cmc.getContext('2d')!;
  cmg.fillStyle = '#4e6f8c';
  cmg.fillRect(0, 0, 256, 256);
  cmg.fillStyle = '#36485c';
  cmg.beginPath();
  cmg.moveTo(0, 40);
  cmg.lineTo(130, 0);
  cmg.lineTo(180, 110);
  cmg.lineTo(40, 150);
  cmg.closePath();
  cmg.fill();
  cmg.fillStyle = '#6f95b5';
  cmg.beginPath();
  cmg.moveTo(140, 120);
  cmg.lineTo(256, 90);
  cmg.lineTo(256, 230);
  cmg.lineTo(110, 256);
  cmg.closePath();
  cmg.fill();
  cmg.strokeStyle = 'rgba(15,23,42,0.32)';
  cmg.lineWidth = 1.5;
  for (let p = 0; p < 256; p += 32) {
    cmg.beginPath();
    cmg.moveTo(p, 0);
    cmg.lineTo(p, 256);
    cmg.stroke();
  }
  const camoBlue = new THREE.CanvasTexture(cmc);
  camoBlue.colorSpace = THREE.SRGBColorSpace;
  camoBlue.wrapS = camoBlue.wrapT = THREE.RepeatWrapping;
  camoBlue.anisotropy = maxAnisotropy;

  // 10. Seamless Tangent-Space Ocean Wave Normal Map (linear NoColorSpace)
  const waterNormal = makeNormalFromHeight(
    256,
    (u, v) =>
      Math.sin(tau * (u * 3 + v * 2)) * 0.24 +
      Math.cos(tau * (u * 7 - v * 4)) * 0.16 +
      Math.sin(tau * (u * 11 + v * 9)) * 0.08 +
      Math.cos(tau * (v * 4 - u * 2)) * 0.2,
    1.15,
    70,
    120,
    maxAnisotropy
  );

  // 11. Soft Volumetric-Style Cumulus Cloud Puff Billboard Texture (radial multi-lobe density)
  const clc = document.createElement('canvas');
  clc.width = 256;
  clc.height = 256;
  const clg = clc.getContext('2d')!;
  clg.clearRect(0, 0, 256, 256);
  const lobes: [number, number, number, number][] = [
    [128, 128, 102, 0.58],
    [88, 134, 70, 0.44],
    [168, 132, 72, 0.44],
    [128, 92, 66, 0.48],
    [104, 108, 54, 0.36],
    [152, 110, 52, 0.36],
    [128, 148, 76, 0.34],
  ];
  for (const [lx, ly, lr, la] of lobes) {
    const cgGrad = clg.createRadialGradient(lx, ly, lr * 0.08, lx, ly, lr);
    cgGrad.addColorStop(0, `rgba(255, 255, 255, ${la})`);
    cgGrad.addColorStop(0.55, `rgba(246, 250, 255, ${la * 0.62})`);
    cgGrad.addColorStop(1, 'rgba(235, 244, 255, 0)');
    clg.fillStyle = cgGrad;
    clg.beginPath();
    clg.arc(lx, ly, lr, 0, Math.PI * 2);
    clg.fill();
  }
  const cloudPuff = new THREE.CanvasTexture(clc);
  cloudPuff.colorSpace = THREE.SRGBColorSpace;
  cloudPuff.anisotropy = maxAnisotropy;

  return {
    runway,
    apron,
    grass,
    terrainDetailNormal,
    asphaltNormal,
    airlinerBody,
    buildingFacade,
    buildingRoughness,
    buildingEmissive,
    carrierDeck,
    jetMetal,
    stealthRam,
    camoBlue,
    waterNormal,
    cloudPuff,
  };
}
