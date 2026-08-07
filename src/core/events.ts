import { log } from './log';

/** Payloads emitted by the simulation for the UI/renderer to react to. */
export interface GameEvents {
  /** State changed enough that panels should re-render. */
  changed: void;
  /** A part came off; carries screen-space hints for the renderer. */
  partRemoved: { vehicleId: string; partId: string; cash: number; x: number; y: number };
  /** A whole vehicle is done. */
  vehicleDone: { vehicleId: string; xp: number };
  /** Materials sold (manually or automatically). */
  sold: { amount: number; auto: boolean };
  /** Something worth a toast happened. */
  notice: { text: string; icon?: string; tone?: 'info' | 'good' | 'warn' };
  /** Company level increased. */
  levelUp: { level: number };
  /** Tutorial should re-evaluate its current step. */
  progress: void;
  /** A delivery was ordered - the map sends a truck for it. */
  delivery: { vehicleId: string };
  /** A plot was bought; the map grows and the camera visits it. */
  lotBought: { lotId: string };
  /** Something was built or upgraded - dust cloud, then the new model. */
  built: { defId: string };
  /** A collectible turned up while dismantling. */
  found: { collectibleId: string };
  /** A business day closed (GDD chapter 9: Event Manager). */
  dayEnded: { profit: number };
  /** A random event fired. Listeners look the definition up by id. */
  randomEvent: { id: string };
  /** The save was written - the UI can confirm it. */
  saved: { manual: boolean };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/** Minimal typed event bus - no dependencies, no allocation per emit. */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(key: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  /**
   * Notifies every listener.
   *
   * A throwing listener is logged and skipped rather than allowed to abort the
   * emit: the bus is what keeps the systems apart, so one broken UI panel must
   * not stop the simulation from telling the others what happened.
   */
  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Handler<K>)(payload);
      } catch (error) {
        log.error('events', `Listener für "${String(key)}" ist gescheitert`, error);
      }
    }
  }
}
