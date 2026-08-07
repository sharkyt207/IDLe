import { Pool } from '../core/pool';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/**
 * Sparks, dust and floating numbers.
 *
 * Both kinds of object are **pooled** (GDD chapter 9). A busy late-game yard
 * creates and drops hundreds of these per second; recycling them instead of
 * allocating keeps the garbage collector out of the frame budget, which is
 * where mid-range phones lose their 60 FPS.
 *
 * Counts are capped as well, so a fully automated yard cannot flood the canvas
 * no matter how fast it runs.
 */
export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];

  private static readonly MAX_PARTICLES = 160;
  private static readonly MAX_TEXTS = 24;

  private particlePool = new Pool<Particle>(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff' }),
    (p) => {
      p.life = 0;
    },
    Effects.MAX_PARTICLES * 2,
  );

  private textPool = new Pool<FloatText>(
    () => ({ x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 16 }),
    (t) => {
      t.life = 0;
      t.text = '';
    },
    Effects.MAX_TEXTS * 2,
  );

  /**
   * Particle budget, 0…1 (GDD chapter 8: "reduzierte Partikeleffekte").
   * Set by the shell from the accessibility settings; it is also the cheapest
   * lever for a weak device.
   */
  budget = 1;

  sparks(x: number, y: number, color = '#ffb545', count = 12): void {
    if (this.particles.length > Effects.MAX_PARTICLES) return;
    count = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      const p = this.particlePool.take();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.life = 0.45 + Math.random() * 0.35;
      p.maxLife = 0.8;
      p.size = 1.5 + Math.random() * 2.5;
      p.color = color;
      this.particles.push(p);
    }
  }

  text(x: number, y: number, text: string, color = '#ffe9a8', size = 26): void {
    if (this.texts.length > Effects.MAX_TEXTS) {
      const dropped = this.texts.shift();
      if (dropped) this.textPool.give(dropped);
    }
    const t = this.textPool.take();
    t.x = x;
    t.y = y;
    t.text = text;
    t.life = 1.1;
    t.maxLife = 1.1;
    t.color = color;
    t.size = size;
    this.texts.push(t);
  }

  /**
   * A dust cloud (GDD chapter 8: "Gebäude gebaut → Staubwolke → neues Modell
   * erscheint"). Slower, heavier and greyer than sparks, so it reads as
   * settling dust rather than as an explosion.
   */
  dust(x: number, y: number, count = 22): void {
    if (this.particles.length > Effects.MAX_PARTICLES) return;
    count = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 70;
      const grey = 150 + Math.floor(Math.random() * 60);
      const p = this.particlePool.take();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      // Dust drifts sideways and sinks; it does not shoot upwards.
      p.vy = Math.sin(angle) * speed * 0.4 - 12;
      p.life = 0.7 + Math.random() * 0.6;
      p.maxLife = 1.3;
      p.size = 3 + Math.random() * 5;
      p.color = `rgb(${grey},${grey - 6},${grey - 14})`;
      this.particles.push(p);
    }
  }

  /** Live particle count. Exposed for the performance and effect tests. */
  particleCount(): number {
    return this.particles.length;
  }

  /** Pool occupancy, for the debug panel. */
  poolStats(): { particles: { idle: number; created: number }; texts: { idle: number; created: number } } {
    return { particles: this.particlePool.stats(), texts: this.textPool.stats() };
  }

  update(dt: number): void {
    // Swap-and-pop instead of splice: order does not matter for particles, and
    // splice in a hot loop is O(n) per removal.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particlePool.give(p);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Floating numbers keep their order so they stack readably.
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.textPool.give(t);
        this.texts.splice(i, 1);
      } else {
        t.y -= 46 * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.6);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${t.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particlePool.giveAll(this.particles);
    this.textPool.giveAll(this.texts);
    this.particles.length = 0;
    this.texts.length = 0;
  }
}
