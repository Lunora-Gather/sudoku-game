import { memo } from 'react';
interface Props {
  onNumberClick: (num: number) => void;
  onClear: () => void;
  onUndo: () => void;
  isNoteMode: boolean;
  onToggleNoteMode: () => void;
  disabled: boolean;
  canUndo: boolean;
}
function Controls({
  onNumberClick,
  onClear,
  onUndo,
  isNoteMode,
  onToggleNoteMode,
  disabled,
  canUndo,
}: Props) {
  return (
    <div className="controls" aria-label="Game controls">
      <div className="number-pad">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            type="button"
            className="num-btn"
            disabled={disabled}
            onClick={() => onNumberClick(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="bottom-actions">
        <button
          type="button"
          className={`bottom-btn btn-note ${isNoteMode ? 'on' : 'off'}`}
          aria-pressed={isNoteMode}
          disabled={disabled}
          onClick={onToggleNoteMode}
        >
          Note Mode
        </button>
        <button
          type="button"
          className="bottom-btn btn-return"
          disabled={disabled || !canUndo}
          onClick={onUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="bottom-btn btn-clear"
          disabled={disabled}
          onClick={onClear}
        >
          Clear Cell
        </button>
      </div>
    </div>
  );
}
export default memo(Controls);
