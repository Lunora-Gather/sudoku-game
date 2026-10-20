# Modern Sudoku — WJH Edition

A browser Sudoku game with standard, irregular and diagonal boards, notes, undo, dark mode and saved games.

[Play on GitHub Pages](https://lunora-gather.github.io/sudoku-game/)

## Develop

Use Node **24.15+** or **26+**, and Git for publishing. `.nvmrc` selects Node 24.

```sh
npm ci
npm start
```

Open the local `/sudoku-game/` URL printed by Vite. The development and preview servers bind to `127.0.0.1`.

```sh
npm test              # Vitest regression suite
npm run typecheck     # TypeScript
npm run build         # Type check and production build into build/
npm run preview       # Serve that production build locally
npm run format:check  # Check formatting
npm run format        # Format source and documentation
npm run check         # Tests and production build
npm run benchmark     # 450 seeded puzzles and undo record size comparison
```

CI checks formatting, tests and the production build on pushes and pull requests. It does not deploy automatically.

## Play

- Select a cell, then use the number pad or keys **1–9**.
- **N** toggles notes. Notes can be added only to empty editable cells.
- **Backspace/Delete** or **Clear Cell** clears both the digit and its notes.
- **Ctrl/⌘ Z** or **Undo** restores a previous edit, including notes. The latest 200 edits are retained within a game; undo history resets when switching games or refreshing.
- The board has one Tab entry point. Use **arrow keys** to move between cells.
- **Space** pauses or resumes when focus is on the board or page. Focused toolbar buttons retain normal keyboard activation.
- Menus and background tabs pause the timer. Closing a menu preserves an existing manual pause. The paused board hides its digits.
- Menus trap keyboard focus, close with **Escape**, and block game shortcuts.

Changing difficulty starts a **new puzzle of the current type**. The previous game remains in History. New Game starts the selected type at the current difficulty.

Difficulty controls the target number of removed clues: 40, 50 and 60 for easy, medium and hard. Uniqueness and house occupancy constraints may stop removal earlier. These labels are clue targets, not ratings based on human solving techniques.

## Generation and rules

Rows, columns and each nine-cell region must contain unique digits 1–9. Diagonal mode additionally constrains both main diagonals. Errors indicate rule conflicts; they do not reveal whether a nonconflicting move matches the solution. Accessible cell names include region membership and diagonal constraints; these do not add visible page descriptions.

The engine uses bitmasks and minimum-remaining-values backtracking. A removed clue is retained only when the puzzle has exactly one solution. Irregular boards begin with a valid solved board and exchange equal digits between regions while preserving connectivity, region size and the known solution.

All generation runs in a module Web Worker. Searches share a node/time budget, with an additional 20,000-node allowance per attempted clue removal. An inconclusive removal is restored. If the total budget ends during digging, generation can return the last verified unique puzzle once house occupancy constraints hold; otherwise it reports failure. Cancellation always stops generation. The parent terminates the worker after eight seconds, on cancellation, or when superseded. Failures offer an explicit retry. There is no unbounded retry loop or synchronous fallback on the UI thread.

## Saved games

Progress is saved in this browser, on this origin. There is no account or cloud synchronization. Writes are throttled to at most once every two seconds during play, with an immediate save when the page is hidden or left. Timer checkpoints use a monotonic clock and preserve fractional seconds across pauses.

The last active game is restored after refresh. Up to 100 games can be created; at the limit, delete selected history to make room. Existing imported history is not silently pruned. Deletion asks for confirmation.

Old `sudoku_history` saves migrate automatically to the versioned `sudoku_save_v2` format. The old key is retained. Boards, givens, regions and numbers are validated; invalid entries are skipped and notes are sanitized. Sparse boards are rejected, converted legacy timers must remain finite, and timestamps must be valid dates.

Recovery copies use five content-deduplicated slots: `sudoku_save_recovery` and suffixes `_1` through `_4`. Existing copies are never automatically evicted. If these slots are full or a damaged current save cannot be backed up, the original is protected and new edits stay in memory. Earlier UUID-suffixed backups remain untouched. Unsupported newer formats stay in their original key without generating repeated backups. Storage failure displays a notice and permits in-memory play. Avoid clearing browser site data if you want to retain progress.

Only one tab can save at a time, using an exclusive browser Web Lock. Other tabs display a notice and keep edits in memory. Close the saving tab, then reload the tab you want to use; reloading discards that tab's unsaved edits. Leaving a page flushes progress synchronously before releasing ownership. A page restored from the browser cache reacquires ownership and checks its save baseline before writing.

If Web Locks is unavailable or denied, automatic saving is disabled with a notice; in-memory play remains available. Writes also compare the last loaded or written value to detect changes from older tabs or external writers. All current-version tabs participate in the lock; older running versions and external tools do not, so reload older tabs after an upgrade. Conflicting boards are not merged automatically.

The web manifest supplies app metadata. Offline caching is not implemented.

## Publish

```sh
npm run deploy
```

This explicitly builds and publishes to the existing `origin` repository's `gh-pages` branch. Git authentication and a configured Git author identity are required. The Pages source should remain the `gh-pages` branch root. A fresh Pages setup must create that branch and enable Pages first.

The publishing script clones only that branch into a temporary directory, replaces its generated files, makes a normal commit and pushes without force. It leaves the source checkout untouched, skips identical builds, preserves an existing `CNAME` unless the new build supplies one, and cleans up its temporary checkout. The regression test uses only an isolated local bare repository.

Vite's base URL is `/sudoku-game/`. Change `base` in `vite.config.ts` when hosting at another path. The publishing command has no third-party runtime dependencies beyond Node and Git.

## Architecture

[Architecture and extension guide](ARCHITECTURE.md) describes the dependency direction, state transitions, solver, clock, persistence and worker boundary.

- `src/sudoku/`: shared types, immutable compiled constraints, validation, bounded search and generation. `src/utils/sudoku.ts` preserves the earlier import path.
- `src/game/model.ts`, `clock.ts`, `saveCodec.ts`: pure game transitions, injected monotonic clock and versioned save encoding. Undo stores cell deltas and edits share unchanged rows.
- `src/game/storage.ts`: browser storage repository, migration backups and optimistic conflict detection.
- `src/game/generationProtocol.ts`, `generation.ts`, `src/workers/`: runtime-validated worker messages, timeout and cancellation.
- `src/hooks/useGameController.ts`: application workflows. Other hooks adapt keyboard, browser lifecycle, generation, clock and persistence.
- `src/App.tsx`, `src/components/`: screen composition and presentation.
- `scripts/deploy.ts`, `benchmark.mjs`: explicit Git-based publishing and reproducible engine checks.

Tests cover independent solution counting, region connectivity, immutable cached constraints, injected randomness, fixed cells, notes/erase/delta undo, win detection, fractional timer precision, pauses, history restoration, malformed worker messages, cancellation and stale results, StrictMode, storage failure/conflicts, keyboard focus and local publishing.

`npm run benchmark --silent` prints JSON without modifying `build/`. The default is 50 fixed seeds for each of the nine type/difficulty combinations; set `SUDOKU_BENCH_SAMPLES` to change that count. Timings are local measurements, not browser latency guarantees. The undo comparison measures JSON encoding size, not heap memory.
