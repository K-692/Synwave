# Synwave: Procedural 3D Concert-Stage Simulator & Musical Choreography Engine

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js r186 + Web Audio API + Vite)  
> **Test Music Corpus:** Local `public/music/` test tracks (`Feel Something` - Melodic Dubstep, `Aaloshyo` - Acoustic Folk, `Waves` - Chill Wave)  
> **Architecture Principle:** 100% Procedural Generation & Neural Multi-STEM Source Separation Synchronization

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-adaptive **3D procedural concert-stage simulator** and desktop music visualizer. Rather than simply scaling visual effects with instantaneous frame loudness or wandering aimlessly with unanchored particles, Synwave acts as a **procedural concert lighting designer and show director**. It establishes an authoritative beat grid, separates the audio into distinct neural stems using **Demucs v4 (HTDemucs)**, detects transient onsets and energy trajectories, determines musical sections (intro, verse, buildup, drop, breakdown, outro), and coordinates physical concert fixtures (moving heads, kick blinders, razor-thin lasers, flame blasters, perimeter cross-lights) into intentional, synchronized choreographies.

### Key Architectural Pillars:
1. **Demucs AI 4-Stem Source Separation Pipeline:**
   - Integrates Meta's [Demucs](https://github.com/adefossez/demucs) (`htdemucs` hybrid transformer model) running via a local Python microservice on Apple Silicon MPS hardware.
   - Extracts 4 true musical stems: `drums`, `bass`, `instruments` (`other`), and `vocals`.
   - Computes 25 FPS normalized RMS energy envelopes and transient kick onsets, cached by file SHA-256 hash in `.synwave_cache/stems/` for instant ($<10\text{ms}$) recall on subsequent plays.
   - Live synchronization in `AudioEngine` interpolates exact Demucs stem amplitudes at `audioElement.currentTime`, driving all visual fixtures with authentic stem responsiveness.
2. **Dedicated Stem-to-Fixture Visual Mapping:**
   - **`drums` (Kicks & Drum Transients):** Drives screen/camera shake, white moving-head blinders flashing toward the camera, and front flame throws.
   - **`bass` (Sub-Bass & Synth Bass):** Activates dual top-of-screen straight laser machines, wide window-covering laser fans, stage floor wash radiance, and key light intensity.
   - **`instruments` (Synths, Leads, Guitars, Pianos):** Modulates 28 razor-thin rig lasers, pattern transitions, and fill light radiance.
   - **`vocals` (Lead & Backing Harmonics):** Drives 10 perimeter cross-stage lights executing scissor pan/tilt sweeps across the stage, plus stage screen ambient glow flare.
3. **Pre-Processing Loading Overlay (`StemSeparationLoader`):**
   - Sleek festival HUD displayed while Demucs separates stems, featuring 4 real-time animated stem meters, hardware acceleration badge ("APPLE MPS / GPU ACCELERATED"), and gradient progress shimmer.
4. **Authoritative Audio Clock & Beat Grid Engine:** Rhythmic quantization and continuous phase tracking ($0.0 \to 1.0$), monotonic beat counters, and bar/phrase boundaries (1 to 4/8 bars).
5. **Procedural Show Director:** State machine coordinating choreography patterns per musical section (intro, verse, buildup, drop, breakdown, outro).
6. **Exclusive Stage Mode: Festival Mainstage:** High-octane stadium EDM arena mode. All legacy modes removed to focus exclusively on festival mainstage realism.
7. **Razor-Thin Laser Beams:** Ultra-narrow cylindrical core ($0.005\text{m}$) and sheath ($0.012\text{m}$) geometry producing razor-sharp, needle-thin festival laser beams across the rig and top bass machines.
8. **Small Front-of-Screen Flame Throwers:** 8 flame cannons mounted directly in front of the screen's bottom rim ($Z = -3.85$, $Y = -1.35$) with compact bursts ($5.2 - 6.0\text{m}$) that cleanly erupt to cover the lower-to-middle screen area without towering above the roof.
9. **Zero Smoke Mode:** Smoke and haze effects removed completely across the engine, scene configs, and UI for maximum visual clarity.
10. **Drum/Kick Activated Screen Shake:** Camera and YouTube iframe screen shake strictly triggered on drum and kick transients (`stems.kick` and `isKick`), eliminating non-drum rumble.
11. **Silent Shazam & Compact Drop Container:** Shazam identification runs silently in the background with zero popups; the drag-drop container is a sleek, compact pill (`250px × 38px`) positioned at the bottom of the screen.
12. **Dynamic Video Thumbnail Color Gradient Extraction:** Samples official YouTube video thumbnails to tint spotlights with authentic aesthetic color gradients.
13. **Adjustable Colouring Spotlight Count:** Defaulted to 3 focused spotlights with a slider (1 to 8) in the Routing Console.

---

## 2. Demucs Neural Stem Separation Pipeline (`demucs_service.py` & `demucsService.ts`)

```
Audio Input (File or Path) ──► [DemucsService] ──► Cache Check (.synwave_cache/stems/{hash}.json)
                                     │
                    ┌────────────────┴────────────────┐
             (Cache Miss)                       (Cache Hit)
                    │                                 │
     Demucs v4 (htdemucs on MPS)                      │
     Separates: drums, bass, other, vocals            │
                    │                                 │
     Extract 25 FPS RMS Envelopes                     │
     Extract Kick Onset Transients                    │
     Write to .synwave_cache/stems/                   │
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
                      JSON Envelope Response (<10ms cached)
                                     ▼
                    [AudioEngine.setDemucsStems()]
                                     ▼
               Sampled at currentTime in getLiveFeatures()
```

### 2.1 Envelope Extraction Formulation
For each separated audio stem tensor $S \in \{\text{drums}, \text{bass}, \text{other}, \text{vocals}\}$ at sample rate $f_s = 44,100\text{Hz}$ and target frame rate $f_{\text{fps}} = 25\text{Hz}$ (hop length $H = \lfloor f_s / f_{\text{fps}} \rfloor = 1764$ samples):
1. **Mono Downmix:**
   $$x_m[n] = \frac{1}{C} \sum_{c=1}^C S[c, n]$$
2. **Windowed RMS Energy:**
   $$\text{RMS}[k] = \sqrt{\frac{1}{H} \sum_{n=k \cdot H}^{(k+1)H - 1} x_m[n]^2}$$
3. **Percentile Normalization:**
   $$\tilde{E}[k] = \min\left(1.0, \frac{\text{RMS}[k]}{1.15 \cdot P_{98}(\text{RMS})}\right)$$
4. **Kick Onset Detection:**
   $$\Delta_{\text{drums}}[k] = \tilde{E}_{\text{drums}}[k] - \tilde{E}_{\text{drums}}[k-1]$$
   An onset event is flagged when $\Delta_{\text{drums}}[k] > 0.22$ and $\tilde{E}_{\text{drums}}[k] > 0.35$.

---

## 3. Beat, Bar, and Phrase Detection Engine (`BeatGridEngine`)

`BeatGridEngine` tracks authoritative audio playback time (`audioElement.currentTime`) and synchronizes stage events to musical phrasing:

```
Audio Clock (currentTime) ───► [BeatGridEngine] ───► { bpm, beatIndex, barIndex, beatPhase, isBar, isPhrase }
                                     ▲
Live Onset Spikes (Energy Flux) ──────┘ (IOI Histogram & Median Clustering)
```

1. **Beat Period:** $T_{\text{beat}} = \frac{60.0}{\text{BPM}}$
2. **Continuous Beat Phase ($0.0 \to 1.0$):** $\phi_{\text{beat}}(t) = \frac{t \pmod{T_{\text{beat}}}}{T_{\text{beat}}}$
3. **Monotonic Beat Index:** $B(t) = \lfloor t / T_{\text{beat}} \rfloor$
4. **Bar Index ($1 \to 8$ in 4/4 Time):** $M(t) = (\lfloor B(t) / 4 \rfloor \pmod 8) + 1$
5. **Downbeat (`isBar`):** True when $B(t) \pmod 4 = 0$ and $\phi_{\text{beat}} < 0.12$.
6. **Phrase Boundary (`isPhrase`):** True when $B(t) \pmod{16} = 0$ and $\phi_{\text{beat}} < 0.12$.

---

## 4. Visual Lighting, Laser & Pyro Engineering

### 4.1 Razor-Thin Lasers (`ThinLasersEffect.ts`)
- **Rig Lasers (28 Projectors):** Core radius reduced to $0.005\text{m}$, sheath radius to $0.012\text{m}$. Beam scale reduced to $(0.5 + 0.25 \cdot \text{stems.instruments}) \cdot \text{laserDensity}$.
- **Top-of-Screen Bass Lasers (2 Machines):** Mounted at $(-8.0, 11.2, -4.3)$ and $(8.0, 11.2, -4.3)$. Straight core beam thickness reduced to $(0.32 + 0.38 \cdot \text{bassPulse})$, shooting straight toward the camera with wide expanding fans covering the window.

### 4.2 Small Front-of-Screen Flame Throwers (`FireShootersEffect.ts`)
- **Mount Coordinates:** 8 cannons arranged along the bottom rim directly in front of the screen at $Z = -3.85$, $Y = -1.35$, $X \in [-7.2, -5.1, -3.1, -1.0, 1.0, 3.1, 5.1, 7.2]$.
- **Dimensions:** Core height $5.2\text{m}$ (radius $0.16\text{m}$), outer cone height $6.0\text{m}$ (radius $0.95\text{m}$).
- **Target Reach:** Flame plumes burst straight up to $Y \approx 4.0 - 5.0$, perfectly covering the lower-to-middle screen area without towering out of frame.

### 4.3 Drum/Kick Activated Screen Shake (`VisualEngine.ts`)
- Computed from $\max(\text{stems.kick}, \text{isKick} ? \text{kickIntensity} : 0)$.
- Triggers when kick power exceeds $0.22$, applying bounded $(X, Y)$ displacement to both the 3D camera and the DOM YouTube iframe (`#synwave-youtube-stage-screen`) via `style.transform` at 60/120 FPS.

### 4.4 Perimeter Vocal Cross-Stage Lights (`StageLightsEffect.ts`)
- 10 perimeter cross-beam fixtures mounted along the screen frame (left tower, right tower, top truss) projecting crossing scissor beams across the stage.
- Pan and tilt sweep movements are modulated directly by $\text{stems.vocals}$.

---

## 5. Audio-to-Visual Routing Console (`RoutingStore`)

| Parameter | Range | Default | Functional Description |
|---|---|---|---|
| **`kickSensitivity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales drum kick detection threshold for white blinder spotlights, flame bursts, and screen shake. |
| **`bassToBeamIntensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Modulates moving-head beam thickness, lens radiance, and stage floor wash intensity. |
| **`vocalToScreenGlow`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales stage screen radial flare opacity and perimeter vocal cross-light sweep velocity. |
| **`pyroThreshold`** | $0.2 - 1.0$ | $0.45$ | Sensitivity floor for flame blasters (higher values require massive drop climaxes to trigger). |
| **`laserDensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Controls active laser projector count and volumetric sheath thickness. |
| **`spotlightCount`** | $1 - 8$ | $3$ | Sets the number of active colour-tinted spotlights sweeping the stage. |
| **`effectDecay`** | $0.5\times - 2.0\times$ | $1.0\times$ | Modulates attack and release envelope decay speed for blinders and fire bursts. |
| **`cameraShakeStrength`** | $0.0\times - 2.0\times$ | $1.0\times$ | Sets visceral sub-bass and drum kick vibration amplitude applied to camera and YouTube iframe. |
| **`reducedFlash`** | Boolean | `false` | Limits blinder cone opacity to $\le 0.05$ and disables aggressive strobing for light sensitivity. |
| **`disablePyrotechnics`** | Boolean | `false` | Global safety toggle: completely extinguishes all 8 stage flame cannons. |
| **`maxBrightnessLimit`** | $0.3\times - 1.0\times$ | $1.0\times$ | Venue lumen ceiling: prevents overexposure and clamps maximum scene luminance. |

---

## 6. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled cleanly in 412ms).
- **Vite Development Server:** Running continuously at `http://localhost:5173/`.
- **Audio Intelligence Microservice:** Running continuously as a local daemon at `http://127.0.0.1:8765/` (Demucs HTDemucs on Apple Silicon MPS + ShazamIO).
- **Bundled Tracks Pre-Cached:** `Ambyion & Abandoned - Waves.mp3`, `Feel Something.mp3`, and `Aaloshyo.mp3` are pre-separated and cached in `.synwave_cache/stems/` for instant playback.
- **Git Repository:** Committed locally on branch `main` (Rule 8: awaiting explicit user push instruction).
