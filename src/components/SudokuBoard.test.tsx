import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SudokuBoard from './SudokuBoard';
import { fixture, seededRandom } from '../test/fixtures';
import { gameReducer, type GameState } from '../game/model';
import { generateGame } from '../sudoku/generator';

const renders = vi.hoisted(() => [] as number[]);
vi.mock('./Cell', async (original) => {
  const actual = await original<typeof import('./Cell')>();
  const { memo } = await import('react');
  return {
    default: memo((props: Parameters<typeof actual.default>[0]) => {
      renders.push(props.row * 9 + props.col);
      return <actual.default {...props} />;
    }),
  };
});
beforeEach(() => {
  renders.length = 0;
});
function props() {
  const game = fixture();
  return {
    board: game.board,
    initialBoard: game.initialBoard,
    notes: game.notes,
    selectedCell: [0, 1] as [number, number],
    errorCells: [],
    isPaused: false,
    regionMap: game.regionMap,
    type: game.type,
    onCellClick: vi.fn(),
  };
}

it('renders only the edited cell for a number or note update with unchanged selection and errors', () => {
  let state: GameState = { sessions: [fixture()], activeGameId: 'A', undo: [] };
  const original = props();
  const view = render(
    <SudokuBoard
      {...original}
      board={state.sessions[0].board}
      notes={state.sessions[0].notes}
    />,
  );
  renders.length = 0;
  state = gameReducer(state, {
    type: 'input',
    cell: [0, 1],
    value: 2,
    noteMode: true,
    at: 1000,
  });
  view.rerender(
    <SudokuBoard
      {...original}
      board={state.sessions[0].board}
      notes={state.sessions[0].notes}
    />,
  );
  expect(renders).toEqual([1]);
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 2,/ }),
  ).toHaveAccessibleName(/notes 2/);
  renders.length = 0;
  state = gameReducer(state, {
    type: 'input',
    cell: [0, 1],
    value: 3,
    noteMode: false,
    at: 1001,
  });
  view.rerender(
    <SudokuBoard
      {...original}
      board={state.sessions[0].board}
      notes={state.sessions[0].notes}
    />,
  );
  expect(renders).toEqual([1]);
});

it('uses new callbacks after a prop change and keeps focus navigation working after memoized updates', () => {
  const original = props();
  const view = render(<SudokuBoard {...original} />);
  const next = vi.fn();
  view.rerender(<SudokuBoard {...original} onCellClick={next} />);
  const cell = screen.getByRole('gridcell', { name: /^Row 1, column 2,/ });
  fireEvent.click(cell);
  expect(next).toHaveBeenCalledWith(0, 1);
  expect(original.onCellClick).not.toHaveBeenCalled();
  act(() => cell.focus());
  fireEvent.keyDown(cell, { key: 'ArrowRight' });
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 3,/ }),
  ).toHaveFocus();
  expect(next).toHaveBeenCalledWith(0, 2);
  next.mockClear();
  view.rerender(<SudokuBoard {...original} isPaused onCellClick={next} />);
  fireEvent.click(cell);
  expect(next).not.toHaveBeenCalled();
});

it('updates both conflicting cells without rerendering the rest of the board', () => {
  const original = props();
  const view = render(<SudokuBoard {...original} />);
  renders.length = 0;
  const board = original.board.map((row) => [...row]);
  board[0][1] = 1;
  view.rerender(
    <SudokuBoard
      {...original}
      board={board}
      errorCells={[
        [0, 0],
        [0, 1],
      ]}
    />,
  );
  expect(renders).toEqual([0, 1]);
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 1,/ }),
  ).toHaveAttribute('aria-invalid', 'true');
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 2,/ }),
  ).toHaveAccessibleName(/conflict/);
});

it('exposes irregular region membership without adding visible descriptions', async () => {
  const generated = await generateGame('easy', 'Irregular 9x9', {
    random: seededRandom(17),
  });
  const original = props();
  const view = render(
    <SudokuBoard
      {...original}
      board={generated.puzzle}
      initialBoard={generated.puzzle}
      regionMap={generated.regionMap}
      type="Irregular 9x9"
    />,
  );
  expect(screen.getByRole('grid')).toHaveAccessibleName(
    'Irregular Sudoku board',
  );
  const cells = screen.getAllByRole('gridcell');
  for (let index = 0; index < 81; index++)
    expect(cells[index]).toHaveAccessibleName(
      new RegExp(
        `region ${generated.regionMap[Math.floor(index / 9)][index % 9] + 1}`,
      ),
    );
  expect(view.container.textContent).not.toMatch(/region|diagonal/i);
});

it('identifies both diagonal constraints at the center and preserves peer highlighting', () => {
  render(
    <SudokuBoard {...props()} type="Diagonal 9x9" selectedCell={[4, 4]} />,
  );
  const center = screen.getByRole('gridcell', { name: /^Row 5, column 5,/ });
  expect(center).toHaveAccessibleName(/main diagonal, anti-diagonal/);
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 9,/ }),
  ).toHaveClass('highlighted');
  expect(
    screen.getByRole('gridcell', { name: /^Row 1, column 2,/ }),
  ).not.toHaveClass('highlighted');
});
