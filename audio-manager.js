const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

window.AudioManager = class AudioManager {
  constructor(options = {}) {
    this.context = null;
    this.master = null;
    this.buses = {};
    this.sends = {};
    this.buffers = new Map();
    this.activeSources = new Set();
    this.lastPlayed = new Map();
    this.mediaSource = null;
    this.engineNodes = null;
    this.sampleEngine = null;
    this.muted = false;
    this.previousMasterVolume = 0.82;

    this.volumes = {
      master: 0.82,
      bgm: 0.38,
      sfx: 0.8
    };

    this.maxPolyphony = options.maxPolyphony || 40;

    this.bgm = new Audio(
      options.bgm || "./assets/title-hangar-bgm.mp3"
    );

    this.bgm.loop = true;
    this.bgm.preload = "auto";

    /*
      폴더 구조

      assets/
      └─ audio/
         └─ kenney/
            ├─ laserLarge_000.ogg
            ├─ laserSmall_000.ogg
            ├─ explosionCrunch_000.ogg
            ├─ impactMetal_000.ogg
            └─ ...
    */

    this.sampleManifest = {
      ui: [
        "./assets/audio/kenney/computerNoise_000.ogg",
        "./assets/audio/kenney/computerNoise_001.ogg"
      ],

      jump: [
        "./assets/audio/kenney/thrusterFire_000.ogg",
        "./assets/audio/kenney/thrusterFire_001.ogg"
      ],

      dash: [
        "./assets/audio/kenney/thrusterFire_002.ogg",
        "./assets/audio/kenney/thrusterFire_003.ogg",
        "./assets/audio/kenney/spaceEngineSmall_000.ogg"
      ],

      cannon: [
        "./assets/audio/kenney/laserLarge_000.ogg",
        "./assets/audio/kenney/laserLarge_001.ogg",
        "./assets/audio/kenney/explosionCrunch_000.ogg"
      ],

      gatling: [
        "./assets/audio/kenney/laserSmall_000.ogg",
        "./assets/audio/kenney/laserSmall_001.ogg",
        "./assets/audio/kenney/laserSmall_002.ogg",
        "./assets/audio/kenney/laserSmall_003.ogg",
        "./assets/audio/kenney/laserSmall_004.ogg"
      ],

      laser: [
        "./assets/audio/kenney/laserRetro_000.ogg",
        "./assets/audio/kenney/laserRetro_001.ogg",
        "./assets/audio/kenney/laserLarge_002.ogg",
        "./assets/audio/kenney/laserLarge_003.ogg"
      ],

      homing: [
        "./assets/audio/kenney/forceField_000.ogg",
        "./assets/audio/kenney/forceField_001.ogg",
        "./assets/audio/kenney/laserLarge_004.ogg"
      ],

      explosion: [
        "./assets/audio/kenney/explosionCrunch_001.ogg",
        "./assets/audio/kenney/explosionCrunch_002.ogg",
        "./assets/audio/kenney/explosionCrunch_003.ogg",
        "./assets/audio/kenney/explosionCrunch_004.ogg",
        "./assets/audio/kenney/lowFrequency_explosion_000.ogg",
        "./assets/audio/kenney/lowFrequency_explosion_001.ogg"
      ],

      footstep: [
        "./assets/audio/kenney/impactMetal_000.ogg",
        "./assets/audio/kenney/impactMetal_001.ogg",
        "./assets/audio/kenney/impactMetal_002.ogg",
        "./assets/audio/kenney/impactMetal_003.ogg",
        "./assets/audio/kenney/impactMetal_004.ogg"
      ],

      alarm: [
        "./assets/audio/kenney/forceField_003.ogg",
        "./assets/audio/kenney/forceField_004.ogg"
      ],

      engineBody: [
        "./assets/audio/kenney/spaceEngineLow_000.ogg"
      ],

      engineHigh: [
        "./assets/audio/kenney/engineCircular_002.ogg"
      ],

      engineBoost: [
        "./assets/audio/kenney/thrusterFire_004.ogg"
      ],

      ...(options.samples || {})
    };
  }

  async init() {
    if (this.context) {
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("Web Audio API를 지원하지 않는 브라우저입니다.");
      return;
    }

    this.context = new AudioContextClass({
      latencyHint: "interactive"
    });

    const ctx = this.context;

    this.master = ctx.createGain();
    this.buses.bgm = ctx.createGain();
    this.buses.sfx = ctx.createGain();
    this.buses.engine = ctx.createGain();
    this.sends.reverb = ctx.createGain();

    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 110;
    lowShelf.gain.value = 1.8;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 5500;
    highShelf.gain.value = 1.2;

    const saturator = ctx.createWaveShaper();
    saturator.curve = this.createSaturationCurve(4.5);
    saturator.oversample = "4x";

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.2;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;

    const convolver = ctx.createConvolver();
    convolver.buffer = this.createImpulseResponse(1.35, 2.8);

    const reverbFilter = ctx.createBiquadFilter();
    reverbFilter.type = "lowpass";
    reverbFilter.frequency.value = 5200;

    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.2;

    this.master.gain.value = this.volumes.master;
    this.buses.bgm.gain.value = this.volumes.bgm;
    this.buses.sfx.gain.value = this.volumes.sfx;
    this.buses.engine.gain.value = 0.85;
    this.sends.reverb.gain.value = 0.16;

    this.buses.bgm.connect(this.master);
    this.buses.sfx.connect(this.master);
    this.buses.engine.connect(this.buses.sfx);

    this.sends.reverb
      .connect(convolver)
      .connect(reverbFilter)
      .connect(reverbReturn)
      .connect(this.master);

    this.master
      .connect(lowShelf)
      .connect(highShelf)
      .connect(saturator)
      .connect(compressor)
      .connect(limiter)
      .connect(ctx.destination);

    if (!this.mediaSource) {
      this.mediaSource =
        ctx.createMediaElementSource(this.bgm);

      this.mediaSource.connect(this.buses.bgm);
    }

    this.createEngine();

    // 백그라운드에서 샘플 로딩
    this.preloadSamples();
  }

  createSaturationCurve(amount = 4) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const k = amount * 20;

    for (let i = 0; i < samples; i++) {
      const x = i * 2 / samples - 1;

      curve[i] =
        ((3 + k) * x * 20 * Math.PI / 180) /
        (Math.PI + k * Math.abs(x));
    }

    return curve;
  }

  createImpulseResponse(duration = 1.2, decay = 2.5) {
    const rate = this.context.sampleRate;
    const length = Math.floor(rate * duration);

    const impulse = this.context.createBuffer(
      2,
      length,
      rate
    );

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(
          1 - i / length,
          decay
        );

        data[i] =
          (Math.random() * 2 - 1) *
          envelope;
      }
    }

    return impulse;
  }

  async preloadSamples() {
    const urls = [
      ...new Set(
        Object.values(this.sampleManifest).flat()
      )
    ];

    await Promise.allSettled(
      urls.map((url) => this.loadSample(url))
    );

    this.ensureSampleEngine();
  }

  async loadSample(url) {
    if (!url) return null;

    if (this.buffers.has(url)) {
      return this.buffers.get(url);
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `오디오 로드 실패: ${response.status} ${url}`
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      const audioBuffer =
        await this.context.decodeAudioData(arrayBuffer);

      this.buffers.set(url, audioBuffer);

      return audioBuffer;
    } catch (error) {
      console.warn(
        `[AudioManager] 샘플을 불러오지 못했습니다: ${url}`,
        error
      );

      return null;
    }
  }

  createEngine() {
    const ctx = this.context;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const body = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const sub = ctx.createOscillator();

    const harmonicGain = ctx.createGain();
    const subGain = ctx.createGain();

    const stereo = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    body.type = "sawtooth";
    harmonic.type = "triangle";
    sub.type = "sine";

    body.frequency.value = 34;
    harmonic.frequency.value = 68;
    sub.frequency.value = 17;

    harmonicGain.gain.value = 0.24;
    subGain.gain.value = 0.5;

    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.Q.value = 1.1;

    gain.gain.value = 0.0001;

    body.connect(filter);

    harmonic
      .connect(harmonicGain)
      .connect(filter);

    sub
      .connect(subGain)
      .connect(filter);

    if (stereo) {
      filter
        .connect(gain)
        .connect(stereo)
        .connect(this.buses.engine);
    } else {
      filter
        .connect(gain)
        .connect(this.buses.engine);
    }

    body.start(now);
    harmonic.start(now);
    sub.start(now);

    this.engineNodes = {
      body,
      harmonic,
      sub,
      gain,
      filter,
      stereo
    };
  }

  ensureSampleEngine() {
    if (!this.context || this.sampleEngine) {
      return;
    }

    const bodyUrl =
      this.sampleManifest.engineBody?.[0];

    const highUrl =
      this.sampleManifest.engineHigh?.[0];

    const boostUrl =
      this.sampleManifest.engineBoost?.[0];

    const bodyBuffer =
      this.buffers.get(bodyUrl);

    const highBuffer =
      this.buffers.get(highUrl);

    const boostBuffer =
      this.buffers.get(boostUrl);

    if (!bodyBuffer || !highBuffer || !boostBuffer) {
      return;
    }

    const ctx = this.context;

    const makeLoop = (buffer, gainValue) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      source.loop = true;

      gain.gain.value = gainValue;

      source
        .connect(gain)
        .connect(this.buses.engine);

      source.start();

      return {
        source,
        gain
      };
    };

    this.sampleEngine = {
      body: makeLoop(bodyBuffer, 0.0001),
      high: makeLoop(highBuffer, 0.0001),
      boost: makeLoop(boostBuffer, 0.0001)
    };

    if (this.engineNodes?.gain) {
      this.engineNodes.gain.gain.setTargetAtTime(
        0.0001,
        ctx.currentTime,
        0.05
      );
    }
  }

  setVolume(group, value) {
    if (!(group in this.volumes)) {
      return;
    }

    const next = clamp(Number(value));

    this.volumes[group] = next;

    if (group === "master" && next > 0) {
      this.previousMasterVolume = next;
    }

    const node =
      group === "master"
        ? this.master
        : this.buses[group];

    if (node && this.context) {
      node.gain.setTargetAtTime(
        next,
        this.context.currentTime,
        0.035
      );
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);

    const targetVolume = this.muted
      ? 0
      : this.previousMasterVolume || 0.82;

    this.setVolume("master", targetVolume);
  }

  async startBgm() {
    await this.init();

    if (!this.context || !this.bgm.paused) {
      return;
    }

    this.buses.bgm.gain.setTargetAtTime(
      this.volumes.bgm,
      this.context.currentTime,
      0.03
    );

    try {
      await this.bgm.play();
    } catch (error) {
      console.warn(
        "BGM 재생을 시작하려면 사용자 입력이 필요합니다.",
        error
      );
    }
  }

  stopBgm(duration = 1.1) {
    if (!this.context || this.bgm.paused) {
      return;
    }

    const gain = this.buses.bgm.gain;
    const now = this.context.currentTime;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);

    gain.linearRampToValueAtTime(
      0.0001,
      now + duration
    );

    window.setTimeout(() => {
      this.bgm.pause();
      this.bgm.currentTime = 0;

      if (this.context) {
        gain.setTargetAtTime(
          this.volumes.bgm,
          this.context.currentTime,
          0.03
        );
      }
    }, duration * 1000 + 30);
  }

  setEngineState({
    speed = 0,
    boosting = false,
    active = false,
    pan = 0
  }) {
    if (!this.context || !this.engineNodes) {
      return;
    }

    const {
      body,
      harmonic,
      sub,
      gain,
      filter,
      stereo
    } = this.engineNodes;

    const now = this.context.currentTime;
    const normalized = clamp(speed / 30);
    const base = 32 + normalized * 74;

    body.frequency.setTargetAtTime(
      base,
      now,
      0.055
    );

    harmonic.frequency.setTargetAtTime(
      base * 2.02,
      now,
      0.06
    );

    sub.frequency.setTargetAtTime(
      base * 0.5,
      now,
      0.075
    );

    filter.frequency.setTargetAtTime(
      220 +
        normalized * 1450 +
        (boosting ? 850 : 0),
      now,
      0.065
    );

    filter.Q.setTargetAtTime(
      1 + normalized * 1.7,
      now,
      0.08
    );

    this.ensureSampleEngine();

    if (this.sampleEngine) {
      // 샘플 엔진을 사용하면 합성 엔진은 음소거
      gain.gain.setTargetAtTime(
        0.0001,
        now,
        0.05
      );

      this.sampleEngine.body.source.playbackRate
        .setTargetAtTime(
          0.72 + normalized * 0.58,
          now,
          0.08
        );

      this.sampleEngine.high.source.playbackRate
        .setTargetAtTime(
          0.68 + normalized * 0.9,
          now,
          0.08
        );

      this.sampleEngine.boost.source.playbackRate
        .setTargetAtTime(
          0.82 + normalized * 0.45,
          now,
          0.06
        );

      this.sampleEngine.body.gain.gain
        .setTargetAtTime(
          active
            ? 0.075 + normalized * 0.12
            : 0.0001,
          now,
          0.09
        );

      this.sampleEngine.high.gain.gain
        .setTargetAtTime(
          active
            ? 0.018 + normalized * 0.075
            : 0.0001,
          now,
          0.08
        );

      this.sampleEngine.boost.gain.gain
        .setTargetAtTime(
          active && boosting
            ? 0.14
            : 0.0001,
          now,
          0.055
        );
    } else {
      // 샘플 로딩 실패 시 합성 엔진 사용
      gain.gain.setTargetAtTime(
        active
          ? 0.012 +
              normalized * 0.058 +
              (boosting ? 0.018 : 0)
          : 0.0001,
        now,
        0.08
      );
    }

    if (stereo) {
      stereo.pan.setTargetAtTime(
        clamp(pan, -1, 1),
        now,
        0.08
      );
    }
  }

  async play(type, options = {}) {
    await this.init();

    if (!this.context) {
      return;
    }

    const cooldowns = {
      gatling: 60,
      laser: 70,
      cannon: 105,
      explosion: 100,
      footstep: 85
    };

    const cooldown = cooldowns[type] || 0;
    const last = this.lastPlayed.get(type) || -Infinity;
    const currentTime = performance.now();

    if (currentTime - last < cooldown) {
      return;
    }

    this.lastPlayed.set(type, currentTime);

    const variants =
      this.sampleManifest[type] || [];

    const loaded = variants.filter((url) =>
      this.buffers.has(url)
    );

    if (loaded.length > 0) {
      const randomUrl =
        loaded[
          Math.floor(Math.random() * loaded.length)
        ];

      return this.playBuffer(
        this.buffers.get(randomUrl),
        {
          volume:
            options.volume ??
            this.defaultVolume(type),

          rate:
            options.rate ??
            1 +
              (Math.random() - 0.5) *
                this.pitchVariation(type),

          pan: options.pan ?? 0,

          reverb:
            options.reverb ??
            this.defaultReverb(type)
        }
      );
    }

    return this.playFallback(type, options);
  }

  playBuffer(
    buffer,
    {
      volume = 0.2,
      rate = 1,
      pan = 0,
      reverb = 0.1
    } = {}
  ) {
    if (!buffer) {
      return;
    }

    while (
      this.activeSources.size >=
      this.maxPolyphony
    ) {
      const oldest =
        this.activeSources.values().next().value;

      try {
        oldest.stop();
      } catch (error) {
        // 이미 종료된 소스
      }

      this.activeSources.delete(oldest);
    }

    const ctx = this.context;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    const panner = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    const send = ctx.createGain();

    source.buffer = buffer;
    source.playbackRate.value = clamp(
      rate,
      0.5,
      2
    );

    gain.gain.value = volume;
    send.gain.value = reverb;

    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);

      source
        .connect(gain)
        .connect(panner)
        .connect(this.buses.sfx);

      panner
        .connect(send)
        .connect(this.sends.reverb);
    } else {
      source
        .connect(gain)
        .connect(this.buses.sfx);

      gain
        .connect(send)
        .connect(this.sends.reverb);
    }

    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
    };

    source.start();

    return source;
  }

  defaultVolume(type) {
    return {
      ui: 0.11,
      jump: 0.22,
      dash: 0.24,
      cannon: 0.42,
      gatling: 0.18,
      laser: 0.22,
      homing: 0.25,
      explosion: 0.48,
      footstep: 0.25,
      alarm: 0.18
    }[type] || 0.2;
  }

  defaultReverb(type) {
    return {
      ui: 0.04,
      jump: 0.08,
      dash: 0.14,
      cannon: 0.24,
      gatling: 0.08,
      laser: 0.18,
      homing: 0.15,
      explosion: 0.32,
      footstep: 0.2,
      alarm: 0.22
    }[type] || 0.1;
  }

  pitchVariation(type) {
    return {
      gatling: 0.12,
      footstep: 0.1,
      explosion: 0.08,
      cannon: 0.045
    }[type] || 0.035;
  }

  playFallback(type, options = {}) {
    if (type === "footstep") {
      return this.playSynthStep(
        options.intensity || 1,
        options.pan || 0
      );
    }

    if (type === "explosion") {
      return this.playLayeredExplosion(options);
    }

    if (type === "cannon") {
      return this.playLayeredCannon(options);
    }

    const profiles = {
      ui: [520, 920, 0.07, 0.06, "sine"],
      jump: [95, 310, 0.25, 0.12, "sawtooth"],
      dash: [70, 220, 0.2, 0.14, "sawtooth"],
      gatling: [185, 92, 0.07, 0.065, "square"],
      laser: [720, 210, 0.15, 0.075, "sawtooth"],
      homing: [210, 900, 0.25, 0.1, "sawtooth"],
      alarm: [320, 640, 1.4, 0.08, "sawtooth"]
    };

    const profile = profiles[type];

    if (!profile) {
      return;
    }

    const [
      from,
      to,
      duration,
      volume,
      wave
    ] = profile;

    this.playTone({
      from,
      to,
      duration,
      volume,
      wave,
      pan: options.pan || 0,
      reverb: this.defaultReverb(type)
    });
  }

  playTone({
    from,
    to,
    duration,
    volume,
    wave = "sine",
    pan = 0,
    reverb = 0.1
  }) {
    const ctx = this.context;
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const panner = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    const send = ctx.createGain();

    const variation =
      1 + (Math.random() - 0.5) * 0.07;

    oscillator.type = wave;

    oscillator.frequency.setValueAtTime(
      from * variation,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, to * variation),
      now + duration
    );

    filter.type = "bandpass";
    filter.frequency.value = Math.max(
      250,
      from * 2.1
    );

    filter.Q.value = 0.7;

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      now + 0.006
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    send.gain.value = reverb;

    oscillator
      .connect(filter)
      .connect(gain);

    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);

      gain
        .connect(panner)
        .connect(this.buses.sfx);

      panner
        .connect(send)
        .connect(this.sends.reverb);
    } else {
      gain.connect(this.buses.sfx);

      gain
        .connect(send)
        .connect(this.sends.reverb);
    }

    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  playLayeredCannon(options = {}) {
    const pan = options.pan || 0;

    this.playTone({
      from: 105,
      to: 28,
      duration: 0.32,
      volume: 0.2,
      wave: "square",
      pan,
      reverb: 0.2
    });

    this.playTone({
      from: 62,
      to: 24,
      duration: 0.46,
      volume: 0.15,
      wave: "sine",
      pan,
      reverb: 0.27
    });

    this.playNoise(
      0.34,
      0.13,
      1900,
      pan,
      0.22
    );
  }

  playLayeredExplosion(options = {}) {
    const pan = options.pan || 0;

    this.playTone({
      from: 78,
      to: 20,
      duration: 0.72,
      volume: 0.2,
      wave: "sawtooth",
      pan,
      reverb: 0.32
    });

    this.playTone({
      from: 44,
      to: 20,
      duration: 0.9,
      volume: 0.18,
      wave: "sine",
      pan,
      reverb: 0.38
    });

    this.playNoise(
      0.82,
      0.24,
      1250,
      pan,
      0.4
    );

    window.setTimeout(() => {
      this.playNoise(
        0.34,
        0.08,
        3600,
        pan,
        0.3
      );
    }, 55);
  }

  playNoise(
    duration,
    volume,
    cutoff,
    pan = 0,
    reverb = 0.15
  ) {
    const ctx = this.context;

    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const progress = i / data.length;

      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - progress, 1.8);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const panner = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    const send = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = cutoff;

    gain.gain.value = volume;
    send.gain.value = reverb;

    source.buffer = buffer;

    source
      .connect(filter)
      .connect(gain);

    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);

      gain
        .connect(panner)
        .connect(this.buses.sfx);

      panner
        .connect(send)
        .connect(this.sends.reverb);
    } else {
      gain.connect(this.buses.sfx);

      gain
        .connect(send)
        .connect(this.sends.reverb);
    }

    source.start();
  }

  playSynthStep(
    intensity = 1,
    pan = 0
  ) {
    const level = clamp(
      intensity,
      0.2,
      2
    );

    this.playTone({
      from: 74,
      to: 26,
      duration: 0.19,
      volume: 0.095 * level,
      wave: "triangle",
      pan,
      reverb: 0.22
    });

    this.playNoise(
      0.12,
      0.045 * level,
      620,
      pan,
      0.18
    );
  }
};