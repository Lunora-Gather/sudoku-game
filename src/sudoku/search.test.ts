import { expect, it } from 'vitest';
import { createSearchContext, limitSearch, SearchLimitError } from './search';

it('limits one clue attempt without resetting the shared search budget', () => {
  const total = createSearchContext({ maxNodes: 4, now: () => 0 });
  const attempt = limitSearch(total, 1);
  attempt.visit();
  expect(() => attempt.visit()).toThrowError(
    expect.objectContaining({ scope: 'attempt' }),
  );
  const next = limitSearch(total, 5);
  next.visit();
  next.visit();
  expect(() => next.visit()).toThrowError(
    expect.objectContaining({ scope: 'total' }),
  );
});

it('prioritizes cancellation over an exhausted attempt and rejects invalid attempt limits', () => {
  const controller = new AbortController();
  const total = createSearchContext({
    signal: controller.signal,
    now: () => 0,
  });
  const attempt = limitSearch(total, 0);
  controller.abort();
  expect(() => attempt.visit()).toThrowError(
    expect.objectContaining({ name: 'AbortError' }),
  );
  expect(() => limitSearch(total, Infinity)).toThrow(/finite/);
  expect(new SearchLimitError('attempt')).toBeInstanceOf(Error);
});
