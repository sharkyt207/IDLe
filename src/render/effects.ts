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
 * Sparks and floating numbers. Pools are capped so a fully automated yard
 * cannot flood a mid-range phone with particles.
 */
export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];

  private static readonly MAX_PARTICLES = 160;
  private static readonly MAX_TEXTS = 24;

  sparks(x: number, y: number, color = '#ffb545', count = 12): void {
    if (this.particles.length > Effects.MAX_PARTICLES) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
  }

  text(x: number, y: number, text: string, color = '#ffe9a8', size = 26): void {
    if (this.texts.length > Effects.MAX_TEXTS) this.texts.shift();
    this.texts.push({ x, y, text, life: 1.1, maxLife: 1.1, color, size });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
      else t.y -= 46 * dt;
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
      const alpha = Math.min(1, t.life / t.maxLife * 1.6);
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
    this.particles.length = 0;
    this.texts.length = 0;
  }
}
