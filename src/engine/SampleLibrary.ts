const CDN_BASE = 'https://surikov.github.io/webaudiofontdata/sound';
const GM_PERC_NOTES = Array.from({ length: 47 }, (_, i) => i + 35); // 35–81

// Matches the raw base64 audio value in the JS zone object.
// Actual format is: file:'SUQz...' (single quotes, no data: prefix).
const FILE_RE = /\bfile\s*:\s*['"]([^'"]+)['"]/;

/**
 * Loads GM percussion samples from the surikov/webaudiofont CDN and caches
 * decoded AudioBuffers by MIDI note. Falls back to synthesis if loading fails.
 *
 * Each note lives in its own JS file (128{note}_0_FluidR3_GM_sf2_file.js).
 * We fetch the JS as text, extract the raw base64 with a regex (no eval),
 * and decode it with decodeAudioData. All 47 notes are fetched in parallel.
 */
export class SampleLibrary {
  private buffers = new Map<number, AudioBuffer>();
  private started = false;

  /** Returns a decoded AudioBuffer, or null if not yet loaded (caller uses synthesis). */
  getBuffer(note: number): AudioBuffer | null {
    return this.buffers.get(note) ?? null;
  }

  /** Fire-and-forget after AudioContext is created. Safe to call multiple times. */
  load(ctx: AudioContext): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const fetches = GM_PERC_NOTES.map((note) =>
      this._loadNote(ctx, note).catch(() => {
        // Per-note failure: synthesis handles this note.
      })
    );
    Promise.all(fetches).catch((err) => {
      console.error('SampleLibrary: unexpected error during load', err);
    });
  }

  private async _loadNote(ctx: AudioContext, note: number): Promise<void> {
    const url = `${CDN_BASE}/128${note}_0_FluidR3_GM_sf2_file.js`;
    const text = await fetch(url).then((r) => {
      if (!r.ok) {
        throw new Error(`SampleLibrary: HTTP ${r.status} for note ${note}`);
      }
      return r.text();
    });

    const match = FILE_RE.exec(text);
    if (!match) {
      throw new Error(`SampleLibrary: no file field found for note ${note}`);
    }

    const buf = await this._decodeBase64(ctx, match[1]!);
    this.buffers.set(note, buf);
  }

  private async _decodeBase64(ctx: AudioContext, base64: string): Promise<AudioBuffer> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return ctx.decodeAudioData(bytes.buffer);
  }
}
