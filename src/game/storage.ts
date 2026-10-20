import type { Library } from './model';
import { decodeSave, encodeSave } from './saveCodec';
export { normalizeSession } from './saveCodec';
export type { SaveData } from './saveCodec';
export const SAVE_KEY = 'sudoku_save_v2';
export const LEGACY_KEY = 'sudoku_history';
export const RECOVERY_KEY = 'sudoku_save_recovery';
export const MAX_RECOVERY_COPIES = 5;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export interface LoadedSave {
  library: Library;
  warning: string | null;
  readOnly: boolean;
}
export type SaveFailure =
  { kind: 'conflict'; reason?: 'writer' } | { kind: 'error'; message: string };
export type SaveResult = { kind: 'saved' } | SaveFailure;
export type SaveAccess = { kind: 'writable' } | SaveFailure;
export type SaveLockPort = Pick<LockManager, 'request'>;
export interface SaveRepository {
  readonly key: string;
  load: () => LoadedSave;
  connect: (onAccess: (access: SaveAccess) => void) => () => void;
  save: (library: Library) => SaveResult;
}
const emptyLibrary = (): Library => ({ sessions: [], activeGameId: null });
const unavailable = (): LoadedSave => ({
  library: emptyLibrary(),
  warning:
    'Browser storage is unavailable. You can play, but progress may not survive a refresh.',
  readOnly: false,
});
const writeError =
  'Progress could not be saved. Browser storage may be full or unavailable.';
const protectedError = 'Saved data is protected and will not be overwritten.';
const coordinationError =
  'Safe saving is unavailable. Progress stays in this tab.';
function backup(storage: StoragePort, raw: string): boolean {
  try {
    let empty: string | null = null;
    for (let index = 0; index < MAX_RECOVERY_COPIES; index++) {
      const key = index === 0 ? RECOVERY_KEY : `${RECOVERY_KEY}_${index}`;
      const previous = storage.getItem(key);
      if (previous === raw) return true;
      if (previous === null && empty === null) empty = key;
    }
    // Keep existing recovery data intact. A full recovery area protects the current save.
    if (empty === null) return false;
    storage.setItem(empty, raw);
    return true;
  } catch {
    return false;
  }
}
function readStorage(storage: StoragePort): {
  loaded: LoadedSave;
  raw: string | null;
} {
  const current = storage.getItem(SAVE_KEY),
    raw = current ?? storage.getItem(LEGACY_KEY);
  if (raw === null)
    return {
      loaded: { library: emptyLibrary(), warning: null, readOnly: false },
      raw: current,
    };
  const decoded = decodeSave(raw, current === null);
  if (decoded.kind === 'unsupported')
    return {
      raw: current,
      loaded: {
        library: emptyLibrary(),
        warning: decoded.message,
        readOnly: true,
      },
    };
  if (decoded.kind !== 'valid') {
    const preserved = backup(storage, raw);
    return {
      raw: current,
      loaded: {
        library: emptyLibrary(),
        warning:
          current !== null && !preserved
            ? 'Saved data is protected. A recovery copy could not be saved; new edits stay in this tab.'
            : decoded.message,
        readOnly: current !== null && !preserved,
      },
    };
  }
  const preserved = !decoded.discarded || backup(storage, raw);
  return {
    raw: current,
    loaded: {
      library: decoded.library,
      warning:
        current !== null && !preserved
          ? 'Saved data is protected. A recovery copy could not be saved; new edits stay in this tab.'
          : decoded.discarded
            ? 'Some saved games were invalid. Valid games were restored and the original data was kept.'
            : null,
      readOnly: current !== null && !preserved,
    },
  };
}
export function loadLibrary(storage?: StoragePort): LoadedSave {
  try {
    return readStorage(storage ?? window.localStorage).loaded;
  } catch {
    return unavailable();
  }
}
/** Hold an exclusive writer lock so preflight and synchronous writes cannot race with other tabs. */
export function createSaveRepository(
  storage?: StoragePort,
  locks?: SaveLockPort | null,
): SaveRepository {
  let baseline: string | null | undefined;
  let readOnly = false;
  let lease: { active: boolean; granted: boolean; close: () => void } | null =
    null;
  let released: Promise<unknown> = Promise.resolve();
  return {
    key: SAVE_KEY,
    load: () => {
      try {
        const result = readStorage(storage ?? window.localStorage);
        baseline = result.raw;
        readOnly = result.loaded.readOnly;
        return result.loaded;
      } catch {
        return unavailable();
      }
    },
    connect: (onAccess) => {
      lease?.close();
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const current = {
        active: true,
        granted: false,
        close: () => {
          current.active = false;
          current.granted = false;
          if (lease === current) lease = null;
          release();
        },
      };
      lease = current;
      // Wait for an earlier native release before reconnecting (including StrictMode replay).
      released = released.then(async () => {
        if (!current.active) return;
        try {
          if (readOnly) {
            onAccess({ kind: 'error', message: protectedError });
            return;
          }
          const manager = locks === undefined ? navigator.locks : locks;
          if (!manager) throw new Error('Web Locks unavailable');
          await manager.request(
            `${SAVE_KEY}:writer`,
            { mode: 'exclusive', ifAvailable: true },
            async (lock) => {
              // ifAvailable requests cannot be aborted; late grants release without enabling writes.
              if (!current.active) return;
              if (!lock) {
                onAccess({ kind: 'conflict', reason: 'writer' });
                return;
              }
              current.granted = true;
              try {
                onAccess({ kind: 'writable' });
                await held;
              } finally {
                current.granted = false;
              }
            },
          );
        } catch {
          current.granted = false;
          if (current.active)
            onAccess({ kind: 'error', message: coordinationError });
        }
      });
      return current.close;
    },
    save: (library) => {
      if (readOnly)
        return {
          kind: 'error',
          message: protectedError,
        };
      if (!lease?.active || !lease.granted)
        return { kind: 'error', message: coordinationError };
      try {
        const target = storage ?? window.localStorage,
          current = target.getItem(SAVE_KEY);
        if (current !== (baseline ?? null)) return { kind: 'conflict' };
        const serialized = encodeSave(library);
        if (serialized !== baseline) target.setItem(SAVE_KEY, serialized);
        baseline = serialized;
        return { kind: 'saved' };
      } catch {
        return { kind: 'error', message: writeError };
      }
    },
  };
}
export function saveLibrary(
  library: Library,
  storage?: StoragePort,
): string | null {
  try {
    (storage ?? window.localStorage).setItem(SAVE_KEY, encodeSave(library));
    return null;
  } catch {
    return writeError;
  }
}
export const readDarkMode = (): boolean => {
  try {
    return localStorage.getItem('sudoku_darkmode') === 'true';
  } catch {
    return false;
  }
};
