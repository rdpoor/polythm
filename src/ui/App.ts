import type { AppState, Track } from '../model/types.js';
import type { StateStore } from '../state/store.js';
import type { AudioEngine } from '../engine/AudioEngine.js';

const SOUNDS: Track['sound'][] = ['kick', 'snare', 'hihat', 'click'];

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

    settings.appendChild(
      this.mkSliderRow('BPM', 40, 240, 1, bpm, (val) => {
        this.patchSettings({ bpm: val });
      })
    );
    settings.appendChild(
      this.mkSliderRow('VOL', 0, 1, 0.05, masterVolume, (val) => {
        this.patchSettings({ masterVolume: val });
      }, (v) => `${Math.round(v * 100)}%`)
    );

    header.appendChild(settings);

    const btnHelp = document.createElement('button');
    btnHelp.className = 'btn-help';
    btnHelp.textContent = '?';
    btnHelp.title = 'Help';
    btnHelp.addEventListener('click', () => {
      (document.getElementById('help-dialog') as HTMLDialogElement).showModal();
    });
    header.appendChild(btnHelp);

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
      ['VOL', 'Master output volume.'],
    ]));

    panel.appendChild(this.helpSection('Voices', [
      ['Voice', 'An independent rhythmic stream. Each voice contains one or more tracks that play simultaneously.'],
      ['M', 'Mute — silence this voice. Other voices continue playing.'],
      ['S', 'Solo — play only this voice (and any other soloed voices). Multiple voices can be soloed at once.'],
      ['+ Add Voice', 'Append a new voice with a single kick track.'],
      ['✕ (voice)', 'Remove that voice entirely. Disabled when only one voice remains.'],
    ]));

    panel.appendChild(this.helpSection('Tracks', [
      ['Sound', 'Synthesized drum sound: kick · snare · hihat · click.'],
      ['tpb', 'Ticks per beat — how many evenly-spaced hits this track fires per beat.\nAccepts integers ("3"), decimals ("2.333"), fractions ("7/3"), or mixed numbers ("2 1/3").\nRange: 0.25 – 16.'],
      ['Amplitude', 'Per-track volume (0 – 1). The coloured dot on the left flashes on every hit.'],
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
            ? { ...v, tracks: [...v.tracks, { sound: 'hihat' as const, ticksPerBeat: 2, amplitude: 0.5 }] }
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

    // Sound select
    const soundSel = document.createElement('select');
    soundSel.className = 'sound-select';
    for (const s of SOUNDS) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      opt.selected = s === track.sound;
      soundSel.appendChild(opt);
    }
    soundSel.addEventListener('change', () => {
      this.patchTrack(voiceId, trackIndex, { sound: soundSel.value as Track['sound'] });
    });
    row.appendChild(soundSel);

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

    // Amplitude
    const ampWrap = document.createElement('label');
    ampWrap.className = 'amp-wrap';

    const ampSlider = document.createElement('input');
    ampSlider.type = 'range';
    ampSlider.className = 'amp-slider';
    ampSlider.min = '0';
    ampSlider.max = '1';
    ampSlider.step = '0.05';
    ampSlider.value = String(track.amplitude);

    const ampVal = document.createElement('span');
    ampVal.className = 'amp-val dim';
    ampVal.textContent = track.amplitude.toFixed(2);

    ampSlider.addEventListener('input', () => {
      const val = parseFloat(ampSlider.value);
      ampVal.textContent = val.toFixed(2);
      this.patchTrack(voiceId, trackIndex, { amplitude: val });
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
        { id, tracks: [{ sound: 'kick' as const, ticksPerBeat: 1, amplitude: 0.8 }] },
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

  private mkSliderRow(
    labelText: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (val: number) => void,
    format: (v: number) => string = (v) => String(v),
  ): HTMLElement {
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

    return row;
  }
}
