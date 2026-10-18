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
    An authentic stadium music festival concert visualizer that transforms local audio files into real-time, 3D stadium audiovisual performances with a solid 16:9 LED stage screen, heavy-duty aluminum truss roof, crowd silhouette with glowing smartphones, camera-directed lasers, moving-head lights, pyrotechnic fire blasters, cryo smoke jets, and 4-channel STEM separation.
  </p>

</div>

---

## 🌟 Overview

**Synwave** transforms any local audio file into a full-scale **music festival concert experience**. Rather than generic 2D graphs or disorienting spinning shapes, Synwave places you in the **front-row audience** directly facing a colossal concert stage modeled after real-world stadium EDM and dubstep concerts.

### Concert Stage Highlights
- **Solid Pitch-Black Stage Arena:** Pitch-black background (`#000000`) with **zero revolving or spinning elements** — delivering clean, high-contrast concert realism.
- **Solid Rectangular Jumbotron LED Screen (16:9):** Centered on stage displaying **100+ audio-activated procedural visual themes** (including the **Concert Phoenix Wings of Fire** visual matching live festival stages) and the exclusive **"Now Playing"** broadcast banner.
- **Heavy-Duty Aluminum Box-Truss Roof Structure:** Industrial overhead roof grid with horizontal cross-beams and dual vertical column support towers flanking the stage.
- **Authentic Foreground Concert Crowd:** Silhouette of audience heads, cheering raised arms/hands, and glowing mobile phone recording screens bobbing to the sub-bass pulse.
- **Rock-Solid Fixed Camera Perspective:** Camera locked in front of the stage with zero mouse-hovering movement.
- **Lasers & Lights Thrown Towards Camera & Audience:**
  - **28 Razor-Thin Concert Lasers:** Directed outward along $+Z$ straight past the camera into the audience, as well as sweeping across stage in liquid-sky fans, stadium cones, and scissor crosses.
  - **16 Moving-Head Volumetric Spotlights:** Overhead and ground-level moving heads angled forward towards the audience, sweeping dynamic pan/tilt choreographies.
- **Active Stage Pyrotechnics & Atmospherics:**
  - **8 Flame Cannons (Fire Shooters):** Flanking the LED screen and stage deck lip, blasting vertical fire plumes up to $14\text{m}$ high with real-time orange/red firelight.
  - **Cryo CO2 Smoke Jets & Stage Haze:** Dense cryogenic fog plumes erupting upward on drops and vocals, with low-lying haze catching light beams.
- **4-Channel STEM Separation Integration:**
  - Integrated with the **KIE AI Suno Audio API** (`https://kieai.mintlify.app/suno-api/separate-vocals`) for multi-track separation.
  - Instantaneous 60 FPS real-time multi-band STEM decomposition isolating **Kick**, **Bass**, **Instruments**, and **Vocals**.
  - **Decoupled Visual Triggers:**
    - **Kick STEM** $\to$ Kick flash lights (white blinder strobes) & pyro flame blasters.
    - **Bass STEM** $\to$ Moving-head beam intensity, cone thickness, and stage floor wash.
    - **Instrument STEM** $\to$ Razor-thin concert lasers & stage-sweeping light choreographies.
    - **Vocal STEM** $\to$ Center stage LED screen visual energy (Phoenix Wings of Fire) & cryo smoke plumes.
- **Edge-to-Edge Fullscreen Guarantee:** Engineered with multi-stage viewport re-measurements to ensure zero letterboxing, zero black bars, and pixel-perfect bleed across macOS and all displays.

---

## 🎨 100+ Stage Screen Procedural Themes

The solid rectangular LED screen renders 100 distinct procedural themes categorized into 10 families:

| Theme Family | Themes | Visual Aesthetic & STEM Reactivity |
|---|---|---|
| **Cyber Horizon & Tron Grid** | 00 – 09 | Undulating wireframe horizon grids, neon road perspectives, audio mountains. |
| **Cosmic Warp & Hyperspace** | 10 – 19 | Relativistic star streaks, warp speed tunnels, spiral galaxy vortexes. |
| **Sacred Geometry & Mandalas** | 20 – 29 | Multi-pointed audio-reactive stars, concentric mandalas, golden ratio wheels. |
| **Liquid Plasma & Aurora Waves** | 30 – 39 | Multi-frequency sinusoidal waveforms, silk auroras, chromatic interference. |
| **Stadium Equalizer Skylines** | 40 – 49 | Radial equalizers, segmented LED VU towers, circular oscilloscope rings. |
| **Glitch Matrix & Cyber Data** | 50 – 59 | Digital matrix code rain, cyber runes, high-speed telemetry readouts. |
| **Neon Radial Tunnels** | 60 – 69 | Infinite depth polygons (hexagons, octagons, triangles) pulsing to tempo. |
| **Concert Phoenix Wings & Inferno** | 70 – 79 | **Fiery Phoenix Wings spreading across the video wall (matching concert photo)**, central totem silhouette, rising ember particles; driven by Vocal & Kick STEMs. |
| **Celestial Zen Sanctuary** | 80 – 89 | Organic breathing lotus rings, soft yin-yang waves, celestial constellations. |
| **Strobe Rave & Blinders** | 90 – 99 | High-velocity scissor vectors, radial starburst blinder pulses, strobe chaos. |

---

## ⌨️ Controls & Shortcuts

| Key / Action | Action | Description |
|---|---|---|
| `Space` | **Play / Pause** | Toggle playback instantly (with text input protection). |
| `F` | **Toggle Fullscreen** | Full-bleed native edge-to-edge fullscreen mode. |
| `Double-Click` | **Toggle Fullscreen** | Double-clicking the canvas toggles fullscreen. |
| `Hover Top` | **Top Header** | Slide in top navigation bar (`Library`, `Inspector`, `Track Info`). |
| `Hover Bottom` | **Player Dock** | Slide in transport controls and progress scrub bar. |

---

## 🛠️ Tech Stack

- **Frontend & UI:** React 19, TypeScript, Lucide Icons
- **Styling:** Vanilla CSS (Glassmorphism, Dark Concert aesthetic, zero UI bloat)
- **3D Graphics & Rendering:** Three.js, WebGL2, Canvas2D Offscreen Procedural Textures
- **Audio & STEM Processing:** Web Audio API (`AudioContext`, `AnalyserNode`), KIE AI Suno API Client, 60 FPS Real-Time Multi-Band Decomposition
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
