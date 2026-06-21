# Modern Sudoku (WJH Edition)

A high-performance, professional-grade Sudoku experience built with React 19 and TypeScript. Engineered for stability, visual elegance, and ultra-smooth gameplay.

**[🎮 Play Now on GitHub Pages](https://lunora-gather.github.io/sudoku-game)**

---

## 🎮 Player's Guide

### Controls & Shortcuts
- **Fill Numbers**: Click a cell and use the keypad below, or press keys **1-9**.
- **Note Mode**: Toggle with the **N** key to jot down candidates in a 3x3 sub-grid.
- **Undo (Return)**: Press **Ctrl + Z** to step back through your history with satisfying physical feedback.
- **Erase**: Use **Backspace** or **Delete** to clear the current cell.
- **Pause/Resume**: Hit **Space** to quickly pause your game.

### Smart Game Management
- **Intelligent Auto-Pause**: The timer automatically stops whenever you open a menu (Difficulty, History, or New Game) and resumes instantly when you return to the board.
- **Dark Mode**: Toggle the vibrant yellow moon icon next to the `WJH` signature. Includes a specialized eye-care loading overlay for nighttime sessions.
- **History Management**: Your progress is auto-saved. Access **History** to resume any previous session. Use **Delete others** to keep your archive clean (requires confirmation).

---

## 🌟 Game Variants

- **Standard 9x9**: The classic logic puzzle experience.
- **Irregular 9x9**: Features procedurally generated "Jigsaw" regions that change every single time you play.
  - *Note: Due to the complexity of connectivity calculations, generation may occasionally take longer. If the loading animation persists, simply refresh or restart to try a new procedural path.*
- **Diagonal 9x9 (Sudoku X)**: Adds the challenge of non-repeating digits across both main diagonals, marked by subtle SVG visual guides.

---

## 🚀 Technical Highlights

- **Asynchronous Chunking**: Employs non-blocking calculation cycles. Even during intensive puzzle generation, the UI maintains a consistent 60FPS, preventing browser "hangs" or unresponsiveness.
- **Bitmask Solver Engine**: Powered by a 9-bit binary masking system combined with MRV (Minimum Remaining Values) heuristics for millisecond-level solution verification.
- **Constraint-Aware Generation**: Strictly enforces a 1-7 digit occupancy rule per row, column, and region to ensure balanced difficulty and elegant number distribution.

---

## 🛠️ Full Technical Stack

- **Framework**: **React 19 (Hooks)** - Utilizing a high-performance state synchronization flow with `useCallback` and `useEffect` optimization.
- **Typing**: **TypeScript** - Strict type-safety ensuring logical consistency across complex Sudoku rules and UI states.
- **Layout**: **Vanilla CSS Grid** - Zero-runtime-overhead grid systems for pixel-perfect alignment and responsive mobile scaling.
- **Visuals**: **SVG Dynamic Rendering** - Real-time calculation of diagonal paths and vector guides.
- **Persistence**: **LocalStorage DB** - A lightweight local persistence layer for cross-session game state and history tracking.

---
Developed by **WJH**
