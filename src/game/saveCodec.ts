import {
  CLASSIC_REGION_MAP,
  DIFFICULTIES,
  Difficulty,
  GAME_TYPES,
  GameType,
  checkErrors,
  isBoard,
  isRegionMap,
  isSolved,
} from '../sudoku';
import { type GameSession, type Library, emptyNotes } from './model';
export interface SaveData extends Library {
  version: 2;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bounded = (value: unknown, maximum: number): number | null =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= maximum
    ? value
    : null;
// Date's supported range is slightly smaller than the largest exact integer in milliseconds.
const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;
export const normalizeSession = (value: unknown): GameSession | null => {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !isBoard(value.board) ||
    !isBoard(value.initialBoard) ||
    !DIFFICULTIES.includes(value.difficulty as Difficulty) ||
    (value.type !== undefined && !GAME_TYPES.includes(value.type as GameType))
  )
    return null;
  const type: GameType = GAME_TYPES.includes(value.type as GameType)
    ? (value.type as GameType)
    : value.isDiagonal === true
      ? 'Diagonal 9x9'
      : 'Standard 9x9';
  const regionMap =
    type === 'Irregular 9x9' ? value.regionMap : CLASSIC_REGION_MAP;
  if (
    !isRegionMap(regionMap) ||
    checkErrors(value.initialBoard, regionMap, type === 'Diagonal 9x9').length
  )
    return null;
  const board = value.board,
    initialBoard = value.initialBoard;
  if (
    initialBoard.some((row, r) =>
      row.some((n, c) => n !== null && board[r][c] !== n),
    )
  )
    return null;
  const notes = emptyNotes();
  if (Array.isArray(value.notes))
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        const cell = value.notes[r]?.[c];
        if (board[r][c] === null && Array.isArray(cell))
          notes[r][c] = [
            ...new Set(
              cell.filter(
                (n): n is number => Number.isInteger(n) && n >= 1 && n <= 9,
              ),
            ),
          ].sort();
      }
  const lastPlayed = bounded(value.lastPlayed, MAX_TIMESTAMP_MS) ?? 0;
  const legacyMs = typeof value.timer === 'number' ? value.timer * 1000 : null;
  return {
    id: value.id,
    board,
    initialBoard,
    notes,
    difficulty: value.difficulty as GameSession['difficulty'],
    type,
    regionMap,
    elapsedMs:
      bounded(value.elapsedMs, Number.MAX_SAFE_INTEGER) ??
      bounded(legacyMs, Number.MAX_SAFE_INTEGER) ??
      0,
    createdAt: bounded(value.createdAt, MAX_TIMESTAMP_MS) ?? lastPlayed,
    lastPlayed,
    gameStatus: isSolved(board, regionMap, type === 'Diagonal 9x9')
      ? 'won'
      : 'playing',
  };
};

export type DecodedSave =
  | { kind: 'valid'; library: Library; discarded: boolean }
  | { kind: 'invalid'; message: string }
  | { kind: 'unsupported'; message: string };
export function decodeSave(raw: string, legacy = false): DecodedSave {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      kind: 'invalid',
      message:
        'Saved data could not be read. The original data has been kept for recovery.',
    };
  }
  if (!legacy && record(parsed) && parsed.version !== 2)
    return {
      kind: 'unsupported',
      message:
        'This save format is not supported. Your saved data will not be overwritten.',
    };
  const entries =
    legacy && Array.isArray(parsed)
      ? parsed
      : record(parsed) &&
          (legacy || parsed.version === 2) &&
          Array.isArray(parsed.sessions)
        ? parsed.sessions
        : null;
  if (!entries)
    return {
      kind: 'invalid',
      message:
        'Saved data has an invalid format. The original data has been kept for recovery.',
    };
  const ids = new Set<string>(),
    sessions: GameSession[] = [];
  for (const entry of entries) {
    const session = normalizeSession(entry);
    if (session && !ids.has(session.id)) {
      ids.add(session.id);
      sessions.push(session);
    }
  }
  const preferred =
    record(parsed) && typeof parsed.activeGameId === 'string'
      ? parsed.activeGameId
      : null;
  const activeGameId = sessions.some((g) => g.id === preferred)
    ? preferred
    : ([...sessions].sort((a, b) => b.lastPlayed - a.lastPlayed)[0]?.id ??
      null);
  return {
    kind: 'valid',
    library: { sessions, activeGameId },
    discarded: sessions.length !== entries.length,
  };
}
export function encodeSave(library: Library): string {
  return JSON.stringify({
    version: 2,
    sessions: library.sessions,
    activeGameId: library.activeGameId,
  } satisfies SaveData);
}
