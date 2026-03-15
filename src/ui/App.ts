import type { AppState, Track, SoundType } from '../model/types.js';
import { GM_PERCUSSION } from '../model/types.js';
import type { StateStore } from '../state/store.js';
import type { AudioEngine } from '../engine/AudioEngine.js';

const GM_ENTRIES = Object.entries(GM_PERCUSSION)
  .map(([k, v]) => ({ note: Number(k), name: v }))
  .sort((a, b) => a.note - b.note);

// ── Offset snap-to-fraction (Shift+drag) ─────────────────────────────────────

interface SnapPoint {
  value: number;
  label: string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Generates sorted, deduplicated snap points for the given list of denominators.
 * Each point is n/d in lowest terms, with label "0" or "n/d".
 */
function buildSnapPoints(denoms: number[]): SnapPoint[] {
  const seen = new Map<number, SnapPoint>();
  for (const d of denoms) {
    for (let n = 0; n < d; n++) {
      const g = gcd(n, d);
      const rn = n / g;
      const rd = d / g;
      const value = rn / rd;
      if (!seen.has(value)) {
        seen.set(value, { value, label: rn === 0 ? '0' : `${rn}/${rd}` });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.value - b.value);
}

const OFFSET_SNAPS = buildSnapPoints([1, 2, 3, 4, 6, 8, 9, 12, 16]);

/** Returns the snap point nearest to raw by absolute distance. */
function quantizeOffset(raw: number, snaps: SnapPoint[]): SnapPoint {
  let best = snaps[0]!;
  let bestDist = Math.abs(raw - best.value);
  for (const snap of snaps) {
    const dist = Math.abs(raw - snap.value);
    if (dist < bestDist) {
      bestDist = dist;
      best = snap;
    }
  }
  return best;
}

let shiftHeld = false;
document.addEventListener('keydown', (e) => { if (e.key === 'Shift') { shiftHeld = true; } });
document.addEventListener('keyup', (e) => { if (e.key === 'Shift') { shiftHeld = false; } });

/**
 * Parse a ticks-per-beat string. Accepts:
 *   integer      "3"
 *   float        "2.333"
 *   fraction     "7/3"
 *   mixed number "2 1/3"
 * Returns null if the string is not a recognised format or produces a non-finite value.
 */
function parseTpb(raw: string): number | null {
  const s = raw.trim();

  // Mixed number: "2 1/3"
  const mixed = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1]!, 10);
    const num   = parseInt(mixed[2]!, 10);
    const den   = parseInt(mixed[3]!, 10);
    if (den === 0) { return null; }
    return whole + num / den;
  }

  // Fraction: "7/3"
  const frac = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const num = parseInt(frac[1]!, 10);
    const den = parseInt(frac[2]!, 10);
    if (den === 0) { return null; }
    return num / den;
  }

  // Plain integer or float
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// ── dB ↔ gain conversion ──────────────────────────────────────────────────

const MIN_DB = -60;

/** Linear gain → dB, clamped to MIN_DB. */
function gainToDb(gain: number): number {
  if (gain <= 0) { return MIN_DB; }
  return Math.max(MIN_DB, 20 * Math.log10(gain));
}

/** dB → linear gain. Returns exact 0 at or below MIN_DB (true silence). */
function dbToGain(db: number): number {
  if (db <= MIN_DB) { return 0; }
  return Math.pow(10, db / 20);
}

/** Format a dB value for display. */
function fmtDb(db: number): string {
  return db <= MIN_DB ? '−∞' : `${Math.round(db)} dB`;
}

let voiceIdCounter = 10;

function newVoiceId(): string {
  return `voice-${voiceIdCounter++}`;
}

export class App {
  private readonly store: StateStore;
  private readonly engine: AudioEngine;
  private voicesEl!: HTMLElement;
  private isPlaying = false;
  private btnPlay!: HTMLButtonElement;
  private btnPause!: HTMLButtonElement;
  private bpmSlider!: HTMLInputElement;
  private bpmDisplay!: HTMLSpanElement;
  private volSlider!: HTMLInputElement;
  private volDisplay!: HTMLSpanElement;

  constructor(store: StateStore, engine: AudioEngine) {
    this.store = store;
    this.engine = engine;

    engine.onHit = (voiceId, trackIndex) => {
      this.flashTrack(voiceId, trackIndex);
    };
  }

  mount(container: HTMLElement): void {
    container.innerHTML = '';
    container.appendChild(this.buildHeader());
    document.body.appendChild(this.buildHelpDialog());

    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') { return; }
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) { return; }
      e.preventDefault();
      this.togglePlayPause();
    });

    this.voicesEl = document.createElement('main');
    this.voicesEl.id = 'voices';
    container.appendChild(this.voicesEl);
    this.renderVoices();

    const footer = document.createElement('footer');
    footer.id = 'footer';
    const btnAddVoice = document.createElement('button');
    btnAddVoice.className = 'btn-add-voice';
    btnAddVoice.textContent = '+ Add Voice';
    btnAddVoice.addEventListener('click', () => this.addVoice());
    footer.appendChild(btnAddVoice);
    container.appendChild(footer);
  }

  // ── Header (transport + global settings) ─────────────────────────────────

  private buildHeader(): HTMLElement {
    const header = document.createElement('header');

    const title = document.createElement('h1');
    title.textContent = 'POLYTHM';
    header.appendChild(title);

    const btnHelp = document.createElement('button');
    btnHelp.className = 'btn-help';
    btnHelp.textContent = '?';
    btnHelp.title = 'Help';
    btnHelp.addEventListener('click', () => {
      (document.getElementById('help-dialog') as HTMLDialogElement).showModal();
    });
    header.appendChild(btnHelp);

    // Transport buttons
    const transport = document.createElement('div');
    transport.className = 'transport';

    this.btnPlay = this.mkBtn('▶', () => this.play());
    this.btnPause = this.mkBtn('⏸', () => this.pause());
    const btnStop = this.mkBtn('⏹', () => {
      this.engine.rewind();
      this.isPlaying = false;
      this.btnPlay.classList.remove('active');
      this.btnPause.classList.remove('active');
    });
    transport.append(this.btnPlay, this.btnPause, btnStop);
    header.appendChild(transport);

    // Global settings
    const settings = document.createElement('div');
    settings.className = 'global-settings';

    const { bpm, masterVolume } = this.store.getState().settings;

    const bpmRow = this.mkSliderRow('BPM', 40, 240, 1, bpm, (val) => {
      this.patchSettings({ bpm: val });
    });
    this.bpmSlider = bpmRow.slider;
    this.bpmDisplay = bpmRow.display;
    settings.appendChild(bpmRow.row);

    const volRow = this.mkSliderRow('VOL', MIN_DB, 0, 1, gainToDb(masterVolume), (db) => {
      this.patchSettings({ masterVolume: dbToGain(db) });
    }, fmtDb);
    this.volSlider = volRow.slider;
    this.volDisplay = volRow.display;
    settings.appendChild(volRow.row);

    header.appendChild(settings);

    // File save / load
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';

    const btnSave = document.createElement('button');
    btnSave.className = 'btn';
    btnSave.textContent = '⬇ Save';
    btnSave.title = 'Save state to file';
    btnSave.addEventListener('click', () => this.saveToFile());
    fileActions.appendChild(btnSave);

    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn';
    btnLoad.textContent = '⬆ Load';
    btnLoad.title = 'Load state from file';
    btnLoad.addEventListener('click', () => this.loadFromFile());
    fileActions.appendChild(btnLoad);

    header.appendChild(fileActions);

    return header;
  }

  // ── Help dialog ───────────────────────────────────────────────────────────

  private buildHelpDialog(): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.id = 'help-dialog';

    const close = (): void => dialog.close();

    // Close on backdrop click (click lands directly on <dialog>, not its children).
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) { close(); }
    });

    const panel = document.createElement('div');
    panel.className = 'help-panel';

    const titleRow = document.createElement('div');
    titleRow.className = 'help-title-row';

    const title = document.createElement('h2');
    title.textContent = 'POLYTHM — Help';
    titleRow.appendChild(title);

    const btnClose = document.createElement('button');
    btnClose.className = 'btn-icon help-close';
    btnClose.textContent = '✕';
    btnClose.addEventListener('click', close);
    titleRow.appendChild(btnClose);

    panel.appendChild(titleRow);

    panel.appendChild(this.helpSection('Keyboard Shortcuts', [
      ['Space', 'Toggle play / pause (when no text field is focused).'],
    ]));

    panel.appendChild(this.helpSection('Transport', [
      ['▶', 'Start playback from the current position.'],
      ['⏸', 'Pause — resume continues from the same beat.'],
      ['⏹', 'Stop and rewind to beat 0.'],
    ]));

    panel.appendChild(this.helpSection('Global Controls', [
      ['BPM', 'Tempo in beats per minute (40 – 240).'],
      ['VOL', 'Master output level in dB (−60 dB = silence, 0 dB = full).'],
      ['⬇ Save', 'Download the current session as a JSON file.'],
      ['⬆ Load', 'Restore a previously saved JSON file, replacing the current session.'],
    ]));

    panel.appendChild(this.helpSection('Voices', [
      ['Voice', 'An independent rhythmic stream. Each voice contains one or more tracks that play simultaneously.'],
      ['M', 'Mute — silence this voice. Other voices continue playing.'],
      ['S', 'Solo — play only this voice (and any other soloed voices). Multiple voices can be soloed at once.'],
      ['+ Add Voice', 'Append a new voice with a single kick track.'],
      ['✕ (voice)', 'Remove that voice entirely. Disabled when only one voice remains.'],
    ]));

    panel.appendChild(this.helpSection('Tracks', [
      ['Sound', 'GM percussion instrument (MIDI notes 35–81). Samples loaded from CDN on first play.'],
      ['tpb', 'Ticks per beat — how many evenly-spaced hits this track fires per beat.\nAccepts integers ("3"), decimals ("2.333"), fractions ("7/3"), or mixed numbers ("2 1/3").\nRange: 0.25 – 16.'],
      ['Amplitude', 'Per-track level in dB (−60 dB = silence, 0 dB = full). The dot on the left flashes on every hit.'],
      ['off', 'Phase offset (0 – 1). Delays every hit by offset × (1 / tpb) beats. 0 = no delay, 1 = one full period (same as 0).'],
      ['✕ (track)', 'Remove this track from the voice. Disabled when only one track remains.'],
      ['+ Add Track', 'Append a new hihat track to this voice.'],
    ]));

    const tip = document.createElement('p');
    tip.className = 'help-tip';
    tip.textContent = 'Tip: try setting two voices to tpb values like 3 and 4 for a classic 3-against-4 polyrhythm.';
    panel.appendChild(tip);

    dialog.appendChild(panel);
    return dialog;
  }

  private helpSection(heading: string, rows: [string, string][]): HTMLElement {
    const section = document.createElement('section');
    section.className = 'help-section';

    const h = document.createElement('h3');
    h.textContent = heading;
    section.appendChild(h);

    const table = document.createElement('table');
    for (const [term, desc] of rows) {
      const tr = document.createElement('tr');

      const td1 = document.createElement('td');
      td1.className = 'help-term';
      td1.textContent = term;

      const td2 = document.createElement('td');
      td2.className = 'help-desc';
      // Preserve newlines in description strings.
      td2.style.whiteSpace = 'pre-wrap';
      td2.textContent = desc;

      tr.append(td1, td2);
      table.appendChild(tr);
    }
    section.appendChild(table);
    return section;
  }

  private play(): void {
    this.engine.play(this.store.getState());
    this.isPlaying = true;
    this.btnPlay.classList.add('active');
    this.btnPause.classList.remove('active');
  }

  private pause(): void {
    this.engine.pause();
    this.isPlaying = false;
    this.btnPause.classList.add('active');
    this.btnPlay.classList.remove('active');
  }

  private togglePlayPause(): void {
    if (this.isPlaying) { this.pause(); } else { this.play(); }
  }

  private patchSettings(patch: Partial<AppState['settings']>): void {
    this.store.setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
    if (this.isPlaying) {
      this.engine.updateState(this.store.getState());
    }
  }

  // ── Voices ────────────────────────────────────────────────────────────────

  private renderVoices(): void {
    const { voices } = this.store.getState();
    this.voicesEl.innerHTML = '';
    for (const voice of voices) {
      this.voicesEl.appendChild(this.buildVoicePanel(voice.id));
    }
  }

  private buildVoicePanel(voiceId: string): HTMLElement {
    const { voices } = this.store.getState();
    const voice = voices.find(v => v.id === voiceId)!;

    const panel = document.createElement('div');
    panel.className = 'voice-panel';

    // Voice header
    const header = document.createElement('div');
    header.className = 'voice-header';

    const label = document.createElement('span');
    label.className = 'voice-label';
    label.textContent = voiceId.replace('-', '\u00A0');
    header.appendChild(label);

    // Sound selector
    const soundSel = document.createElement('select');
    soundSel.className = 'sound-select';
    for (const entry of GM_ENTRIES) {
      const opt = document.createElement('option');
      opt.value = String(entry.note);
      opt.textContent = entry.name;
      opt.selected = entry.note === voice.sound;
      soundSel.appendChild(opt);
    }
    soundSel.addEventListener('change', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.map(v =>
          v.id === voiceId ? { ...v, sound: Number(soundSel.value) as SoundType } : v
        ),
      }));
      if (this.isPlaying) { this.engine.updateState(this.store.getState()); }
    });
    header.appendChild(soundSel);

    // Mute / Solo
    const btnMute = document.createElement('button');
    btnMute.className = 'btn-ms' + (voice.muted ? ' ms-mute-active' : '');
    btnMute.textContent = 'M';
    btnMute.title = 'Mute';
    btnMute.addEventListener('click', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.map(v =>
          v.id === voiceId ? { ...v, muted: !v.muted } : v
        ),
      }));
      if (this.isPlaying) { this.engine.updateState(this.store.getState()); }
      this.renderVoices();
    });
    header.appendChild(btnMute);

    const btnSolo = document.createElement('button');
    btnSolo.className = 'btn-ms' + (voice.soloed ? ' ms-solo-active' : '');
    btnSolo.textContent = 'S';
    btnSolo.title = 'Solo';
    btnSolo.addEventListener('click', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.map(v =>
          v.id === voiceId ? { ...v, soloed: !v.soloed } : v
        ),
      }));
      if (this.isPlaying) { this.engine.updateState(this.store.getState()); }
      this.renderVoices();
    });
    header.appendChild(btnSolo);

    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-icon';
    btnRemove.title = 'Remove voice';
    btnRemove.textContent = '✕';
    btnRemove.style.visibility = voices.length <= 1 ? 'hidden' : 'visible';
    btnRemove.addEventListener('click', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.filter(v => v.id !== voiceId),
      }));
      if (this.isPlaying) {
        this.engine.updateState(this.store.getState());
      }
      this.renderVoices();
    });
    header.appendChild(btnRemove);
    panel.appendChild(header);

    // Track rows
    const trackList = document.createElement('div');
    trackList.className = 'track-list';
    voice.tracks.forEach((track, i) => {
      trackList.appendChild(this.buildTrackRow(voiceId, i, track, voice.tracks.length));
    });
    panel.appendChild(trackList);

    // Add track footer
    const vFooter = document.createElement('div');
    vFooter.className = 'voice-footer';
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-dashed';
    btnAdd.textContent = '+ Add Track';
    btnAdd.addEventListener('click', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.map(v =>
          v.id === voiceId
            ? { ...v, tracks: [...v.tracks, { ticksPerBeat: 2, amplitude: 0.5, offset: 0 }] }
            : v
        ),
      }));
      if (this.isPlaying) {
        this.engine.updateState(this.store.getState());
      }
      this.renderVoices();
    });
    vFooter.appendChild(btnAdd);
    panel.appendChild(vFooter);

    return panel;
  }

  private buildTrackRow(voiceId: string, trackIndex: number, track: Track, trackCount: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'track-row';

    // Hit indicator dot
    const dot = document.createElement('span');
    dot.className = 'hit-dot';
    dot.dataset['voiceId'] = voiceId;
    dot.dataset['trackIndex'] = String(trackIndex);
    row.appendChild(dot);

    // Ticks-per-beat
    const tpbWrap = document.createElement('label');
    tpbWrap.className = 'tpb-wrap';

    const tpbLabel = document.createElement('span');
    tpbLabel.className = 'dim';
    tpbLabel.textContent = 'tpb';

    const tpbInput = document.createElement('input');
    tpbInput.type = 'text';
    tpbInput.className = 'tpb-input';
    tpbInput.value = String(track.ticksPerBeat);
    tpbInput.addEventListener('change', () => {
      const parsed = parseTpb(tpbInput.value);
      if (parsed === null) {
        // Restore previous valid value on bad input.
        tpbInput.value = String(track.ticksPerBeat);
        return;
      }
      const val = Math.max(0.25, Math.min(16, parsed));
      tpbInput.value = String(val);
      this.patchTrack(voiceId, trackIndex, { ticksPerBeat: val });
    });

    tpbWrap.append(tpbLabel, tpbInput);
    row.appendChild(tpbWrap);

    // Offset (immediately after tpb, expands to fill available space)
    const offWrap = document.createElement('label');
    offWrap.className = 'off-wrap';

    const offLabel = document.createElement('span');
    offLabel.className = 'dim';
    offLabel.textContent = 'off';

    const offSlider = document.createElement('input');
    offSlider.type = 'range';
    offSlider.className = 'off-slider';
    offSlider.min = '0';
    offSlider.max = '1';
    offSlider.step = '0.01';
    offSlider.value = String(track.offset);

    const offVal = document.createElement('span');
    offVal.className = 'off-val dim';
    offVal.textContent = track.offset.toFixed(2);

    offSlider.addEventListener('input', () => {
      const raw = parseFloat(offSlider.value);
      const snapped = shiftHeld ? quantizeOffset(raw, OFFSET_SNAPS) : null;
      const val = snapped?.value ?? raw;
      offVal.textContent = snapped?.label ?? raw.toFixed(2);
      offSlider.value = String(val);
      this.patchTrack(voiceId, trackIndex, { offset: val });
    });

    offWrap.append(offLabel, offSlider, offVal);
    row.appendChild(offWrap);

    // Amplitude (far right)
    const ampWrap = document.createElement('label');
    ampWrap.className = 'amp-wrap';

    const ampSlider = document.createElement('input');
    ampSlider.type = 'range';
    ampSlider.className = 'amp-slider';
    ampSlider.min = String(MIN_DB);
    ampSlider.max = '0';
    ampSlider.step = '1';
    ampSlider.value = String(gainToDb(track.amplitude));

    const ampVal = document.createElement('span');
    ampVal.className = 'amp-val dim';
    ampVal.textContent = fmtDb(gainToDb(track.amplitude));

    ampSlider.addEventListener('input', () => {
      const db = parseFloat(ampSlider.value);
      ampVal.textContent = fmtDb(db);
      this.patchTrack(voiceId, trackIndex, { amplitude: dbToGain(db) });
    });

    ampWrap.append(ampSlider, ampVal);
    row.appendChild(ampWrap);

    // Remove track
    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-icon';
    btnRemove.title = 'Remove track';
    btnRemove.textContent = '✕';
    btnRemove.style.visibility = trackCount <= 1 ? 'hidden' : 'visible';
    btnRemove.addEventListener('click', () => {
      this.store.setState(prev => ({
        ...prev,
        voices: prev.voices.map(v =>
          v.id === voiceId
            ? { ...v, tracks: v.tracks.filter((_, i) => i !== trackIndex) }
            : v
        ),
      }));
      if (this.isPlaying) {
        this.engine.updateState(this.store.getState());
      }
      this.renderVoices();
    });
    row.appendChild(btnRemove);

    return row;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private patchTrack(voiceId: string, trackIndex: number, patch: Partial<Track>): void {
    this.store.setState(prev => ({
      ...prev,
      voices: prev.voices.map(v =>
        v.id === voiceId
          ? { ...v, tracks: v.tracks.map((t, i) => (i === trackIndex ? { ...t, ...patch } : t)) }
          : v
      ),
    }));
    if (this.isPlaying) {
      this.engine.updateState(this.store.getState());
    }
  }

  private addVoice(): void {
    const id = newVoiceId();
    this.store.setState(prev => ({
      ...prev,
      voices: [
        ...prev.voices,
        { id, sound: 36, tracks: [{ ticksPerBeat: 1, amplitude: 0.8, offset: 0 }] },
      ],
    }));
    if (this.isPlaying) {
      this.engine.updateState(this.store.getState());
    }
    this.renderVoices();
  }

  private flashTrack(voiceId: string, trackIndex: number): void {
    const dot = this.voicesEl.querySelector<HTMLElement>(
      `.hit-dot[data-voice-id="${voiceId}"][data-track-index="${trackIndex}"]`
    );
    if (!dot) {
      return;
    }
    dot.classList.add('flash');
    setTimeout(() => dot.classList.remove('flash'), 80);
  }

  private mkBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private syncSettingsControls(settings: AppState['settings']): void {
    this.bpmSlider.value = String(settings.bpm);
    this.bpmDisplay.textContent = String(settings.bpm);
    const db = gainToDb(settings.masterVolume);
    this.volSlider.value = String(db);
    this.volDisplay.textContent = fmtDb(db);
  }

  // ── File save / load ─────────────────────────────────────────────────────

  private saveToFile(): void {
    const state = this.store.getState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polythm.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadFromFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { return; }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const parsed = JSON.parse(reader.result as string) as AppState;
          if (!this.isValidState(parsed)) {
            console.error('Invalid Polythm state file.');
            return;
          }
          this.store.setState(() => parsed);
          if (this.isPlaying) { this.engine.updateState(parsed); }
          this.syncSettingsControls(parsed.settings);
          this.renderVoices();
        } catch (err) {
          console.error('Failed to load state file:', err);
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  /** Lightweight structural validation so bad files fail loudly. */
  private isValidState(s: unknown): s is AppState {
    if (typeof s !== 'object' || s === null) { return false; }
    const obj = s as Record<string, unknown>;
    if (typeof obj['settings'] !== 'object' || obj['settings'] === null) { return false; }
    const settings = obj['settings'] as Record<string, unknown>;
    if (typeof settings['bpm'] !== 'number') { return false; }
    if (typeof settings['masterVolume'] !== 'number') { return false; }
    if (!Array.isArray(obj['voices'])) { return false; }
    for (const v of obj['voices'] as unknown[]) {
      if (typeof v !== 'object' || v === null) { return false; }
      const voice = v as Record<string, unknown>;
      if (typeof voice['id'] !== 'string') { return false; }
      if (typeof voice['sound'] !== 'number') { return false; }
      if (!Array.isArray(voice['tracks'])) { return false; }
      for (const t of voice['tracks'] as unknown[]) {
        if (typeof t !== 'object' || t === null) { return false; }
        const track = t as Record<string, unknown>;
        if (typeof track['ticksPerBeat'] !== 'number') { return false; }
        if (typeof track['amplitude'] !== 'number') { return false; }
      }
    }
    return true;
  }

  private mkSliderRow(
    labelText: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (val: number) => void,
    format: (v: number) => string = (v) => String(v),
  ): { row: HTMLElement; slider: HTMLInputElement; display: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const lbl = document.createElement('span');
    lbl.className = 'setting-label';
    lbl.textContent = labelText;
    row.appendChild(lbl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initial);
    row.appendChild(slider);

    const display = document.createElement('span');
    display.className = 'setting-value';
    display.textContent = format(initial);
    row.appendChild(display);

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      display.textContent = format(val);
      onChange(val);
    });

    return { row, slider, display };
  }
}
