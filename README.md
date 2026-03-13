# polythm
Polythm: A Browser‑Based Polyrhythmic Rhythm Generator

`polythm` is a browser‑based, interactive rhythm engine designed for exploring complex, evolving polyrhythms. It emphasizes continuous time, fractional subdivisions, and a scrolling “tape‑deck” visualization rather than traditional loop‑based sequencing. The tool is intended as a creative playground for musicians, composers, and rhythm enthusiasts.

## Core Concepts

### Global Settings
The system maintains global musical parameters that affect all voices:

    Tempo (BPM)
    Beats per measure (meter)
    Swing % (planned but not yet implemented)
    Add / delete voices
    Playback controls: play, pause, rewind
    Scrolling timeline: the visualization moves continuously under a fixed playhead

Unlike a looped sequencer, the system does not require a fixed number of measures. Time is effectively infinite, and patterns drift naturally.

## Voices
A voice represents a single percussion instrument with its own mix settings. Initially, each voice simply selects a different sample. Eventually, voices will support:

    Assigned sample (kick, snare, cowbell, etc.)
    Volume
    Panning
    Mute / Solo
    Each voice contains one or more tracks, which generate rhythmic events.

## Tracks
Tracks define the rhythmic logic within a voice. Each track has:

Ticks per beat, which can be fractional (e.g., 2.5), producing drifting, non‑repeating patterns
Events occur at absolute beat positions:

e.g., 2.5 ticks/beat → 0, 0.4, 0.8, 1.2, 1.6, 2.0, …
Amplitude (0–1)
Delay (0–1 beats)
Color (for visualization)
Tracks within a voice share the same instrument but can have independent timing and amplitude.
When multiple tracks fire at the same moment, their amplitudes sum and clamp at 1.0.

## Visualization Model
Scrolling “Tape‑Deck” Interface
The visualization uses a fixed playhead with the world scrolling underneath it:

Measure lines and beat markers move under the playhead.
Events (ticks) appear as fixed‑width vertical bars:x‑position = beat position (scaled by zoom)
height = amplitude
color = track identity
Zooming adjusts the horizontal scale (beats → pixels), not bar width.
This creates a stable, intuitive view of drifting polyrhythms.

### Future Enhancements
Jog (small nudges)
Shuttle (variable‑speed scrolling)
Scrub (drag timeline directly)
These fit naturally into the scrolling model and can be added later.

## Audio Engine
Playback
Uses Web Audio API scheduling for “good enough for practice” timing.
Preloaded percussion samples provide the sound palette.
Voices mix together into a stereo output.
Export
MIDI export:One MIDI track per voice
Events placed at exact beat‑derived timestamps
Audio export:Single stereo mixdown
Offline rendering for sample‑accurate timing

## Interaction Model
Version 0.1
Numeric inputs for:ticks per beat
amplitude
delay
voice/sample selection
Basic playback controls
Zoom in/out
Add/delete voices and tracks
Later Versions
Click‑and‑drag editing of events
Optional quantization
Direct manipulation of timeline (scrub, jog, shuttle)

## Presets
Presets capture the entire system state:

Global settings
Voices and their mix settings
Tracks and their parameters
Colors and visualization settings
Zoom level
Playback position is not saved.

## Overall Identity
This tool is not a drum machine.

It’s a creative polyrhythm explorer — a way to visualize, hear, and experiment with drifting, evolving rhythmic structures that don’t fit neatly into loops.
It’s built around:

continuous time
fractional subdivisions
emergent rhythmic behavior
a scrolling, dynamic visualization
The result is an instrument for discovering patterns you wouldn’t think to program manually.

