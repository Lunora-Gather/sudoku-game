import { fromCells } from './board';
import { Board, ReadonlyBoard, SIDE, isDigit } from './types';
import { Topology } from './topology';
export interface SearchOptions {
  timeoutMs?: number;
  maxNodes?: number;
  signal?: AbortSignal;
  random?: () => number;
  now?: () => number;
}
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
  }
}
export class SearchLimitError extends GenerationError {
  constructor(readonly scope: 'total' | 'attempt') {
    super('Puzzle generation reached its search limit. Please try again.');
    this.name = 'SearchLimitError';
  }
}
export interface SearchContext {
  visit: () => void;
  random: () => number;
}
export function createSearchContext(
  options: SearchOptions = {},
): SearchContext {
  const timeout = options.timeoutMs ?? 5000,
    maxNodes = options.maxNodes ?? 1_000_000;
  if (
    !Number.isFinite(timeout) ||
    timeout < 0 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 0
  )
    throw new GenerationError(
      'Search limits must be finite non-negative numbers.',
    );
  const now = options.now ?? (() => performance.now()),
    deadline = now() + timeout;
  let remaining = maxNodes;
  return {
    random: options.random ?? Math.random,
    visit: () => {
      if (options.signal?.aborted) {
        const error = new Error('Generation cancelled');
        error.name = 'AbortError';
        throw error;
      }
      if (--remaining < 0 || now() >= deadline)
        throw new SearchLimitError('total');
    },
  };
}
/** A failed clue attempt spends its own allowance while still charging the overall budget. */
export function limitSearch(
  context: SearchContext,
  maxNodes: number,
): SearchContext {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 0)
    throw new GenerationError(
      'Search limits must be finite non-negative numbers.',
    );
  let remaining = maxNodes;
  return {
    random: context.random,
    visit: () => {
      // Cancellation and the total deadline take precedence over the local limit.
      context.visit();
      if (--remaining < 0) throw new SearchLimitError('attempt');
    },
  };
}
export function shuffle<T>(values: T[], random: () => number): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
      throw new GenerationError(
        'Random source must return a number in [0, 1).',
      );
    const j = Math.floor(sample * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
export interface SearchResult {
  count: number;
  solution: Board | null;
}
/** Search owns all mutable buffers. Caller boards and cached topology are never modified. */
export function search(
  board: ReadonlyBoard,
  topology: Topology,
  context: SearchContext,
  limit: 1 | 2,
  randomize = false,
): SearchResult {
  const values = board.flat(),
    cells = new Uint8Array(values.length),
    masks = new Uint16Array(topology.houses.length);
  for (let i = 0; i < values.length; i++) {
    const n = values[i];
    if (n === null) continue;
    if (!isDigit(n)) return { count: 0, solution: null };
    const bit = 1 << (n - 1);
    for (const house of topology.cellHouses[i]) {
      if (masks[house] & bit) return { count: 0, solution: null };
      masks[house] |= bit;
    }
    cells[i] = n;
  }
  let count = 0,
    solution: Board | null = null;
  const run = (): boolean => {
    context.visit();
    let best = -1,
      bestMask = 0,
      minimum = SIDE + 1;
    for (let i = 0; i < cells.length; i++)
      if (cells[i] === 0) {
        let occupied = 0;
        for (const house of topology.cellHouses[i]) occupied |= masks[house];
        const mask = 0x1ff & ~occupied;
        let options = 0;
        for (let bits = mask; bits; bits &= bits - 1) options++;
        if (!options) return false;
        if (options < minimum) {
          best = i;
          bestMask = mask;
          minimum = options;
          if (options === 1) break;
        }
      }
    if (best < 0) {
      count++;
      if (limit === 1) solution = fromCells(cells);
      return count >= limit;
    }
    const candidates: number[] = [];
    for (let mask = bestMask; mask; mask &= mask - 1)
      candidates.push(mask & -mask);
    if (randomize) shuffle(candidates, context.random);
    for (const bit of candidates) {
      cells[best] = 32 - Math.clz32(bit);
      for (const house of topology.cellHouses[best]) masks[house] |= bit;
      try {
        if (run()) return true;
      } finally {
        cells[best] = 0;
        for (const house of topology.cellHouses[best]) masks[house] &= ~bit;
      }
    }
    return false;
  };
  run();
  return { count, solution };
}
