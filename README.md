<div align="center">

  <img src="icon.png" alt="Synwave Logo" width="160" height="160" style="border-radius: 28px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.45); margin-bottom: 16px;" />

  # SYNWAVE
  
  **Autonomous Procedural 3D Concert Stage Simulator & Neural Music Player**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
  [![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
  [![PyTorch MPS](https://img.shields.io/badge/Hardware-Apple%20Silicon%20MPS-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

  <p align="center">
    An authentic stadium music festival concert simulator that orchestrates real-time, 3D stadium audiovisual performances with Demucs v4 neural 4-stem separation, Apple Silicon MPS hardware acceleration, YouTube Data API metadata, 360° downward instrument lasers, floating controls, and dynamic concert lighting.
  </p>

</div>

---

## 🌟 Overview & Recent Updates

**Synwave** transforms any audio track into a stadium-scale **music festival concert experience**. Rather than generic 2D visualizer graphs, Synwave places you in the **front-row audience** facing a colossal concert stage modeled after real-world festival arenas (Ultra Music Festival, Tomorrowland, EDC).

### 🚀 Key Highlights & Newest Features
- **Floating Glassmorphic Bars:**
  - Background container bars have been removed: navigation, transport controls, and volume docks now float with translucent pill styling directly over the 3D stage and YouTube video aperture.
  - The permanent **SYNWAVE** logo is pinned at the top-left corner.
  - The **Load Audio / Drop File** button is centered horizontally at the top with drag-and-drop support.
- **YouTube Data API v3 Metadata Integration & Info ('i') Modal:**
  - Track information is retrieved directly from the official **YouTube Data API v3** (Music Name, Channel / Artist, Producer, Release Date, and Description).
  - An interactive `'i'` info button sits right beside the track title in the bottom dock, opening a rich metadata dialog.
- **Sleek Minimalist Seek Slider:**
  - Removed bar spectrum peaks from the timeline for an ultra-clean, glowing neon progress rail and interactive playhead thumb.
- **360° Downward Instrument Lasers (Opposite Color Palette):**
  - Moved from stage bottom to the **top of the YouTube screen**, throwing razor-sharp beams downward into the stage deck and audience space.
  - Emitter nozzles are clean pin-point diode dots (large white circle flares eliminated).
  - Sweeps in dynamic 360° conical directions driven by the high frequency of instruments.
  - Gated to activate *strictly during high-intensity music parts* (drops, heavy climaxes).
  - Beam colors are dynamically computed as the exact **opposite (complementary hue)** of the active stage color palette.
- **Dynamic Perimeter Spotlight Scaling:**
  - Fixtures framing the YouTube screen scale dynamically from minimal (2 fixtures) on calm songs up to MAX (12 fixtures) on intense tracks with rapid frequency changes.
- **Deep Sub-Bass FOV Zoom Punch:**
  - Camera FOV zoom punch is driven strictly by isolated deep sub-bass frequencies (20-100Hz), completely filtering out mid-range frequencies.
- **Native Apple Silicon MPS Acceleration:**
  - Automatic detection and utilization of Apple Silicon Metal Performance Shaders (MPS) in both WebGL Three.js and Python PyTorch Demucs microservice.
  - Real-time HUD telemetry displays active hardware status: `HARDWARE ACCEL: APPLE SILICON MPS (METAL)`.
- **Pre-Processing Playback Gate & Ready-Pulse Button:**
  - Playback is strictly unlocked once Demucs stem separation and video loading are ready, featuring a glowing `ready-pulse` play button animation.
- **Removed Flame Cannons & Red Circular Arcs:**
  - Stage flame cannons and kick-activated red circular arcs have been completely removed across visual engine, scenes, and routing console.
- **Calibrated Audio-to-Visual Routing Console:**
  - Streamlined calibration modal with 1:1 active stage controls: YouTube Screen Shake, Kick Screen Flash Strobe, Kick Sensitivity, 360° Perimeter Bass Speed, Bass-to-Beam Radiance, Flash Color Saturation, Effect Decay, Instrumental Conical Sweep Speed, Laser Density, Spotlights Count, Global Lumen Ceiling, and Reduced Flash Mode.

---

## ⌨️ Controls & Shortcuts

| Key / Action | Action | Description |
|---|---|---|
| `Space` | **Play / Pause** | Toggle playback (with input focus protection). |
| `F` | **Toggle Fullscreen** | Full-bleed native edge-to-edge fullscreen mode. |
| `Double-Click` | **Toggle Fullscreen** | Double-clicking the 3D canvas toggles fullscreen. |
| `C` | **Routing Console** | Open Audio-to-Visual Routing Console. |
| `D` | **Telemetry HUD** | Toggle real-time Synchronization & Telemetry Diagnostic HUD. |
| `M` | **Reduced Flash Mode**| Toggle photosensitive safety blinder mode. |
| `Arrow Left / Right` | **Seek -5s / +5s** | Scrub backward or forward 5 seconds. |

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 19, TypeScript, Lucide Icons, Vanilla CSS Glassmorphism
- **3D Graphics & Stage Simulator:** Three.js (r186), WebGL2, Custom Shaders & Additive Blending
- **Neural Stem Separation:** Meta Demucs v4 (Hybrid Transformer HTDemucs) with Apple Silicon MPS acceleration
- **Music Identification & Search:** ShazamIO + YouTube Data API v3
- **Audio Engine:** Web Audio API (`AudioContext`, `AnalyserNode`, multi-band FFT decomposition)
- **Bundler:** Vite 8.3

---

## ⚡ Quick Start

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. Set Up Python Microservice (Demucs & Shazam)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt # or fastapi uvicorn demucs torch certifi shazamio
python3 shazam_server.py
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
