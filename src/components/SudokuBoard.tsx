import { KeyboardEvent, memo, useCallback, useMemo, useRef } from 'react';
import type { Board, GameType, Position, RegionMap } from '../sudoku/types';
import { compileTopology } from '../sudoku/topology';
import { Notes } from '../game/model';
import Cell from './Cell';
interface Props {
  board: Board;
  notes: Notes;
  initialBoard: Board;
  selectedCell: Position | null;
  errorCells: Position[];
  isPaused: boolean;
  regionMap: RegionMap;
  type: GameType;
  onCellClick: (row: number, col: number) => void;
}
function SudokuBoard({
  board,
  notes,
  initialBoard,
  selectedCell,
  errorCells,
  isPaused,
  regionMap,
  type,
  onCellClick,
}: Props) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const isDiagonal = type === 'Diagonal 9x9';
  const topology = useMemo(
    () => compileTopology(regionMap, isDiagonal),
    [regionMap, isDiagonal],
  );
  const borders = useMemo(
    () =>
      topology.regions.map((region, cell) => ({
        top: cell >= 9 && topology.regions[cell - 9] !== region,
        right: cell % 9 < 8 && topology.regions[cell + 1] !== region,
        bottom: cell < 72 && topology.regions[cell + 9] !== region,
        left: cell % 9 > 0 && topology.regions[cell - 1] !== region,
      })),
    [topology],
  );
  const cellRefs = useMemo(
    () =>
      Array.from(
        { length: 81 },
        (_, cell) => (element: HTMLButtonElement | null) => {
          cells.current[cell] = element;
        },
      ),
    [],
  );
  const select = useCallback(
    (row: number, col: number) => {
      if (!isPaused) onCellClick(row, col);
    },
    [isPaused, onCellClick],
  );
  const selectedIndex = selectedCell
    ? selectedCell[0] * 9 + selectedCell[1]
    : -1;
  const highlighted = useMemo(
    () => new Set(topology.peers[selectedIndex] ?? []),
    [topology, selectedIndex],
  );
  const errors = useMemo(
    () => new Set(errorCells.map(([r, c]) => r * 9 + c)),
    [errorCells],
  );
  const move = (event: KeyboardEvent) => {
    if (isPaused || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    event.stopPropagation();
    const [r, c] = selectedCell ?? [0, 0];
    const nextR = Math.max(
      0,
      Math.min(
        8,
        r + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0),
      ),
    );
    const nextC = Math.max(
      0,
      Math.min(
        8,
        c +
          (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
      ),
    );
    cells.current[nextR * 9 + nextC]?.focus({ preventScroll: true });
  };
  return (
    <div className="sudoku-board-container">
      <div
        role="grid"
        aria-label={
          isDiagonal
            ? 'Diagonal Sudoku board'
            : type === 'Irregular 9x9'
              ? 'Irregular Sudoku board'
              : 'Sudoku board'
        }
        aria-rowcount={9}
        aria-colcount={9}
        aria-hidden={isPaused || undefined}
        inert={isPaused || undefined}
        className="sudoku-board"
        onKeyDown={move}
      >
        {isDiagonal && (
          <svg className="diagonal-guide" aria-hidden="true">
            <line x1="5.55%" y1="5.55%" x2="94.44%" y2="94.44%" />
            <line x1="94.44%" y1="5.55%" x2="5.55%" y2="94.44%" />
          </svg>
        )}
        {board.map((row, r) => (
          <div role="row" key={r} className="sudoku-row">
            {row.map((value, c) => {
              const selected =
                selectedCell?.[0] === r && selectedCell?.[1] === c;
              return (
                <Cell
                  key={c}
                  value={value}
                  row={r}
                  col={c}
                  region={regionMap[r][c]}
                  isDiagonal={isDiagonal}
                  notes={notes[r][c]}
                  isFixed={initialBoard[r][c] !== null}
                  isSelected={selected}
                  isHighlighted={highlighted.has(r * 9 + c)}
                  isError={errors.has(r * 9 + c)}
                  tabIndex={
                    selected || (!selectedCell && r === 0 && c === 0) ? 0 : -1
                  }
                  borders={borders[r * 9 + c]}
                  onSelect={select}
                  cellRef={cellRefs[r * 9 + c]}
                />
              );
            })}
          </div>
        ))}
      </div>
      {isPaused && (
        <div className="board-pause-cover" role="status">
          Paused
        </div>
      )}
    </div>
  );
}
export default memo(SudokuBoard);
