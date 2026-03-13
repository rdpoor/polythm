/** A single rhythmic layer within a voice. */
export interface Track {
  /** Sound type to synthesize on each hit. */
  sound: 'kick' | 'snare' | 'hihat' | 'click';
  /** Number of evenly-spaced hits per beat. Fractional values are allowed. */
  ticksPerBeat: number;
  /** Output amplitude, 0–1. */
  amplitude: number;
}

/** One polyrhythm voice: a collection of tracks sharing a common rate. */
export interface Voice {
  id: string;
  tracks: Track[];
  muted?: boolean;
  soloed?: boolean;
}

export interface GlobalSettings {
  bpm: number;
  /** Master output gain, 0–1. */
  masterVolume: number;
}

export interface AppState {
  settings: GlobalSettings;
  voices: Voice[];
}
