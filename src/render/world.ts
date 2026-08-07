import { Content } from '../data';
import { BASE_FIXTURES, PARKING, STREET_Y, TEARDOWN_PAD } from '../data/lots';
import type { Game } from '../game/game';
import { BuildingSystem, type Structure } from '../world/buildings';
import { EnvironmentSystem, type Ambience } from '../world/environment';
import { LogisticsSystem } from '../world/logistics';
import { MapSystem, ZONE_COLOR } from '../world/map';
import { TrafficSystem, poseAlong, type RoadVehicle } from '../world/traffic';
import { activeTheme } from '../ui/theme';
import {
  LEVEL_H,
  TILE_H,
  TILE_W,
  depthOf,
  tilePath,
  tileToWorld,
  worldToTile,
  type Point,
} from '../world/iso';
import { Camera } from './camera';
import { Effects } from './effects';
import { drawModel, isoBox, shade } from './models';

const HOTSPOT_R = 26;

/** One thing to draw, sorted back-to-front by depth. */
interface Drawable {
  depth: number;
  draw: () => void;
}

/**
 * The isometric yard.
 *
 * Composes the five world systems (map, buildings, traffic, logistics,
 * environment) into one painter's-algorithm pass. Everything outside the
 * viewport is culled, and animation only advances while the screen is on top,
 * so a fully built yard stays affordable on a mid-range phone.
 */
export class WorldRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  readonly effects = new Effects();

  readonly map = new MapSystem();
  readonly buildings = new BuildingSystem();
  readonly logistics = new LogisticsSystem();
  readonly traffic: TrafficSystem;
  readonly environment = new EnvironmentSystem();

  private dpr = 1;
  private viewW = 0;
  private viewH = 0;
  private time = 0;

  /** Structure key the player is relocating, if any. */
  movingKey: string | null = null;

  onTapPart?: (partId: string) => void;
  onTapStructure?: (structure: Structure) => void;
  /** Long press: show details without changing anything (GDD chapter 8). */
  onInspect?: (structure: Structure) => void;
  onPlaced?: () => void;
  onTapGround?: () => void;

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; time: number } | null = null;
  private dragged = false;
  private pinchDistance = 0;
  /** Timestamp and position of the previous tap, for double-tap detection. */
  private lastTap = { time: 0, x: 0, y: 0 };
  private holdTimer: number | undefined;

  /** Reused each frame to avoid per-frame allocation churn. */
  private drawables: Drawable[] = [];

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
    this.ctx = ctx;
    this.camera = new Camera(canvas.clientWidth || 360, canvas.clientHeight || 480);
    this.traffic = new TrafficSystem(game);

    this.map.sync(game.state);
    this.buildings.markDirty();
    this.buildings.sync(game.state, this.map);
    this.logistics.rebuild(this.buildings.current());

    this.bindInput();
    this.resize();

    game.bus.on('changed', () => this.buildings.markDirty());
  }

  // -------------------------------------------------------------------------
  // Setup & input
  // -------------------------------------------------------------------------

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(1, rect.width);
    this.viewH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.camera.setViewport(this.viewW, this.viewH);
    this.camera.setBounds(this.map.worldBounds, true);
    this.camera.fit();
    this.centerOnPad();
  }

  centerOnPad(): void {
    const c = tileToWorld(TEARDOWN_PAD.x + TEARDOWN_PAD.w / 2, TEARDOWN_PAD.y + TEARDOWN_PAD.h / 2);
    this.camera.focus(c.x, c.y);
  }

  /** World-pixel centre of a structure - used to place dust and effects. */
  structureCenter(structure: Structure): Point {
    return tileToWorld(structure.tx + structure.size / 2, structure.ty + structure.size / 2);
  }

  /** Double tap: glide the camera onto whatever sits under the finger. */
  centerOnScreen(screenX: number, screenY: number): void {
    const world = this.camera.screenToWorld(screenX, screenY);
    const structure = this.hitTestStructure(world.x, world.y);
    if (structure) {
      const c = tileToWorld(structure.tx + structure.size / 2, structure.ty + structure.size / 2);
      this.camera.focus(c.x, c.y);
      return;
    }
    this.camera.focus(world.x, world.y);
  }

  /** Frames a freshly bought plot so the purchase is immediately visible. */
  focusLot(lotId: string): void {
    const c = this.map.lotCenter(lotId);
    if (c) this.camera.focus(c.x, c.y);
  }

  private bindInput(): void {
    const el = this.canvas;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragStart = { x: e.clientX, y: e.clientY, time: performance.now() };
        this.dragged = false;
        // Hold to inspect. Fires on its own so the finger can stay down.
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        window.clearTimeout(this.holdTimer);
        this.holdTimer = window.setTimeout(() => {
          if (this.dragged || this.movingKey) return;
          const world = this.camera.screenToWorld(x, y);
          const structure = this.hitTestStructure(world.x, world.y);
          if (structure) {
            this.dragged = true; // swallow the tap that would follow
            this.onInspect?.(structure);
          }
        }, 420);
      } else if (this.pointers.size === 2) {
        this.pinchDistance = this.currentPinchDistance();
        window.clearTimeout(this.holdTimer);
      }
    });

    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          this.camera.panBy(dx, dy);
          if (this.dragStart) {
            const total = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
            if (total > 10) {
              this.dragged = true;
              window.clearTimeout(this.holdTimer);
            }
          }
        }
      } else if (this.pointers.size === 2) {
        const distance = this.currentPinchDistance();
        if (this.pinchDistance > 0 && distance > 0) {
          const rect = el.getBoundingClientRect();
          const [a, b] = [...this.pointers.values()];
          this.camera.zoomAt(
            (a.x + b.x) / 2 - rect.left,
            (a.y + b.y) / 2 - rect.top,
            distance / this.pinchDistance,
          );
        }
        this.pinchDistance = distance;
        this.dragged = true;
      }
    });

    const end = (e: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      window.clearTimeout(this.holdTimer);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (!wasSingle || !this.dragStart) return;
      const heldMs = performance.now() - this.dragStart.time;
      this.dragStart = null;
      if (this.dragged || heldMs > 600) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Double tap centres the camera on whatever was hit (GDD chapter 8).
      const now = performance.now();
      const near = Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 34;
      if (now - this.lastTap.time < 320 && near) {
        this.lastTap = { time: 0, x, y };
        this.centerOnScreen(x, y);
        return;
      }
      this.lastTap = { time: now, x, y };
      this.handleTap(x, y);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.dragStart = null;
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 0.89);
      },
      { passive: false },
    );
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private handleTap(screenX: number, screenY: number): void {
    const world = this.camera.screenToWorld(screenX, screenY);

    // While relocating, a tap picks the target slot.
    if (this.movingKey) {
      const tile = worldToTile(world.x, world.y);
      const slot = this.nearestSlot(tile.x, tile.y);
      if (slot && this.buildings.move(this.game.state, this.map, this.movingKey, slot.id)) {
        this.movingKey = null;
        this.buildings.sync(this.game.state, this.map);
        this.logistics.rebuild(this.buildings.current());
        this.onPlaced?.();
      }
      return;
    }

    const partId = this.hitTestPart(world.x, world.y);
    if (partId) {
      this.onTapPart?.(partId);
      return;
    }

    const structure = this.hitTestStructure(world.x, world.y);
    if (structure) {
      this.onTapStructure?.(structure);
      return;
    }
    this.onTapGround?.();
  }

  private nearestSlot(tx: number, ty: number) {
    const pool = this.movingKey?.includes('#') ? this.map.decorSpots : this.map.slots;
    let best: { id: string; tx: number; ty: number } | undefined;
    let bestDist = 6;
    for (const slot of pool) {
      const size = this.movingKey?.includes('#') ? 0.5 : 1.5;
      const dist = Math.hypot(tx - (slot.tx + size), ty - (slot.ty + size));
      if (dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    return best;
  }

  private hitTestPart(worldX: number, worldY: number): string | null {
    const active = this.game.state.active;
    if (!active) return null;
    const def = Content.vehicle(active.defId);
    if (!def) return null;

    let best: string | null = null;
    let bestDist = HOTSPOT_R * 1.8;
    for (const partState of active.parts) {
      if (partState.done) continue;
      const partDef = def.parts.find((p) => p.id === partState.id);
      if (!partDef) continue;
      const p = this.partWorldPos(partDef.id);
      if (!p) continue;
      const dist = Math.hypot(worldX - p.x, worldY - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = partState.id;
      }
    }
    return best;
  }

  private hitTestStructure(worldX: number, worldY: number): Structure | undefined {
    const tile = worldToTile(worldX, worldY);
    // Search front-to-back so the nearest structure wins.
    const list = [...this.buildings.current()].sort((a, b) => depthOf(b.tx, b.ty) - depthOf(a.tx, a.ty));
    return list.find(
      (s) =>
        tile.x >= s.tx - 0.5 &&
        tile.y >= s.ty - 0.5 &&
        tile.x < s.tx + s.size + 0.5 &&
        tile.y < s.ty + s.size + 0.5,
    );
  }

  /**
   * World position of a part hotspot.
   *
   * The markers sit on an ellipse around the vehicle rather than on the part's
   * own coordinates: in an isometric view, points with a similar tx+ty collapse
   * onto each other, which would stack touch targets on top of one another.
   * A ring keeps every part separately tappable at any zoom.
   */
  partWorldPos(partId: string): Point | null {
    const active = this.game.state.active;
    const def = active ? Content.vehicle(active.defId) : undefined;
    if (!def) return null;
    const index = def.parts.findIndex((p) => p.id === partId);
    if (index < 0) return null;

    const centre = tileToWorld(
      TEARDOWN_PAD.x + TEARDOWN_PAD.w / 2,
      TEARDOWN_PAD.y + TEARDOWN_PAD.h / 2,
    );
    const count = Math.max(1, def.parts.length);
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return {
      x: centre.x + Math.cos(angle) * TILE_W * 1.15,
      y: centre.y + Math.sin(angle) * TILE_H * 1.15 - LEVEL_H * 0.55,
    };
  }

  padCenter(): Point {
    const c = tileToWorld(TEARDOWN_PAD.x + TEARDOWN_PAD.w / 2, TEARDOWN_PAD.y + TEARDOWN_PAD.h / 2);
    return { x: c.x, y: c.y - LEVEL_H };
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  render(dt: number, visible = true): void {
    this.time += dt;
    const state = this.game.state;

    this.map.sync(state);
    this.camera.setBounds(this.map.worldBounds);
    const structures = this.buildings.sync(state, this.map);
    if (this.structuresChanged(structures)) this.logistics.rebuild(structures);

    this.environment.update(state, dt);
    const ambience = this.environment.ambience(state);

    const working = !!state.active || this.game.stats.teardownRate > 0;
    this.traffic.update(dt, this.map, structures, visible);
    this.logistics.update(dt, this.flowIntensity(), visible);
    this.effects.update(dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = skyColor(ambience);
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    this.camera.apply(ctx);

    const view = this.camera.viewRect(TILE_W * 2);
    this.drawGround(ctx, view, ambience);
    this.drawRoads(ctx);

    this.drawables.length = 0;
    this.collectStructures(structures, view, ambience, working);
    this.collectVehicleOnPad();
    this.collectQueue();
    this.collectTraffic(view);
    this.collectPackets(view);

    this.drawables.sort((a, b) => a.depth - b.depth);
    for (const d of this.drawables) d.draw();

    this.drawSlotHints(ctx);
    this.effects.draw(ctx);
    ctx.restore();

    // Screen-space atmosphere.
    if (ambience.tintAlpha > 0) {
      ctx.globalAlpha = ambience.tintAlpha;
      ctx.fillStyle = ambience.tint;
      ctx.globalCompositeOperation = ambience.phase === 'nacht' ? 'multiply' : 'soft-light';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // Theme tint (GDD chapter 8): night is cooler and darker, winter is pale.
    // One screen-space composite, so a theme costs nothing per object.
    const theme = activeTheme();
    if (theme.world.tintStrength > 0) {
      ctx.globalAlpha = theme.world.tintStrength;
      ctx.fillStyle = theme.world.tint;
      ctx.globalCompositeOperation = theme.id === 'night' ? 'multiply' : 'soft-light';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    this.environment.drawWeather(ctx, ambience, this.viewW, this.viewH, dt);
  }

  private lastStructureKey = '';
  private structuresChanged(structures: Structure[]): boolean {
    const key = structures.map((s) => `${s.key}@${s.tx},${s.ty}`).join('|');
    if (key === this.lastStructureKey) return false;
    this.lastStructureKey = key;
    return true;
  }

  /** Packets per second, taken from what the yard actually does. */
  private flowIntensity(): number {
    const { stats, state } = this.game;
    let intensity = 0;
    if (state.active) intensity += Math.min(4, stats.teardownRate * 0.15 + 0.5);
    intensity += Math.min(3, stats.autoSellPerSec * 0.1);
    intensity += Math.min(3, Object.values(stats.processes).reduce((a, b) => a + b, 0));
    return intensity;
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  private drawGround(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }, ambience: Ambience): void {
    // Tile range covering the visible rectangle (iso rotates, so take corners).
    const corners = [
      worldToTile(view.x, view.y),
      worldToTile(view.x + view.w, view.y),
      worldToTile(view.x, view.y + view.h),
      worldToTile(view.x + view.w, view.y + view.h),
    ];
    const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
    const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
    const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
    const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;

    const bounds = this.map.tileBounds;
    const forestFrom = { x: bounds.x - 6, y: bounds.y - 6, x2: bounds.x + bounds.w + 6, y2: bounds.y + bounds.h + 6 };

    let trees = 0;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const zone = this.map.zoneAt(tx, ty);
        if (zone) {
          ctx.fillStyle = ZONE_COLOR[zone];
          tilePath(ctx, tx, ty);
          ctx.fill();
          // Subtle grid so the iso plane reads as ground.
          ctx.strokeStyle = 'rgba(0,0,0,0.10)';
          ctx.lineWidth = 1;
          ctx.stroke();
          continue;
        }

        // Surrounding forest (GDD: Wald), only near the owned land.
        if (tx < forestFrom.x || tx > forestFrom.x2 || ty < forestFrom.y || ty > forestFrom.y2) continue;
        ctx.fillStyle = hash(tx, ty) > 0.5 ? '#2f4432' : '#334a36';
        tilePath(ctx, tx, ty);
        ctx.fill();
        if (trees < 90 && hash(tx * 7, ty * 13) > 0.72) {
          trees++;
          drawModel(ctx, 'tree', tx, ty, 1, {
            stage: 1,
            time: this.time,
            darkness: ambience.darkness,
            active: false,
          });
        }
      }
    }

    this.drawFence(ctx);
    this.drawPad(ctx);
  }

  /** Fence around every owned plot edge that faces unowned land. */
  private drawFence(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#69707a';
    ctx.lineWidth = 2.5;
    for (const lot of this.map.lots) {
      const r = lot.rect;
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        this.fenceEdge(ctx, tx, r.y, 'n');
        this.fenceEdge(ctx, tx, r.y + r.h - 1, 's');
      }
      for (let ty = r.y; ty < r.y + r.h; ty++) {
        this.fenceEdge(ctx, r.x, ty, 'w');
        this.fenceEdge(ctx, r.x + r.w - 1, ty, 'e');
      }
    }
  }

  private fenceEdge(ctx: CanvasRenderingContext2D, tx: number, ty: number, side: 'n' | 's' | 'e' | 'w'): void {
    const neighbour =
      side === 'n' ? [tx, ty - 1] : side === 's' ? [tx, ty + 1] : side === 'e' ? [tx + 1, ty] : [tx - 1, ty];
    if (this.map.isOwned(neighbour[0], neighbour[1])) return;
    // The gate opening stays clear.
    if (Math.abs(tx - 21.5) < 1.2 && side === 'n' && ty < 10) return;

    const a =
      side === 'n' ? tileToWorld(tx, ty) : side === 's' ? tileToWorld(tx, ty + 1) : side === 'e' ? tileToWorld(tx + 1, ty) : tileToWorld(tx, ty);
    const b =
      side === 'n' ? tileToWorld(tx + 1, ty) : side === 's' ? tileToWorld(tx + 1, ty + 1) : side === 'e' ? tileToWorld(tx + 1, ty + 1) : tileToWorld(tx, ty + 1);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 12);
    ctx.lineTo(b.x, b.y - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, a.y - 12);
    ctx.stroke();
  }

  private drawPad(ctx: CanvasRenderingContext2D): void {
    const p = TEARDOWN_PAD;
    ctx.save();
    ctx.fillStyle = '#33363c';
    ctx.beginPath();
    const c = [
      tileToWorld(p.x, p.y),
      tileToWorld(p.x + p.w, p.y),
      tileToWorld(p.x + p.w, p.y + p.h),
      tileToWorld(p.x, p.y + p.h),
    ];
    ctx.moveTo(c[0].x, c[0].y);
    for (const pt of c.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = '#f0c04a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (!this.game.state.active) {
      const centre = tileToWorld(p.x + p.w / 2, p.y + p.h / 2);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('Zerlegeplatz frei', centre.x, centre.y);
      ctx.restore();
    }
  }

  private drawRoads(ctx: CanvasRenderingContext2D): void {
    for (const road of this.map.roads) {
      const pts = road.points.map((p) => tileToWorld(p.x, p.y));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = road.street ? '#33363b' : '#3d4147';
      ctx.lineWidth = road.street ? TILE_H * 1.5 : TILE_H * 1.05;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();

      if (road.street) {
        ctx.strokeStyle = 'rgba(240,200,90,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([16, 14]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Highlights valid targets while relocating. */
  private drawSlotHints(ctx: CanvasRenderingContext2D): void {
    if (!this.movingKey) return;
    const decor = this.movingKey.includes('#');
    const pool = decor ? this.map.decorSpots : this.buildings.freeSlots(this.game.state, this.map);
    const size = decor ? 1 : 3;
    ctx.save();
    ctx.fillStyle = 'rgba(111,208,140,0.22)';
    ctx.strokeStyle = 'rgba(111,208,140,0.8)';
    ctx.lineWidth = 2;
    for (const slot of pool) {
      const c = [
        tileToWorld(slot.tx, slot.ty),
        tileToWorld(slot.tx + size, slot.ty),
        tileToWorld(slot.tx + size, slot.ty + size),
        tileToWorld(slot.tx, slot.ty + size),
      ];
      ctx.beginPath();
      ctx.moveTo(c[0].x, c[0].y);
      for (const p of c.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Depth-sorted content
  // -------------------------------------------------------------------------

  private collectStructures(
    structures: Structure[],
    view: { x: number; y: number; w: number; h: number },
    ambience: Ambience,
    working: boolean,
  ): void {
    const ctx = this.ctx;

    for (const fixture of BASE_FIXTURES) {
      if (!this.inView(fixture.tx, fixture.ty, view)) continue;
      this.drawables.push({
        depth: depthOf(fixture.tx, fixture.ty),
        draw: () =>
          drawModel(ctx, fixture.model, fixture.tx, fixture.ty, 2, {
            stage: 1,
            time: this.time,
            darkness: ambience.darkness,
            active: working,
          }),
      });
    }

    // Landmarks give each bought plot its identity.
    for (const lot of this.map.lots) {
      if (!lot.landmark) continue;
      const tx = lot.rect.x + Math.floor(lot.rect.w / 2) - 1;
      const ty = lot.rect.y + 1;
      if (!this.inView(tx, ty, view)) continue;
      this.drawables.push({
        depth: depthOf(tx, ty) - 0.1,
        draw: () =>
          drawModel(ctx, lot.landmark!, tx, ty, 3, {
            stage: 1,
            time: this.time,
            darkness: ambience.darkness,
            active: working,
          }),
      });
    }

    for (const s of structures) {
      if (!this.inView(s.tx, s.ty, view)) continue;
      const moving = this.movingKey === s.key;
      this.drawables.push({
        depth: depthOf(s.tx, s.ty),
        draw: () => {
          drawModel(ctx, s.model, s.tx, s.ty, s.size, {
            stage: s.stage,
            time: this.time,
            darkness: ambience.darkness,
            active: working,
            ghost: moving,
          });
          if (s.count > 1 && !s.decor) {
            const c = tileToWorld(s.tx + s.size / 2, s.ty + s.size / 2);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(240,192,74,0.95)';
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 3;
            ctx.strokeText(`×${s.count}`, c.x, c.y + 12);
            ctx.fillText(`×${s.count}`, c.x, c.y + 12);
            ctx.restore();
          }
        },
      });
    }
  }

  /** The vehicle being dismantled, plus its tap hotspots. */
  private collectVehicleOnPad(): void {
    const active = this.game.state.active;
    if (!active) return;
    const def = Content.vehicle(active.defId);
    if (!def) return;
    const ctx = this.ctx;
    const pad = TEARDOWN_PAD;
    const removed = new Set(active.parts.filter((p) => p.done).map((p) => p.id));

    this.drawables.push({
      depth: depthOf(pad.x + pad.w / 2, pad.y + pad.h / 2) + 0.2,
      draw: () => {
        const bodyGone = removed.has('body') || removed.has('shell') || removed.has('frame');
        const tx = pad.x + 0.8;
        const ty = pad.y + 1.2;
        if (!bodyGone) {
          isoBox(ctx, tx, ty, 2.4, 1.6, LEVEL_H * 0.9, def.color);
          // Cabin
          isoBox(ctx, tx + 0.5, ty + 0.25, 1.2, 1.1, LEVEL_H * 1.4, shade(def.color, 0.18));
        } else {
          const c = [
            tileToWorld(tx, ty),
            tileToWorld(tx + 2.4, ty),
            tileToWorld(tx + 2.4, ty + 1.6),
            tileToWorld(tx, ty + 1.6),
          ];
          ctx.save();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c[0].x, c[0].y);
          for (const p of c.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        if (!removed.has('wheels') && !removed.has('tracks')) {
          ctx.fillStyle = '#22252a';
          for (const [wx, wy] of [
            [tx + 0.3, ty + 1.5],
            [tx + 2.1, ty + 1.5],
          ]) {
            const p = tileToWorld(wx, wy);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y - 6, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Progress ring hotspots.
        for (const partState of active.parts) {
          if (partState.done) continue;
          const partDef = def.parts.find((p) => p.id === partState.id);
          if (!partDef) continue;
          const pos = this.partWorldPos(partDef.id);
          if (!pos) continue;
          const ratio = Math.min(1, partState.work / partDef.work);
          const pulse = 1 + Math.sin(this.time * 4) * 0.06;
          const r = HOTSPOT_R * pulse * 0.75;

          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(18,20,24,0.82)';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.stroke();
          if (ratio > 0) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
            ctx.strokeStyle = '#f0c04a';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '17px system-ui, sans-serif';
          ctx.fillText(partDef.icon, pos.x, pos.y + 1);
          ctx.restore();
        }
      },
    });
  }

  /** Deliveries waiting in the parking area. */
  private collectQueue(): void {
    const queue = this.game.state.queue;
    if (queue.length === 0) return;
    const ctx = this.ctx;
    queue.slice(0, 9).forEach((id, i) => {
      const def = Content.vehicle(id);
      const tx = PARKING.x + (i % 3);
      const ty = PARKING.y + Math.floor(i / 3);
      this.drawables.push({
        depth: depthOf(tx, ty),
        draw: () => {
          isoBox(ctx, tx + 0.1, ty + 0.1, 0.8, 0.8, LEVEL_H * 0.5, def?.color ?? '#7a7a7a');
        },
      });
    });
  }

  private collectTraffic(view: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    for (const v of this.traffic.vehicles) {
      const pose = poseAlong(v.path, v.travelled);
      if (
        pose.pos.x < view.x - 60 ||
        pose.pos.x > view.x + view.w + 60 ||
        pose.pos.y < view.y - 60 ||
        pose.pos.y > view.y + view.h + 60
      ) {
        continue;
      }
      const tile = worldToTile(pose.pos.x, pose.pos.y);
      this.drawables.push({
        depth: depthOf(tile.x, tile.y) + 0.3,
        draw: () => drawRoadVehicle(ctx, v, pose.pos),
      });
    }
  }

  private collectPackets(view: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    for (const packet of this.logistics.packets) {
      const pos = LogisticsSystem.positionOf(packet);
      if (pos.x < view.x || pos.x > view.x + view.w || pos.y < view.y || pos.y > view.y + view.h) continue;
      const tile = worldToTile(pos.x, pos.y);
      this.drawables.push({
        depth: depthOf(tile.x, tile.y) + 0.4,
        draw: () => {
          ctx.fillStyle = packet.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(pos.x - 3.5, pos.y - 9, 7, 7);
          ctx.fill();
          ctx.stroke();
        },
      });
    }
  }

  private inView(tx: number, ty: number, view: { x: number; y: number; w: number; h: number }): boolean {
    const p = tileToWorld(tx, ty);
    return (
      p.x > view.x - TILE_W * 4 &&
      p.x < view.x + view.w + TILE_W * 4 &&
      p.y > view.y - LEVEL_H * 8 &&
      p.y < view.y + view.h + TILE_H * 4
    );
  }
}

function drawRoadVehicle(ctx: CanvasRenderingContext2D, v: RoadVehicle, pos: Point): void {
  const w = v.kind === 'forklift' ? 9 : v.kind === 'robot' ? 8 : v.kind === 'delivery' ? 20 : 14;
  const h = v.kind === 'forklift' ? 7 : v.kind === 'robot' ? 6 : 9;
  // A drone floats above the yard rather than driving through it.
  if (v.kind === 'robot') pos = { x: pos.x, y: pos.y - 16 };

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 2, w * 0.6, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = v.color;
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - h * 0.5, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(pos.x + w * 0.15, pos.y - h * 0.9, w * 0.22, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (v.cargo) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.cargo, pos.x - w * 0.1, pos.y - h * 0.9);
  }
  ctx.restore();
}

function skyColor(ambience: Ambience): string {
  if (ambience.phase === 'nacht') return '#10141d';
  if (ambience.phase === 'abend') return '#3a2a2c';
  if (ambience.phase === 'morgen') return '#2c2c33';
  return '#20242b';
}


/** Stable pseudo-random in [0,1) for scenery scatter. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export { STREET_Y };
