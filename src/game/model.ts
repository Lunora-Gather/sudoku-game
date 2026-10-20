import type {
  Board,
  Difficulty,
  GameType,
  Position,
  RegionMap,
} from '../sudoku/types';
import { cloneBoard } from '../sudoku/board';
import { isDigit, isPosition } from '../sudoku/types';
import { isSolved } from '../sudoku/rules';
export type Notes = number[][][];
export const emptyNotes = (): Notes =>
  Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
export interface GameSession {
  id: string;
  board: Board;
  initialBoard: Board;
  notes: Notes;
  difficulty: Difficulty;
  type: GameType;
  regionMap: RegionMap;
  elapsedMs: number;
  lastPlayed: number;
  createdAt: number;
  gameStatus: 'playing' | 'won';
}
export interface Library {
  sessions: GameSession[];
  activeGameId: string | null;
}
export interface CellUndo {
  cell: Position;
  value: number | null;
  notes: number[];
}
export interface GameState extends Library {
  undo: CellUndo[];
}
export const MAX_SESSIONS = 100;
export const MAX_UNDO = 200;
export const activeSession = (state: Library) =>
  state.sessions.find((game) => game.id === state.activeGameId) ?? null;
export const newSession = (
  id: string,
  puzzle: Board,
  regionMap: RegionMap,
  difficulty: Difficulty,
  type: GameType,
  at: number,
): GameSession => ({
  id,
  board: cloneBoard(puzzle),
  initialBoard: cloneBoard(puzzle),
  notes: emptyNotes(),
  difficulty,
  type,
  regionMap: regionMap.map((row) => [...row]),
  elapsedMs: 0,
  createdAt: at,
  lastPlayed: at,
  gameStatus: isSolved(puzzle, regionMap, type === 'Diagonal 9x9')
    ? 'won'
    : 'playing',
});
export type Action =
  | { type: 'create'; game: GameSession }
  | { type: 'load'; id: string; at: number }
  | { type: 'delete'; id: string }
  | { type: 'deleteOthers' }
  | {
      type: 'input';
      cell: Position;
      value: number | null;
      noteMode: boolean;
      at: number;
    }
  | { type: 'undo'; at: number }
  | { type: 'tick'; id: string; elapsedMs: number };
function replaceSession(
  state: GameState,
  game: GameSession,
  undo = state.undo,
): GameState {
  return {
    ...state,
    undo,
    sessions: state.sessions.map((existing) =>
      existing.id === game.id ? game : existing,
    ),
  };
}
/** Copy only the row and cell that change, preserving all other references. */
function editCell(
  game: GameSession,
  cell: Position,
  value: number | null,
  candidates: number[],
  at: number,
): GameSession {
  const [r, c] = cell;
  let board = game.board;
  if (board[r][c] !== value) {
    board = [...board];
    board[r] = [...board[r]];
    board[r][c] = value;
  }
  const notes = [...game.notes];
  notes[r] = [...notes[r]];
  notes[r][c] = candidates;
  return {
    ...game,
    board,
    notes,
    lastPlayed: at,
    gameStatus: isSolved(board, game.regionMap, game.type === 'Diagonal 9x9')
      ? 'won'
      : 'playing',
  };
}
export function gameReducer(state: GameState, action: Action): GameState {
  const active = activeSession(state);
  switch (action.type) {
    case 'create':
      return state.sessions.length >= MAX_SESSIONS ||
        state.sessions.some((g) => g.id === action.game.id)
        ? state
        : {
            sessions: [action.game, ...state.sessions],
            activeGameId: action.game.id,
            undo: [],
          };
    case 'load': {
      const game = state.sessions.find((g) => g.id === action.id);
      if (!game || !Number.isFinite(action.at)) return state;
      return {
        ...replaceSession(state, { ...game, lastPlayed: action.at }, []),
        activeGameId: game.id,
      };
    }
    case 'delete': {
      if (!state.sessions.some((g) => g.id === action.id)) return state;
      const sessions = state.sessions.filter((g) => g.id !== action.id);
      return {
        ...state,
        sessions,
        activeGameId:
          state.activeGameId === action.id
            ? ([...sessions].sort((a, b) => b.lastPlayed - a.lastPlayed)[0]
                ?.id ?? null)
            : state.activeGameId,
        undo: state.activeGameId === action.id ? [] : state.undo,
      };
    }
    case 'deleteOthers':
      return !active || state.sessions.length <= 1
        ? state
        : { ...state, sessions: [active] };
    case 'tick': {
      const game = state.sessions.find((g) => g.id === action.id);
      return !game ||
        !Number.isFinite(action.elapsedMs) ||
        action.elapsedMs <= game.elapsedMs
        ? state
        : replaceSession(state, { ...game, elapsedMs: action.elapsedMs });
    }
    case 'undo': {
      const previous = state.undo.at(-1);
      if (
        !active ||
        active.gameStatus === 'won' ||
        !previous ||
        !Number.isFinite(action.at)
      )
        return state;
      return replaceSession(
        state,
        editCell(
          active,
          previous.cell,
          previous.value,
          previous.notes,
          action.at,
        ),
        state.undo.slice(0, -1),
      );
    }
    case 'input': {
      if (
        !active ||
        active.gameStatus === 'won' ||
        !isPosition(action.cell) ||
        !Number.isFinite(action.at)
      )
        return state;
      const [r, c] = action.cell,
        value = action.value;
      if (
        active.initialBoard[r][c] !== null ||
        (value !== null && !isDigit(value))
      )
        return state;
      let nextValue = value,
        notes: number[] = [];
      if (action.noteMode && value !== null) {
        if (active.board[r][c] !== null) return state;
        nextValue = null;
        notes = active.notes[r][c].includes(value)
          ? active.notes[r][c].filter((n) => n !== value)
          : [...active.notes[r][c], value].sort();
      } else if (
        active.board[r][c] === value &&
        active.notes[r][c].length === 0
      )
        return state;
      const previous: CellUndo = {
        cell: [...action.cell],
        value: active.board[r][c],
        notes: active.notes[r][c],
      };
      return replaceSession(
        state,
        editCell(active, action.cell, nextValue, notes, action.at),
        [...state.undo.slice(-(MAX_UNDO - 1)), previous],
      );
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
export interface ClockCheckpoint {
  id: string | null;
  elapsedMs: number;
}
export function withCheckpoint(
  library: Library,
  clock: ClockCheckpoint,
): Library {
  if (!clock.id || !Number.isFinite(clock.elapsedMs)) return library;
  const game = library.sessions.find((g) => g.id === clock.id);
  if (!game || clock.elapsedMs <= game.elapsedMs) return library;
  return {
    ...library,
    sessions: library.sessions.map((g) =>
      g === game ? { ...g, elapsedMs: clock.elapsedMs } : g,
    ),
  };
}
export const formatTime = (elapsedMs: number): string => {
  const total = Math.floor(elapsedMs / 1000);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
};
