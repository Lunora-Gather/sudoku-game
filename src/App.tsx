import './styles/Sudoku.css';
import SudokuBoard from './components/SudokuBoard';
import Controls from './components/Controls';
import GameDialogs from './components/GameDialogs';
import { CLASSIC_REGION_MAP, createEmptyBoard } from './sudoku/board';
import { emptyNotes, formatTime } from './game/model';
import { useGameController } from './hooks/useGameController';
import { useDarkMode } from './hooks/useBrowserPreferences';
const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);
const blankBoard = createEmptyBoard(),
  blankNotes = emptyNotes();
export default function App() {
  const controller = useGameController();
  const {
    state,
    game,
    modalOpen,
    warning,
    conflict,
    openDialog,
    paused,
    manualPause,
    togglePause,
    selectedCell,
    errors,
    select,
    input,
    clear,
    undo,
    noteMode,
    toggleNote,
    canInteract,
  } = controller;
  const { dark, toggleDark } = useDarkMode();
  return (
    <>
      <main className="app-container" inert={modalOpen || undefined}>
        <header className="header">
          <h1>Sudoku</h1>
          <div className="signature-wrap">
            <div className="signature">WJH</div>
            <button
              type="button"
              className="dark-mode-toggle"
              title="Toggle Dark Mode"
              aria-label="Dark mode"
              aria-pressed={dark}
              onClick={toggleDark}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </header>
        {warning && (
          <div className="notice" role="alert">
            {warning}
            {conflict && (
              <button type="button" onClick={() => location.reload()}>
                Reload saved games
              </button>
            )}
          </div>
        )}
        <div className="top-controls">
          <button
            type="button"
            className="top-btn"
            onClick={() => openDialog({ kind: 'difficulty' })}
            disabled={!game}
          >
            {capitalize(game?.difficulty ?? 'easy')}
          </button>
          <button
            type="button"
            className="top-btn"
            onClick={() => openDialog({ kind: 'history' })}
          >
            History
          </button>
          <button
            type="button"
            className={`top-btn btn-timer ${paused ? 'paused' : ''}`}
            aria-label={`${manualPause ? 'Resume' : 'Pause'} game, ${formatTime(game?.elapsedMs ?? 0)}`}
            disabled={!game || game.gameStatus === 'won'}
            onClick={togglePause}
          >
            {formatTime(game?.elapsedMs ?? 0)}
          </button>
          <button
            type="button"
            className="top-btn"
            onClick={() => openDialog({ kind: 'type' })}
          >
            New Game
          </button>
        </div>
        <SudokuBoard
          board={game?.board ?? blankBoard}
          notes={game?.notes ?? blankNotes}
          initialBoard={game?.initialBoard ?? blankBoard}
          selectedCell={selectedCell}
          errorCells={errors}
          isPaused={paused || !game}
          regionMap={game?.regionMap ?? CLASSIC_REGION_MAP}
          type={game?.type ?? 'Standard 9x9'}
          onCellClick={select}
        />
        <Controls
          onNumberClick={input}
          onClear={clear}
          onUndo={undo}
          isNoteMode={noteMode}
          onToggleNoteMode={toggleNote}
          disabled={!canInteract}
          canUndo={state.undo.length > 0}
        />
        {game?.gameStatus === 'won' && (
          <p className="win-message" role="status">
            Congratulations! Solved in {formatTime(game.elapsedMs)}.
          </p>
        )}
      </main>
      <GameDialogs controller={controller} />
    </>
  );
}
