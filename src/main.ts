import type { AppState } from './model/types.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { StateStore } from './state/store.js';
import { App } from './ui/App.js';

const STORAGE_KEY = 'polythm-state';

const defaultState: AppState = {
  settings: { bpm: 90, masterVolume: 0.8 },
  voices: [
    {
      id: 'voice-1',
      sound: 'kick',
      tracks: [
        { ticksPerBeat: 1, amplitude: 0.9, offset: 0 },
        { ticksPerBeat: 2, amplitude: 0.5, offset: 0 },
      ],
    },
    {
      id: 'voice-2',
      sound: 'snare',
      tracks: [
        { ticksPerBeat: 2 / 3, amplitude: 0.7, offset: 0 },
        { ticksPerBeat: 3, amplitude: 0.6, offset: 0 },
      ],
    },
  ],
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { return defaultState; }

    const parsed = JSON.parse(raw) as AppState;

    // Migrate: fill in fields added after the first release so old saved
    // states don't cause crashes or silent misbehaviour.
    for (const voice of parsed.voices) {
      for (const track of voice.tracks) {
        if (track.offset === undefined) { track.offset = 0; }
      }
    }

    return parsed;
  } catch {
    return defaultState;
  }
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — storage may be full or unavailable (e.g. private browsing).
  }
}

const store = new StateStore(loadState());
store.subscribe(saveState);

const engine = new AudioEngine();
const app = new App(store, engine);

const root = document.getElementById('app')!;
app.mount(root);
