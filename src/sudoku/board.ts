import { Board, ReadonlyBoard, RegionMap, SIDE, isDigit } from './types';
export const createEmptyBoard = (): Board =>
  Array.from({ length: SIDE }, () => Array(SIDE).fill(null));
export const EMPTY_BOARD = createEmptyBoard();
export const CLASSIC_REGION_MAP: RegionMap = Array.from(
  { length: SIDE },
  (_, r) =>
    Array.from(
      { length: SIDE },
      (_, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3),
    ),
);
export const cloneBoard = (board: ReadonlyBoard): Board =>
  board.map((row) => [...row]);
export function isBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== SIDE) return false;
  for (let r = 0; r < SIDE; r++) {
    if (!Object.hasOwn(value, r)) return false;
    const row = value[r];
    if (!Array.isArray(row) || row.length !== SIDE) return false;
    for (let c = 0; c < SIDE; c++)
      if (!Object.hasOwn(row, c) || (row[c] !== null && !isDigit(row[c])))
        return false;
  }
  return true;
}
export const fromCells = (cells: ArrayLike<number>): Board =>
  Array.from({ length: SIDE }, (_, r) =>
    Array.from({ length: SIDE }, (_, c) => cells[r * SIDE + c] || null),
  );
