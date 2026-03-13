/**
 * engine.js – RhythmEngine: manages voices, tracks, and event generation
 */

(function () {
  const DEFAULT_COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
    '#6c5ce7', '#a29bfe', '#fd79a8', '#00b894',
    '#e17055', '#74b9ff', '#55efc4', '#fdcb6e'
  ];

  const MAX_EVENTS_PER_RANGE = 10000;

  let _voiceCounter = 0;
  let _trackCounter = 0;

  class RhythmEngine {
    constructor() {
      this.state = {
        bpm: 120,
        meter: 4,
        swing: 0,
        voices: []
      };
    }

    // ── Convenience getters/setters ──────────────────────────────────────────

    get bpm()   { return this.state.bpm; }
    set bpm(v)  { this.state.bpm = v; }

    get meter() { return this.state.meter; }
    set meter(v){ this.state.meter = v; }

    get swing() { return this.state.swing; }
    set swing(v){ this.state.swing = v; }

    // ── Voice management ────────────────────────────────────────────────────

    addVoice(options = {}) {
      _voiceCounter++;
      const id = 'v' + _voiceCounter;
      const colorIndex = (this.state.voices.length) % DEFAULT_COLORS.length;
      const voice = {
        id,
        name:       options.name       || 'Voice ' + _voiceCounter,
        sampleType: options.sampleType || 'kick',
        volume:     options.volume     !== undefined ? options.volume : 1,
        pan:        options.pan        !== undefined ? options.pan    : 0,
        mute:       options.mute       || false,
        solo:       options.solo       || false,
        tracks:     []
      };
      this.state.voices.push(voice);
      return voice;
    }

    removeVoice(voiceId) {
      this.state.voices = this.state.voices.filter(v => v.id !== voiceId);
    }

    getVoice(voiceId) {
      return this.state.voices.find(v => v.id === voiceId) || null;
    }

    updateVoice(voiceId, props) {
      const voice = this.getVoice(voiceId);
      if (!voice) return;
      Object.assign(voice, props);
    }

    // ── Track management ────────────────────────────────────────────────────

    addTrack(voiceId, options = {}) {
      const voice = this.getVoice(voiceId);
      if (!voice) return null;

      _trackCounter++;
      const id = 't' + _trackCounter;
      const colorIndex = (_trackCounter - 1) % DEFAULT_COLORS.length;
      const track = {
        id,
        ticksPerBeat: options.ticksPerBeat !== undefined ? options.ticksPerBeat : 1,
        amplitude:    options.amplitude    !== undefined ? options.amplitude    : 0.8,
        delay:        options.delay        !== undefined ? options.delay        : 0,
        color:        options.color        || DEFAULT_COLORS[colorIndex]
      };
      voice.tracks.push(track);
      return track;
    }

    removeTrack(voiceId, trackId) {
      const voice = this.getVoice(voiceId);
      if (!voice) return;
      voice.tracks = voice.tracks.filter(t => t.id !== trackId);
    }

    updateTrack(voiceId, trackId, props) {
      const voice = this.getVoice(voiceId);
      if (!voice) return;
      const track = voice.tracks.find(t => t.id === trackId);
      if (!track) return;
      Object.assign(track, props);
    }

    // ── Event generation ────────────────────────────────────────────────────

    getEventsInRange(fromBeat, toBeat) {
      const voices = this.state.voices;
      const anySolo = voices.some(v => v.solo);
      const events = [];

      for (const voice of voices) {
        if (voice.mute) continue;
        if (anySolo && !voice.solo) continue;

        for (const track of voice.tracks) {
          const tpb = track.ticksPerBeat;
          if (!tpb || tpb <= 0) continue;

          const beatInterval = 1 / tpb;
          // First tick index whose beat >= fromBeat
          const startN = Math.ceil((fromBeat - track.delay) / beatInterval);

          for (let n = startN; ; n++) {
            const beat = track.delay + n * beatInterval;
            if (beat >= toBeat) break;
            if (beat < fromBeat) continue;

            events.push({
              beat,
              voiceId:    voice.id,
              trackId:    track.id,
              sampleType: voice.sampleType,
              amplitude:  track.amplitude,
              color:      track.color,
              pan:        voice.pan,
              volume:     voice.volume
            });

            if (events.length >= MAX_EVENTS_PER_RANGE) break;
          }
          if (events.length >= MAX_EVENTS_PER_RANGE) break;
        }
        if (events.length >= MAX_EVENTS_PER_RANGE) break;
      }

      events.sort((a, b) => a.beat - b.beat);
      return events;
    }

    // ── State serialization ─────────────────────────────────────────────────

    getState() {
      return JSON.parse(JSON.stringify(this.state));
    }

    loadState(state) {
      this.state = JSON.parse(JSON.stringify(state));
      // Resync counters so new IDs won't collide
      for (const voice of this.state.voices) {
        const vNum = parseInt(voice.id.replace(/^v/, ''), 10);
        if (!isNaN(vNum) && vNum > _voiceCounter) _voiceCounter = vNum;
        for (const track of voice.tracks) {
          const tNum = parseInt(track.id.replace(/^t/, ''), 10);
          if (!isNaN(tNum) && tNum > _trackCounter) _trackCounter = tNum;
        }
      }
    }
  }

  window.RhythmEngine = RhythmEngine;
})();
