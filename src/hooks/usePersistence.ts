import { useCallback, useEffect, useRef, useState } from 'react';
import type { Library } from '../game/model';
import type { SaveFailure, SaveRepository } from '../game/storage';
import { useCommittedRef } from './useCommittedRef';
type PersistenceStatus = { kind: 'ready' } | SaveFailure;
/** Browser lifecycle adapter. The snapshot supplier owns clock/session coordination. */
export function usePersistence(
  library: Library,
  readOnly: boolean,
  repository: SaveRepository,
  readSnapshot: () => Library,
) {
  const read = useCommittedRef(readSnapshot),
    pending = useRef<number | null>(null),
    blocked = useRef(readOnly),
    writable = useRef(false),
    disconnect = useRef(() => {}),
    mounted = useRef(false);
  const [status, setStatus] = useState<PersistenceStatus>({ kind: 'ready' });
  const flush = useCallback(
    (report = true) => {
      if (pending.current !== null) {
        clearTimeout(pending.current);
        pending.current = null;
      }
      if (blocked.current || !writable.current) return;
      const result = repository.save(read.current());
      if (result.kind === 'conflict') {
        blocked.current = true;
        writable.current = false;
        disconnect.current();
      }
      if (report && mounted.current)
        setStatus(result.kind === 'saved' ? { kind: 'ready' } : result);
    },
    [repository, read],
  );
  useEffect(() => {
    if (!blocked.current && pending.current === null)
      pending.current = window.setTimeout(() => flush(), 2000);
  }, [library, flush]);
  useEffect(() => {
    mounted.current = true;
    const connect = () => {
      if (blocked.current) return;
      disconnect.current();
      writable.current = false;
      disconnect.current = repository.connect((access) => {
        if (!mounted.current) return;
        writable.current = access.kind === 'writable';
        if (access.kind === 'writable') {
          // Include any edits made while the asynchronous lock request was pending.
          flush();
        } else {
          blocked.current = true;
          disconnect.current();
          setStatus(access);
        }
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== repository.key && event.key !== null) return;
      blocked.current = true;
      writable.current = false;
      disconnect.current();
      setStatus({ kind: 'conflict' });
      if (pending.current !== null) {
        clearTimeout(pending.current);
        pending.current = null;
      }
    };
    const onPageHide = () => {
        // Keep the synchronous unload save inside the held lock.
        flush();
        writable.current = false;
        disconnect.current();
      },
      onPageShow = (event: PageTransitionEvent) => {
        if (event.persisted) connect();
      },
      onVisibility = () => {
        if (document.visibilityState === 'hidden') flush();
      };
    connect();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(false);
      writable.current = false;
      disconnect.current();
    };
  }, [flush, repository]);
  return status;
}
