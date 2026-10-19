# Synwave: Procedural 3D Concert-Stage Simulator & Musical Choreography Engine

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js r186 + Web Audio API + Vite)  
> **Test Music Corpus:** Local `public/music/` test tracks (`Feel Something` - Melodic Dubstep, `Aaloshyo` - Acoustic Folk, `Waves` - Chill Wave)  
> **Architecture Principle:** 100% Procedural Generation & Neural Multi-STEM Source Separation Synchronization

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-adaptive **3D procedural concert-stage simulator** and desktop music visualizer. Rather than simply scaling visual effects with instantaneous frame loudness or wandering aimlessly with unanchored particles, Synwave acts as an **autonomous concert lighting designer and show director**. It establishes an authoritative beat grid, pre-processes the entire audio track using **Demucs v4 (HTDemucs)** to extract 4 neural stems and acoustic intensity trajectories, detects transient onsets and section boundaries, and coordinates physical concert fixtures into synchronized, cinematic choreographies.

### Key Architectural Pillars:
1. **Full Track Pre-Processing & Acoustic Spectrum Analysis (Zero Real-Time Guesswork):**
   - The entire audio file is pre-processed up-front with Demucs v4 on Apple Silicon MPS hardware.
   - Extracts 4 neural stems: `drums`, `bass`, `instruments` (`other`), and `vocals`.
   - Pre-computes frame-accurate normalized RMS energy envelopes at 20 FPS (every 50ms), pinpointed transient kick events (`kickEvents` with exact time offsets and amplitudes), an `instrumentalActivity` trajectory, and a `globalIntensity` timeline across the entire track.
   - All pre-processed timelines are cached in `.synwave_cache/stems/{hash}.json` by SHA-256 hash for sub-millisecond retrieval on future sessions.
2. **Top-Bar Audio Loader & Unobstructed Stage Screen:**
   - The audio loading container is cleanly relocated into the top navigation bar (`Header.tsx`) with full drag-and-drop and click-to-browse support.
   - The center screen drop target is eliminated, leaving the rectangular Jumbotron screen and YouTube video completely unobstructed.
   - Whole-window drag-and-drop remains supported for effortless file loading.
3. **Stage Video Playback Gate:**
   - Music playback is strictly gated until the stage video is loaded and initialized (`isVideoReady` & `isVideoLoading`).
   - Transport play button displays a loading spinner and disabled state until the YouTube iframe is ready, ensuring 100% video-audio synchrony from the very first frame.
4. **Steady Window & YouTube Screen-Only Kick Shake:**
   - 3D audience camera is locked firmly at $(X=0, Y=1.8, Z=9.2)$ with zero camera shake on bass. The window and 3D canvas remain completely steady.
   - High-energy drum kicks apply bounded pixel displacement strictly to the DOM YouTube iframe (`#synwave-youtube-stage-screen`) via `style.transform`.
5. **Freeze-on-Pause Engine:**
   - When playback is paused or stopped (`isPlaying = false`), `deltaSeconds` is passed as 0 to all visual effects, and internal time accumulators halt.
   - All moving heads, perimeter beams, fan lasers, and stage sweeps instantly freeze in place rather than wandering or idling procedurally.
6. **360° Rotatable Perimeter Bass Lights:**
   - 12 high-intensity fixtures mounted along the left tower, right tower, top truss, and bottom frame surrounding the YouTube screen.
   - Activated on the bass spectrum (`features.stems.bass`, `features.bass`, `features.subBass`).
   - Execute continuous 360° rotational sweeps around their mounts, with rotation speed and cone thickness directly manipulated by bass frequency and energy.
   - Significantly increased beam aperture (radius $1.4\text{m}$, length $28\text{m}$), high volumetric opacity ($0.48$), and rich color gradients sampled from the official video thumbnail.
7. **Kick Screen Flash with Bass-Modulated Thumbnail Color Gradients:**
   - The 3 bottom white spotlight circles have been removed.
   - Drum kicks trigger the full-window blinder flash (`.festival-window-blinder`).
   - Color is dynamically modulated by bass intensity:
     - **Low Bass:** Pure brilliant white strobe (`radial-gradient(circle at center, rgba(255,255,255,0.95), rgba(255,255,255,0.15))`).
     - **High Bass:** Rich multi-stop radial gradient sampled directly from the YouTube video thumbnail palette (`#ffffff 10%`, `primary 40%`, `secondary 75%`, `accent 100%`).
8. **Arena Cathedral Crossing Fan Lasers (Matching Reference Image):**
   - Replaced arc-like lasers with concentrated stage deck projector stations (Left Wing at $X=-5.0$, Right Wing at $X=+5.0$, Center at $X=0.0$).
   - Shoots wide radial fans of 16 straight, razor-sharp beams each across azimuth ($-20^\circ$ to $+65^\circ$) and elevation ($14^\circ$ to $72^\circ$), crossing in mid-air to create an authentic geometric diamond canopy.
   - Movement speed, fan spread aperture, and scissor crossing oscillate dynamically based on the instrumental section (`features.instrumentalActivity` and `features.stems.instruments`). Higher instrumental frequency $\to$ faster, wider movements.
   - Top-of-screen straight bass laser machines project high-power beams towards the camera to blanket the viewport during heavy drops.
9. **Front-of-Screen Flame Cannons:**
   - 8 flame cannons mounted directly in front of the screen's bottom lip ($Z = -3.85$, $Y = -1.35$) bursting up to $5.2 - 6.0\text{m}$ to cover the lower-to-middle screen area during drop climaxes.
10. **Redesigned Audio-to-Visual Routing Console:**
   - Modernized interface providing granular calibration across 5 dedicated sections: Drums & Kicks, Bass Spectrum & 360° Screen Lights, Instrumental Cathedral Lasers, Stage Spotlights, and Safety & Accessibility.

---

## 2. Demucs Offline Pre-Processing Architecture (`demucs_service.py` & `demucsService.ts`)

```
Audio Input (File or Path) ──► [DemucsService] ──► Cache Check (.synwave_cache/stems/{hash}.json)
                                     │
                    ┌────────────────┴────────────────┐
             (Cache Miss)                       (Cache Hit)
                    │                                 │
     Demucs v4 (htdemucs on MPS)                      │
     Separates: drums, bass, other, vocals            │
                    │                                 │
     Extract 20 FPS RMS Envelopes                     │
     Detect Kick Onsets & Amplitudes (kickEvents)     │
     Compute instrumentalActivity Trajectory          │
     Compute globalIntensity Spectrum Profile         │
     Write to .synwave_cache/stems/                   │
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
                      JSON Envelope Response (<10ms cached)
                                     ▼
                    [AudioEngine.setDemucsStems()]
                                     ▼
             Live features sampled at currentTime in AudioEngine
```

### 2.1 Acoustic Envelope & Feature Extraction Formulation
For each separated audio stem tensor $S \in \{\text{drums}, \text{bass}, \text{other}, \text{vocals}\}$ at sample rate $f_s = 44,100\text{Hz}$ with frame hop $H = 2205$ samples ($20\text{Hz}$ resolution):
1. **Windowed RMS Energy:**
   $$\text{RMS}[k] = \sqrt{\frac{1}{H} \sum_{n=k \cdot H}^{(k+1)H - 1} x_m[n]^2}$$
2. **Percentile Normalization:**
   $$\tilde{E}[k] = \min\left(1.0, \frac{\text{RMS}[k]}{1.15 \cdot P_{98}(\text{RMS})}\right)$$
3. **Kick Event Extraction with Intensity:**
   $$\Delta_{\text{drums}}[k] = \tilde{E}_{\text{drums}}[k] - \tilde{E}_{\text{drums}}[k-1]$$
   When $\Delta_{\text{drums}}[k] > 0.22$ and $\tilde{E}_{\text{drums}}[k] > 0.35$, a kick event is recorded with $t_k = k / 20.0$ and amplitude $\alpha_k = \min(1.0, \Delta_{\text{drums}}[k] \cdot 1.8)$.
4. **Instrumental Activity Profile:**
   $$A_{\text{inst}}[k] = \min\left(1.0, \tilde{E}_{\text{other}}[k] \cdot 0.8 + |\tilde{E}_{\text{other}}[k] - \tilde{E}_{\text{other}}[k-1]| \cdot 1.2\right)$$
5. **Global Spectral Intensity:**
   $$I_{\text{global}}[k] = 0.35 \cdot \tilde{E}_{\text{drums}}[k] + 0.35 \cdot \tilde{E}_{\text{bass}}[k] + 0.20 \cdot \tilde{E}_{\text{other}}[k] + 0.10 \cdot \tilde{E}_{\text{vocals}}[k]$$

---

## 3. Visual Rig Engineering & Spatial Physics

### 3.1 Arena Cathedral Crossing Fan Lasers (`ThinLasersEffect.ts`)
- **Stage Wing Projector Stations:** Left ($X=-5.0, Y=0.5, Z=-1.2$), Right ($X=+5.0, Y=0.5, Z=-1.2$), and Center ($X=0.0, Y=0.6, Z=-2.2$).
- **Ray Density:** 16 straight cylindrical beams per wing station, 8 beams at center station (40 total arena rays).
- **Beam Kinematics:** Straight rays projected to spherical coordinates $(r=48.0\text{m}, \theta_{\text{azimuth}}, \phi_{\text{elevation}})$:
  $$\begin{aligned}
  X_{\text{endpoint}} &= X_{\text{origin}} + \sin(\theta) \cdot \cos(\phi) \cdot r \\
  Y_{\text{endpoint}} &= Y_{\text{origin}} + \sin(\phi) \cdot r \\
  Z_{\text{endpoint}} &= Z_{\text{origin}} + \cos(\theta) \cdot \cos(\phi) \cdot r
  \end{aligned}$$
- **Instrumental Synchronization:**
  - Sweep speed: $\omega_{\text{sweep}} = (0.75 + 3.8 \cdot A_{\text{inst}}) \cdot \text{speedMult}$
  - Fan spread: $S_{\text{fan}} = 1.0 + 0.35 \cdot A_{\text{inst}}$
  - Scissor oscillation: $\theta_{\text{left}} = \theta_{\text{base}} + \sin(\omega_{\text{sweep}} \cdot t) \cdot 0.16 \cdot S_{\text{fan}}$
- **Freeze State:** When $dt = 0$, $t$ remains constant, locking all ray orientations and emitter flares in place.

### 3.2 360° Continuous Rotatable Perimeter Bass Rig (`StageLightsEffect.ts`)
- **Mount Configuration:** 12 fixtures framing the YouTube screen ($X = \pm 12.0$ on towers, $Y = 11.4$ on top truss, $Y = 0.8$ on stage deck).
- **360° Circular Sweep Equations:**
  $$\begin{aligned}
  \psi(t) &= \psi_0 + \int (1.4 + 5.5 \cdot \text{stems.bass}^{1.3}) \, dt \\
  X_{\text{target}} &= X_{\text{base}} \pm \sin(\psi(t) + \delta_i) \cdot (5.5 + 6.5 \cdot \text{stems.bass}) \\
  Y_{\text{target}} &= Y_{\text{base}} + \cos(\psi(t) + \delta_i) \cdot (3.8 + 5.0 \cdot \text{stems.bass}) \\
  Z_{\text{target}} &= Z_{\text{base}} + \sin(1.5 \cdot (\psi(t) + \delta_i)) \cdot 5.0
  \end{aligned}$$
- **Optics:** Volumetric cone radius $1.4\text{m}$, length $28\text{m}$, opacity up to $0.48$, and lens flare radius $0.24\text{m}$.

### 3.3 Kick Blinder Screen Flash (`VisualEngine.ts`)
- Triggered when $\text{stems.kick} > 0.30$ or onset transient flags `isKick`.
- Opacity jumps to $\min(0.85, (0.35 + 0.45 \cdot \text{stems.kick}) \cdot \text{flashMult})$ and decays at $14.0\text{s}^{-1}$.
- CSS Background interpolation:
  - If $\text{stems.bass} < 0.20$: `radial-gradient(circle at center, rgba(255,255,255,0.95), rgba(255,255,255,0.15))`
  - If $\text{stems.bass} \ge 0.20$: `radial-gradient(circle at center, rgba(255,255,255,0.9) 10%, ${primary} 40%, ${secondary} 75%, ${accent} 100%)`

---

## 4. Audio-to-Visual Routing Console Specification

| Parameter | Section | Range | Default | Functional Description |
|---|---|---|---|---|
| **`screenShakeIntensity`** | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Bounded pixel displacement strictly applied to the YouTube stage screen on heavy kicks. |
| **`screenFlashIntensity`** | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Full-window blinder strobe flash intensity triggered by drum kick onsets. |
| **`kickSensitivity`** | Drums & Kicks | $0.2\times - 2.0\times$ | $1.0\times$ | Threshold scaling for kick transient detection and flame burst ignition. |
| **`pyroThreshold`** | Drums & Kicks | $0.2 - 1.0$ | $0.45$ | Activation floor for front stage flame cannons. |
| **`perimeterBassRotationSpeed`**| Bass Spectrum | $0.2\times - 3.0\times$ | $1.0\times$ | Continuous 360° orbital rotation speed of perimeter screen lights driven by bass frequency. |
| **`bassToBeamIntensity`** | Bass Spectrum | $0.2\times - 2.5\times$ | $1.0\times$ | Modulates moving-head beam thickness, floor wash radiance, and top bass cannons. |
| **`screenFlashColorSaturation`**| Bass Spectrum | $0.0\times - 2.0\times$ | $1.0\times$ | Blends video thumbnail gradient colors into screen flash on high bass hits (white at low bass). |
| **`effectDecay`** | Bass Spectrum | $0.5\times - 2.5\times$ | $1.0\times$ | Attack and release envelope decay speed for flashes and bass pulses. |
| **`instrumentalMovementSpeed`** | Instruments | $0.2\times - 3.0\times$ | $1.0\times$ | Multiplies fan spread and scissor crossing speed for arena cathedral fan lasers. |
| **`laserDensity`** | Instruments | $0.2\times - 2.0\times$ | $1.0\times$ | Adjusts active straight razor beam count across the stadium cathedral canopy. |
| **`spotlightCount`** | Spotlights | $1 - 8$ | $3$ | Number of active colour-tinted spotlights sweeping the stage (default: 3). |
| **`maxBrightnessLimit`** | Spotlights | $30\% - 100\%$ | $100\%$ | Global concert lumen ceiling preventing venue overexposure. |
| **`reducedFlash`** | Safety | Boolean | `false` | Photosensitive mode: tones down high-contrast blinder strobing. |
| **`disablePyrotechnics`** | Safety | Boolean | `false` | Master safety kill switch: deactivates all 8 stage flame cannons. |

---

## 5. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled cleanly in 468ms).
- **Vite Development Server:** Running continuously at `http://localhost:5173/` (`task-1627`).
- **Audio Intelligence Microservice:** Running continuously as a local daemon at `http://127.0.0.1:8765/` (`task-2086`), handling Demucs neural stem extraction on Apple Silicon MPS hardware + ShazamIO.
- **Bundled Tracks Pre-Cached:** `Ambyion & Abandoned - Waves.mp3`, `Feel Something.mp3`, and `Aaloshyo.mp3` are pre-separated and cached in `.synwave_cache/stems/` with full intensity timelines for instant playback.
- **Git Repository:** Committed locally on branch `main` (Rule 8: awaiting explicit user push instruction).
