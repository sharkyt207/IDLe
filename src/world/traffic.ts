import { Content } from '../data';
import { FLEET, TRAFFIC, type FleetClassDef, type FleetJob } from '../data/fleet';
import { MAIN_ROAD, STREET_Y, TEARDOWN_PAD, UNLOAD_POINT } from '../data/lots';
import type { Game } from '../game/game';
import { owned } from '../game/state';
import { MAP_TILES, tileToWorld, type Point } from './iso';
import type { MapSystem } from './map';
import { RoadNetwork } from './roads';
import type { Structure } from './buildings';

export type TrafficKind = 'delivery' | 'street' | 'forklift' | 'robot';

export interface RoadVehicle {
  kind: TrafficKind;
  /** World-pixel waypoints. */
  path: Point[];
  /** Distance travelled along the path. */
  travelled: number;
  length: number;
  speed: number;
  color: string;
  /** Cargo icon shown on the trailer, if any. */
  cargo?: string;
  /** Seconds to stand still at the unload point. */
  wait: number;
  done: boolean;
  /** Fleet class this vehicle belongs to; street traffic and robots have none. */
  fleet?: string;
  /** Graph edges reserved for this trip, released when it ends. */
  edges: number[];
  /** Current speed after collision avoidance - what the vehicle actually does. */
  actualSpeed: number;
  /** True while the router sent it around a jam. */
  detour: boolean;
}

/** One piece of work for the fleet. */
export interface FleetTask {
  job: FleetJob;
  /** Tile-space pickup and drop-off. */
  from: Point;
  to: Point;
  cargo: string;
  /** How big the job is - decides which class is worth sending. */
  weight: number;
}

/**
 * Vehicle AI (GDD chapters 3 and 6).
 *
 * Trucks and forklifts drive the real road network ("Keine Teleportation"),
 * routed by `RoadNetwork` so they take the shortest way and swing around a jam
 * on their own. Work arrives as tasks; the dispatcher hands each one to the
 * best idle vehicle rather than to a fixed owner, which is the "intelligente
 * Aufgabenverteilung" the GDD asks for.
 *
 * None of this touches the economy: the simulation decides what happens, this
 * makes it visible. Off-screen the whole thing idles.
 */
export class TrafficSystem {
  vehicles: RoadVehicle[] = [];
  readonly roads = new RoadNetwork();

  private tasks: FleetTask[] = [];
  private streetTimer = 2;
  private robotTimer = 5;
  private internalTimer = 3;
  /** Deliveries waiting to be shown as a truck. */
  private pendingDeliveries = 0;

  constructor(private game: Game) {}

  /** Called when the player (or automation) buys a delivery. */
  queueDelivery(): void {
    this.pendingDeliveries = Math.min(this.pendingDeliveries + 1, TRAFFIC.maxPendingDeliveries);
  }

  /** Queues a transport job. The dispatcher decides who drives it. */
  addTask(task: FleetTask): void {
    // A backlog nobody can work off is just memory; the yard drops the oldest.
    if (this.tasks.length > 24) this.tasks.shift();
    this.tasks.push(task);
  }

  /** Fleet classes the company currently operates. */
  fleetClasses(): FleetClassDef[] {
    return FLEET.filter((def) => !def.unlock || owned(this.game.state, def.unlock) > 0);
  }

  update(dt: number, map: MapSystem, structures: Structure[], visible: boolean): void {
    this.roads.build(map.roads);

    // Off-screen the world keeps simulating, but nothing new is spawned and
    // movement is skipped: animation is presentation, not game state.
    if (!visible) {
      this.pendingDeliveries = Math.min(this.pendingDeliveries, 1);
      this.tasks.length = 0;
      return;
    }

    this.drive(dt);
    this.spawnDeliveries();
    this.spawnStreetTraffic(dt);
    this.generateInternalWork(dt, structures);
    this.dispatch();
    this.spawnRobots(dt, structures);
  }

  // ---------------------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------------------

  /** Advances every vehicle, keeping a safe gap to the one in front. */
  private drive(dt: number): void {
    for (const v of this.vehicles) {
      if (v.wait > 0) {
        v.wait -= dt;
        v.actualSpeed = 0;
        continue;
      }
      v.actualSpeed = v.speed * this.clearanceFactor(v);
      v.travelled += v.actualSpeed * dt;
      if (v.travelled >= v.length) v.done = true;
    }

    const finished = this.vehicles.filter((v) => v.done);
    if (finished.length === 0) return;
    for (const v of finished) this.roads.release(v.edges);
    this.vehicles = this.vehicles.filter((v) => !v.done);
  }

  /**
   * Collision avoidance. A vehicle that has someone directly in front of it
   * slows down instead of driving through them, but never stops completely -
   * a deadlocked yard would read as a bug, not as traffic.
   */
  private clearanceFactor(v: RoadVehicle): number {
    const self = poseAlong(v.path, v.travelled);
    let closest = Infinity;

    for (const other of this.vehicles) {
      if (other === v || other.done) continue;
      // Drones fly, street traffic is outside the fence: neither shares a lane.
      if (other.kind === 'robot' || v.kind === 'robot') continue;
      if ((other.kind === 'street') !== (v.kind === 'street')) continue;

      const pose = poseAlong(other.path, other.travelled);
      const dx = pose.pos.x - self.pos.x;
      const dy = pose.pos.y - self.pos.y;
      const gap = Math.hypot(dx, dy);
      if (gap >= TRAFFIC.headway || gap <= 1e-3) continue;
      // Only what is actually in front matters - passing traffic does not.
      if ((dx * self.dir.x + dy * self.dir.y) / gap < TRAFFIC.aheadDot) continue;
      closest = Math.min(closest, gap);
    }

    if (closest === Infinity) return 1;
    const t = closest / TRAFFIC.headway;
    return TRAFFIC.crawlFactor + (1 - TRAFFIC.crawlFactor) * t;
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  private countOf(fleetId: string): number {
    return this.vehicles.reduce((sum, v) => sum + (v.fleet === fleetId ? 1 : 0), 0);
  }

  private count(kind: TrafficKind): number {
    return this.vehicles.filter((v) => v.kind === kind).length;
  }

  /**
   * Assigns queued work to the fleet.
   *
   * A task goes to the smallest class that can carry it and still has a vehicle
   * free - big trucks stay available for big jobs instead of shuttling single
   * pallets around.
   */
  private dispatch(): void {
    if (this.tasks.length === 0) return;
    const classes = this.fleetClasses();
    if (classes.length === 0) return;

    const left: FleetTask[] = [];
    for (const task of this.tasks) {
      const candidate = classes
        .filter((def) => def.jobs.includes(task.job) && this.countOf(def.id) < def.fleetSize)
        .sort((a, b) => {
          // Prefer a class that fits the load; among those, the smallest.
          const fitA = a.capacity >= task.weight ? 0 : 1;
          const fitB = b.capacity >= task.weight ? 0 : 1;
          return fitA - fitB || a.capacity - b.capacity;
        })[0];
      if (!candidate) {
        left.push(task);
        continue;
      }
      this.send(candidate, task);
    }
    this.tasks = left;
  }

  /** Routes one vehicle of a class along the road network and sets it off. */
  private send(def: FleetClassDef, task: FleetTask): void {
    const out = this.roads.route(task.from, task.to);
    const back = this.roads.route(task.to, task.from);
    const tiles = [...out.tiles, ...back.tiles.slice(1)];
    const edges = [...out.edges, ...back.edges];

    this.push({
      kind: def.jobs.includes('internal') ? 'forklift' : 'delivery',
      fleet: def.id,
      path: tiles.map((p) => tileToWorld(p.x, p.y)),
      edges,
      color: def.color,
      cargo: task.cargo,
      wait: 0,
      speed: def.speed,
      detour: out.detour || back.detour,
    });
  }

  /**
   * Turns real throughput into transport jobs. The busier the yard actually is,
   * the more traffic the player sees - the fleet is a readout, not decoration.
   */
  private generateInternalWork(dt: number, structures: Structure[]): void {
    this.internalTimer -= dt;
    if (this.internalTimer > 0) return;

    const rateOf = this.game.stats.teardownRate + this.game.stats.autoSellPerSec;
    if (rateOf <= 0) {
      this.internalTimer = 3;
      return;
    }
    // Faster yards dispatch more often, but never more than a few times a second.
    this.internalTimer = Math.max(0.6, 4 - Math.log10(1 + rateOf));

    const sources = structures.filter((s) => s.flow === 'teardown' || s.flow === 'sort');
    const sinks = structures.filter((s) => s.flow === 'store' || s.flow === 'melt' || s.flow === 'ship');
    if (sinks.length === 0) return;

    const pad = { x: TEARDOWN_PAD.x + TEARDOWN_PAD.w / 2, y: TEARDOWN_PAD.y + TEARDOWN_PAD.h / 2 };
    const from = sources.length > 0 ? centreOf(pick(sources)) : pad;
    const to = centreOf(pick(sinks));
    this.addTask({
      job: 'internal',
      from,
      to,
      cargo: '📦',
      weight: Math.min(12, 1 + Math.floor(Math.log10(1 + rateOf) * 3)),
    });

    // Outbound shipping only exists once something ships from the yard.
    const shipping = structures.filter((s) => s.flow === 'ship');
    if (shipping.length > 0 && this.game.stats.autoSellPerSec > 0) {
      this.addTask({
        job: 'outbound',
        from: centreOf(pick(shipping)),
        to: { x: MAIN_ROAD[0].x, y: STREET_Y },
        cargo: '💶',
        weight: Math.min(16, 2 + Math.floor(this.game.stats.autoSellPerSec)),
      });
    }
  }

  private spawnDeliveries(): void {
    if (this.pendingDeliveries <= 0) return;
    const classes = this.fleetClasses().filter((def) => def.jobs.includes('intake'));
    if (classes.length === 0) return;

    // A class-6 wreck needs a heavy hauler; a small car fits in a van.
    const def = Content.vehicle(this.game.state.autoBuyVehicle);
    const weight = def ? def.vehicleClass * 2 : 2;
    const carrier = classes
      .filter((c) => this.countOf(c.id) < c.fleetSize)
      .sort((a, b) => {
        const fitA = a.capacity >= weight ? 0 : 1;
        const fitB = b.capacity >= weight ? 0 : 1;
        return fitA - fitB || a.capacity - b.capacity;
      })[0];
    if (!carrier) return;
    this.pendingDeliveries--;

    // An arriving delivery comes in from off-map, unloads, and leaves again.
    const gate = MAIN_ROAD[0];
    const approach = this.roads.route({ x: gate.x, y: STREET_Y }, UNLOAD_POINT);
    const path: Point[] = [
      tileToWorld(-2, STREET_Y),
      ...approach.tiles.map((p) => tileToWorld(p.x, p.y)),
      ...[...approach.tiles].reverse().slice(1).map((p) => tileToWorld(p.x, p.y)),
      tileToWorld(MAP_TILES + 2, STREET_Y),
    ];

    this.push({
      kind: 'delivery',
      fleet: carrier.id,
      path,
      edges: approach.edges,
      color: carrier.color,
      cargo: def?.icon ?? carrier.icon,
      wait: 0,
      speed: carrier.speed,
      detour: approach.detour,
    });
  }

  private spawnStreetTraffic(dt: number): void {
    this.streetTimer -= dt;
    if (this.streetTimer > 0) return;
    const [min, max] = TRAFFIC.streetTraffic.everySeconds;
    this.streetTimer = min + Math.random() * (max - min);
    if (this.count('street') >= TRAFFIC.streetTraffic.max) return;

    const leftToRight = Math.random() < 0.5;
    const path: Point[] = leftToRight
      ? [tileToWorld(-2, STREET_Y), tileToWorld(MAP_TILES + 2, STREET_Y)]
      : [tileToWorld(MAP_TILES + 2, STREET_Y), tileToWorld(-2, STREET_Y)];
    const colors = ['#7f8894', '#4f6b8a', '#8a5c4f', '#5f7a5f', '#9a9a6a'];
    this.push({
      kind: 'street',
      path,
      edges: [],
      color: colors[Math.floor(Math.random() * colors.length)],
      wait: 0,
      speed: TRAFFIC.streetTraffic.speed * (0.8 + Math.random() * 0.5),
      detour: false,
    });
  }

  /**
   * Robots patrol between the machines they belong to (GDD chapter 5:
   * "Diese Roboter bewegen sich sichtbar über die Fabrik").
   */
  private spawnRobots(dt: number, structures: Structure[]): void {
    this.robotTimer -= dt;
    if (this.robotTimer > 0) return;
    const [min, max] = TRAFFIC.robots.everySeconds;
    this.robotTimer = min + Math.random() * (max - min);
    if (this.count('robot') >= TRAFFIC.robots.max) return;

    const kinds = ['sort_robot', 'weld_robot', 'inspection_drone'].filter(
      (id) => owned(this.game.state, id) > 0,
    );
    if (kinds.length === 0) return;

    const stations = structures.filter((s) => s.flow === 'teardown' || s.flow === 'sort');
    if (stations.length < 2) return;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const from = centreOf(pick(stations));
    const to = centreOf(pick(stations));

    this.push({
      kind: 'robot',
      path: [tileToWorld(from.x, from.y), tileToWorld(to.x, to.y)],
      edges: [],
      color: kind === 'inspection_drone' ? '#8fd8e6' : '#b0b8c4',
      cargo: kind === 'inspection_drone' ? '🛸' : '🤖',
      wait: 0,
      speed: TRAFFIC.robots.speed,
      detour: false,
    });
  }

  private push(v: Omit<RoadVehicle, 'travelled' | 'length' | 'done' | 'actualSpeed'>): void {
    const length = pathLength(v.path);
    if (length <= 0) return;
    this.roads.reserve(v.edges);
    this.vehicles.push({ ...v, travelled: 0, length, done: false, actualSpeed: v.speed });
  }

  /** Position and facing of a vehicle right now. */
  static poseOf(v: RoadVehicle): { pos: Point; dir: Point } {
    return poseAlong(v.path, v.travelled);
  }
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function centreOf(s: Structure): Point {
  return { x: s.tx + s.size / 2, y: s.ty + s.size / 2 };
}

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Point and direction at a distance along a polyline. */
export function poseAlong(points: Point[], distance: number): { pos: Point; dir: Point } {
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg <= 0) continue;
    if (left <= seg) {
      const t = left / seg;
      return {
        pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        dir: { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg },
      };
    }
    left -= seg;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2] ?? last;
  const seg = Math.max(1e-6, Math.hypot(last.x - prev.x, last.y - prev.y));
  return { pos: last, dir: { x: (last.x - prev.x) / seg, y: (last.y - prev.y) / seg } };
}
