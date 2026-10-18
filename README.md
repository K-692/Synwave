<div align="center">

  <img src="icon.png" alt="Synwave Logo" width="160" height="160" style="border-radius: 28px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.45); margin-bottom: 16px;" />

  # SYNWAVE
  
  **Open-Source Procedural Audio-Reactive Music Visualizer & Local Audio Player**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
  [![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

  <p align="center">
    A cross-platform, local-first audiovisual application that generates real-time, genre-agnostic 3D procedural visuals synchronized to your local audio tracks — with zero stock footage or pre-rendered videos.
  </p>

</div>

---

## 🌟 Overview

**Synwave** transforms any local audio file or folder into an immersive, living audiovisual experience. Unlike conventional visualizers that loop pre-rendered video clips or draw simple 2D spectrum bars, Synwave generates **100% of its visual scenes procedurally at runtime** using GPU shaders, particles, dynamic 3D geometry, and real-time audio signal analysis.

### Core Principles
- **Music Festival Concert Experience:** Transforms high-energy tracks and melodic dubstep drops into an electrifying festival light show with 32-beam concert laser rigs, scissor cuts, liquid sky sheets, drum-kick window blinder flashes, and camera bass rumble.
- **Dual Aesthetic Universes (Calm vs Festival):** Automatically distinguishes calm acoustic songs (e.g. *Aaloshyo*) with serene celestial auroras, floating stardust, and warm candlelight hues from high-energy festival dubstep (e.g. *Feel Something*) with blazing lasers, strobe blinders, and explosive bass shockwaves.
- **Bass-Activated Particle Dynamics:** 4,000+ sparks receiving explosive radial velocity on drum kicks and sub-bass impacts — replacing aimless floating particles with high-energy physical shockwaves.
- **Open Center Stage Architecture:** Eliminates awkward center wireframe clutter, keeping the arena wide open for sweeping lasers, particle detonations, and horizon skylines.
- **Spacebar Play/Pause & Native Fullscreen:** Instant `Space` keyboard transport toggle, `F` key or canvas double-click for full-bleed native fullscreen.
- **Zero-Gap Edge-Attached UI:** Minimalist top and bottom bars attached directly to window boundaries with intelligent independent hover auto-hide zones.
- **Dual-Path Audio Processing:** Combines offline predictive pre-analysis (BPM candidate estimation, dynamic range, section boundaries) with an authoritative live Web Audio playback clock.

---

## 🚀 Key Features

- **Festival Concert Laser Rig:** 28–36 volumetric beams across overhead truss, side scissor towers, and floor uplights. Scissor cross cuts, horizon fan sweeps, liquid sky sheets, and drop frenzy strobes.
- **Drum Kick Window Blinder Flash:** High-impact full-window blinder flashes on drum kicks and synchronized strobe sequences during festival drops.
- **Bass-Activated Shockwave Particles:** Radial detonations on bass kicks, sub-bass expansion, and fluid drag deceleration.
- **Calm Acoustic Sanctuary:** Dedicated peaceful world for calm, vocal, and acoustic tracks with fluid silk ribbons and breathing stardust.
- **Local Music Library & Queue:** Ingest single audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) or import entire music directories via native folder selection or drag-and-drop.
- **Precision Transport Controls:** Play/Pause (`Space`), Next/Previous, Shuffle, Repeat (Off, One, All), Volume, Mute, and an interactive seek bar with live hover timestamp preview and section markers.
- **Live Signal & Visual Inspector:** Real-time 64-band FFT frequency spectrum, PCM time-domain oscilloscope, multi-band gauges (RMS, Sub-bass, Mid, Treble, Spectral Brightness), and detected BPM readout.
- **Full-Bleed Fullscreen Mode:** Toggle native fullscreen with `F`, the fullscreen icon, or double-clicking the visualizer canvas.

---

## 🎨 Curated Concert Scenes & Effects

| Scene | Aesthetic Universe | Effect Composition | Experience |
|---|---|---|---|
| **FESTIVAL ARENA** | Festival Stage | `terrain-grid` + `laser-beams` + `starfield-warp` + `spectrum-bars` + `shockwave-rings` | Slicing concert lasers over reflective arena floor with horizon audio skyline and bass shockwaves. |
| **DROP FRENZY** | Climax Drop | `laser-beams` + `starfield-warp` + `shockwave-rings` + `terrain-grid` | 32-beam high-speed scissor cuts, 180° sweeps, window strobe blinders, and explosive particle detonations. |
| **CELESTIAL SANCTUARY** | Calm Acoustic | `audio-ribbons` + `starfield-warp` + `waveform-ring` | Serene flowing aurora ribbons, gentle breathing stardust, and calm waveform ripples. |
| **LASER CATHEDRAL** | Laser Focus | `laser-beams` + `starfield-warp` + `spectrum-bars` + `shockwave-rings` | Dense overhead laser fans and scissor rays cutting through concert haze. |
| **HORIZON EQUALIZER** | Groove / Verse | `terrain-grid` + `spectrum-bars` + `starfield-warp` + `laser-beams` | Ambient synthwave horizon with bass mountain flanks and skyline frequency bars. |

---

## 📐 Architecture & Signal Processing

```text
                                  ┌───────────────────────────┐
                                  │   Synwave User Interface  │
                                  │  (React 19 + TypeScript)  │
                                  │  Glassmorphism Dark Theme │
                                  └─────────────┬─────────────┘
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          │                                           │
                          ▼                                           ▼
            ┌───────────────────────────┐               ┌───────────────────────────┐
            │   Playback & Audio Engine │               │   Offline Analysis Worker │
            │  - Web Audio AnalyserNode │               │  - AudioBuffer Decoding   │
            │  - Master Clock (Source)  │               │  - RMS & Spectral Bands   │
            │  - Dual Time/Freq Buffers │               │  - Beat & Transient Det.  │
            └─────────────┬─────────────┘               │  - Deterministic Plan     │
                          │                             └─────────────┬─────────────┘
                          │ live features                             │ cached plan
                          └─────────────────────┬─────────────────────┘
                                                ▼
                                  ┌───────────────────────────┐
                                  │   Smart Scene Choreography│
                                  │  - 8 Curated Compositions │
                                  │  - Mood Color Transition  │
                                  │  - Section-Driven Director│
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │   Procedural Three.js     │
                                  │     Render Pipeline       │
                                  │  - 100+ Effect Permutations│
                                  │  - ACES Tone Mapping      │
                                  └───────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Frontend & UI:** React 19, TypeScript, Lucide Icons
- **Styling:** Vanilla CSS (Glassmorphism, Neon Cyberpunk design system, zero UI bloat)
- **3D Graphics & Rendering:** Three.js, WebGL2, GLSL Shaders
- **Audio Processing:** Web Audio API (`AudioContext`, `AnalyserNode`, `AudioBuffer`)
- **Build Tooling:** Vite 8.3

---

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- npm, pnpm, or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/K-692/Synwave.git
cd Synwave

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will start at `http://localhost:5173/`.

### Production Build
```bash
npm run build
```

---

## 📂 Repository Structure

```text
Synwave/
├── icon.png                                <-- Official application branding icon
├── public/
│   ├── icon.png                            <-- Web favicon and touch icon
│   └── favicon.svg
├── src/
│   ├── audio/
│   │   ├── AudioEngine.ts                  <-- Web Audio API live graph & master clock
│   │   └── AudioAnalyzer.ts                <-- Headless offline PCM pre-analysis & segmentation
│   ├── visualizer/
│   │   ├── VisualEngine.ts                 <-- Three.js scene, dynamic camera, smart director
│   │   ├── palettes.ts                     <-- Curated aesthetic color themes
│   │   └── effects/
│   │       ├── BaseEffect.ts               <-- Common lifecycle, PRNG, and disposal
│   │       ├── TerrainGridEffect.ts        <-- Retro synthwave horizon grid
│   │       ├── TorusKnotEffect.ts          <-- Mathematical 3D morphing torus knot
│   │       ├── DNAHelixEffect.ts           <-- Procedural rotating double helix
│   │       ├── ParticleVortexEffect.ts     <-- Logarithmic singularity spiral vortex
│   │       ├── StarfieldEffect.ts          <-- Hyperspace warp particle field
│   │       ├── WireframeCoreEffect.ts      <-- Audio-displaced crystalline polyhedron
│   │       ├── WaveformRingEffect.ts       <-- Real-time 3D PCM circular oscilloscope
│   │       ├── SpectrumBarsEffect.ts       <-- Horizon audio equalizer skyline
│   │       ├── AudioRibbonsEffect.ts       <-- Sinusoidal flowing fluid ribbons
│   │       ├── LaserBeamsEffect.ts         <-- Overhead concert stadium laser fans
│   │       └── ShockwaveRingEffect.ts      <-- Expanding chromatic shockwave pulses
│   ├── components/
│   │   ├── Header.tsx                      <-- Top bar (attached flush, auto-hides)
│   │   ├── PlayerControls.tsx              <-- Bottom dock (attached flush, auto-hides)
│   │   ├── PlaylistDrawer.tsx              <-- Queue list, search filter, analysis status
│   │   ├── InspectorDrawer.tsx             <-- Live 64-band FFT canvas, oscilloscope, telemetry
│   │   └── TrackWatermark.tsx              <-- Cinematic on-canvas HUD watermark
│   ├── types/
│   │   └── index.ts                        <-- System-wide TypeScript contracts
│   ├── index.css                           <-- Cyberpunk Glassmorphism Design System
│   ├── App.tsx                             <-- Application root coordinator
│   └── main.tsx
├── Synwave_procedural_music_visualizer_blueprint.md
├── flow.md                                 <-- Architectural journey & research notes
├── package.json
└── vite.config.ts
```

---

## 📄 License

This project is licensed under the **MIT License**.
