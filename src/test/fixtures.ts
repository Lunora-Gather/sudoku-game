import { CLASSIC_REGION_MAP, Board } from '../utils/sudoku';
import { GameSession, newSession } from '../game/model';
export const solution: Board = Array.from({ length: 9 }, (_, r) =>
  Array.from(
    { length: 9 },
    (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1,
  ),
);
export const fixture = (id = 'A', diagonal = false, mark = 1): GameSession => {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(null));
  board[0][0] = mark;
  return {
    ...newSession(
      id,
      board,
      CLASSIC_REGION_MAP,
      'easy',
      diagonal ? 'Diagonal 9x9' : 'Standard 9x9',
      1000,
    ),
    createdAt: id === 'A' ? 2000 : 1000,
    lastPlayed: id === 'A' ? 2000 : 1000,
  };
};
export const seededRandom = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
