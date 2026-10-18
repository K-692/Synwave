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
3. **Smart Scene Choreographer & Mood Engine:** Rather than dumping all effects on screen simultaneously (which causes visual clutter), Synwave coordinates **100+ procedural effect permutations** across 8 art-directed cinematic compositions, dynamically cross-fading scenes on musical section transitions and automatically interpolating color palettes according to audio mood.

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

### 2.5 Music-Mood Dynamic Palette Vector
The lighting and scene palette is calculated live based on an audio mood vector:
- **High Energy / Drop** ($E_{\text{energy}} > 0.62$): Solar Flare / Volcanic Crimson (`#ff0055`, `#ffb703`, `#ffffff`).
- **Rhythmic / Cyber Groove** ($0.42 < E_{\text{energy}} \le 0.62$): Cyberpunk Neon (`#00f0ff`, `#ff007f`, `#ffe600`).
- **High Brightness / Treble** ($C_{\text{spectral}} > 0.55$): Matrix Emerald (`#00ff88`, `#00b4d8`, `#70e000`).
- **Warm / Melodic Mid-range** ($E_{\text{lowMid}} > 0.35$): Synthwave Sunset (`#ff5e3a`, `#b800ff`, `#ff0078`).
- **Ambient / Quiet** ($E_{\text{energy}} \le 0.42$): Deep Space (`#1d3557`, `#7209b7`, `#4cc9f0`).

All palette transitions are continuously smoothed using delta-time linear interpolation (`THREE.Color.lerp(target, delta * 2.5)`) across all background fog, ambient lighting, and shader uniforms.

---

## 3. 100+ Procedural Effects Library & Smart Scene Choreographer

Synwave organizes graphics across 11 core modular effect architectures, supporting over 100 distinctive parameter, geometry, and shader permutations:

| Effect ID | Family | Description | Reaction Mechanics |
|---|---|---|---|
| `terrain-grid` | Geometry & Terrains | Infinite retro synthwave wireframe grid extending to horizon | Outer mountain flanks undulate dynamically with sub-bass and RMS; runway center stays smooth. |
| `torus-knot` | Mathematical Geometry | 3D Torus Knot with wireframe overlay | Twisting continuous rotation modulated by mid/high harmonics; scale pulses on kicks. |
| `dna-helix` | Ribbons & Fluid Waves | Double-helix rotating strands with cross rungs | Intertwined dual-strand rotation; rungs strobe with multi-frequency band energy. |
| `particle-vortex` | Cosmic & Spatial | Swirling spiral particle vortex | Gravitational Keplerian orbital dynamics around center singularity; radial surge on beats. |
| `starfield-warp` | Cosmic & Dust | Pinpoint stardust hyperspace warp particles | Relativistic elongation proportional to bass + RMS; position bounded behind camera lens to eliminate occlusions. |
| `wireframe-core` | Geometry | Central 3D Icosahedron & solid crystal core with 3 gimbal rings | Vertex displacement shader displaced by sub-bass; gyroscopic multi-axis rotations. |
| `waveform-ring` | Waveforms | 3D Circular Oscilloscope loop (256–512 vertices) | Direct geometric radial displacement mapped 1-to-1 to live PCM time-domain samples; glowing neon rim. |
| `spectrum-bars` | Waveforms & Frequency | Horizon equalizer skyline (48–64 extruded bars) | Situated in distant horizon ($Z = -25\text{ to }-33$), framing the central scene without blocking the camera lens. |
| `audio-ribbons` | Ribbons & Fluid Waves | Sinusoidal flowing silk ribbons | Harmonic sinusoidal waves modulated by mid-range frequencies; dynamic spatial curvature and hue shifts. |
| `laser-beams` | Lasers & Light Beams | Overhead concert stadium laser fans | Originating from rear overhead truss, scanning downwards and strobing on rhythm transients. |
| `shockwave-rings`| Bursts & Pulses | Concentric expanding chromatic shockwave rings | Instantiated on beat transient spikes; expand outwards with rapid exponential decay. |

### Curated Cinematic Scenes
The Smart Choreographer automatically activates clean, non-competing effect compositions:
1. **RETRO HORIZON:** `terrain-grid` + `spectrum-bars` + `starfield-warp`
2. **CRYSTAL SINGULARITY:** `wireframe-core` + `waveform-ring` + `starfield-warp` + `shockwave-rings`
3. **HYPERDRIVE DROP:** `starfield-warp` + `laser-beams` + `shockwave-rings`
4. **FLUID AURORA:** `audio-ribbons` + `waveform-ring` + `starfield-warp`
5. **TORUS KNOT:** `torus-knot` + `laser-beams` + `starfield-warp` + `shockwave-rings`
6. **DNA HELIX:** `dna-helix` + `particle-vortex` + `shockwave-rings`
7. **QUANTUM VORTEX:** `particle-vortex` + `waveform-ring` + `terrain-grid`
8. **STADIUM ARENA:** `terrain-grid` + `spectrum-bars` + `laser-beams` + `shockwave-rings`

---

## 4. Window Edge Attachment & Intelligent Auto-Hiding UI

- **Edge Attachment:** Both the upper header and lower player dock are attached directly to the window boundaries (`top: 0`, `bottom: 0`, `border-radius: 0`, `width: 100%`) with zero gap.
- **Independent Auto-Hiding Zones:**
  - Cursor in top zone ($\le 65\text{px}$) $\to$ Upper bar slides down smoothly into view; lower bar remains hidden.
  - Cursor in bottom zone ($\ge \text{windowHeight} - 75\text{px}$) $\to$ Lower player dock slides up into view; upper bar remains hidden.
  - Cursor in middle or inactive for $> 1.8\text{s}$ $\to$ Both bars slide out of view (`transform: translateY(-100%)` / `translateY(100%)`), presenting a completely clean, distraction-free visualizer canvas.
- **Cinematic Watermark HUD:** Refined typography with title truncation and auto-fade to subtle opacity ($0.28$) after initial track presentation so the visuals remain unobstructed.

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
│   │   ├── VisualEngine.ts                 <-- Three.js scene, dynamic camera, smart director
│   │   ├── palettes.ts                     <-- 6 curated aesthetic color themes
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
├── LICENSE                                 <-- MIT License
├── README.md                               <-- Comprehensive project documentation
├── package.json
└── vite.config.ts
```

---

## 6. Current State & Verification

- **Production Build:** `npm run build` succeeds cleanly (`tsc -b && vite build` built in ~321ms).
- **Vite Local Dev Server:** Running at `http://localhost:5173/`.
- **Git Repository:** Committed and synchronized with `https://github.com/K-692/Synwave.git`.
