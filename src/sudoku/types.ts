export type Board = (number | null)[][];
export type ReadonlyBoard = readonly (readonly (number | null)[])[];
export type Position = [number, number];
export type RegionMap = number[][];
export type ReadonlyRegionMap = readonly (readonly number[])[];
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameType = 'Standard 9x9' | 'Irregular 9x9' | 'Diagonal 9x9';
export const SIDE = 9;
export const CELL_COUNT = SIDE * SIDE;
export const GAME_TYPES: readonly GameType[] = [
  'Standard 9x9',
  'Irregular 9x9',
  'Diagonal 9x9',
];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const isDigit = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= SIDE;
export const isPosition = ([r, c]: Position): boolean =>
  Number.isInteger(r) &&
  Number.isInteger(c) &&
  r >= 0 &&
  r < SIDE &&
  c >= 0 &&
  c < SIDE;
