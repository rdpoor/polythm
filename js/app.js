/**
 * app.js – Main application wiring
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Core objects ──────────────────────────────────────────────────────────
  const engine  = new RhythmEngine();
  const audio   = new AudioEngine(engine);
  const canvas  = document.getElementById('viz-canvas');
  const viz     = new Visualizer(canvas, engine);
  const presets = new Presets();

  let audioInitialized = false;

  // ── Sample options (must be defined before renderVoices) ─────────────────
  const SAMPLE_OPTIONS = [
    { value: 'kick',         label: 'Kick' },
    { value: 'snare',        label: 'Snare' },
    { value: 'hihat_closed', label: 'Hi-Hat (closed)' },
    { value: 'hihat_open',   label: 'Hi-Hat (open)' },
    { value: 'cowbell',      label: 'Cowbell' },
    { value: 'tom',          label: 'Tom' },
    { value: 'rim',          label: 'Rim' },
    { value: 'clap',         label: 'Clap' }
  ];

  // ── Default voices ────────────────────────────────────────────────────────
  const v1 = engine.addVoice({ name: 'Kick', sampleType: 'kick' });
  engine.addTrack(v1.id, { ticksPerBeat: 1, amplitude: 0.9, delay: 0, color: '#ff6b6b' });

  const v2 = engine.addVoice({ name: 'Snare', sampleType: 'snare' });
  engine.addTrack(v2.id, { ticksPerBeat: 0.5, amplitude: 0.7, delay: 0.5, color: '#4ecdc4' });

  const v3 = engine.addVoice({ name: 'Hi-Hat', sampleType: 'hihat_closed' });
  engine.addTrack(v3.id, { ticksPerBeat: 2, amplitude: 0.5, delay: 0, color: '#f9ca24' });

  renderVoices();

  // ── Global settings ───────────────────────────────────────────────────────
  const inputBpm   = document.getElementById('input-bpm');
  const inputMeter = document.getElementById('input-meter');

  inputBpm.addEventListener('change', () => {
    const val = parseFloat(inputBpm.value);
    if (!isNaN(val) && val >= 20 && val <= 300) {
      engine.bpm = val;
      audio.notifyBpmChanged();
    }
  });

  inputMeter.addEventListener('change', () => {
    const val = parseInt(inputMeter.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 16) {
      engine.meter = val;
    }
  });

  // ── Transport ─────────────────────────────────────────────────────────────
  const btnPlay   = document.getElementById('btn-play');
  const btnPause  = document.getElementById('btn-pause');
  const btnRewind = document.getElementById('btn-rewind');

  btnPlay.addEventListener('click', () => {
    if (!audioInitialized) {
      audio.init();
      audioInitialized = true;
    }
    audio.play();
    btnPlay.disabled  = true;
    btnPause.disabled = false;
  });

  btnPause.addEventListener('click', () => {
    audio.pause();
    btnPlay.disabled  = false;
    btnPause.disabled = true;
  });

  btnRewind.addEventListener('click', () => {
    audio.rewind();
    if (!audio.playing) {
      btnPlay.disabled  = false;
      btnPause.disabled = true;
    }
  });

  // ── Zoom ──────────────────────────────────────────────────────────────────
  document.getElementById('btn-zoom-in').addEventListener('click',  () => viz.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => viz.zoomOut());

  // ── Presets ───────────────────────────────────────────────────────────────
  document.getElementById('btn-save-preset').addEventListener('click', () => {
    openSavePresetModal();
  });

  document.getElementById('btn-load-preset').addEventListener('click', () => {
    openLoadPresetModal();
  });

  document.getElementById('btn-export-preset').addEventListener('click', () => {
    const name = prompt('Export preset name:', 'my-preset') || 'polythm-preset';
    presets.exportJSON(name, engine.getState());
  });

  document.getElementById('btn-import-preset').addEventListener('click', () => {
    document.getElementById('input-import-file').click();
  });

  document.getElementById('input-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const state = presets.importJSON(ev.target.result);
        engine.loadState(state);
        syncGlobalUI();
        renderVoices();
      } catch (err) {
        alert('Failed to import preset: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ── Add voice ─────────────────────────────────────────────────────────────
  document.getElementById('btn-add-voice').addEventListener('click', () => {
    engine.addVoice();
    renderVoices();
  });

  // ── Modal ─────────────────────────────────────────────────────────────────
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose   = document.getElementById('modal-close');
  const modalTitle   = document.getElementById('modal-title');
  const modalBody    = document.getElementById('modal-body');

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  function openSavePresetModal() {
    modalTitle.textContent = 'Save Preset';
    modalBody.innerHTML = '';

    const saveRow = document.createElement('div');
    saveRow.className = 'modal-save-row';

    const input = document.createElement('input');
    input.type        = 'text';
    input.className   = 'modal-save-input';
    input.placeholder = 'Preset name…';
    input.value       = '';

    const btn = document.createElement('button');
    btn.className   = 'modal-save-btn';
    btn.textContent = 'Save';

    btn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      presets.save(name, engine.getState());
      closeModal();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    saveRow.appendChild(input);
    saveRow.appendChild(btn);
    modalBody.appendChild(saveRow);

    modalOverlay.classList.remove('hidden');
    input.focus();
  }

  function openLoadPresetModal() {
    modalTitle.textContent = 'Load Preset';
    modalBody.innerHTML = '';

    const names = presets.list();

    if (names.length === 0) {
      const empty = document.createElement('p');
      empty.className   = 'modal-empty';
      empty.textContent = 'No saved presets yet.';
      modalBody.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'modal-preset-list';

      for (const name of names) {
        const item = document.createElement('div');
        item.className = 'modal-preset-item';

        const label = document.createElement('span');
        label.className   = 'modal-preset-name';
        label.textContent = name;

        const loadBtn = document.createElement('button');
        loadBtn.className   = 'modal-preset-load';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => {
          const state = presets.load(name);
          if (state) {
            engine.loadState(state);
            syncGlobalUI();
            renderVoices();
          }
          closeModal();
        });

        const delBtn = document.createElement('button');
        delBtn.className   = 'modal-preset-delete';
        delBtn.textContent = '✕';
        delBtn.title       = 'Delete';
        delBtn.addEventListener('click', () => {
          presets.delete(name);
          item.remove();
          if (list.children.length === 0) {
            list.remove();
            const empty = document.createElement('p');
            empty.className   = 'modal-empty';
            empty.textContent = 'No saved presets yet.';
            modalBody.appendChild(empty);
          }
        });

        item.appendChild(label);
        item.appendChild(loadBtn);
        item.appendChild(delBtn);
        list.appendChild(item);
      }
      modalBody.appendChild(list);
    }

    modalOverlay.classList.remove('hidden');
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    modalBody.innerHTML = '';
  }

  // ── Sync global UI from engine state ─────────────────────────────────────
  function syncGlobalUI() {
    inputBpm.value   = engine.bpm;
    inputMeter.value = engine.meter;
  }

  // ── Voice rendering ───────────────────────────────────────────────────────

  function renderVoices() {
    const list        = document.getElementById('voices-list');
    const scrollTop   = list.scrollTop;
    list.innerHTML    = '';

    for (const voice of engine.state.voices) {
      list.appendChild(buildVoiceCard(voice));
    }

    list.scrollTop = scrollTop;
  }

  function buildVoiceCard(voice) {
    const card = document.createElement('div');
    card.className = 'voice-card';
    card.dataset.voiceId = voice.id;

    // ── Voice header ────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'voice-header';

    // Name
    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'voice-name';
    nameInput.value       = voice.name;
    nameInput.placeholder = 'Voice name';
    nameInput.addEventListener('change', () => {
      engine.updateVoice(voice.id, { name: nameInput.value });
    });

    // Sample selector
    const sampleSel = document.createElement('select');
    sampleSel.className = 'voice-sample';
    for (const opt of SAMPLE_OPTIONS) {
      const el       = document.createElement('option');
      el.value       = opt.value;
      el.textContent = opt.label;
      if (opt.value === voice.sampleType) el.selected = true;
      sampleSel.appendChild(el);
    }
    sampleSel.addEventListener('change', () => {
      engine.updateVoice(voice.id, { sampleType: sampleSel.value });
    });

    // Volume
    const volLabel  = document.createElement('label');
    const volInput  = document.createElement('input');
    volInput.type   = 'range';
    volInput.className = 'voice-volume';
    volInput.min    = '0';
    volInput.max    = '1';
    volInput.step   = '0.01';
    volInput.value  = String(voice.volume);
    volInput.addEventListener('input', () => {
      engine.updateVoice(voice.id, { volume: parseFloat(volInput.value) });
    });
    volLabel.appendChild(document.createTextNode('Vol '));
    volLabel.appendChild(volInput);

    // Pan
    const panLabel  = document.createElement('label');
    const panInput  = document.createElement('input');
    panInput.type   = 'range';
    panInput.className = 'voice-pan';
    panInput.min    = '-1';
    panInput.max    = '1';
    panInput.step   = '0.02';
    panInput.value  = String(voice.pan);
    panInput.addEventListener('input', () => {
      engine.updateVoice(voice.id, { pan: parseFloat(panInput.value) });
    });
    panLabel.appendChild(document.createTextNode('Pan '));
    panLabel.appendChild(panInput);

    // Mute
    const muteBtn = document.createElement('button');
    muteBtn.className   = 'btn-mute' + (voice.mute ? ' active' : '');
    muteBtn.textContent = 'M';
    muteBtn.addEventListener('click', () => {
      // voice is the live engine state reference; updateVoice mutates it in-place
      engine.updateVoice(voice.id, { mute: !voice.mute });
      muteBtn.classList.toggle('active', voice.mute);
    });

    // Solo
    const soloBtn = document.createElement('button');
    soloBtn.className   = 'btn-solo' + (voice.solo ? ' active' : '');
    soloBtn.textContent = 'S';
    soloBtn.addEventListener('click', () => {
      // voice is the live engine state reference; updateVoice mutates it in-place
      engine.updateVoice(voice.id, { solo: !voice.solo });
      soloBtn.classList.toggle('active', voice.solo);
    });

    // Delete
    const delVoiceBtn       = document.createElement('button');
    delVoiceBtn.className   = 'btn-delete-voice';
    delVoiceBtn.textContent = '✕';
    delVoiceBtn.title       = 'Delete voice';
    delVoiceBtn.addEventListener('click', () => {
      engine.removeVoice(voice.id);
      card.remove();
    });

    header.appendChild(nameInput);
    header.appendChild(sampleSel);
    header.appendChild(volLabel);
    header.appendChild(panLabel);
    header.appendChild(muteBtn);
    header.appendChild(soloBtn);
    header.appendChild(delVoiceBtn);

    // ── Tracks ──────────────────────────────────────────────────────────────
    const tracksContainer = document.createElement('div');
    tracksContainer.className = 'tracks-container';

    for (const track of voice.tracks) {
      tracksContainer.appendChild(buildTrackRow(voice.id, track));
    }

    // Add track button
    const addTrackBtn       = document.createElement('button');
    addTrackBtn.className   = 'btn-add-track';
    addTrackBtn.textContent = '＋ Track';
    addTrackBtn.addEventListener('click', () => {
      const track = engine.addTrack(voice.id, {
        ticksPerBeat: 1,
        amplitude: 0.8,
        delay: 0
      });
      if (track) {
        tracksContainer.appendChild(buildTrackRow(voice.id, track));
      }
    });

    card.appendChild(header);
    card.appendChild(tracksContainer);
    card.appendChild(addTrackBtn);

    return card;
  }

  function buildTrackRow(voiceId, track) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.dataset.trackId = track.id;

    // Ticks per beat
    const tpbLabel = document.createElement('label');
    const tpbInput = document.createElement('input');
    tpbInput.type        = 'text';
    tpbInput.className   = 'track-tpb';
    tpbInput.value       = formatBeatValue(track.ticksPerBeat);
    tpbInput.placeholder = 'e.g. 2 2/3';
    tpbInput.addEventListener('change', () => {
      const val = parseBeatValue(tpbInput.value);
      if (isNaN(val) || val <= 0) {
        tpbInput.classList.add('error');
      } else {
        tpbInput.classList.remove('error');
        engine.updateTrack(voiceId, track.id, { ticksPerBeat: val });
        track.ticksPerBeat = val;
      }
    });
    tpbLabel.appendChild(document.createTextNode('Ticks/Beat '));
    tpbLabel.appendChild(tpbInput);

    // Amplitude
    const ampLabel = document.createElement('label');
    const ampInput = document.createElement('input');
    ampInput.type      = 'number';
    ampInput.className = 'track-amp';
    ampInput.min       = '0';
    ampInput.max       = '1';
    ampInput.step      = '0.01';
    ampInput.value     = String(track.amplitude);
    ampInput.addEventListener('change', () => {
      const val = parseFloat(ampInput.value);
      if (!isNaN(val)) {
        const clamped = Math.max(0, Math.min(1, val));
        ampInput.value = String(clamped);
        engine.updateTrack(voiceId, track.id, { amplitude: clamped });
        track.amplitude = clamped;
      }
    });
    ampLabel.appendChild(document.createTextNode('Amp '));
    ampLabel.appendChild(ampInput);

    // Delay
    const delayLabel = document.createElement('label');
    const delayInput = document.createElement('input');
    delayInput.type        = 'text';
    delayInput.className   = 'track-delay';
    delayInput.value       = formatBeatValue(track.delay);
    delayInput.placeholder = '0–1 beats';
    delayInput.addEventListener('change', () => {
      const val = parseBeatValue(delayInput.value);
      if (isNaN(val)) {
        delayInput.classList.add('error');
      } else {
        delayInput.classList.remove('error');
        engine.updateTrack(voiceId, track.id, { delay: val });
        track.delay = val;
      }
    });
    delayLabel.appendChild(document.createTextNode('Delay '));
    delayLabel.appendChild(delayInput);

    // Color
    const colorInput       = document.createElement('input');
    colorInput.type        = 'color';
    colorInput.className   = 'track-color';
    colorInput.value       = track.color;
    colorInput.addEventListener('input', () => {
      engine.updateTrack(voiceId, track.id, { color: colorInput.value });
      track.color = colorInput.value;
    });

    // Delete track
    const delBtn       = document.createElement('button');
    delBtn.className   = 'btn-delete-track';
    delBtn.textContent = '✕';
    delBtn.title       = 'Delete track';
    delBtn.addEventListener('click', () => {
      engine.removeTrack(voiceId, track.id);
      row.remove();
    });

    row.appendChild(tpbLabel);
    row.appendChild(ampLabel);
    row.appendChild(delayLabel);
    row.appendChild(colorInput);
    row.appendChild(delBtn);

    return row;
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  function loop() {
    const beat = audio.getCurrentBeat();
    viz.render(beat);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
