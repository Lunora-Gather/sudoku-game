import { isBoard } from './board';
import { compileTopology, Topology } from './topology';
import {
  Position,
  ReadonlyBoard,
  ReadonlyRegionMap,
  SIDE,
  isDigit,
} from './types';
export function errorsForTopology(
  board: ReadonlyBoard,
  topology: Topology,
): Position[] {
  const values = board.flat(),
    errors = new Set<number>();
  values.forEach((n, i) => {
    if (n !== null && !isDigit(n)) errors.add(i);
  });
  for (const house of topology.houses) {
    const first = new Int16Array(SIDE + 1).fill(-1);
    for (const cell of house) {
      const n = values[cell];
      if (!isDigit(n)) continue;
      if (first[n] >= 0) {
        errors.add(first[n]);
        errors.add(cell);
      } else first[n] = cell;
    }
  }
  return [...errors]
    .sort((a, b) => a - b)
    .map((i) => [Math.floor(i / SIDE), i % SIDE]);
}
export const checkErrors = (
  board: ReadonlyBoard,
  map: ReadonlyRegionMap,
  diagonal = false,
): Position[] => errorsForTopology(board, compileTopology(map, diagonal));
export function isSolved(
  board: ReadonlyBoard,
  map: ReadonlyRegionMap,
  diagonal = false,
): boolean {
  if (!isBoard(board) || board.some((row) => row.some((n) => n === null)))
    return false;
  try {
    return checkErrors(board, map, diagonal).length === 0;
  } catch {
    return false;
  }
}
