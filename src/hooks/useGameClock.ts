import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { SessionClock } from '../game/clock';
export function useGameClock(
  id: string | null,
  elapsedMs: number,
  running: boolean,
  onTick: (id: string, ms: number) => void,
) {
  const [clock] = useState(() => new SessionClock(() => performance.now()));
  useLayoutEffect(() => {
    const checkpoint = clock.configure(id, elapsedMs, running);
    if (checkpoint?.id) onTick(checkpoint.id, checkpoint.elapsedMs);
  }, [clock, id, elapsedMs, running, onTick]);
  useEffect(() => {
    if (!id || !running) return;
    const interval = window.setInterval(() => {
      const current = clock.read();
      if (current.id) onTick(current.id, current.elapsedMs);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [clock, id, running, onTick]);
  return useCallback(() => clock.read(), [clock]);
}
