# Synwave: Procedural Audio-Reactive Music Visualizer — Research & Architecture Journey

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js + Web Audio API + Vite)  
> **Test Music Corpus:** `My Music/Ambyion & Abandoned - Waves (4K Music Video).mp3`  
> **Architecture Principle:** 100% Procedural Generation (Zero pre-rendered video, zero stock footage, local-first computation)

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-agnostic 3D procedural music visualizer and local audio player. Modern audiovisual synthesis tools often suffer from a false dichotomy: either they rely on heavy, static pre-rendered video clips that consume gigabytes of storage and fail to adapt dynamically, or they produce simplistic 2D equalizer bar graphs that lack artistic depth and musical structure.

Synwave introduces a **dual-path hybrid architecture**:
1. **Offline Pre-Analysis Engine:** Deconstructs decoded audio buffers into 20 FPS multi-band feature frames, computes dynamic range envelopes, estimates tempo candidates (BPM) via Inter-Onset Interval (IOI) histograms, segments musical sections (Intro, Build, Drop/Climax, Breakdown, Outro), and prepares a deterministic visual choreography schedule keyed to a stable 32-bit track seed.
2. **Live Authoritative Playback Path:** Synchronizes rendering strictly to the authoritative media clock (`currentTime`). Low-latency real-time spectral FFT data (2048 samples, 1024 bins) and time-domain PCM waveforms are extracted frame-by-frame via Web Audio `AnalyserNode`, detecting instantaneous transient kick/snare impulses and driving real-time GPU shader deformations.

---

## 2. Mathematical Formulations & Signal Processing

### 2.1 Multi-Band Energy Partitioning
Given an $N = 2048$ FFT window sampled at $f_s = 44,100\text{ Hz}$, each frequency bin $k$ represents a bandwidth of $\Delta f = \frac{f_s}{N} \approx 21.53\text{ Hz}$. The spectrum is partitioned into five perceptually calibrated frequency bands:

$$\text{Sub-Bass / Bass: } [20\text{ Hz}, 250\text{ Hz}] \implies k \in [1, 12]$$
$$\text{Low-Mid: } [250\text{ Hz}, 500\text{ Hz}] \implies k \in [12, 24]$$
$$\text{Mid / High-Mid: } [500\text{ Hz}, 2000\text{ Hz}] \implies k \in [24, 95]$$
$$\text{Treble: } [2000\text{ Hz}, 16000\text{ Hz}] \implies k \in [95, 750]$$

For each band $[k_{\text{start}}, k_{\text{end}}]$, the normalized energy $E_{\text{band}}$ is evaluated as:
$$E_{\text{band}} = \frac{1}{(k_{\text{end}} - k_{\text{start}}) \cdot 255} \sum_{k=k_{\text{start}}}^{k_{\text{end}}} M[k]$$

### 2.2 Root Mean Square (RMS) Loudness Proxy
From the instantaneous time-domain PCM buffer $x[n] \in [-1, 1]$ across $W$ samples:
$$\text{RMS} = \sqrt{\frac{1}{W} \sum_{n=0}^{W-1} x[n]^2}$$

### 2.3 Spectral Centroid (Perceived Timbral Brightness)
The spectral centroid represents the barycenter of the magnitude spectrum:
$$C_{\text{spectral}} = \frac{\sum_{k=0}^{K-1} k \cdot M[k]}{\sum_{k=0}^{K-1} M[k]}$$

### 2.4 Dynamic Transient Onset Detection
To detect percussive transients (kick, snare, drops) robustly across different audio volumes, Synwave calculates a rolling energy average $\mu_E$ and variance $\sigma^2_E$ over a 40-frame window:
$$\text{Threshold} = \mu_E + \max(0.08, \sqrt{\sigma^2_E} \cdot 1.4)$$
A transient beat event is triggered when:
$$E_{\text{instant}} = 0.7 \cdot E_{\text{bass}} + 0.3 \cdot \text{RMS} > \text{Threshold} \quad \text{and} \quad \Delta t_{\text{last}} > 220\text{ ms}$$

---

## 3. Procedural 3D Visual Effect Catalogue

Synwave organizes all graphics under a modular `VisualEffect` interface adhering to strict GPU memory allocation, deterministic seeding, and disposal hooks:

| Effect ID | Family | Description | Reaction Mechanics |
|---|---|---|---|
| `starfield-warp` | Cosmic | 3,500–6,000 procedural stars in 3D hyperspace | Velocity streaks with relativistic elongation proportional to bass + RMS; rotates with high-mid frequencies. |
| `wireframe-core` | Geometry | Central 3D Icosahedron & Octahedron with 3 gimbal rings | Vertex displacement shader displaced by sub-bass; rotation accelerated by overall loudness; emissive flash on beat hits. |
| `waveform-ring` | Waveforms | 3D Circular Oscilloscope loop (256–512 vertices) | Direct geometric radial displacement mapped 1-to-1 to live PCM time-domain samples; glowing neon rim. |
| `spectrum-bars` | Waveforms | Radial arena of 64–96 3D extruded prism bars | Bar heights scale exponentially ($\text{mag}^{1.4}$) to FFT frequency bins with dual-tone gradient caps. |
| `audio-ribbons` | Ribbons | 5–7 sinusoidal ribbons propagating through 3D space | Harmonic sinusoidal waves modulated by mid-range frequencies; dynamic spatial curvature and hue shifts. |
| `laser-beams` | Lasers & Light | 8–12 volumetric intersecting laser shafts | Laser sweep angles rotate continuously; opacity pulses and strobes on rhythmic drops. |
| `shockwave-rings`| Bursts & Pulses| Concentric expanding chromatic shockwave rings | Instantiated on beat transient spikes; expand outwards with rapid exponential decay. |

---

## 4. Curated Color Palettes

1. **Cyberpunk Neon:** Neon Cyan (`#00f0ff`), Hot Pink (`#ff007f`), Acid Yellow (`#ffe600`), Void Indigo (`#04060d`).
2. **Synthwave Sunset:** Sunset Red-Orange (`#ff5e3a`), Hyper Violet (`#b800ff`), Magenta (`#ff0078`), Retro Dusk (`#090312`).
3. **Matrix Emerald:** Digital Mint (`#00ff88`), Deep Aqua (`#00b4d8`), Radioactive Lime (`#70e000`), Terminal Black (`#020b08`).
4. **Deep Space:** Cobalt Blue (`#4361ee`), Nebula Violet (`#7209b7`), Ice Blue (`#4cc9f0`), Starlight Obsidian (`#030510`).
5. **Solar Flare:** Molten Gold (`#ffaa00`), Solar Crimson (`#ff3c00`), Pure White (`#ffffff`), Smoldering Charcoal (`#0c0502`).
6. **Monolith Chrome:** Diamond White (`#ffffff`), Steel Gray (`#8d99ae`), Cyan Accent (`#3a86ff`), Pitch Carbon (`#050507`).

---

## 5. Architectural Directory Structure

```text
Synwave/
├── icon.png                                <-- Official application branding icon (5000x5000)
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
├── LICENSE                                 <-- MIT License
├── README.md                               <-- Comprehensive project documentation
├── package.json
└── vite.config.ts
```

---

## 6. Current State & Verification

- **Production Build:** `npm run build` executes without warnings or type errors (`tsc -b && vite build` built in ~312ms).
- **Vite Local Dev Server:** Active on `http://localhost:5173/` serving static assets and dynamic React/Three.js bundles.
- **Icon Branding:** `icon.png` is integrated as the primary app icon (in `<head>`, top header brand container, and `README.md`).
- **Privacy & Gitignore:** `My Music/` and `public/music/` are securely added to `.gitignore`, keeping private audio files out of version control.
- **Feature Completeness:**
  - Full transport controls (play, pause, seek with hover timestamp, shuffle, repeat one/all/off, volume, mute).
  - Dual-path audio analysis (live Web Audio AnalyserNode + offline AudioAnalyzer section & BPM detection).
  - Autonomous Director mode orchestrating scene transitions based on song energy and section markers.
  - High-res PNG snapshot exporter capturing 3D procedural frames.
  - Signal and Visual Inspector with live 60 FPS spectrum and oscilloscope telemetry.
- **Git Repository:** Remote origin configured to `https://github.com/K-692/Synwave.git`.
