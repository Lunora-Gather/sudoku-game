import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Difficulty, GameType, Position } from '../sudoku/types';
import { checkErrors } from '../sudoku/rules';
import {
  MAX_SESSIONS,
  activeSession,
  gameReducer,
  newSession,
  withCheckpoint,
} from '../game/model';
import { createSaveRepository } from '../game/storage';
import { useCommittedRef } from './useCommittedRef';
import { useGameClock } from './useGameClock';
import { usePersistence } from './usePersistence';
import { usePuzzleGeneration } from './usePuzzleGeneration';
import { useGameKeyboard } from './useGameKeyboard';
import { usePageHidden } from './useBrowserPreferences';
export type Dialog =
  | { kind: 'history' | 'difficulty' | 'type' | 'deleteOthers' }
  | { kind: 'delete'; id: string };
/** Application workflows compose pure game transitions with browser services. No JSX lives here. */
export function useGameController() {
  const [{ repository, loaded }] = useState(() => {
    const repository = createSaveRepository();
    return { repository, loaded: repository.load() };
  });
  const [state, dispatch] = useReducer(gameReducer, {
    ...loaded.library,
    undo: [],
  });
  const stateRef = useCommittedRef(state),
    game = activeSession(state);
  const [selectedCell, setSelectedCell] = useState<Position | null>(null),
    [noteMode, setNoteMode] = useState(false),
    [manualPause, setManualPause] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null),
    hidden = usePageHidden();
  const resetSelection = useCallback(() => {
    setSelectedCell(null);
    setNoteMode(false);
  }, []);
  const generation = usePuzzleGeneration(
    useCallback(
      (data, settings) => {
        dispatch({
          type: 'create',
          game: newSession(
            crypto.randomUUID(),
            data.puzzle,
            data.regionMap,
            settings.difficulty,
            settings.type,
            Date.now(),
          ),
        });
        resetSelection();
        setManualPause(false);
      },
      [resetSelection],
    ),
    useCallback(
      () =>
        stateRef.current.sessions.length >= MAX_SESSIONS
          ? 'Your history is full. Delete a saved game before starting another.'
          : null,
      [stateRef],
    ),
  );
  const startNewGame = useCallback(
    (difficulty: Difficulty, type: GameType) => {
      setDialog(null);
      return generation.start(difficulty, type);
    },
    [generation.start],
  );
  const hasGame = game !== null;
  useEffect(() => {
    if (!hasGame) void startNewGame('easy', 'Standard 9x9');
  }, [hasGame, startNewGame]);
  const modalOpen = dialog !== null || generation.state.status !== 'idle';
  const paused = manualPause || modalOpen || hidden,
    canInteract = !!game && game.gameStatus === 'playing' && !paused;
  const tick = useCallback(
    (id: string, elapsedMs: number) =>
      dispatch({ type: 'tick', id, elapsedMs }),
    [],
  );
  const getClock = useGameClock(
    game?.id ?? null,
    game?.elapsedMs ?? 0,
    canInteract,
    tick,
  );
  const readSnapshot = useCallback(
    () => withCheckpoint(stateRef.current, getClock()),
    [getClock, stateRef],
  );
  const persistence = usePersistence(
    state,
    loaded.readOnly,
    repository,
    readSnapshot,
  );
  const errors = useMemo(
    () =>
      game
        ? checkErrors(game.board, game.regionMap, game.type === 'Diagonal 9x9')
        : [],
    [game?.board, game?.regionMap, game?.type],
  );
  const select = useCallback(
    (r: number, c: number) => {
      if (canInteract || (game?.gameStatus === 'won' && !paused))
        setSelectedCell((previous) =>
          previous?.[0] === r && previous[1] === c ? previous : [r, c],
        );
    },
    [canInteract, game?.gameStatus, paused],
  );
  const input = useCallback(
    (value: number | null) => {
      if (canInteract && selectedCell)
        dispatch({
          type: 'input',
          cell: selectedCell,
          value,
          noteMode,
          at: Date.now(),
        });
    },
    [canInteract, selectedCell, noteMode],
  );
  const clear = useCallback(() => input(null), [input]);
  const undo = useCallback(() => {
    if (canInteract) dispatch({ type: 'undo', at: Date.now() });
  }, [canInteract]);
  const toggleNote = useCallback(() => {
    if (canInteract) setNoteMode((value) => !value);
  }, [canInteract]);
  const togglePause = useCallback(() => {
    if (game?.gameStatus === 'playing' && !modalOpen)
      setManualPause((value) => !value);
  }, [game?.gameStatus, modalOpen]);
  useGameKeyboard({
    blocked: modalOpen || hidden,
    canInteract,
    input,
    undo,
    toggleNote,
    togglePause,
  });
  const openDialog = useCallback(
    (next: Dialog) => {
      if (generation.state.status === 'idle') setDialog(next);
    },
    [generation.state.status],
  );
  const closeDialog = useCallback(
    () =>
      setDialog((current) =>
        current?.kind === 'delete' || current?.kind === 'deleteOthers'
          ? { kind: 'history' }
          : null,
      ),
    [],
  );
  const load = useCallback(
    (id: string) => {
      dispatch({ type: 'load', id, at: Date.now() });
      resetSelection();
      setManualPause(false);
      setDialog(null);
    },
    [resetSelection],
  );
  const deleteGame = useCallback(
    (id: string) => {
      dispatch({ type: 'delete', id });
      if (id === stateRef.current.activeGameId) resetSelection();
      setDialog(
        stateRef.current.sessions.length === 1 ? null : { kind: 'history' },
      );
    },
    [resetSelection, stateRef],
  );
  const deleteOthers = useCallback(() => {
    dispatch({ type: 'deleteOthers' });
    setDialog({ kind: 'history' });
  }, []);
  const conflict = persistence.kind === 'conflict';
  const warning = conflict
    ? persistence.reason === 'writer'
      ? 'Another tab is saving. Close it, then reload here. Edits here are unsaved.'
      : 'Saved games changed in another tab. Reload this tab to resume saving; current changes are kept only here.'
    : persistence.kind === 'error'
      ? persistence.message
      : loaded.warning;
  return {
    state,
    game,
    selectedCell,
    noteMode,
    manualPause,
    dialog,
    generation: generation.state,
    cancelGeneration: generation.cancel,
    startNewGame,
    modalOpen,
    paused,
    canInteract,
    errors,
    select,
    input,
    clear,
    undo,
    toggleNote,
    togglePause,
    openDialog,
    closeDialog,
    load,
    deleteGame,
    deleteOthers,
    conflict,
    warning,
  };
}
export type GameController = ReturnType<typeof useGameController>;
