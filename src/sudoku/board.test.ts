import { expect, it } from 'vitest';
import { CLASSIC_REGION_MAP, createEmptyBoard, isBoard } from './board';
import { countSolutions } from './generator';
import { isSolved } from './rules';
import { solution } from '../test/fixtures';

it.each([
  'missing rows',
  'empty rows',
  'missing cell',
  'undefined cell',
] as const)(
  'rejects %s rather than treating it as a solved unique board',
  (kind) => {
    let board = createEmptyBoard();
    if (kind === 'missing rows') board = Array(9);
    if (kind === 'empty rows')
      board = Array.from({ length: 9 }, () => Array(9));
    if (kind === 'missing cell') Reflect.deleteProperty(board[4], 4);
    if (kind === 'undefined cell') (board[4] as unknown[])[4] = undefined;
    expect(isBoard(board)).toBe(false);
    expect(isSolved(board, CLASSIC_REGION_MAP)).toBe(false);
    expect(countSolutions(board, CLASSIC_REGION_MAP)).toBe(0);
  },
);

it('keeps dense blank and solved boards valid, including frozen caller inputs', () => {
  const blank = createEmptyBoard();
  blank.forEach(Object.freeze);
  Object.freeze(blank);
  expect(isBoard(blank)).toBe(true);
  expect(isSolved(blank, CLASSIC_REGION_MAP)).toBe(false);
  expect(isBoard(solution)).toBe(true);
  expect(isSolved(solution, CLASSIC_REGION_MAP)).toBe(true);
});
