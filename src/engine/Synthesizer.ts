import type { SoundType } from '../model/types.js';

/**
 * Synthesizes drum sounds using only the Web Audio API.
 * All methods schedule audio at a precise `AudioContext` time without
 * creating permanent node graphs — nodes are created on demand and
 * discarded after playback ends.
 */
export class Synthesizer {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  scheduleHit(sound: SoundType, amplitude: number, audioTime: number): void {
    switch (sound) {
      case 'kick':  this.scheduleKick(audioTime, amplitude);  break;
      case 'snare': this.scheduleSnare(audioTime, amplitude); break;
      case 'hihat': this.scheduleHihat(audioTime, amplitude); break;
      case 'click': this.scheduleClick(audioTime, amplitude); break;
    }
  }

  // Sine wave with fast frequency drop: classic analog kick character.
  private scheduleKick(time: number, amplitude: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);

    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  // White noise burst through a bandpass filter + amplitude envelope.
  private scheduleSnare(time: number, amplitude: number): void {
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  // High-pass filtered noise with a very short decay.
  private scheduleHihat(time: number, amplitude: number): void {
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  // Very short sine blip — useful as a metronome click or accent marker.
  private scheduleClick(time: number, amplitude: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, time);

    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(time);
    osc.stop(time + 0.02);
  }
}
