import {
  CLASSIC_REGION_MAP,
  cloneBoard,
  createEmptyBoard,
  isBoard,
} from './board';
import {
  ORTHOGONAL_NEIGHBORS,
  compileTopology,
  isRegionMap,
  regionConnected,
  Topology,
} from './topology';
import {
  GenerationError,
  SearchLimitError,
  SearchContext,
  SearchOptions,
  createSearchContext,
  limitSearch,
  search,
  shuffle,
} from './search';
import {
  Board,
  CELL_COUNT,
  DIFFICULTIES,
  Difficulty,
  GAME_TYPES,
  GameType,
  ReadonlyBoard,
  ReadonlyRegionMap,
  RegionMap,
  SIDE,
} from './types';
export const countSolutions = (
  board: ReadonlyBoard,
  map: ReadonlyRegionMap,
  diagonal = false,
  options: SearchOptions = {},
): number => {
  if (!isBoard(board) || !isRegionMap(map)) return 0;
  return search(
    board,
    compileTopology(map, diagonal),
    createSearchContext(options),
    2,
  ).count;
};
function completeBoard(topology: Topology, context: SearchContext): Board {
  const result = search(createEmptyBoard(), topology, context, 1, true);
  if (!result.solution)
    throw new GenerationError('These regions have no solution.');
  return result.solution;
}
/** Equal-digit swaps preserve a known solution; only connected, nine-cell regions are accepted. */
function deformRegions(solution: Board, context: SearchContext): RegionMap {
  const classic = CLASSIC_REGION_MAP.flat(),
    regions = [...classic],
    digitCells: number[][] = Array.from({ length: SIDE }, () => []);
  solution.flat().forEach((n, i) => digitCells[n! - 1].push(i));
  let best: number[] | null = null,
    bestScore = 0;
  for (let step = 0; step < 24; step++) {
    context.visit();
    const candidates: [number, number][] = [];
    for (const group of digitCells)
      for (let a = 0; a < group.length; a++)
        for (let b = a + 1; b < group.length; b++) {
          const i = group[a],
            j = group[b],
            ra = regions[i],
            rb = regions[j];
          if (
            ra === rb ||
            !ORTHOGONAL_NEIGHBORS[i].some((n) => regions[n] === rb) ||
            !ORTHOGONAL_NEIGHBORS[j].some((n) => regions[n] === ra)
          )
            continue;
          regions[i] = rb;
          regions[j] = ra;
          if (regionConnected(regions, ra) && regionConnected(regions, rb))
            candidates.push([i, j]);
          regions[i] = ra;
          regions[j] = rb;
        }
    if (!candidates.length) break;
    const [i, j] = shuffle(candidates, context.random)[0];
    [regions[i], regions[j]] = [regions[j], regions[i]];
    const score = regions.reduce(
      (sum, reg, cell) => sum + Number(reg !== classic[cell]),
      0,
    );
    if (score > bestScore) {
      best = [...regions];
      bestScore = score;
    }
  }
  if (!best)
    throw new GenerationError(
      'Could not create an irregular layout. Please try again.',
    );
  return Array.from({ length: SIDE }, (_, r) =>
    best!.slice(r * SIDE, (r + 1) * SIDE),
  );
}
function digPuzzle(
  difficulty: Difficulty,
  solution: Board,
  topology: Topology,
  context: SearchContext,
): Board {
  const puzzle = cloneBoard(solution),
    counts = new Uint8Array(topology.houses.length).fill(SIDE);
  const positions = shuffle(
    Array.from({ length: CELL_COUNT }, (_, i) => i),
    context.random,
  );
  const target = { easy: 40, medium: 50, hard: 60 }[difficulty];
  const nodesPerClue = 20_000;
  let holes = 0;
  const dig = (cell: number) => {
    const r = Math.floor(cell / SIDE),
      c = cell % SIDE,
      related = topology.cellHouses[cell];
    if (puzzle[r][c] === null || related.some((h) => counts[h] <= 1)) return;
    const value = puzzle[r][c];
    puzzle[r][c] = null;
    let accepted = false;
    try {
      if (
        search(puzzle, topology, limitSearch(context, nodesPerClue), 2)
          .count === 1
      ) {
        accepted = true;
        holes++;
        for (const house of related) counts[house]--;
      }
    } catch (error) {
      if (!(error instanceof SearchLimitError && error.scope === 'attempt'))
        throw error;
    } finally {
      // Never expose an unverified removal, including on timeout or cancellation.
      if (!accepted) puzzle[r][c] = value;
    }
  };
  try {
    for (const cell of positions) {
      context.visit();
      if (topology.cellHouses[cell].some((h) => counts[h] > 7)) dig(cell);
    }
    for (const cell of positions) {
      if (holes >= target) break;
      context.visit();
      dig(cell);
    }
  } catch (error) {
    // Every accepted removal was proven unique. Keep that board only after house limits hold.
    if (!(
      error instanceof SearchLimitError &&
      error.scope === 'total' &&
      counts.every((count) => count >= 1 && count <= 7)
    ))
      throw error;
  }
  return puzzle;
}
export const generateRandomRegionMap = (
  options: SearchOptions = {},
): RegionMap => {
  const context = createSearchContext(options);
  return deformRegions(
    completeBoard(compileTopology(CLASSIC_REGION_MAP), context),
    context,
  );
};
export async function generatePuzzle(
  difficulty: Difficulty,
  map: RegionMap,
  diagonal = false,
  options: SearchOptions = {},
): Promise<{ puzzle: Board; solution: Board }> {
  if (!DIFFICULTIES.includes(difficulty) || !isRegionMap(map))
    throw new GenerationError('Invalid puzzle settings.');
  const context = createSearchContext(options),
    topology = compileTopology(map, diagonal),
    solution = completeBoard(topology, context);
  return {
    puzzle: digPuzzle(difficulty, solution, topology, context),
    solution,
  };
}
export interface GeneratedGame {
  puzzle: Board;
  solution: Board;
  regionMap: RegionMap;
}
export async function generateGame(
  difficulty: Difficulty,
  type: GameType,
  options: SearchOptions = {},
): Promise<GeneratedGame> {
  if (!DIFFICULTIES.includes(difficulty) || !GAME_TYPES.includes(type))
    throw new GenerationError('Invalid puzzle settings.');
  const context = createSearchContext(options),
    diagonal = type === 'Diagonal 9x9';
  const solution = completeBoard(
    compileTopology(CLASSIC_REGION_MAP, diagonal),
    context,
  );
  const regionMap =
    type === 'Irregular 9x9'
      ? deformRegions(solution, context)
      : CLASSIC_REGION_MAP.map((row) => [...row]);
  return {
    puzzle: digPuzzle(
      difficulty,
      solution,
      compileTopology(regionMap, diagonal),
      context,
    ),
    solution,
    regionMap,
  };
}
