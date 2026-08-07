/**
 * Object pool (GDD chapter 9: "Objekt-Pooling für häufig erzeugte Objekte").
 *
 * Particles and floating numbers are created and thrown away dozens of times a
 * second in the late game. Each one is a fresh object literal, and a few
 * thousand short-lived allocations per second is exactly the pattern that
 * produces visible GC stutter on a mid-range phone.
 *
 * The pool keeps dead objects around and refills their fields instead. Callers
 * never see it: they ask for an item, and hand it back when it dies.
 */
export class Pool<T> {
  private free: T[] = [];
  private created = 0;

  /**
   * @param factory builds a fresh item when the pool is empty
   * @param reset wipes an item before it goes back into circulation
   * @param cap largest number of idle items to keep; beyond this they are
   *   dropped so a one-off burst does not hold memory forever
   */
  constructor(
    private factory: () => T,
    private reset: (item: T) => void,
    private cap = 256,
  ) {}

  take(): T {
    const item = this.free.pop();
    if (item) return item;
    this.created++;
    return this.factory();
  }

  give(item: T): void {
    if (this.free.length >= this.cap) return;
    this.reset(item);
    this.free.push(item);
  }

  /** Returns a whole batch at once - the usual case after an update pass. */
  giveAll(items: Iterable<T>): void {
    for (const item of items) this.give(item);
  }

  /** Live counters, for the debug panel. */
  stats(): { idle: number; created: number } {
    return { idle: this.free.length, created: this.created };
  }
}
