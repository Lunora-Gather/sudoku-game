import { memo, useCallback } from 'react';
interface CellProps {
  value: number | null;
  notes: number[];
  isFixed: boolean;
  isSelected: boolean;
  isError: boolean;
  isHighlighted: boolean;
  row: number;
  col: number;
  region: number;
  isDiagonal: boolean;
  tabIndex: number;
  borders: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  onSelect: (row: number, col: number) => void;
  cellRef: (element: HTMLButtonElement | null) => void;
}
function Cell({
  value,
  notes,
  isFixed,
  isSelected,
  isError,
  isHighlighted,
  borders,
  row,
  col,
  region,
  isDiagonal,
  tabIndex,
  onSelect,
  cellRef,
}: CellProps) {
  const select = useCallback(() => onSelect(row, col), [onSelect, row, col]);
  const classes = [
    'cell',
    isFixed ? 'fixed' : 'user-input',
    isSelected ? 'selected' : isHighlighted ? 'highlighted' : '',
    isError ? 'error' : '',
    ...Object.entries(borders)
      .filter(([, visible]) => visible)
      .map(([side]) => `b-${side}`),
  ]
    .filter(Boolean)
    .join(' ');
  const label = `Row ${row + 1}, column ${col + 1}, ${value === null ? (notes.length ? `notes ${notes.join(', ')}` : 'empty') : value}${isFixed ? ', given' : ''}${isError ? ', conflict' : ''}, region ${region + 1}${isDiagonal && row === col ? ', main diagonal' : ''}${isDiagonal && row + col === 8 ? ', anti-diagonal' : ''}`;
  return (
    <button
      ref={cellRef}
      type="button"
      role="gridcell"
      className={classes}
      tabIndex={tabIndex}
      aria-label={label}
      aria-selected={isSelected}
      aria-readonly={isFixed}
      aria-invalid={isError || undefined}
      aria-rowindex={row + 1}
      aria-colindex={col + 1}
      onClick={select}
      onFocus={select}
    >
      {value !== null ? (
        value
      ) : notes.length > 0 ? (
        <span className="notes-grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="note-number">
              {notes.includes(i + 1) ? i + 1 : ''}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}
export default memo(Cell);
