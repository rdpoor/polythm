/**
 * Synthesizes GM percussion sounds using the Web Audio API.
 *
 * Each of the 47 GM percussion notes (35–81) is mapped to one of five
 * synthesis families; parameters within each family are tuned per note so
 * adjacent instruments sound distinct.
 */
export class Synthesizer {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  scheduleHit(note: number, amplitude: number, time: number): void {
    if (note >= 35 && note <= 36) {
      this.scheduleBass(note, amplitude, time);
    } else if (note === 37 || note === 39 || (note >= 75 && note <= 77)) {
      this.scheduleClick(note, amplitude, time);
    } else if (note === 38 || note === 40) {
      this.scheduleSnare(amplitude, time);
    } else if ((note >= 41 && note <= 50) || (note >= 60 && note <= 66)) {
      this.scheduleTom(note, amplitude, time);
    } else if (note === 42 || note === 44) {
      this.scheduleHihat(0.04, amplitude, time);
    } else if (note === 46) {
      this.scheduleHihat(0.18, amplitude, time);
    } else if (note === 49 || note === 52 || note === 55 || note === 57) {
      this.scheduleCymbal(0.6, amplitude, time);
    } else if (note === 51 || note === 53 || note === 59) {
      this.scheduleCymbal(0.25, amplitude, time);
    } else if (note === 54 || note === 69 || note === 70) {
      this.scheduleHihat(0.06, amplitude * 0.7, time);
    } else if (note === 56) {
      this.scheduleCowbell(amplitude, time);
    } else if (note === 58 || note === 73 || note === 74) {
      this.scheduleNoiseBurst(0.12, 800, amplitude, time);
    } else if (note >= 71 && note <= 72) {
      this.scheduleWhistle(note, amplitude, time);
    } else if (note >= 78 && note <= 81) {
      this.scheduleHighPerc(note, amplitude, time);
    } else {
      // Hand percussion (bongos, congas, timbales, agogo, claves, wood blocks)
      this.scheduleClick(note, amplitude, time);
    }
  }

  // Low sine with rapid frequency drop — classic kick character.
  private scheduleBass(note: number, amplitude: number, time: number): void {
    const freq = note === 35 ? 60 : 80;
    const decay = note === 35 ? 0.45 : 0.4;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.04);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + decay);
    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + decay);
  }

  // White noise through a bandpass + amplitude envelope.
  private scheduleSnare(amplitude: number, time: number): void {
    const dur = 0.18;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    src.start(time);
    src.stop(time + dur);
  }

  // High-pass filtered noise burst — duration controls open vs closed.
  private scheduleHihat(dur: number, amplitude: number, time: number): void {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    src.start(time);
    src.stop(time + dur);
  }

  // Sine with pitch and amplitude envelope — frequency set by note number.
  private scheduleTom(note: number, amplitude: number, time: number): void {
    // Notes 41–50 are toms; 60–66 are bongos/congas. Map to a freq range.
    const t = (note - 35) / (81 - 35);
    const freq = 300 - t * 220;   // 300 Hz (low tom) → ~80 Hz (high tom inverted)
    const decay = 0.3 - t * 0.1;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.8, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.02);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + decay);
    gain.gain.setValueAtTime(amplitude * 0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + decay);
  }

  // Long noise burst through a bandpass — simulates cymbal wash.
  private scheduleCymbal(dur: number, amplitude: number, time: number): void {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.destination);
    src.start(time);
    src.stop(time + dur);
  }

  // Two detuned square waves — distinctive cowbell timbre.
  private scheduleCowbell(amplitude: number, time: number): void {
    const dur = 0.28;
    for (const freq of [562, 845]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(amplitude * 0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(time);
      osc.stop(time + dur);
    }
  }

  // Short sine blip — side stick, claves, wood blocks.
  private scheduleClick(note: number, amplitude: number, time: number): void {
    const t = (note - 35) / (81 - 35);
    const freq = 400 + t * 1600;
    const dur = 0.025;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  // High sine — whistle sounds.
  private scheduleWhistle(note: number, amplitude: number, time: number): void {
    const freq = note === 71 ? 2800 : 2000;
    const dur = 0.15;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amplitude * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  // Band-limited noise burst — guiro, vibraslap.
  private scheduleNoiseBurst(dur: number, filterFreq: number, amplitude: number, time: number): void {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amplitude * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    src.start(time);
    src.stop(time + dur);
  }

  // High sine ring — triangle, cuica, open cuica.
  private scheduleHighPerc(note: number, amplitude: number, time: number): void {
    const freqMap: Record<number, number> = { 78: 900, 79: 700, 80: 4200, 81: 3600 };
    const freq = freqMap[note] ?? 3000;
    const dur = note === 81 || note === 79 ? 0.35 : 0.12;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = note >= 80 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amplitude * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + dur);
  }
}
