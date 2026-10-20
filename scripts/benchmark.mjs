import { build } from 'vite';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// Compile pure TS modules in memory; neither build/ nor the checked-out source is modified.
async function loadModule(entry) {
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      target: 'es2022',
      lib: { entry: resolve(entry), formats: ['es'] },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const entryChunk = output.find(
    (item) => item.type === 'chunk' && item.isEntry,
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(entryChunk.code).toString('base64')}`
  );
}
const samples = Number(process.env.SUDOKU_BENCH_SAMPLES ?? 50);
if (!Number.isInteger(samples) || samples < 1 || samples > 1000)
  throw Error('SUDOKU_BENCH_SAMPLES must be an integer from 1 to 1000.');
const engine = await loadModule('src/sudoku/index.ts');
const model = await loadModule('src/game/model.ts');
const random = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const results = [];
for (const type of engine.GAME_TYPES)
  for (const difficulty of engine.DIFFICULTIES) {
    const times = [],
      holes = [],
      failures = [];
    for (let seed = 1; seed <= samples; seed++) {
      const start = performance.now();
      try {
        const { puzzle, solution, regionMap } = await engine.generateGame(
          difficulty,
          type,
          { random: random(seed) },
        );
        times.push(performance.now() - start);
        const diagonal = type === 'Diagonal 9x9',
          cells = puzzle.flat();
        holes.push(cells.filter((n) => n === null).length);
        const unchanged = JSON.stringify(puzzle);
        const valid =
          engine.isRegionMap(regionMap) &&
          engine.isSolved(solution, regionMap, diagonal) &&
          puzzle.every((row, r) =>
            row.every((n, c) => n === null || n === solution[r][c]),
          ) &&
          engine.countSolutions(puzzle, regionMap, diagonal) === 1 &&
          JSON.stringify(puzzle) === unchanged &&
          engine.compileTopology(regionMap, diagonal).houses.every((house) => {
            const givens = house.filter((i) => cells[i] !== null).length;
            return givens >= 1 && givens <= 7;
          });
        if (!valid) failures.push({ seed, error: 'Puzzle invariant failed' });
      } catch (error) {
        failures.push({ seed, error: error.message });
      }
    }
    results.push({
      type,
      difficulty,
      samples,
      meanMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
      maxMs: +Math.max(...times).toFixed(3),
      holes: [Math.min(...holes), Math.max(...holes)],
      failures,
    });
  }
const puzzle = engine.createEmptyBoard();
puzzle[0][0] = 1;
let state = {
  sessions: [
    model.newSession(
      'benchmark',
      puzzle,
      engine.CLASSIC_REGION_MAP,
      'easy',
      'Standard 9x9',
      0,
    ),
  ],
  activeGameId: 'benchmark',
  undo: [],
};
const wholeBoardRecords = [];
for (let i = 0; i < model.MAX_UNDO; i++) {
  const game = model.activeSession(state);
  wholeBoardRecords.push({ board: game.board, notes: game.notes });
  state = model.gameReducer(state, {
    type: 'input',
    cell: [0, 1],
    value: 2 + (i % 2),
    noteMode: false,
    at: i,
  });
}
const previousBytes = Buffer.byteLength(JSON.stringify(wholeBoardRecords)),
  currentBytes = Buffer.byteLength(JSON.stringify(state.undo));
console.log(
  JSON.stringify(
    {
      samples: samples * results.length,
      runtime: process.version,
      generation: results,
      undoEncoding: {
        edits: model.MAX_UNDO,
        wholeBoardRecordsBytes: previousBytes,
        cellRecordsBytes: currentBytes,
        reductionPercent: +((1 - currentBytes / previousBytes) * 100).toFixed(
          2,
        ),
        measurement: 'JSON encoding size; not a heap-memory measurement',
      },
    },
    null,
    2,
  ),
);
if (results.some((result) => result.failures.length)) process.exitCode = 1;
