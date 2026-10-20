import type { SaveLockPort } from '../game/storage';

/** A deterministic asynchronous exclusive-lock model for unit tests; browser tests use native locks. */
export function testLocks(): SaveLockPort {
  const held = new Set<string>();
  function request<T>(
    name: string,
    callback: LockGrantedCallback<T>,
  ): Promise<T>;
  function request<T>(
    name: string,
    options: LockOptions,
    callback: LockGrantedCallback<T>,
  ): Promise<T>;
  async function request<T>(
    name: string,
    optionsOrCallback: LockOptions | LockGrantedCallback<T>,
    callback?: LockGrantedCallback<T>,
  ): Promise<T> {
    const options =
      typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const granted =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback!;
    if (!options.ifAvailable || options.mode !== 'exclusive' || options.signal)
      throw new Error('Test locks expect a non-queued exclusive request.');
    // Reserve before yielding, as the browser lock manager does across contexts.
    if (held.has(name)) return granted(null) as T;
    held.add(name);
    try {
      await Promise.resolve();
      return (await granted({ name, mode: 'exclusive' })) as T;
    } finally {
      held.delete(name);
    }
  }
  return { request };
}
