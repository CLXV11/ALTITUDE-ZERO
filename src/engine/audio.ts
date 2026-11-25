import type { AircraftId } from '../types/flight';

export type ScrapeSurface = 'building' | 'ground' | 'carrier' | 'aircraft';

export class FlightAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  // Persistent zero-GC multi-band aviation engine audio graph
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private washGain: GainNode | null = null;
  private washFilter: BiquadFilterNode | null = null;
  private chopGain: GainNode | null = null;
  private chopBaseGain: GainNode | null = null;
  private chopLfo: OscillatorNode | null = null;
  private chopDepth: GainNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private turbineOsc2: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;
  private turbine2Gain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subFilter: BiquadFilterNode | null = null;
  private subGain: GainNode | null = null;
  private abCrackleFilter: BiquadFilterNode | null = null;
  private abCrackleGain: GainNode | null = null;
  private abCrackleBaseGain: GainNode | null = null;
  private abCrackleLfo: OscillatorNode | null = null;
  private abCrackleDepth: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private tireScrubFilter: BiquadFilterNode | null = null;
  private tireScrubGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Real-time external jet flyby Doppler & jet wash crackle channel
  private flybyTurbineOsc: OscillatorNode | null = null;
  private flybyTurbineFilter: BiquadFilterNode | null = null;
  private flybyTurbineGain: GainNode | null = null;
  private flybyAirFilter: BiquadFilterNode | null = null;
  private flybyAirGain: GainNode | null = null;
  private flybyWashFilter: BiquadFilterNode | null = null;
  private flybyWashGain: GainNode | null = null;
  private flybyCrackleFilter: BiquadFilterNode | null = null;
  private flybyCrackleModGain: GainNode | null = null;
  private flybyCrackleGain: GainNode | null = null;
  private flybyCrackleLfo: OscillatorNode | null = null;
  private flybyPanner: StereoPannerNode | null = null;

  // Procedural stereo reverb send & saturation curve
  private reverbSend: GainNode | null = null;
  private shockCurve: Float32Array<ArrayBuffer> | null = null;

  // Persistent interactive metallic friction & scrape synth channel
  private scrapeOsc1: OscillatorNode | null = null;
  private scrapeOsc2: OscillatorNode | null = null;
  private scrapeResFilter: BiquadFilterNode | null = null;
  private scrapeSynthGain: GainNode | null = null;
  private scrapeNoiseFilter: BiquadFilterNode | null = null;
  private scrapeNoiseGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastStallBeep = 0;
  private lastLockBeep = 0;
  private lastGBreath = 0;
  private lastSparkCrackle = 0;
  private lastSparkBounce = 0;
  private lastTireScreech = 0;
  private lastMetallicImpact = 0;
  private lastOverGBeep = 0;
  private lastFlutterSound = 0;
  private lastEngineSputter = 0;
  private lastSonicBoom = 0;
  private lastGearWarning = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.36, this.ctx.currentTime, 0.05);
    }
  }

  public unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.36;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.008;
    comp.release.value = 0.16;
    master.connect(comp);
    comp.connect(ctx.destination);

    // Rich Pink + Pure White Noise Buffers (2.5s seamless)
    const bufSize = Math.floor(ctx.sampleRate * 2.5);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const whiteBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    const whiteData = whiteBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      whiteData[i] = white * 0.72;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      const pink = (b0 + b1 + b2 + b3 + white * 0.06) * 0.19;
      data[i] = Math.max(-1, Math.min(1, pink));
    }
    this.noiseBuffer = noiseBuf;
    this.whiteNoiseBuffer = whiteBuf;

    // 1. Deep Lowpass Rumble Layer (Jet Afterburner / Heavy Exhaust)
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = noiseBuf;
    rumbleSrc.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 140;
    rumbleFilter.Q.value = 0.7;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumbleSrc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumbleSrc.start();

    // 2. Midband Jet Intake / Airflow Wash Layer
    const washSrc = ctx.createBufferSource();
    washSrc.buffer = noiseBuf;
    washSrc.loop = true;
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = 'bandpass';
    washFilter.frequency.value = 440;
    washFilter.Q.value = 0.55;
    const washGain = ctx.createGain();
    washGain.gain.value = 0;
    washSrc.connect(washFilter);
    washFilter.connect(washGain);
    washGain.connect(master);
    washSrc.start(ctx.currentTime + 0.37);

    // 3. Modulated Prop Layer (Turboprop & Piston blade thump)
    const chopSrc = ctx.createBufferSource();
    chopSrc.buffer = noiseBuf;
    chopSrc.loop = true;
    const chopFilter = ctx.createBiquadFilter();
    chopFilter.type = 'lowpass';
    chopFilter.frequency.value = 340;
    chopFilter.Q.value = 0.9;
    const chopGain = ctx.createGain();
    chopGain.gain.value = 0.55;
    const chopBaseGain = ctx.createGain();
    chopBaseGain.gain.value = 0;

    const chopLfo = ctx.createOscillator();
    chopLfo.type = 'sine';
    chopLfo.frequency.value = 20;
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.32;
    chopLfo.connect(chopDepth);
    chopDepth.connect(chopGain.gain);
    chopLfo.start();

    chopSrc.connect(chopFilter);
    chopFilter.connect(chopGain);
    chopGain.connect(chopBaseGain);
    chopBaseGain.connect(master);
    chopSrc.start(ctx.currentTime + 0.81);

    // Soft-clipping shockwave saturation curve for sonic booms & heavy ordnance
    const curveLen = 512;
    const shockCurve: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(curveLen * 4));
    for (let i = 0; i < curveLen; i++) {
      const x = (i * 2) / (curveLen - 1) - 1;
      shockCurve[i] = Math.tanh(x * 2.8);
    }
    this.shockCurve = shockCurve;

    // Procedural Stereo Impulse-Response Convolver Reverb (1.9s atmospheric outdoor reflection tail)
    const irLen = Math.floor(ctx.sampleRate * 1.9);
    const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const chData = irBuf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        const env = Math.pow(1 - t, 2.8) * (i < 600 ? i / 600 : 1);
        const raw = (Math.random() * 2 - 1) * env;
        lp = lp * 0.68 + raw * 0.32;
        chData[i] = lp * (ch === 0 ? 0.95 : 1.0);
      }
    }
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1.0;
    const convolver = ctx.createConvolver();
    convolver.buffer = irBuf;
    const reverbLp = ctx.createBiquadFilter();
    reverbLp.type = 'lowpass';
    reverbLp.frequency.value = 2400;
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.28;
    reverbSend.connect(convolver);
    convolver.connect(reverbLp);
    reverbLp.connect(reverbWet);
    reverbWet.connect(master);
    this.reverbSend = reverbSend;

    // 4. Dual-Spool Turbine & Fan Blade Harmonics
    const turbineOsc = ctx.createOscillator();
    turbineOsc.type = 'sine';
    turbineOsc.frequency.value = 280;
    const turbineGain = ctx.createGain();
    turbineGain.gain.value = 0;
    turbineOsc.connect(turbineGain);
    turbineGain.connect(master);
    turbineOsc.start();

    const turbineOsc2 = ctx.createOscillator();
    turbineOsc2.type = 'triangle';
    turbineOsc2.frequency.value = 420;
    const turbine2Filter = ctx.createBiquadFilter();
    turbine2Filter.type = 'lowpass';
    turbine2Filter.frequency.value = 1100;
    const turbine2Gain = ctx.createGain();
    turbine2Gain.gain.value = 0;
    turbineOsc2.connect(turbine2Filter);
    turbine2Filter.connect(turbine2Gain);
    turbine2Gain.connect(master);
    turbineOsc2.start();

    // 5. Warm Filtered Sub-Bass Engine Pulse
    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.value = 48;
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.value = 160;
    const subGain = ctx.createGain();
    subGain.gain.value = 0;
    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(master);
    subOsc.start();

    // 5b. Supersonic Afterburner Shock-Diamond Crackle Layer
    const abCrackleSrc = ctx.createBufferSource();
    abCrackleSrc.buffer = whiteBuf;
    abCrackleSrc.loop = true;
    const abCrackleFilter = ctx.createBiquadFilter();
    abCrackleFilter.type = 'bandpass';
    abCrackleFilter.frequency.value = 1450;
    abCrackleFilter.Q.value = 0.78;
    const abCrackleGain = ctx.createGain();
    abCrackleGain.gain.value = 0.55;
    const abCrackleBaseGain = ctx.createGain();
    abCrackleBaseGain.gain.value = 0;
    const abCrackleLfo = ctx.createOscillator();
    abCrackleLfo.type = 'sawtooth';
    abCrackleLfo.frequency.value = 46;
    const abCrackleDepth = ctx.createGain();
    abCrackleDepth.gain.value = 0.42;
    abCrackleLfo.connect(abCrackleDepth);
    abCrackleDepth.connect(abCrackleGain.gain);
    abCrackleLfo.start();
    abCrackleSrc.connect(abCrackleFilter);
    abCrackleFilter.connect(abCrackleGain);
    abCrackleGain.connect(abCrackleBaseGain);
    abCrackleBaseGain.connect(master);
    abCrackleSrc.start(ctx.currentTime + 0.47);

    // 6. Runway Tire Roll Rumble + Bandpass Asphalt Tire Scrub (Pink + White Noise, zero tonal whistle)
    const rollSrc = ctx.createBufferSource();
    rollSrc.buffer = noiseBuf;
    rollSrc.loop = true;
    const rollFilter = ctx.createBiquadFilter();
    rollFilter.type = 'lowpass';
    rollFilter.frequency.value = 125;
    rollFilter.Q.value = 0.7;
    const rollGain = ctx.createGain();
    rollGain.gain.value = 0;
    rollSrc.connect(rollFilter);
    rollFilter.connect(rollGain);
    rollGain.connect(master);
    rollSrc.start(ctx.currentTime + 1.13);

    const tireScrubSrc = ctx.createBufferSource();
    tireScrubSrc.buffer = whiteBuf;
    tireScrubSrc.loop = true;
    const tireScrubFilter = ctx.createBiquadFilter();
    tireScrubFilter.type = 'bandpass';
    tireScrubFilter.frequency.value = 420;
    tireScrubFilter.Q.value = 0.75;
    const tireScrubGain = ctx.createGain();
    tireScrubGain.gain.value = 0;
    tireScrubSrc.connect(tireScrubFilter);
    tireScrubFilter.connect(tireScrubGain);
    tireScrubGain.connect(master);
    tireScrubSrc.start(ctx.currentTime + 0.61);

    // 6b. Airframe Wind Rush (Bandpass-filtered White/Pink Noise modulated by airspeed & G-load)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = whiteBuf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 280;
    windFilter.Q.value = 0.72;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start(ctx.currentTime + 0.19);

    // 6c. Real-Time Jet Flyby Doppler & Jet Wash Crackle Channel
    const flybyPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const flybyOut: AudioNode = flybyPanner || master;
    if (flybyPanner) {
      flybyPanner.connect(master);
      flybyPanner.connect(reverbSend);
    }

    const flybyTurbineOsc = ctx.createOscillator();
    flybyTurbineOsc.type = 'sawtooth';
    flybyTurbineOsc.frequency.value = 340;
    const flybyTurbineFilter = ctx.createBiquadFilter();
    flybyTurbineFilter.type = 'lowpass';
    flybyTurbineFilter.frequency.value = 1800;
    flybyTurbineFilter.Q.value = 1.4;
    const flybyTurbineGain = ctx.createGain();
    flybyTurbineGain.gain.value = 0;
    flybyTurbineOsc.connect(flybyTurbineFilter);
    flybyTurbineFilter.connect(flybyTurbineGain);
    flybyTurbineGain.connect(flybyOut);
    flybyTurbineOsc.start();

    const flybyAirSrc = ctx.createBufferSource();
    flybyAirSrc.buffer = whiteBuf;
    flybyAirSrc.loop = true;
    const flybyAirFilter = ctx.createBiquadFilter();
    flybyAirFilter.type = 'bandpass';
    flybyAirFilter.frequency.value = 920;
    flybyAirFilter.Q.value = 1.1;
    const flybyAirGain = ctx.createGain();
    flybyAirGain.gain.value = 0;
    flybyAirSrc.connect(flybyAirFilter);
    flybyAirFilter.connect(flybyAirGain);
    flybyAirGain.connect(flybyOut);
    flybyAirSrc.start(ctx.currentTime + 0.29);

    const flybyWashSrc = ctx.createBufferSource();
    flybyWashSrc.buffer = noiseBuf;
    flybyWashSrc.loop = true;
    const flybyWashFilter = ctx.createBiquadFilter();
    flybyWashFilter.type = 'lowpass';
    flybyWashFilter.frequency.value = 420;
    flybyWashFilter.Q.value = 0.7;
    const flybyWashGain = ctx.createGain();
    flybyWashGain.gain.value = 0;
    flybyWashSrc.connect(flybyWashFilter);
    flybyWashFilter.connect(flybyWashGain);
    flybyWashGain.connect(flybyOut);
    flybyWashSrc.start(ctx.currentTime + 0.73);

    const flybyCrackleSrc = ctx.createBufferSource();
    flybyCrackleSrc.buffer = whiteBuf;
    flybyCrackleSrc.loop = true;
    const flybyCrackleFilter = ctx.createBiquadFilter();
    flybyCrackleFilter.type = 'bandpass';
    flybyCrackleFilter.frequency.value = 1850;
    flybyCrackleFilter.Q.value = 0.85;
    const flybyCrackleModGain = ctx.createGain();
    flybyCrackleModGain.gain.value = 0.55;
    const flybyCrackleGain = ctx.createGain();
    flybyCrackleGain.gain.value = 0;
    const flybyCrackleLfo = ctx.createOscillator();
    flybyCrackleLfo.type = 'sawtooth';
    flybyCrackleLfo.frequency.value = 44;
    const flybyCrackleDepth = ctx.createGain();
    flybyCrackleDepth.gain.value = 0.45;
    flybyCrackleLfo.connect(flybyCrackleDepth);
    flybyCrackleDepth.connect(flybyCrackleModGain.gain);
    flybyCrackleLfo.start();
    flybyCrackleSrc.connect(flybyCrackleFilter);
    flybyCrackleFilter.connect(flybyCrackleModGain);
    flybyCrackleModGain.connect(flybyCrackleGain);
    flybyCrackleGain.connect(flybyOut);
    flybyCrackleSrc.start(ctx.currentTime + 1.07);

    // 7. Continuous Interactive Friction & Impact Scrape Channel
    const scrapeOsc1 = ctx.createOscillator();
    scrapeOsc1.type = 'sawtooth';
    scrapeOsc1.frequency.value = 640;
    const scrapeOsc2 = ctx.createOscillator();
    scrapeOsc2.type = 'square';
    scrapeOsc2.frequency.value = 1040;
    const scrapeResFilter = ctx.createBiquadFilter();
    scrapeResFilter.type = 'bandpass';
    scrapeResFilter.frequency.value = 880;
    scrapeResFilter.Q.value = 2.0;
    const scrapeSynthGain = ctx.createGain();
    scrapeSynthGain.gain.value = 0;
    scrapeOsc1.connect(scrapeResFilter);
    scrapeOsc2.connect(scrapeResFilter);
    scrapeResFilter.connect(scrapeSynthGain);
    scrapeSynthGain.connect(master);
    scrapeOsc1.start();
    scrapeOsc2.start();

    const scrapeNoiseSrc = ctx.createBufferSource();
    scrapeNoiseSrc.buffer = whiteBuf;
    scrapeNoiseSrc.loop = true;
    const scrapeNoiseFilter = ctx.createBiquadFilter();
    scrapeNoiseFilter.type = 'bandpass';
    scrapeNoiseFilter.frequency.value = 520;
    scrapeNoiseFilter.Q.value = 0.85;
    const scrapeNoiseGain = ctx.createGain();
    scrapeNoiseGain.gain.value = 0;
    scrapeNoiseSrc.connect(scrapeNoiseFilter);
    scrapeNoiseFilter.connect(scrapeNoiseGain);
    scrapeNoiseGain.connect(master);
    scrapeNoiseSrc.start(ctx.currentTime + 1.57);

    this.ctx = ctx;
    this.master = master;
    this.rumbleGain = rumbleGain;
    this.rumbleFilter = rumbleFilter;
    this.washGain = washGain;
    this.washFilter = washFilter;
    this.chopGain = chopGain;
    this.chopBaseGain = chopBaseGain;
    this.chopLfo = chopLfo;
    this.chopDepth = chopDepth;
    this.turbineOsc = turbineOsc;
    this.turbineOsc2 = turbineOsc2;
    this.turbineGain = turbineGain;
    this.turbine2Gain = turbine2Gain;
    this.subOsc = subOsc;
    this.subFilter = subFilter;
    this.subGain = subGain;
    this.abCrackleFilter = abCrackleFilter;
    this.abCrackleGain = abCrackleGain;
    this.abCrackleBaseGain = abCrackleBaseGain;
    this.abCrackleLfo = abCrackleLfo;
    this.abCrackleDepth = abCrackleDepth;
    this.rollGain = rollGain;
    this.rollFilter = rollFilter;
    this.tireScrubFilter = tireScrubFilter;
    this.tireScrubGain = tireScrubGain;
    this.windFilter = windFilter;
    this.windGain = windGain;
    this.flybyTurbineOsc = flybyTurbineOsc;
    this.flybyTurbineFilter = flybyTurbineFilter;
    this.flybyTurbineGain = flybyTurbineGain;
    this.flybyAirFilter = flybyAirFilter;
    this.flybyAirGain = flybyAirGain;
    this.flybyWashFilter = flybyWashFilter;
    this.flybyWashGain = flybyWashGain;
    this.flybyCrackleFilter = flybyCrackleFilter;
    this.flybyCrackleModGain = flybyCrackleModGain;
    this.flybyCrackleGain = flybyCrackleGain;
    this.flybyCrackleLfo = flybyCrackleLfo;
    this.flybyPanner = flybyPanner;
    this.scrapeOsc1 = scrapeOsc1;
    this.scrapeOsc2 = scrapeOsc2;
    this.scrapeResFilter = scrapeResFilter;
    this.scrapeSynthGain = scrapeSynthGain;
    this.scrapeNoiseFilter = scrapeNoiseFilter;
    this.scrapeNoiseGain = scrapeNoiseGain;
  }

  public updateEngine(
    active: boolean,
    aircraftId: AircraftId,
    throttle: number,
    speedMs: number,
    stalling: boolean,
    onGround = false,
    gLoad = 1.0
  ): void {
    if (
      !this.ctx ||
      !this.rumbleGain ||
      !this.rumbleFilter ||
      !this.washGain ||
      !this.washFilter ||
      !this.chopBaseGain ||
      !this.chopLfo ||
      !this.chopDepth ||
      !this.turbineOsc ||
      !this.turbineGain ||
      !this.subOsc ||
      !this.subFilter ||
      !this.subGain ||
      !this.rollGain ||
      !this.rollFilter ||
      !this.tireScrubFilter ||
      !this.tireScrubGain ||
      !this.windFilter ||
      !this.windGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.rumbleGain.gain.setTargetAtTime(0, now, 0.08);
      this.washGain.gain.setTargetAtTime(0, now, 0.08);
      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0, now, 0.08);
      this.subGain.gain.setTargetAtTime(0, now, 0.08);
      this.abCrackleBaseGain?.gain.setTargetAtTime(0, now, 0.06);
      this.rollGain.gain.setTargetAtTime(0, now, 0.08);
      this.tireScrubGain.gain.setTargetAtTime(0, now, 0.08);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Deep runway tire rumble + asphalt scrub noise (zero whistling oscillators)
    const groundSpd = onGround && speedMs > 4 ? Math.min(1, (speedMs - 4) / 85) : 0;
    const rollVol = groundSpd * 0.19;
    this.rollFilter.frequency.setTargetAtTime(95 + groundSpd * 85, now, 0.06);
    this.rollGain.gain.setTargetAtTime(rollVol, now, 0.06);
    this.tireScrubFilter.frequency.setTargetAtTime(310 + groundSpd * 340, now, 0.06);
    this.tireScrubGain.gain.setTargetAtTime(groundSpd * 0.045, now, 0.06);

    // Bandpass-filtered aerodynamic wind rush driven by airspeed & G-load buffet
    const gExcess = Math.max(0, Math.abs(gLoad - 1) - 0.35);
    const windHz = Math.min(980, 155 + speedMs * 2.1 + Math.min(260, gExcess * 38));
    const windVol = Math.min(
      0.24,
      Math.max(0, speedMs - 14) * 0.00048 + (!onGround ? Math.min(0.11, gExcess * 0.014) : 0)
    );
    this.windFilter.frequency.setTargetAtTime(windHz, now, 0.08);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.08);

    const spdFactor = Math.min(1, speedMs / 350);
    const ab = throttle > 0.72 ? (throttle - 0.72) / 0.28 : 0;

    if (
      aircraftId === 'f18' ||
      aircraftId === 'sukhoi' ||
      aircraftId === 'f22' ||
      aircraftId === 'rafale'
    ) {
      // Twin-engine military fighter roar + dual-spool beat + intense afterburner crackle
      this.rumbleFilter.frequency.setTargetAtTime(118 + throttle * 150 + ab * 195, now, 0.07);
      this.rumbleGain.gain.setTargetAtTime(0.13 + throttle * 0.23 + ab * 0.26, now, 0.07);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.55;
      this.washFilter.frequency.setTargetAtTime(295 + throttle * 670 + spdFactor * 640, now, 0.07);
      this.washGain.gain.setTargetAtTime(0.065 + throttle * 0.145 + spdFactor * 0.12 + ab * 0.09, now, 0.07);

      const tHz = 215 + throttle * 175;
      this.turbineOsc.frequency.setTargetAtTime(tHz, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0.0065 + throttle * 0.012, now, 0.08);
      this.turbineOsc2?.frequency.setTargetAtTime(tHz * 1.49, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0.004 + throttle * 0.009 + ab * 0.004, now, 0.08);

      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime(42 + throttle * 26, now, 0.08);
      this.subFilter.frequency.setTargetAtTime(125, now, 0.08);
      this.subGain.gain.setTargetAtTime(0.028 + throttle * 0.052 + ab * 0.045, now, 0.08);

      this.abCrackleFilter?.frequency.setTargetAtTime(1350 + ab * 950, now, 0.05);
      this.abCrackleLfo?.frequency.setTargetAtTime(42 + ab * 26, now, 0.06);
      this.abCrackleBaseGain?.gain.setTargetAtTime(ab > 0.02 ? 0.03 + ab * 0.125 : 0, now, 0.06);
    } else if (aircraftId === 'f35' || aircraftId === 'f16') {
      // Single-engine heavy F135 / F110 deep growl + aggressive afterburner crackle
      const isF35 = aircraftId === 'f35';
      this.rumbleFilter.frequency.setTargetAtTime((isF35 ? 98 : 114) + throttle * 145 + ab * 185, now, 0.07);
      this.rumbleGain.gain.setTargetAtTime(0.13 + throttle * 0.24 + ab * 0.25, now, 0.07);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.58;
      this.washFilter.frequency.setTargetAtTime((isF35 ? 245 : 285) + throttle * 620 + spdFactor * 590, now, 0.07);
      this.washGain.gain.setTargetAtTime(0.06 + throttle * 0.14 + spdFactor * 0.11 + ab * 0.085, now, 0.07);

      const tHz = (isF35 ? 185 : 225) + throttle * 165;
      this.turbineOsc.frequency.setTargetAtTime(tHz, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0.007 + throttle * 0.011, now, 0.08);
      this.turbineOsc2?.frequency.setTargetAtTime(tHz * 2.02, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0.002 + throttle * 0.005, now, 0.08);

      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime((isF35 ? 35 : 43) + throttle * 24, now, 0.08);
      this.subFilter.frequency.setTargetAtTime(isF35 ? 110 : 124, now, 0.08);
      this.subGain.gain.setTargetAtTime((isF35 ? 0.036 : 0.026) + throttle * 0.055 + ab * 0.048, now, 0.08);

      this.abCrackleFilter?.frequency.setTargetAtTime((isF35 ? 1150 : 1480) + ab * 900, now, 0.05);
      this.abCrackleLfo?.frequency.setTargetAtTime(48 + ab * 24, now, 0.06);
      this.abCrackleBaseGain?.gain.setTargetAtTime(ab > 0.02 ? 0.028 + ab * 0.115 : 0, now, 0.06);
    } else if (aircraftId === 'concorde' || aircraftId === 'sr71') {
      // 4-engine / twin-J58 heavy supersonic Mach rumble + deep sustained crackle
      const isConcorde = aircraftId === 'concorde';
      this.rumbleFilter.frequency.setTargetAtTime(92 + throttle * 135 + ab * 190, now, 0.07);
      this.rumbleGain.gain.setTargetAtTime(0.15 + throttle * 0.25 + ab * 0.27, now, 0.07);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.5;
      this.washFilter.frequency.setTargetAtTime(240 + throttle * 560 + spdFactor * 660, now, 0.07);
      this.washGain.gain.setTargetAtTime(0.07 + throttle * 0.15 + spdFactor * 0.13 + ab * 0.08, now, 0.07);

      const tHz = (isConcorde ? 195 : 245) + throttle * 165;
      this.turbineOsc.frequency.setTargetAtTime(tHz, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0.006 + throttle * 0.01, now, 0.08);
      this.turbineOsc2?.frequency.setTargetAtTime(tHz * 0.505, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0.008 + throttle * 0.012, now, 0.08);

      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime(29 + throttle * 20, now, 0.08);
      this.subFilter.frequency.setTargetAtTime(98, now, 0.08);
      this.subGain.gain.setTargetAtTime(0.042 + throttle * 0.062 + ab * 0.052, now, 0.08);

      this.abCrackleFilter?.frequency.setTargetAtTime(1100 + ab * 780, now, 0.05);
      this.abCrackleLfo?.frequency.setTargetAtTime(36 + ab * 20, now, 0.06);
      this.abCrackleBaseGain?.gain.setTargetAtTime(ab > 0.02 ? 0.032 + ab * 0.11 : 0, now, 0.06);
    } else if (aircraftId === 'a10' || aircraftId === 'airliner') {
      // Smooth High-Bypass Turbofan Whistle + Acoustic Airliner / TF34 Fan Sing
      const fanSpd = Math.min(1, speedMs / 260);
      this.rumbleFilter.frequency.setTargetAtTime(88 + throttle * 112, now, 0.08);
      this.rumbleGain.gain.setTargetAtTime(0.095 + throttle * 0.21, now, 0.08);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.62;
      this.washFilter.frequency.setTargetAtTime(235 + throttle * 490 + fanSpd * 420, now, 0.08);
      this.washGain.gain.setTargetAtTime(0.05 + throttle * 0.15 + fanSpd * 0.09, now, 0.08);

      const fanHz = (aircraftId === 'a10' ? 310 : 260) + throttle * 240;
      this.turbineOsc.frequency.setTargetAtTime(fanHz, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0.008 + throttle * 0.013, now, 0.08);
      this.turbineOsc2?.frequency.setTargetAtTime(fanHz * 2.0, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0.003 + throttle * 0.006, now, 0.08);

      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.06);
      this.abCrackleBaseGain?.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime(38 + throttle * 22, now, 0.08);
      this.subFilter.frequency.setTargetAtTime(115, now, 0.08);
      this.subGain.gain.setTargetAtTime(0.02 + throttle * 0.04, now, 0.08);
    } else if (aircraftId === 'b2' || aircraftId === 'f117') {
      // Hushed Stealth Ducted Turbofan Rumble
      const fanSpd = Math.min(1, speedMs / 250);
      this.rumbleFilter.frequency.setTargetAtTime(82 + throttle * 96, now, 0.08);
      this.rumbleGain.gain.setTargetAtTime(0.09 + throttle * 0.19, now, 0.08);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.55;
      this.washFilter.frequency.setTargetAtTime(195 + throttle * 380 + fanSpd * 340, now, 0.08);
      this.washGain.gain.setTargetAtTime(0.045 + throttle * 0.135 + fanSpd * 0.08, now, 0.08);

      this.turbineOsc.frequency.setTargetAtTime(155 + throttle * 105, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(0.003 + throttle * 0.006, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(0, now, 0.08);

      this.chopBaseGain.gain.setTargetAtTime(0, now, 0.06);
      this.abCrackleBaseGain?.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime(34 + throttle * 18, now, 0.08);
      this.subFilter.frequency.setTargetAtTime(102, now, 0.08);
      this.subGain.gain.setTargetAtTime(0.022 + throttle * 0.042, now, 0.08);
    } else {
      // Realistic Piston & 4-Engine Turboprop (Rhythmic Blade Chop + Prop Airwash)
      const isHercules = aircraftId === 'hercules';
      const rpm = isHercules ? 28 + throttle * 26 : 19 + throttle * 24;
      this.chopLfo.frequency.setTargetAtTime(rpm, now, 0.06);
      this.chopDepth.gain.setTargetAtTime(isHercules ? 0.36 : 0.32, now, 0.06);
      this.chopBaseGain.gain.setTargetAtTime((isHercules ? 0.16 : 0.14) + throttle * 0.21, now, 0.07);

      this.rumbleFilter.frequency.setTargetAtTime(108 + throttle * 112, now, 0.08);
      this.rumbleGain.gain.setTargetAtTime(0.085 + throttle * 0.145, now, 0.08);

      this.washFilter.type = 'bandpass';
      this.washFilter.Q.value = 0.55;
      this.washFilter.frequency.setTargetAtTime(210 + speedMs * 3.8, now, 0.09);
      this.washGain.gain.setTargetAtTime(Math.min(0.18, 0.03 + throttle * 0.08 + speedMs * 0.0012), now, 0.09);

      this.turbineOsc.frequency.setTargetAtTime(215 + throttle * 95, now, 0.08);
      this.turbineGain.gain.setTargetAtTime(isHercules ? 0.0065 + throttle * 0.009 : 0, now, 0.08);
      this.turbineOsc2?.frequency.setTargetAtTime(430 + throttle * 180, now, 0.08);
      this.turbine2Gain?.gain.setTargetAtTime(isHercules ? 0.003 + throttle * 0.005 : 0, now, 0.08);

      this.abCrackleBaseGain?.gain.setTargetAtTime(0, now, 0.06);
      this.subOsc.frequency.setTargetAtTime(rpm * 1.5, now, 0.07);
      this.subFilter.frequency.setTargetAtTime(135, now, 0.07);
      this.subGain.gain.setTargetAtTime(0.048 + throttle * 0.072, now, 0.07);
    }

    if (stalling && now - this.lastStallBeep > 0.65) {
      this.lastStallBeep = now;
      this.playTone(540, 0.11, 'sine', 0.13);
      setTimeout(() => this.playTone(440, 0.11, 'sine', 0.1), 110);
    }
  }

  public updateFlyby(
    active: boolean,
    distM: number,
    closingSpeedMs: number,
    aircraftSpeedMs: number,
    throttle: number,
    isMilitaryJet: boolean,
    pan = 0
  ): void {
    if (
      !this.ctx ||
      !this.flybyTurbineOsc ||
      !this.flybyTurbineFilter ||
      !this.flybyTurbineGain ||
      !this.flybyAirFilter ||
      !this.flybyAirGain ||
      !this.flybyWashFilter ||
      !this.flybyWashGain ||
      !this.flybyCrackleFilter ||
      !this.flybyCrackleGain ||
      !this.flybyCrackleLfo
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted || distM > 1800 || aircraftSpeedMs < 25) {
      this.flybyTurbineGain.gain.setTargetAtTime(0, now, 0.09);
      this.flybyAirGain.gain.setTargetAtTime(0, now, 0.09);
      this.flybyWashGain.gain.setTargetAtTime(0, now, 0.09);
      this.flybyCrackleGain.gain.setTargetAtTime(0, now, 0.09);
      return;
    }

    if (this.flybyPanner) {
      this.flybyPanner.pan.setTargetAtTime(Math.max(-0.92, Math.min(0.92, pan)), now, 0.05);
    }

    // Acoustic Doppler Shift + Air-Absorption Lowpass + Jet Wash Crackle
    const c = 343;
    const clampedClosing = Math.max(-290, Math.min(295, closingSpeedMs));
    const doppler = Math.max(0.52, Math.min(1.85, c / (c - clampedClosing)));
    const rawAtt = Math.max(0, Math.min(1, 1 - distM / 1800));
    const att = rawAtt * rawAtt * Math.min(1.15, 0.45 + aircraftSpeedMs / 240);

    // Approach aspect (1 when flying straight toward observer, 0 when passing/receding)
    const approachRatio = Math.max(0, Math.min(1, (clampedClosing + 30) / Math.max(80, aircraftSpeedMs)));
    // Receding exhaust aspect (0 when approaching, 1 overhead/receding)
    const exhaustRatio = Math.max(0, Math.min(1, 1 - clampedClosing / Math.max(70, aircraftSpeedMs * 0.7)));

    // Air absorption filter rolls off highs with distance, opens sharply overhead
    const airAbsorptionHz = Math.max(380, Math.min(4800, 4400 * Math.pow(rawAtt, 0.65) * (0.7 + 0.4 * doppler)));

    const baseWhine = (isMilitaryJet ? 290 : 210) + throttle * 165;
    this.flybyTurbineOsc.frequency.setTargetAtTime(baseWhine * doppler, now, 0.04);
    this.flybyTurbineFilter.frequency.setTargetAtTime(airAbsorptionHz, now, 0.05);
    this.flybyTurbineGain.gain.setTargetAtTime(
      att * (0.012 + approachRatio * 0.024) * (isMilitaryJet ? 1.15 : 0.75),
      now,
      0.05
    );

    // High-velocity approach air scream
    this.flybyAirFilter.frequency.setTargetAtTime(Math.min(3600, (680 + aircraftSpeedMs * 3.1) * doppler), now, 0.05);
    this.flybyAirGain.gain.setTargetAtTime(att * (0.04 + approachRatio * 0.14), now, 0.05);

    // Thunderous exhaust wash roar as jet sweeps past & away
    this.flybyWashFilter.frequency.setTargetAtTime(
      Math.max(180, Math.min(1400, (320 + throttle * 460 + exhaustRatio * 340) * Math.min(1.15, doppler))),
      now,
      0.05
    );
    this.flybyWashGain.gain.setTargetAtTime(att * (0.06 + exhaustRatio * (0.24 + throttle * 0.14)), now, 0.05);

    // Characteristic supersonic/jet-wash crackle in the receding exhaust cone
    this.flybyCrackleFilter.frequency.setTargetAtTime(1450 + exhaustRatio * 750, now, 0.05);
    this.flybyCrackleLfo.frequency.setTargetAtTime(36 + throttle * 26, now, 0.06);
    const crackleAmp = isMilitaryJet ? att * exhaustRatio * (0.08 + throttle * 0.13) : att * exhaustRatio * 0.035;
    this.flybyCrackleGain.gain.setTargetAtTime(crackleAmp, now, 0.05);
  }

  public updateSkydiveWind(active: boolean, speedMs: number, parachuteOpen: boolean): void {
    if (
      !this.ctx ||
      !this.rumbleGain ||
      !this.washGain ||
      !this.washFilter ||
      !this.chopBaseGain ||
      !this.turbineGain ||
      !this.subGain ||
      !this.rollGain ||
      !this.tireScrubGain ||
      !this.windFilter ||
      !this.windGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    this.rumbleGain.gain.setTargetAtTime(0, now, 0.08);
    this.chopBaseGain.gain.setTargetAtTime(0, now, 0.08);
    this.turbineGain.gain.setTargetAtTime(0, now, 0.08);
    this.turbine2Gain?.gain.setTargetAtTime(0, now, 0.08);
    this.abCrackleBaseGain?.gain.setTargetAtTime(0, now, 0.06);
    this.subGain.gain.setTargetAtTime(0, now, 0.08);
    this.rollGain.gain.setTargetAtTime(0, now, 0.08);
    this.tireScrubGain.gain.setTargetAtTime(0, now, 0.08);
    if (this.scrapeSynthGain) this.scrapeSynthGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.scrapeNoiseGain) this.scrapeNoiseGain.gain.setTargetAtTime(0, now, 0.05);

    if (!active || this.muted) {
      this.washGain.gain.setTargetAtTime(0, now, 0.08);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    this.washFilter.type = 'bandpass';
    this.washFilter.Q.value = 0.55;
    const windPitch = parachuteOpen ? 210 + speedMs * 8 : 280 + speedMs * 11;
    this.washFilter.frequency.setTargetAtTime(Math.min(1200, windPitch), now, 0.08);
    const vol = parachuteOpen
      ? Math.min(0.12, speedMs * 0.0045)
      : Math.min(0.24, speedMs * 0.004);
    this.washGain.gain.setTargetAtTime(vol, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(Math.min(1100, 190 + speedMs * 9), now, 0.08);
    this.windGain.gain.setTargetAtTime(Math.min(0.22, speedMs * 0.0038), now, 0.08);
  }

  public playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private playNoiseBurst(
    dur: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    vol: number,
    useWhite = false,
    q = 1.0
  ): void {
    const buf = useWhite && this.whiteNoiseBuffer ? this.whiteNoiseBuffer : this.noiseBuffer;
    if (!this.ctx || !this.master || !buf || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  public playMissileLaunch(distanceScale = 1, distanceM = 0): void {
    if (this.muted || !this.ctx || !this.master) return;
    const d = Math.max(0.16, Math.min(1, distanceScale));
    const delay = Math.min(2.2, Math.max(0, distanceM) / 343);
    const t0 = this.ctx.currentTime + delay;

    // 1) Crisp mechanical pylon release clunk (200Hz -> 55Hz transient) + latch snap
    const clunkOsc = this.ctx.createOscillator();
    const clunkGain = this.ctx.createGain();
    clunkOsc.type = 'triangle';
    clunkOsc.frequency.setValueAtTime(200, t0);
    clunkOsc.frequency.exponentialRampToValueAtTime(55, t0 + 0.095);
    clunkGain.gain.setValueAtTime(0.001, t0);
    clunkGain.gain.linearRampToValueAtTime(0.35 * d, t0 + 0.006);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.115);
    clunkOsc.connect(clunkGain);
    clunkGain.connect(this.master);
    clunkOsc.start(t0);
    clunkOsc.stop(t0 + 0.125);

    if (this.whiteNoiseBuffer) {
      const latchSrc = this.ctx.createBufferSource();
      latchSrc.buffer = this.whiteNoiseBuffer;
      const latchFilter = this.ctx.createBiquadFilter();
      latchFilter.type = 'bandpass';
      latchFilter.Q.value = 2.6;
      latchFilter.frequency.setValueAtTime(1250, t0);
      latchFilter.frequency.exponentialRampToValueAtTime(340, t0 + 0.055);
      const latchG = this.ctx.createGain();
      latchG.gain.setValueAtTime(0.24 * d, t0);
      latchG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);
      latchSrc.connect(latchFilter);
      latchFilter.connect(latchG);
      latchG.connect(this.master);
      latchSrc.start(t0);
      latchSrc.stop(t0 + 0.07);
    }

    // 2) Rocket motor ignition at t = 0.18s (bandpass noise + 160Hz -> 480Hz sawtooth harmonic + Doppler drop)
    const tIgnite = t0 + 0.18;
    const rocketBuf = this.whiteNoiseBuffer || this.noiseBuffer;
    if (rocketBuf) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = rocketBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.68;
      bp.frequency.setValueAtTime(1950, tIgnite);
      bp.frequency.exponentialRampToValueAtTime(1250, tIgnite + 0.24);
      bp.frequency.exponentialRampToValueAtTime(290, tIgnite + 1.5);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, tIgnite);
      ng.gain.linearRampToValueAtTime(0.5 * d, tIgnite + 0.025);
      ng.gain.exponentialRampToValueAtTime(0.001, tIgnite + 1.55);
      nSrc.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      if (this.reverbSend) ng.connect(this.reverbSend);
      nSrc.start(tIgnite);
      nSrc.stop(tIgnite + 1.6);
    }

    const saw = this.ctx.createOscillator();
    const sawFilter = this.ctx.createBiquadFilter();
    const sawGain = this.ctx.createGain();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(160, tIgnite);
    saw.frequency.exponentialRampToValueAtTime(480, tIgnite + 0.2);
    saw.frequency.exponentialRampToValueAtTime(145, tIgnite + 1.42);

    sawFilter.type = 'lowpass';
    sawFilter.Q.value = 1.15;
    sawFilter.frequency.setValueAtTime(1650, tIgnite);
    sawFilter.frequency.exponentialRampToValueAtTime(420, tIgnite + 1.42);

    sawGain.gain.setValueAtTime(0.001, tIgnite);
    sawGain.gain.linearRampToValueAtTime(0.26 * d, tIgnite + 0.03);
    sawGain.gain.exponentialRampToValueAtTime(0.001, tIgnite + 1.44);

    saw.connect(sawFilter);
    sawFilter.connect(sawGain);
    sawGain.connect(this.master);
    if (this.reverbSend) sawGain.connect(this.reverbSend);
    saw.start(tIgnite);
    saw.stop(tIgnite + 1.5);
  }

  public playExplosion(distanceScale = 1, distanceM = 0): void {
    if (this.muted || !this.ctx || !this.master) return;
    const d = Math.max(0.14, Math.min(1, distanceScale));
    const delay = Math.min(2.6, Math.max(0, distanceM) / 343);
    const t0 = this.ctx.currentTime + delay;

    // 1) Chest-thumping sub-bass shockwave (100Hz -> 18Hz exponential pitch drop)
    const osc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, t0);
    osc.frequency.exponentialRampToValueAtTime(18, t0 + 0.92);
    subGain.gain.setValueAtTime(0.001, t0);
    subGain.gain.linearRampToValueAtTime(0.68 * d, t0 + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.98);
    osc.connect(subGain);
    subGain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 1.02);

    // 2) Mid-range saturated fire roar
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.85;
      filter.frequency.setValueAtTime(980 * (0.55 + 0.45 * d), t0);
      filter.frequency.exponentialRampToValueAtTime(42, t0 + 1.85);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.68 * d, t0 + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.9);
      src.connect(filter);
      if (this.shockCurve) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.shockCurve;
        filter.connect(shaper);
        shaper.connect(g);
      } else {
        filter.connect(g);
      }
      g.connect(this.master);
      if (this.reverbSend) g.connect(this.reverbSend);
      src.start(t0);
      src.stop(t0 + 1.95);
    }

    // 3) High-frequency debris & shrapnel crackle bursts
    const crackleBuf = this.whiteNoiseBuffer || this.noiseBuffer;
    if (crackleBuf) {
      const cSrc = this.ctx.createBufferSource();
      cSrc.buffer = crackleBuf;
      const cFilter = this.ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.Q.value = 1.25;
      cFilter.frequency.setValueAtTime(2650 * (0.45 + 0.55 * d), t0);
      cFilter.frequency.exponentialRampToValueAtTime(210, t0 + 1.35);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.001, t0);
      cg.gain.linearRampToValueAtTime(0.36 * d, t0 + 0.008);
      cg.gain.setValueAtTime(0.25 * d, t0 + 0.16);
      cg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
      cSrc.connect(cFilter);
      cFilter.connect(cg);
      cg.connect(this.master);
      if (this.reverbSend) cg.connect(this.reverbSend);
      cSrc.start(t0);
      cSrc.stop(t0 + 1.45);
    }
  }

  public playParachuteOpen(): void {
    if (this.muted) return;
    this.playNoiseBurst(0.32, 'bandpass', 580, 170, 0.4);
    this.playTone(90, 0.18, 'sine', 0.22);
  }

  public playRingChime(): void {
    if (this.muted) return;
    this.playTone(587.33, 0.14, 'sine', 0.2);
    setTimeout(() => this.playTone(880, 0.22, 'sine', 0.18), 70);
  }

  public playTouchdown(): void {
    if (this.muted) return;
    this.playNoiseBurst(0.18, 'lowpass', 240, 70, 0.34);
    this.playTone(75, 0.14, 'sine', 0.22);
  }

  public playCrash(): void {
    if (this.muted) return;
    this.playExplosion(1);
  }

  public updateMetallicFriction(
    active: boolean,
    intensity = 0,
    speedMs = 0,
    surface: ScrapeSurface = 'ground',
    distScale = 1
  ): void {
    if (
      !this.ctx ||
      !this.scrapeOsc1 ||
      !this.scrapeOsc2 ||
      !this.scrapeResFilter ||
      !this.scrapeSynthGain ||
      !this.scrapeNoiseFilter ||
      !this.scrapeNoiseGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted || intensity <= 0.02 || speedMs < 3) {
      this.scrapeSynthGain.gain.setTargetAtTime(0, now, 0.035);
      this.scrapeNoiseGain.gain.setTargetAtTime(0, now, 0.035);
      return;
    }
    const isTireSurface = surface === 'ground' || surface === 'carrier';
    const d = Math.max(0.15, Math.min(1, distScale));
    const clampInt = Math.max(0.08, Math.min(1, intensity));
    const spdNorm = Math.min(1, speedMs / 85);

    if (isTireSurface) {
      // Pure bandpass-filtered white/pink noise rumble for tire/belly ground friction (no whistling oscillators)
      this.scrapeNoiseFilter.type = 'bandpass';
      this.scrapeNoiseFilter.Q.value = 0.8;
      this.scrapeNoiseFilter.frequency.setTargetAtTime(340 + spdNorm * 420 + clampInt * 120, now, 0.035);
      const noiseVol = (0.08 + clampInt * 0.16 + spdNorm * 0.09) * d;
      this.scrapeSynthGain.gain.setTargetAtTime(0, now, 0.025);
      this.scrapeNoiseGain.gain.setTargetAtTime(noiseVol, now, 0.025);
      return;
    }

    const surfaceBase = surface === 'aircraft' ? 780 : 620;
    const f1 = surfaceBase + spdNorm * 380 + clampInt * 140;
    const f2 = f1 * 1.63 + spdNorm * 180;
    this.scrapeOsc1.frequency.setTargetAtTime(f1, now, 0.03);
    this.scrapeOsc2.frequency.setTargetAtTime(f2, now, 0.03);
    this.scrapeResFilter.frequency.setTargetAtTime(f1 * 1.25, now, 0.035);
    this.scrapeNoiseFilter.type = 'bandpass';
    this.scrapeNoiseFilter.Q.value = 1.1;
    this.scrapeNoiseFilter.frequency.setTargetAtTime(1400 + spdNorm * 1800, now, 0.035);

    const synthVol = (0.025 + clampInt * 0.055 + spdNorm * 0.025) * d;
    const noiseVol = (0.08 + clampInt * 0.16 + spdNorm * 0.08) * d;
    this.scrapeSynthGain.gain.setTargetAtTime(synthVol, now, 0.025);
    this.scrapeNoiseGain.gain.setTargetAtTime(noiseVol, now, 0.025);
  }

  public playSparkCrackle(intensity = 0.6, count = 4, distScale = 1): void {
    if (!this.ctx || !this.master || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSparkCrackle < 0.032) return;
    this.lastSparkCrackle = now;

    const d = Math.max(0.15, Math.min(1, distScale));
    const clampInt = Math.max(0.2, Math.min(1, intensity));
    const pops = Math.min(4, Math.max(1, Math.round(count * 0.45)));

    for (let i = 0; i < pops; i++) {
      const t0 = now + i * 0.016 + Math.random() * 0.012;
      const dur = 0.018 + Math.random() * 0.02;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.2;
      const startHz = 3100 + Math.random() * 3400;
      filter.frequency.setValueAtTime(startHz, t0);
      filter.frequency.exponentialRampToValueAtTime(1400, t0 + dur);

      const g = this.ctx.createGain();
      const vol = (0.08 + clampInt * 0.14) * d;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0, Math.random() * 1.4);
      src.stop(t0 + dur + 0.01);
    }
  }

  public playSparkBounce(distScale = 1, speedFactor = 0.5): void {
    if (!this.ctx || !this.master || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSparkBounce < 0.045) return;
    this.lastSparkBounce = now;

    const d = Math.max(0.15, Math.min(1, distScale));
    const spd = Math.max(0.2, Math.min(1, speedFactor));
    const dur = 0.022;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.2;
    filter.frequency.setValueAtTime(4200 + Math.random() * 2400, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075 * d * spd, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5);
    src.stop(now + dur + 0.01);
  }

  public playMetallicImpact(
    intensity = 0.6,
    surface: ScrapeSurface = 'building',
    speedMs = 30,
    distScale = 1
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const clampInt = Math.max(0.2, Math.min(1, intensity));
    if (clampInt < 0.72 && now - this.lastMetallicImpact < 0.075) return;
    this.lastMetallicImpact = now;

    const d = Math.max(0.18, Math.min(1, distScale));
    const spdNorm = Math.min(1, speedMs / 95);

    // 1. Sharp abrasive metallic shear noise
    this.playNoiseBurst(
      0.16 + clampInt * 0.14,
      'bandpass',
      2600 + spdNorm * 1400,
      620,
      (0.22 + clampInt * 0.18) * d
    );

    // 2. Structural impact thump
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(145 + clampInt * 55, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    thumpGain.gain.setValueAtTime((0.18 + clampInt * 0.18) * d, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.master);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.14);

    // 3. Inharmonic metallic airframe clang / screech modes
    const [fA, fB] =
      surface === 'carrier' || surface === 'aircraft'
        ? [840 + spdNorm * 220, 1520 + spdNorm * 310]
        : surface === 'building'
        ? [680 + spdNorm * 190, 1290 + spdNorm * 260]
        : [520 + spdNorm * 170, 990 + spdNorm * 210];

    for (const [idx, freq] of [fA, fB].entries()) {
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.14);

      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(freq * 1.15, now);
      filt.Q.value = 3.8;

      const amp = (idx === 0 ? 0.11 : 0.075) * clampInt * d;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14 + clampInt * 0.06);

      osc.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    // 4. Synchronized spark crackle burst
    this.playSparkCrackle(clampInt, Math.round(3 + clampInt * 6), d);
  }

  public playTireScreech(intensity = 0.65, speedMs = 45, distScale = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTireScreech < 0.095) return;
    this.lastTireScreech = now;

    const d = Math.max(0.18, Math.min(1, distScale));
    const clampInt = Math.max(0.25, Math.min(1, intensity));
    const spdNorm = Math.min(1, speedMs / 95);

    // Filtered white-noise tire rubber scrub & low suspension rumble (no whistling triangle oscillator)
    this.playNoiseBurst(
      0.16 + clampInt * 0.08,
      'bandpass',
      420 + spdNorm * 260,
      230,
      0.22 * clampInt * d,
      true,
      0.85
    );
    this.playNoiseBurst(
      0.11 + clampInt * 0.06,
      'bandpass',
      1050 + spdNorm * 420,
      620,
      0.14 * clampInt * d,
      true,
      1.15
    );

    const thump = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(88 + clampInt * 24, now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.09);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11 * clampInt * d, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(g);
    g.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.12);
  }

  public playScrape(
    intensity = 0.5,
    surface: ScrapeSurface = 'building',
    speedMs = 28,
    distScale = 1
  ): void {
    this.playMetallicImpact(intensity, surface, speedMs, distScale);
  }

  public playBombDrop(): void {
    if (this.muted || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    // Mechanical bomb bay / shackle release thump
    this.playNoiseBurst(0.18, 'lowpass', 300, 85, 0.25);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playBombWhistle(distanceScale = 1, dur = 1.6): void {
    if (this.muted || !this.ctx || !this.master) return;
    const d = Math.max(0.12, Math.min(1, distanceScale));
    const sweepDur = Math.max(0.75, Math.min(2.6, dur));
    const now = this.ctx.currentTime;

    // Descending aerodynamic whistle (1400Hz -> 550Hz)
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(550, now + sweepDur);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08 * d, now + 0.14);
    g.gain.linearRampToValueAtTime(0.15 * d, now + sweepDur * 0.88);
    g.gain.exponentialRampToValueAtTime(0.001, now + sweepDur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + sweepDur + 0.04);

    // Resonant air-shearing whistle layer
    const buf = this.whiteNoiseBuffer || this.noiseBuffer;
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 8.5;
      bp.frequency.setValueAtTime(1400, now);
      bp.frequency.exponentialRampToValueAtTime(550, now + sweepDur);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.09 * d, now + 0.16);
      ng.gain.exponentialRampToValueAtTime(0.001, now + sweepDur);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      src.start(now);
      src.stop(now + sweepDur + 0.04);
    }
  }

  public playBombExplosion(distanceScale = 1, distanceM = 0): void {
    if (this.muted || !this.ctx || !this.master) return;
    const d = Math.max(0.16, Math.min(1, distanceScale));
    const delay = Math.min(2.6, Math.max(0, distanceM) / 343);
    const t0 = this.ctx.currentTime + delay;

    // 1) Window-rattling sub-bass concussion (100Hz -> 18Hz exponential pitch drop)
    const osc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, t0);
    osc.frequency.exponentialRampToValueAtTime(18, t0 + 1.32);
    subGain.gain.setValueAtTime(0.001, t0);
    subGain.gain.linearRampToValueAtTime(0.78 * d, t0 + 0.016);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.42);
    osc.connect(subGain);
    subGain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 1.48);

    // 2) Heavy earth-shaking saturated low-pass blast wave + stereo reverb tail
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(1020 * (0.55 + 0.45 * d), t0);
      lp.frequency.exponentialRampToValueAtTime(32, t0 + 2.45);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.76 * d, t0 + 0.022);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.55);
      src.connect(lp);
      if (this.shockCurve) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.shockCurve;
        lp.connect(shaper);
        shaper.connect(g);
      } else {
        lp.connect(g);
      }
      g.connect(this.master);
      if (this.reverbSend) g.connect(this.reverbSend);
      src.start(t0);
      src.stop(t0 + 2.6);
    }

    // 3) High-frequency debris & ground shockwave crackle
    const crackleBuf = this.whiteNoiseBuffer || this.noiseBuffer;
    if (crackleBuf) {
      const cSrc = this.ctx.createBufferSource();
      cSrc.buffer = crackleBuf;
      const cFilter = this.ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.Q.value = 1.3;
      cFilter.frequency.setValueAtTime(2850 * (0.45 + 0.55 * d), t0);
      cFilter.frequency.exponentialRampToValueAtTime(125, t0 + 1.75);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.001, t0);
      cg.gain.linearRampToValueAtTime(0.4 * d, t0 + 0.012);
      cg.gain.setValueAtTime(0.28 * d, t0 + 0.22);
      cg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.85);
      cSrc.connect(cFilter);
      cFilter.connect(cg);
      cg.connect(this.master);
      if (this.reverbSend) cg.connect(this.reverbSend);
      cSrc.start(t0);
      cSrc.stop(t0 + 1.9);
    }
  }

  public updateMissileWarning(alert: 'none' | 'lock' | 'incoming', distM: number): void {
    if (!this.ctx || !this.master || this.muted || alert === 'none') return;
    const now = this.ctx.currentTime;
    const interval =
      alert === 'incoming'
        ? Math.max(0.14, Math.min(0.42, distM / 1700))
        : 0.65;
    if (now - this.lastLockBeep < interval) return;
    this.lastLockBeep = now;

    if (alert === 'incoming') {
      this.playTone(980, 0.07, 'sine', 0.16);
      setTimeout(() => this.playTone(740, 0.06, 'sine', 0.13), 55);
    } else {
      this.playTone(780, 0.08, 'sine', 0.12);
    }
  }

  public playFlareDeploy(): void {
    if (this.muted || !this.ctx || !this.master) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playNoiseBurst(0.13, 'bandpass', 1750, 520, 0.22);
      }, i * 65);
    }
  }

  public playArrestorTrap(): void {
    if (this.muted || !this.ctx || !this.master) return;
    this.playNoiseBurst(0.45, 'bandpass', 1250, 190, 0.4);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.52);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playSonicBoom(distanceScale = 1, distanceM = 0): void {
    if (this.muted || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSonicBoom < 0.55) return;
    this.lastSonicBoom = now;

    const d = Math.max(0.18, Math.min(1, distanceScale));
    const travelDelay = distanceM > 20 ? Math.min(2.2, distanceM / 343) : 0;
    const tBase = now + travelDelay;

    // Authentic N-Wave Double Sonic Boom (BOOM-BOOM separated by 90ms)
    for (const [offset, startHz, endHz, amp] of [
      [0, 130, 20, 0.64],
      [0.09, 112, 20, 0.54],
    ] as const) {
      const tBang = tBase + offset;

      // Sub-bass pressure drop (130Hz -> 20Hz)
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startHz, tBang);
      osc.frequency.exponentialRampToValueAtTime(endHz, tBang + 0.58);
      g.gain.setValueAtTime(0.001, tBang);
      g.gain.linearRampToValueAtTime(amp * d, tBang + 0.009);
      g.gain.exponentialRampToValueAtTime(0.001, tBang + 0.64);
      osc.connect(g);
      g.connect(this.master);
      osc.start(tBang);
      osc.stop(tBang + 0.68);

      // Saturated low-pass shock noise routed to master + procedural stereo reverb
      const buf = this.noiseBuffer || this.whiteNoiseBuffer;
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.85;
        lp.frequency.setValueAtTime(1750 * (0.55 + 0.45 * d), tBang);
        lp.frequency.exponentialRampToValueAtTime(58, tBang + 0.72);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.001, tBang);
        ng.gain.linearRampToValueAtTime(amp * 0.88 * d, tBang + 0.01);
        ng.gain.exponentialRampToValueAtTime(0.001, tBang + 0.78);
        src.connect(lp);
        if (this.shockCurve) {
          const shaper = this.ctx.createWaveShaper();
          shaper.curve = this.shockCurve;
          lp.connect(shaper);
          shaper.connect(ng);
        } else {
          lp.connect(ng);
        }
        ng.connect(this.master);
        if (this.reverbSend) ng.connect(this.reverbSend);
        src.start(tBang);
        src.stop(tBang + 0.82);
      }
    }
  }

  public playGearOverspeedWarning(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGearWarning < 0.75) return;
    this.lastGearWarning = now;
    this.playNoiseBurst(0.16, 'bandpass', 620, 210, 0.16);
    this.playTone(460, 0.07, 'triangle', 0.09);
  }

  public updateGForce(gLoad: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    if (Math.abs(gLoad) < 6.4) return;
    const now = this.ctx.currentTime;
    const breathInterval = Math.max(0.65, 1.35 - Math.min(0.6, Math.abs(gLoad - 6.0) * 0.12));
    if (now - this.lastGBreath < breathInterval) return;
    this.lastGBreath = now;
    this.playNoiseBurst(0.24, 'bandpass', 460, 210, 0.14);
  }

  public playRefuelContact(connected: boolean, complete = false): void {
    if (this.muted) return;
    if (complete) {
      this.playTone(523.25, 0.14, 'sine', 0.2);
      setTimeout(() => this.playTone(659.25, 0.16, 'sine', 0.2), 90);
      setTimeout(() => this.playTone(783.99, 0.24, 'sine', 0.2), 180);
      return;
    }
    if (connected) {
      this.playTone(440, 0.08, 'sine', 0.14);
      setTimeout(() => this.playTone(660, 0.12, 'sine', 0.15), 65);
    } else {
      this.playTone(300, 0.12, 'sine', 0.12);
    }
  }

  public playOverGWarning(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastOverGBeep < 0.42) return;
    this.lastOverGBeep = now;
    this.playTone(960, 0.08, 'sawtooth', 0.18);
    setTimeout(() => this.playTone(720, 0.09, 'sawtooth', 0.16), 75);
  }

  public playStructuralSnap(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    // Violent structural metal tearing noise
    this.playNoiseBurst(0.48, 'bandpass', 3800, 320, 0.65);
    this.playNoiseBurst(0.35, 'lowpass', 620, 45, 0.55);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.32);
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playEngineSputter(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastEngineSputter < 0.35) return;
    this.lastEngineSputter = now;

    this.playNoiseBurst(0.18, 'bandpass', 850, 160, 0.32);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.2);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playFlutterWarning(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFlutterSound < 0.28) return;
    this.lastFlutterSound = now;

    this.playNoiseBurst(0.22, 'bandpass', 1200, 240, 0.24);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playThunder(intensity = 1, distanceM = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const d = Math.max(0.22, Math.min(1.15, intensity));
    const delay = Math.min(1.2, Math.max(0, distanceM) / 600);
    const t0 = this.ctx.currentTime + delay;

    // 1. Sharp lightning snap crackle
    const crackBuf = this.whiteNoiseBuffer || this.noiseBuffer;
    if (crackBuf) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = crackBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(3200, t0);
      bp.frequency.exponentialRampToValueAtTime(420, t0 + 0.28);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.001, t0);
      sg.gain.linearRampToValueAtTime(0.45 * d, t0 + 0.008);
      sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      snap.connect(bp);
      bp.connect(sg);
      sg.connect(this.master);
      if (this.reverbSend) sg.connect(this.reverbSend);
      snap.start(t0, Math.random() * 0.8);
      snap.stop(t0 + 0.38);
    }

    // 2. Deep rolling storm thunder rumble
    if (this.noiseBuffer) {
      const rumble = this.ctx.createBufferSource();
      rumble.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(460, t0 + 0.05);
      lp.frequency.exponentialRampToValueAtTime(42, t0 + 2.5);
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.001, t0 + 0.04);
      rg.gain.linearRampToValueAtTime(0.66 * d, t0 + 0.12);
      rg.gain.setValueAtTime(0.42 * d, t0 + 0.55);
      rg.gain.exponentialRampToValueAtTime(0.001, t0 + 2.65);
      rumble.connect(lp);
      if (this.shockCurve) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.shockCurve;
        lp.connect(shaper);
        shaper.connect(rg);
      } else {
        lp.connect(rg);
      }
      rg.connect(this.master);
      if (this.reverbSend) rg.connect(this.reverbSend);
      rumble.start(t0 + 0.03);
      rumble.stop(t0 + 2.75);
    }

    // 3. Sub-bass thunder thump
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(76, t0 + 0.02);
    sub.frequency.exponentialRampToValueAtTime(22, t0 + 0.95);
    subG.gain.setValueAtTime(0.001, t0 + 0.02);
    subG.gain.linearRampToValueAtTime(0.48 * d, t0 + 0.05);
    subG.gain.exponentialRampToValueAtTime(0.001, t0 + 1.05);
    sub.connect(subG);
    subG.connect(this.master);
    sub.start(t0 + 0.02);
    sub.stop(t0 + 1.1);
  }

  public playMeteorImpact(distanceScale = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const d = Math.max(0.25, Math.min(1.2, distanceScale));
    const t0 = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, t0);
    sub.frequency.exponentialRampToValueAtTime(16, t0 + 1.65);
    sg.gain.setValueAtTime(0.001, t0);
    sg.gain.linearRampToValueAtTime(0.92 * d, t0 + 0.015);
    sg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.75);
    sub.connect(sg);
    sg.connect(this.master);
    sub.start(t0);
    sub.stop(t0 + 1.8);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, t0);
      lp.frequency.exponentialRampToValueAtTime(34, t0 + 2.7);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, t0);
      ng.gain.linearRampToValueAtTime(0.86 * d, t0 + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8);
      src.connect(lp);
      if (this.shockCurve) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.shockCurve;
        lp.connect(shaper);
        shaper.connect(ng);
      } else {
        lp.connect(ng);
      }
      ng.connect(this.master);
      if (this.reverbSend) ng.connect(this.reverbSend);
      src.start(t0);
      src.stop(t0 + 2.85);
    }

    this.playSparkCrackle(0.95, 8, d);
  }

  public playMegatronTransformStage(stage: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime;
    // Cybertronian rhythmic servo ratchet + heavy hydraulic lock clunk
    const seq =
      stage === 0
        ? [280, 420, 310, 520]
        : stage === 1
          ? [220, 340, 190, 460]
          : stage === 2
            ? [360, 560, 290, 680]
            : [190, 320, 480, 140];

    seq.forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const st = t0 + idx * 0.078;
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, st);
      osc.frequency.exponentialRampToValueAtTime(freq * (idx % 2 === 0 ? 1.48 : 0.62), st + 0.068);
      filt.type = 'bandpass';
      filt.Q.value = 3.6;
      filt.frequency.setValueAtTime(freq * 1.4, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.24, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.072);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      if (this.reverbSend) g.connect(this.reverbSend);
      osc.start(st);
      osc.stop(st + 0.08);
    });

    // Heavy metallic lock-clunk at end of stage
    const lockT = t0 + 0.28;
    const clunk = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clunk.type = 'triangle';
    clunk.frequency.setValueAtTime(145, lockT);
    clunk.frequency.exponentialRampToValueAtTime(36, lockT + 0.14);
    cg.gain.setValueAtTime(0.001, lockT);
    cg.gain.linearRampToValueAtTime(0.38, lockT + 0.008);
    cg.gain.exponentialRampToValueAtTime(0.001, lockT + 0.16);
    clunk.connect(cg);
    cg.connect(this.master);
    clunk.start(lockT);
    clunk.stop(lockT + 0.18);

    this.playSparkCrackle(0.75, 5, 1);
  }

  public playMegatronRoar(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime;
    const dur = 1.95;

    // 1. Dual detuned low metallic cybernetic growl oscillators + FM ring texture
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(34, t0);
    mod.frequency.linearRampToValueAtTime(21, t0 + dur);
    modGain.gain.setValueAtTime(52, t0);
    modGain.gain.exponentialRampToValueAtTime(14, t0 + dur);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 2.4;
    formant.frequency.setValueAtTime(320, t0);
    formant.frequency.exponentialRampToValueAtTime(1080, t0 + 0.36);
    formant.frequency.exponentialRampToValueAtTime(210, t0 + dur);

    const roarGain = this.ctx.createGain();
    roarGain.gain.setValueAtTime(0.001, t0);
    roarGain.gain.linearRampToValueAtTime(0.56, t0 + 0.12);
    roarGain.gain.setValueAtTime(0.52, t0 + 0.95);
    roarGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    for (const baseHz of [56, 84.5]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseHz, t0);
      osc.frequency.linearRampToValueAtTime(baseHz * 1.45, t0 + 0.28);
      osc.frequency.exponentialRampToValueAtTime(baseHz * 0.62, t0 + dur);
      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(formant);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    if (this.shockCurve) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.shockCurve;
      formant.connect(shaper);
      shaper.connect(roarGain);
    } else {
      formant.connect(roarGain);
    }
    roarGain.connect(this.master);
    if (this.reverbSend) roarGain.connect(this.reverbSend);
    mod.start(t0);
    mod.stop(t0 + dur + 0.05);

    // 2. Breath/hydraulic roar air wash + sub-bass stomp tremor
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(480, t0);
      bp.frequency.exponentialRampToValueAtTime(140, t0 + dur);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, t0);
      ng.gain.linearRampToValueAtTime(0.45, t0 + 0.12);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      nSrc.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      if (this.reverbSend) ng.connect(this.reverbSend);
      nSrc.start(t0);
      nSrc.stop(t0 + dur + 0.05);
    }

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(64, t0);
    sub.frequency.exponentialRampToValueAtTime(20, t0 + 1.2);
    sg.gain.setValueAtTime(0.001, t0);
    sg.gain.linearRampToValueAtTime(0.6, t0 + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.25);
    sub.connect(sg);
    sg.connect(this.master);
    sub.start(t0);
    sub.stop(t0 + 1.3);
  }

  public playFusionCannonCharge(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime;
    const dur = 0.92;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(175, t0);
    osc.frequency.exponentialRampToValueAtTime(1240, t0 + dur);
    osc2.frequency.setValueAtTime(350, t0);
    osc2.frequency.exponentialRampToValueAtTime(2480, t0 + dur);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t0);
    lp.frequency.exponentialRampToValueAtTime(3400, t0 + dur);

    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.24, t0 + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.04);

    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    if (this.reverbSend) g.connect(this.reverbSend);
    osc.start(t0);
    osc2.start(t0);
    osc.stop(t0 + dur + 0.06);
    osc2.stop(t0 + dur + 0.06);
  }

  public playFusionCannonFire(distanceScale = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const d = Math.max(0.2, Math.min(1.1, distanceScale));
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, t0);
    osc.frequency.exponentialRampToValueAtTime(52, t0 + 0.34);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.48 * d, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
    osc.connect(g);
    g.connect(this.master);
    if (this.reverbSend) g.connect(this.reverbSend);
    osc.start(t0);
    osc.stop(t0 + 0.42);

    this.playNoiseBurst(0.26, 'bandpass', 2200, 180, 0.42 * d, true, 1.4);
  }

  public playMegatronDefeatExplosion(): void {
    if (!this.ctx || !this.master || this.muted) return;
    this.playMeteorImpact(1.2);
    setTimeout(() => {
      this.playExplosion(1.0, 0);
      this.playThunder(1.0, 0);
    }, 220);
  }
}
