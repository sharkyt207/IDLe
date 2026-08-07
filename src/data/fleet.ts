/**
 * Logistics fleet (GDD chapter 6).
 *
 * The vehicles that move material around the yard. Everything is data: adding
 * a class is one entry here, the vehicle AI picks it up on the next dispatch.
 *
 * `job` decides which kind of task a class may take, `unlock` gates it behind
 * something the player actually owns, so the fleet grows with the company.
 */

export type FleetJob = 'intake' | 'internal' | 'outbound';

export interface FleetClassDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** World pixels per second. */
  speed: number;
  /** How many parallel copies may exist. */
  fleetSize: number;
  /** Bigger vehicles are worth dispatching only for bigger jobs. */
  capacity: number;
  jobs: FleetJob[];
  /** Purchasable that has to be owned before this class shows up. */
  unlock?: string;
  /** Seconds spent loading and unloading. */
  handling: number;
}

export const FLEET: FleetClassDef[] = [
  {
    id: 'pallet_truck',
    name: 'Hubwagen',
    icon: '🧰',
    color: '#9aa4b0',
    speed: 26,
    fleetSize: 2,
    capacity: 1,
    jobs: ['internal'],
    handling: 1.2,
  },
  {
    id: 'forklift',
    name: 'Gabelstapler',
    icon: '📦',
    color: '#d8a72c',
    speed: 34,
    fleetSize: 3,
    capacity: 2,
    jobs: ['internal'],
    unlock: 'forklift_driver',
    handling: 1,
  },
  {
    id: 'van',
    name: 'Kleintransporter',
    icon: '🚐',
    color: '#7fb5e6',
    speed: 62,
    fleetSize: 2,
    capacity: 3,
    jobs: ['intake', 'outbound'],
    handling: 1.5,
  },
  {
    id: 'truck',
    name: 'LKW',
    icon: '🚚',
    color: '#c4762c',
    speed: 48,
    fleetSize: 3,
    capacity: 6,
    jobs: ['intake', 'outbound'],
    unlock: 'truck_driver',
    handling: 2.5,
  },
  {
    id: 'heavy',
    name: 'Schwertransporter',
    icon: '🛻',
    color: '#b4553c',
    speed: 32,
    fleetSize: 2,
    capacity: 12,
    jobs: ['intake'],
    unlock: 'vehicle_hall',
    handling: 4,
  },
  {
    id: 'container',
    name: 'Containerfahrzeug',
    icon: '🗃️',
    color: '#5f8f7a',
    speed: 40,
    fleetSize: 2,
    capacity: 16,
    jobs: ['outbound'],
    unlock: 'container_terminal',
    handling: 3.5,
  },
];

/** Traffic tuning shared by the vehicle AI. */
export const TRAFFIC = {
  /** World-pixel gap a vehicle keeps to the one in front. */
  headway: 22,
  /** Cone in which another vehicle counts as "ahead", as a dot product. */
  aheadDot: 0.55,
  /** Slowest a vehicle creeps when boxed in - never a full deadlock. */
  crawlFactor: 0.18,
  /** Cars on the public street outside the fence. */
  streetTraffic: { max: 4, everySeconds: [4, 11] as [number, number], speed: 90 },
  /** Robots patrolling between machines (chapter 5). */
  robots: { max: 3, everySeconds: [3, 8] as [number, number], speed: 22 },
  /** Deliveries waiting to be shown as an arriving truck. */
  maxPendingDeliveries: 5,
};
