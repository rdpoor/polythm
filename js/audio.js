/**
 * audio.js – AudioEngine: Web Audio API playback with synthesized drum sounds
 */

(function () {

  class AudioEngine {
    constructor(rhythmEngine) {
      this._engine       = rhythmEngine;
      this.playing       = false;
      this.masterVolume  = 0.8;

      this._ctx               = null;
      this._masterGain        = null;
      this._schedulerTimer    = null;
      this._lookahead         = 0.15;  // seconds
      this._scheduleInterval  = 50;    // ms

      this._playStartAudioTime = 0;
      this._playStartBeat      = 0;
      this._pausedBeat         = 0;
      this._lastScheduledBeat  = 0;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    init() {
      if (this._ctx) return;
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this.masterVolume;
      this._masterGain.connect(this._ctx.destination);
    }

    play() {
      if (!this._ctx) this.init();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      if (this.playing) return;

      this._playStartAudioTime = this._ctx.currentTime;
      this._playStartBeat      = this._pausedBeat;
      this._lastScheduledBeat  = this._pausedBeat;
      this.playing = true;

      this._schedulerTimer = setInterval(() => this._schedule(), this._scheduleInterval);
    }

    pause() {
      if (!this.playing) return;
      this._pausedBeat = this.getCurrentBeat();
      this.playing = false;
      clearInterval(this._schedulerTimer);
      this._schedulerTimer = null;
    }

    rewind() {
      const wasPlaying = this.playing;
      if (wasPlaying) this.pause();
      this._pausedBeat = 0;
      if (wasPlaying) this.play();
    }

    notifyBpmChanged() {
      if (!this.playing) return;
      // Re-anchor timing to current position
      const currentBeat = this.getCurrentBeat();
      this._playStartAudioTime = this._ctx.currentTime;
      this._playStartBeat      = currentBeat;
      this._lastScheduledBeat  = currentBeat;
    }

    // ── Timing helpers ───────────────────────────────────────────────────────

    getCurrentBeat() {
      if (!this.playing || !this._ctx) return this._pausedBeat;
      const bpm = this._engine.bpm;
      return this._playStartBeat +
        (this._ctx.currentTime - this._playStartAudioTime) * (bpm / 60);
    }

    _beatToAudioTime(beat) {
      const bpm = this._engine.bpm;
      return this._playStartAudioTime + (beat - this._playStartBeat) / (bpm / 60);
    }

    // ── Scheduler ────────────────────────────────────────────────────────────

    _schedule() {
      if (!this.playing || !this._ctx) return;

      const currentBeat  = this.getCurrentBeat();
      const lookAheadBeat = currentBeat +
        this._lookahead * (this._engine.bpm / 60);

      if (this._lastScheduledBeat < currentBeat) {
        this._lastScheduledBeat = currentBeat;
      }

      const events = this._engine.getEventsInRange(
        this._lastScheduledBeat,
        lookAheadBeat
      );

      for (const ev of events) {
        const audioTime = this._beatToAudioTime(ev.beat);
        if (audioTime < this._ctx.currentTime) continue;
        this._playEvent(ev, audioTime);
      }

      if (events.length > 0) {
        const lastBeat = events[events.length - 1].beat;
        if (lastBeat > this._lastScheduledBeat) {
          this._lastScheduledBeat = lastBeat + 1e-9;
        }
      }
      // Always advance the scheduling horizon
      if (lookAheadBeat > this._lastScheduledBeat) {
        this._lastScheduledBeat = lookAheadBeat;
      }
    }

    // ── Sound synthesis ──────────────────────────────────────────────────────

    _playEvent(ev, audioTime) {
      const ctx         = this._ctx;
      const amplitude   = Math.min(1, ev.amplitude * ev.volume);
      const sampleType  = ev.sampleType;

      const soundGain = ctx.createGain();
      soundGain.gain.value = amplitude;

      const panner = ctx.createStereoPanner
        ? ctx.createStereoPanner()
        : null;
      if (panner) {
        panner.pan.value = ev.pan || 0;
        soundGain.connect(panner);
        panner.connect(this._masterGain);
      } else {
        soundGain.connect(this._masterGain);
      }

      switch (sampleType) {
        case 'kick':          this._synthKick(ctx, soundGain, audioTime); break;
        case 'snare':         this._synthSnare(ctx, soundGain, audioTime); break;
        case 'hihat_closed':  this._synthHihatClosed(ctx, soundGain, audioTime); break;
        case 'hihat_open':    this._synthHihatOpen(ctx, soundGain, audioTime); break;
        case 'cowbell':       this._synthCowbell(ctx, soundGain, audioTime); break;
        case 'tom':           this._synthTom(ctx, soundGain, audioTime); break;
        case 'rim':           this._synthRim(ctx, soundGain, audioTime); break;
        case 'clap':          this._synthClap(ctx, soundGain, audioTime); break;
        default:              this._synthKick(ctx, soundGain, audioTime);
      }
    }

    _synthKick(ctx, dest, t) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      // exponentialRampToValueAtTime cannot ramp to 0; use a small positive floor
      osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.5);
    }

    _synthSnare(ctx, dest, t) {
      // Noise layer
      const bufSize   = ctx.sampleRate * 0.3;
      const buffer    = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data      = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise     = ctx.createBufferSource();
      noise.buffer    = buffer;

      const bpFilter  = ctx.createBiquadFilter();
      bpFilter.type   = 'bandpass';
      bpFilter.frequency.value = 1500;
      bpFilter.Q.value = 0.7;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

      noise.connect(bpFilter);
      bpFilter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(t);
      noise.stop(t + 0.3);

      // Tone layer
      const osc      = ctx.createOscillator();
      osc.type       = 'triangle';
      osc.frequency.value = 200;
      const oscGain  = ctx.createGain();
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);
    }

    _synthHihatClosed(ctx, dest, t) {
      const decay = 0.08;
      this._synthNoise(ctx, dest, t, 7000, 'highpass', decay);
    }

    _synthHihatOpen(ctx, dest, t) {
      const decay = 0.4;
      this._synthNoise(ctx, dest, t, 6000, 'highpass', decay);
    }

    _synthNoise(ctx, dest, t, freq, filterType, decay) {
      const bufSize = Math.ceil(ctx.sampleRate * decay * 1.2);
      const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data    = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise   = ctx.createBufferSource();
      noise.buffer  = buffer;

      const filter  = ctx.createBiquadFilter();
      filter.type   = filterType;
      filter.frequency.value = freq;

      const gain    = ctx.createGain();
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + decay);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(t);
      noise.stop(t + decay);
    }

    _synthCowbell(ctx, dest, t) {
      const decay = 0.6;
      const freqs = [562, 845];
      for (const freq of freqs) {
        const osc  = ctx.createOscillator();
        osc.type   = 'square';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + decay);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + decay);
      }
    }

    _synthTom(ctx, dest, t) {
      const osc  = ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    _synthRim(ctx, dest, t) {
      const osc  = ctx.createOscillator();
      osc.type   = 'triangle';
      osc.frequency.value = 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.05);
    }

    _synthClap(ctx, dest, t) {
      for (let i = 0; i < 3; i++) {
        const offset  = t + i * 0.01;
        const decay   = 0.12;
        const bufSize = Math.ceil(ctx.sampleRate * decay);
        const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data    = buffer.getChannelData(0);
        for (let j = 0; j < bufSize; j++) data[j] = Math.random() * 2 - 1;

        const noise  = ctx.createBufferSource();
        noise.buffer = buffer;

        const bp     = ctx.createBiquadFilter();
        bp.type      = 'bandpass';
        bp.frequency.value = 2500;
        bp.Q.value   = 0.8;

        const gain   = ctx.createGain();
        gain.gain.setValueAtTime(0.6, offset);
        gain.gain.exponentialRampToValueAtTime(0.01, offset + decay);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(dest);
        noise.start(offset);
        noise.stop(offset + decay);
      }
    }
  }

  window.AudioEngine = AudioEngine;
})();
