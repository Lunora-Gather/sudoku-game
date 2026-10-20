import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SessionClock } from './clock';
import { useGameClock } from '../hooks/useGameClock';
describe('pure monotonic clock', () => {
  it('keeps fractional time across pause/resume without depending on render ticks', () => {
    let now = 0;
    const clock = new SessionClock(() => now);
    clock.configure('A', 0, true);
    now = 900;
    expect(clock.configure('A', 0, false)).toEqual({ id: 'A', elapsedMs: 900 });
    now = 9000;
    clock.configure('A', 0, true);
    now = 9100;
    expect(clock.read()).toEqual({ id: 'A', elapsedMs: 1000 });
    expect(clock.configure('A', 0, true)).toBeNull();
    expect(clock.read().elapsedMs).toBe(1000);
  });
  it('returns the old checkpoint when switching sessions and never mixes session seeds', () => {
    let now = 0;
    const clock = new SessionClock(() => now);
    clock.configure('A', 5000, true);
    now = 100;
    expect(clock.configure('B', 200, true)).toEqual({
      id: 'A',
      elapsedMs: 5100,
    });
    expect(clock.read()).toEqual({ id: 'B', elapsedMs: 200 });
    now = 500;
    clock.configure('B', 200, false);
    now = 900;
    expect(clock.read()).toEqual({ id: 'B', elapsedMs: 600 });
  });
  it('cleans up React timers without dispatching during unmount', () => {
    const onTick = vi.fn();
    const view = renderHook(() => useGameClock('A', 0, true, onTick));
    view.unmount();
    expect(onTick).not.toHaveBeenCalled();
  });
});
