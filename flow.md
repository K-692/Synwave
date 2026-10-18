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
3. **Audio-to-Visual Routing Console:** Configurable mapping layer with versioned `localStorage` profiles. Users fine-tune kick sensitivity, bass-to-beam intensity, vocal-to-screen glow, pyro thresholds, laser density, effect decay, and camera shake.
4. **4 Distinct Stage & Mood Presets (Visual Profiles):**
   - **Festival Mainstage:** High-octane stadium EDM arena with wide laser fans, sync flame cannons, punchy moving heads, and bass-reactive floor wash.
   - **Industrial Underground:** Raw warehouse techno with dense haze, cold strobing kick blinders, tight laser tunnels, and pyrotechnics disabled.
   - **Rock Arena:** Warm tungsten & gold spotlights, chorus fire bursts, heavy floor wash, and rhythmic moving head sweeps.
   - **Cinematic Ambient:** Intimate and ethereal chillout with soft cyan/violet volumetric haze, zero camera shake, delicate laser lines, and no flames.
5. **Synchronized Song Timeline:** Interactive waveform amplitude silhouette, colored section blocks (`INTRO`, `BUILDUP`, `DROP`, `BREAKDOWN`, `OUTRO`), beat ticks, hover timestamp, and clickable seeking.
6. **Telemetry & Synchronization Diagnostic HUD (Hotkey: `D`):** Real-time overlay showing live BPM, beat confidence, beat/bar counter, beat phase bar ($0.0 \to 1.0$), active section & choreography pattern, 4-STEM levels, rendering FPS, and active stage profile.
7. **Architectural Separation of Modes:**
   - **Mode 1: Instant Reactive Multi-Band Analysis** (local, zero-upload, instantaneous estimated signals).
   - **Mode 2: AI Stem Separation** (optional async remote KIE service for source-separated lossless audio).
   - Screen badge permanently updated to `● REAL-TIME VISUALS • NOW PLAYING` / `⚡ LIVE REACTIVE MODE • FESTIVAL DROP`.
8. **Solid Pitch-Black Stage Arena & Blowout-Free Optical Rig:** Pure `#000000` stadium backdrop, centered track details on the Jumbotron screen, and calibrated volumetric optical shaders (`FrontSide` rendering, cone radius $1.2\text{m}$, opacities $0.08 - 0.22$) preventing additive white blowout.

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

### 2.3 Local Storage Cache
Track tempo estimates and manual calibrations are stored in `localStorage` under `synwave_beatgrid_${trackId}`, preserving calibrated BPM across sessions.

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
| **`intro`** | *Ethereal Dawn* / *Warehouse Echo* | Lights, Screen Glow, Soft Haze (No Lasers, No Flames) | $0.65\times$ | Gentle synchronized moving-head sweeps, subtle screen illumination, ambient floor fog. |
| **`verse`** | *Rhythmic Arena Pulse* / *Groove Synchronizer* | Lights, Gentle Lasers, Screen, Low Haze (No Flames) | $0.95\times$ | Moving heads pulse on beat phase ($\phi_{\text{beat}}$), laser cross-scans change every 8 beats, blinders quiet. |
| **`buildup`** | *Tension Accelerando* | Lights, Converging Lasers, Cryo Bursts, Screen Strobing | $1.1\times \to 1.55\times$ | Moving heads tighten focus inward towards stage center; lasers form converging tunnel into audience; cryo CO2 warning bursts; intensity escalates with section progress. |
| **`drop`** | *Ultra Stadium Climax* / *Cold Strobe Cataclysm* | **ALL Effects Unleashed** (Lights, Wide Lasers, Flames, Cryo, Screen) | $1.5\times \to 1.8\times$ | Full laser fan transformations changing pattern every 4th or 8th beat; flame cannons firing on drum kicks with cooldowns; high-speed moving head ballyhoos; bounded camera shake. |
| **`breakdown`** | *Atmospheric Drift* | Dim Lights, Screen Ambient Wash, Rolling Fog | $0.70\times$ | Lights dim and fan wide into ceiling/sky; lasers and flame cannons silenced; soft drifting floor fog. |
| **`outro`** | *Gentle Dissolve* | Dim Lights Fading, Dispersing Haze | $0.50\times$ | Moving heads settle into floor wash; smoke cannons idle; lighting fades into warm darkness. |

---

## 4. Audio-to-Visual Routing Console (`RoutingStore`)

The Routing Console gives users complete control over how acoustic features translate to visual responses, persisted in `localStorage` (`synwave_routing_config_v2`):

### 4.1 Configurable Parameters

| Parameter | Range | Default | Functional Description |
|---|---|---|---|
| **`kickSensitivity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales drum kick detection threshold for white blinder spotlights and flame bursts. |
| **`bassToBeamIntensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Modulates moving-head beam thickness, lens radiance, and stage floor wash intensity. |
| **`vocalToScreenGlow`** | $0.2\times - 2.0\times$ | $1.0\times$ | Scales stage screen radial flare opacity and cryo smoke plume velocity. |
| **`pyroThreshold`** | $0.2 - 1.0$ | $0.45$ | Sensitivity floor for flame blasters (higher values require massive drop climaxes to trigger). |
| **`laserDensity`** | $0.2\times - 2.0\times$ | $1.0\times$ | Controls active laser projector count (out of 28 fixtures) and volumetric sheath thickness. |
| **`effectDecay`** | $0.5\times - 2.0\times$ | $1.0\times$ | Modulates attack and release envelope decay speed for blinders and fire bursts. |
| **`cameraShakeStrength`** | $0.0\times - 2.0\times$ | $1.0\times$ | Sets visceral sub-bass vibration amplitude (set to $0.0$ for fully locked camera). |
| **`reducedFlash`** | Boolean | `false` | Limits blinder cone opacity to $\le 0.05$ and disables aggressive strobing for light sensitivity. |
| **`disablePyrotechnics`** | Boolean | `false` | Global safety toggle: completely extinguishes all 8 stage flame cannons. |
| **`maxBrightnessLimit`** | $0.3\times - 1.0\times$ | $1.0\times$ | Venue lumen ceiling: prevents overexposure and clamps maximum scene luminance. |

### 4.2 Stage Profiles

1. **Festival Mainstage (`festival-mainstage`):** Wide laser fans, full pyrotechnics, punchy moving heads, camera shake $1.2\times$, pyro threshold $0.45$.
2. **Industrial Underground (`industrial-underground`):** Acid green / cold white strobes, tight laser tunnels, intense kick blinders, dense smoke, pyrotechnics permanently disabled.
3. **Rock Arena (`rock-arena`):** Warm amber & gold spotlights, chorus fire bursts, heavy floor wash, camera shake $0.85\times$.
4. **Cinematic Ambient (`cinematic-ambient`):** Cyan/violet volumetric haze, zero camera shake ($0.0\times$), delicate laser lines, no flames, reduced flash enabled.

---

## 5. Synchronized Song Timeline (`SongTimeline`)

Replaced simple 1-line progress slider with an interactive, full-fidelity track timeline:
- **Waveform Profile:** 120-bin amplitude envelope computed from decoded PCM frames or procedural festival trajectory.
- **Section Blocks:** Visually distinct color-coded zones (`INTRO` blue, `VERSE` slate, `BUILDUP` amber, `DROP` hot pink, `BREAKDOWN` purple, `OUTRO` indigo).
- **Interactive Seeking:** Clicking any position seeks audio immediately, recalculating beat phase and active section.
- **Hover Timestamp Tooltip:** Displays precise time badge upon mouse hover.
- **Active Section Tag:** Displays current musical section badge in real time.

---

## 6. Telemetry & Synchronization Diagnostic HUD (`DiagnosticOverlay`)

Toggleable via hotkey `D` or the Header Activity button:
- **Beat Grid Panel:** Live estimated BPM, Beat Confidence percentage, Beat Index counter, Bar Index, Downbeat/Phrase indicator, and continuous Beat Phase progress bar ($0.0 \to 1.0$).
- **Show Director Panel:** Active musical section, active Stage Profile, choreography pattern name, intensity multiplier, and section progress bar.
- **4-Channel STEM Panel:** Live level meters for Kick, Bass, Instruments, and Vocals.
- **Engine Performance Panel:** Active mode badge (`Mode 1: Instant Reactive`), real-time rendering FPS, onset transient strength, spectral centroid, and drop climax state.

---

## 7. Keyboard Show Controls

| Shortcut Key | Action |
|---|---|
| **`Space`** | Play / Pause media playback |
| **`F`** | Toggle borderless fullscreen |
| **`1`** | Select Stage Profile: **Festival Mainstage** |
| **`2`** | Select Stage Profile: **Industrial Underground** |
| **`3`** | Select Stage Profile: **Rock Arena** |
| **`4`** | Select Stage Profile: **Cinematic Ambient** |
| **`D`** | Toggle Telemetry & Synchronization HUD |
| **`C`** | Toggle Audio-to-Visual Routing Console |
| **`P`** | Toggle Pyrotechnics (Flames ON / OFF) |
| **`M`** | Toggle Reduced Flash / Reduced Motion Mode |
| **`ArrowLeft` / `ArrowRight`** | Seek $-5\text{s}$ / $+5\text{s}$ with instant beat re-sync |

---

## 8. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled in 520ms).
- **Vite Development Server:** Running continuously at `http://localhost:5173/`.
- **Git Repository:** Committed locally on branch `main` (Rule 8: awaiting explicit user push instruction).
- **Optical Balance:** Stage lighting cones, kick blinders, and lasers maintain calibrated `FrontSide` rendering with opacities between $0.08$ and $0.22$, preventing white screen blowout.
