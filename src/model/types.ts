export type SoundType = number;

export const GM_PERCUSSION: Record<number, string> = {
  35: 'Bass Drum 2', 36: 'Bass Drum 1', 37: 'Side Stick', 38: 'Acoustic Snare',
  39: 'Hand Clap', 40: 'Electric Snare', 41: 'Low Floor Tom', 42: 'Closed Hi-Hat',
  43: 'High Floor Tom', 44: 'Pedal Hi-Hat', 45: 'Low Tom', 46: 'Open Hi-Hat',
  47: 'Low-Mid Tom', 48: 'Hi-Mid Tom', 49: 'Crash Cymbal 1', 50: 'High Tom',
  51: 'Ride Cymbal 1', 52: 'Chinese Cymbal', 53: 'Ride Bell', 54: 'Tambourine',
  55: 'Splash Cymbal', 56: 'Cowbell', 57: 'Crash Cymbal 2', 58: 'Vibraslap',
  59: 'Ride Cymbal 2', 60: 'Hi Bongo', 61: 'Low Bongo', 62: 'Mute Hi Conga',
  63: 'Open Hi Conga', 64: 'Low Conga', 65: 'High Timbale', 66: 'Low Timbale',
  67: 'High Agogo', 68: 'Low Agogo', 69: 'Cabasa', 70: 'Maracas',
  71: 'Short Whistle', 72: 'Long Whistle', 73: 'Short Guiro', 74: 'Long Guiro',
  75: 'Claves', 76: 'Hi Wood Block', 77: 'Low Wood Block', 78: 'Mute Cuica',
  79: 'Open Cuica', 80: 'Mute Triangle', 81: 'Open Triangle',
};

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
