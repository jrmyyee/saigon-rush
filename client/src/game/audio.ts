// Saigon Rush — Procedural Web Audio synthesis
// No audio files. All sounds generated via Web Audio API oscillators & noise.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null; // Separate gain for SFX to prevent engine interference
  private engineRunning = false;
  private musicPlaying = false;
  private musicTimeouts: number[] = [];
  private activeTimeouts: Set<number> = new Set(); // Track scheduled cleanups for emergency teardown

  // ── Engine state ──────────────────────────────────────────
  private engineTimerId: number | null = null;

  // ── Music state ─────────────────────────────────────────
  private musicSpeedMultiplier = 1.0;
  private musicBPM = 180;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    // Soft ramp from 0 to avoid startup pop/click
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.1);
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

  // ── Engine Sound (disabled — music + ambient honks replace it) ──
  playEngine(): void {
    // No-op: the putt-putt engine sound was causing a buzzy/unpleasant audio glitch.
    // The game now has music + ambient traffic honks + SFX which provide sufficient audio.
    this.engineRunning = true; // Set flag so stopEngine() still works
  }

  stopEngine(): void {
    if (!this.engineRunning) return;
    if (this.engineTimerId !== null) {
      clearInterval(this.engineTimerId);
      this.engineTimerId = null;
    }
    this.engineRunning = false;
  }

  setEngineSpeed(_speed: number): void {
    // No-op — engine sound disabled, but method kept for API compatibility
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

  playHorn(): void { this.playTrafficHonk(); }
  playBoost(): void { this.playTone(200, 0.25, "sawtooth", 0.1); }

  /**
   * Synthesize a realistic horn sound using square wave + amplitude modulation (AM).
   * The 6Hz AM creates the characteristic horn "blat" wobble of real diaphragm horns.
   * Frequencies: motorbike ~550Hz, car ~420Hz, truck ~280Hz.
   */
  private playHornSynth(baseFreq: number, duration: number, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Master gain with horn envelope: quick attack, sustain, abrupt cut
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(vol, now + 0.012); // 12ms attack
    master.gain.setValueAtTime(vol, now + duration - 0.025);
    master.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Oscillator 1: square wave fundamental (classic horn timbre)
    const osc1 = ctx.createOscillator();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(baseFreq * 0.97, now); // Start slightly flat
    osc1.frequency.linearRampToValueAtTime(baseFreq, now + 0.025); // Pitch bend up

    // Oscillator 2: detuned +4Hz for beating/thickness
    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = baseFreq + 4;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.6; // Slightly quieter than fundamental

    // 6Hz Amplitude Modulation — creates the characteristic horn "blat" wobble
    // This simulates the vibrating diaphragm of a real vehicle horn
    const amLfo = ctx.createOscillator();
    amLfo.type = "sine";
    amLfo.frequency.value = 6; // 6Hz wobble rate
    const amDepth = ctx.createGain();
    amDepth.gain.value = vol * 0.35; // AM depth = 35% of volume

    // AM modulates the master gain: output = signal * (1 + depth * sin(6Hz))
    amLfo.connect(amDepth);
    amDepth.connect(master.gain);

    // Route oscillators through master gain
    osc1.connect(master);
    osc2.connect(osc2Gain);
    osc2Gain.connect(master);
    master.connect(this.sfxGain);

    osc1.start(now); osc2.start(now); amLfo.start(now);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
    amLfo.stop(now + duration + 0.02);

    osc1.onended = () => {
      try { osc1.disconnect(); osc2.disconnect(); osc2Gain.disconnect(); amLfo.disconnect(); amDepth.disconnect(); master.disconnect(); } catch {}
    };
    const cleanupMs = (duration + 0.2) * 1000;
    const tid = setTimeout(() => {
      this.activeTimeouts.delete(tid);
      try { osc1.disconnect(); osc2.disconnect(); osc2Gain.disconnect(); amLfo.disconnect(); amDepth.disconnect(); master.disconnect(); } catch {}
    }, cleanupMs) as unknown as number;
    this.activeTimeouts.add(tid);
  }

  /** Mega Honk — MASSIVE air horn blast */
  playMegaHonk(): void {
    // Layer 1: Deep truck air horn (two-tone, like real truck horns)
    this.playHornSynth(145, 0.6, 0.18); // Low note
    this.playHornSynth(195, 0.6, 0.15); // Higher note (major third = classic truck horn interval)
    // Layer 2: Air burst noise
    this.playNoiseBurst(0.10, 0.2, 300);
    // Layer 3: Echo honk
    setTimeout(() => {
      this.playHornSynth(145, 0.35, 0.10);
      this.playHornSynth(195, 0.35, 0.08);
    }, 250);
  }

  /** Vietnamese traffic honk — varied, realistic horn sounds
   * Frequencies tuned for each vehicle type's actual horn pitch */
  playTrafficHonk(): void {
    const r = Math.random();
    if (r < 0.35) {
      // Motorbike horn: high-pitched double beep (classic Vietnamese xe máy sound)
      this.playHornSynth(550, 0.10, 0.10);
      setTimeout(() => this.playHornSynth(570, 0.10, 0.08), 120);
    } else if (r < 0.65) {
      // Taxi/car horn: mid-range single honk
      this.playHornSynth(420, 0.18, 0.12);
    } else {
      // Bus/truck: deep sustained horn
      this.playHornSynth(280, 0.25, 0.10);
    }
  }

  /** Countdown beep — ascending pitch for 3, 2, 1, then a big "GO" tone */
  playCountdownBeep(num: number): void {
    if (num === 3) this.playTone(440, 0.15, "square", 0.12);
    else if (num === 2) this.playTone(554, 0.15, "square", 0.12);
    else if (num === 1) this.playTone(659, 0.15, "square", 0.12);
    else {
      // "GO" — big chord
      this.playTone(880, 0.3, "square", 0.12);
      this.playTone(1100, 0.3, "triangle", 0.08);
    }
  }

  playWarning(): void {
    this.playTone(600, 0.12, "square", 0.12);
    setTimeout(() => this.playTone(800, 0.12, "square", 0.12), 130);
  }

  // ── Projectile Sound ────────────────────────────────────
  playProjectile(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const duration = 0.06;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
    const cleanupMs = (duration + 0.2) * 1000;
    const tid = setTimeout(() => {
      this.activeTimeouts.delete(tid);
      try { osc.disconnect(); gain.disconnect(); } catch {}
    }, cleanupMs) as unknown as number;
    this.activeTimeouts.add(tid);
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

  // ── Background Music (32-bar Vietnamese-Influenced Chiptune) ──
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

  setMusicSpeed(speedMultiplier: number): void {
    this.musicSpeedMultiplier = speedMultiplier;
    // Scale BPM: base 180, up to 200 at high speed
    this.musicBPM = Math.min(200, 180 + (speedMultiplier - 1) * 200);
  }

  // ── Đàn Tranh-style vibrato tone (triangle + LFO + octave doubling) ────
  // Technique from duck.baby: every note plays TWO oscillators — one at pitch,
  // one octave below — for a rich, full chiptune sound
  private playVibratoTone(freq: number, duration: number, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Primary oscillator (triangle for đàn tranh character)
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    // 7Hz vibrato LFO — simulates đàn tranh tremolo
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freq * 0.015; // ±1.5% = ~25 cents
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.005, vol), now);
    gain.gain.setValueAtTime(Math.max(0.005, vol * 0.8), now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration + 0.02);
    lfo.stop(now + duration + 0.02);

    // Octave-below doubling (square wave for richness)
    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = freq / 2;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(Math.max(0.005, vol * 0.4), now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + duration + 0.02);

    osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); osc2.disconnect(); gain2.disconnect(); } catch {} };
    const cleanupMs = (duration + 0.2) * 1000;
    const tid = setTimeout(() => {
      this.activeTimeouts.delete(tid);
      try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); osc2.disconnect(); gain2.disconnect(); } catch {}
    }, cleanupMs) as unknown as number;
    this.activeTimeouts.add(tid);
  }

  private playMusicLoop(): void {
    if (!this.musicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bpm = this.musicBPM;
    const beatMs = (60 / bpm) * 1000;
    const totalBeats = 64; // 16 bars × 4 beats — tight, energetic loop

    // Transpose up 2 semitones at high speed for tension
    const shift = this.musicSpeedMultiplier >= 1.10 ? Math.pow(2, 2 / 12) : 1;

    // ── Vietnamese "Nam" mode (C-D-F-G-Bb) ──────────────
    const C4 = 261.63 * shift, D4 = 293.66 * shift, F4 = 349.23 * shift;
    const G4 = 392.00 * shift, Bb4 = 466.16 * shift;
    const C5 = 523.25 * shift, D5 = 587.33 * shift, F5 = 698.46 * shift;
    // Bass
    const C3 = 130.81 * shift, D3 = 146.83 * shift, F3 = 174.61 * shift;
    const G3 = 196.00 * shift, Bb3 = 233.08 * shift;

    const useHarmony = this.musicSpeedMultiplier >= 1.03;
    const useDoubleBass = this.musicSpeedMultiplier >= 1.06;

    // ── Scheduling helpers ──────────────────────────────
    const sched = (beat: number, fn: () => void) => {
      const tid = setTimeout(() => { if (this.musicPlaying) fn(); }, beat * beatMs) as unknown as number;
      this.musicTimeouts.push(tid);
    };
    const lead = (beat: number, freq: number, dur: number, vol: number) =>
      sched(beat, () => this.playVibratoTone(freq, dur, vol));
    const harmony = (beat: number, freq: number, dur: number, vol: number) => {
      if (!useHarmony) return;
      sched(beat, () => this.playTone(freq * Math.pow(2, 7 / 1200), dur, "square", vol));
    };
    const bass = (beat: number, freq: number, dur: number, vol: number) => {
      sched(beat, () => {
        this.playTone(freq, dur, "triangle", vol);
        if (useDoubleBass) {
          // Octave jump on the "and" — Vietnamese pop bass groove
          setTimeout(() => {
            if (this.musicPlaying) this.playTone(freq * 2, dur * 0.6, "triangle", vol * 0.7);
          }, dur * 0.5 * 1000);
        }
      });
    };
    const kick = (beat: number) => sched(beat, () => this.playNoiseBurst(0.07, 0.10, 60));
    const snare = (beat: number) => sched(beat, () => this.playNoiseBurst(0.05, 0.07, 3000));
    const hihat = (beat: number) => sched(beat, () => this.playNoiseBurst(0.025, 0.04, 8000));
    const accent = (beat: number, freq: number) => sched(beat, () => this.playTone(freq, 0.06, "square", 0.05));

    // ═══════════════════════════════════════════════════════
    // BARS 1-4: Main Riff — bouncy staccato (beats 0-15)
    // Short punchy notes with rhythmic gaps = jumpy feel
    // ═══════════════════════════════════════════════════════
    lead(0, G4, 0.08, 0.08);  lead(0.5, G4, 0.06, 0.05);
    lead(1, Bb4, 0.08, 0.08); lead(2, C5, 0.08, 0.09);
    lead(2.5, C5, 0.06, 0.05); // echo bounce
    lead(3, Bb4, 0.06, 0.06); lead(3.5, G4, 0.06, 0.06);
    // Answer
    lead(4, F4, 0.08, 0.07);  lead(5, G4, 0.08, 0.08);
    lead(5.5, Bb4, 0.06, 0.06); lead(6, C5, 0.10, 0.09);
    lead(7, Bb4, 0.06, 0.06); lead(7.5, G4, 0.06, 0.06);
    // Phrase 3: rapid climbing
    lead(8, G4, 0.06, 0.07);  lead(8.5, Bb4, 0.06, 0.07);
    lead(9, C5, 0.06, 0.08);  lead(9.5, D5, 0.06, 0.08);
    lead(10, F5, 0.10, 0.09); // peak
    lead(11, D5, 0.06, 0.07); lead(11.5, C5, 0.06, 0.07);
    // Bounce resolve
    lead(12, Bb4, 0.08, 0.07); lead(13, G4, 0.08, 0.07);
    lead(14, F4, 0.06, 0.06); lead(14.5, G4, 0.06, 0.06);
    lead(15, Bb4, 0.08, 0.07);
    // Stab accents on downbeats
    accent(0, C5); accent(4, C5); accent(8, C5); accent(12, C5);

    // ═══════════════════════════════════════════════════════
    // BARS 5-8: Response — lower bounce (beats 16-31)
    // ═══════════════════════════════════════════════════════
    lead(16, D4, 0.08, 0.07); lead(16.5, D4, 0.06, 0.05);
    lead(17, F4, 0.08, 0.07); lead(18, G4, 0.08, 0.08);
    lead(18.5, G4, 0.06, 0.05);
    lead(19, F4, 0.06, 0.06); lead(19.5, D4, 0.06, 0.06);
    lead(20, C4, 0.08, 0.07); lead(21, D4, 0.08, 0.07);
    lead(21.5, F4, 0.06, 0.06); lead(22, G4, 0.10, 0.08);
    lead(23, F4, 0.06, 0.06); lead(23.5, D4, 0.06, 0.06);
    // Rising answer
    lead(24, F4, 0.06, 0.06); lead(24.5, G4, 0.06, 0.06);
    lead(25, Bb4, 0.06, 0.07); lead(25.5, C5, 0.06, 0.07);
    lead(26, D5, 0.10, 0.08);
    lead(27, C5, 0.06, 0.07); lead(27.5, Bb4, 0.06, 0.06);
    lead(28, G4, 0.08, 0.07); lead(29, F4, 0.06, 0.06);
    lead(29.5, G4, 0.06, 0.06); lead(30, Bb4, 0.08, 0.07);
    lead(31, G4, 0.06, 0.06); lead(31.5, F4, 0.06, 0.06);
    accent(16, C5); accent(20, C5); accent(24, C5); accent(28, C5);

    // ═══════════════════════════════════════════════════════
    // BARS 9-12: Escalation — every beat, harmony, max bounce (beats 32-47)
    // ═══════════════════════════════════════════════════════
    const escalation: Array<[number, number]> = [
      [32, G4], [32.5, Bb4], [33, C5], [33.5, D5],
      [34, C5], [34.5, Bb4], [35, G4], [35.5, Bb4],
      [36, C5], [36.5, D5], [37, F5], [37.5, D5],
      [38, C5], [38.5, Bb4], [39, G4], [39.5, F4],
      [40, G4], [40.5, Bb4], [41, C5], [41.5, D5],
      [42, F5], [42.5, D5], [43, C5], [43.5, Bb4],
      [44, G4], [44.5, Bb4], [45, C5], [45.5, D5],
      [46, C5], [46.5, Bb4], [47, G4], [47.5, F4],
    ];
    for (const [beat, freq] of escalation) {
      lead(beat, freq, 0.07, 0.08);
      harmony(beat, freq, 0.07, 0.04);
    }
    for (let b = 32; b < 48; b += 2) accent(b, C5);

    // ═══════════════════════════════════════════════════════
    // BARS 13-16: Peak — full send, rapid fire (beats 48-63)
    // ═══════════════════════════════════════════════════════
    // Rapid ascending runs
    lead(48, C5, 0.06, 0.09);  lead(48.5, D5, 0.06, 0.09);
    lead(49, F5, 0.10, 0.10);  lead(49.5, F5, 0.06, 0.07);
    lead(50, D5, 0.06, 0.08);  lead(50.5, C5, 0.06, 0.08);
    lead(51, Bb4, 0.06, 0.07); lead(51.5, G4, 0.06, 0.07);
    // Second rapid climb
    lead(52, Bb4, 0.06, 0.08); lead(52.5, C5, 0.06, 0.08);
    lead(53, D5, 0.06, 0.09);  lead(53.5, F5, 0.06, 0.09);
    lead(54, D5, 0.10, 0.10);
    lead(55, C5, 0.06, 0.08);  lead(55.5, Bb4, 0.06, 0.07);
    // Descending bounce finale
    lead(56, C5, 0.06, 0.09);  lead(56.5, D5, 0.06, 0.09);
    lead(57, F5, 0.08, 0.10);  lead(57.5, D5, 0.06, 0.08);
    lead(58, C5, 0.06, 0.08);  lead(58.5, Bb4, 0.06, 0.07);
    lead(59, G4, 0.06, 0.07);  lead(59.5, F4, 0.06, 0.07);
    lead(60, D4, 0.06, 0.06);  lead(60.5, F4, 0.06, 0.06);
    lead(61, G4, 0.06, 0.07);  lead(61.5, Bb4, 0.06, 0.07);
    lead(62, C5, 0.06, 0.08);  lead(62.5, G4, 0.06, 0.07);
    lead(63, F4, 0.08, 0.07);  lead(63.5, D4, 0.08, 0.07);
    // Harmony throughout peak
    for (const [beat, freq] of [[48,C5],[49,F5],[52,Bb4],[53,D5],[54,D5],[56,C5],[57,F5]] as Array<[number,number]>) {
      harmony(beat, freq, 0.08, 0.05);
    }
    for (let b = 48; b < 64; b += 2) accent(b, C5);

    // ═══════════════════════════════════════════════════════
    // BASS: constant 8th-note pulse with octave jumps
    // ═══════════════════════════════════════════════════════
    const bassLine: Array<[number, number]> = [
      // Bars 1-4
      [0, C3], [2, C3], [4, F3], [6, G3],
      [8, C3], [10, Bb3], [12, G3], [14, F3],
      // Bars 5-8
      [16, D3], [18, D3], [20, F3], [22, G3],
      [24, D3], [26, F3], [28, G3], [30, Bb3],
      // Bars 9-12: driving escalation
      [32, C3], [34, G3], [36, C3], [38, Bb3],
      [40, C3], [42, G3], [44, F3], [46, D3],
      // Bars 13-16: peak bass
      [48, C3], [50, F3], [52, G3], [54, Bb3],
      [56, C3], [58, G3], [60, D3], [62, F3],
    ];
    for (const [beat, freq] of bassLine) {
      bass(beat, freq, 0.28, 0.09);
    }

    // ═══════════════════════════════════════════════════════
    // DRUMS: syncopated kick, driving hi-hats, snare accents
    // ═══════════════════════════════════════════════════════

    // Hi-hat: 8th notes throughout (every half-beat = jumpy driving pulse)
    for (let b = 0; b < totalBeats; b += 0.5) {
      hihat(b);
    }

    // Kick: syncopated Vietnamese-inspired pattern per 4-bar phrase
    const kickPattern = [0, 1.5, 3, 4, 5.5, 7, 8, 9.5, 11, 12, 13.5, 15];
    for (let section = 0; section < 4; section++) {
      const base = section * 16;
      for (const offset of kickPattern) {
        kick(base + offset);
      }
    }

    // Snare: backbeats + fills
    for (let b = 2; b < totalBeats; b += 4) {
      snare(b); // Snare on beat 3 of each bar
    }
    // Snare fill at end of each 4-bar section
    for (const fillStart of [14, 30, 46, 62]) {
      snare(fillStart); snare(fillStart + 0.5);
    }

    // Accent stabs on downbeats (bars 9-16 only — adds urgency)
    for (let b = 32; b < totalBeats; b += 4) {
      accent(b, C5);
    }

    // ═══════════════════════════════════════════════════════
    // Loop after 64 beats
    // ═══════════════════════════════════════════════════════
    const loopTid = setTimeout(() => this.playMusicLoop(), totalBeats * beatMs) as unknown as number;
    this.musicTimeouts.push(loopTid);
  }

  /** Nuclear option: disconnect sfxGain momentarily to kill any stuck sounds, then reconnect */
  silenceAll(): void {
    if (!this.sfxGain || !this.masterGain) return;
    try { this.sfxGain.disconnect(); } catch {}
    // Clear all proactive cleanup timeouts
    for (const tid of this.activeTimeouts) clearTimeout(tid);
    this.activeTimeouts.clear();
    // Stop putt-putt engine timer
    if (this.engineTimerId !== null) {
      clearInterval(this.engineTimerId);
      this.engineTimerId = null;
      this.engineRunning = false;
    }
    // Reconnect sfxGain so future sounds work
    this.sfxGain.connect(this.masterGain);
  }

  // ── Lobby Music (atmospheric, slower Vietnamese vibe) ────
  private lobbyPlaying = false;
  private lobbyTimeouts: number[] = [];

  startLobbyMusic(): void {
    if (this.lobbyPlaying) return;
    this.init();
    this.lobbyPlaying = true;
    this.playLobbyLoop();
  }

  stopLobbyMusic(): void {
    this.lobbyPlaying = false;
    for (const t of this.lobbyTimeouts) clearTimeout(t);
    this.lobbyTimeouts = [];
  }

  private playLobbyLoop(): void {
    if (!this.lobbyPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Same energy as the game — gets you pumped before you even start
    const bpm = 170;
    const beatMs = (60 / bpm) * 1000;
    const totalBeats = 64;

    const C4 = 261.63, D4 = 293.66, F4 = 349.23, G4 = 392.00, Bb4 = 466.16;
    const C5 = 523.25, D5 = 587.33, F5 = 698.46;
    const C3 = 130.81, D3 = 146.83, F3 = 174.61, G3 = 196.00, Bb3 = 233.08;

    const sched = (beat: number, fn: () => void) => {
      const tid = setTimeout(() => { if (this.lobbyPlaying) fn(); }, beat * beatMs) as unknown as number;
      this.lobbyTimeouts.push(tid);
    };
    const lead = (beat: number, freq: number, dur: number, vol: number) =>
      sched(beat, () => this.playVibratoTone(freq, dur, vol));
    const bass = (beat: number, freq: number, dur: number, vol: number) =>
      sched(beat, () => this.playTone(freq, dur, "triangle", vol));
    const kick = (beat: number) => sched(beat, () => this.playNoiseBurst(0.06, 0.10, 60));
    const hihat = (beat: number) => sched(beat, () => this.playNoiseBurst(0.02, 0.04, 8000));
    const snare = (beat: number) => sched(beat, () => this.playNoiseBurst(0.04, 0.07, 3000));

    // ── Melody: bouncy staccato, same vibe as game music ──
    lead(0, G4, 0.08, 0.06); lead(0.5, G4, 0.06, 0.04);
    lead(1, Bb4, 0.08, 0.06); lead(2, C5, 0.08, 0.07);
    lead(3, Bb4, 0.06, 0.05); lead(3.5, G4, 0.06, 0.05);
    lead(4, F4, 0.08, 0.06); lead(5, G4, 0.08, 0.06);
    lead(6, C5, 0.10, 0.07); lead(7, Bb4, 0.06, 0.05);
    lead(8, G4, 0.06, 0.06); lead(8.5, Bb4, 0.06, 0.06);
    lead(9, C5, 0.06, 0.07); lead(9.5, D5, 0.06, 0.07);
    lead(10, F5, 0.10, 0.08);
    lead(11, D5, 0.06, 0.06); lead(11.5, C5, 0.06, 0.06);
    lead(12, Bb4, 0.08, 0.06); lead(13, G4, 0.08, 0.06);
    lead(14, F4, 0.06, 0.05); lead(14.5, G4, 0.06, 0.05);
    lead(15, Bb4, 0.08, 0.06);
    // Response phrase
    lead(16, D4, 0.08, 0.06); lead(17, F4, 0.08, 0.06);
    lead(18, G4, 0.08, 0.07); lead(19, F4, 0.06, 0.05);
    lead(20, C4, 0.08, 0.06); lead(21, D4, 0.08, 0.06);
    lead(22, G4, 0.10, 0.07); lead(23, F4, 0.06, 0.05);
    lead(24, F4, 0.06, 0.06); lead(24.5, G4, 0.06, 0.06);
    lead(25, Bb4, 0.06, 0.07); lead(25.5, C5, 0.06, 0.07);
    lead(26, D5, 0.10, 0.07);
    lead(28, G4, 0.08, 0.06); lead(30, Bb4, 0.08, 0.06);
    // Bars 9-16: repeat with escalation
    lead(32, G4, 0.06, 0.07); lead(32.5, Bb4, 0.06, 0.07);
    lead(33, C5, 0.06, 0.07); lead(33.5, D5, 0.06, 0.07);
    lead(34, C5, 0.06, 0.06); lead(34.5, Bb4, 0.06, 0.06);
    lead(35, G4, 0.06, 0.06); lead(35.5, Bb4, 0.06, 0.06);
    lead(36, C5, 0.06, 0.07); lead(36.5, D5, 0.06, 0.07);
    lead(37, F5, 0.10, 0.08); lead(37.5, D5, 0.06, 0.06);
    lead(38, C5, 0.06, 0.06); lead(39, Bb4, 0.06, 0.06);
    lead(40, G4, 0.06, 0.07); lead(40.5, Bb4, 0.06, 0.07);
    lead(41, C5, 0.06, 0.07); lead(41.5, D5, 0.06, 0.07);
    lead(42, F5, 0.08, 0.08); lead(43, D5, 0.06, 0.06);
    lead(44, C5, 0.06, 0.06); lead(45, Bb4, 0.06, 0.06);
    lead(46, G4, 0.06, 0.06); lead(47, F4, 0.06, 0.06);
    // Peak bars 13-16
    lead(48, C5, 0.06, 0.08); lead(48.5, D5, 0.06, 0.08);
    lead(49, F5, 0.10, 0.09);
    lead(50, D5, 0.06, 0.07); lead(50.5, C5, 0.06, 0.07);
    lead(51, Bb4, 0.06, 0.06); lead(51.5, G4, 0.06, 0.06);
    lead(52, Bb4, 0.06, 0.07); lead(52.5, C5, 0.06, 0.07);
    lead(53, D5, 0.06, 0.08); lead(53.5, F5, 0.06, 0.08);
    lead(54, D5, 0.10, 0.09);
    lead(56, C5, 0.06, 0.08); lead(57, F5, 0.08, 0.09);
    lead(58, D5, 0.06, 0.07); lead(59, C5, 0.06, 0.07);
    lead(60, Bb4, 0.06, 0.06); lead(61, G4, 0.06, 0.06);
    lead(62, F4, 0.08, 0.06); lead(63, G4, 0.08, 0.06);

    // ── Bass ──
    const bassLine: Array<[number, number]> = [
      [0, C3], [4, F3], [8, C3], [12, G3],
      [16, D3], [20, F3], [24, G3], [28, Bb3],
      [32, C3], [36, G3], [40, C3], [44, F3],
      [48, C3], [52, G3], [56, F3], [60, C3],
    ];
    for (const [beat, freq] of bassLine) bass(beat, freq, 0.28, 0.07);

    // ── Drums ──
    for (let b = 0; b < totalBeats; b += 0.5) hihat(b);
    const kickPattern = [0, 1.5, 3, 4, 5.5, 7, 8, 9.5, 11, 12, 13.5, 15];
    for (let section = 0; section < 4; section++) {
      for (const offset of kickPattern) kick(section * 16 + offset);
    }
    for (let b = 2; b < totalBeats; b += 4) snare(b);

    const loopTid = setTimeout(() => this.playLobbyLoop(), totalBeats * beatMs) as unknown as number;
    this.lobbyTimeouts.push(loopTid);
  }

  // ── Game Over Slowdown ─────────────────────────────────────
  /** Slow music to a crawl and play a descending game-over melody */
  gameOverSlowdown(): void {
    // Stop the game music loop from scheduling new notes
    this.musicPlaying = false;
    for (const t of this.musicTimeouts) clearTimeout(t);
    this.musicTimeouts = [];

    // Fade master volume down over 1.5s
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 1.5);
    }

    // Slow, mournful Vietnamese melody — the dreamy version
    const C4 = 261.63, D4 = 293.66, F4 = 349.23, G4 = 392.00, Bb4 = 466.16;
    const C3 = 130.81, F3 = 174.61, Bb3 = 233.08;

    // Descending lament — slow and spacious
    setTimeout(() => this.playVibratoTone(Bb4, 0.8, 0.06), 300);
    setTimeout(() => this.playTone(Bb3, 1.0, "triangle", 0.05), 300);
    setTimeout(() => this.playVibratoTone(G4, 0.8, 0.06), 900);
    setTimeout(() => this.playVibratoTone(F4, 1.0, 0.06), 1600);
    setTimeout(() => this.playTone(F3, 1.2, "triangle", 0.05), 1600);
    setTimeout(() => this.playVibratoTone(D4, 1.0, 0.05), 2400);
    setTimeout(() => this.playVibratoTone(C4, 1.5, 0.06), 3200);
    setTimeout(() => this.playTone(C3, 2.0, "triangle", 0.05), 3200); // Deep bass resolution

    // Restore volume after melody for the results screen transition
    setTimeout(() => {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.5);
      }
    }, 4000);
  }

  destroy(): void {
    this.stopEngine();
    this.stopMusic();
    this.stopLobbyMusic();
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
