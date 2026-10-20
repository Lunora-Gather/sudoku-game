import { describe, expect, it } from 'vitest';
import { GameState, MAX_UNDO, activeSession, gameReducer } from './model';
import { fixture, solution } from '../test/fixtures';
const state = (): GameState => ({
  sessions: [fixture()],
  activeGameId: 'A',
  undo: [],
});
describe('atomic game actions', () => {
  it('keeps givens immutable and skips no-op edits', () => {
    const s = state();
    expect(
      gameReducer(s, {
        type: 'input',
        at: 1000,
        cell: [0, 0],
        value: 9,
        noteMode: false,
      }),
    ).toBe(s);
    expect(
      gameReducer(s, {
        type: 'input',
        at: 1000,
        cell: [0, 1],
        value: null,
        noteMode: false,
      }),
    ).toBe(s);
    expect(
      gameReducer(s, {
        type: 'input',
        at: 1000,
        cell: [0, 1],
        value: 10,
        noteMode: false,
      }),
    ).toBe(s);
  });
  it('clears notes, restores them with undo, and never adds hidden notes to a filled cell', () => {
    let s = state();
    s = gameReducer(s, {
      type: 'input',
      at: 1000,
      cell: [0, 1],
      value: 2,
      noteMode: true,
    });
    s = gameReducer(s, {
      type: 'input',
      at: 1000,
      cell: [0, 1],
      value: null,
      noteMode: false,
    });
    expect(activeSession(s)?.notes[0][1]).toEqual([]);
    s = gameReducer(s, { type: 'undo', at: 2000 });
    expect(activeSession(s)?.notes[0][1]).toEqual([2]);
    s = gameReducer(s, {
      type: 'input',
      at: 1000,
      cell: [0, 1],
      value: 2,
      noteMode: false,
    });
    expect(
      gameReducer(s, {
        type: 'input',
        at: 1000,
        cell: [0, 1],
        value: 3,
        noteMode: true,
      }),
    ).toBe(s);
  });
  it('loads and deletes whole sessions, preserving their own rules', () => {
    let s: GameState = {
      sessions: [fixture('A', true), fixture('B')],
      activeGameId: 'A',
      undo: [],
    };
    s = gameReducer(s, { type: 'delete', id: 'A' });
    expect(activeSession(s)?.type).toBe('Standard 9x9');
    expect(s.undo).toEqual([]);
    s = gameReducer(s, { type: 'load', id: 'missing', at: 2000 });
    expect(s.activeGameId).toBe('B');
  });
  it('caps undo history and applies clock checkpoints to the correct session monotonically', () => {
    let s = state();
    for (let i = 0; i < 210; i++)
      s = gameReducer(s, {
        type: 'input',
        at: 1000,
        cell: [0, 1],
        value: (i % 2) + 2,
        noteMode: false,
      });
    expect(s.undo).toHaveLength(MAX_UNDO);
    s = gameReducer(s, { type: 'tick', id: 'A', elapsedMs: 1900 });
    expect(gameReducer(s, { type: 'tick', id: 'A', elapsedMs: 1000 })).toBe(s);
    expect(
      gameReducer(s, { type: 'tick', id: 'missing', elapsedMs: 9000 }),
    ).toBe(s);
  });
  it('recognizes a solved board and blocks further editing', () => {
    const game = fixture();
    game.board = solution.map((row) => [...row]);
    game.initialBoard = solution.map((row) => [...row]);
    game.board[0][1] = null;
    game.initialBoard[0][1] = null;
    let s: GameState = { sessions: [game], activeGameId: 'A', undo: [] };
    s = gameReducer(s, {
      type: 'input',
      at: 1000,
      cell: [0, 1],
      value: solution[0][1],
      noteMode: false,
    });
    expect(activeSession(s)?.gameStatus).toBe('won');
    expect(gameReducer(s, { type: 'undo', at: 2000 })).toBe(s);
  });
});

it('replays timestamped edits deterministically with cell-level undo and structural sharing', () => {
  const original = state(),
    game = activeSession(original)!;
  const action = {
    type: 'input',
    cell: [0, 1],
    value: 2,
    noteMode: false,
    at: 1234,
  } as const;
  const next = gameReducer(original, { ...action, cell: [0, 1] });
  expect(gameReducer(original, { ...action, cell: [0, 1] })).toEqual(next);
  const edited = activeSession(next)!;
  expect(game.board[0][1]).toBeNull();
  expect(edited.board[1]).toBe(game.board[1]);
  expect(edited.notes[1]).toBe(game.notes[1]);
  expect(edited.notes[0][2]).toBe(game.notes[0][2]);
  expect(edited.lastPlayed).toBe(1234);
  expect(Object.keys(next.undo[0]).sort()).toEqual(['cell', 'notes', 'value']);
  const restored = gameReducer(next, { type: 'undo', at: 1235 });
  expect(activeSession(restored)?.board).toEqual(game.board);
  expect(activeSession(restored)?.notes).toEqual(game.notes);
});
