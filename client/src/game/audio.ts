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
    this.engineGain.gain.value = 0.08;
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
      this.engineGain.gain.value = Math.min(0.15, 0.06 + (speed / 800) * 0.09);
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
    // Auto-cleanup
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
  }

  playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(ng);
    ng.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.13);
    noise.onended = () => { try { noise.disconnect(); ng.disconnect(); } catch {} };
    // Descending thud
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.12, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(og);
    og.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
    osc.onended = () => { try { osc.disconnect(); og.disconnect(); } catch {} };
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

  // ── AI-Generated Obstacle Sound ───────────────────────
  playObstacleSound(soundData: Array<{ wave: string; startHz: number; endHz: number; duration: number; volume: number; delay: number }>): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Limit to max 4 notes to prevent audio overload
    const notes = soundData.slice(0, 4);
    for (const note of notes) {
      const startHz = Math.max(50, Math.min(1500, note.startHz || 200));
      const endHz = Math.max(50, Math.min(1500, note.endHz || startHz));
      const duration = Math.max(0.05, Math.min(1.0, note.duration || 0.2));
      const volume = Math.max(0.01, Math.min(0.2, note.volume || 0.1));
      const delay = Math.max(0, Math.min(1.0, note.delay || 0));
      const startTime = now + delay;

      try {
        if (note.wave === "noise") {
          const bufSize = Math.floor(ctx.sampleRate * duration);
          const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.setValueAtTime(volume, startTime);
          g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          src.connect(g);
          g.connect(this.sfxGain);
          src.start(startTime);
          src.stop(startTime + duration + 0.02);
          src.onended = () => { try { src.disconnect(); g.disconnect(); } catch {} };
        } else {
          const waveType = (["sine", "square", "sawtooth", "triangle"].includes(note.wave) ? note.wave : "square") as OscillatorType;
          const osc = ctx.createOscillator();
          osc.type = waveType;
          osc.frequency.setValueAtTime(startHz, startTime);
          if (Math.abs(startHz - endHz) > 10) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), startTime + duration);
          }
          const g = ctx.createGain();
          g.gain.setValueAtTime(volume, startTime);
          g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(startTime);
          osc.stop(startTime + duration + 0.02);
          osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch {} };
        }
      } catch {
        // Silently ignore malformed sound notes
      }
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

    // Loop after 16 beats
    const loopTid = setTimeout(() => this.playMusicLoop(), 16 * beatMs) as unknown as number;
    this.musicTimeouts.push(loopTid);
  }

  destroy(): void {
    this.stopEngine();
    this.stopMusic();
    this.sfxGain?.disconnect();
    this.sfxGain = null;
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
