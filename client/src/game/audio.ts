// Saigon Rush — Procedural Web Audio synthesis
// No audio files. All sounds generated via Web Audio API oscillators & noise.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning = false;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.init();
    if (this.ctx!.state === "suspended") this.ctx!.resume();
    return this.ctx!;
  }

  playEngine(): void {
    if (this.engineRunning) return;
    const ctx = this.ensureContext();
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 85;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.12;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.masterGain!);
    this.engineOsc.start();
    this.engineRunning = true;
  }

  stopEngine(): void {
    if (!this.engineRunning || !this.engineOsc) return;
    this.engineOsc.stop();
    this.engineOsc.disconnect();
    this.engineOsc = null;
    this.engineGain?.disconnect();
    this.engineGain = null;
    this.engineRunning = false;
  }

  setEngineSpeed(speed: number): void {
    if (!this.engineOsc) return;
    // Map speed (200-800 range) to frequency (80-140Hz)
    const freq = 80 + (speed / 800) * 60;
    this.engineOsc.frequency.value = freq;
    if (this.engineGain) {
      this.engineGain.gain.value = 0.08 + (speed / 800) * 0.1;
    }
  }

  playCrash(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Noise burst via buffer
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + 0.15);
    // Descending square wave
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playDodge(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playHorn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 350;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.15, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playBoost(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playPickup(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // C5 blip
    const osc1 = ctx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = 523;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc1.connect(g1);
    g1.connect(this.masterGain!);
    osc1.start(now);
    osc1.stop(now + 0.06);
    // E5 blip
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 659;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.setValueAtTime(0.15, now + 0.07);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
    osc2.connect(g2);
    g2.connect(this.masterGain!);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.13);
  }

  destroy(): void {
    this.stopEngine();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
