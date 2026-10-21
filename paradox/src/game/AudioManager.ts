// All sound is synthesised at runtime with the Web Audio API: there are no
// audio files to download or go missing. Audio starts only after a user
// gesture, as browsers require.

export type Sfx =
  | 'move'
  | 'push'
  | 'bump'
  | 'portal'
  | 'switch'
  | 'key'
  | 'shard'
  | 'unlock'
  | 'gravity'
  | 'record'
  | 'rewind'
  | 'fall'
  | 'death'
  | 'win'
  | 'ui'
  | 'coin'
  | 'mirror'
  | 'wait'
  | 'error';

const CHORDS: number[][][] = [
  // One progression per world (MIDI note numbers).
  [[57, 64, 69, 72], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 67]],
  [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]],
  [[48, 55, 62, 63], [46, 53, 58, 62], [44, 51, 56, 60], [43, 50, 55, 58]],
  [[45, 52, 55, 60], [41, 48, 53, 56], [43, 46, 50, 55], [40, 47, 52, 55]],
  [[49, 56, 61, 64], [45, 52, 57, 61], [47, 54, 59, 63], [44, 51, 56, 59]],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicWorld = 0;
  private chordIndex = 0;
  private voices: { osc: OscillatorNode; gain: GainNode }[] = [];
  sfxVolume = 0.8;
  musicVolume = 0.5;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicWorld && !this.musicTimer) this.startMusic(this.musicWorld);
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxGain!.gain.setTargetAtTime(this.sfxVolume * 0.6, t, 0.05);
    this.musicGain!.gain.setTargetAtTime(this.musicVolume * 0.18, t, 0.3);
  }

  /** Pause all audio, e.g. when the page is hidden. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hiss(dur: number, vol: number, freq: number, delay = 0, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(s: Sfx) {
    if (!this.ctx || this.ctx.state !== 'running' || this.sfxVolume <= 0) return;
    switch (s) {
      case 'move':
        this.tone(330 + Math.random() * 30, 0.08, 'triangle', 0.18);
        this.hiss(0.05, 0.05, 2400);
        break;
      case 'wait':
        this.tone(660, 0.06, 'sine', 0.08);
        this.tone(495, 0.08, 'sine', 0.06, 0.07);
        break;
      case 'push':
        this.tone(110, 0.16, 'sine', 0.35, 0, 70);
        this.hiss(0.12, 0.12, 600);
        break;
      case 'bump':
        this.tone(140, 0.09, 'square', 0.06, 0, 100);
        break;
      case 'error':
        this.tone(220, 0.12, 'sawtooth', 0.05, 0, 180);
        break;
      case 'portal':
        this.tone(300, 0.35, 'sine', 0.2, 0, 1200);
        this.hiss(0.35, 0.08, 3000, 0, 4);
        break;
      case 'switch':
        this.tone(900, 0.05, 'square', 0.08);
        this.tone(1300, 0.08, 'square', 0.06, 0.04);
        break;
      case 'mirror':
        this.tone(1400, 0.1, 'triangle', 0.08, 0, 1800);
        break;
      case 'key':
        [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.14, i * 0.06));
        break;
      case 'shard':
        [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.05));
        break;
      case 'coin':
        this.tone(1319, 0.08, 'square', 0.06);
        this.tone(1760, 0.15, 'square', 0.06, 0.07);
        break;
      case 'unlock':
        this.tone(392, 0.1, 'square', 0.08);
        this.tone(523, 0.18, 'triangle', 0.12, 0.08);
        break;
      case 'gravity':
        this.tone(200, 0.5, 'sine', 0.2, 0, 60);
        this.tone(400, 0.5, 'triangle', 0.06, 0.05, 120);
        break;
      case 'record':
        this.tone(440, 0.3, 'sine', 0.14, 0, 880);
        break;
      case 'rewind':
        this.tone(1200, 0.45, 'sine', 0.16, 0, 200);
        this.hiss(0.45, 0.06, 1500, 0, 2);
        break;
      case 'fall':
        this.tone(500, 0.5, 'sine', 0.15, 0, 80);
        break;
      case 'death':
        this.hiss(0.4, 0.25, 800, 0, 0.8);
        this.tone(160, 0.35, 'sawtooth', 0.1, 0, 50);
        break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, i * 0.08));
        break;
      case 'ui':
        this.tone(880, 0.05, 'sine', 0.07);
        break;
    }
  }

  /** Coin pickup; the pitch climbs with each coin in a combo. */
  coin(combo: number) {
    if (!this.ctx || this.ctx.state !== 'running' || this.sfxVolume <= 0) return;
    const base = 988 * Math.pow(2, Math.min(combo - 1, 8) / 12);
    this.tone(base, 0.07, 'square', 0.07);
    this.tone(base * 1.5, 0.16, 'square', 0.07, 0.06);
    if (combo >= 3) this.tone(base * 2, 0.2, 'triangle', 0.08, 0.12);
  }

  /** Slow generative pad for a world (0 = menu). */
  startMusic(world: number) {
    this.musicWorld = Math.max(1, Math.min(5, world || 1));
    if (!this.ctx) return;
    this.stopMusic();
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(this.musicGain!);
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(filter);
      osc.start();
      this.voices.push({ osc, gain });
    }
    const progression = CHORDS[this.musicWorld - 1];
    const next = () => {
      if (!this.ctx) return;
      const chord = progression[this.chordIndex++ % progression.length];
      const t = this.ctx.currentTime;
      this.voices.forEach((v, i) => {
        v.osc.frequency.setTargetAtTime(midi(chord[i] - 12 + (i === 3 ? 12 : 0)), t, 0.8);
        v.gain.gain.setTargetAtTime(0.0, t, 0.5);
        v.gain.gain.setTargetAtTime(i === 0 ? 0.5 : 0.28, t + 0.6, 1.2);
      });
    };
    next();
    this.musicTimer = window.setInterval(next, 7000);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) {
      v.gain.gain.setTargetAtTime(0, t, 0.3);
      v.osc.stop(t + 1.5);
    }
    this.voices = [];
  }
}
