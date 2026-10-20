import { CELL_COUNT, ReadonlyRegionMap, RegionMap, SIDE } from './types';
export const ORTHOGONAL_NEIGHBORS: readonly (readonly number[])[] =
  Object.freeze(
    Array.from({ length: CELL_COUNT }, (_, i) =>
      Object.freeze(
        [
          i >= SIDE ? i - SIDE : -1,
          i < CELL_COUNT - SIDE ? i + SIDE : -1,
          i % SIDE > 0 ? i - 1 : -1,
          i % SIDE < SIDE - 1 ? i + 1 : -1,
        ].filter((n) => n >= 0),
      ),
    ),
  );
export interface Topology {
  readonly signature: string;
  readonly diagonal: boolean;
  readonly regions: readonly number[];
  readonly houses: readonly (readonly number[])[];
  readonly cellHouses: readonly (readonly number[])[];
  readonly peers: readonly (readonly number[])[];
}
const cache = new Map<string, Topology>();
const CACHE_LIMIT = 64;
export function regionConnected(
  regions: ArrayLike<number>,
  id: number,
): boolean {
  let start = -1;
  for (let i = 0; i < CELL_COUNT; i++)
    if (regions[i] === id) {
      start = i;
      break;
    }
  if (start < 0) return false;
  const seen = new Set<number>([start]),
    queue = [start];
  while (queue.length)
    for (const next of ORTHOGONAL_NEIGHBORS[queue.pop()!]) {
      if (regions[next] === id && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  return seen.size === SIDE;
}
export function compileTopology(
  map: ReadonlyRegionMap,
  diagonal = false,
): Topology {
  if (
    !Array.isArray(map) ||
    map.length !== SIDE ||
    !map.every(
      (row) =>
        Array.isArray(row) &&
        row.length === SIDE &&
        row.every((n) => Number.isInteger(n) && n >= 0 && n < SIDE),
    )
  )
    throw new RangeError('Invalid Sudoku region map.');
  const regions = map.flat(),
    signature = `${diagonal ? 'x' : 's'}:${regions.join('')}`;
  const cached = cache.get(signature);
  if (cached) {
    cache.delete(signature);
    cache.set(signature, cached);
    return cached;
  }
  const regionHouses: number[][] = Array.from({ length: SIDE }, () => []);
  regions.forEach((reg, i) => regionHouses[reg].push(i));
  if (
    regionHouses.some(
      (cells, id) => cells.length !== SIDE || !regionConnected(regions, id),
    )
  )
    throw new RangeError('Regions must contain nine connected cells each.');
  const houses: number[][] = [];
  for (let i = 0; i < SIDE; i++)
    houses.push(
      Array.from({ length: SIDE }, (_, c) => i * SIDE + c),
      Array.from({ length: SIDE }, (_, r) => r * SIDE + i),
      regionHouses[i],
    );
  if (diagonal)
    houses.push(
      Array.from({ length: SIDE }, (_, i) => i * 10),
      Array.from({ length: SIDE }, (_, i) => 8 + i * 8),
    );
  const cellHouses: number[][] = Array.from({ length: CELL_COUNT }, () => []);
  houses.forEach((house, h) =>
    house.forEach((cell) => cellHouses[cell].push(h)),
  );
  const peers = cellHouses.map((ids, cell) =>
    Object.freeze(
      [...new Set(ids.flatMap((id) => houses[id]))]
        .filter((i) => i !== cell)
        .sort((a, b) => a - b),
    ),
  );
  const topology: Topology = Object.freeze({
    signature,
    diagonal,
    regions: Object.freeze(regions),
    houses: Object.freeze(houses.map((house) => Object.freeze(house))),
    cellHouses: Object.freeze(cellHouses.map((ids) => Object.freeze(ids))),
    peers: Object.freeze(peers),
  });
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(signature, topology);
  return topology;
}
export const isRegionMap = (value: unknown): value is RegionMap => {
  try {
    compileTopology(value as RegionMap);
    return true;
  } catch {
    return false;
  }
};
