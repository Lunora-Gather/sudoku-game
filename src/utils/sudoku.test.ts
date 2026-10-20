import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_REGION_MAP,
  GAME_TYPES,
  DIFFICULTIES,
  Board,
  RegionMap,
  checkErrors,
  cloneBoard,
  compileTopology,
  countSolutions,
  createEmptyBoard,
  generateGame,
  generatePuzzle,
  isBoard,
  isRegionMap,
  isSolved,
} from './sudoku';
import { seededRandom, solution } from '../test/fixtures';
// Independent set-based constraint checker and solution counter, separate from the bitmask engine.
function independentCount(
  input: Board,
  map: RegionMap,
  diagonal: boolean,
): number {
  const board = cloneBoard(input);
  const candidates = (r: number, c: number) => {
    const used = new Set<number | null>([
      ...board[r],
      ...board.map((row) => row[c]),
    ]);
    for (let rr = 0; rr < 9; rr++)
      for (let cc = 0; cc < 9; cc++)
        if (map[rr][cc] === map[r][c]) used.add(board[rr][cc]);
    if (diagonal && r === c) for (let i = 0; i < 9; i++) used.add(board[i][i]);
    if (diagonal && r + c === 8)
      for (let i = 0; i < 9; i++) used.add(board[i][8 - i]);
    return Array.from({ length: 9 }, (_, i) => i + 1).filter(
      (n) => !used.has(n),
    );
  };
  const run = (): number => {
    let best: [number, number] | null = null,
      options: number[] = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (board[r][c] === null) {
          const values = candidates(r, c);
          if (!values.length) return 0;
          if (!best || values.length < options.length) {
            best = [r, c];
            options = values;
          }
        }
    if (!best) return 1;
    const [r, c] = best;
    let total = 0;
    for (const n of options) {
      board[r][c] = n;
      total += run();
      if (total >= 2) break;
    }
    board[r][c] = null;
    return total;
  };
  return run();
}
describe('rules and input validation', () => {
  it('does not mutate frozen boards and marks both conflicting cells', () => {
    const board = createEmptyBoard();
    board[0][0] = 1;
    board[0][4] = 1;
    board.forEach(Object.freeze);
    Object.freeze(board);
    expect(checkErrors(board, CLASSIC_REGION_MAP)).toEqual([
      [0, 0],
      [0, 4],
    ]);
  });
  it('enforces the extra diagonal only when selected', () => {
    const board = createEmptyBoard();
    board[0][0] = 1;
    board[4][4] = 1;
    expect(checkErrors(board, CLASSIC_REGION_MAP)).toEqual([]);
    expect(checkErrors(board, CLASSIC_REGION_MAP, true)).toEqual([
      [0, 0],
      [4, 4],
    ]);
  });
  it('rejects invalid shapes, values and disconnected regions', () => {
    expect(isBoard([[1]])).toBe(false);
    expect(isBoard(solution.map((row) => row.map((n) => n! + 1)))).toBe(false);
    const invalid = createEmptyBoard();
    invalid[0][0] = 10;
    expect(checkErrors(invalid, CLASSIC_REGION_MAP)).toEqual([[0, 0]]);
    const map = CLASSIC_REGION_MAP.map((row) => [...row]);
    [map[0][0], map[8][8]] = [map[8][8], map[0][0]];
    expect(isRegionMap(map)).toBe(false);
    expect(countSolutions(invalid, CLASSIC_REGION_MAP)).toBe(0);
    expect(isSolved(solution, CLASSIC_REGION_MAP)).toBe(true);
  });
  it('counts ambiguous and contradictory boards without modifying the input', () => {
    const board = createEmptyBoard(),
      before = cloneBoard(board);
    expect(countSolutions(board, CLASSIC_REGION_MAP)).toBe(2);
    expect(board).toEqual(before);
    board[0][0] = 1;
    board[0][1] = 1;
    expect(countSolutions(board, CLASSIC_REGION_MAP)).toBe(0);
  });
  it('honors cancellation and finite search budgets', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateGame('easy', 'Standard 9x9', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      generateGame('easy', 'Irregular 9x9', { maxNodes: 0 }),
    ).rejects.toThrow(/search limit/);
    await expect(
      generatePuzzle('easy', CLASSIC_REGION_MAP, false, { timeoutMs: 0 }),
    ).rejects.toThrow(/search limit/);
  });
});
describe('generated puzzle invariants', () => {
  for (const type of GAME_TYPES)
    for (const difficulty of DIFFICULTIES) {
      it(`${type}, ${difficulty}: connected regions, preserved givens and exactly one solution`, async () => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom(7));
        const {
          puzzle,
          solution: answer,
          regionMap,
        } = await generateGame(difficulty, type);
        expect(isRegionMap(regionMap)).toBe(true);
        expect(answer.flat().every((n) => n !== null && n >= 1 && n <= 9)).toBe(
          true,
        );
        for (let i = 0; i < 9; i++) {
          expect(new Set(answer[i]).size).toBe(9);
          expect(new Set(answer.map((row) => row[i])).size).toBe(9);
          expect(
            new Set(
              answer
                .flat()
                .filter((_, j) => regionMap[Math.floor(j / 9)][j % 9] === i),
            ).size,
          ).toBe(9);
        }
        if (type === 'Diagonal 9x9') {
          expect(new Set(answer.map((row, i) => row[i])).size).toBe(9);
          expect(new Set(answer.map((row, i) => row[8 - i])).size).toBe(9);
        }
        if (type === 'Irregular 9x9')
          expect(regionMap).not.toEqual(CLASSIC_REGION_MAP);
        expect(
          puzzle.every((row, r) =>
            row.every((n, c) => n === null || n === answer[r][c]),
          ),
        ).toBe(true);
        expect(
          independentCount(puzzle, regionMap, type === 'Diagonal 9x9'),
        ).toBe(1);
      }, 15000);
    }
  it('handles the formerly blocking irregular seeds within a bounded search', async () => {
    for (const seed of [1, 7]) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const result = await generateGame('easy', 'Irregular 9x9', {
        maxNodes: 100_000,
      });
      expect(independentCount(result.puzzle, result.regionMap, false)).toBe(1);
    }
  });
  it('keeps harder settings at least as sparse for the same random path', async () => {
    const holes = [];
    for (const difficulty of DIFFICULTIES) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(1));
      holes.push(
        (await generateGame(difficulty, 'Standard 9x9')).puzzle
          .flat()
          .filter((n) => n === null).length,
      );
    }
    expect(holes[0]).toBeLessThanOrEqual(holes[1]);
    expect(holes[1]).toBeLessThanOrEqual(holes[2]);
  });

  it('generates a unique hard irregular puzzle for the formerly failing seed 638', async () => {
    const result = await generateGame('hard', 'Irregular 9x9', {
      random: seededRandom(638),
      now: () => 0,
    });
    expect(isRegionMap(result.regionMap)).toBe(true);
    expect(
      result.puzzle.flat().filter((n) => n === null).length,
    ).toBeGreaterThanOrEqual(50);
    expect(independentCount(result.puzzle, result.regionMap, false)).toBe(1);
  });

  it('propagates cancellation during clue removal instead of returning an intermediate puzzle', async () => {
    const controller = new AbortController();
    let visits = 0;
    await expect(
      generateGame('hard', 'Irregular 9x9', {
        random: seededRandom(638),
        signal: controller.signal,
        now: () => {
          if (++visits === 250) controller.abort();
          return 0;
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each(['nodes', 'time'] as const)(
    'keeps a verified puzzle when the total %s budget ends during digging',
    async (budget) => {
      let visits = 0;
      const result = await generateGame('hard', 'Irregular 9x9', {
        random: seededRandom(638),
        maxNodes: budget === 'nodes' ? 1000 : 1_000_000,
        timeoutMs: 1,
        now: budget === 'time' ? () => (++visits >= 1000 ? 1 : 0) : () => 0,
      });
      expect(independentCount(result.puzzle, result.regionMap, false)).toBe(1);
      const cells = result.puzzle.flat();
      for (const house of compileTopology(result.regionMap).houses) {
        const clues = house.filter((cell) => cells[cell] !== null).length;
        expect(clues).toBeGreaterThanOrEqual(1);
        expect(clues).toBeLessThanOrEqual(7);
      }
      await expect(
        generateGame('hard', 'Irregular 9x9', {
          random: seededRandom(638),
          now: () => 0,
          maxNodes: 200,
        }),
      ).rejects.toThrow(/search limit/);
    },
  );
});
