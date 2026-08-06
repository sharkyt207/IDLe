/** Random helpers, kept in one place so runs can be made deterministic later. */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
