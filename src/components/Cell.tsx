import React from 'react';

interface CellProps {
  value: number | null;
  notes: number[];
  isFixed: boolean;
  isSelected: boolean;
  isError: boolean;
  isHighlighted: boolean;
  borders: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  onClick: () => void;
}

const Cell: React.FC<CellProps> = ({ value, notes, isFixed, isSelected, isError, isHighlighted, borders, onClick }) => {
  const getClassName = () => {
    let classes = ['cell'];
    if (isFixed) classes.push('fixed');
    else classes.push('user-input');
    if (isSelected) classes.push('selected');
    if (isError) classes.push('error');
    if (isHighlighted && !isSelected) classes.push('highlighted');
    
    if (borders.top) classes.push('b-top');
    if (borders.right) classes.push('b-right');
    if (borders.bottom) classes.push('b-bottom');
    if (borders.left) classes.push('b-left');
    
    return classes.join(' ');
  };

  const renderNotes = () => {
    const noteGrid = [];
    for (let i = 1; i <= 9; i++) {
      noteGrid.push(
        <div key={i} className="note-number">
          {notes.includes(i) ? i : ''}
        </div>
      );
    }
    return <div className="notes-grid">{noteGrid}</div>;
  };

  return (
    <div className={getClassName()} onClick={onClick}>
      {value !== null ? value : renderNotes()}
    </div>
  );
};

export default Cell;
