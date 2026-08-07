import type { Point } from './iso';
import type { RoadSegment } from './map';

/**
 * Road network (GDD chapter 6: Logistiksystem).
 *
 * The roads the map system draws are also the roads vehicles drive on. This
 * module turns those polylines into a routing graph: shared vertices become
 * junctions, a plot road that meets the main road mid-way splits it into a
 * proper T, and Dijkstra finds the shortest way between any two points.
 *
 * Every edge carries a `load` counter. Routing costs length × congestion, so a
 * jammed stretch is expensive and the next vehicle picks the alternate route on
 * its own — no special-case code, just a weight.
 *
 * Coordinates are tile space throughout; callers project to world pixels.
 */

export interface RoadNode {
  x: number;
  y: number;
}

export interface RoadEdge {
  a: number;
  b: number;
  length: number;
  /** Vehicles currently routed over this edge. */
  load: number;
}

export interface Route {
  /** Waypoints in tile space, including the off-road legs at both ends. */
  tiles: Point[];
  /** Graph edges the route uses - reserve/release these while driving. */
  edges: number[];
  length: number;
  /** True when congestion pushed the route off the shortest path. */
  detour: boolean;
}

/** Vertices closer than this are the same junction. */
const SNAP = 0.6;
/** How much one waiting vehicle inflates the cost of an edge. */
const CONGESTION = 0.85;
/** Longest off-road leg we accept before giving up on a destination. */
const MAX_APPROACH = 14;

export class RoadNetwork {
  nodes: RoadNode[] = [];
  edges: RoadEdge[] = [];
  /** node index -> edge indices touching it. */
  private adj: number[][] = [];
  private key = '';

  /** Rebuilds the graph when the road layout changed. Cheap and idempotent. */
  build(segments: RoadSegment[]): void {
    const key = segments.map((s) => s.points.map((p) => `${p.x},${p.y}`).join('|')).join(';');
    if (key === this.key) return;
    this.key = key;

    this.nodes = [];
    this.edges = [];

    for (const segment of segments) {
      for (let i = 1; i < segment.points.length; i++) {
        const a = this.nodeAt(segment.points[i - 1]);
        const b = this.nodeAt(segment.points[i]);
        if (a !== b) this.addEdge(a, b);
      }
    }

    this.splitJunctions();
    this.buildAdjacency();
  }

  /** Nearest junction to a point, or -1 when there are no roads at all. */
  nearestNode(x: number, y: number): number {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = (this.nodes[i].x - x) ** 2 + (this.nodes[i].y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Nearest point on the road network to an arbitrary spot, splitting an edge
   * if the closest approach is mid-segment. This is what lets a forklift leave
   * a building and join the road at the obvious place rather than at the next
   * junction.
   */
  entryNode(x: number, y: number): number {
    let bestEdge = -1;
    let bestT = 0;
    let bestDist = Infinity;

    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i];
      const a = this.nodes[edge.a];
      const b = this.nodes[edge.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lenSq));
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestEdge = i;
        bestT = t;
      }
    }

    if (bestEdge < 0) return this.nearestNode(x, y);

    const edge = this.edges[bestEdge];
    const a = this.nodes[edge.a];
    const b = this.nodes[edge.b];
    const px = a.x + (b.x - a.x) * bestT;
    const py = a.y + (b.y - a.y) * bestT;

    const existing = this.findNode(px, py);
    if (existing >= 0) return existing;

    const node = this.pushNode({ x: px, y: py });
    this.splitEdge(bestEdge, node);
    this.buildAdjacency();
    return node;
  }

  /**
   * Shortest congestion-aware route between two arbitrary points.
   *
   * The GDD asks for three things at once: prefer the shortest route, avoid
   * jams, and never strand a vehicle. Dijkstra on `length × (1 + load)` gives
   * the first two; a straight-line fallback gives the third.
   */
  route(from: Point, to: Point): Route {
    const direct: Route = { tiles: [from, to], edges: [], length: dist(from, to), detour: false };
    if (this.edges.length === 0) return direct;

    const start = this.entryNode(from.x, from.y);
    const goal = this.entryNode(to.x, to.y);
    if (start < 0 || goal < 0) return direct;

    const approach = dist(from, this.nodes[start]) + dist(to, this.nodes[goal]);
    // Short hops inside a hall are not worth a trip to the road and back.
    if (approach > MAX_APPROACH || direct.length < approach) return direct;

    if (start === goal) return direct;

    const path = this.dijkstra(start, goal);
    if (!path) return direct;

    const tiles: Point[] = [from];
    for (const node of path.nodes) tiles.push({ x: this.nodes[node].x, y: this.nodes[node].y });
    tiles.push(to);

    const shortest = this.dijkstra(start, goal, true);
    return {
      tiles,
      edges: path.edges,
      length: pathLengthOf(tiles),
      detour: !!shortest && path.rawLength > shortest.rawLength + 0.01,
    };
  }

  /** Marks a route as occupied so later routes route around it. */
  reserve(edges: number[]): void {
    for (const i of edges) if (this.edges[i]) this.edges[i].load++;
  }

  release(edges: number[]): void {
    for (const i of edges) if (this.edges[i]) this.edges[i].load = Math.max(0, this.edges[i].load - 1);
  }

  /** Total traffic pressure, for the UI and for tests. */
  congestion(): number {
    if (this.edges.length === 0) return 0;
    return this.edges.reduce((sum, e) => sum + e.load, 0) / this.edges.length;
  }

  // ---------------------------------------------------------------------------
  // Graph construction
  // ---------------------------------------------------------------------------

  private findNode(x: number, y: number): number {
    for (let i = 0; i < this.nodes.length; i++) {
      if (Math.abs(this.nodes[i].x - x) <= SNAP && Math.abs(this.nodes[i].y - y) <= SNAP) return i;
    }
    return -1;
  }

  private nodeAt(p: { x: number; y: number }): number {
    const hit = this.findNode(p.x, p.y);
    return hit >= 0 ? hit : this.pushNode({ x: p.x, y: p.y });
  }

  private pushNode(node: RoadNode): number {
    this.nodes.push(node);
    return this.nodes.length - 1;
  }

  private addEdge(a: number, b: number): void {
    if (a === b) return;
    if (this.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    this.edges.push({ a, b, length: dist(this.nodes[a], this.nodes[b]), load: 0 });
  }

  private splitEdge(index: number, node: number): void {
    const edge = this.edges[index];
    const { a, b } = edge;
    this.edges.splice(index, 1);
    this.addEdge(a, node);
    this.addEdge(node, b);
  }

  /**
   * Plot roads branch off the middle of the main road, so their first vertex
   * lies on an edge rather than on a junction. Without this pass every side
   * road would be a dead end that no route can reach.
   */
  private splitJunctions(): void {
    // Each pass splits one edge, and every plot road contributes at least one
    // junction, so the budget scales with the map rather than being a guess.
    const budget = this.nodes.length * 4 + 8;
    for (let guard = 0; guard < budget; guard++) {
      let split = false;
      outer: for (let n = 0; n < this.nodes.length; n++) {
        const node = this.nodes[n];
        for (let i = 0; i < this.edges.length; i++) {
          const edge = this.edges[i];
          if (edge.a === n || edge.b === n) continue;
          const a = this.nodes[edge.a];
          const b = this.nodes[edge.b];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq <= 1e-9) continue;
          const t = ((node.x - a.x) * dx + (node.y - a.y) * dy) / lenSq;
          if (t <= 0.02 || t >= 0.98) continue;
          const px = a.x + dx * t;
          const py = a.y + dy * t;
          if (Math.hypot(px - node.x, py - node.y) > SNAP) continue;
          this.splitEdge(i, n);
          split = true;
          break outer;
        }
      }
      if (!split) return;
    }
  }

  private buildAdjacency(): void {
    this.adj = this.nodes.map(() => []);
    for (let i = 0; i < this.edges.length; i++) {
      this.adj[this.edges[i].a].push(i);
      this.adj[this.edges[i].b].push(i);
    }
  }

  /**
   * @param ignoreLoad measure the plain shortest path, to tell a detour apart
   *   from a route that was short to begin with
   */
  private dijkstra(
    start: number,
    goal: number,
    ignoreLoad = false,
  ): { nodes: number[]; edges: number[]; rawLength: number } | null {
    const count = this.nodes.length;
    const cost = new Array<number>(count).fill(Infinity);
    const prev = new Array<number>(count).fill(-1);
    const prevEdge = new Array<number>(count).fill(-1);
    const visited = new Array<boolean>(count).fill(false);
    cost[start] = 0;

    // The yard has a few dozen junctions; a linear scan beats a heap here.
    for (;;) {
      let current = -1;
      let best = Infinity;
      for (let i = 0; i < count; i++) {
        if (!visited[i] && cost[i] < best) {
          best = cost[i];
          current = i;
        }
      }
      if (current < 0) return null;
      if (current === goal) break;
      visited[current] = true;

      for (const edgeIndex of this.adj[current] ?? []) {
        const edge = this.edges[edgeIndex];
        const next = edge.a === current ? edge.b : edge.a;
        if (visited[next]) continue;
        const weight = ignoreLoad ? edge.length : edge.length * (1 + edge.load * CONGESTION);
        const candidate = cost[current] + weight;
        if (candidate < cost[next]) {
          cost[next] = candidate;
          prev[next] = current;
          prevEdge[next] = edgeIndex;
        }
      }
    }

    const nodes: number[] = [];
    const edges: number[] = [];
    let rawLength = 0;
    for (let at = goal; at >= 0; at = prev[at]) {
      nodes.unshift(at);
      if (prevEdge[at] >= 0) {
        edges.unshift(prevEdge[at]);
        rawLength += this.edges[prevEdge[at]].length;
      }
      if (at === start) break;
    }
    return { nodes, edges, rawLength };
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLengthOf(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}
