import { expect, it, vi } from 'vitest';
import { decodeSave, encodeSave, normalizeSession } from './saveCodec';
import { fixture } from '../test/fixtures';
it('decodes deterministically without wall-clock or browser storage access', () => {
  const legacy = { ...fixture() } as Record<string, unknown>;
  delete legacy.createdAt;
  delete legacy.lastPlayed;
  const raw = JSON.stringify([legacy]);
  vi.spyOn(Date, 'now').mockImplementation(() => {
    throw Error('Unexpected clock access');
  });
  const result = decodeSave(raw, true);
  expect(decodeSave(raw, true)).toEqual(result);
  expect(result.kind).toBe('valid');
  if (result.kind === 'valid') {
    expect(result.library.sessions[0].lastPlayed).toBe(0);
    expect(decodeSave(encodeSave(result.library)).kind).toBe('valid');
  }
});

it.each([NaN, Infinity, -1, 1e308, Number.MAX_SAFE_INTEGER + 1])(
  'normalizes invalid elapsed milliseconds %s to a finite round-trippable value',
  (elapsedMs) => {
    const game = normalizeSession({ ...fixture(), elapsedMs, timer: 1e308 })!;
    expect(game.elapsedMs).toBe(0);
    const decoded = decodeSave(
      encodeSave({ sessions: [game], activeGameId: game.id }),
    );
    expect(decoded.kind).toBe('valid');
    if (decoded.kind === 'valid')
      expect(decoded.library.sessions[0].elapsedMs).toBe(0);
  },
);

it('checks legacy seconds after conversion and preserves valid fractional precision', () => {
  expect(
    normalizeSession({ ...fixture(), elapsedMs: undefined, timer: 1e308 })
      ?.elapsedMs,
  ).toBe(0);
  expect(
    normalizeSession({ ...fixture(), elapsedMs: undefined, timer: 42.5 })
      ?.elapsedMs,
  ).toBe(42500);
  expect(normalizeSession({ ...fixture(), elapsedMs: 900.25 })?.elapsedMs).toBe(
    900.25,
  );
});

it('bounds timestamps to valid dates with deterministic fallbacks', () => {
  const game = normalizeSession({
    ...fixture(),
    createdAt: 1e308,
    lastPlayed: 5000,
  })!;
  expect(game.createdAt).toBe(5000);
  const invalid = normalizeSession({
    ...fixture(),
    createdAt: 8_640_000_000_000_001,
    lastPlayed: Infinity,
  })!;
  expect(invalid.createdAt).toBe(0);
  expect(invalid.lastPlayed).toBe(0);
  expect(Number.isNaN(new Date(invalid.createdAt).getTime())).toBe(false);
});
