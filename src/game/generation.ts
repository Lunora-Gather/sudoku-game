import type { Difficulty, GameType } from '../sudoku/types';
import type { GeneratedGame } from '../sudoku/generator';
import {
  GENERATION_PROTOCOL,
  GENERATION_TIMEOUT_MS,
  decodeGenerationResponse,
  type GenerationRequest,
} from './generationProtocol';
let sequence = 0;
export function requestGame(
  difficulty: Difficulty,
  type: GameType,
  signal: AbortSignal,
): Promise<GeneratedGame> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Generation cancelled', 'AbortError'));
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../workers/generation.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch {
      reject(
        new Error(
          'Background puzzle generation is unavailable in this browser.',
        ),
      );
      return;
    }
    const request: GenerationRequest = {
      version: GENERATION_PROTOCOL,
      id: ++sequence,
      difficulty,
      type,
    };
    let settled = false;
    const finish = (error?: Error, data?: GeneratedGame) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      if (error) reject(error);
      else resolve(data!);
    };
    const abort = () =>
      finish(new DOMException('Generation cancelled', 'AbortError'));
    const timeout = setTimeout(
      () => finish(new Error('Generation took too long. Please try again.')),
      GENERATION_TIMEOUT_MS,
    );
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = decodeGenerationResponse(event.data, request);
      if (!message)
        finish(
          new Error(
            'The generated puzzle could not be read. Please try again.',
          ),
        );
      else if (message.kind === 'success') finish(undefined, message.data);
      else finish(new Error(message.error));
    };
    worker.onerror = () =>
      finish(new Error('Puzzle generation failed. Please try again.'));
    worker.onmessageerror = () =>
      finish(
        new Error('The generated puzzle could not be read. Please try again.'),
      );
    try {
      worker.postMessage(request);
    } catch {
      finish(new Error('Puzzle generation could not start. Please try again.'));
    }
  });
}
