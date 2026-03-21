// Saigon Rush — Procedural Web Audio synthesis
// No audio files. All sounds generated via Web Audio API oscillators & noise.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null; // Separate gain for SFX to prevent engine interference
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning = false;
  private musicPlaying = false;
  private musicTimeouts: number[] = [];
  private activeNodes: Array<AudioNode> = []; // Track for cleanup
  private activeTimeouts: Set<number> = new Set(); // Track scheduled cleanups for emergency teardown

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
    // Separate SFX bus so effects don't interfere with engine
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) this.init();
    if (!this.ctx) return null;
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // ── Engine Sound ──────────────────────────────────────
  playEngine(): void {
    if (this.engineRunning) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 85;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.04;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.masterGain!);
    this.engineOsc.start();
    this.engineRunning = true;
  }

  stopEngine(): void {
    if (!this.engineRunning || !this.engineOsc) return;
    try { this.engineOsc.stop(); } catch { /* already stopped */ }
    this.engineOsc.disconnect();
    this.engineOsc = null;
    this.engineGain?.disconnect();
    this.engineGain = null;
    this.engineRunning = false;
  }

  setEngineSpeed(speed: number): void {
    if (!this.engineOsc) return;
    const freq = 80 + (speed / 800) * 60;
    this.engineOsc.frequency.value = freq;
    if (this.engineGain) {
      this.engineGain.gain.value = Math.min(0.10, 0.04 + (speed / 800) * 0.06);
    }
  }

  // ── SFX ───────────────────────────────────────────────
  private playTone(freq: number, duration: number, type: OscillatorType = "square", vol: number = 0.15): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.005, vol), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    // Early cleanup via onended (belt)
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
    // Proactive setTimeout cleanup (suspenders) — guarantees no zombie oscillators
    const cleanupMs = (duration + 0.2) * 1000;
    const tid = setTimeout(() => {
      this.activeTimeouts.delete(tid);
      try { osc.disconnect(); gain.disconnect(); } catch {}
    }, cleanupMs) as unknown as number;
    this.activeTimeouts.add(tid);
  }

  private playNoiseBurst(vol: number, duration: number, filterFreq?: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.005, vol), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    let filter: BiquadFilterNode | null = null;
    if (filterFreq) {
      filter = ctx.createBiquadFilter();
      filter.type = filterFreq > 1000 ? "highpass" : "lowpass";
      filter.frequency.value = filterFreq;
      src.connect(filter);
      filter.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(this.sfxGain);
    src.start(now);
    src.stop(now + duration + 0.02);
    // Early cleanup via onended (belt)
    src.onended = () => { try { src.disconnect(); g.disconnect(); if (filter) filter.disconnect(); } catch {} };
    // Proactive setTimeout cleanup (suspenders)
    const cleanupMs = (duration + 0.2) * 1000;
    const tid = setTimeout(() => {
      this.activeTimeouts.delete(tid);
      try { src.disconnect(); g.disconnect(); if (filter) filter.disconnect(); } catch {}
    }, cleanupMs) as unknown as number;
    this.activeTimeouts.add(tid);
  }

  playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Noise burst (shortened: 0.10s, lowered vol: 0.2)
    const noiseDuration = 0.10;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.2, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);
    noise.connect(ng);
    ng.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + noiseDuration + 0.01);
    // Early cleanup via onended (belt)
    noise.onended = () => { try { noise.disconnect(); ng.disconnect(); } catch {} };
    // Proactive setTimeout cleanup for noise (suspenders)
    const noiseCleanupMs = (noiseDuration + 0.2) * 1000;
    const noiseTid = setTimeout(() => {
      this.activeTimeouts.delete(noiseTid);
      try { noise.disconnect(); ng.disconnect(); } catch {}
    }, noiseCleanupMs) as unknown as number;
    this.activeTimeouts.add(noiseTid);

    // Descending thud (shortened: 0.12s, lowered vol: 0.1)
    const oscDuration = 0.12;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + oscDuration);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.1, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + oscDuration);
    osc.connect(og);
    og.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + oscDuration + 0.01);
    // Early cleanup via onended (belt)
    osc.onended = () => { try { osc.disconnect(); og.disconnect(); } catch {} };
    // Proactive setTimeout cleanup for oscillator (suspenders)
    const oscCleanupMs = (oscDuration + 0.2) * 1000;
    const oscTid = setTimeout(() => {
      this.activeTimeouts.delete(oscTid);
      try { osc.disconnect(); og.disconnect(); } catch {}
    }, oscCleanupMs) as unknown as number;
    this.activeTimeouts.add(oscTid);
  }

  playDodge(): void {
    this.playTone(400, 0.12, "triangle", 0.12);
    setTimeout(() => this.playTone(800, 0.08, "triangle", 0.08), 30);
  }

  playHorn(): void { this.playTone(350, 0.2, "square", 0.12); }
  playBoost(): void { this.playTone(200, 0.25, "sawtooth", 0.1); }

  playWarning(): void {
    this.playTone(600, 0.12, "square", 0.12);
    setTimeout(() => this.playTone(800, 0.12, "square", 0.12), 130);
  }

  // ── Category-Mapped Obstacle Sounds ──────────────────
  playCategorySound(category: string): void {
    switch (category) {
      case "animal":
        // Low descending moo/growl
        this.playTone(250, 0.3, "triangle", 0.15);
        setTimeout(() => this.playTone(180, 0.25, "triangle", 0.12), 150);
        break;
      case "vehicle":
        // Honk + engine
        this.playTone(380, 0.2, "square", 0.12);
        setTimeout(() => this.playTone(340, 0.15, "square", 0.1), 100);
        break;
      case "food":
        // Bell/chime
        this.playTone(523, 0.1, "triangle", 0.1);
        setTimeout(() => this.playTone(659, 0.1, "triangle", 0.1), 80);
        setTimeout(() => this.playTone(784, 0.08, "triangle", 0.08), 160);
        break;
      case "explosion":
        this.playCrash(); // reuse crash sound
        break;
      case "music":
        // Ascending festive arpeggio
        this.playTone(262, 0.08, "square", 0.08);
        setTimeout(() => this.playTone(330, 0.08, "square", 0.08), 60);
        setTimeout(() => this.playTone(392, 0.08, "square", 0.08), 120);
        setTimeout(() => this.playTone(523, 0.12, "square", 0.1), 180);
        break;
      case "human":
        // Crowd murmur — layered noise
        this.playTone(200, 0.2, "sawtooth", 0.06);
        this.playTone(250, 0.2, "sawtooth", 0.05);
        break;
      case "machine":
        // Electric buzz
        this.playTone(120, 0.25, "sawtooth", 0.1);
        setTimeout(() => this.playTone(180, 0.15, "square", 0.08), 100);
        break;
      default:
        this.playTone(300, 0.15, "square", 0.1);
    }
  }

  // ── ElevenLabs Announcement Audio ──────────────────────
  playAnnouncementAudio(base64Audio: string): void {
    if (!base64Audio) return;
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.volume = 0.6;
      audio.play().catch(() => {}); // Ignore autoplay errors
    } catch {
      // Silently ignore
    }
  }

  // ── ElevenLabs Sound Effect Audio ──────────────────────
  playSoundEffect(base64Audio: string): void {
    if (!base64Audio) return;
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Silently ignore
    }
  }

  // ── Background Music (Chiptune Loop) ──────────────────
  startMusic(): void {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.playMusicLoop();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    for (const t of this.musicTimeouts) clearTimeout(t);
    this.musicTimeouts = [];
  }

  private playMusicLoop(): void {
    if (!this.musicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Simple 8-bar chiptune melody in C minor — Vietnamese-influenced pentatonic
    const bpm = 140;
    const beatMs = (60 / bpm) * 1000;
    const notes = [
      // bar 1-2: ascending phrase
      { f: 262, d: 0.12, t: 0 },      // C4
      { f: 311, d: 0.12, t: 1 },      // Eb4
      { f: 392, d: 0.12, t: 2 },      // G4
      { f: 466, d: 0.2, t: 3 },       // Bb4
      { f: 523, d: 0.12, t: 4 },      // C5
      { f: 466, d: 0.12, t: 5 },      // Bb4
      { f: 392, d: 0.2, t: 6 },       // G4
      { f: 349, d: 0.12, t: 7 },      // F4
      // bar 3-4: descending phrase
      { f: 392, d: 0.12, t: 8 },      // G4
      { f: 523, d: 0.15, t: 9 },      // C5
      { f: 466, d: 0.12, t: 10 },     // Bb4
      { f: 392, d: 0.12, t: 11 },     // G4
      { f: 311, d: 0.2, t: 12 },      // Eb4
      { f: 262, d: 0.15, t: 13 },     // C4
      { f: 311, d: 0.12, t: 14 },     // Eb4
      { f: 349, d: 0.2, t: 15 },      // F4
    ];

    // Bass line (lower octave, triangle wave)
    const bass = [
      { f: 131, d: 0.3, t: 0 },     // C3
      { f: 131, d: 0.15, t: 2 },
      { f: 156, d: 0.3, t: 4 },     // Eb3
      { f: 156, d: 0.15, t: 6 },
      { f: 175, d: 0.3, t: 8 },     // F3
      { f: 175, d: 0.15, t: 10 },
      { f: 196, d: 0.3, t: 12 },    // G3
      { f: 156, d: 0.3, t: 14 },    // Eb3
    ];

    for (const n of notes) {
      const tid = setTimeout(() => {
        this.playTone(n.f, n.d, "square", 0.06);
      }, n.t * beatMs) as unknown as number;
      this.musicTimeouts.push(tid);
    }

    for (const n of bass) {
      const tid = setTimeout(() => {
        this.playTone(n.f, n.d, "triangle", 0.08);
      }, n.t * beatMs) as unknown as number;
      this.musicTimeouts.push(tid);
    }

    // Percussion — kick drum on beats 0, 4, 8, 12; hi-hat on beats 2, 6, 10, 14
    const kicks = [0, 4, 8, 12];
    const hihats = [2, 6, 10, 14];
    for (const beat of kicks) {
      const tid = setTimeout(() => {
        this.playNoiseBurst(0.06, 0.12, 80); // short low thump
      }, beat * beatMs) as unknown as number;
      this.musicTimeouts.push(tid);
    }
    for (const beat of hihats) {
      const tid = setTimeout(() => {
        this.playNoiseBurst(0.03, 0.06, 8000); // short high tick
      }, beat * beatMs) as unknown as number;
      this.musicTimeouts.push(tid);
    }

    // Loop after 16 beats
    const loopTid = setTimeout(() => this.playMusicLoop(), 16 * beatMs) as unknown as number;
    this.musicTimeouts.push(loopTid);
  }

  /** Nuclear option: disconnect sfxGain momentarily to kill any stuck sounds, then reconnect */
  silenceAll(): void {
    if (!this.sfxGain || !this.masterGain) return;
    try { this.sfxGain.disconnect(); } catch {}
    // Clear all proactive cleanup timeouts
    for (const tid of this.activeTimeouts) clearTimeout(tid);
    this.activeTimeouts.clear();
    // Reconnect sfxGain so future sounds work
    this.sfxGain.connect(this.masterGain);
  }

  destroy(): void {
    this.stopEngine();
    this.stopMusic();
    // Clear all proactive cleanup timeouts
    for (const tid of this.activeTimeouts) clearTimeout(tid);
    this.activeTimeouts.clear();
    this.sfxGain?.disconnect();
    this.sfxGain = null;
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
