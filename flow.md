# Synwave: Procedural 3D Concert-Stage Simulator & Musical Choreography Engine

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js r186 + Web Audio API + Vite)  
> **Test Music Corpus:** Local `public/music/` test tracks (`Feel Something` - Melodic Dubstep, `Aaloshyo` - Acoustic Folk, `Waves` - Chill Wave)  
> **Architecture Principle:** 100% Procedural Generation & Musical Phrasing Synchronization (Zero pre-rendered video loops, zero stock footage, local-first computation)

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-adaptive **3D procedural concert-stage simulator** and desktop music visualizer. Rather than simply scaling visual effects with instantaneous frame loudness or wandering aimlessly with unanchored particles, Synwave acts as a **procedural concert lighting designer and show director**. It establishes an authoritative beat grid, detects transient onsets and energy trajectories, determines musical sections (intro, verse, buildup, drop, breakdown, outro), and coordinates physical concert fixtures (moving heads, blinders, heavyweight lasers, flame blasters, cryo smoke) into intentional, synchronized choreographies.

### Key Architectural Pillars:
1. **Authoritative Audio Clock & Beat Grid Engine:** Rhythmic quantization and continuous phase tracking ($0.0 \to 1.0$), monotonic beat counters, and bar/phrase boundaries (1 to 4/8 bars) driving synchronized fixture movements.
2. **Procedural Show Director:** A rules-driven state machine that chooses which effects are permitted to fire and what choreographies they execute based on active track section and stage profile, avoiding chaotic instantaneous triggering.
3. **Audio-to-Visual Routing Console:** Configurable mapping layer with versioned `localStorage` profiles. Users fine-tune kick sensitivity, bass-to-beam intensity, vocal-to-screen glow, pyro thresholds, laser density, effect decay, camera shake, and active spotlight count.
4. **Single Dedicated Stage Mode: Festival Mainstage:**
   - High-octane stadium EDM arena with wide laser fans, sync flame cannons, punchy moving heads, and bass-reactive floor wash. Other legacy modes removed to focus exclusively on festival mainstage realism.
5. **Synchronized Song Timeline:** Interactive waveform amplitude silhouette with played progress fill, playhead handle, hover timestamp tooltip, and clickable seeking.
6. **Clean Minimal Stadium Jumbotron Screen & 3D Masking Aperture:** Solid pitch-black occluder walls completely enclose the stage screen opening ($21.0 \times 11.8\text{m}$ at $Z = -4.46$) with a bold industrial bezel, perfectly clipping and masking the YouTube video behind it so no video content or letterbox margins ever leak outside the stage boundaries.
7. **Audio-Synchronized Iframe Screen Shake:** Real-time $(X, Y)$ screen pixel displacement calculated from camera shake in `VisualEngine.renderFrame()` directly mutates the YouTube video container's CSS transform at 60/120 FPS, shaking the video in unison with sub-bass audio kicks and drop climaxes.
8. **Dynamic Video Thumbnail Color Gradient Extraction:** Asynchronously fetches the official YouTube video thumbnail (`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`), samples pixels on an offscreen canvas, filters letterboxing, computes color vibrancy, and dynamically tints stage spotlights and scene palettes to match the video's aesthetic palette.
9. **Dual Top-of-Screen Bass Laser Machines:** Two heavy laser machines mounted on top of the stage screen (`(-8, 11.2, -4.3)` and `(8, 11.2, -4.3)`) fire straight high-intensity beams towards the camera that expand into wide volumetric fans covering the window, activated and modulated directly on bass and sub-bass energy.
10. **Perimeter Cross-Stage Vocal Lights:** 10 fixtures mounted along the screen frame (left tower, right tower, top truss) project crossing scissor beams across the stage with pan/tilt sweep trajectories driven directly by the vocal STEM (`features.stems.vocals`).
11. **Drop Aftermath Cryo Smoke & Haze:** Crisp, clear stage visibility during normal playback (preventing continuous foggy blowout), with realistic rolling floor fog and dense CO2 cryo blasts deployed around the stage floor and wings specifically when extreme music sections (like drops) come to an end.
12. **Adjustable Colouring Spotlight Count:** Defaulted to 3 focused stage spotlights, with an interactive slider (1 to 8) in the Routing Console.

---

## 2. Beat, Bar, and Phrase Detection Engine (`BeatGridEngine`)

To eliminate erratic frame-by-frame triggering, `BeatGridEngine` tracks authoritative audio playback time (`audioElement.currentTime`) and synchronizes stage events to musical phrasing:

```
Audio Clock (currentTime) ───► [BeatGridEngine] ───► { bpm, beatIndex, barIndex, beatPhase, isBar, isPhrase }
                                     ▲
Live Onset Spikes (Energy Flux) ──────┘ (IOI Histogram & Median Clustering)
```

### 2.1 Mathematical Formulation
1. **Beat Period:**
   $$T_{\text{beat}} = \frac{60.0}{\text{BPM}}$$
2. **Continuous Beat Phase ($0.0 \to 1.0$):**
   $$\phi_{\text{beat}}(t) = \frac{t \pmod{T_{\text{beat}}}}{T_{\text{beat}}}$$
3. **Monotonic Beat Index:**
   $$B(t) = \left\lfloor \frac{t}{T_{\text{beat}}} \right\rfloor$$
4. **Bar Index ($1 \to 8$ in 4/4 Time):**
   $$M(t) = \left(\left\lfloor \frac{B(t)}{4} \right\rfloor \pmod 8\right) + 1$$
5. **Downbeat & Phrase Boundaries:**
   - **Downbeat (`isBar`):** True when $B(t) \pmod 4 = 0$ and $\phi_{\text{beat}} < 0.12$.
   - **Phrase Boundary (`isPhrase`):** True when $B(t) \pmod{16} = 0$ and $\phi_{\text{beat}} < 0.12$.

### 2.2 Instantaneous Seek Re-Synchronization
Because all phase and index variables are mathematically computed directly from `currentTime`, seeking immediately re-aligns the beat grid, section progression, and visual phase with zero drift or phase artifacts.

---

## 3. Procedural Show Director (`ShowDirector`)

The Show Director coordinates concert-stage choreography across musical sections:

```
Track Analysis / Trajectory ──► [ShowDirector] ──► ShowDirectorState:
                                                       ├── currentSection (intro, verse, buildup, drop, breakdown, outro)
                                                       ├── sectionProgress (0.0 to 1.0)
                                                       ├── choreographyPattern ("Ultra Stadium Climax", "Tension Accelerando")
                                                       ├── allowedEffects ({ lights, lasers, flames, smoke, screen })
                                                       └── intensityMultiplier (0.5x to 1.8x)
```

### 3.1 Section Choreography Matrix

| Section | Default Choreography Pattern | Allowed Stage Effects | Intensity Multiplier | Physical Stage Behavior |
|---|---|---|---|---|
| **`intro`** | *Ethereal Dawn* | Lights, Screen Glow, Soft Haze (No Lasers, No Flames) | $0.65\times$ | Gentle synchronized moving-head sweeps, subtle screen illumination, ambient floor fog. |
| **`verse`** | *Rhythmic Arena Pulse* | Lights, Gentle Lasers, Screen, Low Haze (No Flames) | $0.95\times$ | Moving heads pulse on beat phase ($\phi_{\text{beat}}$), laser cross-scans change every 8 beats, blinders quiet. |
| **`buildup`** | *Tension Accelerando* | Lights, Converging Lasers, Cryo Bursts, Screen Strobing | $1.1\times \to 1.55\times$ | Moving heads tighten focus inward towards stage center; lasers form converging tunnel into audience; cryo CO2 warning bursts; intensity escalates with section progress. |
| **`drop`** | *Ultra Stadium Climax* | **ALL Effects Unleashed** (Lights, Top Bass Lasers, Wide Lasers, Flames, Cryo, Screen) | $1.5\times \to 1.8\times$ | Full laser fan transformations changing pattern every 4th or 8th beat; flame cannons firing on drum kicks with cooldowns; high-speed moving head ballyhoos; bounded camera shake. |
| **`breakdown`** | *Drop Resolution Aftermath* | Dim Lights, Screen Ambient Wash, Dense Cryo Fog | $0.70\times$ | Rolling cryo floor fog floods the stage wings as drop energy dissipates; lasers and flame cannons silenced; soft drifting floor fog. |
| **`outro`** | *Gentle Dissolve* | Dim Lights Fading, Dispersing Haze | $0.50\times$ | Moving heads settle into floor wash; smoke cannons idle; lighting fades into warm darkness. |

---

## 4. Audio-to-Visual Routing Console (`RoutingStore`)

The Routing Console gives users complete control over how acoustic features translate to visual responses, persisted in `localStorage` (`synwave_routing_config_v2`):

### 4.1 Configurable Parameters

| Parameter | Range | Default | Functional Description |
|---|---|---|---|
| **`kickSensitivity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales drum kick detection threshold for white blinder spotlights and flame bursts. |
| **`bassToBeamIntensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Modulates moving-head beam thickness, lens radiance, and stage floor wash intensity. |
| **`vocalToScreenGlow`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales stage screen radial flare opacity and perimeter vocal cross-light sweep velocity. |
| **`pyroThreshold`** | $0.2 - 1.0$ | $0.45$ | Sensitivity floor for flame blasters (higher values require massive drop climaxes to trigger). |
| **`laserDensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Controls active laser projector count and volumetric sheath thickness. |
| **`spotlightCount`** | $1 - 8$ | $3$ | Sets the number of active colour-tinted spotlights sweeping the stage. |
| **`effectDecay`** | $0.5\times - 2.0\times$ | $1.0\times$ | Modulates attack and release envelope decay speed for blinders and fire bursts. |
| **`cameraShakeStrength`** | $0.0\times - 2.0\times$ | $1.0\times$ | Sets visceral sub-bass vibration amplitude applied to both 3D camera and YouTube iframe. |
| **`reducedFlash`** | Boolean | `false` | Limits blinder cone opacity to $\le 0.05$ and disables aggressive strobing for light sensitivity. |
| **`disablePyrotechnics`** | Boolean | `false` | Global safety toggle: completely extinguishes all 8 stage flame cannons. |
| **`maxBrightnessLimit`** | $0.3\times - 1.0\times$ | $1.0\times$ | Venue lumen ceiling: prevents overexposure and clamps maximum scene luminance. |

---

## 5. Visual Lighting & Laser Engineering

### 5.1 Perimeter Vocal Cross-Stage Lights
- **Location:** Mounted around the perimeter frame of the central Jumbotron screen (left tower, right tower, top truss).
- **Beam Pattern:** Projects crossing scissor beams across the stage.
- **Audio Modulation:** Pan and tilt sweep movements are driven directly by `features.stems.vocals`. Higher vocal presence causes wider, faster scissor sweeps.

### 5.2 Dual Top-of-Screen Bass Laser Machines
- **Mount Coordinates:** Top-left emitter at $(-8.0, 11.2, -4.3)$ and top-right emitter at $(8.0, 11.2, -4.3)$.
- **Projection Dynamics:** Shoots high-intensity straight core laser beams directly towards the camera, surrounded by expanding volumetric fans that cover the window.
- **Audio Modulation:** Driven by `features.stems.bass` and `features.subBass`. Deep bass hits trigger heavy volumetric expansion, beam strobe frequency acceleration, and subtle target vibration.

### 5.3 Dynamic Thumbnail Color Gradient Extraction
- **Service:** `src/services/thumbnailColorService.ts`
- **Method:** Downloads YouTube video thumbnail (`hqdefault.jpg`), renders to offscreen canvas, samples pixels with letterbox rejection, maps RGB to HSL, and isolates the most vibrant gradient hues.
- **Application:** Passed to `visualEngine.setCustomSpotlightColors()`, ensuring moving-head spotlights and venue ambient wash harmoniously match the music video's visual identity.

### 5.4 Drop Aftermath Cryo Smoke & Haze
- **State Machine:** In `SmokeMachinesEffect.ts`, tracks transitions from `isDrop = true` to `isDrop = false` (`wasInDrop` transition).
- **Behavior:** Standard playback keeps the stage clean and crisp without continuous smoke blowout. When an intense drop concludes, a 5.2-second aftermath sequence fires dense CO2 cryo jets and floods the stage wings with low-lying rolling fog before cleanly dissipating.

---

## 6. Hardware Acceleration & Quality Presets (`hardwareDetector`)

Automatic runtime profiling determines system graphics capabilities via WebGL unmasked renderer queries:
- **Apple Silicon MPS (Metal Performance Shaders):** Detects `Apple M1/M2/M3/M4` and `Apple GPU`. Automatically configures high-performance GPU profile with $2.0\times$ device pixel ratio.
- **Dedicated Hardware GPU:** Detects NVIDIA GeForce / RTX, AMD Radeon, Intel Arc / Iris. Automatically applies high-performance GPU profile.
- **Software / CPU Fallback:** Detects SwiftShader, llvmpipe, or software rasterizers. Defaults to 60 FPS standard mode with clamped $1.0\times$ pixel ratio to prevent CPU bottlenecking.

---

## 7. ShazamIO Audio Recognition & Synchronized YouTube Stage Player

1. **Automated Song Identification (`shazamio` + `shazam_server.py`):**
   - Integrates [ShazamIO](https://github.com/shazamio/ShazamIO) via a lightweight local Python FastAPI microservice running in an isolated virtual environment (`.venv`) on `http://127.0.0.1:8765`.
   - Public fingerprinting endpoints operate with zero external API credentials needed.

2. **YouTube Data API v3 Search (`youtubeService.ts`):**
   - Retrieves top music video result (`videoId`) matching `${title} ${artist}`.

3. **Synchronized Video Iframe Player (`YouTubeStagePlayer.tsx`):**
   - Mounts a 16:9 YouTube video iframe positioned directly behind the 3D stadium stage screen (`z-index: 1`).
   - Strict volume muting (`volume=0`, `mute()`) ensures audio runs through Synwave's high-fidelity procedural Web Audio engine.
   - Authoritative timestamp synchronization locks video playback to audio `currentTime` with $<0.35\text{s}$ tolerance.

4. **Optical Stacking & Transparent WebGL Compositing Architecture:**
   - **Sent Video to Back (`z-index: 1`):** YouTube iframe container sits behind the Three.js canvas.
   - **Transparent WebGL Canvas (`z-index: 2`):** `THREE.WebGLRenderer` initialized with `alpha: true`, `scene.background = null`, `setClearColor(0x000000, 0)`, and `pointer-events: none`.
   - **3D Black Border Occluder Walls:** Four massive black planes ($Z = -4.46$) completely cover the area around the $21.0 \times 11.8\text{m}$ screen opening. Any part of the YouTube iframe that overflows the stage aperture is cleanly occluded by the black stage architecture.
   - **Iframe Shake:** Camera displacement from sub-bass hits in `VisualEngine` triggers the `onStageShake` callback, updating the YouTube iframe container's CSS transform with zero React re-render overhead.

---

## 8. Keyboard Show Controls

| Shortcut Key | Action |
|---|---|
| **`Space`** | Play / Pause media playback |
| **`F`** | Toggle borderless fullscreen |
| **`1`** | Select Stage Profile: **Festival Mainstage** |
| **`D`** | Toggle Telemetry & Synchronization HUD |
| **`C`** | Toggle Audio-to-Visual Routing Console |
| **`P`** | Toggle Pyrotechnics (Flames ON / OFF) |
| **`M`** | Toggle Reduced Flash / Reduced Motion Mode |
| **`ArrowLeft` / `ArrowRight`** | Seek $-5\text{s}$ / $+5\text{s}$ with instant beat re-sync |

---

## 9. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled cleanly in 367ms).
- **Vite Development Server:** Running continuously at `http://localhost:5173/`.
- **ShazamIO Microservice:** Running continuously as a local daemon at `http://127.0.0.1:8765/` using `.venv`.
- **Git Repository:** Committed locally on branch `main` (Rule 8: awaiting explicit user push instruction).
- **Visual Stacking:** YouTube iframe is sent to the background (`z-index: 1`) with real-time audio shake, while the transparent Three.js WebGL canvas (`z-index: 2`) renders solid black occluder borders, moving-head spotlight beams (with thumbnail colors), vocal-reactive cross-stage perimeter lights, dual top bass lasers, drop aftermath cryo smoke, and fire plumes directly on top of the playing video.
