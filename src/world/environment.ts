import type { GameState } from '../game/state';

/** A full day lasts 15 minutes (GDD chapter 3). */
export const DAY_LENGTH = 15 * 60;

export type DayPhase = 'morgen' | 'mittag' | 'abend' | 'nacht';

export interface WeatherDef {
  id: string;
  name: string;
  icon: string;
  weight: number;
  /** Seconds. */
  minDuration: number;
  maxDuration: number;
}

/** Weather is atmosphere only - it never touches production (GDD). */
export const WEATHERS: WeatherDef[] = [
  { id: 'clear', name: 'Sonnig', icon: '☀️', weight: 34, minDuration: 120, maxDuration: 300 },
  { id: 'cloudy', name: 'Bewölkt', icon: '☁️', weight: 26, minDuration: 120, maxDuration: 300 },
  { id: 'rain', name: 'Regen', icon: '🌧️', weight: 16, minDuration: 90, maxDuration: 200 },
  { id: 'fog', name: 'Nebel', icon: '🌫️', weight: 10, minDuration: 90, maxDuration: 180 },
  { id: 'snow', name: 'Schnee', icon: '❄️', weight: 10, minDuration: 120, maxDuration: 240 },
  { id: 'storm', name: 'Gewitter', icon: '⛈️', weight: 4, minDuration: 60, maxDuration: 120 },
];

export interface Ambience {
  phase: DayPhase;
  /** 0 = midnight, 0.5 = noon. */
  dayFraction: number;
  /** Colour laid over the world to tint the light. */
  tint: string;
  tintAlpha: number;
  /** 0 (day) … 1 (deep night) - drives lamps and window lights. */
  darkness: number;
  weather: WeatherDef;
  /** Rain/snow strength, 0…1. */
  precipitation: number;
  fog: number;
}

/**
 * Environment system: day/night cycle, weather and the small signs of life.
 *
 * State (time of day, current weather) lives in the save so returning players
 * pick the sky back up where they left it.
 */
export class EnvironmentSystem {
  /** Screen-space precipitation particles, recycled forever. */
  private drops: { x: number; y: number; v: number; len: number }[] = [];
  private flashTimer = 0;
  flash = 0;

  update(state: GameState, dt: number): void {
    const world = state.world;
    world.dayTime = (world.dayTime + dt) % DAY_LENGTH;

    world.weatherLeft -= dt;
    if (world.weatherLeft <= 0) {
      const next = pickWeather();
      world.weather = next.id;
      world.weatherLeft = next.minDuration + Math.random() * (next.maxDuration - next.minDuration);
    }

    // Lightning during a storm.
    if (world.weather === 'storm') {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 4 + Math.random() * 9;
        this.flash = 1;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  ambience(state: GameState): Ambience {
    const f = state.world.dayTime / DAY_LENGTH;
    const weather = WEATHERS.find((w) => w.id === state.world.weather) ?? WEATHERS[0];

    let phase: DayPhase;
    if (f < 0.25) phase = 'morgen';
    else if (f < 0.55) phase = 'mittag';
    else if (f < 0.75) phase = 'abend';
    else phase = 'nacht';

    // Smooth darkness curve: bright around noon, dark around midnight.
    const daylight = Math.max(0, Math.sin(f * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    let darkness = 1 - daylight;
    if (weather.id === 'storm') darkness = Math.min(1, darkness + 0.25);
    if (weather.id === 'rain' || weather.id === 'fog') darkness = Math.min(1, darkness + 0.12);

    // Warm at dawn/dusk, blue at night.
    let tint = '#0b1830';
    if (phase === 'morgen') tint = '#ffb066';
    else if (phase === 'abend') tint = '#ff8a4a';
    else if (phase === 'mittag') tint = '#ffffff';

    const tintAlpha = phase === 'mittag' ? 0 : Math.min(0.55, darkness * 0.65 + (phase === 'nacht' ? 0.1 : 0.06));

    return {
      phase,
      dayFraction: f,
      tint,
      tintAlpha,
      darkness,
      weather,
      precipitation: weather.id === 'rain' ? 1 : weather.id === 'snow' ? 0.6 : weather.id === 'storm' ? 1 : 0,
      fog: weather.id === 'fog' ? 0.45 : weather.id === 'snow' ? 0.12 : 0,
    };
  }

  /**
   * Precipitation is drawn in screen space so it costs the same at any zoom
   * and never scales into a wall of geometry.
   */
  drawWeather(
    ctx: CanvasRenderingContext2D,
    ambience: Ambience,
    viewW: number,
    viewH: number,
    dt: number,
  ): void {
    const snow = ambience.weather.id === 'snow';
    const want = ambience.precipitation <= 0 ? 0 : Math.round((snow ? 60 : 90) * ambience.precipitation);

    while (this.drops.length < want) {
      this.drops.push({
        x: Math.random() * viewW,
        y: Math.random() * viewH,
        v: snow ? 30 + Math.random() * 30 : 420 + Math.random() * 260,
        len: snow ? 2.5 + Math.random() * 1.5 : 9 + Math.random() * 9,
      });
    }
    if (this.drops.length > want) this.drops.length = want;

    if (want > 0) {
      ctx.save();
      ctx.strokeStyle = snow ? 'rgba(255,255,255,0.85)' : 'rgba(170,200,230,0.55)';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      for (const d of this.drops) {
        d.y += d.v * dt;
        d.x += snow ? Math.sin(d.y * 0.02) * 14 * dt : 40 * dt;
        if (d.y > viewH) {
          d.y = -10;
          d.x = Math.random() * viewW;
        }
        if (d.x > viewW) d.x = 0;
        if (snow) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.len / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 3, d.y + d.len);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (ambience.fog > 0) {
      ctx.fillStyle = `rgba(198,206,214,${ambience.fog})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }
}

function pickWeather(): WeatherDef {
  const total = WEATHERS.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of WEATHERS) {
    roll -= w.weight;
    if (roll <= 0) return w;
  }
  return WEATHERS[0];
}
