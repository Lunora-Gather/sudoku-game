import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_KEY,
  MAX_RECOVERY_COPIES,
  RECOVERY_KEY,
  SAVE_KEY,
  loadLibrary,
  saveLibrary,
} from './storage';
import { fixture } from '../test/fixtures';
beforeEach(() => localStorage.clear());
describe('versioned storage and legacy recovery', () => {
  it('migrates legacy seconds and canonicalizes rules from the game type', () => {
    const game = { ...fixture(), timer: 42, isDiagonal: true } as Record<
      string,
      unknown
    >;
    delete game.elapsedMs;
    localStorage.setItem(LEGACY_KEY, JSON.stringify([game]));
    const loaded = loadLibrary();
    expect(loaded.library.sessions[0].elapsedMs).toBe(42000);
    expect(loaded.library.sessions[0].type).toBe('Standard 9x9');
    expect(loaded.warning).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
  it('restores the last active game and falls back to most recently played', () => {
    saveLibrary({ sessions: [fixture('A'), fixture('B')], activeGameId: 'B' });
    expect(loadLibrary().library.activeGameId).toBe('B');
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([fixture('B'), fixture('A')]),
    );
    expect(loadLibrary().library.activeGameId).toBe('A');
  });
  it.each(['not json', '{}', 'null'])(
    'backs up malformed legacy data: %s',
    (raw) => {
      localStorage.setItem(LEGACY_KEY, raw);
      const loaded = loadLibrary();
      expect(loaded.warning).not.toBeNull();
      expect(loaded.library.sessions).toEqual([]);
      expect(localStorage.getItem(RECOVERY_KEY)).toBe(raw);
    },
  );
  it('rejects invalid boards and changed givens while retaining good sessions', () => {
    const bad = fixture('bad');
    bad.board[0][0] = 9;
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        fixture(),
        bad,
        { ...fixture('shape'), notes: null, board: [[1]] },
      ]),
    );
    expect(loadLibrary().library.sessions.map((g) => g.id)).toEqual(['A']);
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull();
  });
  it('does not overwrite newer unsupported save formats', () => {
    const raw = JSON.stringify({ version: 99, sessions: [] });
    localStorage.setItem(SAVE_KEY, raw);
    expect(loadLibrary().readOnly).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
  });
  it('reports unavailable storage without crashing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked');
    });
    expect(loadLibrary().warning).toMatch(/unavailable/);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('quota');
    });
    expect(saveLibrary({ sessions: [], activeGameId: null })).toMatch(
      /could not be saved/,
    );
  });
});

it('sanitizes notes, rejects unknown game types and protects damaged saves when backups fail', () => {
  const game = fixture();
  const notes = game.notes as unknown[][][];
  notes[0][1] = [2, 2, 20, '3'];
  notes[0][0] = [4];
  localStorage.setItem(
    LEGACY_KEY,
    JSON.stringify([game, { ...fixture('unknown'), type: 'unknown' }]),
  );
  const loaded = loadLibrary();
  expect(loaded.library.sessions).toHaveLength(1);
  expect(loaded.library.sessions[0].notes[0][1]).toEqual([2]);
  expect(loaded.library.sessions[0].notes[0][0]).toEqual([]);
  localStorage.setItem(SAVE_KEY, 'broken');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  expect(loadLibrary().readOnly).toBe(true);
  expect(localStorage.getItem(SAVE_KEY)).toBe('broken');
});

it('detects external writes before storage events and skips identical saves', async () => {
  const { createSaveRepository } = await import('./storage');
  const library = { sessions: [fixture()], activeGameId: 'A' };
  saveLibrary(library);
  const repository = createSaveRepository(),
    loaded = repository.load();
  let disconnect = () => {};
  await new Promise<void>((resolve) => {
    disconnect = repository.connect((access) => {
      expect(access.kind).toBe('writable');
      resolve();
    });
  });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  repository.save(loaded.library);
  repository.save(loaded.library);
  expect(write).not.toHaveBeenCalled();
  localStorage.setItem(SAVE_KEY, 'external update');
  expect(repository.save(loaded.library)).toEqual({ kind: 'conflict' });
  expect(localStorage.getItem(SAVE_KEY)).toBe('external update');
  disconnect();
});

it('enforces read-only protection inside the repository independently of the UI', async () => {
  const { createSaveRepository } = await import('./storage');
  const raw = JSON.stringify({ version: 99, sessions: [] });
  localStorage.setItem(SAVE_KEY, raw);
  const repository = createSaveRepository();
  expect(repository.load().readOnly).toBe(true);
  expect(repository.save({ sessions: [], activeGameId: null }).kind).toBe(
    'error',
  );
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
});

it('leaves unsupported formats in place without creating recovery copies on repeated loads', () => {
  localStorage.setItem(RECOVERY_KEY, 'older recovery');
  const raw = JSON.stringify({ version: 99, sessions: [] });
  localStorage.setItem(SAVE_KEY, raw);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  for (let i = 0; i < 6; i++) expect(loadLibrary().readOnly).toBe(true);
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
});

it('deduplicates damaged saves across every recovery slot before adding another copy', () => {
  localStorage.setItem(RECOVERY_KEY, 'older recovery');
  localStorage.setItem(SAVE_KEY, 'damaged current data');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  for (let i = 0; i < 6; i++) expect(loadLibrary().readOnly).toBe(false);
  expect(write).toHaveBeenCalledExactlyOnceWith(
    `${RECOVERY_KEY}_1`,
    'damaged current data',
  );
  localStorage.removeItem(`${RECOVERY_KEY}_1`);
  localStorage.setItem(`${RECOVERY_KEY}_2`, 'damaged current data');
  write.mockClear();
  expect(loadLibrary().readOnly).toBe(false);
  expect(write).not.toHaveBeenCalled();
});

it('bounds new backups and protects current data without deleting any older recovery copy', () => {
  const oldKey = `${RECOVERY_KEY}_older-uuid`;
  localStorage.setItem(oldKey, 'retained old backup');
  for (let i = 0; i < MAX_RECOVERY_COPIES; i++) {
    localStorage.setItem(SAVE_KEY, `damaged version ${i}`);
    expect(loadLibrary().readOnly).toBe(false);
  }
  localStorage.setItem(SAVE_KEY, 'new damaged version');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(loadLibrary().readOnly).toBe(true);
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(SAVE_KEY)).toBe('new damaged version');
  expect(localStorage.getItem(oldKey)).toBe('retained old backup');
  expect(
    Object.keys(localStorage).filter((key) => key.startsWith(RECOVERY_KEY)),
  ).toHaveLength(MAX_RECOVERY_COPIES + 1);
});
