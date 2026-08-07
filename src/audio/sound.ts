import { UI } from '../data/ui';
import type { GameState } from '../game/state';

/**
 * Sound design (GDD chapter 8), synthesised rather than sampled.
 *
 * The GDD asks for machine noises, metal, hydraulics, sparks and a calm
 * electronic score. Shipping that as audio files would mean megabytes of
 * assets and a loading strategy; the whole game is currently 66 kB with no
 * runtime dependencies. So every sound here is built from oscillators and
 * filtered noise at runtime - a scrapyard is metal, motors and hydraulics,
 * which is exactly what subtractive synthesis is good at.
 *
 * Real recordings can replace this later: the call sites only ever ask for
 * `play('shred')`, never for a buffer.
 *
 * Nothing starts until the player first touches the screen - browsers block
 * audio before a gesture, and a game that asks for sound permission on load is
 * a game people mute.
 */

export type SoundId =
  // UI
  | 'tap'
  | 'confirm'
  | 'cancel'
  | 'error'
  // economy
  | 'coin'
  | 'sell'
  | 'levelUp'
  | 'achievement'
  // yard
  | 'hit'
  | 'detach'
  | 'shred'
  | 'hydraulic'
  | 'weld'
  | 'engine'
  | 'build';

interface Voice {
  /** 'tone' = oscillator, 'noise' = filtered noise burst. */
  kind: 'tone' | 'noise';
  freq?: number;
  /** Sweep target; the frequency glides here over the sound's length. */
  freqTo?: number;
  type?: OscillatorType;
  /** Band-pass centre for noise voices. */
  filter?: number;
  q?: number;
  attack: number;
  decay: number;
  gain: number;
  /** Seconds to wait before this voice starts. */
  delay?: number;
}

/** Each sound is a small stack of voices - that is the whole instrument set. */
const SOUNDS: Record<SoundId, { bus: 'ui' | 'effects'; voices: Voice[] }> = {
  tap: { bus: 'ui', voices: [{ kind: 'tone', freq: 660, freqTo: 520, type: 'triangle', attack: 0.002, decay: 0.06, gain: 0.5 }] },
  confirm: {
    bus: 'ui',
    voices: [
      { kind: 'tone', freq: 520, type: 'triangle', attack: 0.003, decay: 0.09, gain: 0.5 },
      { kind: 'tone', freq: 780, type: 'triangle', attack: 0.003, decay: 0.12, gain: 0.4, delay: 0.06 },
    ],
  },
  cancel: { bus: 'ui', voices: [{ kind: 'tone', freq: 340, freqTo: 220, type: 'triangle', attack: 0.003, decay: 0.1, gain: 0.45 }] },
  error: {
    bus: 'ui',
    voices: [
      { kind: 'tone', freq: 200, type: 'square', attack: 0.004, decay: 0.12, gain: 0.28 },
      { kind: 'tone', freq: 150, type: 'square', attack: 0.004, decay: 0.16, gain: 0.24, delay: 0.08 },
    ],
  },

  coin: {
    bus: 'effects',
    voices: [
      { kind: 'tone', freq: 1180, type: 'sine', attack: 0.002, decay: 0.07, gain: 0.35 },
      { kind: 'tone', freq: 1560, type: 'sine', attack: 0.002, decay: 0.1, gain: 0.25, delay: 0.04 },
    ],
  },
  sell: {
    bus: 'effects',
    voices: [
      { kind: 'tone', freq: 620, type: 'triangle', attack: 0.003, decay: 0.1, gain: 0.4 },
      { kind: 'tone', freq: 930, type: 'sine', attack: 0.003, decay: 0.16, gain: 0.3, delay: 0.07 },
      { kind: 'tone', freq: 1240, type: 'sine', attack: 0.003, decay: 0.2, gain: 0.2, delay: 0.14 },
    ],
  },
  levelUp: {
    bus: 'effects',
    voices: [
      { kind: 'tone', freq: 440, type: 'triangle', attack: 0.005, decay: 0.18, gain: 0.4 },
      { kind: 'tone', freq: 660, type: 'triangle', attack: 0.005, decay: 0.22, gain: 0.35, delay: 0.09 },
      { kind: 'tone', freq: 880, type: 'triangle', attack: 0.005, decay: 0.35, gain: 0.3, delay: 0.18 },
    ],
  },
  achievement: {
    bus: 'effects',
    voices: [
      { kind: 'tone', freq: 523, type: 'sine', attack: 0.005, decay: 0.2, gain: 0.35 },
      { kind: 'tone', freq: 784, type: 'sine', attack: 0.005, decay: 0.24, gain: 0.3, delay: 0.1 },
      { kind: 'tone', freq: 1046, type: 'sine', attack: 0.005, decay: 0.4, gain: 0.28, delay: 0.2 },
    ],
  },

  // Metal on metal: a short noise crack over a low body thump.
  hit: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 2600, q: 1.4, attack: 0.001, decay: 0.07, gain: 0.5 },
      { kind: 'tone', freq: 180, freqTo: 90, type: 'triangle', attack: 0.002, decay: 0.1, gain: 0.35 },
    ],
  },
  // A part coming off: crack plus a ringing sheet.
  detach: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 1800, q: 1, attack: 0.001, decay: 0.12, gain: 0.45 },
      { kind: 'tone', freq: 420, freqTo: 300, type: 'triangle', attack: 0.004, decay: 0.3, gain: 0.28 },
    ],
  },
  // Shredder: broadband grind with a motor underneath.
  shred: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 900, q: 0.7, attack: 0.02, decay: 0.5, gain: 0.4 },
      { kind: 'tone', freq: 70, type: 'sawtooth', attack: 0.03, decay: 0.5, gain: 0.22 },
    ],
  },
  // Hydraulics: a hiss that falls away, plus the clunk at the end of travel.
  hydraulic: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 3200, q: 0.8, attack: 0.01, decay: 0.35, gain: 0.3 },
      { kind: 'tone', freq: 140, freqTo: 80, type: 'sine', attack: 0.05, decay: 0.3, gain: 0.25, delay: 0.2 },
    ],
  },
  // Welding sparks: fast, bright, electrical.
  weld: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 5200, q: 2.5, attack: 0.001, decay: 0.05, gain: 0.35 },
      { kind: 'noise', filter: 4200, q: 2, attack: 0.001, decay: 0.07, gain: 0.28, delay: 0.05 },
    ],
  },
  engine: {
    bus: 'effects',
    voices: [
      { kind: 'tone', freq: 60, freqTo: 95, type: 'sawtooth', attack: 0.06, decay: 0.6, gain: 0.2 },
      { kind: 'noise', filter: 400, q: 0.6, attack: 0.06, decay: 0.6, gain: 0.15 },
    ],
  },
  // Something got built: dust thump, then a bright confirmation.
  build: {
    bus: 'effects',
    voices: [
      { kind: 'noise', filter: 600, q: 0.6, attack: 0.005, decay: 0.4, gain: 0.4 },
      { kind: 'tone', freq: 110, freqTo: 70, type: 'sine', attack: 0.01, decay: 0.35, gain: 0.35 },
      { kind: 'tone', freq: 700, type: 'triangle', attack: 0.005, decay: 0.2, gain: 0.25, delay: 0.18 },
    ],
  },
};

export class SoundSystem {
  private ctx?: AudioContext;
  private master?: GainNode;
  private buses: Partial<Record<'music' | 'effects' | 'ui', GainNode>> = {};
  private noise?: AudioBuffer;
  private musicTimer?: number;
  private musicStep = 0;
  private settings: GameState['settings'];
  /** Rate limit so a fully automated yard cannot machine-gun the speakers. */
  private lastPlayed = new Map<SoundId, number>();

  constructor(settings: GameState['settings']) {
    this.settings = settings;
  }

  /** Call after any settings change. */
  update(settings: GameState['settings']): void {
    this.settings = settings;
    if (!this.ctx) return;
    this.applyVolumes();
    if (settings.volumeMusic > 0 && settings.sound) this.startMusic();
    else this.stopMusic();
  }

  /**
   * Creates the audio graph. Must run inside a user gesture, so the shell
   * calls it on the first pointer event.
   */
  unlock(): void {
    if (this.ctx || !this.settings.sound) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    try {
      this.ctx = new Ctor();
    } catch {
      return; // no audio on this device - the game plays fine without it
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    for (const name of ['music', 'effects', 'ui'] as const) {
      const bus = this.ctx.createGain();
      bus.connect(this.master);
      this.buses[name] = bus;
    }

    // One second of white noise, reused by every metal and hiss voice.
    const frames = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    if (this.settings.volumeMusic > 0) this.startMusic();
  }

  private applyVolumes(): void {
    if (!this.master) return;
    const on = this.settings.sound ? 1 : 0;
    this.master.gain.value = on;
    if (this.buses.music) this.buses.music.gain.value = clamp01(this.settings.volumeMusic) * 0.5;
    if (this.buses.effects) this.buses.effects.gain.value = clamp01(this.settings.volumeEffects);
    if (this.buses.ui) this.buses.ui.gain.value = clamp01(this.settings.volumeUi);
  }

  /**
   * Plays one sound.
   * @param intensity 0…1, scales gain - a big teardown is louder than a tap
   */
  play(id: SoundId, intensity = 1): void {
    if (!this.ctx || !this.settings.sound) return;
    const def = SOUNDS[id];
    if (!def) return;

    // Never more than ~12 of the same sound per second.
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (now - last < 0.08) return;
    this.lastPlayed.set(id, now);

    const bus = this.buses[def.bus];
    if (!bus) return;

    for (const voice of def.voices) {
      const start = now + (voice.delay ?? 0);
      const gain = this.ctx.createGain();
      const peak = voice.gain * clamp01(intensity);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + voice.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.attack + voice.decay);
      gain.connect(bus);

      if (voice.kind === 'noise' && this.noise) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = voice.filter ?? 1000;
        filter.Q.value = voice.q ?? 1;
        source.connect(filter).connect(gain);
        source.start(start);
        source.stop(start + voice.attack + voice.decay + 0.02);
      } else {
        const osc = this.ctx.createOscillator();
        osc.type = voice.type ?? 'sine';
        osc.frequency.setValueAtTime(voice.freq ?? 440, start);
        if (voice.freqTo) {
          osc.frequency.exponentialRampToValueAtTime(voice.freqTo, start + voice.attack + voice.decay);
        }
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + voice.attack + voice.decay + 0.02);
      }
    }
  }

  /**
   * The score: a slow, unhurried pad sequence with a light industrial pulse.
   * Generated the same way as the effects, so it costs nothing to ship.
   */
  private startMusic(): void {
    if (this.musicTimer !== undefined || !this.ctx) return;
    const beat = 2.4;
    this.musicTimer = window.setInterval(() => this.musicBeat(), beat * 1000);
    this.musicBeat();
  }

  private stopMusic(): void {
    if (this.musicTimer === undefined) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  /** One chord of the pad plus a soft tick. Deliberately sparse. */
  private musicBeat(): void {
    const ctx = this.ctx;
    const bus = this.buses.music;
    if (!ctx || !bus || !this.settings.sound || this.settings.volumeMusic <= 0) return;

    // A minor-ish progression that never resolves - calm, not triumphant.
    const roots = [110, 98, 87.31, 130.81];
    const root = roots[this.musicStep % roots.length];
    this.musicStep++;

    const now = ctx.currentTime;
    for (const [index, ratio] of [1, 1.5, 2.4].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;

      osc.type = index === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = root * ratio;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05 / (index + 1), now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
      osc.connect(filter).connect(gain).connect(bus);
      osc.start(now);
      osc.stop(now + 2.4);
    }
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = undefined;
  }
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Sound ids and their meaning, for the settings preview. */
export const SOUND_PREVIEW: { id: SoundId; label: string }[] = [
  { id: 'hit', label: 'Hammerschlag' },
  { id: 'shred', label: 'Schredder' },
  { id: 'hydraulic', label: 'Hydraulik' },
  { id: 'weld', label: 'Schweißfunken' },
  { id: 'engine', label: 'Motor' },
  { id: 'coin', label: 'Geld' },
];

export { UI as UI_TOKENS };
