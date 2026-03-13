/**
 * visualizer.js – Tape-deck style canvas visualizer
 */

(function () {

  class Visualizer {
    constructor(canvas, rhythmEngine) {
      this._canvas  = canvas;
      this._ctx     = canvas.getContext('2d');
      this._engine  = rhythmEngine;
      this.pixelsPerBeat = 80;

      this._setupResizeObserver();
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    zoomIn()  { this.pixelsPerBeat *= 1.25; }
    zoomOut() { this.pixelsPerBeat /= 1.25; }

    // ── Resize handling ──────────────────────────────────────────────────────

    _setupResizeObserver() {
      if (typeof ResizeObserver === 'undefined') return;
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this._canvas.parentElement || this._canvas);
      this._resize();
    }

    _resize() {
      const container = this._canvas.parentElement;
      if (container) {
        this._canvas.width  = container.clientWidth;
        this._canvas.height = container.clientHeight;
      }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    render(currentBeat) {
      const canvas = this._canvas;
      const ctx    = this._ctx;
      const W      = canvas.width;
      const H      = canvas.height;

      if (W === 0 || H === 0) return;

      // Background
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);

      const ppb        = this.pixelsPerBeat;
      const playheadX  = Math.floor(W * 0.33);
      const worldOffset = playheadX - currentBeat * ppb;

      const meter   = this._engine.meter || 4;
      const voices  = this._engine.state.voices;

      // ── Grid lines ──────────────────────────────────────────────────────

      // Determine beat range visible
      const leftBeat  = Math.floor((0 - worldOffset) / ppb) - 1;
      const rightBeat = Math.ceil((W - worldOffset) / ppb) + 1;

      for (let b = leftBeat; b <= rightBeat; b++) {
        const x = Math.floor(worldOffset + b * ppb);
        if (x < -2 || x > W + 2) continue;

        const isMeasureStart = b >= 0 && b % meter === 0;

        if (isMeasureStart) {
          // Bright measure line
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, H);
          ctx.stroke();

          // Measure label
          const measureNum = Math.floor(b / meter) + 1;
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '10px monospace';
          ctx.fillText('m' + measureNum, x + 3, 12);
        } else if (b >= 0 && Number.isInteger(b)) {
          // Dim beat line
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, H);
          ctx.stroke();
        }
      }

      // ── Voice lanes ─────────────────────────────────────────────────────

      const laneCount  = Math.max(voices.length, 1);
      const laneHeight = H / laneCount;
      const anySolo    = voices.some(v => v.solo);

      // Fetch visible events in a reasonable range
      const lookBehind  = 2;
      const lookAhead   = (W / ppb) + 2;
      const fromBeat    = Math.max(0, currentBeat - lookBehind);
      const toBeat      = currentBeat + lookAhead;
      const allEvents   = this._engine.getEventsInRange(fromBeat, toBeat);

      // Build a map voiceId → events[]
      const eventsByVoice = {};
      for (const ev of allEvents) {
        if (!eventsByVoice[ev.voiceId]) eventsByVoice[ev.voiceId] = [];
        eventsByVoice[ev.voiceId].push(ev);
      }

      for (let i = 0; i < voices.length; i++) {
        const voice     = voices[i];
        const laneTop   = i * laneHeight;
        const laneBot   = laneTop + laneHeight;

        // Lane background tint (alternate)
        ctx.fillStyle = i % 2 === 0
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, laneTop, W, laneHeight);

        // Separator line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneBot - 0.5);
        ctx.lineTo(W, laneBot - 0.5);
        ctx.stroke();

        // Voice name label
        const isMuted  = voice.mute;
        const isSilent = anySolo && !voice.solo;
        ctx.fillStyle  = (isMuted || isSilent) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)';
        ctx.font       = '11px sans-serif';
        ctx.fillText(voice.name, 6, laneTop + 14);

        if (isMuted || isSilent) continue;

        // Draw events
        const evs = eventsByVoice[voice.id] || [];
        for (const ev of evs) {
          const x = Math.floor(worldOffset + ev.beat * ppb);
          if (x < -4 || x > W + 4) continue;

          const barHeight = Math.max(2, ev.amplitude * (laneHeight - 8));
          const y         = laneBot - barHeight - 4;

          ctx.fillStyle = ev.color || '#ffffff';
          ctx.fillRect(x - 2, y, 4, barHeight);
        }
      }

      // ── Playhead ─────────────────────────────────────────────────────────

      ctx.strokeStyle = '#e94560';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX + 0.5, 0);
      ctx.lineTo(playheadX + 0.5, H);
      ctx.stroke();

      // Triangle at top of playhead
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(playheadX - 7, 0);
      ctx.lineTo(playheadX + 7, 0);
      ctx.lineTo(playheadX,     12);
      ctx.closePath();
      ctx.fill();
    }
  }

  window.Visualizer = Visualizer;
})();
