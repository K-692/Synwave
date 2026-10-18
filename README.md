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
- **100% Procedural Generation:** Stars, lasers, waveforms, polyhedral cores, fluid ribbons, retro grids, torus knots, and shockwave pulses are mathematically rendered live.
- **Smart Scene Choreographer:** Over 100 procedural effect combinations orchestrated across 8 curated cinematic scenes that crossfade dynamically on musical section transitions without visual clutter.
- **Automatic Mood-Driven Color Palette:** Real-time spectral analysis automatically determines and smoothly interpolates scene lighting, fog, and materials to match the track's emotional intensity.
- **Zero-Gap Edge-Attached UI:** Minimalist top and bottom bars attached directly to window boundaries with intelligent independent hover auto-hide zones.
- **Dual-Path Audio Processing:** Combines offline predictive pre-analysis (BPM candidate estimation, dynamic range, section boundaries) with an authoritative live Web Audio playback clock.

---

## 🚀 Key Features

- **Local Music Library & Queue:** Ingest single audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) or import entire music directories via native folder selection or drag-and-drop.
- **Smart Scene Choreographer:** Automatically sequences clean, non-competing effect compositions in sync with musical sections (`INTRO`, `BUILD`, `DROP / CLIMAX`, `BREAKDOWN`, `OUTRO`).
- **Precision Transport Controls:** Play/Pause, Next/Previous, Shuffle, Repeat (Off, One, All), Volume, Mute, and an interactive seek bar with live hover timestamp preview and section markers.
- **Live Signal & Visual Inspector:** Real-time 64-band FFT frequency spectrum, PCM time-domain oscilloscope, multi-band gauges (RMS, Sub-bass, Mid, Treble, Spectral Brightness), and detected BPM readout.
- **Performance Tiers:** Configurable quality presets (`Low`, `Medium`, `High 60 FPS`, `Ultra`) for integrated laptops up to dedicated desktop GPUs.

---

## 🎨 100+ Procedural Effects & Curated Scenes

Synwave organizes graphics across 11 core modular effect architectures, supporting over 100 distinctive parameter, geometry, and shader permutations:

| Effect | Family | Description |
|---|---|---|
| **Horizon Synthwave Grid** | Geometry & Terrains | Infinite retro wireframe grid extending into the horizon with audio mountain ridges undulating to bass. |
| **Morphing Torus Knot** | Mathematical Geometry | 3D mathematical knot with audio-driven radial displacement and continuous twisting. |
| **Double Helix Symphony** | Ribbons & Fluid Waves | Intertwined rotating double-helix strands with interconnected glowing audio-reactive rungs. |
| **Singularity Spiral Vortex** | Cosmic & Spatial | Swirling spiral particle vortex orbiting a central gravitational singularity. |
| **Hyperspace Starfield** | Cosmic & Dust | Pinpoint stardust hyperspace warp particles with relativistic elongation on audio energy surges. |
| **Geometric Core & Gimbal** | Geometry | 3D wireframe icosahedron with inner solid crystal octahedron and 3 concentric gyroscopic gimbal rings. |
| **Circular Oscilloscope** | Waveforms | 3D circular audio loop displaced 1-to-1 by live PCM time-domain samples with glowing neon edges. |
| **3D Horizon Equalizer Skyline**| Waveforms & Frequency | Horizon equalizer skyline framing the background without blocking the camera lens. |
| **Fluid Audio Ribbons** | Ribbons & Fluid Waves | Flowing sinusoidal ribbon paths undulating through 3D space with harmonic propagation. |
| **Concert Stadium Lasers** | Lasers & Light Beams | Overhead concert stadium laser fans scanning across the arena floor and strobing on rhythm transients. |
| **Shockwave Pulses** | Bursts & Pulses | Concentric expanding chromatic shockwave rings emitted on detected bass kicks and drops. |

### Curated Cinematic Scenes
1. **RETRO HORIZON:** `terrain-grid` + `spectrum-bars` + `starfield-warp`
2. **CRYSTAL SINGULARITY:** `wireframe-core` + `waveform-ring` + `starfield-warp` + `shockwave-rings`
3. **HYPERDRIVE DROP:** `starfield-warp` + `laser-beams` + `shockwave-rings`
4. **FLUID AURORA:** `audio-ribbons` + `waveform-ring` + `starfield-warp`
5. **TORUS KNOT:** `torus-knot` + `laser-beams` + `starfield-warp` + `shockwave-rings`
6. **DNA HELIX:** `dna-helix` + `particle-vortex` + `shockwave-rings`
7. **QUANTUM VORTEX:** `particle-vortex` + `waveform-ring` + `terrain-grid`
8. **STADIUM ARENA:** `terrain-grid` + `spectrum-bars` + `laser-beams` + `shockwave-rings`

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
