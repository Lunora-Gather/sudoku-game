import { generateGame } from '../sudoku/generator';
import {
  GENERATION_PROTOCOL,
  isGenerationRequest,
  type GenerationResponse,
} from '../game/generationProtocol';
self.onmessage = async (event: MessageEvent<unknown>) => {
  if (!isGenerationRequest(event.data)) return;
  const request = event.data;
  let response: GenerationResponse;
  try {
    response = {
      version: GENERATION_PROTOCOL,
      id: request.id,
      kind: 'success',
      data: await generateGame(request.difficulty, request.type),
    };
  } catch (error) {
    response = {
      version: GENERATION_PROTOCOL,
      id: request.id,
      kind: 'error',
      error:
        error instanceof Error
          ? error.message
          : 'Puzzle generation failed. Please try again.',
    };
  }
  self.postMessage(response);
};
