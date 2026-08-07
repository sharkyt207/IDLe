import { Content } from '../data';
import { MAIN_ROAD, STREET_Y, UNLOAD_POINT } from '../data/lots';
import type { Game } from '../game/game';
import { MAP_TILES, tileToWorld, type Point } from './iso';
import type { MapSystem } from './map';
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
}

const SPEEDS = { delivery: 46, street: 90, forklift: 30, robot: 22 };

/**
 * Vehicle system: trucks and forklifts actually drive along the roads
 * (GDD: "Keine Teleportation").
 *
 * Delivery trucks are spawned by real purchases, so the traffic on the yard is
 * a readout of the logistics the player bought. Counts are capped hard - a
 * fully automated yard would otherwise buy hundreds of vehicles per minute.
 */
export class TrafficSystem {
  vehicles: RoadVehicle[] = [];

  private streetTimer = 2;
  private forkliftTimer = 3;
  /** Deliveries waiting to be shown as a truck. */
  private pendingDeliveries = 0;

  private static readonly MAX_DELIVERY = 5;
  private static readonly MAX_STREET = 4;
  private static readonly MAX_FORKLIFT = 4;
  private static readonly MAX_ROBOT = 3;
  private robotTimer = 5;

  constructor(private game: Game) {
    game.bus.on('changed', () => undefined);
  }

  /** Called when the player (or automation) buys a delivery. */
  queueDelivery(): void {
    this.pendingDeliveries = Math.min(this.pendingDeliveries + 1, TrafficSystem.MAX_DELIVERY);
  }

  update(dt: number, map: MapSystem, structures: Structure[], visible: boolean): void {
    // Off-screen the world keeps simulating, but nothing new is spawned and
    // movement is skipped: animation is presentation, not game state.
    if (!visible) {
      this.pendingDeliveries = Math.min(this.pendingDeliveries, 1);
      return;
    }

    for (const v of this.vehicles) {
      if (v.wait > 0) {
        v.wait -= dt;
        continue;
      }
      v.travelled += v.speed * dt;
      if (v.travelled >= v.length) v.done = true;
    }
    this.vehicles = this.vehicles.filter((v) => !v.done);

    this.spawnDeliveries(map);
    this.spawnStreetTraffic(dt);
    this.spawnForklifts(dt, structures);
    this.spawnRobots(dt, structures);
  }

  private count(kind: TrafficKind): number {
    return this.vehicles.filter((v) => v.kind === kind).length;
  }

  private spawnDeliveries(map: MapSystem): void {
    if (this.pendingDeliveries <= 0) return;
    if (this.count('delivery') >= TrafficSystem.MAX_DELIVERY) return;
    this.pendingDeliveries--;

    const gate = MAIN_ROAD[0];
    const unload = UNLOAD_POINT;
    const path: Point[] = [
      tileToWorld(-2, STREET_Y),
      tileToWorld(gate.x, STREET_Y),
      tileToWorld(unload.x, unload.y),
      tileToWorld(gate.x, STREET_Y),
      tileToWorld(MAP_TILES + 2, STREET_Y),
    ];
    const def = Content.vehicle(this.game.state.autoBuyVehicle);
    this.push({
      kind: 'delivery',
      path,
      color: '#c4762c',
      cargo: def?.icon ?? '🚗',
      wait: 0,
      speed: SPEEDS.delivery,
    });
    void map;
  }

  private spawnStreetTraffic(dt: number): void {
    this.streetTimer -= dt;
    if (this.streetTimer > 0) return;
    this.streetTimer = 4 + Math.random() * 7;
    if (this.count('street') >= TrafficSystem.MAX_STREET) return;

    const leftToRight = Math.random() < 0.5;
    const path: Point[] = leftToRight
      ? [tileToWorld(-2, STREET_Y), tileToWorld(MAP_TILES + 2, STREET_Y)]
      : [tileToWorld(MAP_TILES + 2, STREET_Y), tileToWorld(-2, STREET_Y)];
    const colors = ['#7f8894', '#4f6b8a', '#8a5c4f', '#5f7a5f', '#9a9a6a'];
    this.push({
      kind: 'street',
      path,
      color: colors[Math.floor(Math.random() * colors.length)],
      wait: 0,
      speed: SPEEDS.street * (0.8 + Math.random() * 0.5),
    });
  }

  /** Forklifts shuttle between storage structures and the dismantling pad. */
  private spawnForklifts(dt: number, structures: Structure[]): void {
    this.forkliftTimer -= dt;
    if (this.forkliftTimer > 0) return;
    this.forkliftTimer = 2.5 + Math.random() * 4;
    if (this.count('forklift') >= TrafficSystem.MAX_FORKLIFT) return;

    const stores = structures.filter((s) => s.flow === 'store' || s.flow === 'sort');
    if (stores.length === 0) return;
    const from = stores[Math.floor(Math.random() * stores.length)];
    const to = stores[Math.floor(Math.random() * stores.length)];

    const a = tileToWorld(from.tx + 1, from.ty + 1);
    const b = tileToWorld(22, 14);
    const c = tileToWorld(to.tx + 1, to.ty + 1);
    this.push({
      kind: 'forklift',
      path: [a, b, c],
      color: '#d8a72c',
      cargo: '📦',
      wait: 0,
      speed: SPEEDS.forklift,
    });
  }

  /**
   * Robots patrol between the machines they belong to (GDD chapter 5:
   * "Diese Roboter bewegen sich sichtbar über die Fabrik").
   */
  private spawnRobots(dt: number, structures: Structure[]): void {
    this.robotTimer -= dt;
    if (this.robotTimer > 0) return;
    this.robotTimer = 3 + Math.random() * 5;
    if (this.count('robot') >= TrafficSystem.MAX_ROBOT) return;

    const owned = ['sort_robot', 'weld_robot', 'inspection_drone'].filter(
      (id) => (this.game.state.owned[id] ?? 0) > 0,
    );
    if (owned.length === 0) return;

    const stations = structures.filter((s) => s.flow === 'teardown' || s.flow === 'sort');
    if (stations.length < 2) return;
    const from = stations[Math.floor(Math.random() * stations.length)];
    const to = stations[Math.floor(Math.random() * stations.length)];
    const kind = owned[Math.floor(Math.random() * owned.length)];

    this.push({
      kind: 'robot',
      path: [tileToWorld(from.tx + 1, from.ty + 1), tileToWorld(to.tx + 1, to.ty + 1)],
      color: kind === 'inspection_drone' ? '#8fd8e6' : '#b0b8c4',
      cargo: kind === 'inspection_drone' ? '🛸' : '🤖',
      wait: 0,
      speed: SPEEDS.robot,
    });
  }

  private push(v: Omit<RoadVehicle, 'travelled' | 'length' | 'done'>): void {
    const length = pathLength(v.path);
    if (length <= 0) return;
    this.vehicles.push({ ...v, travelled: 0, length, done: false });
  }

  /** Position and facing of a vehicle right now. */
  static poseOf(v: RoadVehicle): { pos: Point; dir: Point } {
    return poseAlong(v.path, v.travelled);
  }
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
