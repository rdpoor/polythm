import type { AppState } from '../model/types.js';

type Listener = (state: AppState) => void;

export class StateStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor(initial: AppState) {
    this.state = initial;
  }

  getState(): AppState {
    return this.state;
  }

  setState(updater: (prev: AppState) => AppState): void {
    this.state = updater(this.state);
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
