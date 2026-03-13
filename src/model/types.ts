export type SoundType = 'kick' | 'snare' | 'hihat' | 'click';

/** A single rhythmic layer within a voice. */
export interface Track {
  /** Number of evenly-spaced hits per beat. Fractional values are allowed. */
  ticksPerBeat: number;
  /** Output amplitude, 0–1. */
  amplitude: number;
  /**
   * Phase offset as a fraction of one period [0, 1).
   * An offset of 0.5 delays every hit by half a period (1 / (2 × ticksPerBeat) beats).
   */
  offset: number;
}

/** One polyrhythm voice: a sound plus one or more rhythmic tracks. */
export interface Voice {
  id: string;
  sound: SoundType;
  muted?: boolean;
  soloed?: boolean;
  tracks: Track[];
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
