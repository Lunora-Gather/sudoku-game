import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGame } from './generation';
import { solution } from '../test/fixtures';
import { CLASSIC_REGION_MAP } from '../sudoku/board';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('worker lifecycle', () => {
  it('terminates timed-out computation and removes its timer', async () => {
    const task = requestGame(
      'easy',
      'Irregular 9x9',
      new AbortController().signal,
    );
    const check = expect(task).rejects.toThrow(/too long/);
    await vi.advanceTimersByTimeAsync(8000);
    await check;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('terminates immediately on cancellation and never starts an already cancelled task', async () => {
    const controller = new AbortController(),
      task = requestGame('easy', 'Standard 9x9', controller.signal);
    controller.abort();
    await expect(task).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      requestGame('easy', 'Standard 9x9', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.instances).toHaveLength(1);
  });
  it('cleans up successful results and worker errors', async () => {
    const data = { puzzle: solution, solution, regionMap: CLASSIC_REGION_MAP },
      task = requestGame('easy', 'Standard 9x9', new AbortController().signal);
    FakeWorker.instances[0].onmessage?.({
      data: {
        version: 1,
        id: FakeWorker.instances[0].postMessage.mock.calls[0][0].id,
        kind: 'success',
        data,
      },
    } as MessageEvent);
    await expect(task).resolves.toEqual(data);
    expect(vi.getTimerCount()).toBe(0);
    const failed = requestGame(
      'easy',
      'Standard 9x9',
      new AbortController().signal,
    );
    FakeWorker.instances[1].onerror?.();
    await expect(failed).rejects.toThrow(/failed/);
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });
});

it.each([null, {}, { version: 9, id: 1, kind: 'success' }])(
  'rejects malformed responses immediately and cleans up: %j',
  async (message) => {
    const task = requestGame(
      'easy',
      'Standard 9x9',
      new AbortController().signal,
    );
    FakeWorker.instances[0].onmessage?.({ data: message } as MessageEvent);
    await expect(task).rejects.toThrow(/could not be read/);
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  },
);
it('rejects a board inconsistent with its supplied solution', async () => {
  const task = requestGame(
      'easy',
      'Standard 9x9',
      new AbortController().signal,
    ),
    worker = FakeWorker.instances[0];
  const board = solution.map((row) => [...row]);
  board[0][0] = 9;
  worker.onmessage?.({
    data: {
      version: 1,
      id: worker.postMessage.mock.calls[0][0].id,
      kind: 'success',
      data: { puzzle: board, solution, regionMap: CLASSIC_REGION_MAP },
    },
  } as MessageEvent);
  await expect(task).rejects.toThrow(/could not be read/);
});

it.each(['puzzle', 'solution'] as const)(
  'rejects sparse %s data from a worker and cleans up',
  async (field) => {
    const task = requestGame(
      'easy',
      'Standard 9x9',
      new AbortController().signal,
    );
    const worker = FakeWorker.instances[0];
    const sparse = solution.map((row) => [...row]);
    Reflect.deleteProperty(sparse[4], 4);
    worker.onmessage?.({
      data: {
        version: 1,
        id: worker.postMessage.mock.calls[0][0].id,
        kind: 'success',
        data: {
          puzzle: solution,
          solution,
          regionMap: CLASSIC_REGION_MAP,
          [field]: sparse,
        },
      },
    } as MessageEvent);
    await expect(task).rejects.toThrow(/could not be read/);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  },
);
