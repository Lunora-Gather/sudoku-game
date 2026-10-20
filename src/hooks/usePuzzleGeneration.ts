import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty, GameType } from '../sudoku/types';
import type { GeneratedGame } from '../sudoku/generator';
import { requestGame } from '../game/generation';
import { useCommittedRef } from './useCommittedRef';
export interface GenerationSettings {
  difficulty: Difficulty;
  type: GameType;
}
export type GenerationState =
  | { status: 'idle' }
  | { status: 'running'; settings: GenerationSettings }
  | { status: 'failed'; settings: GenerationSettings; error: string };
export function usePuzzleGeneration(
  accept: (data: GeneratedGame, settings: GenerationSettings) => void,
  validate: () => string | null,
) {
  const onResult = useCommittedRef(accept),
    canStart = useCommittedRef(validate);
  const request = useRef({
    sequence: 0,
    controller: null as AbortController | null,
  });
  const [state, setState] = useState<GenerationState>({ status: 'idle' });
  const cancel = useCallback(() => {
    request.current.sequence++;
    request.current.controller?.abort();
    request.current.controller = null;
    setState({ status: 'idle' });
  }, []);
  const start = useCallback(
    async (difficulty: Difficulty, type: GameType) => {
      const current = request.current,
        sequence = ++current.sequence,
        settings = { difficulty, type };
      current.controller?.abort();
      current.controller = null;
      const invalid = canStart.current();
      if (invalid) {
        setState({ status: 'failed', settings, error: invalid });
        return;
      }
      const controller = new AbortController();
      current.controller = controller;
      setState({ status: 'running', settings });
      try {
        const data = await requestGame(difficulty, type, controller.signal);
        if (controller.signal.aborted || current.sequence !== sequence) return;
        onResult.current(data, settings);
        setState({ status: 'idle' });
      } catch (error) {
        if (controller.signal.aborted || current.sequence !== sequence) return;
        setState({
          status: 'failed',
          settings,
          error:
            error instanceof Error
              ? error.message
              : 'Could not create a puzzle. Please try again.',
        });
      } finally {
        if (current.sequence === sequence) current.controller = null;
      }
    },
    [canStart, onResult],
  );
  useEffect(() => {
    const current = request.current;
    return () => {
      current.sequence++;
      current.controller?.abort();
      current.controller = null;
    };
  }, []);
  return { state, start, cancel };
}
