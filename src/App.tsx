import React, { useState, useEffect, useCallback } from 'react';
import './styles/Sudoku.css';
import SudokuBoard from './components/SudokuBoard';
import Controls from './components/Controls';
import { Board, Position, RegionMap, generatePuzzle, checkErrors, EMPTY_BOARD, CLASSIC_REGION_MAP, generateRandomRegionMap } from './utils/sudoku';

type Difficulty = 'easy' | 'medium' | 'hard';

interface HistoryState {
  board: Board;
  notes: number[][][];
}

interface GameSession {
  id: string;
  board: Board;
  initialBoard: Board;
  notes: number[][][];
  difficulty: Difficulty;
  type: string;
  isDiagonal?: boolean;
  regionMap: RegionMap;
  timer: number;
  lastPlayed: number;
  createdAt: number;
  gameStatus: 'playing' | 'won';
}

const INITIAL_NOTES: number[][][] = Array(9).fill(null).map(() => Array(9).fill(null).map(() => []));

function App() {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [initialBoard, setInitialBoard] = useState<Board>(EMPTY_BOARD);
  const [regionMap, setRegionMap] = useState<RegionMap>(CLASSIC_REGION_MAP);
  const [notes, setNotes] = useState<number[][][]>(INITIAL_NOTES);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [timer, setTimer] = useState(0);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won'>('playing');
  const [errorCells, setErrorCells] = useState<Position[]>([]);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [isDiagonal, setIsDiagonal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('sudoku_darkmode') === 'true');
  
  // Apply Dark Mode class to body
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('sudoku_darkmode', isDarkMode.toString());
  }, [isDarkMode]);
  
  // Multi-session history with localStorage
  const [gameHistory, setGameHistory] = useState<GameSession[]>(() => {
    const saved = localStorage.getItem('sudoku_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Modals
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteOthersConfirm, setShowDeleteOthersConfirm] = useState(false);

  // Save to localStorage whenever history changes
  useEffect(() => {
    localStorage.setItem('sudoku_history', JSON.stringify(gameHistory));
  }, [gameHistory]);

  const startNewGame = useCallback((diff: Difficulty, type: string = 'Standard 9x9') => {
    const isClassic = type === 'Standard 9x9';
    const isDiag = type === 'Diagonal 9x9';
    
    const runGeneration = async () => {
      let currentRegionMap = CLASSIC_REGION_MAP;
      if (type === 'Irregular 9x9') {
        currentRegionMap = generateRandomRegionMap();
      }
      
      const startTime = Date.now();
      const generationTimeout = 11000;
      
      try {
        // Use await as generatePuzzle is now async and non-blocking
        const { puzzle } = await generatePuzzle(diff, currentRegionMap, isDiag);
        
        if (Date.now() - startTime > generationTimeout) {
          console.warn("Generation timed out, retrying...");
          setTimeout(runGeneration, 10);
          return;
        }

        const newId = Date.now().toString();
      const newBoard = puzzle.map(row => [...row]);
      const newInitial = puzzle.map(row => [...row]);
      const newNotes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => []));

      setBoard(newBoard);
      setInitialBoard(newInitial);
      setRegionMap(currentRegionMap);
      setIsDiagonal(isDiag);
      setNotes(newNotes);
      setHistory([]);
      setSelectedCell(null);
      setTimer(0);
      setDifficulty(diff);
      setGameStatus('playing');
      setErrorCells([]);
      setIsNoteMode(false);
      setIsPaused(false);
      setIsGenerating(false);
      
      const newSession: GameSession = {
        id: newId,
        board: newBoard,
        initialBoard: newInitial,
        notes: newNotes,
        difficulty: diff,
        type: type,
        isDiagonal: isDiag,
        regionMap: currentRegionMap,
        timer: 0,
        lastPlayed: Date.now(),
        createdAt: Date.now(),
        gameStatus: 'playing'
      };
      setGameHistory(prev => [newSession, ...prev]);
      setActiveGameId(newId);
      } catch (err) {
        console.error("Generation failed:", err);
        setTimeout(runGeneration, 10);
      }
    };

    if (isClassic || isDiag) {
      // For classic or diagonal mode, try to run instantly
      setShowTypeModal(false);
      setShowDiffModal(false);
      runGeneration();
    } else {
      // For irregular mode, show loading screen
      setIsPaused(true);
      setIsGenerating(true);
      setShowTypeModal(false);
      setShowDiffModal(false);
      setTimeout(runGeneration, 50);
    }
  }, []);

  // Sync current game to history sessions
  useEffect(() => {
    if (!activeGameId) return;
    setGameHistory(prev => prev.map(game => 
      game.id === activeGameId 
        ? { ...game, board, notes, timer, lastPlayed: Date.now(), gameStatus, isDiagonal } 
        : game
    ));
    // Remove the early return so 'won' status actually gets saved
  }, [board, notes, timer, activeGameId, gameStatus, isDiagonal]);

  // Initial load: either resume last game or start new
  useEffect(() => {
    if (gameHistory.length > 0 && !activeGameId) {
      const lastGame = gameHistory[0];
      setBoard(lastGame.board);
      setInitialBoard(lastGame.initialBoard);
      setRegionMap(lastGame.regionMap || CLASSIC_REGION_MAP);
      setIsDiagonal(!!lastGame.isDiagonal);
      setNotes(lastGame.notes);
      setDifficulty(lastGame.difficulty);
      setTimer(lastGame.timer);
      setGameStatus(lastGame.gameStatus);
      setActiveGameId(lastGame.id);
    } else if (gameHistory.length === 0) {
      startNewGame('easy', 'Standard 9x9');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Combined Game Status and Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameStatus === 'playing' && !isPaused) {
      // 1. Timer
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);

      // 2. Win Check & Error Sync
      const isFull = board.every(row => row.every(cell => cell !== null));
      const errors = checkErrors(board, regionMap, isDiagonal);
      setErrorCells(errors);

      if (isFull && errors.length === 0) {
        setGameStatus('won');
        alert(`Congratulations! You solved it in ${formatTime(timer)}!`);
      }
    }

    return () => clearInterval(interval);
  }, [board, regionMap, gameStatus, isPaused, timer, isDiagonal]); // Added timer dependency for alert consistency

  const handleCellClick = (row: number, col: number) => {
    if (isPaused) return;
    setSelectedCell([row, col]);
  };

  const saveToHistory = () => {
    const currentState: HistoryState = {
      board: board.map(row => [...row]),
      notes: notes.map(row => row.map(cell => [...cell]))
    };
    setHistory(prev => [...prev, currentState]);
  };

  const handleUndo = useCallback(() => {
    if (history.length === 0 || gameStatus === 'won' || isPaused) return;
    const previousState = history[history.length - 1];
    setBoard(previousState.board);
    setNotes(previousState.notes);
    setHistory(prev => prev.slice(0, -1));
  }, [history, gameStatus, isPaused]);

  const handleNumberInput = (num: number | null) => {
    if (!selectedCell || gameStatus === 'won' || isPaused) return;
    const [row, col] = selectedCell;
    if (initialBoard[row][col] !== null) return;

    saveToHistory();

    if (isNoteMode && num !== null) {
      const newNotes = [...notes.map(r => r.map(c => [...c]))];
      const cellNotes = newNotes[row][col];
      if (cellNotes.includes(num)) {
        newNotes[row][col] = cellNotes.filter(n => n !== num);
      } else {
        newNotes[row][col] = [...cellNotes, num].sort();
      }
      setNotes(newNotes);
    } else {
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = num;
      setBoard(newBoard);
      if (num !== null) {
        const newNotes = [...notes.map(r => r.map(c => [...c]))];
        newNotes[row][col] = [];
        setNotes(newNotes);
      }
    }
  };

  const togglePause = useCallback(() => {
    if (gameStatus === 'won') return;
    setIsPaused(prev => !prev);
  }, [gameStatus]);

  const openHistory = () => {
    setIsPaused(true);
    setShowHistoryModal(true);
  };

  const openDiffModal = () => {
    setIsPaused(true);
    setShowDiffModal(true);
  };

  const openTypeModal = () => {
    setIsPaused(true);
    setShowTypeModal(true);
  };

  const loadGame = (session: GameSession) => {
    setBoard(session.board);
    setInitialBoard(session.initialBoard);
    setRegionMap(session.regionMap || CLASSIC_REGION_MAP);
    setIsDiagonal(!!session.isDiagonal);
    setNotes(session.notes);
    setDifficulty(session.difficulty);
    setTimer(session.timer);
    setGameStatus(session.gameStatus);
    setActiveGameId(session.id);
    setHistory([]);
    setIsPaused(false); // Resume timer
    setShowHistoryModal(false);
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const executeDelete = () => {
    if (!deleteId) return;
    const updatedHistory = gameHistory.filter(g => g.id !== deleteId);
    setGameHistory(updatedHistory);
    
    // If we delete the active game, pick the next available one as active
    if (activeGameId === deleteId) {
      if (updatedHistory.length > 0) {
        const nextGame = updatedHistory[0];
        setBoard(nextGame.board);
        setInitialBoard(nextGame.initialBoard);
        setRegionMap(nextGame.regionMap || CLASSIC_REGION_MAP);
        setNotes(nextGame.notes);
        setDifficulty(nextGame.difficulty);
        setTimer(nextGame.timer);
        setGameStatus(nextGame.gameStatus);
        setActiveGameId(nextGame.id);
        setHistory([]);
      } else {
        startNewGame('easy', 'Standard 9x9');
      }
    }
    setDeleteId(null);
  };

  const executeDeleteOthers = () => {
    if (!activeGameId) return;
    const activeGame = gameHistory.find(g => g.id === activeGameId);
    if (activeGame) {
      setGameHistory([activeGame]);
    }
    setShowDeleteOthersConfirm(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (isPaused) return;
      if (e.key.toLowerCase() === 'n') {
        setIsNoteMode(prev => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (!selectedCell || gameStatus === 'won') return;
      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleNumberInput(null);
      } else if (e.key.startsWith('Arrow')) {
        const [r, c] = selectedCell;
        if (e.key === 'ArrowUp' && r > 0) setSelectedCell([r - 1, c]);
        if (e.key === 'ArrowDown' && r < 8) setSelectedCell([r + 1, c]);
        if (e.key === 'ArrowLeft' && c > 0) setSelectedCell([r, c - 1]);
        if (e.key === 'ArrowRight' && c < 8) setSelectedCell([r, c + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, board, initialBoard, gameStatus, isNoteMode, notes, handleUndo, togglePause, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="app-container">
      <header className="header" style={{ position: 'relative' }}>
        <h1>Sudoku</h1>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div className="signature">WJH & WZX</div>
          <button 
            className="dark-mode-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </header>

      <div className="top-controls">
        <button 
          className="top-btn" 
          onClick={openDiffModal}
        >
          {capitalize(difficulty)}
        </button>
        <button 
          className="top-btn btn-history" 
          onClick={openHistory}
        >
          History
        </button>
        <button 
          className={`top-btn btn-timer ${isPaused ? 'paused' : ''}`} 
          onClick={togglePause}
        >
          {formatTime(timer)}
        </button>
        <button 
          className="top-btn" 
          onClick={openTypeModal}
        >
          New Game
        </button>
      </div>

      <SudokuBoard 
        board={board}
        notes={notes}
        initialBoard={initialBoard}
        selectedCell={selectedCell}
        errorCells={errorCells}
        isPaused={isPaused}
        regionMap={regionMap}
        isDiagonal={isDiagonal}
        onCellClick={handleCellClick}
      />

      <Controls 
        onNumberClick={handleNumberInput}
        onClear={() => handleNumberInput(null)}
        onUndo={handleUndo}
        isNoteMode={isNoteMode}
        onToggleNoteMode={() => setIsNoteMode(!isNoteMode)}
        isPaused={isPaused}
      />
      
      {gameStatus === 'won' && (
        <div style={{marginTop: '20px', color: '#2ecc71', fontWeight: 'bold'}}>
          Congratulations! You've solved the puzzle!
        </div>
      )}

      {isGenerating && (
        <div className="modal-overlay" style={{background: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)', zIndex: 2000}}>
          <div className="modal-content" style={{boxShadow: 'none', background: 'transparent'}}>
            <div className="loading-spinner"></div>
            <p style={{marginTop: '15px', fontWeight: 'bold', color: 'var(--accent-color)'}}>Generating Puzzle...</p>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => { setIsPaused(false); setShowHistoryModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>History</h3>
              <button 
                onClick={() => setShowDeleteOthersConfirm(true)}
                style={{
                  position: 'absolute',
                  right: '0',
                  backgroundColor: '#ffebee',
                  color: '#e74c3c',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Delete others
              </button>
            </div>
            <div className="history-list">
              {gameHistory.length === 0 ? <p>No history yet</p> : 
                [...gameHistory]
                .sort((a, b) => {
                  if (a.id === activeGameId) return -1;
                  if (b.id === activeGameId) return 1;
                  return (b.createdAt || b.lastPlayed) - (a.createdAt || a.lastPlayed);
                })
                .map(game => (
                <div key={game.id} className={`history-item ${activeGameId === game.id ? 'active' : ''}`} onClick={() => loadGame(game)}>
                  <div className="history-info">
                    <div className="history-main-row">
                      <span className="history-type">{game.type || 'Standard 9x9'}</span>
                      <span className="history-diff">{capitalize(game.difficulty)}</span>
                      <span className={`history-status ${game.gameStatus === 'won' ? 'completed' : 'uncompleted'}`}>
                        {game.gameStatus === 'won' ? 'Completed' : 'Uncompleted'}
                      </span>
                    </div>
                    <span className="history-time">{formatTime(game.timer)} - {new Date(game.createdAt || game.lastPlayed).toLocaleDateString()} {new Date(game.createdAt || game.lastPlayed).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <button className="trash-btn" onClick={(e) => confirmDelete(e, game.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Record?</h3>
            <p style={{marginBottom: '25px', color: '#666', fontSize: '0.9rem'}}>Are you sure you want to remove this game history?</p>
            <div className="confirm-footer">
              <button className="confirm-btn cancel" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="confirm-btn confirm" onClick={executeDelete}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty Selector Modal */}
      {showDiffModal && (
        <div className="modal-overlay" onClick={() => { setIsPaused(false); setShowDiffModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Difficulty</h3>
            <button className="modal-btn" onClick={() => { setDifficulty('easy'); setIsPaused(false); setShowDiffModal(false); }}>Easy</button>
            <button className="modal-btn" onClick={() => { setDifficulty('medium'); setIsPaused(false); setShowDiffModal(false); }}>Medium</button>
            <button className="modal-btn" onClick={() => { setDifficulty('hard'); setIsPaused(false); setShowDiffModal(false); }}>Hard</button>
          </div>
        </div>
      )}

      {/* Game Type Modal */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={() => { setIsPaused(false); setShowTypeModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Game Type</h3>
            <button className="modal-btn" onClick={() => startNewGame(difficulty, 'Standard 9x9')}>Standard 9x9</button>
            <button className="modal-btn" onClick={() => startNewGame(difficulty, 'Irregular 9x9')}>Irregular 9x9</button>
            <button className="modal-btn" onClick={() => startNewGame(difficulty, 'Diagonal 9x9')}>Diagonal 9x9</button>
            <p style={{fontSize: '0.8rem', color: '#888'}}>More types coming soon...</p>
          </div>
        </div>
      )}
      {/* Delete Others Confirmation Modal */}
      {showDeleteOthersConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteOthersConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Others?</h3>
            <p style={{marginBottom: '25px', color: '#666', fontSize: '0.9rem'}}>Are you sure you want to remove all history except the current game?</p>
            <div className="confirm-footer">
              <button className="confirm-btn cancel" onClick={() => setShowDeleteOthersConfirm(false)}>Cancel</button>
              <button className="confirm-btn confirm" onClick={executeDeleteOthers}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
