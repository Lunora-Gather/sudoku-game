import { CLASSIC_REGION_MAP, isBoard } from '../sudoku/board';
import { isRegionMap } from '../sudoku/topology';
import { isSolved } from '../sudoku/rules';
import {
  DIFFICULTIES,
  GAME_TYPES,
  type Difficulty,
  type GameType,
} from '../sudoku/types';
import type { GeneratedGame } from '../sudoku/generator';
export const GENERATION_PROTOCOL = 1;
export const GENERATION_TIMEOUT_MS = 8000;
export interface GenerationRequest {
  version: 1;
  id: number;
  difficulty: Difficulty;
  type: GameType;
}
export type GenerationResponse =
  | { version: 1; id: number; kind: 'success'; data: GeneratedGame }
  | { version: 1; id: number; kind: 'error'; error: string };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
export function isGenerationRequest(
  value: unknown,
): value is GenerationRequest {
  return (
    record(value) &&
    value.version === GENERATION_PROTOCOL &&
    Number.isSafeInteger(value.id) &&
    DIFFICULTIES.includes(value.difficulty as Difficulty) &&
    GAME_TYPES.includes(value.type as GameType)
  );
}
/** Validate message structure and board consistency, without running a solver on the UI thread. */
export function decodeGenerationResponse(
  value: unknown,
  request: GenerationRequest,
): GenerationResponse | null {
  if (
    !record(value) ||
    value.version !== GENERATION_PROTOCOL ||
    value.id !== request.id
  )
    return null;
  if (
    value.kind === 'error' &&
    typeof value.error === 'string' &&
    value.error.length > 0 &&
    value.error.length <= 1024
  )
    return value as unknown as GenerationResponse;
  if (value.kind !== 'success' || !record(value.data)) return null;
  const data = value.data;
  if (
    !isBoard(data.puzzle) ||
    !isBoard(data.solution) ||
    !isRegionMap(data.regionMap)
  )
    return null;
  if (
    request.type !== 'Irregular 9x9' &&
    data.regionMap.some((row, r) =>
      row.some((reg, c) => reg !== CLASSIC_REGION_MAP[r][c]),
    )
  )
    return null;
  if (!isSolved(data.solution, data.regionMap, request.type === 'Diagonal 9x9'))
    return null;
  const solution = data.solution;
  if (
    !data.puzzle.every((row, r) =>
      row.every((n, c) => n === null || n === solution[r][c]),
    )
  )
    return null;
  return value as unknown as GenerationResponse;
}
