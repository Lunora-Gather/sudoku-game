import React from 'react';

interface ControlsProps {
  onNumberClick: (num: number) => void;
  onClear: () => void;
  onUndo: () => void;
  isNoteMode: boolean;
  onToggleNoteMode: () => void;
  isPaused: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  onNumberClick, 
  onClear, 
  onUndo,
  isNoteMode,
  onToggleNoteMode,
  isPaused
}) => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="controls">
      <div className="number-pad">
        {numbers.map(num => (
          <button 
            key={num} 
            className={`num-btn ${isPaused ? 'is-paused' : ''}`} 
            onClick={() => onNumberClick(num)}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="bottom-actions">
        <button 
          className={`bottom-btn btn-note ${isNoteMode ? 'on' : 'off'} ${isPaused ? 'is-paused' : ''}`} 
          onClick={() => !isPaused && onToggleNoteMode()}
        >
          Note Mode
        </button>
        <button 
          className={`bottom-btn btn-return ${isPaused ? 'is-paused' : ''}`} 
          onClick={() => !isPaused && onUndo()}
        >
          Return
        </button>
        <button 
          className={`bottom-btn btn-clear ${isPaused ? 'is-paused' : ''}`} 
          onClick={() => !isPaused && onClear()}
        >
          Clear Cell
        </button>
      </div>
    </div>
  );
};

export default Controls;
