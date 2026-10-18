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
- **100% Procedural Generation:** Stars, lasers, waveforms, polyhedral cores, fluid ribbons, and shockwave pulses are mathematically rendered live.
- **Dual-Path Audio Processing:** Combines offline predictive pre-analysis (BPM candidate estimation, dynamic range, section boundaries) with an authoritative live Web Audio playback clock.
- **Deterministic Visual Plan:** Seeded by track identity so that seeking and track navigation produce consistent, reproducible choreography.
- **Local-First & Private:** Audio decoding, playback, and analysis remain entirely on your device.

---

## 🚀 Key Features

- **Local Music Library & Queue:** Ingest single audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) or import entire music directories via native folder selection or drag-and-drop.
- **Autonomous Visual Director:** Automatically orchestrates camera movements, effect intensity, and scene transitions in sync with musical sections (`INTRO`, `BUILD`, `DROP / CLIMAX`, `BREAKDOWN`, `OUTRO`).
- **Precision Transport Controls:** Play/Pause, Next/Previous, Shuffle, Repeat (Off, One, All), Volume, Mute, and an interactive seek bar with live hover timestamp preview and section markers.
- **Live Signal & Visual Inspector:** Real-time 64-band FFT frequency spectrum, PCM time-domain oscilloscope, multi-band gauges (RMS, Sub-bass, Mid, Treble, Spectral Brightness), and detected BPM readout.
- **Curated Color Palettes:** Switch between 6 distinctive aesthetic color themes on the fly:
  - ⚡ **Cyberpunk Neon** (Vivid Cyan, Electric Magenta, Acid Yellow)
  - 🌅 **Synthwave Sunset** (Sunset Red-Orange, Hyper Violet, Magenta)
  - 🟢 **Matrix Emerald** (Digital Mint, Deep Aqua, Radioactive Lime)
  - 🌌 **Deep Space** (Electric Cobalt, Nebula Violet, Ice Blue)
  - ☀️ **Solar Flare** (Molten Gold, Solar Crimson, Heat White)
  - 💎 **Monolith Chrome** (Diamond White, Steel Gray, Cyan Glint)
- **High-Resolution Snapshot Exporter:** Capture instant PNG screenshots of procedural visual frames with one click.
- **Performance Tiers:** Configurable quality presets (`Low`, `Medium`, `High 60 FPS`, `Ultra`) for integrated laptops up to dedicated desktop GPUs.

---

## 🎨 Procedural Effect Catalogue

Synwave features a modular effect architecture adhering to the `VisualEffect` interface:

| Effect | Family | Description |
|---|---|---|
| **Hyperspace Starfield** | Cosmic | 3,500–6,000 procedural stars warping with relativistic speed and star-stretching on audio energy surges. |
| **Geometric Core** | Geometry | 3D wireframe icosahedron with audio-driven vertex displacement and concentric gyroscopic gimbal rings. |
| **Circular Oscilloscope** | Waveforms | 3D circular audio loop displaced 1-to-1 by live PCM time-domain samples with glowing neon edges. |
| **3D Spectrum Arena** | Waveforms | Radial arena of 64–96 extruded prism bars pulsating exponentially with multi-band FFT data. |
| **Fluid Audio Ribbons** | Ribbons | Flowing sinusoidal ribbon paths undulating through 3D space with harmonic propagation. |
| **Crossing Laser Beams** | Lasers & Light | Volumetric laser shafts scanning across the arena and strobing on rhythm transients. |
| **Shockwave Pulses** | Bursts & Pulses | Concentric expanding chromatic shockwave rings emitted on detected bass kicks and drops. |

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
                                  │   Visual Planning Engine  │
                                  │  - Layered Choreography   │
                                  │  - Deterministic Seeding  │
                                  │  - Auto / Manual Director │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │   Procedural Three.js     │
                                  │     Render Pipeline       │
                                  │  - 7+ Effect Families     │
                                  │  - Custom GLSL Shaders    │
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
│   │   ├── VisualEngine.ts                 <-- Three.js scene, dynamic camera, director logic
│   │   ├── palettes.ts                     <-- 6 curated aesthetic color themes
│   │   └── effects/
│   │       ├── BaseEffect.ts               <-- Common lifecycle, PRNG, and disposal
│   │       ├── StarfieldEffect.ts          <-- Hyperspace warp particle field
│   │       ├── WireframeCoreEffect.ts      <-- Audio-displaced central polyhedron
│   │       ├── WaveformRingEffect.ts       <-- Real-time 3D PCM circular oscilloscope
│   │       ├── SpectrumBarsEffect.ts       <-- 3D radial frequency arena bars
│   │       ├── AudioRibbonsEffect.ts       <-- Sinusoidal flowing fluid ribbons
│   │       ├── LaserBeamsEffect.ts         <-- Volumetric sweeping crossing lasers
│   │       └── ShockwaveRingEffect.ts      <-- Expanding chromatic shockwave pulses
│   ├── components/
│   │   ├── Header.tsx                      <-- Top bar with brand, file/folder open
│   │   ├── PlayerControls.tsx              <-- Bottom dock with seek bar, transport, volume
│   │   ├── PlaylistDrawer.tsx              <-- Queue list, search filter, analysis status
│   │   ├── InspectorDrawer.tsx             <-- Live 64-band FFT canvas, oscilloscope, telemetry
│   │   └── TrackWatermark.tsx              <-- On-canvas HUD watermark, live section chip
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
