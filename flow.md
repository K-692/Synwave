# Synwave: Procedural 3D Concert-Stage Simulator & Musical Choreography Engine

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js r186 + Web Audio API + Vite + PyTorch MPS Microservice)  
> **Hardware Acceleration:** Native Apple Silicon MPS (Metal Performance Shaders) / GPU Acceleration  
> **Architecture Principle:** 100% Procedural Generation & Neural Multi-STEM Source Separation Synchronization

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-adaptive **3D procedural concert-stage simulator** and desktop music visualizer. Rather than simply scaling visual effects with instantaneous frame loudness or wandering aimlessly with unanchored particles, Synwave acts as an **autonomous concert lighting designer and show director**. It establishes an authoritative beat grid, pre-processes the entire audio track using **Meta's Demucs v4 (Hybrid Transformer HTDemucs)** on Apple Silicon MPS hardware to extract 4 neural stems and acoustic intensity trajectories, detects transient onsets and section boundaries, and coordinates physical concert fixtures into synchronized, cinematic choreographies.

### Key Architectural Pillars:
1. **Full Track Pre-Processing & Acoustic Spectrum Analysis (Zero Real-Time Guesswork):**
   - The entire audio file is pre-processed up-front with Demucs v4 on Apple Silicon MPS hardware (`device="mps"`).
   - Extracts 4 neural stems: `drums`, `bass`, `instruments` (`other`), and `vocals`.
   - Pre-computes frame-accurate normalized RMS energy envelopes at 25 FPS (every 40ms), pinpointed transient kick events (`kickEvents` with exact time offsets and amplitudes), an `instrumentalActivity` trajectory, and a `globalIntensity` timeline across the entire track.
   - All pre-processed timelines are cached in `.synwave_cache/stems/{hash}.json` by SHA-256 hash for sub-millisecond retrieval on future sessions.
2. **Floating Top & Bottom Navigation Bars:**
   - Solid container backgrounds (`.synwave-header`, `.player-dock`) have been removed. All interactive pills and buttons float with translucent glassmorphic styling directly over the 3D concert stage and YouTube video aperture.
   - The "Festival Mainstage" badge has been removed from the header.
   - The **SYNWAVE** brand logo is permanently pinned at top-left without track name clutter.
   - The **Load Audio / Drop File** button is centered horizontally at the top with drag-and-drop support.
3. **Official YouTube API Metadata & Info ('i') Modal:**
   - Track metadata is derived directly from the official **YouTube Data API v3** search results rather than local file metadata.
   - Rich metadata extracted includes: Music Name, Artist / Channel, Producer, Release Date, Description, and Source Link.
   - A dedicated `'i'` info button is positioned beside the song name in the bottom floating dock, opening a metadata dialog.
4. **Minimalist Clean Seek Slider:**
   - Spectrum waveform amplitude bars have been eliminated from the seekbar per user preference, leaving a sleek, glowing neon progress rail and interactive playhead thumb.
5. **Stage Video Playback Gate & Ready-Pulse Play Button:**
   - Music playback is strictly gated while Demucs pre-processing and video synchronization occur.
   - Once loading completes, the bottom play button dynamically appears unlocked and pulses with an animated neon accent (`ready-pulse`), inviting the user to start the show.
6. **Steady Window & YouTube Screen-Only Kick Shake:**
   - 3D audience camera is locked firmly at $(X=0, Y=1.8, Z=9.2)$ with zero camera shake on bass. The window and 3D canvas remain completely steady.
   - High-energy drum kicks apply bounded pixel displacement strictly to the DOM YouTube iframe (`#synwave-youtube-stage-screen`) via `style.transform`.
7. **Sub-Bass Isolated Camera FOV Zoom Punch:**
   - Camera FOV zoom punch is driven strictly by isolated deep sub-bass frequencies (20-100Hz) above threshold, completely filtering out mid-range frequencies (guitars, vocals, synths, snares) to avoid visual interference.
8. **360° Downward Instrument Lasers (Opposite Color Palette):**
   - 3 laser stations mounted at the **top of the YouTube screen** ($X \in \{-5.5, 0.0, 5.5\}, Y \approx 11.2, Z = -4.0$) throwing beams downwards into the stage deck and audience.
   - Origin nozzles are minimalist pin-point diode dots (large white circle flares eliminated).
   - High frequency of instruments manipulates 360° conical rotational sweeps and spread.
   - Beams are gated to activate *strictly during high-intensity music parts* (drops, climaxes, high acoustic energy).
   - Beam colors are dynamically computed as the exact **opposite (complementary hue)** of the stage color palette (`(hue + 0.5) % 1.0`).
9. **Instrument-Driven Spotlights Scaling:**
   - Active perimeter spotlights around the YouTube screen scale dynamically from minimal (2 fixtures) on quiet/calm tracks up to MAX (12 fixtures) on high-intensity tracks with rapid frequency shifts.
10. **Removed Flame Cannons & Red Circular Arcs:**
    - `FireShootersEffect` and `ShockwaveRingEffect` removed across the entire engine and routing console.
11. **Apple Silicon MPS Hardware Detection:**
    - Fully detects macOS platform and Apple Silicon GPU with Metal Performance Shaders (MPS).
    - Python microservice operates with `torch.backends.mps.is_available()`, reporting hardware status via `/health`.
    - Live HUD telemetry explicitly verifies `HARDWARE ACCEL: APPLE SILICON MPS (METAL)`.
12. **Freeze-on-Pause Engine:**
    - When playback is paused or stopped (`isPlaying = false`), `deltaSeconds` is passed as 0 to all visual effects, and internal time accumulators halt. All moving heads, perimeter beams, and lasers instantly freeze in place.

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
     Extract 25 FPS RMS Envelopes                     │
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

---

## 3. Visual Rig Engineering & Spatial Physics

### 3.1 360° Downward Instrument Lasers (`ThinLasersEffect.ts`)
- **Mount Configuration:** Top screen truss stations at Left ($X=-5.5, Y=11.1, Z=-4.0$), Center ($X=0.0, Y=11.4, Z=-4.0$), and Right ($X=+5.5, Y=11.1, Z=-4.0$).
- **Nozzle Dot:** Micro-sphere geometry ($r = 0.04\text{m}$) replacing legacy white sphere flares.
- **Direction & Sweep:** Targeted downward towards stage floor and audience ($Y_{\text{target}} \in [-1.0, 2.5], Z_{\text{target}} \in [12.0, 24.0]$).
- **Kinematic Formulation:**
  $$\psi_{\text{beam}}(t) = \psi_{\text{sweep}}(t) + \delta_s + \frac{2\pi b}{N_{\text{beams}}}$$
  $$X_{\text{target}} = X_{\text{base}} + \sin(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 14.0$$
  $$Y_{\text{target}} = Y_{\text{base}} + \cos(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 7.0$$
- **High-Intensity Activation Gating:**
  $$\alpha_{\text{laser}} = \begin{cases} 1.0 & \text{if } I_{\text{global}} > 0.44 \text{ or } \text{isDrop} = \text{true} \\ 0.0 & \text{otherwise} \end{cases}$$
- **Color Complementarity:**
  $$\text{Hue}_{\text{laser}} = (\text{Hue}_{\text{palette}} + 0.5) \pmod{1.0}$$

### 3.2 360° Rotatable Perimeter Bass Rig (`StageLightsEffect.ts`)
- **Mount Configuration:** 12 fixtures framing the YouTube screen ($X = \pm 12.0$ on towers, $Y = 11.4$ on top truss, $Y = 0.8$ on stage deck).
- **Dynamic Active Fixture Scaling:**
  $$N_{\text{active}} = \text{clamp}\left(\text{round}\left(\text{lerp}(2, 12, A_{\text{inst}} \cdot 0.65 + \text{onsetStrength} \cdot 0.35)\right), 2, 12\right)$$
- **360° Circular Sweep Equations:**
  $$\psi(t) = \psi_0 + \int (1.4 + 5.5 \cdot \text{stems.bass}^{1.3}) \, dt$$

---

## 4. Audio-to-Visual Routing Console Specification

| Parameter | Section | Range | Default | Functional Description |
|---|---|---|---|---|
| **`screenShakeIntensity`** | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Bounded pixel displacement strictly applied to the YouTube stage screen on heavy kicks. |
| **`screenFlashIntensity`** | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Full-window blinder strobe flash intensity triggered by drum kick onsets. |
| **`kickSensitivity`** | Drums & Kicks | $0.2\times - 2.0\times$ | $1.0\times$ | Threshold scaling for drum kick detection. |
| **`perimeterBassRotationSpeed`**| Bass Spectrum | $0.2\times - 3.0\times$ | $1.0\times$ | Continuous 360° orbital rotation speed of perimeter screen lights driven by bass frequency. |
| **`bassToBeamIntensity`** | Bass Spectrum | $0.2\times - 2.5\times$ | $1.0\times$ | Modulates moving-head beam thickness, floor wash radiance, and perimeter radiance. |
| **`screenFlashColorSaturation`**| Bass Spectrum | $0.0\times - 2.0\times$ | $1.0\times$ | Blends video thumbnail gradient colors into screen flash on high bass hits (white at low bass). |
| **`effectDecay`** | Bass Spectrum | $0.5\times - 2.5\times$ | $1.0\times$ | Attack and release envelope decay speed for flashes and bass pulses. |
| **`instrumentalMovementSpeed`** | Lasers | $0.2\times - 3.0\times$ | $1.0\times$ | 360° conical rotation rate towards the stage floor driven by instrumental high frequency. |
| **`laserDensity`** | Lasers | $0.2\times - 2.0\times$ | $1.0\times$ | Active razor beam count from the 3 top laser stations. |
| **`spotlightCount`** | Spotlights | $1 - 8$ | $3$ | Base active colour-tinted spotlights sweeping the stage (scaled dynamically by instrumental intensity). |
| **`maxBrightnessLimit`** | Spotlights | $30\% - 100\%$ | $100\%$ | Global concert lumen ceiling preventing venue overexposure. |
| **`reducedFlash`** | Safety | Boolean | `false` | Photosensitive mode: tones down high-contrast blinder strobing. |

---

## 5. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled in 593ms).
- **Vite Development Server:** Running continuously at `http://localhost:5173/` (`task-1627`).
- **Audio Intelligence Microservice:** Running continuously as a local daemon at `http://127.0.0.1:8765/` (`task-2474`), handling Demucs neural stem extraction on Apple Silicon MPS hardware (`device: "mps"`).
- **Git Repository:** Committed and pushed cleanly to branch `main`.
