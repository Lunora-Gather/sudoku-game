import React from 'react';
import { Board, Position, RegionMap, CLASSIC_REGION_MAP } from '../utils/sudoku';
import Cell from './Cell';

interface SudokuBoardProps {
  board: Board;
  notes: number[][][];
  initialBoard: Board;
  selectedCell: Position | null;
  errorCells: Position[];
  isPaused: boolean;
  regionMap?: RegionMap;
  isDiagonal?: boolean;
  onCellClick: (row: number, col: number) => void;
}

const SudokuBoard: React.FC<SudokuBoardProps> = ({ 
  board, 
  notes, 
  initialBoard, 
  selectedCell, 
  errorCells, 
  isPaused,
  regionMap = CLASSIC_REGION_MAP,
  isDiagonal = false,
  onCellClick 
}) => {
  const isError = (r: number, c: number) => errorCells.some(([er, ec]) => er === r && ec === c);
  const isSelected = (r: number, c: number) => selectedCell?.[0] === r && selectedCell?.[1] === c;
  
  const isHighlighted = (r: number, c: number) => {
    if (!selectedCell) return false;
    const [sr, sc] = selectedCell;
    if (r === sr || c === sc) return true;
    
    return regionMap[r][c] === regionMap[sr][sc];
  };

  const getBorders = (r: number, c: number) => {
    const regionId = regionMap[r][c];
    return {
      top: r > 0 && regionMap[r - 1][c] !== regionId,
      right: c < 8 && regionMap[r][c + 1] !== regionId,
      bottom: r < 8 && regionMap[r + 1][c] !== regionId,
      left: c > 0 && regionMap[r][c - 1] !== regionId,
    };
  };

  return (
    <div className="sudoku-board-container">
      <div className="sudoku-board">
        {isDiagonal && (
          <svg 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <line 
              x1="5.55%" y1="5.55%" x2="94.44%" y2="94.44%" 
              stroke="var(--diag-color)" 
              strokeWidth="1"
              strokeDasharray="4,4" 
            />
            <line 
              x1="94.44%" y1="5.55%" x2="5.55%" y2="94.44%" 
              stroke="var(--diag-color)" 
              strokeWidth="1"
              strokeDasharray="4,4" 
            />
          </svg>
        )}
        {board.map((row, rowIndex) => 
          row.map((cell, colIndex) => (
            <Cell 
              key={`${rowIndex}-${colIndex}`}
              value={cell}
              notes={notes[rowIndex][colIndex]}
              isFixed={initialBoard[rowIndex][colIndex] !== null}
              isSelected={isSelected(rowIndex, colIndex)}
              isError={isError(rowIndex, colIndex)}
              isHighlighted={isHighlighted(rowIndex, colIndex)}
              borders={getBorders(rowIndex, colIndex)}
              onClick={() => !isPaused && onCellClick(rowIndex, colIndex)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SudokuBoard;
