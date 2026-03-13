# Polythm

A browser-based polyrhythm explorer built with the Web Audio API and TypeScript.

## Overview

Most rhythm tools think in loops. You pick a time signature, fill in a grid, and the pattern repeats. Polythm works differently: time flows continuously, and every track fires at its own independent rate measured in **ticks per beat**. There is no loop boundary, no bar line that forces everything back to the start.

The interesting territory opens up when ticks per beat is fractional. A track set to `7/3` fires seven times every three beats — a rate that doesn't align cleanly with most others. Pair it with a track at `5/4` and neither pattern ever lands on the same beat twice in a short span. The rhythms interlock, drift apart, and converge again over long stretches of time. This is the core idea: emergent rhythmic complexity from simple numeric ratios, rather than from manually placed notes.

### Voices and Tracks

A **voice** is a single percussion instrument — one of 47 GM percussion sounds, from bass drum to open triangle. Each voice can hold multiple **tracks**, all sharing the same sound but firing at different rates and levels. Stacking a slow track with a fast one on the same voice creates internal rhythmic texture within a single instrument.

Voices can be muted or soloed independently, so you can isolate parts of a composite rhythm and hear what each layer is contributing.

### Phase Offset

Every track has a **phase offset** (0–1). An offset of `0.5` shifts every hit by half of the track's period — half of `1 / ticks-per-beat` beats. This lets you displace a track in time relative to beat zero without changing its rate. Offset is continuous, but holding Shift while dragging snaps it to musically useful fractions: `0`, `1/2`, `1/3`, `2/3`, `1/4`, and so on.

### What it is not

Polythm is not a drum machine. There is no grid, no quantization, no fixed pattern length. It doesn't export MIDI or audio. It is a listening and exploration tool — a way to set rhythms in motion and hear what they do over time.

---

## Features

- **47 GM percussion sounds** (MIDI notes 35–81), synthesized in-browser via Web Audio API
- **Fractional ticks per beat** — integers, decimals, fractions (`7/3`), and mixed numbers (`2 1/3`)
- **Phase offset** per track with Shift+drag snap-to-fraction
- **Per-track amplitude** in dB with true silence at −60 dB
- **Multiple tracks per voice** — independent rates and levels, same instrument
- **Mute / Solo** per voice
- **Save / Load** session as JSON
- **Space bar** toggles play/pause

---

## Requirements

[Node.js](https://nodejs.org) (v18+) or [Bun](https://bun.sh) (v1+).

## Install

```bash
git clone https://github.com/your-username/polythm.git
cd polythm
npm install        # or: bun install
```

## Run

```bash
npm run dev        # or: bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build      # or: bun run build
```

Output goes to `dist/`. Serve it with any static file server:

```bash
npx serve dist
```

---

## Getting Started

When you open Polythm you'll see two voices already configured — a bass drum and a snare — each with two tracks running at different rates. Press **▶** (or hit **Space**) to start playback and listen to how the parts interact.

A good first experiment: change the **ticks per beat** values and notice what happens. Try setting voice 1, track 1 to `3` and voice 2, track 1 to `4`. You'll hear a classic three-against-four polyrhythm. Change one value to `3.5` and the pattern stops repeating in any short window — it drifts.

The dot on the left of each track flashes on every hit, so you can watch the rhythms visually even if the sounds blur together.

When you find something you want to keep, use **⬇ Save** to download the session as a JSON file. **⬆ Load** restores it later.

---

## How To

### Set a ticks-per-beat value

Click the `tpb` field on any track and type a value. Accepted formats:

| Input | Meaning |
|---|---|
| `3` | 3 ticks per beat |
| `2.5` | 2.5 ticks per beat |
| `7/3` | seven thirds ticks per beat |
| `2 1/3` | two and one-third ticks per beat |

Range is 0.25–16. Press Enter or click away to apply. Invalid input reverts to the previous value.

### Adjust volume

The amplitude slider on each track operates in dB. Drag left to reduce level; the display reads `−∞` at true silence (−60 dB). The master volume slider in the header scales all voices together.

### Shift a track in time

Drag the **off** slider to add a phase offset (0–1). Hold **Shift** while dragging to snap to common fractions (halves, thirds, quarters, sixths, eighths). The label updates to show the fraction in lowest terms (`1/3`, `3/4`, etc.).

### Add and remove tracks

Click **+ Add Track** at the bottom of a voice panel to append a new track to that voice. Click **✕** on a track row to remove it (disabled when only one track remains).

### Add and remove voices

Click **+ Add Voice** at the bottom of the page to create a new voice. Click **✕** in a voice header to remove it (disabled when only one voice remains).

### Mute and solo voices

- **M** silences a voice while leaving all others playing.
- **S** solos a voice — only soloed voices play. Multiple voices can be soloed at once.

### Save and load a session

**⬇ Save** downloads the current state as `polythm.json`. **⬆ Load** opens a file picker; selecting a previously saved file replaces the current session immediately. Sessions also auto-save to browser local storage, so reloading the page restores where you left off.

### Keyboard shortcut

**Space** toggles play/pause as long as no text field is focused.
