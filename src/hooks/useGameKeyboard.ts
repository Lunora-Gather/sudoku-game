import { useEffect } from 'react';
import { useCommittedRef } from './useCommittedRef';
interface KeyboardCommands {
  blocked: boolean;
  canInteract: boolean;
  input: (n: number | null) => void;
  undo: () => void;
  toggleNote: () => void;
  togglePause: () => void;
}
export function useGameKeyboard(commands: KeyboardCommands) {
  const latest = useCommittedRef(commands);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const game = latest.current;
      if (game.blocked || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]'))
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z' &&
        !event.shiftKey
      ) {
        if (game.canInteract) {
          event.preventDefault();
          game.undo();
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space') {
        if (target?.closest('button:not([role="gridcell"])')) return;
        event.preventDefault();
        if (!event.repeat) game.togglePause();
        return;
      }
      if (!game.canInteract) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        game.toggleNote();
      } else if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        game.input(Number(event.key));
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        game.input(null);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [latest]);
}
