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
$$\text{Threshold} = \mu_E + \max(0.08, \sqrt{\sigma^2_E} \cdot 1.4)$$
A transient beat event is triggered when:
$$E_{\text{instant}} = 0.7 \cdot E_{\text{bass}} + 0.3 \cdot \text{RMS} > \text{Threshold} \quad \text{and} \quad \Delta t_{\text{last}} > 220\text{ ms}$$

### 2.5 Drum Kick Transient Detection
To detect specific physical percussive kick hits (sub-bass punch in the $20\text{ Hz} - 100\text{ Hz}$ register, bins 1 to 5), Synwave computes an ultra-low frequency sub-bass power envelope:
$$\text{Kick Threshold} = 1.35 \cdot \mu_{\text{subBass}} + 0.12$$
A kick event is registered when $E_{\text{subBass}} > \text{Kick Threshold}$ and $E_{\text{subBass}} > 0.32$ with minimum refractory delay $\Delta t_{\text{kick}} > 160\text{ ms}$. This triggers instantaneous full-window blinder flashes and explosive particle velocity impulses.

### 2.6 Festival Drop Climax Detection
In electronic dance music and melodic dubstep (e.g. *ILLENIUM & Excision — Feel Something*), drops represent massive sustained surges in sub-bass and RMS following a build. The drop confidence accumulator is evaluated:
$$\Delta C_{\text{drop}} = \begin{cases} +0.15 & \text{if } E_{\text{subBass}} > 0.55 \text{ and } \text{RMS} > 0.42 \text{ and } \text{Mode} = \text{festival} \\ -0.05 & \text{otherwise} \end{cases}$$
When $C_{\text{drop}} > 0.35$, Drop Mode engages: activating 32-beam high-speed laser scissor sweeps, strobe pulses, and radial particle shockwave detonations.

### 2.7 Music-Mood Dynamic Classification (Calm vs Festival)
Synwave continuously classifies incoming audio into two distinct aesthetic worlds:
- **Calm Acoustic Sanctuary:** ($E_{\text{avg}} < 0.24$ and $E_{\text{subBass}} < 0.35$, e.g., acoustic songs like *Aaloshyo*). Yields serene flowing aurora ribbons, gentle breathing stardust, and warm gold/deep indigo hues. Zero harsh strobing or blinding lasers.
- **Festival Concert Arena:** (High energy, rhythmic dubstep, e.g., *Feel Something* or *Waves*). Yields stadium laser rigs, kick blinder flashes, explosive bass shockwave particles, and camera bass rumble.

---

## 3. Music Festival Concert Experience & 100+ Procedural Combinations

Synwave eliminates clumsy center shapes (avoiding awkward wireframe cages), opening up a magnificent concert festival arena:

| Effect ID | Family | Description | Reaction Mechanics |
|---|---|---|---|
| `laser-beams` | Lasers & Light Beams | 28–36 Volumetric Concert Laser Rig | Overhead truss, side scissor towers, and floor uplights. Scissor cross cuts, horizon fan sweeps, liquid sky sheets, and drop frenzy strobes. |
| `starfield-warp` | Cosmic & Particles | Bass-Activated Shockwave Particle Field | 4,000+ sparks receiving explosive radial velocity on drum kicks ($\vec{v} += \vec{r}_{\text{norm}} \cdot I_{\text{kick}} \cdot 32.0$); gentle breathing stardust in calm music. |
| `terrain-grid` | Geometry & Terrains | Open Concert Arena Floor / Horizon Grid | Wide center runway; outer flanks undulate dynamically to sub-bass; reflective stage floor. |
| `spectrum-bars` | Waveforms & Frequency | Distant Horizon Equalizer Skyline | Positioned along the distant horizon ($Z = -28$), framing the concert arena. |
| `shockwave-rings`| Bursts & Pulses | Concentric Chromatic Shockwave Rings | Triggered on drum kicks and drops; expands outwards with exponential velocity decay. |
| `audio-ribbons` | Ribbons & Fluid Waves | Ethereal Flowing Silk Aurora Ribbons | Sinusoidal undulating ribbons dedicated to calm music and emotional melodic breakdowns. |
| `waveform-ring` | Waveforms | 3D Circular Oscilloscope Loop | Directly mapped to live PCM time-domain samples; glowing neon rim. |

### Curated Concert Scenes
1. **`FESTIVAL ARENA`**: Stage floor grid + 32-beam lasers + bass shockwave particles + horizon equalizer + shockwave rings.
2. **`DROP FRENZY`**: Full-power laser sweeps + explosive particle detonations + shockwave rings + stage floor.
3. **`CELESTIAL SANCTUARY`**: Fluid aurora ribbons + breathing stardust + calm waveform ripples (dedicated for calm acoustic music).
4. **`LASER CATHEDRAL`**: Concentrated concert lasers + bass shockwave particles + horizon skyline + shockwaves.
5. **`HORIZON EQUALIZER`**: Terrain floor + horizon equalizer skyline + stardust + laser beams.

---

## 4. Window Edge Attachment, Auto-Hiding UI & Native Fullscreen

- **Edge Attachment:** Both the upper header and lower player dock attach directly to window boundaries (`top: 0`, `bottom: 0`, `border-radius: 0`, `width: 100%`) with zero gap.
- **Independent Auto-Hiding Zones:**
  - Cursor near top ($\le 65\text{px}$) $\to$ Upper header slides into view; lower dock stays hidden.
  - Cursor near bottom ($\ge \text{windowHeight} - 75\text{px}$) $\to$ Player dock slides into view; header stays hidden.
  - Inactive / middle canvas $\to$ Both bars slide out of view, presenting an uninterrupted visualizer canvas.
- **Drum Kick Window Blinder Flash:** A dedicated overlay (`.festival-window-blinder`) with screen blending flashes on drum kicks and strobes during dubstep drops.
- **Spacebar Transport & Native Fullscreen:**
  - `Space`: Instant pause/play toggle (with input field protection).
  - `KeyF` / Canvas Double-Click: Full-bleed cross-browser native fullscreen (WebKit, Gecko, Blink) with automatic icon state synchronization.
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
