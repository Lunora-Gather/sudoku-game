import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../test/fixtures';
import { testLocks } from '../test/locks';
import {
  createSaveRepository,
  SAVE_KEY,
  type SaveAccess,
  type SaveLockPort,
  type SaveRepository,
} from './storage';
import { encodeSave } from './saveCodec';

const cleanups: (() => void)[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanups.splice(0).forEach((close) => close());
});
const library = (id = 'A') => ({ sessions: [fixture(id)], activeGameId: id });
function connect(repository: SaveRepository) {
  return new Promise<SaveAccess>((resolve) => {
    cleanups.push(repository.connect(resolve));
  });
}

describe('exclusive save ownership', () => {
  it('allows only one writer, including an interleaved attempt between preflight and write', async () => {
    const locks = testLocks(),
      data = new Map([[SAVE_KEY, encodeSave(library())]]);
    let duringWrite: (() => void) | undefined;
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        duringWrite?.();
        data.set(key, value);
      },
    };
    const first = createSaveRepository(storage, locks),
      second = createSaveRepository(storage, locks);
    first.load();
    second.load();
    expect(await connect(first)).toEqual({ kind: 'writable' });
    expect(await connect(second)).toEqual({
      kind: 'conflict',
      reason: 'writer',
    });
    let secondResult;
    duringWrite = () => {
      secondResult = second.save(library('B'));
    };
    expect(first.save(library('C'))).toEqual({ kind: 'saved' });
    expect(secondResult).toMatchObject({ kind: 'error' });
    expect(JSON.parse(data.get(SAVE_KEY)!).activeGameId).toBe('C');
  });

  it('rejects writes before acquisition and after release', async () => {
    const repository = createSaveRepository();
    repository.load();
    expect(repository.save(library()).kind).toBe('error');
    expect(await connect(repository)).toEqual({ kind: 'writable' });
    expect(repository.save(library()).kind).toBe('saved');
    cleanups.at(-1)!();
    expect(repository.save(library('B')).kind).toBe('error');
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).activeGameId).toBe('A');
  });

  it('hands ownership to a freshly loaded tab but refuses an older snapshot', async () => {
    const first = createSaveRepository(),
      second = createSaveRepository();
    first.load();
    second.load();
    await connect(first);
    first.save(library('B'));
    cleanups.at(-1)!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await connect(second)).toEqual({ kind: 'writable' });
    expect(second.save(library())).toEqual({ kind: 'conflict' });
    second.load();
    expect(second.save(library('C'))).toEqual({ kind: 'saved' });
  });

  it('releases an abandoned late grant and reconnects without a StrictMode false conflict', async () => {
    const repository = createSaveRepository();
    repository.load();
    const stale = vi.fn(),
      close = repository.connect(stale);
    await Promise.resolve();
    close();
    expect(await connect(repository)).toEqual({ kind: 'writable' });
    expect(stale).not.toHaveBeenCalled();
  });

  it.each(['missing', 'rejected'] as const)(
    'fails closed when lock access is %s',
    async (kind) => {
      const locks: SaveLockPort | null =
        kind === 'missing'
          ? null
          : {
              request: vi
                .fn()
                .mockRejectedValue(
                  new DOMException('Blocked', 'SecurityError'),
                ),
            };
      const repository = createSaveRepository(undefined, locks);
      repository.load();
      expect(await connect(repository)).toMatchObject({ kind: 'error' });
      expect(repository.save(library()).kind).toBe('error');
      expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    },
  );
});
