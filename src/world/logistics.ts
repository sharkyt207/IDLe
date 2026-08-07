import { TEARDOWN_PAD } from '../data/lots';
import type { FlowRole } from '../data/types';
import { tileToWorld, type Point } from './iso';
import type { Structure } from './buildings';
import { poseAlong, pathLength } from './traffic';

export interface FlowPacket {
  path: Point[];
  length: number;
  travelled: number;
  speed: number;
  color: string;
  done: boolean;
}

/** The visible chain from GDD chapter 3. */
const CHAIN: FlowRole[] = ['teardown', 'sort', 'store', 'melt', 'produce', 'ship'];

/**
 * Logistics system: the visible material flow.
 *
 * Packets ride conveyor lines between the structures the player actually
 * owns, so the belts show the real chain - a yard without a smelter has no
 * packets heading to one. Purely presentational: the economy is simulated in
 * `game/systems`, this only makes it legible.
 */
export class LogisticsSystem {
  packets: FlowPacket[] = [];
  /** Conveyor lines between consecutive stages, rebuilt when buildings move. */
  lines: { from: Point; to: Point; role: FlowRole }[] = [];

  private spawnCredit = 0;
  private static readonly MAX_PACKETS = 40;

  /** Recomputes the belt layout. Cheap, but only needed on structure change. */
  rebuild(structures: Structure[]): void {
    this.lines = [];
    const padCentre = tileToWorld(TEARDOWN_PAD.x + TEARDOWN_PAD.w / 2, TEARDOWN_PAD.y + TEARDOWN_PAD.h / 2);

    let previous: Point[] = [padCentre];
    for (const role of CHAIN) {
      const nodes = structures.filter((s) => s.flow === role);
      if (nodes.length === 0) continue;
      const points = nodes.map((s) => tileToWorld(s.tx + s.size / 2, s.ty + s.size / 2));
      for (const to of points) {
        // Connect each stage to its nearest predecessor - short, readable belts.
        const from = nearest(previous, to);
        this.lines.push({ from, to, role });
      }
      previous = points;
    }
  }

  /**
   * @param intensity packets per second, derived from real throughput
   * @param visible skip entirely when the yard is off-screen
   */
  update(dt: number, intensity: number, visible: boolean): void {
    if (!visible) {
      this.packets.length = 0;
      return;
    }

    for (const p of this.packets) {
      p.travelled += p.speed * dt;
      if (p.travelled >= p.length) p.done = true;
    }
    if (this.packets.some((p) => p.done)) this.packets = this.packets.filter((p) => !p.done);

    if (this.lines.length === 0 || intensity <= 0) return;
    this.spawnCredit += Math.min(intensity, 12) * dt;
    while (this.spawnCredit >= 1) {
      this.spawnCredit -= 1;
      if (this.packets.length >= LogisticsSystem.MAX_PACKETS) break;
      const line = this.lines[Math.floor(Math.random() * this.lines.length)];
      const path = [line.from, line.to];
      this.packets.push({
        path,
        length: pathLength(path),
        travelled: 0,
        speed: 70,
        color: ROLE_COLOR[line.role],
        done: false,
      });
    }
  }

  static positionOf(packet: FlowPacket): Point {
    return poseAlong(packet.path, packet.travelled).pos;
  }
}

const ROLE_COLOR: Record<FlowRole, string> = {
  teardown: '#c9d1dc',
  sort: '#8fd0a8',
  store: '#d9b464',
  melt: '#e0864a',
  produce: '#7fb5e6',
  ship: '#c795e0',
};

function nearest(candidates: Point[], to: Point): Point {
  let best = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = (c.x - to.x) ** 2 + (c.y - to.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
