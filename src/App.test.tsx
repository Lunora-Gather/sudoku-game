import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { requestGame } from './game/generation';
import { SAVE_KEY, saveLibrary } from './game/storage';
import { fixture } from './test/fixtures';
import { GeneratedGame } from './utils/sudoku';
vi.mock('./game/generation', () => ({ requestGame: vi.fn() }));
const request = vi.mocked(requestGame);
const result = (mark = 1): GeneratedGame => {
  const game = fixture('generated', false, mark);
  return {
    puzzle: game.board,
    solution: game.board,
    regionMap: game.regionMap,
  };
};
const cell = (r: number, c: number) =>
  screen.getByRole('gridcell', {
    name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
  });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const click = (name: string | RegExp) => fireEvent.click(button(name));
const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY)!);
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  localStorage.clear();
  request.mockReset();
  request.mockResolvedValue(result());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.useFakeTimers({
    toFake: [
      'Date',
      'performance',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
    ],
  });
  vi.setSystemTime(100000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function mount(games = [fixture()], id = games[0]?.id ?? null) {
  saveLibrary({ sessions: games, activeGameId: id });
  const view = render(<App />);
  await act(async () => {});
  return view;
}

describe('game flow regressions', async () => {
  it('renders an accessible board and preserves elapsed time during frequent input', async () => {
    await mount();
    expect(screen.getByRole('heading', { name: 'Sudoku' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(81);
    fireEvent.click(cell(0, 1));
    for (let i = 0; i < 10; i++) {
      advance(900);
      click(String(i % 2 ? 2 : 3));
    }
    expect(button(/Pause game/)).toHaveTextContent('00:09');
    fireEvent(window, new Event('pagehide'));
    expect(saved().sessions[0].elapsedMs).toBe(9000);
  });
  it('blocks game shortcuts in dialogs and preserves a manual pause when closing menus', async () => {
    await mount();
    fireEvent.click(cell(0, 1));
    click('History');
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    advance(2000);
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button(/Pause game/)).toHaveTextContent('00:00');
    expect(cell(0, 1)).toHaveAccessibleName(/empty/);
    click(/Pause game/);
    click('History');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button(/Resume game/)).toBeInTheDocument();
    advance(2000);
    expect(button(/Resume game/)).toHaveTextContent('00:00');
  });
  it('clears notes and restores them with undo, while givens stay fixed', async () => {
    await mount();
    fireEvent.click(cell(0, 1));
    click('Note Mode');
    click('2');
    click('3');
    expect(cell(0, 1)).toHaveAccessibleName(/notes 2, 3/);
    click('Clear Cell');
    expect(cell(0, 1)).toHaveAccessibleName(/empty/);
    click('Undo');
    expect(cell(0, 1)).toHaveAccessibleName(/notes 2, 3/);
    fireEvent.click(cell(0, 0));
    click('9');
    expect(cell(0, 0)).toHaveAccessibleName(/1, given/);
  });
  it('restores the last active older game after a reload', async () => {
    const view = await mount([fixture('A'), fixture('B', false, 2)]);
    click('History');
    fireEvent.click(document.querySelectorAll('.history-load')[1]);
    fireEvent(window, new Event('pagehide'));
    view.unmount();
    render(<App />);
    await act(async () => {});
    expect(cell(0, 0)).toHaveAccessibleName(/2, given/);
    expect(saved().activeGameId).toBe('B');
  });
  it('deleting the active diagonal game restores and saves the standard rules', async () => {
    await mount([fixture('A', true), fixture('B')]);
    expect(screen.getByRole('grid')).toHaveAccessibleName(
      'Diagonal Sudoku board',
    );
    click('History');
    click('Delete Diagonal 9x9 game');
    click('Delete');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('grid')).toHaveAccessibleName('Sudoku board');
    expect(document.querySelector('.diagonal-guide')).toBeNull();
    fireEvent(window, new Event('pagehide'));
    expect(saved().sessions[0].type).toBe('Standard 9x9');
  });
  it('difficulty selection starts a real new puzzle and retains the old game', async () => {
    await mount();
    request.mockResolvedValue(result(3));
    click('Easy');
    await act(async () => click('Hard'));
    expect(request).toHaveBeenCalledWith(
      'hard',
      'Standard 9x9',
      expect.any(AbortSignal),
    );
    expect(button('Hard')).toBeInTheDocument();
    expect(cell(0, 0)).toHaveAccessibleName(/3, given/);
    fireEvent(window, new Event('pagehide'));
    expect(
      saved().sessions.map((g: { difficulty: string }) => g.difficulty),
    ).toEqual(['hard', 'easy']);
  });
  it('aborts and ignores an older generation result after cancel and retry', async () => {
    const pending: ((value: GeneratedGame) => void)[] = [];
    request.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    await mount();
    click('New Game');
    click('Standard 9x9');
    const firstSignal = request.mock.calls[0][2];
    click('Cancel');
    click('New Game');
    click('Diagonal 9x9');
    await act(async () => pending[1](result(2)));
    await act(async () => pending[0](result(3)));
    expect(firstSignal.aborted).toBe(true);
    expect(cell(0, 0)).toHaveAccessibleName(/2, given/);
    expect(screen.getByRole('grid')).toHaveAccessibleName(
      'Diagonal Sudoku board',
    );
    fireEvent(window, new Event('pagehide'));
    expect(saved().sessions).toHaveLength(2);
  });
  it('StrictMode accepts only one initial result and cleans up superseded requests', async () => {
    const pending: ((value: GeneratedGame) => void)[] = [];
    request.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][2].aborted).toBe(true);
    await act(async () => {
      pending[0](result(3));
      pending[1](result(2));
    });
    fireEvent(window, new Event('pagehide'));
    expect(saved().sessions).toHaveLength(1);
    expect(cell(0, 0)).toHaveAccessibleName(/2, given/);
  });
  it('shows generation failures with an explicit retry instead of looping', async () => {
    request.mockRejectedValueOnce(Error('Search limit reached'));
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Search limit reached');
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => click('Try again'));
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('preserves fractional time across pauses and pauses while the page is hidden', async () => {
    await mount();
    advance(900);
    click(/Pause game/);
    advance(5000);
    click(/Resume game/);
    advance(1000);
    expect(button(/Pause game/)).toHaveTextContent('00:01');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    advance(5000);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    advance(1000);
    fireEvent(window, new Event('pagehide'));
    expect(saved().sessions[0].elapsedMs).toBe(2900);
  });
});
describe('accessibility and persistence boundaries', async () => {
  it('moves keyboard focus with arrow keys and returns focus after a dialog', async () => {
    await mount();
    act(() => cell(0, 0).focus());
    fireEvent.keyDown(cell(0, 0), { key: 'ArrowRight' });
    expect(cell(0, 1)).toHaveFocus();
    const history = button('History');
    act(() => history.focus());
    click('History');
    expect(button('Close History')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(button('Delete Standard 9x9 game')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(history).toHaveFocus();
  });
  it('reports save failures without losing the playable board', async () => {
    await mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded');
    });
    fireEvent.click(cell(0, 1));
    click('2');
    advance(2000);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved/);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
  it('does not overwrite another tab after receiving a storage event', async () => {
    await mount();
    const original = localStorage.getItem(SAVE_KEY);
    fireEvent.click(cell(0, 1));
    click('2');
    fireEvent(
      window,
      new StorageEvent('storage', { key: SAVE_KEY, newValue: 'another tab' }),
    );
    advance(5000);
    expect(screen.getByRole('alert')).toHaveTextContent(/another tab/);
    expect(localStorage.getItem(SAVE_KEY)).toBe(original);
  });
});

it('stops the clock precisely at the winning edit and disables further input', async () => {
  const game = fixture();
  game.board = Array.from({ length: 9 }, (_, r) =>
    Array.from(
      { length: 9 },
      (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1,
    ),
  );
  game.initialBoard = game.board.map((row) => [...row]);
  game.board[0][1] = null;
  game.initialBoard[0][1] = null;
  game.elapsedMs = 1000;
  await mount([game]);
  advance(900);
  fireEvent.click(cell(0, 1));
  click('2');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Congratulations! Solved in 00:01',
  );
  expect(button('3')).toBeDisabled();
  advance(5000);
  fireEvent(window, new Event('pagehide'));
  expect(saved().sessions[0].elapsedMs).toBe(1900);
});

it('blocks a save conflict even when its storage event has not arrived', async () => {
  await mount();
  fireEvent.click(cell(0, 1));
  click('2');
  localStorage.setItem(SAVE_KEY, 'external update');
  advance(2000);
  expect(screen.getByRole('alert')).toHaveTextContent(/another tab/);
  expect(localStorage.getItem(SAVE_KEY)).toBe('external update');
});
it('routes page-level number shortcuts safely through the current committed selection', async () => {
  await mount();
  fireEvent.click(cell(0, 1));
  fireEvent.keyDown(window, { key: '2' });
  expect(cell(0, 1)).toHaveAccessibleName(/2/);
});

it('keeps a second page from overwriting the active writer', async () => {
  const first = await mount();
  const second = render(<App />);
  await act(async () => {});
  const owner = within(first.container),
    other = within(second.container);
  expect(other.getByRole('alert')).toHaveTextContent(/Another tab is saving/);
  fireEvent.click(owner.getByRole('gridcell', { name: /^Row 1, column 2,/ }));
  fireEvent.click(owner.getByRole('button', { name: '2' }));
  fireEvent.click(other.getByRole('gridcell', { name: /^Row 1, column 2,/ }));
  fireEvent.click(other.getByRole('button', { name: '3' }));
  advance(2000);
  expect(
    other.getByRole('gridcell', { name: /^Row 1, column 2,/ }),
  ).toHaveAccessibleName(/3/);
  expect(saved().sessions[0].board[0][1]).toBe(2);
  second.unmount();
  expect(saved().sessions[0].board[0][1]).toBe(2);
});

it('flushes before releasing on pagehide and reacquires on a cached-page restore', async () => {
  await mount();
  advance(900);
  await act(async () =>
    fireEvent(window, new PageTransitionEvent('pagehide', { persisted: true })),
  );
  expect(saved().sessions[0].elapsedMs).toBe(900);
  await act(async () =>
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true })),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(cell(0, 1));
  click('2');
  advance(2000);
  expect(saved().sessions[0].board[0][1]).toBe(2);
});

it('stops saving if a cached page returns after a newer writer changed storage', async () => {
  await mount();
  await act(async () =>
    fireEvent(window, new PageTransitionEvent('pagehide', { persisted: true })),
  );
  const { createSaveRepository } = await import('./game/storage');
  const other = createSaveRepository();
  const library = other.load().library;
  let close = () => {};
  await act(async () => {
    await new Promise<void>((resolve) => {
      close = other.connect((access) => {
        expect(access.kind).toBe('writable');
        resolve();
      });
    });
    library.sessions[0].board[0][1] = 3;
    expect(other.save(library).kind).toBe('saved');
    close();
  });
  await act(async () =>
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true })),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(/changed in another tab/);
  advance(3000);
  expect(saved().sessions[0].board[0][1]).toBe(3);
});

it('keeps progress in memory without unsafe writes when Web Locks is unavailable', async () => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: undefined,
  });
  await mount();
  const original = localStorage.getItem(SAVE_KEY);
  expect(screen.getByRole('alert')).toHaveTextContent(
    /Safe saving is unavailable/,
  );
  fireEvent.click(cell(0, 1));
  click('2');
  advance(3000);
  expect(cell(0, 1)).toHaveAccessibleName(/2/);
  expect(localStorage.getItem(SAVE_KEY)).toBe(original);
});

it('saves the latest committed edits when a delayed lock grant arrives', async () => {
  const manager = navigator.locks;
  let grant!: () => void;
  const gate = new Promise<void>((resolve) => {
    grant = resolve;
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (
        name: string,
        options: LockOptions,
        callback: LockGrantedCallback<unknown>,
      ) => gate.then(() => manager.request(name, options, callback)),
    },
  });
  await mount();
  fireEvent.click(cell(0, 1));
  click('2');
  expect(saved().sessions[0].board[0][1]).toBeNull();
  await act(async () => grant());
  expect(saved().sessions[0].board[0][1]).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
