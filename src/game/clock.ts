import type { ClockCheckpoint } from './model';
/** A monotonic session clock. Time is supplied by the platform adapter, not the domain. */
export class SessionClock {
  private id: string | null = null;
  private elapsed = 0;
  private started: number | null = null;
  constructor(private readonly now: () => number) {}
  read(): ClockCheckpoint {
    return {
      id: this.id,
      elapsedMs:
        this.elapsed +
        (this.started === null ? 0 : Math.max(0, this.now() - this.started)),
    };
  }
  configure(
    id: string | null,
    elapsedMs: number,
    running: boolean,
  ): ClockCheckpoint | null {
    if (this.id === id && (this.started !== null) === (running && id !== null))
      return null;
    const previous = this.read(),
      wasRunning = this.started !== null;
    this.elapsed =
      this.id === id ? Math.max(elapsedMs, previous.elapsedMs) : elapsedMs;
    this.id = id;
    this.started = running && id ? this.now() : null;
    return wasRunning && previous.id ? previous : null;
  }
}
