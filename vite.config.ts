import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  base: '/sudoku-game/',
  build: { outDir: 'build', target: 'es2022' },
  server: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    maxWorkers: 2,
    restoreMocks: true,
  },
});
