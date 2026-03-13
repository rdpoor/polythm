import type { AppState } from './model/types.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { StateStore } from './state/store.js';
import { App } from './ui/App.js';

const initialState: AppState = {
  settings: { bpm: 90, masterVolume: 0.8 },
  voices: [
    {
      id: 'voice-1',
      tracks: [
        { sound: 'kick', ticksPerBeat: 1, amplitude: 0.9 },
        { sound: 'hihat', ticksPerBeat: 2, amplitude: 0.5 },
      ],
    },
    {
      id: 'voice-2',
      tracks: [
        { sound: 'snare', ticksPerBeat: 2 / 3, amplitude: 0.7 },
        { sound: 'click', ticksPerBeat: 3, amplitude: 0.6 },
      ],
    },
  ],
};

const store = new StateStore(initialState);
const engine = new AudioEngine();
const app = new App(store, engine);

const root = document.getElementById('app')!;
app.mount(root);
