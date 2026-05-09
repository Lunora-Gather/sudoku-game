export type Board = (number | null)[][];
export type Position = [number, number];
export type RegionMap = number[][];

export const EMPTY_BOARD: Board = Array(9).fill(null).map(() => Array(9).fill(null));

// --- ULTRA-FAST BITMASK ENGINE ---

const ALL_NUMS = 0x1FF;
const getBit = (num: number) => 1 << (num - 1);
const countSetBits = (n: number) => {
  let count = 0;
  while (n > 0) { n &= (n - 1); count++; }
  return count;
};

export const CLASSIC_REGION_MAP: RegionMap = Array(9).fill(null).map((_, r) => 
  Array(9).fill(null).map((_, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3))
);

interface SolverState {
  rows: Int32Array;
  cols: Int32Array;
  regions: Int32Array;
  diag1: number; // Top-left to bottom-right
  diag2: number; // Top-right to bottom-left
}

const createState = (): SolverState => ({
  rows: new Int32Array(9),
  cols: new Int32Array(9),
  regions: new Int32Array(9),
  diag1: 0,
  diag2: 0,
});

const updateState = (state: SolverState, r: number, c: number, reg: number, num: number, add: boolean) => {
  const bit = getBit(num);
  if (add) {
    state.rows[r] |= bit; 
    state.cols[c] |= bit; 
    state.regions[reg] |= bit;
    if (r === c) state.diag1 |= bit;
    if (r + c === 8) state.diag2 |= bit;
  } else {
    state.rows[r] &= ~bit; 
    state.cols[c] &= ~bit; 
    state.regions[reg] &= ~bit;
    if (r === c) state.diag1 &= ~bit;
    if (r + c === 8) state.diag2 &= ~bit;
  }
};

/**
 * Unified Solver
 * @param limit Max solutions to find
 * @param random Whether to shuffle numbers
 * @param isDiagonal Whether to enforce X-Sudoku rules
 */
const solve = (
  board: Board, 
  regionMap: RegionMap, 
  state: SolverState, 
  limit: number = 1, 
  random: boolean = false,
  isDiagonal: boolean = false
): number => {
  let solutions = 0;

  const run = (): boolean => {
    let minOptions = 10;
    let bestCell: [number, number] | null = null;
    let bestMask = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === null) {
          let occupied = state.rows[r] | state.cols[c] | state.regions[regionMap[r][c]];
          if (isDiagonal) {
            if (r === c) occupied |= state.diag1;
            if (r + c === 8) occupied |= state.diag2;
          }
          
          const mask = ALL_NUMS & ~occupied;
          const options = countSetBits(mask);
          if (options === 0) return false;
          if (options < minOptions) {
            minOptions = options; bestCell = [r, c]; bestMask = mask;
            if (options === 1) break;
          }
        }
      }
      if (minOptions === 1) break;
    }

    if (!bestCell) {
      solutions++;
      return solutions >= limit;
    }

    const [r, c] = bestCell;
    const reg = regionMap[r][c];
    const nums = [];
    for (let n = 1; n <= 9; n++) if (bestMask & getBit(n)) nums.push(n);
    if (random) shuffle(nums);

    for (const num of nums) {
      board[r][c] = num;
      updateState(state, r, c, reg, num, true);
      if (run()) return true;
      updateState(state, r, c, reg, num, false);
      board[r][c] = null;
    }
    return false;
  };

  run();
  return solutions;
};

// --- DYNAMIC REGION GENERATOR ---

export const generateRandomRegionMap = (): RegionMap => {
  const generate = (): RegionMap | null => {
    const map: number[][] = Array(9).fill(null).map(() => Array(9).fill(-1));
    const regionSizes = new Int32Array(9).fill(0);
    const frontiers: [number, number][][] = Array(9).fill(null).map(() => []);

    const updateFrontier = (r: number, c: number, reg: number) => {
      const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && map[nr][nc] === -1) {
          if (!frontiers[reg].some(([fr, fc]) => fr === nr && fc === nc)) {
            frontiers[reg].push([nr, nc]);
          }
        }
      }
    };

    for (let i = 0; i < 9; i++) {
      let r, c;
      let tries = 0;
      do {
        r = Math.floor(Math.random() * 9);
        c = Math.floor(Math.random() * 9);
        tries++;
      } while (map[r][c] !== -1 && tries < 100);
      if (map[r][c] !== -1) return null;
      map[r][c] = i;
      regionSizes[i] = 1;
      updateFrontier(r, c, i);
    }

    for (let step = 9; step < 81; step++) {
      let minSize = 10;
      let candidateRegions: number[] = [];
      for (let i = 0; i < 9; i++) {
        if (regionSizes[i] < 9 && frontiers[i].length > 0) {
          if (regionSizes[i] < minSize) {
            minSize = regionSizes[i];
            candidateRegions = [i];
          } else if (regionSizes[i] === minSize) {
            candidateRegions.push(i);
          }
        }
      }
      if (candidateRegions.length === 0) return null;
      const reg = candidateRegions[Math.floor(Math.random() * candidateRegions.length)];
      const idx = Math.floor(Math.random() * frontiers[reg].length);
      const [r, c] = frontiers[reg].splice(idx, 1)[0];
      if (map[r][c] !== -1) { step--; continue; }
      map[r][c] = reg;
      regionSizes[reg]++;
      for (let i = 0; i < 9; i++) {
        const fIdx = frontiers[i].findIndex(([fr, fc]) => fr === r && fc === c);
        if (fIdx !== -1) frontiers[i].splice(fIdx, 1);
      }
      updateFrontier(r, c, reg);
    }
    return map;
  };
  let result = null;
  while (!result) result = generate();
  return result;
};

export const generatePuzzle = async (
  difficulty: 'easy' | 'medium' | 'hard', 
  regionMap: RegionMap,
  isDiagonal: boolean = false
): Promise<{ puzzle: Board, solution: Board }> => {
  const board: Board = Array(9).fill(null).map(() => Array(9).fill(null));
  const state = createState();
  
  // 1. Generation (This part is usually very fast)
  solve(board, regionMap, state, 1, true, isDiagonal);
  const solution = board.map(row => [...row]);

  // 2. Dig holes
  const puzzle = solution.map(row => [...row]);
  const positions: Position[] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) positions.push([r, c]);
  shuffle(positions);

  const target = difficulty === 'easy' ? 40 : difficulty === 'medium' ? 50 : 60;
  let holes = 0;

  const countState = createState();

  const getHouseCounts = (p: Board, r: number, c: number, reg: number) => {
    const rowCount = p[r].filter(v => v !== null).length;
    const colCount = p.map(row => row[c]).filter(v => v !== null).length;
    let regCount = 0;
    for (let rr = 0; rr < 9; rr++) {
      for (let cc = 0; cc < 9; cc++) {
        if (regionMap[rr][cc] === reg && p[rr][cc] !== null) regCount++;
      }
    }
    let d1Count = 0;
    let d2Count = 0;
    if (isDiagonal) {
      for (let i = 0; i < 9; i++) {
        if (p[i][i] !== null) d1Count++;
        if (p[i][8-i] !== null) d2Count++;
      }
    }
    return { rowCount, colCount, regCount, d1Count, d2Count };
  };

  // Helper to yield control to browser every few steps
  const sleep = () => new Promise(resolve => setTimeout(resolve, 0));

  // Phase 1: Force dig
  const startTimer = Date.now();
  let step = 0;
  for (const [r, c] of positions) {
    step++;
    if (step % 10 === 0) {
      await sleep();
      if (Date.now() - startTimer > 10500) throw new Error("Timeout");
    }

    const counts = getHouseCounts(puzzle, r, c, regionMap[r][c]);
    const needsDig = counts.rowCount > 7 || counts.colCount > 7 || counts.regCount > 7 || 
                     (isDiagonal && ((r === c && counts.d1Count > 7) || (r + c === 8 && counts.d2Count > 7)));
    
    if (needsDig) {
      const temp = puzzle[r][c]!;
      puzzle[r][c] = null;
      updateState(state, r, c, regionMap[r][c], temp, false);
      countState.rows.set(state.rows);
      countState.cols.set(state.cols);
      countState.regions.set(state.regions);
      countState.diag1 = state.diag1;
      countState.diag2 = state.diag2;
      
      const tempBoard = puzzle.map(row => [...row]);
      if (solve(tempBoard, regionMap, countState, 2, false, isDiagonal) === 1) {
        holes++;
      } else {
        puzzle[r][c] = temp;
        updateState(state, r, c, regionMap[r][c], temp, true);
      }
    }
  }

  // Phase 2: Random dig
  for (const [r, c] of positions) {
    if (holes >= target) break;
    if (puzzle[r][c] === null) continue;

    step++;
    if (step % 5 === 0) {
      await sleep();
      if (Date.now() - startTimer > 10500) throw new Error("Timeout");
    }

    const reg = regionMap[r][c];
    const counts = getHouseCounts(puzzle, r, c, reg);
    
    if (counts.rowCount <= 1 || counts.colCount <= 1 || counts.regCount <= 1) continue;
    if (isDiagonal) {
      if (r === c && counts.d1Count <= 1) continue;
      if (r + c === 8 && counts.d2Count <= 1) continue;
    }

    const temp = puzzle[r][c]!;
    puzzle[r][c] = null;
    updateState(state, r, c, reg, temp, false);
    countState.rows.set(state.rows);
    countState.cols.set(state.cols);
    countState.regions.set(state.regions);
    countState.diag1 = state.diag1;
    countState.diag2 = state.diag2;
    
    const tempBoard = puzzle.map(row => [...row]);
    if (solve(tempBoard, regionMap, countState, 2, false, isDiagonal) === 1) {
      holes++;
    } else {
      puzzle[r][c] = temp;
      updateState(state, r, c, reg, temp, true);
    }
  }
  return { puzzle, solution };
};

export const checkErrors = (board: Board, regionMap: RegionMap, isDiagonal: boolean = false): Position[] => {
  const errors: Position[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const num = board[r][c];
      if (!num) continue;
      board[r][c] = null;
      let conflict = false;
      for (let i = 0; i < 9; i++) {
        if (board[r][i] === num || board[i][c] === num) conflict = true;
      }
      if (!conflict) {
        for (let rr = 0; rr < 9; rr++) {
          for (let cc = 0; cc < 9; cc++) {
            if (regionMap[rr][cc] === regionMap[r][c] && board[rr][cc] === num) conflict = true;
          }
        }
      }
      if (!conflict && isDiagonal) {
        if (r === c) {
          for (let i = 0; i < 9; i++) if (i !== r && board[i][i] === num) conflict = true;
        }
        if (r + c === 8) {
          for (let i = 0; i < 9; i++) if (i !== r && board[i][8-i] === num) conflict = true;
        }
      }
      if (conflict) errors.push([r, c]);
      board[r][c] = num;
    }
  }
  return errors;
};

const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
