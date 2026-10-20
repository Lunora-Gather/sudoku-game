import { useEffect, useState } from 'react';
import { readDarkMode } from '../game/storage';
export function useDarkMode() {
  const [dark, setDark] = useState(readDarkMode);
  useEffect(() => {
    document.body.classList.toggle('dark-mode', dark);
    try {
      localStorage.setItem('sudoku_darkmode', String(dark));
    } catch {
      /* Appearance works without storage. */
    }
    return () => document.body.classList.remove('dark-mode');
  }, [dark]);
  return { dark, toggleDark: () => setDark((value) => !value) };
}
export function usePageHidden() {
  const [hidden, setHidden] = useState(document.visibilityState === 'hidden');
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}
