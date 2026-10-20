import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { testLocks } from './test/locks';
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: testLocks(),
  });
});
afterEach(cleanup);
