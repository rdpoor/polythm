import type { AppState } from '../model/types.js';
import type { Synthesizer } from './Synthesizer.js';

// 300ms gives the main thread enough slack to process pointer events during
// slider drags without tick() arriving too late to schedule upcoming notes.
const LOOKAHEAD_MS = 300;
const TICK_INTERVAL_MS = 25;

/**
 * Lookahead scheduler using the Chris Wilson pattern.
 *
 * On each tick it scans all tracks, computes the next event beat for each,
 * and calls Synthesizer.scheduleHit() for any events falling within the
 * lookahead window. State is kept in `nextBeat` per track so events are
 * never double-scheduled.
 */
export class Scheduler {
  private readonly synth: Synthesizer;
  private state: AppState | null = null;
  private ctx: AudioContext | null = null;

  // Absolute AudioContext time corresponding to beat 0 of the current segment.
  private startTime = 0;

  // Per-track cursor: next beat to be scheduled. Key: `${voiceId}:${trackIndex}`.
  private nextBeat: Map<string, number> = new Map();

  // Worker drives the tick interval on a separate thread so main-thread
  // pointer events (slider drags, etc.) cannot starve the scheduler.
  private worker: Worker | null = null;

  /** Called with (voiceId, trackIndex) at approximately the time each hit fires. */
  onHit: ((voiceId: string, trackIndex: number) => void) | null = null;

  constructor(synth: Synthesizer) {
    this.synth = synth;
  }

  /**
   * Start or restart scheduling from `fromBeat` (default 0).
   * `startTime` is the AudioContext time that corresponds to beat 0, so:
   *   audioTime(beat) = startTime + beat * secondsPerBeat
   * For a resume, pass `startTime = ctx.currentTime - fromBeat * secondsPerBeat`.
   */
  start(ctx: AudioContext, state: AppState, startTime: number, fromBeat = 0): void {
    this.stop();
    this.ctx = ctx;
    this.state = state;
    this.startTime = startTime;
    this.nextBeat.clear();

    for (const voice of state.voices) {
      for (let i = 0; i < voice.tracks.length; i++) {
        this.nextBeat.set(`${voice.id}:${i}`, fromBeat);
      }
    }

    const workerSrc = `let id=null;onmessage=e=>{if(e.data==='start'){id=setInterval(()=>postMessage('tick'),${TICK_INTERVAL_MS});}else if(e.data==='stop'){clearInterval(id);id=null;}};`;
    const blob = new Blob([workerSrc], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.addEventListener('message', () => this.tick());
    this.worker.postMessage('start');
  }

  stop(): void {
    if (this.worker) {
      this.worker.postMessage('stop');
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Patch state in-place without restarting the worker or resetting cursors.
   * If BPM changed, recalibrates startTime so beat→audioTime mapping stays correct
   * while all existing cursors (in beat units) remain valid.
   * New tracks get a cursor on the next tick via the `?? nowBeat` fallback.
   */
  updateState(state: AppState): void {
    if (!this.ctx || !this.state || !this.worker) {
      return;
    }

    if (state.settings.bpm !== this.state.settings.bpm) {
      const oldSpb = 60 / this.state.settings.bpm;
      const nowBeat = (this.ctx.currentTime - this.startTime) / oldSpb;
      const newSpb = 60 / state.settings.bpm;
      this.startTime = this.ctx.currentTime - nowBeat * newSpb;
    }

    this.state = state;
  }

  /** AudioContext time corresponding to beat 0 of the current segment. */
  get currentStartTime(): number {
    return this.startTime;
  }

  private tick(): void {
    if (!this.ctx || !this.state) {
      return;
    }

    const { bpm } = this.state.settings;
    const secondsPerBeat = 60 / bpm;
    const lookaheadBeats = (LOOKAHEAD_MS / 1000) / secondsPerBeat;
    const nowBeat = (this.ctx.currentTime - this.startTime) / secondsPerBeat;
    const scheduleUntilBeat = nowBeat + lookaheadBeats;

    const anySoloed = this.state.voices.some(v => v.soloed);

    for (const voice of this.state.voices) {
      // A voice is silenced if it is explicitly muted, or if another voice is
      // soloed and this one is not.
      const effectiveMute = voice.muted || (anySoloed && !voice.soloed);
      if (effectiveMute) { continue; }

      for (let i = 0; i < voice.tracks.length; i++) {
        const track = voice.tracks[i];
        if (!track) {
          continue;
        }
        const key = `${voice.id}:${i}`;
        let nextBeat = this.nextBeat.get(key) ?? nowBeat;

        while (nextBeat < scheduleUntilBeat) {
          if (nextBeat >= nowBeat - 0.01) {
            const audioTime = this.startTime + nextBeat * secondsPerBeat;
            this.synth.scheduleHit(track, audioTime);

            if (this.onHit) {
              const cb = this.onHit;
              const voiceId = voice.id;
              const trackIdx = i;
              const delay = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);
              setTimeout(() => cb(voiceId, trackIdx), delay);
            }
          }
          nextBeat += 1 / track.ticksPerBeat;
        }

        this.nextBeat.set(key, nextBeat);
      }
    }
  }
}
