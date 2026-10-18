<div align="center">

  <img src="icon.png" alt="Synwave Logo" width="160" height="160" style="border-radius: 28px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.45); margin-bottom: 16px;" />

  # SYNWAVE
  
  **Open-Source Procedural Music Concert Visualizer & Local Audio Player**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
  [![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

  <p align="center">
    An immersive music festival concert stage visualizer that transforms local audio files into real-time, 3D stadium audiovisual performances with a curved LED Jumbotron, 100+ mood-adaptive themes, razor-thin lasers, flame cannons, cryo smoke jets, and moving-head spotlights.
  </p>

</div>

---

## 🌟 Overview

**Synwave** transforms any local audio file into a full-scale **music festival concert experience**. Rather than generic 2D graphs or disorienting spinning shapes, Synwave places you in the **front-row VIP audience** directly facing a colossal concert stage.

### Concert Stage Highlights
- **Curved Jumbotron LED Screen:** A massive backdrop screen running **100+ audio-activated procedural visual themes** dynamically selected by track mood and section dynamics.
- **Exclusive "Now Playing" Broadcast HUD:** The track title and artist are integrated directly into the stage screen's broadcast lower-third — keeping the rest of the canvas clean and unobstructed.
- **Fixed Front-Row VIP Perspective:** The camera is positioned in front of the stage, featuring responsive mouse-look parallax and visceral sub-bass camera vibration on heavy drum kicks and festival drops.
- **Live Stage Pyrotechnics & Atmospherics:**
  - **6 Pyro Flame Cannons:** Erupting with vertical fiery plumes and casting real-time warm illumination across the stage on kicks and drops.
  - **4 Cryo CO2 Smoke Jets:** Blasting dense cryogenic fog high into the air on buildups, drops, and snare rolls.
  - **14 Moving-Head Spotlights:** Volumetric light cones with beat-synced pan/tilt sweeps and blinder strobes.
  - **24 Razor-Thin Lasers:** Liquid sky sheets, stadium fans, scissor crosses, and drop frenzy strobes.
- **Mood & Genre Detection:** Analyzes energy, spectral brightness, sub-bass intensity, and tempo (Librosa-inspired heuristics) to classify songs into 6 distinct musical moods: `euphoric-drop`, `chill-ambient`, `retro-groove`, `dark-aggressive`, `uplifting-melodic`, and `deep-hypnotic`.
- **Edge-to-Edge Fullscreen Guarantee:** Engineered with multi-stage viewport re-measurements to ensure zero letterboxing, zero black bars, and pixel-perfect bleed across macOS and all displays.

---

## 🎨 100+ Stage Screen Procedural Themes

The curved LED screen renders 100 distinct procedural themes categorized into 10 families:

| Theme Family | Themes | Visual Aesthetic |
|---|---|---|
| **Cyber Horizon & Tron Grid** | 00 – 09 | Undulating wireframe horizon grids, neon road perspectives, audio mountains. |
| **Cosmic Warp & Hyperspace** | 10 – 19 | Relativistic star streaks, warp speed tunnels, spiral galaxy vortexes. |
| **Sacred Geometry & Mandalas** | 20 – 29 | Multi-pointed audio-reactive stars, concentric mandalas, golden ratio wheels. |
| **Liquid Plasma & Aurora Waves** | 30 – 39 | Multi-frequency sinusoidal waveforms, silk auroras, chromatic interference. |
| **Stadium Equalizer Skylines** | 40 – 49 | Radial equalizers, segmented LED VU towers, circular oscilloscope rings. |
| **Glitch Matrix & Cyber Data** | 50 – 59 | Digital matrix code rain, cyber runes, high-speed telemetry readouts. |
| **Neon Radial Tunnels** | 60 – 69 | Infinite depth polygons (hexagons, octagons, triangles) pulsing to tempo. |
| **Volcanic Inferno & Pyrotechnics** | 70 – 79 | Solar flares, magma plumes, fiery chromatic noise spikes. |
| **Celestial Zen Sanctuary** | 80 – 89 | Organic breathing lotus rings, soft yin-yang waves, celestial constellations. |
| **Strobe Rave & Blinders** | 90 – 99 | High-velocity scissor vectors, radial starburst blinder pulses, strobe chaos. |

---

## ⌨️ Controls & Shortcuts

| Key / Action | Action | Description |
|---|---|---|
| `Space` | **Play / Pause** | Toggle playback instantly (with text input protection). |
| `F` | **Toggle Fullscreen** | Full-bleed native edge-to-edge fullscreen mode. |
| `Double-Click` | **Toggle Fullscreen** | Double-clicking the canvas toggles fullscreen. |
| `Mouse Move` | **Concert Parallax** | Subtly shifts front-row VIP perspective for realistic 3D depth. |
| `Hover Top` | **Top Header** | Slide in top navigation bar (`Library`, `Inspector`, `Track Info`). |
| `Hover Bottom` | **Player Dock** | Slide in transport controls and progress scrub bar. |

---

## 🛠️ Tech Stack

- **Frontend & UI:** React 19, TypeScript, Lucide Icons
- **Styling:** Vanilla CSS (Glassmorphism, Neon Cyberpunk design system, zero UI bloat)
- **3D Graphics & Rendering:** Three.js, WebGL2, Canvas2D Offscreen Procedural Textures
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

Visit `http://localhost:5173/` in your browser.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
