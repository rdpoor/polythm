import type { AppState } from '../model/types.js';
import { SampleLibrary } from './SampleLibrary.js';
import { Synthesizer } from './Synthesizer.js';
import { Scheduler } from './Scheduler.js';

type EngineState = 'stopped' | 'playing' | 'paused';

/**
 * Top-level audio subsystem.
 *
 * Owns the AudioContext and master gain node, wires together Scheduler and
 * Synthesizer, and exposes a simple transport API.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sampleLib: SampleLibrary | null = null;
  private synth: Synthesizer | null = null;
  private scheduler: Scheduler | null = null;

  private engineState: EngineState = 'stopped';
  private elapsedBeats = 0;
  private segmentStartAudioTime = 0;
  private lastBpm = 120;

  // Stored so it can be applied to the scheduler once it's lazily created.
  private _onHit: ((voiceId: string, trackIndex: number) => void) | null = null;

  set onHit(fn: ((voiceId: string, trackIndex: number) => void) | null) {
    this._onHit = fn;
    if (this.scheduler) {
      this.scheduler.onHit = fn;
    }
  }

  play(state: AppState): void {
    if (this.engineState === 'playing') {
      return;
    }

    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.sampleLib = new SampleLibrary();
      this.synth = new Synthesizer(this.ctx, this.masterGain, this.sampleLib);
      this.scheduler = new Scheduler(this.synth);
      this.sampleLib.load(this.ctx);
      this.scheduler.onHit = this._onHit;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.lastBpm = state.settings.bpm;
    this.masterGain!.gain.setValueAtTime(state.settings.masterVolume, this.ctx.currentTime);

    const secondsPerBeat = 60 / state.settings.bpm;

    if (this.engineState === 'paused') {
      this.segmentStartAudioTime = this.ctx.currentTime - this.elapsedBeats * secondsPerBeat;
      this.scheduler!.start(this.ctx, state, this.segmentStartAudioTime, this.elapsedBeats);
    } else {
      this.elapsedBeats = 0;
      this.segmentStartAudioTime = this.ctx.currentTime;
      this.scheduler!.start(this.ctx, state, this.segmentStartAudioTime);
    }

    this.engineState = 'playing';
  }

  pause(): void {
    if (this.engineState !== 'playing' || !this.ctx) {
      return;
    }

    const secondsPerBeat = 60 / this.lastBpm;
    this.elapsedBeats = (this.ctx.currentTime - this.segmentStartAudioTime) / secondsPerBeat;

    this.scheduler!.stop();
    this.engineState = 'paused';
  }

  rewind(): void {
    this.scheduler?.stop();
    this.elapsedBeats = 0;
    this.engineState = 'stopped';
  }

  /**
   * Apply a new AppState while playing.
   * Patches the scheduler's state in-place — the worker and beat cursors are
   * untouched, so already-scheduled notes are never double-fired.
   */
  updateState(state: AppState): void {
    if (this.engineState !== 'playing' || !this.ctx || !this.scheduler) {
      return;
    }

    this.masterGain!.gain.setValueAtTime(state.settings.masterVolume, this.ctx.currentTime);
    this.scheduler.updateState(state);

    // Keep segmentStartAudioTime in sync (scheduler may have recalibrated it for BPM change).
    this.segmentStartAudioTime = this.scheduler.currentStartTime;
    this.lastBpm = state.settings.bpm;
  }
}
