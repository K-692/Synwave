# Synwave: Procedural Audio-Reactive Music Visualizer — Research & Architecture Journey

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js + Web Audio API + Vite)  
> **Test Music Corpus:** Local `public/music/` test tracks (`Feel Something`, `Aaloshyo`, `Waves`)  
> **Architecture Principle:** 100% Procedural Generation (Zero pre-rendered video, zero stock footage, local-first computation)

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-agnostic 3D procedural music concert visualizer and local audio player. Conventional music visualizers either rely on pre-rendered video loops that fail to synchronize with dynamic musical phrasing, or simple 2D spectrum bars that lack depth.

Synwave delivers a **Music Festival Concert Stage Experience** viewed directly from the front-row VIP perspective:
1. **Curved Jumbotron LED Screen:** A massive curved LED backdrop screen displaying **100+ audio-reactive procedural visual themes** (across 10 distinct families with 10 variations each). The screen features an integrated concert broadcast lower-third displaying track title and artist as the exclusive **"Now Playing"** display.
2. **Concert Stage Infrastructure:** Elevated reflective stage platform, aluminum truss arches, overhead lighting grids, side towers, and curved line-array speaker towers pulsing to sub-bass.
3. **Fixed Front-Row VIP Camera:** Fixed directly in front of the stage facing the Jumbotron screen, featuring smooth mouse-driven head-turn parallax and visceral sub-bass camera rumble on heavy drum kicks and festival drops.
4. **Active Stage Pyrotechnics & Atmospherics:**
   - **6 Flame Cannons (Fire Shooters):** Erupting with vertical flame plumes and dynamic warm light flashes during drum kicks and dubstep drops.
   - **4 Cryo CO2 Smoke Jets:** Blasting dense cryogenic fog plumes high into the air on buildups, drops, and snare rolls.
   - **14 Moving-Head Spotlights:** Sweeping volumetric light cones with dynamic pan/tilt choreographies.
   - **24 Razor-Thin Concert Lasers:** Liquid sky sheets, stadium fans, scissor crosses, and drop frenzy strobes.
5. **Mood & Genre Detection Engine:** Inspired by the Librosa-based `usr-wwelsh/Mood-Detector` pipeline, extracting acoustic descriptors (RMS energy, spectral centroid, sub-bass ratio, onset density, and tempo) to classify music into 6 dynamic mood profiles: `euphoric-drop`, `chill-ambient`, `retro-groove`, `dark-aggressive`, `uplifting-melodic`, and `deep-hypnotic`.
6. **Edge-to-Edge Zero-Gap Fullscreen:** Pixel-perfect fullscreen with automated multi-frame re-measurement to prevent any bottom letterboxing or black gaps across macOS and all displays.

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

### 2.4 Librosa-Inspired Mood Classification Pipeline
Referencing audio feature extraction methodologies from `Mood-Detector` (Librosa):
1. **Energy Metric ($E$):** Composite of RMS and bass power: $E = 0.5 \cdot \text{RMS} + 0.5 \cdot E_{\text{bass}}$.
2. **Brightness Metric ($B$):** Normalized spectral centroid: $B = \frac{C_{\text{spectral}}}{K}$.
3. **Onset Rate ($\Omega$):** Percussive onset frequency measured per second.
4. **Classification Heuristics:**
   - **`euphoric-drop`**: High energy ($E > 0.45$), intense sub-bass ($E_{\text{subBass}} > 0.52$), and fast onset rate or drop detected.
   - **`chill-ambient`**: Low energy ($E < 0.22$), warm centroid ($B < 0.48$), and low onset rate ($\Omega < 1.6$).
   - **`dark-aggressive`**: High energy ($E > 0.38$) with low spectral brightness ($B < 0.42$).
   - **`uplifting-melodic`**: Moderate-high energy ($E > 0.30$) with high spectral brightness ($B > 0.55$).
   - **`retro-groove`**: Prominent low-mid and mid warmth ($E_{\text{lowMid}} > 0.28$) with steady rhythmic pulse.
   - **`deep-hypnotic`**: Sustained bass drones with low onset density.

---

## 3. 100+ Procedural Stage Screen Visual Themes

The backdrop Jumbotron screen renders 100 distinct procedural themes organized into 10 families ($10 \times 10 = 100$):

| Family Index | Theme Family | Theme Range | Aesthetic Characteristics |
|---|---|---|---|
| **0** | **Cyber Horizon & Tron Grid** | 00 – 09 | Undulating wireframe horizon grids, neon road perspectives, audio mountains. |
| **1** | **Cosmic Warp & Hyperspace** | 10 – 19 | Relativistic star streaks, warp speed tunnels, spiral galaxy vortexes. |
| **2** | **Sacred Geometry & Mandalas** | 20 – 29 | Multi-pointed audio-reactive stars, concentric mandalas, golden ratio wheels. |
| **3** | **Liquid Plasma & Aurora Waves** | 30 – 39 | Multi-frequency sinusoidal waveforms, silk auroras, chromatic interference. |
| **4** | **Stadium Equalizer Skylines** | 40 – 49 | Radial equalizers, segmented LED VU towers, circular oscilloscope rings. |
| **5** | **Glitch Matrix & Cyber Data** | 50 – 59 | Digital matrix code rain, cyber runes, high-speed telemetry readouts. |
| **6** | **Neon Radial Tunnels** | 60 – 69 | Infinite depth polygons (hexagons, octagons, triangles) pulsing to tempo. |
| **7** | **Volcanic Inferno & Pyrotechnics** | 70 – 79 | Solar flares, magma plumes, fiery chromatic noise spikes. |
| **8** | **Celestial Zen Sanctuary** | 80 – 89 | Organic breathing lotus rings, soft yin-yang waves, celestial constellations. |
| **9** | **Strobe Rave & High-Energy Blinders** | 90 – 99 | High-velocity scissor vectors, radial starburst blinder pulses, strobe chaos. |

### Integrated "Now Playing" Broadcast Lower-Third
Track title and artist are rendered directly onto the stage screen's lower region with:
- Cyberpunk status badge (`● LIVE BROADCAST | 4K HDR`).
- High-contrast glowing track title in `Orbitron` display typography.
- Artist attribution in `Outfit` secondary typography.
- Real-time audio waveform bar integrated along the bottom border.
- **Exclusive Display:** The canvas watermark was completely removed so the track info appears solely on the stage screen.

---

## 4. Concert Stage 3D Effects Suite

1. **`StageStructureEffect`**:
   - Elevated glossy reflective concert platform ($36\text{m} \times 18\text{m} \times 1.6\text{m}$) with neon edge lining.
   - DJ console riser with mini real-time spectrum LED front panel.
   - Curved LED Jumbotron mesh ($R = 26\text{m}, H = 12.5\text{m}, \theta = 93.6^\circ$).
   - Aluminum truss arch, vertical towers, and overhead ceiling lighting bridge.
   - Left & right line-array speaker towers with sub-bass vertical recoil.
   - Front VIP crowd barrier establishing audience depth.
2. **`FireShootersEffect`**:
   - 6 heavy-duty pyro flame blasters mounted along the stage lip.
   - Bursting vertical flame plumes up to $12\text{m}$ high on drum kicks ($E_{\text{subBass}} > 0.45$) and drops.
   - Dynamic stage point lights casting real-time orange/red firelight across the venue.
3. **`SmokeMachinesEffect`**:
   - 4 high-velocity Cryo CO2 cannons blasting cryogenic fog plumes upward.
   - Rolling stage haze drifting across the stage floor catching stage lights and lasers.
4. **`ThinLasersEffect`**:
   - 24 razor-thin concert laser projectors mounted on overhead truss, towers, and floor.
   - Modes: Liquid Sky, Stadium Fan, Scissor Cross, and Drop Frenzy Strobe.
5. **`StageLightsEffect`**:
   - 14 automated moving-head spotlights with volumetric light cones.
   - Beat-synchronized pan/tilt sweeps and blinder strobes.
6. **`ShockwaveRingEffect`**:
   - Bass-triggered chromatic ring shockwaves along the stage deck floor.
7. **`StarfieldEffect`**:
   - Deep night-sky arena backdrop behind the stage rig.

---

## 5. Viewport & Fullscreen Edge-to-Edge Guarantee

### Letterboxing Root Cause & Resolution
- **Issue:** Fullscreen toggle in macOS/Blink/WebKit caused a black letterboxing gap at the bottom of the screen.
- **Root Cause:**
  1. `renderer.setSize(width, height, false)` prevented Three.js from setting inline style dimensions on the canvas.
  2. `#root` lacked explicit `100%` height constraints in CSS.
  3. `resize` events fired prematurely before macOS fullscreen transition animations completed.
- **Resolution:**
  - Configured `html, body, #root, .synwave-app, .visualizer-canvas` with `width: 100% !important; height: 100% !important; min-width: 100vw; min-height: 100vh; margin: 0; padding: 0; overflow: hidden;`.
  - Updated `renderer.setSize(width, height, true)` to explicitly enforce canvas style matching.
  - Attached listeners to `fullscreenchange`, `webkitfullscreenchange`, `mozfullscreenchange`, and `MSFullscreenChange`.
  - Implemented multi-stage delayed re-measurement (at $0\text{ms}, 60\text{ms}, 180\text{ms}, 350\text{ms}, 600\text{ms}$) to guarantee zero-gap fit throughout animations.

---

## 6. Current State & Verification

- **Production Build:** `npm run build` compiles cleanly with code 0 (`tsc -b && vite build` bundled in ~430ms).
- **Vite Local Dev Server:** Running continuously at `http://localhost:5173/`.
- **Git Repository:** Ready for commit and push to `https://github.com/K-692/Synwave.git`.
