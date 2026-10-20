import { useLayoutEffect, useRef } from 'react';
/** Event callbacks see committed React state, never data from an abandoned render. */
export function useCommittedRef<T>(value: T) {
  const reference = useRef(value);
  useLayoutEffect(() => {
    reference.current = value;
  }, [value]);
  return reference;
}
