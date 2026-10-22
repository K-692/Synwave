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

  $$
  \psi_{\text{beam}}(t) = \psi_{\text{sweep}}(t) + \delta_s + \frac{2\pi b}{N_{\text{beams}}}
  $$

  $$
  X_{\text{target}} = X_{\text{base}} + \sin(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 14.0
  $$

  $$
  Y_{\text{target}} = Y_{\text{base}} + \cos(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 7.0
  $$
- **High-Intensity Activation Gating:**

  $$
  \alpha_{\text{laser}} = \begin{cases} 1.0 & \text{if } I_{\text{global}} > 0.44 \text{ or } \text{isDrop} = \text{true} \\ 0.0 & \text{otherwise} \end{cases}
  $$
- **Color Complementarity:**

  $$
  \text{Hue}_{\text{laser}} = (\text{Hue}_{\text{palette}} + 0.5) \pmod{1.0}
  $$

### 3.2 360° Rotatable Perimeter Bass Rig (`StageLightsEffect.ts`)

- **Mount Configuration:** 12 fixtures framing the YouTube screen ($X = \pm 12.0$ on towers, $Y = 11.4$ on top truss, $Y = 0.8$ on stage deck).
- **Dynamic Active Fixture Scaling:**
  $$
  N_{\text{active}} = \text{clamp}\left(\text{round}\left(\text{lerp}(2, 12, A_{\text{inst}} \cdot 0.65 + \text{onsetStrength} \cdot 0.35)\right), 2, 12\right)
  $$
- **360° Circular Sweep Equations:**
  $$
  \psi(t) = \psi_0 + \int (1.4 + 5.5 \cdot \text{stems.bass}^{1.3}) \, dt
  $$

---

## 4. Audio-to-Visual Routing Console Specification

| Parameter                                | Section       | Range                     | Default       | Functional Description                                                                                  |
| ---------------------------------------- | ------------- | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| **`screenShakeIntensity`**       | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Bounded pixel displacement strictly applied to the YouTube stage screen on heavy kicks.                 |
| **`screenFlashIntensity`**       | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Full-window blinder strobe flash intensity triggered by drum kick onsets.                               |
| **`kickSensitivity`**            | Drums & Kicks | $0.2\times - 2.0\times$ | $1.0\times$ | Threshold scaling for drum kick detection.                                                              |
| **`perimeterBassRotationSpeed`** | Bass Spectrum | $0.2\times - 3.0\times$ | $1.0\times$ | Continuous 360° orbital rotation speed of perimeter screen lights driven by bass frequency.            |
| **`bassToBeamIntensity`**        | Bass Spectrum | $0.2\times - 2.5\times$ | $1.0\times$ | Modulates moving-head beam thickness, floor wash radiance, and perimeter radiance.                      |
| **`screenFlashColorSaturation`** | Bass Spectrum | $0.0\times - 2.0\times$ | $1.0\times$ | Blends video thumbnail gradient colors into screen flash on high bass hits (white at low bass).         |
| **`effectDecay`**                | Bass Spectrum | $0.5\times - 2.5\times$ | $1.0\times$ | Attack and release envelope decay speed for flashes and bass pulses.                                    |
| **`instrumentalMovementSpeed`**  | Lasers        | $0.2\times - 3.0\times$ | $1.0\times$ | 360° conical rotation rate towards the stage floor driven by instrumental high frequency.              |
| **`laserDensity`**               | Lasers        | $0.2\times - 2.0\times$ | $1.0\times$ | Active razor beam count from the 3 top laser stations.                                                  |
| **`spotlightCount`**             | Spotlights    | $1 - 8$                 | $3$         | Base active colour-tinted spotlights sweeping the stage (scaled dynamically by instrumental intensity). |
| **`maxBrightnessLimit`**         | Spotlights    | $30\% - 100\%$          | $100\%$     | Global concert lumen ceiling preventing venue overexposure.                                             |
| **`reducedFlash`**               | Safety        | Boolean                   | `false`     | Photosensitive mode: tones down high-contrast blinder strobing.                                         |

13. **Phase 1 — YouTube Data API v3 Startup Gate & Credential Lifecycle:**
    - **Startup Verification Gate:** The main stage experience and audio processing cannot be entered without an active, verified YouTube Data API v3 key.
    - **Lightweight 1-Unit Validation:** API keys are validated using the 1-quota-unit `videoCategories.list?part=snippet&regionCode=US` endpoint (avoiding 100-quota-unit search calls, preserving 99.99% of free daily quota).
    - **Strict Error Diagnostics:** Differentiates between invalid keys (HTTP 400), quota exhaustion (HTTP 403 `quotaExceeded`), API not enabled (`accessNotConfigured`), domain/IP forbidden (`forbidden`), and network connectivity drops.
    - **Desktop Security:** Key stored with obfuscated prefix encoding (`enc:base64`) in local storage (`synwave_yt_api_key_v3`), eliminating raw plaintext storage. Plain API keys are masked in the UI (`AIzaSy••••••••••••Ww`) and excluded from runtime console logs.
    - **Zero-Restart Key Replacement:** Users can view, verify, and update their key at any time without restarting the app via the dedicated `Key` button in the top-right header toggles.

---

## 2. YouTube Data API v3 Startup Gate Specification (`youtubeService.ts` & `YouTubeApiKeyModal.tsx`)

```
App Launch ──► [Startup Gate Check]
                     │
         ┌───────────┴───────────┐
    (Key Missing)           (Key Found)
         │                       │
         ▼                       ▼
[Mandatory Gate Modal]   [Lightweight 1-Unit Probe]
(Blocks Stage App)     (videoCategories?regionCode=US)
         │                       │
         │             ┌─────────┴─────────┐
         │         (Valid HTTP 200)   (Error 400/403/Net)
         │             │                   │
         │             ▼                   ▼
         │       [Stage Ready]    [Mandatory Gate Modal]
         │       (Unlock Stage)   (Display Classified Error)
         │                                 │
         └─────────────► Enter Key ◄───────┘
                               │
                      [Lightweight Probe]
                               │
                       ┌───────┴───────┐
                    (Valid)        (Invalid)
                       │               │
                       ▼               ▼
                 Store Key &      Show Error Alert
                 Unlock Stage     & Retain Focus
```

### Diagnostic Error Matrix:
| Error Category | HTTP Code | API Reason / Condition | User Diagnostic Card |
|---|---|---|---|
| **`invalid_key`** | 400 | `API_KEY_INVALID` / Key expired | "The API key entered is not valid or has been deleted. Check Google Cloud Console." |
| **`quota_exhausted`** | 403 | `quotaExceeded` / `RESOURCE_EXHAUSTED` | "Your daily YouTube Data API quota is exhausted (10,000 units/day limit reached). Resets at midnight PST." |
| **`api_not_enabled`** | 403 | `accessNotConfigured` | "YouTube Data API v3 is not enabled in your Google Cloud project. Enable it under APIs & Services." |
| **`forbidden`** | 403 | `forbidden` / IP/Referrer restriction | "API key access forbidden. Check application, HTTP referrer, or IP restrictions." |
| **`network_error`** | Fetch fail | Timeout / DNS resolution failure | "Unable to reach Google Cloud servers. Check your internet connection or proxy." |

---

## 3. Demucs Offline Pre-Processing Architecture (`demucs_service.py` & `demucsService.ts`)

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

## 4. Visual Rig Engineering & Spatial Physics

### 4.1 360° Downward Instrument Lasers (`ThinLasersEffect.ts`)

- **Mount Configuration:** Top screen truss stations at Left ($X=-5.5, Y=11.1, Z=-4.0$), Center ($X=0.0, Y=11.4, Z=-4.0$), and Right ($X=+5.5, Y=11.1, Z=-4.0$).
- **Nozzle Dot:** Micro-sphere geometry ($r = 0.04\text{m}$) replacing legacy white sphere flares.
- **Direction & Sweep:** Targeted downward towards stage floor and audience ($Y_{\text{target}} \in [-1.0, 2.5], Z_{\text{target}} \in [12.0, 24.0]$).
- **Kinematic Formulation:**

  $$
  \psi_{\text{beam}}(t) = \psi_{\text{sweep}}(t) + \delta_s + \frac{2\pi b}{N_{\text{beams}}}
  $$

  $$
  X_{\text{target}} = X_{\text{base}} + \sin(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 14.0
  $$

  $$
  Y_{\text{target}} = Y_{\text{base}} + \cos(\psi_{\text{beam}}) \cdot S_{\text{cone}} \cdot 7.0
  $$
- **High-Intensity Activation Gating:**

  $$
  \alpha_{\text{laser}} = \begin{cases} 1.0 & \text{if } I_{\text{global}} > 0.44 \text{ or } \text{isDrop} = \text{true} \\ 0.0 & \text{otherwise} \end{cases}
  $$
- **Color Complementarity:**

  $$
  \text{Hue}_{\text{laser}} = (\text{Hue}_{\text{palette}} + 0.5) \pmod{1.0}
  $$

### 4.2 360° Rotatable Perimeter Bass Rig (`StageLightsEffect.ts`)

- **Mount Configuration:** 12 fixtures framing the YouTube screen ($X = \pm 12.0$ on towers, $Y = 11.4$ on top truss, $Y = 0.8$ on stage deck).
- **Dynamic Active Fixture Scaling:**
  $$
  N_{\text{active}} = \text{clamp}\left(\text{round}\left(\text{lerp}(2, 12, A_{\text{inst}} \cdot 0.65 + \text{onsetStrength} \cdot 0.35)\right), 2, 12\right)
  $$
- **360° Circular Sweep Equations:**
  $$
  \psi(t) = \psi_0 + \int (1.4 + 5.5 \cdot \text{stems.bass}^{1.3}) \, dt
  $$

---

## 5. Audio-to-Visual Routing Console Specification

| Parameter                                | Section       | Range                     | Default       | Functional Description                                                                                  |
| ---------------------------------------- | ------------- | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| **`screenShakeIntensity`**       | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Bounded pixel displacement strictly applied to the YouTube stage screen on heavy kicks.                 |
| **`screenFlashIntensity`**       | Drums & Kicks | $0.0\times - 2.5\times$ | $1.0\times$ | Full-window blinder strobe flash intensity triggered by drum kick onsets.                               |
| **`kickSensitivity`**            | Drums & Kicks | $0.2\times - 2.0\times$ | $1.0\times$ | Threshold scaling for drum kick detection.                                                              |
| **`perimeterBassRotationSpeed`** | Bass Spectrum | $0.2\times - 3.0\times$ | $1.0\times$ | Continuous 360° orbital rotation speed of perimeter screen lights driven by bass frequency.            |
| **`bassToBeamIntensity`**        | Bass Spectrum | $0.2\times - 2.5\times$ | $1.0\times$ | Modulates moving-head beam thickness, floor wash radiance, and perimeter radiance.                      |
| **`screenFlashColorSaturation`** | Bass Spectrum | $0.0\times - 2.0\times$ | $1.0\times$ | Blends video thumbnail gradient colors into screen flash on high bass hits (white at low bass).         |
| **`effectDecay`**                | Bass Spectrum | $0.5\times - 2.5\times$ | $1.0\times$ | Attack and release envelope decay speed for flashes and bass pulses.                                    |
| **`instrumentalMovementSpeed`**  | Lasers        | $0.2\times - 3.0\times$ | $1.0\times$ | 360° conical rotation rate towards the stage floor driven by instrumental high frequency.              |
| **`laserDensity`**               | Lasers        | $0.2\times - 2.0\times$ | $1.0\times$ | Active razor beam count from the 3 top laser stations.                                                  |
| **`spotlightCount`**             | Spotlights    | $1 - 8$                 | $3$         | Base active colour-tinted spotlights sweeping the stage (scaled dynamically by instrumental intensity). |
| **`maxBrightnessLimit`**         | Spotlights    | $30\% - 100\%$          | $100\%$     | Global concert lumen ceiling preventing venue overexposure.                                             |
| **`reducedFlash`**               | Safety        | Boolean                   | `false`     | Photosensitive mode: tones down high-contrast blinder strobing.                                         |

---

14. **Phase 2 — Repository Credits, Contributor Architecture & Dependency Attribution:**
    - **Contributor-Friendly README:** High-fidelity documentation featuring architecture diagrams, features overview, controls table, troubleshooting, known bugs roadmap, and an open-source contributor invitation.
    - **Verified Dependency Matrix:** Full auditing and attribution of all active production libraries (React 19, Three.js r186, Meta Demucs v4, PyTorch MPS, ShazamIO, FastAPI, Uvicorn, Lucide, TypeScript, Vite) with author attributions, official repository links, and verified SPDX licenses.
    - **Automated Python Environment Specification (`requirements.txt`):** Reproducible virtual environment dependencies pinned for Apple Silicon MPS and CUDA/CPU.
    - **Sanitized Environment Template (`.env.example`):** Clear template for YouTube Data API credentials without exposing private keys.
    - **Open Source Guidelines (`CONTRIBUTING.md`):** Complete workflow for issue triage, branch conventions, WebGL resource hygiene, and pull request submissions.

15. **Phase 3 — Verified ShazamIO BPM Integration & Demucs Multi-Interval Comb Filter Fallback Engine:**
    - **Authoritative Tempo Hierarchy:** Completely eliminates legacy crude BPM estimation. Replaces it with a two-tier verified system with explicit provenance tagging:
      1. **Primary Source — ShazamIO Verified BPM (`source = 'shazamio'`):** The audio stream is matched via ShazamIO. The actual response payload (`track.attributes.bpm`, `track.sections[].metadata`, or top-level keys) is inspected for an explicit numeric BPM within $[50, 240]$. If found, it is accepted with $1.0$ confidence. If absent (standard for many Shazam catalog entries), the engine gracefully falls back without assuming or fabricating a value.
      2. **Secondary Fallback — Demucs Multi-Interval Comb Filter (`source = 'demucs'`):** If ShazamIO does not return a usable BPM, the engine reuses the exact kick-event timestamps already extracted by Meta's HTDemucs neural separation pipeline:
         - **Kick Interval Spectrum:** Gathers kick onsets $\{t_i\}_{i=1}^N$ in chronological order. Computes pairwise intervals $\Delta t_{ij} = t_j - t_i$ across consecutive and multi-kick skip spans $1 \le (j - i) \le 4$ within the plausible musical interval window $[0.22\text{s}, 3.2\text{s}]$, weighted by $w_{ij} = 1 / (j - i)$.
         - **Gaussian Comb Filtering:** Evaluates candidate tempos $B \in [65.0, 190.0]\text{ BPM}$ in $0.5\text{ BPM}$ increments with a Gaussian proximity kernel ($\sigma = 38\text{ms}$):
           $$
           S(B) = \sum_{(i,j)} w_{ij} \exp\left(-\frac{(\Delta t_{ij} - k \cdot T_B)^2}{2\sigma^2}\right), \quad k = \left\lfloor \frac{\Delta t_{ij}}{T_B} + 0.5 \right\rfloor, \; 1 \le k \le 4
           $$
         - **Rhythmic Ambiguity Disambiguation:** Resolves syncopation, half-time, and double-time ambiguities (e.g. melodic dubstep kicks landing on beats 1 and 2-and/3 producing $75\text{ BPM}$ fundamental intervals are tested against $2B = 150\text{ BPM}$; if the harmonic retention score $S(2B) \ge 0.70 \cdot S(B)$, the double-time tempo is selected).
         - **Global Phase Grid Alignment:** Tests 100 phase shifts $\phi \in [0, T_B)$ across all kicks to measure the fraction of onsets aligning within $\pm 60\text{ms}$ of the grid:
           $$
           f_{\text{align}} = \frac{1}{N} \max_{\phi} \sum_{n=1}^N \mathbf{1}_{\{|\Delta_{\text{grid}}(t_n, \phi, T_B)| < 0.060\text{s}\}}
           $$
         - **Confidence Scoring:** Combines grid alignment and spectral peak-to-average contrast:
           $$
           C = \min\left(1.0, 0.60 \cdot f_{\text{align}} + 0.40 \cdot \min\left(1.0, \frac{S(B^*)}{\bar{S} + \epsilon} \cdot \frac{1}{3.5}\right)\right)
           $$
         - **Reliability Acceptance:** Accepted as `source = 'demucs'` only if $C \ge 0.35$ and at least 6 kicks align to the grid.
      3. **Explicit Unavailable State (`source = 'unavailable'`):** If neither ShazamIO nor Demucs yields a reliable BPM (e.g. ambient tracks with $< 8$ kicks or low confidence), the visualizer receives an explicit `null` BPM and `unavailable` source. No tempo is ever guessed or assumed.
    - **Dual-Layer Per-Track Caching:**
      - **Client-Side:** Caches recognized metadata, BPM value, source, and confidence in `localStorage` under `synwave_track_bpm_cache_v1_{trackId}`.
      - **Microservice-Side:** Stores calculated `demucsBpm` directly in `.synwave_cache/stems/{hash}.json` along with stem envelopes.
      - Avoids duplicate Shazam network requests and redundant comb filter calculations.
    - **Spotlight Rig Adaptive Behavior (`StageLightsEffect.ts`):**
      - The spotlight controller reads `features.bpmSource` and `features.bpmConfidence`.
      - When verified (`shazamio` or `demucs`), periodic beat pulses and rotational pan/tilt sweeps lock tightly to the true tempo.
      - When `unavailable`, the beat pulse drops smoothly to zero; moving heads disengage rigid beat snapping and fluidly sweep the stage driven by live RMS and instrument stem activity without artificial pulsing.
    - **HUD Telemetry Provenance Display (`DiagnosticOverlay.tsx`):**
      - Displays live `RESOLVED BPM`, color-coded `BPM PROVENANCE` (`SHAZAMIO [VERIFIED]` in green, `DEMUCS [KICKS]` in cyan, or `UNAVAILABLE` in amber), and `TEMPO CONFIDENCE` percentage.

16. **Phase 4 — BPM-Driven Symmetrical Spotlight Spawning Engine:**
    - **Monotonic Clamped Linear Interpolation:**
      - Maps resolved track BPM across the calibrated interval $[70.0, 160.0]\text{ BPM}$ to a configurable count range $[\text{minCount}, \text{maxCount}]$ (default $[1, 7]$, expandable to $8$):
        $$
        t = \text{clamp}\left(\frac{\text{BPM} - 70.0}{160.0 - 70.0}, 0.0, 1.0\right)
        $$
        $$
        N_{\text{spotlights}} = \text{clamp}\left(\text{round}(\text{minCount} + t \cdot (\text{maxCount} - \text{minCount})), \text{minCount}, \text{maxCount}\right)
        $$
      - Empirical monotonic evaluation across reference tempos:
        - $\le 70\text{ BPM} \to 1$ fixture
        - $85\text{ BPM} \to 2$ fixtures
        - $100\text{ BPM} \to 3$ fixtures
        - $115\text{ BPM} \to 4$ fixtures
        - $130\text{ BPM} \to 5$ fixtures
        - $145\text{ BPM} \to 6$ fixtures
        - $\ge 160\text{ BPM} \to 7$ fixtures
    - **Bilateral Symmetrical Layout Around YouTube Player (Top, Left, Right):**
      - The aperture of the YouTube player is centered at $(0.0, 4.6, -4.5)$ with dimensions $21.0\text{m} \times 11.8\text{m}$.
      - Spotlights are placed along the structural framing (Top Overhead Truss at $Y = 12.2, Z = -4.0$; Left Tower at $X = -12.4, Z = -4.0$; Right Tower at $X = +12.4, Z = -4.0$):
        - **$N = 1$:** Top Center ($X = 0, Y = 12.2$).
        - **$N = 2$:** Left ($X = -12.4, Y = 5.5$), Right ($X = +12.4, Y = 5.5$).
        - **$N = 3$:** Top Center ($0, 12.2$), Left ($-12.4, 5.5$), Right ($+12.4, 5.5$).
        - **$N = 4$:** Top Pair ($-4.8, 12.2$ and $+4.8, 12.2$), Left ($-12.4, 5.5$), Right ($+12.4, 5.5$).
        - **$N = 5$:** Top Trio ($0, 12.2$ and $\pm 5.8, 12.2$), Left ($-12.4, 5.5$), Right ($+12.4, 5.5$).
        - **$N = 6$:** Top Pair ($\pm 4.8, 12.2$), Left Pair ($-12.4$, $Y \in \{4.0, 8.0\}$), Right Pair ($+12.4$, $Y \in \{4.0, 8.0\}$).
        - **$N = 7$:** Top Trio ($0$ and $\pm 5.8, 12.2$), Left Pair ($-12.4$, $Y \in \{4.0, 8.0\}$), Right Pair ($+12.4$, $Y \in \{4.0, 8.0\}$).
        - **$N = 8$:** Top Quad ($\pm 2.8$ and $\pm 7.5, 12.2$), Left Pair ($-12.4$, $Y \in \{4.0, 8.0\}$), Right Pair ($+12.4$, $Y \in \{4.0, 8.0\}$).
      - Every active layout configuration exhibits 100% bilateral mirror symmetry across the $Y$-$Z$ plane.
    - **Smooth Track Transitions Without Visual Jumps:**
      - **Continuous Activation Envelope:** Each moving head maintains a continuous activation factor $a_i(t) \in [0.0, 1.0]$. Newly activated fixtures fade up over $\sim 0.3\text{s}$ ($\frac{da_i}{dt} = 3.5$), while deactivated fixtures fade out smoothly to zero ($\frac{da_i}{dt} = -3.0$).
      - **Mount Position Gliding:** When slot positions shift between counts, the fixture chassis and lens groups smoothly glide to their new slot coordinates via `group.position.lerp(targetSlotPos, deltaSeconds * 4.5)`.
      - **Mirrored Side Sweeps:** Left and Right tower fixtures cross their volumetric cones inward symmetrically across the stage floor, while Top fixtures sweep downward into the audience.
    - **Configurable Console & HUD Telemetry:**
      - `RoutingConsole.tsx` provides dedicated sliders for active count, minimum count ($1-4$ at $\le 70\text{ BPM}$), and maximum count ($4-8$ at $\ge 160\text{ BPM}$).
      - Telemetry overlay HUD shows real-time `ACTIVE SPOTLIGHTS` count and BPM-mapped scaling status.

17. **Phase 5 — Continuous SYNWAVE Logo Visibility and Menu Decoupling:**
    - **Architectural Separation of Brand Identity from Menu Auto-Hide:**
      - Decoupled the top-left `.header-brand.floating-pill` from the auto-hide translation logic of `.synwave-header`.
      - Previously, the entire top header container translated off-screen via `translateY(-100%)` when `isTopBarVisible` transitioned to false, unmounting/hiding the brand logo alongside the functional navigation pills.
      - Refactored `.synwave-header` to act as a permanently positioned, transparent spatial flex container (`pointer-events: none; background: transparent; border: none; top: 14px; left: 20px; right: 20px;`) with zero translation or container opacity toggling.
    - **Subtle Ambient Watermark State (`dimmed`):**
      - When upper menus auto-hide after inactivity (cursor motionless for $>1.8\text{s}$ or exiting the top viewport threshold), the SYNWAVE logo transitions smoothly to a subdued ambient watermark state:
        ```css
        .header-brand.floating-pill.dimmed {
          opacity: 0.45;
        }
        ```
      - This maintains continuous brand presence against the 3D procedural concert stage without distracting from the visualizer or YouTube performance.
    - **Instant Restoration & Interactive Hover Response:**
      - When menus reappear (cursor entering the top viewport zone $Y \le 65\text{px}$ or drawers opening), the logo restores to full opacity:
        ```css
        .header-brand.floating-pill.full-opacity,
        .header-brand.floating-pill:hover {
          opacity: 1.0 !important;
        }
        ```
      - Direct user interaction is fully preserved via `pointer-events: auto !important; cursor: pointer;`. Hovering over or clicking the dimmed logo immediately illuminates it to 100% opacity with smooth neon glow transitions.
    - **Position Stability & Zero Visual Shifting:**
      - The logo remains completely stationary at its fixed coordinates `(20px, 14px)` with zero DOM unmounting, re-rendering shifts, or spatial jitter.
      - Opacity transition utilizes hardware-accelerated timing (`transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.25s ease`).
      - Upper menu controls (Center Load Audio File pill and Top Right Console Toggles) retain smooth upward translate animations (`translateY(-120%)`) and fade to `opacity: 0` during auto-hide.

18. **Phase 6 — Complementary Chromatic Laser Engine & Outline Elimination:**
    - **180° HSL Complementary Palette Rotation:**
      - Extracts the active track palette colors (derived either from the YouTube video thumbnail or the real-time mood engine).
      - Converts primary and secondary palette RGB colors to HSL and executes exact $180^\circ$ hue rotations:
        $$
        h_{\text{comp, primary}} = (h_{\text{primary}} + 0.5) \pmod{1.0}
        $$
        $$
        h_{\text{comp, secondary}} = (h_{\text{secondary}} + 0.5) \pmod{1.0}
        $$
      - If $h_{\text{comp, secondary}}$ is chromatically too close to primary ($|\Delta h| < 0.10$), an automated harmonic offset $(h_{\text{comp, primary}} + 0.14) \pmod{1.0}$ is applied to create the rich, dual-tone alternating laser beams seen in high-end festival stage productions (e.g. alternating neon cyan and electric magenta).
    - **Complete Elimination of White Borders, Cores, and Stroke Lines:**
      - Removed the desaturated white core material (`color: 0xffffff`, $s=0.35, l=0.95$) that previously produced a chalky white center stroke across the entire beam width.
      - Increased cylinder radial tessellation from 8 facets to 24 smooth radial segments (`CylinderGeometry(..., 24, 1, true)`), completely eliminating faceted polygonal silhouette creases and geometric border strokes.
      - Eliminated unshaded line primitives and open-cylinder edge artifacts.
    - **Tri-Layer Volumetric Optical Architecture:**
      - **1. Neon Core Filament ($r \in [0.005, 0.012]\text{m}$):**
        - Color: `new THREE.Color().setHSL(beamHue, 1.0, 0.60)`.
        - 100% saturation and 0.60 luminance deliver an intensely glowing neon filament that preserves 100% of its pure complementary pigment without burning out to white.
        - Opacity: $0.80 - 1.0$, `THREE.AdditiveBlending`.
      - **2. Volumetric Glow Sheath ($r \in [0.018, 0.040]\text{m}$):**
        - Color: `new THREE.Color().setHSL(beamHue, 1.0, 0.50)`.
        - Provides a dense, chromatic beam envelope.
        - Opacity: $0.32 - 0.62$, `THREE.AdditiveBlending`.
      - **3. Atmospheric Halo Dispersion ($r \in [0.040, 0.085]\text{m}$):**
        - Color: `new THREE.Color().setHSL(beamHue, 1.0, 0.45)`.
        - Delivers soft Gaussian-like feathering into dark stage space, ensuring beams have clean, radiant borders without harsh silhouette boundaries.
        - Opacity: $0.12 - 0.30$, `THREE.AdditiveBlending`.
    - **Diode Emitter Nozzle Synchronization:**
      - Origin diode dot nozzle meshes (`dotGeo`, $r = 0.04\text{m}$) are dynamically mapped to `compPrimaryHue` ($s=1.0, l=0.60$), ensuring coherent optical emission from the top frame of the YouTube player without large white circle artifacts.

19. **Phase 7 — Audio-Aware Laser Activation & Directionally Synchronized Kick/Bass Movement:**
    - **Offline Track-Wide Average Amplitude Reference ($A_{\text{avg}}$):**
      - During initial pre-processing (via Web Audio offline decoding in `AudioAnalyzer.ts` and neural stem extraction in `demucs_service.py`), the entire audio signal is analyzed from beginning to end before playback commences:
        $$
        A_{\text{avg}} = \frac{1}{N} \sum_{i=0}^{N-1} \text{RMS}[i]
        $$
      - **Critical Guarantee:** $A_{\text{avg}}$ is a deterministic, static scalar reference for the track. It is NEVER replaced with a moving average during playback, preserving the true definition of "above the average amplitude level of the entire music."
      - Segment detection groups contiguous frames exceeding $A_{\text{avg}}$ with a $0.4\text{s}$ hysteresis window into `aboveAverageSections: Array<{ startTime: number; endTime: number }>`.
    - **Frequency-Band Kick vs. Bass Discrimination:**
      - Percussive kick transients ($40 - 100\text{ Hz}$) are cleanly decoupled from sustained harmonic bassline ($50 - 250\text{ Hz}$) using Demucs drum stem first-order difference ($\Delta \text{drums}$) and a $160\text{ms}$ refractory lockout, preventing sustained sub-bass rumbles from triggering false kicks.
      - Low-frequency spectral distribution is continuously evaluated:
        $$
        \text{Distribution}_{\text{low}} = \frac{E_{\text{sub-bass}}}{E_{\text{sub-bass}} + E_{\text{mid-bass}}}
        $$
    - **Audio-Aware Activation Gate with Smooth Fading:**
      - Lasers activate **strictly** within eligible segments where current playback amplitude exceeds the track-wide reference ($A(t) \ge A_{\text{avg}}$).
      - Smooth exponential fading eliminates abrupt visual cuts:
        - Fade-in rate: $\sim 0.35\text{s}$ ($\frac{da}{dt} = 3.5$)
        - Fade-out rate: $\sim 0.60\text{s}$ ($\frac{da}{dt} = 1.8$)
      - When outside eligible sections, all laser meshes smoothly fade to zero opacity and sleep with zero draw overhead.
    - **Coherent Directional Swarm Synchronization:**
      - Replaced independent station pinwheel rotations with a unified master rig direction vector $(\Phi_{\text{master}}, \Theta_{\text{master}})$.
      - All 3 top stations and their 24 beams maintain coherent directional lockstep across the arena, while varying beam spacing (fan divergence) and speed proportionally to bass energy and kick impulses.
    - **Four Kick/Bass-Driven Choreography Patterns:**
      - **Pattern 0 (`CONCERT_HORIZON_SWEEP`):** Synchronized horizontal pendulum sweeping across stage and crowd; bass opens beam divergence.
      - **Pattern 1 (`CATHEDRAL_SCISSOR_CANOPY`):** Symmetrical intersecting diagonal laser canopy modulating downward depth.
      - **Pattern 2 (`STADIUM_PULSE_FAN`):** Symmetrical downward stadium fan breathing with sustained bass and snapping open on drum kicks.
      - **Pattern 3 (`AUDIENCE_SCAN_WAVE`):** Synchronized undulating crowd wave scanning along the audience plane, modulated by low-frequency spectral distribution.
    - **Musical Pattern Switching Trigger:**
      - Enforces a minimum $3.5\text{s}$ dwell time to preserve musical phrase stability (prohibits random per-frame shifts).
      - Shifts to a new pattern only when a meaningful kick/bass event occurs:
        1. A heavy kick hit on a musical bar downbeat or phrase boundary (`isKick && (isBar || isPhrase)`).
        2. A significant low-frequency spectral distribution shift ($|\Delta \text{Distribution}_{\text{low}}| > 0.30$).
        3. Maximum pattern timeout ($> 12\text{s}$) arriving on a kick.
    - **Robust Clock Handling:**
      - **Pauses:** When `deltaSeconds \le 0`, laser motion freezes in place with full visual stability.
      - **Seeking:** User timeline scrubbing immediately queries the pre-computed section map at the new timestamp without transient spikes.
      - **Track Changes:** Resets pattern timers and loads the new track-wide reference cleanly.

20. **Phase 9 — Pre-Playback Menu Visibility & Dual Media Readiness Gate:**
    - **Dual Media Readiness Synchronization:**
      - **Audio Source Readiness (`isAudioReady`):** In `AudioEngine.ts`, media readiness is signaled via `canplay` and `loadeddata` events (`audioElement.readyState >= 2`), as well as immediately during `loadTrack` if data is cached. The track is marked ready once neural stem extraction is also complete (`!isSeparatingStems`).
      - **Stage Video Readiness (`isVideoReady`):** In `YouTubeStagePlayer.tsx`, video readiness is signaled via the iframe `onReady` event. If the video fails to load, is removed, or embedding is disallowed by the author, an `onError` event automatically signals readiness so the user is never stuck behind an unplayable gate. When a track has no YouTube video, it immediately signals ready (`!isVideoLoading && isVideoReady`).
      - **Dual-Readiness Gate:** Both media streams must be ready before playback is unlocked:
        $$
        \text{isBothMediaReady} = \text{currentTrack} \land \text{isAudioReady} \land \text{isVideoReady} \land \neg\text{isVideoLoading} \land \neg\text{isSeparatingStems}
        $$
    - **Automatic Bottom Menu Reveal:**
      - As soon as $\text{isBothMediaReady}$ transitions to `true`, the bottom player dock automatically reveals itself (`setIsBottomBarVisible(true)`), smoothly sliding up to display the track title, artist, seekbar, and the glowing neon `ready-pulse` play button.
      - Any active auto-hide timers are cleared immediately.
    - **Persistent Visibility Before First Playback:**
      - Tracks whether the current track has actually begun playing via `hasPlaybackStarted` (and synchronous `hasPlaybackStartedRef`).
      - While $\neg\text{hasPlaybackStarted} \land \text{isBothMediaReady}$:
        - Auto-hide is completely disabled.
        - Moving the mouse across the 3D canvas or center screen does **not** hide the bottom bar.
        - Moving the cursor out of the browser window (`mouseleave`) preserves bottom bar visibility.
        - Hovering over the top bar displays the top header while keeping the bottom player dock visible and interactive.
    - **Playback Initiation & Autoplay Restriction Safeguard:**
      - The `onPlaybackStarted` callback in `AudioEngine` is tied directly to the HTML5 `playing` event (which only fires when audio actually begins producing sound output, not on speculative method calls).
      - If browser autoplay restrictions reject `audioElement.play()`, or if network buffering delays the audio stream, `hasPlaybackStarted` remains `false`, keeping the menu visible so the user can easily click the play button.
      - Pausing, seeking, or adjusting volume prior to initial playback does not trigger premature auto-hiding.
    - **Preservation of Standard Auto-Hide After Playback Begins:**
      - Once playback is confirmed active (`hasPlaybackStarted = true`), standard auto-hiding behavior seamlessly resumes:
        - Hovering over the bottom threshold ($Y \ge \text{innerHeight} - 75$) shows the dock.
        - Hovering over the top threshold shows the header and conceals the dock.
        - Cursor inactivity in the central stage area triggers a smooth 1.8s fade-out.
        - Hovering directly over the dock (`onMouseEnter`) locks visibility.
    - **Track Switching & Queue Resets:**
      - Whenever a new track is loaded (via local file ingestion or queue navigation), `hasPlaybackStarted` and media readiness flags are reset, guaranteeing that every track displays its controls upon loading until played.

### 5.8 Phase 10 — Fullscreen Scaling & Relative Spotlight Positioning Architecture
- **Problem Statement & Root Causes:**
  - Previous fullscreen scaling caused the YouTube stage player to become disproportionately enlarged (occupying up to $74.6\%$ of viewport height), leaving negligible headroom and side margins ($< 144\text{px}$), resulting in collision with header/dock fixtures and severe visual distortion.
  - 3D lighting fixtures, truss structures, and laser stations relied on hard-coded static 3D world coordinates (e.g. $Y = 12.2\text{m}$, $X = \pm 12.4\text{m}$), causing them to drift outside viewport bounds on non-16:9 displays (such as 16:10 MacBook screens or 21:9 ultrawide monitors) and during fullscreen transitions where Three.js `PerspectiveCamera` horizontal FOV expanded.
- **Unified Geometric Projection Architecture (`stageDimensions.ts`):**
  - Designed `calculateStageDimensions(viewportWidth, viewportHeight)` as the authoritative geometric engine bridging DOM CSS rules and 3D WebGL camera frustum coordinates:
    $$\text{maxWByVw} = W \times 0.68, \quad \text{maxWByVh} = H \times 0.62 \times \frac{16}{9}$$
    $$\text{domPlayerWidth} = \min(\text{maxWByVw}, \text{maxWByVh}), \quad \text{domPlayerHeight} = \frac{\text{domPlayerWidth}}{16/9}$$
    $$f_h = \frac{\text{domPlayerHeight}}{H}$$
  - In 3D space at screen plane $Z = -4.5\text{m}$ with camera at $(0, 1.8, 9.2)\text{m}$ ($\Delta Z = 13.7\text{m}$) and vertical $\text{FOV} = 60^\circ$:
    $$H_{\text{frustum}} = 2 \times 13.7 \times \tan(30^\circ) \approx 15.8194\text{m}, \quad W_{\text{frustum}} = H_{\text{frustum}} \times \text{aspect}$$
    $$S_h = f_h \times H_{\text{frustum}}, \quad S_w = S_h \times \frac{16}{9}$$
    $$S_y = 4.4 + (0.50 - 0.48) \times H_{\text{frustum}} \approx 4.716\text{m}$$
    $$Y_{\text{top}} = S_y + \frac{S_h}{2}, \quad X_{\text{left}} = -\frac{S_w}{2}, \quad X_{\text{right}} = \frac{S_w}{2}$$
  - Guarantees $\ge 17\% H$ top headroom, $\ge 21\% H$ bottom clearance, and $\ge 16\% W$ side margins across all standard and ultrawide resolutions.
- **Responsive Symmetrical Spotlight Spawning (`StageLightsEffect.ts`):**
  - Parameterized `getSymmetricalSpotlightLayout(count, dims)` relative to active player dimensions:
    - **Top Spotlights:** Mounted at $Y = Y_{\text{top}} + 1.25\text{m}$ ($\approx 10.88\text{m}$, safely below frustum ceiling $12.31\text{m}$); $X$ distributed symmetrically across $[-W_{\text{half}}, +W_{\text{half}}]$.
    - **Left Flanking Spotlights:** Mounted at $X = X_{\text{left}} - 1.55\text{m}$ ($\approx -10.27\text{m}$, over $3.7\text{m}$ inside the $14.06\text{m}$ viewport edge); vertical positions distributed symmetrically around $S_y$.
    - **Right Flanking Spotlights:** Mounted at $X = X_{\text{right}} + 1.55\text{m}$ with identical $Y$ coordinates, ensuring bilateral balance.
  - Implemented `resize(width, height)` to dynamically recalculate active spotlight target slots, 12 perimeter bass lights, and stage wash point lights instantly on window resize, fullscreen entry, and fullscreen exit.
- **Dynamic Concert Stage Structural Sizing (`StageStructureEffect.ts`):**
  - Updated 3D Jumbotron screen mesh, backing wall, four-sided black masking walls, industrial aluminum bezels, inner glowing LED trim, and aluminum box-truss roof rigs to scale and align proportionally to $(S_w, S_h, S_y)$ on resize, ensuring zero light leaks or clipping around the YouTube video player.
- **Top Downward Laser Nozzle Tracking (`ThinLasersEffect.ts`):**
  - Repositioned the 3 top laser stations dynamically relative to $Y_{\text{top}}$ and $W_{\text{half}}$: Station 0 at $(-0.63 \times W_{\text{half}}, Y_{\text{top}} + 0.25\text{m})$, Station 1 at $(0, Y_{\text{top}} + 0.55\text{m})$, Station 2 at $(+0.63 \times W_{\text{half}}, Y_{\text{top}} + 0.25\text{m})$, maintaining downward laser fan alignment across all viewports.
- **Multi-Event Resize Dispatching (`VisualEngine.ts`):**
  - Configured listeners for `resize`, `fullscreenchange`, `webkitfullscreenchange`, `mozfullscreenchange`, `MSFullscreenChange`, and `orientationchange` with immediate and multi-stage debounced execution ($0\text{ms}, 60\text{ms}, 180\text{ms}, 350\text{ms}, 600\text{ms}$) to guarantee smooth transitions during browser fullscreen animation easing curves.

### 5.9 Phase 11 — Dynamic Song-Palette-Complementary Laser Pipeline Architecture
- **Problem Statement & Root Causes:**
  - Previous implementations locked laser beams to fixed cyan (`#00f0ff`) or deep space indigo/violet (`#4361ee`/`#7209b7`) presets.
  - Four critical bottlenecks were uncovered during pipeline tracing:
    1. *Per-frame Palette Overwrite:* In `VisualEngine.evaluateMusicMoodPalette()`, `targetPalette` was unconditionally assigned to `COLOR_PALETTES[targetIndex]`, where preset indices 0 and 3 were hardcoded cyan and cobalt/violet, wiping out any extracted song or thumbnail palette within a single animation frame (16ms).
    2. *Initialization Hardcoding:* In `ThinLasersEffect.initialize()`, `dotMat`, `coreMat`, `sheathMat`, and `haloMat` materials were instantiated with literal `0x00f0ff` colors.
    3. *Early-Return Caching in Update Loop:* In `ThinLasersEffect.update()`, early returns for paused playback (`deltaSeconds <= 0`) and faded-out beams (`currentBeamOpacity < 0.005`) returned before color derivation logic executed, causing lasers to retain stale colors across track changes or thumbnail extraction while paused.
    4. *Incomplete Palette Forwarding:* `App.tsx` only forwarded `spotlightColors` to `setCustomSpotlightColors()`, dropping the dominant `primary`, `secondary`, and `accent` swatches.
- **Dynamic Color Derivation Architecture (`ThinLasersEffect.ts`):**
  - **180° Color Wheel Rotation:**
    $$h_{\text{comp}} = (h_{\text{prim}} + 0.50) \pmod{1.0}, \quad h_{\text{comp2}} = (h_{\text{sec}} + 0.50) \pmod{1.0}$$
  - **Achromatic Safeguard:** If saturation $s < 0.15$ (near-black, white, or greyscale), a deliberate warm amber fallback ($h = 0.08$) is substituted, yielding high-energy electric azure/cyan complementary beams ($h = 0.58$) rather than collapsing to achromatic greys.
  - **Harmonic Separation:** Guaranteed minimal chromatic divergence $|h_{\text{comp}} - h_{\text{comp2}}| \ge 0.15$ to generate dual-tone festival laser fans across alternating rays.
  - **Tri-Layer Volumetric Pigmentation:**
    - *Luminous Core:* `HSL(h, 1.0, 0.65)` — razor-sharp, high-lightness neon core with punchy contrast against the dark concert background.
    - *Volumetric Sheath:* `HSL(h, 1.0, 0.50)` — pure spectral saturation forming a rich, glowing beam envelope.
    - *Atmospheric Halo:* `HSL(h, 0.95, 0.42)` — soft Gaussian-like feathering that eliminates hard silhouette outlines and unwanted stroke borders.
    - *Diode Emitter Dot:* `HSL(h, 1.0, 0.60)` — vivid pin-point nozzle diode.
- **Song Palette Persistence & Procedural Track Signature Fallback (`VisualEngine.ts`):**
  - **Song Palette Persistence:** Stored `customSongPalette: ColorPalette | null` in `VisualEngine`. When active, `evaluateMusicMoodPalette()` preserves the song's palette and smoothly interpolates stage key/fill lights without overwriting the palette from presets.
  - **Procedural Track Signature Fallback:** When tracks lack video thumbnails (e.g. local audio files), a deterministic signature palette is procedurally derived from the track's seed using the golden ratio hue distribution:
    $$\text{baseHue} = (|\text{seed} \times 0.618033988749895|) \pmod{1.0}$$
    Distributes colors evenly across the entire 360° color wheel, ensuring every audio file receives a distinctive, vivid visual identity instead of being locked into static blue or violet.
  - **Immediate Multi-State Dispatching:**
    - `ThinLasersEffect.updatePaletteColors()` is invoked unconditionally at the start of `update()`, before pause or opacity gates.
    - `setSongPalette()`, `setCustomSpotlightColors()`, and `setTrackProfile()` immediately update laser material colors on the GPU, guaranteeing instant visual updates during pauses and track transitions.

### 5.10 Phase 12 — Song-Palette Flash-Screen with Compulsory White Blinder Architecture
- **Problem Statement & Root Causes:**
  - Previous flash-screen implementations suffered from static color distribution: when bass was below threshold, flashes defaulted to an invariant white radial gradient; when bass was above threshold, flashes combined all palette colors into an identical composite blob (`rgba(255,255,255,0.9) 10%, prim 40%, sec 75%, acc 100%`).
  - Individual song palette colors (`primary`, `secondary`, `accent`, `laserColor`) were never distributed across kick sequences.
  - No sequence tracking existed to guarantee musical rhythm alignment (e.g. phrase downbeat strobe vs intermediate beat pulses).
  - Idle frames repeatedly dispatched zero-opacity callbacks to React state at 60 FPS.
- **Musical Flash Sequence Architecture (`VisualEngine.ts`):**
  - **Kick Onset Transient Edge Detection:**
    $$\text{isNewKick} = \text{features.isKick} \land \neg \text{wasKickLastFrame}$$
    Guarantees that a single multi-frame kick transient only triggers a single flash and advances the sequence step once.
  - **Phrase Boundary & Silence Auto-Reset:**
    $$\Delta t = t_{\text{track}} - t_{\text{lastKick}}$$
    If $\Delta t > 0.65\text{s}$ (musical pause, breakdown, or silence) or $\text{features.isBar}$ (measure downbeat), the flash sequence resets to $\text{step} = 0$, guaranteeing that every new burst, drop, or phrase begins with the compulsory white blinder.
  - **4-Step Rhythmic Sequence Distribution:**
    - **Step 0 — Compulsory Pure White (`#FFFFFF`) Blinder:**
      $$\text{radial-gradient}(\text{circle at center}, \text{rgba}(255,255,255,1.0) \ 0\%, \text{rgba}(255,255,255,0.92) \ 35\%, \text{rgba}(255,255,255,0.65) \ 65\%, \text{rgba}(255,255,255,0.15) \ 100\%)$$
      Provides brilliant, high-energy stadium blinder illumination at the start of every sequence.
    - **Step 1 — Song Primary Color (`palette.primary`):**
      Features a white-hot filament center ($0\% - 16\%$), radiating into the saturated song primary hue ($50\% - 100\%$).
    - **Step 2 — Song Secondary Color (`palette.secondary`):**
      White-hot center radiating into the saturated song secondary hue.
    - **Step 3 — Song Accent / Laser Color (`palette.accent` or `palette.laserColor`):**
      White-hot center radiating into the song accent / complementary laser hue.
  - **Screen Blend Mode Physics (`index.css`):**
    - The overlay uses `mix-blend-mode: screen`. Pure white highlights deliver maximum intensity without washing out the concert geometry, while colored outer halos tint the entire stage atmosphere with the song's active palette.
  - **Snappy Decay & Configurable Duration:**
    $$\text{decayRate} = 14.0 \times \text{routingConfig.effectDecay}$$
    Flash decays to 0 within $\approx 50-80\text{ms}$, preventing lingering brightness.
### 5.11 Phase 13 — Shazam-First Recognition & Correctly Named Stage STEM Extraction Pipeline
- **Problem Statement & Workflow Bottleneck:**
  - Previous track-loading implementations triggered Demucs neural stem extraction FIRST (`/api/separate-stems`), which consumed ~40-55 seconds of MPS neural compute.
  - ShazamIO recognition (`/api/recognize`) was executed only AFTER Demucs had finished, leaving the extraction loader displaying generic messages (`"Separating neural stems with Demucs HTDemucs..."`) or stale metadata from a previous track.
  - No stable fingerprint cache existed for Shazam recognition results, forcing redundant network calls and risking cross-track metadata contamination.
  - Recognition calls lacked strict timeouts, creating potential indefinite loading hangs on network disruptions or slow cloud queries.
  - Rapid track switching lacked race condition guards, allowing late-arriving recognition or Demucs responses to overwrite the metadata of a newer track.
- **5-Step Sequential Pipeline Architecture (`src/App.tsx`, `shazamService.ts`):**
  1. **Step 1: Load Selected Audio Track & Safe Fallback State**
     - Track initialization sets initial safe metadata (`initialTitle`, `initialArtist = 'Local Audio'`) derived from clean filename parsing without inventing artificial titles.
     - Unique pipeline token: `pipelineTrackId = track.id; activePipelineTrackIdRef.current = pipelineTrackId;`
     - Transport pauses, media gates reset (`isAudioReady = false`, `isVideoReady = false`, `isVideoLoading = true`), bottom bar hides.
     - Demucs loader modal mounts in `'recognizing'` phase with status `'Recognizing track with ShazamIO...'`.
  2. **Step 2: Run ShazamIO Recognition as a Strict Prerequisite**
     - Stable audio fingerprint generated via `getTrackFingerprint`:
       - `file:${name}:${size}:${lastModified}` for files.
       - `path:${normalized_path}` for file paths.
     - Checks in-memory and persistent `localStorage` cache (`synwave_shazam_cache_v2`). Cache hits resolve in <1ms without network calls.
     - For uncached tracks, sends request to `http://127.0.0.1:8765/api/recognize` protected by an `AbortController` timeout (default 9000ms).
     - Network errors, timeouts, or unidentified tracks produce a structured handled failure (`{ success: false, error: ... }`) rather than throwing an unhandled rejection, guaranteeing processing never hangs indefinitely.
  3. **Step 3: Resolve Title & Artist Metadata**
     - Race condition token validation: `if (activePipelineTrackIdRef.current !== pipelineTrackId) return;`
     - Successful recognition sets `resolvedTitle = match.title`, `resolvedArtist = match.artist`, `track.recognitionStatus = 'recognized' | 'cached'`.
     - Handled failure cleanly preserves the local filename fallback: `resolvedTitle = initialTitle`, `resolvedArtist = initialArtist`, `track.recognitionStatus = 'unrecognized' | 'failed'`.
     - Immediately updates React state (`setCurrentTrack`, `setTracks`), loader header, and visual engine track info.
  4. **Step 4: Extract Stage STEMs Using Demucs with Recognized Metadata**
     - Loader transitions to `'extracting'` phase.
     - Extraction header and status explicitly display the recognized song name:
       - Header: `EXTRACTING STAGE STEMS — ${resolvedTitle.toUpperCase()}...`
       - Status row: `Extracting Stage STEMs — ${resolvedTitle} (HTDemucs...)`
     - Eliminates raw filenames and prevents stale metadata from previous tracks.
     - On completion, stems stored in `track.demucsStems` and loader dismissed (`setIsSeparatingStems(false)`).
     - Cache directory creation bug fixed in `demucs_service.py` (`CACHE_DIR.mkdir(parents=True, exist_ok=True)`).
  5. **Step 5: Complete Analysis & Unlock Playback**
     - Verified BPM resolution via `resolveTrackBpm(track.id, match, track.demucsStems)` (ShazamIO verified priority -> Demucs kick intervals -> unavailable).
     - Spotlight count updated to match resolved BPM.
     - Official YouTube video queried using `${resolvedTitle} ${resolvedArtist}`.
     - Audio engine loads track; playback automatically unlocks once both media sources are ready (`isBothMediaReady` becomes true, revealing the bottom transport bar).
- **StemSeparationLoader Enhancements (`src/components/StemSeparationLoader.tsx`):**
  - Added support for `phase: 'recognizing' | 'extracting'`, `songTitle`, and `songArtist`.
  - During recognition: displays pulsed radio icon with badge `SHAZAMIO • ACOUSTIC FINGERPRINT RECOGNITION` and header `IDENTIFYING TRACK WITH SHAZAMIO...`.
  - During Demucs extraction: displays badge `DEMUCS v4 • NEURAL STEM SEPARATION`, header `EXTRACTING STAGE STEMS — ${songTitle.toUpperCase()}...`, and dynamic progress status `Extracting Stage STEMs — ${songTitle} (...)`.

### 5.12 Phase 14 — 22-Pattern Concert Laser Choreography Engine & Mid-Range Spectral Feature Selection
- **Problem Statement & Limitations of Prior Logic:**
  - Prior implementation was restricted to 4 basic hardcoded movement patterns (*Parallel Spread, Dual-Station Fan, Center Crossed Canopy, Alternating Zig-Zag*), leading to repetitive, predictable visual motion during prolonged high-energy track segments.
  - Choreography selection and switching were coupled to bass frequencies (`features.bass`, `lowFreqDistribution`), causing laser movements to redundantly shadow sub-bass pulses rather than reflecting harmonic structure, vocal phrasing, or lead synthesizer progression.
  - Absence of professional festival concert choreographies: lacked audience plane scan waves, vertical sky rakes, counter-rotating multi-station fans, double-helix spirals, cathedral scissor canopies, staircase chases, tunnel perspectives, etc.
  - Abrupt snap transitions between pattern orientations created visual harshness and polygonal jerks.
- **Architectural & Mathematical Innovations:**
  1. **Strict Anti-Bass Policy & Mid-Range Spectral Feature Extraction (`src/audio/AudioEngine.ts`):**
     - Bass is completely excluded as a pattern-selection driver.
     - Real-time mid-range spectral analysis implemented over a tuned $250\text{ Hz} - 4\text{ kHz}$ frequency band (FFT bins $k = 12$ to $k = 186$ at $44.1\text{ kHz}$, $\Delta f \approx 21.53\text{ Hz}$):
       - **Mid-Range Energy ($E_{\text{mid}}$):** Normalized RMS energy within $[250\text{ Hz}, 4\text{ kHz}]$.
       - **Mid-Range Spectral Centroid ($C_{\text{mid}}$):** Center of spectral mass in mid-band:
         $$C_{\text{mid}} = \frac{\sum_{k=12}^{186} k \cdot |X[k]|}{\sum_{k=12}^{186} |X[k]|}$$
         Normalized to $[0.0, 1.0]$, measuring harmonic brightness and vocal presence.
       - **Mid-Range Spectral Flux ($F_{\text{mid}}$):** Half-wave rectified frame-to-frame mid-band spectral difference, quantifying note attacks, arpeggios, and chord changes:
         $$F_{\text{mid}} = \sum_{k=12}^{186} \max(0, |X_t[k]| - |X_{t-1}[k]|)$$
       - **Mid-Range Energy Distribution ($D_{\text{mid}}$):** Ratio of upper-mid energy ($1\text{ kHz} - 4\text{ kHz}$) to lower-mid energy ($250\text{ Hz} - 1\text{ kHz}$), capturing timbre brightness shifts:
         $$D_{\text{mid}} = \frac{\sum_{k=46}^{186} |X[k]|}{\sum_{k=12}^{186} |X[k]| + \epsilon}$$
     - **Demucs Instrumental STEM Fusion:** In active Demucs playback, $E_{\text{mid}}$ integrates the ground-truth instrumental stem (`stems.instruments`):
       $$E_{\text{mid, fused}} = 0.65 \times \text{stems.instruments} + 0.35 \times E_{\text{mid, smoothed}}$$
  2. **Demucs Drum Stem Kick Event Anchoring & Musical Boundary Switching (`src/visualizer/effects/ThinLasersEffect.ts`):**
     - Reuses precise Demucs drum stem kick events (`features.isKick`, `kickIntensity`).
     - **Minimum Dwell Time ($3.5\text{s}$):** Enforces a baseline dwell time of $3.5\text{ seconds}$ to preserve musical phrasing and prevent chaotic rapid-fire pattern switches.
     - **Musical Trigger Condition:**
       A pattern transition is triggered when:
       $$(\text{patternTimer} \ge 3.5\text{s}) \land \Big(\big((\Delta C_{\text{mid}} > 0.20 \lor \Delta D_{\text{mid}} > 0.22 \lor \Delta F_{\text{mid}} > 0.25 \lor F_{\text{mid}} > 0.35) \land \text{isKick}\big) \lor (\text{isKick} \land (\text{isBar} \lor \text{isPhrase} \lor \text{kickIntensity} > 0.60)) \lor (\text{patternTimer} > 12.0\text{s} \land \text{isKick})\Big)$$
  3. **Complete 22-Choreography Library (`src/visualizer/effects/laserChoreography.ts`):**
     Each pattern implements an independent mathematical trajectory function $\mathcal{T}_i(\text{params}) \to (\text{azimuth}, \text{elevation})$:
     | No. | Pattern Name | Movement Behavior | Mathematical Trajectory Formula |
     | :--- | :--- | :--- | :--- |
     | 1 | **Concert Horizon Sweep** | Coordinated horizontal sweep across stage | $\alpha = \sin(\theta)\cdot 1.10 + c \cdot (0.32 + 0.30 E_{\text{mid}} + 0.18 I_{\text{kick}}) + 0.22(s-1)$<br>$\beta = -0.34 + 0.08\cos(0.5\theta)$ |
     | 2 | **Cathedral Scissor** | Diagonal beams intersect into scissor canopy | $\alpha = 0.40\sin(0.8\theta) + \text{tilt}_s(0.85 + 0.35 E_{\text{mid}}) + c\cdot 0.45\cos(1.2\theta)$<br>$\beta = -0.38 + 0.12\sin(1.4\theta)$ |
     | 3 | **Stadium Fan** | Beams open and close in broad fan | $\alpha = 0.25\sin(0.4\theta) + c\cdot(0.45 + 0.50 E_{\text{mid}} + 0.35 I_{\text{kick}}) + 0.30(s-1)$<br>$\beta = -0.32 - 0.16\sin(\pi u) + 0.08 I_{\text{kick}}$ |
     | 4 | **Audience Scan Wave** | Progressive sweep travels across audience plane | $\alpha = 0.35(s-1) + c\cdot 0.28 + 0.55\sin(\theta - c\cdot 2.5)$<br>$\beta = -0.22 - 0.22\sin(1.2\theta - u\cdot\pi)$ |
     | 5 | **Crossed X Canopy** | Mirrored beams form and release an X | $\alpha = (c < 0 ? -0.42 : 0.42)\cdot\cos(0.9\theta) + c\cdot 0.18 + 0.25(s-1)$<br>$\beta = -0.40 + 0.14\sin(1.1\theta)$ |
     | 6 | **Center-Out Burst** | Beams expand from central station | $\alpha = c\cdot(0.20 + 0.85|\sin(1.3\theta)|) + (s-1)\cdot 0.45$<br>$\beta = -0.35 + 0.15\cos(1.3\theta)$ |
     | 7 | **Edge-In Convergence** | Beams converge from outer stations | $\alpha = (1.0 - |\cos(\theta)|)\cdot c\cdot 0.40 + (s-1)\cdot 0.60\cos(\theta)$<br>$\beta = -0.36 + 0.10\sin(2\theta)$ |
     | 8 | **Pendulum Arc** | Smooth oscillations around central pivot | $\phi = \sin(0.75\theta)\cdot 0.95 + (s-1)\cdot 0.25$<br>$\alpha = \phi + c\cdot 0.35,\ \beta = -0.42 + 0.15\cos(\phi)$ |
     | 9 | **Vertical Sky Rake** | Beams sweep through distinct vertical angles | $\alpha = (s-1)\cdot 0.38 + c\cdot 0.45 + 0.20\sin(0.5\theta)$<br>$\beta = -0.15 - 0.35|\sin(\theta + u\cdot 1.8)|$ |
     | 10 | **Counter-Rotating Fans** | Station groups rotate in opposite directions | $\text{dir} = (s === 0 ? 1 : s === 2 ? -1 : (b \% 2 === 0 ? 1 : -1))$<br>$\alpha = (s-1)\cdot 0.35 + \sin(\theta\cdot \text{dir} + u\cdot\pi)\cdot 0.55$<br>$\beta = -0.35 + \cos(\theta\cdot \text{dir} + u\cdot\pi)\cdot 0.15$ |
     | 11 | **Zigzag Ladder** | Alternating diagonal positions | $\text{step} = (b \% 2 === 0 ? 1 : -1)$<br>$\alpha = \text{step}\cdot(0.35 + 0.35\sin(\theta)) + (s-1)\cdot 0.30$<br>$\beta = -0.22 - u\cdot 0.26$ |
     | 12 | **Left-Right Chase** | Sequential chase across stage sides | $\text{delay} = s\cdot 0.65 + u\cdot 0.45$<br>$\alpha = \sin(1.4\theta - \text{delay})\cdot 0.90$<br>$\beta = -0.35 + 0.08\cos(1.4\theta - \text{delay})$ |
     | 13 | **Three-Station Call-and-Response** | Left, center, and right respond in sequence | $\text{active} = \lfloor(\theta\cdot 0.65)\rfloor \pmod 3$<br>$\alpha = (s-1)\cdot 0.35 + c\cdot(s === \text{active} ? 0.85 : 0.22)$<br>$\beta = (s === \text{active} ? -0.28 + 0.12\sin(2\theta) : -0.42)$ |
     | 14 | **Rotating Pinwheel** | Beam directions orbit around central axis | $\phi = \theta\cdot 1.25 + (s-1)\cdot 0.85 + u\cdot 2\pi$<br>$\alpha = (s-1)\cdot 0.32 + 0.48\cos(\phi)$<br>$\beta = -0.34 + 0.18\sin(\phi)$ |
     | 15 | **Double-Helix Spiral** | Interwoven spiral paths | $\phi = 1.5\theta + 0.8(s-1) + 2.2u + (b\%2 === 0 ? 0 : \pi)$<br>$\alpha = 0.55\sin(\phi) + 0.30(s-1)$<br>$\beta = -0.35 + 0.14\cos(\phi)$ |
     | 16 | **Tunnel Perspective** | Depth-oriented converging lines | $r = 0.18 + 0.58u,\ \phi = 2\pi u + 0.65\theta$<br>$\alpha = 0.35(s-1) + r\cos(\phi),\ \beta = -0.36 + 0.35 r\sin(\phi)$ |
     | 17 | **Split and Rejoin** | Formation separates symmetrically & reconverges | $\text{sep} = 0.95|\sin(0.8\theta)|,\ \text{sign} = c < 0 ? -1 : 1$<br>$\alpha = \text{sign}\cdot\text{sep} + 0.25c + 0.20(s-1)(1 - \text{sep})$<br>$\beta = -0.34 - 0.12(1 - |\sin(0.8\theta)|)$ |
     | 18 | **Staircase Chase** | Stepped angular progression | $k = (b + \lfloor 2.8\theta\rfloor) \pmod N,\ u_k = k / (N-1)$<br>$\alpha = (u_k - 0.5)\cdot 1.15 + 0.32(s-1)$<br>$\beta = -0.20 - 0.28 u_k$ |
     | 19 | **Sweeping Light Curtain** | Coordinated curtain sweeps across stage | $\alpha = 0.85c + 0.42(s-1)$<br>$\beta = -0.35 + 0.22\sin(1.1\theta) + 0.06\sin(\pi c)$ |
     | 20 | **Grid and Diagonal Scan** | Distinct crossing directions | Center sweeps horizontally ($\alpha = 0.82\sin(0.95\theta) + 0.45c$), Left tilts upward ($\Delta\beta = 0.18\sin(0.95\theta)$), Right tilts downward ($\Delta\beta = -0.18\sin(0.95\theta)$) |
     | 21 | **Mirrored V Sweep** | Symmetrical V expands and contracts | $\text{aperture} = 0.32 + 0.48\sin(0.85\theta),\ \text{sign} = u < 0.5 ? -1 : 1$<br>$\alpha = \text{sign}\cdot|u - 0.5|\cdot\text{aperture} + 0.32(s-1)$<br>$\beta = -0.45 + 0.30|u - 0.5|$ |
     | 22 | **Fan Pulse Chase** | Timed pulse sequences open fan sections | $\phi = (2.4\theta + 1.4s + 2.0u) \pmod{2\pi}$<br>$\text{spread} = 0.24 + (\sin\phi > 0 ? 0.65\sin\phi : 0)$<br>$\alpha = 0.40(s-1) + c\cdot\text{spread},\ \beta = -0.32 - 0.15\sin\phi$ |
  4. **Continuous Hermite Cubic Smoothstep Blending:**
     - Transitions between radical patterns (e.g. *Cathedral Scissor* to *Rotating Pinwheel*) interpolate trajectories over $\tau_{\text{blend}} = 0.50\text{s}$ using cubic smoothstep:
       $$S(t) = 3t^2 - 2t^3, \quad t \in [0, 1]$$
       $$\alpha(t) = (1 - S(t))\cdot \alpha_{\text{prev}} + S(t)\cdot \alpha_{\text{active}}$$
       $$\beta(t) = (1 - S(t))\cdot \beta_{\text{prev}} + S(t)\cdot \beta_{\text{active}}$$
     - Guarantees $C^1$ velocity continuity and eliminates discontinuous jumping.
  5. **Controlled Track-Seeded Variety (`selectNextLaserPattern`):**
      - Pseudo-random hashing based on track seed, mid-range energy, and spectral centroid guarantees deterministic variety across different tracks and phrases while strictly barring consecutive repetitions ($P_{\text{next}} \ne P_{\text{current}}$).
  6. **Foundation Preservation:**
      - Pre-calculated static full-track average amplitude gate ($A_{\text{avg}}$) preserved.
      - Smooth fade in ($0.35\text{s}$) / fade out ($0.60\text{s}$) preserved.
      - Pause-freeze behavior (freezes in place without resetting or disappearing) preserved.
      - Phase 11 dynamic complementary color palette derivation preserved.

### 5.13 Multi-Tiered Persistent Stem Caching Architecture for Instantaneous Song Reloading
- **Problem Statement & Workflow Bottlenecks:**
  - Neural stem extraction via Demucs HTDemucs is computationally intensive, requiring $40\text{s} - 75\text{s}$ of MPS neural inference per audio file.
  - Previous background daemon implementations encountered filesystem path resolution issues (`[Errno 2] No such file or directory: '.synwave_cache/stems/...'`) due to relative working directory resolution, which prevented stem envelope JSON files from persisting to disk.
  - The frontend client lacked persistent client-side storage (neither in-memory caching nor IndexedDB), forcing the browser to re-upload full audio files ($10\text{MB} - 50\text{MB}$) and re-run complete neural separation whenever a song was loaded, switched, or reloaded after browser restart.
- **3-Tiered Caching Hierarchy & Multi-Key Indexing:**
  1. **Tier 1: Client In-Memory Cache ($0\text{ms}$ Latency):**
     - Module-level `Map<string, DemucsStemData>` holding decoded stem envelopes within active browser sessions.
     - Lookups and hits resolve synchronously with zero serialization overhead.
  2. **Tier 2: Browser IndexedDB Persistence ($<5\text{ms}$ Latency):**
     - Structured storage using native browser `IDBDatabase` (`synwave_stems_db`, object store `stems_v1`).
     - Stores complete stem datasets (`drums`, `bass`, `instruments`, `vocals`, `kickEvents`, `kickOnsets`, `instrumentalActivity`, `globalIntensity`, `demucsBpm`, `averageAmplitude`, `aboveAverageSections`).
     - Survives browser reloads, cache clears, and restarts without memory footprint limits (bypassing localStorage 5MB quota).
  3. **Tier 3: Local Python Server Cache & Ultra-Fast Verification ($<15\text{ms}$ Latency):**
     - Absolute filesystem cache directory: `BASE_DIR / ".synwave_cache" / "stems"`.
     - Explicit directory creation guarantees: `cache_file.parent.mkdir(parents=True, exist_ok=True)`.
     - Dedicated lightweight pre-flight endpoint `POST /api/check-stems-cache` takes `{ fileHash, fingerprint, songTitle, songArtist }` and returns pre-computed envelopes directly, avoiding unnecessary multi-megabyte audio file transfers over the network.
- **Unique Song Identification & Multi-Key Aliasing:**
  - Stems are indexed and cross-referenced under:
    - **Acoustic / File Fingerprint:** `file:${name}:${size}:${lastModified}` or `path:${normalized_path}`.
    - **SHA256 File Content Hash:** Full byte digest computed on the server.
    - **Recognized Song Identity Key:** `song:${hashlib.sha256(f"{title}:::{artist}".lower().encode()).hexdigest()}`.
  - Cross-key aliasing guarantees that whether a track is queried by its exact file path, acoustic fingerprint, or recognized metadata from Shazam, pre-computed stems are resolved instantly.
- **Observed Performance Impact:**
  - First-time track load: runs Demucs separation once ($40\text{s} - 55\text{s}$ on Apple Silicon MPS) and persists to Tier 1, Tier 2, and Tier 3.
  - Subsequent loads / playlist switches / browser refreshes: resolves from local cache in **$<10\text{ms}$** with status `Extracting Stage STEMs — Song Title (Loaded from local cache)`, completely eliminating redundant neural compute.

### 5.14 Phase 15 — Clean Video Aperture, Text Overlay Removal, and Robust Caption Management
- **Video Aperture Inspection & Overlay Elimination:**
  - Audited `YouTubeStagePlayer.tsx` and all DOM layers positioned over the concert stage video screen container (`#synwave-youtube-stage-screen`).
  - Identified `.yt-stage-pill` (which previously rendered video title, status badges like `MUTED • SYNCED`, and video icons at `bottom: 10px; right: 12px;` with `z-index: 6` over the iframe).
  - Completely purged `.yt-stage-pill` and all text elements, badges, titles, and metadata overlays from the video aperture. The `#synwave-youtube-stage-screen` container now renders purely the clean `#synwave-yt-iframe-player` iframe target without any covering visual elements or text overlays.
- **Relocation of Metadata to Floating Interface Regions Outside Video Aperture:**
  - In accordance with Phase 15 specifications, song and video information was relocated to interface regions outside the video aperture:
    - **Floating Transport Player Dock (`PlayerControls.tsx`):** Integrated `.track-video-indicator` inside the floating `dock-left` pill, displaying the synchronized YouTube video title and icon alongside track artist and title outside the video frame.
    - **YouTube Music Metadata Modal (`showInfoModal`):** Added a dedicated `STAGE VIDEO MATCH` field with cyan neon styling (`highlight-cyan`) to the floating metadata modal accessible via the info (`'i'`) button.
  - **Stage STEM Extraction Status:** Maintained in the central modal dialog (`StemSeparationLoader.tsx`) positioned outside the video aperture in the global backdrop layer (`z-index: 100`), preserving the correct track name display required by Phase 13 (`EXTRACTING STAGE STEMS — ${songTitle.toUpperCase()}`).
- **Strongest Supported YouTube Player Caption Configuration:**
  - Configured `playerVars`:
    - `cc_load_policy: 0`: Google's embed documentation specifies that `cc_load_policy=1` forces closed captions on by default even if user turned captions off. Setting `cc_load_policy: 0` ensures the embed default does not force captions on.
    - Omitted caption-language settings (`cc_lang_pref`, `hl`) that might enable caption tracks.
    - `controls: 0`: Operates without native YouTube player controls, removing the visible CC button and native player control chrome.
    - `disablekb: 1`: Disables keyboard shortcuts so viewer keystrokes (such as pressing 'c') do not toggle native player captions.
    - `iv_load_policy: 3`: Suppresses video annotations.
    - Application code strictly never invokes caption activation methods.
  - **Documented Captions API Inspection:**
    - In `onReady`, where exposed by the YouTube IFrame API instance, safely invokes `unloadModule('captions')` and clears active caption tracks via `setOption('captions', 'track', {})` wrapped in try-catch.
    - Strictly avoids unsupported commands or direct DOM manipulation of YouTube's cross-origin iframe (which would be blocked by Same-Origin Policy and create fragile workarounds).
### 5.15 Dual-Layer Audio-Visual Impact: Sub-Bass Stage Layer FOV Punch & Kick YouTube Screen Shake
- **Sub-Bass 3D Stage Layer Punch (`VisualEngine.ts`):**
  - Isolates deep sub-bass energy ($20-100\text{Hz}$) to eliminate harmonic contamination from mid-range frequencies and general percussion:
    $$E_{\text{sub}} = \text{features.subBass}$$
    $$\text{gate}_{\text{sub}} = \frac{\max(0, E_{\text{sub}} - 0.28)}{0.72}$$
    $$\text{punch}_{\text{sub}} = (\text{gate}_{\text{sub}})^{1.8} \cdot 3.5$$
  - When drop or high sub-bass transients hit, the 3D camera FOV dynamically punches from $60^\circ$ up to $63.5^\circ$:
    $$\text{targetFov} = \begin{cases} 60 & \text{if reducedFlash or not playing} \\ 63.5 & \text{if isDrop} \\ 60 + \text{punch}_{\text{sub}} & \text{otherwise} \end{cases}$$
    $$\text{FOV}(t) \leftarrow \text{FOV}(t) + (\text{targetFov} - \text{FOV}(t)) \cdot (\Delta t \cdot 14.0)$$
  - This FOV modulation physically zooms and compresses the entire Three.js stage layer (trusses, screen bezels, deck, stage crowd, and spotlights) in perfect sync with low-frequency sub-bass hits.
- **Audio-Synchronized YouTube IFrame Kick Shake (`VisualEngine.ts` & `App.tsx`):**
  - Percussive drum kicks drive a distinct 2D screen shake strictly isolated to the YouTube stage video iframe element (`#synwave-youtube-stage-screen`):
    $$\text{kickPower} = \max(\text{stems.kick}, \text{isKick} ? \text{kickIntensity} : 0)$$
    $$\text{shakePx} = (\text{kickPower})^{1.4} \cdot 16.0 \cdot \text{screenShakeIntensity} \quad (\text{for } \text{kickPower} > 0.22)$$
    $$\Delta x = (\text{rand}() - 0.5) \cdot 2 \cdot \text{shakePx}, \quad \Delta y = (\text{rand}() - 0.5) \cdot 2 \cdot \text{shakePx}$$
  - Dispatched via `visualEngine.onStageShake(kickShakeX, kickShakeY)`:
    `el.style.transform = "translate(calc(-50% + " + shakeXPixels.toFixed(2) + "px), calc(-50% + " + shakeYPixels.toFixed(2) + "px))"`
  - Smoothly resets to `translate(-50%, -50%)` when kicks decay, leaving the outer browser window and transport chrome completely stable.
- **Concert Spotlight Tracking Rig Hygiene (`StageLightsEffect.ts`):**
  - Moving-head colouring spotlights and 360° perimeter lights operate without artificial per-fixture spring jitter or micro-angular noise, ensuring crisp, professional concert stage sweeps and bilateral symmetry around the screen.

### 5.16 Phase 17 — Conditional Laser Colours, Full-Screen Light Paths & Reliable Playback Controls

- **Authoritative Laser Palette Pipeline (`laserColorUtils.ts`, `VisualEngine.ts`, `ThinLasersEffect.ts`):**
  - **Single Source of Truth:** Established `resolveLaserPaletteColors()` as the sole mathematical decision-maker for laser color assignment, eliminating ad-hoc color mutations and divergent logic across rendering layers.
  - **Normalization & Perceptual Deduplication:**
    - Incoming swatches are normalized and parsed into HSL and linear RGB color spaces.
    - Achromatic and near-white swatches are filtered out of the chromatic count ($L \ge 0.88$, $L \ge 0.78 \land S \le 0.12$, $L \le 0.08$, $S \le 0.12$).
    - Visually near-identical colors are deduplicated using a perceptual color distance metric ($\Delta E < 0.14$ or hue distance $< 0.08$ with $\Delta L < 0.15$), rather than simple string equality.
    - Original palette order is preserved for predictable swatch prioritization.
  - **Conditional Laser Color Selection:**
    - **Case A (Exactly one distinct non-white color):**
      The original chromatic palette color is applied directly to all laser components. Hue rotation is strictly disabled, preventing single-color palettes from turning into blue/violet or an arbitrary complementary hue. Depth is created purely via lightness, saturation, and luminous opacity modulation ($L_{\text{core}} = \min(0.85, L + 0.15), S_{\text{core}} = \min(1.0, S + 0.15)$; $L_{\text{sheath}} = L$; $L_{\text{halo}} = \max(0.20, L - 0.10)$; $L_{\text{emitter}} = \min(0.90, L + 0.20)$). All 4 layers (core, glow sheath, halo, and emitter diode) remain 100% hue-consistent.
    - **Case B (Multiple distinct non-white colors):**
      Derives complementary hues using 180° HSL rotation: $h_{\text{comp}} = (h + 0.5) \bmod 1.0$. Tone 1 derives from the primary chromatic swatch, and Tone 2 derives from the secondary chromatic swatch, maintaining vibrant dual-color festival fans.
    - **Case C (Entirely white or achromatic palette):**
      Achromatic palettes explicitly bypass complementary hue derivation from white/grey. Instead, a documented deterministic fallback derived from the track's seed ($h_1 = (\text{seed} \cdot 0.618033988749895 + 0.10) \bmod 1.0$, $h_2 = (h_1 + 0.33) \bmod 1.0$) supplies stable chromatic hues, preventing frame-to-frame flicker and silently hardcoded blue/violet defaults.
  - **Immediate Palette Propagation:**
    - Active laser palette updates synchronously as soon as a new track or palette is selected (`updatePaletteColors(this.activePalette, this.trackSeed)`), without waiting for audio playback, Demucs extraction, or thumbnail callbacks.
    - Caches are invalidated immediately upon track load, ensuring prior track colors never linger.

- **Full-Screen Laser Light-Path Movement & Downward Stage Projection (`laserChoreography.ts`, `ThinLasersEffect.ts`):**
  - **Root-Cause Analysis:**
    - Previously, laser trajectories targeted a distant audience plane ($Z \approx +16.0$), causing camera perspective projection ($Z_{\text{cam}} = 9.2$) to compress the beams upward into the top 20% of the screen.
  - **Full-Screen 3D Target Vector Architecture:**
    - All 22 concert choreographies were re-engineered to emit explicit 3D world target coordinates:
      $$X_{\text{target}} \in [-16.0, 16.0], \quad Y_{\text{target}} \in [-3.5, 11.5], \quad Z_{\text{target}} \in [-3.8, 1.0]$$
    - Target points at $Y \approx -3.5$ project downward across the stage deck and through the bottom boundary of the visualizer viewport.
    - Target depth $Z \approx -3.6$ places the beams directly in front of the YouTube screen plane ($Z = -4.5$).
    - Length is calculated dynamically via Euclidean 3D distance ($L = \|\mathbf{P}_{\text{target}} - \mathbf{P}_{\text{origin}}\|$), and cylinder orientation is derived via look-at rotation matrices.
  - **Downward Projection Over YouTube Iframe:**
    - Three.js transparent WebGL canvas operates at `z-index: 2` directly overlaying the YouTube screen container (`#synwave-youtube-stage-screen`, `z-index: 1`).
    - Downward-projecting laser beams slice directly across the YouTube video aperture with additive volumetric blending (`THREE.AdditiveBlending`), with zero border lines or rectangular clipping frames.
    - Pointer interaction on the YouTube iframe is maintained (`pointer-events: auto` on iframe container, `pointer-events: none` on 3D canvas), allowing normal video playback control while lasers render seamlessly above it.
    - All laser mesh components have `frustumCulled = false`, eliminating premature viewport clipping during responsive window resizing or fullscreen transitions.

- **Reliable Application-Level Space-Bar Playback Controls (`App.tsx`, `AudioEngine.ts`):**
  - **Root-Cause Analysis:**
    - The previous keydown listener included `currentTime` in its `useEffect` dependency array, tearing down and re-registering the listener 30–60 times per second and causing dropped keystrokes during rapid transitions.
    - Furthermore, when a user clicked a UI button (e.g. Play/Pause in `PlayerControls.tsx`), the button retained DOM focus. When Space was pressed, the browser fired the keydown shortcut (toggling play/pause) AND subsequently fired native button activation (toggling it back immediately), cancelling out the action.
  - **Permanent Global Handler & Capture Phase:**
    - Mutable references (`isPlayingRef`, `currentTimeRef`, `durationRef`, `apiGateStatusRef`, `isKeyModalOpenRef`, `handlePlayPauseRef`) are synchronized on render inside a non-blocking `useEffect`.
    - Global keydown listener is registered once on `window` with `{ capture: true }`, eliminating listener churn and stale closure bugs.
    - Protects user input: Key events are ignored when focus is inside `<input>`, `<textarea>`, `<select>`, or `contenteditable` elements.
    - Prevents duplicate toggles: If `target.closest('button, [role="button"]')` has focus, the global handler yields to the button's native keyboard activation without invoking a secondary toggle.
    - Browser scrolling prevention: `e.preventDefault()` prevents window scrolling when Space is pressed.
    - Audio engine state verification: `handlePlayPause` checks both React state and actual HTMLAudioElement state (`audioEngine.isPlaying()`), preventing state desynchronization.
    - Cross-Origin Iframe Focus Reclaiming: Pointer and mouse movement listeners (`pointerdown`, `mousemove`) on `window` automatically detect if focus was transferred to a cross-origin iframe (`document.activeElement.tagName === 'IFRAME'`) and restore focus back to `window`, ensuring the Space bar remains responsive immediately after hovering back over the Synwave stage.

### 5.17 Phase 18 — Fix Screen Flash & Synchronize with Active Song Colour Palette

- **Root-Cause Analysis of Flash Invisibility:**
  - **React Scheduler Batching vs. High-Frequency Decay:**
    Previously, `onWindowFlash` invoked React's `setWindowFlashOpacity(opacity)`. In `VisualEngine.ts`, `decayRate = 14.0` caused peak opacity to decay back to 0 in only 1–2 animation frames (~16–30ms). React 18/19's asynchronous state scheduler batched these rapid state transitions, causing the component commit to skip non-zero values entirely or paint only after the opacity had returned to 0.
  - **CSS Transition Conflict:**
    In CSS, `.festival-window-blinder` had `transition: opacity 0.05s ease-out;`. The 50ms browser easing curve fought against the frame-by-frame decay calculated in JavaScript, flattening transient spikes before they could register visually.
  - **Demucs Kick State Locking:**
    In `AudioEngine.ts`, `if (sampled.isKickOnset || sampled.kick > 0.45)` held `isKick = true` continuously during loud sections where drum energy exceeded 0.45. This prevented the onset condition `features.isKick && !this.wasKickLastFrame` from ever dropping back to false, locking out flash triggers for entire songs.
  - **Mix-Blend-Mode Compositor Glitches:**
    `mix-blend-mode: screen` on fixed overlays over hardware-accelerated WebGL canvases and cross-origin YouTube video iframes triggered known Blink/WebKit compositor surface isolation bugs on macOS, occasionally clipping or failing to render the blinder layer.

- **Direct DOM Manipulation & Frame-Accurate Synchronization:**
  - **Eliminated React Re-Render Overhead:**
    Refactored `visualEngine.onWindowFlash` in `App.tsx` to directly mutate `document.getElementById('festival-window-blinder').style.opacity` and `.style.background`. This eliminates all React component re-renders during 60 FPS flash animations, preventing frame drops and ensuring vertical-sync accuracy.
  - **Tuned Musical Blinder Decay Curve:**
    Adjusted decay rate to $6.0 \cdot \text{routingConfig.effectDecay}$, providing an attack peak on kick transients and a smooth ~120ms–180ms visible bloom with white-hot filament center and vibrant chromatic halo before cleanly returning to 0.
  - **Clean Alpha Compositing:**
    Removed `mix-blend-mode: screen` and CSS `transition` from `.festival-window-blinder`, utilizing direct RGBA radial gradients (`rgba(255,255,255,0.96)` to `rgba(r,g,b,0.12)`) at `z-index: 15`. This guarantees flawless visual overlay above the YouTube video and Three.js stage without obscuring the floating transport player or header (`z-index: 25`), with `pointer-events: none` preserving full click interactivity.

- **Dynamic Song-Palette Synchronization & Mandatory Pure White:**
  - **Authoritative Flash Palette Engine (`laserColorUtils.ts`):**
    Implemented `resolveFlashPaletteColors()`:
    - Guaranteed inclusion: Pure white (`#FFFFFF`) is mandatory at Index 0 of every flash sequence.
    - Song-derived chromatic swatches: Subsequent indices cycle through normalized, deduplicated chromatic colors extracted from `this.activePalette` (`rawSwatches`, `spotlightColors`, `primary`, `secondary`, `accent`).
    - Downbeat synchronization: Sequence step automatically resets to 0 (compulsory pure white) on musical bar/phrase boundaries and after pauses (> 0.65s).
    - Alternating kicks cycle through the song's chromatic colors with white-hot filament cores.
    - Case C deterministic fallback: If a song's palette is entirely white/achromatic, golden-ratio seed calculation supplies deterministic chromatic hues without arbitrary blue/violet substitutions.
  - **State Hygiene & Track Invalidation:**
    Palette cache `cachedFlashColors` and animation accumulators (`currentFlashOpacity`, `flashSequenceStep`, `wasKickLastFrame`, `lastKickTimestamp`) are immediately reset upon track load, pause, and palette update, ensuring stale colors never bleed across track boundaries.
  - **Photosensitivity & Safety Controls:**
    Fully honors `routingConfig.reducedFlash` (instantly zeroing blinder opacity) and `screenFlashIntensity` slider (0.0 to 2.5x).

---

### 5.18 Phase 19 — Multi-Colour Laser Palette, 360° 3D End-to-End Rays, Full-Window Screen Flash, Audio-Video Lock & Tri-STEM Drop Pinpointing

#### 1. Architectural Motivation & Problem Diagnosis
During concert visualizer testing across varied music video styles, five visual and auditory synchronization constraints were identified:
1. **Opposite Colour Inversion vs Multi-Colour Songs:** When a song thumbnail contained multiple rich chromatic hues (e.g. Red and Gold, or Orange and Violet), deriving laser colours via 180° HSL opposite rotation (`+0.50`) caused lasers to take on unwanted complementary hues (Teal/Cyan) rather than displaying the song's actual palette colours. The user required that whenever more than one non-white colour is present, the lasers must use those exact colours directly without computing opposite hues.
2. **Downward-Only Beam Angle Limitation:** Laser choreographies were previously constrained to downward targets ($Y \in [-3.5, 4.0]$, $Z \approx -3.6$), failing to utilise the upper ceiling, festival sky, or full 3D auditorium volume, and never projecting forward towards the camera.
3. **Truncated Ray Lengths:** Laser cylinder meshes scaled strictly to the distance between nozzle and stage target ($L = \|\mathbf{T} - \mathbf{O}\|$), causing beams to terminate abruptly on the stage floor instead of cutting end-to-end across the full browser window.
4. **Flash Aperture & Perceived Center Localization:** Screen flash utilized a steep radial falloff (`0.06` opacity at edges), causing the flash to appear confined to the central YouTube iframe aperture with insufficient peripheral brightness.
5. **Startup Audio-Video Drift:** Video buffering lag delayed YouTube playback by 200–500ms relative to the instant Web Audio clock, causing singer lip-sync and percussive hits to drift visibly out of phase.
6. **Individual STEM vs Pinpointed Tri-STEM Drop Gating:** Previous activation checks tested overall RMS amplitude, allowing lasers to activate during vocal buildups or bass-only intros. The user specified that lasers must only activate during the drop part of a song—defined specifically as the smaller segment where Kick (drums), Bass, and Instruments **all simultaneously exceed their song-wide average amplitudes** at peak joint intensity.

#### 2. Multi-Colour Direct Song Palette Mapping (`laserColorUtils.ts` & `VisualEngine.ts`)
- **Case B Direct Chromatic Mapping:** In `resolveLaserPaletteColors`, the 180° HSL hue shift was replaced with direct palette indexing:
  $$\text{Tone 1} = \text{Color}_1 \quad (h_1, s_1, l_1), \quad \text{Tone 2} = \text{Color}_2 \quad (h_2, s_2, l_2)$$
  The diode nozzle and Tone 1 beam filament use the primary chromatic colour directly; Tone 2 alternating beams use the secondary chromatic colour directly. No complementary inversion is applied.
- **Dynamic Palette Mutation Purge:** In `VisualEngine.updateDynamicPalette`, removed the frame-by-frame 180° hue overwrite on `this.activePalette.laserColor`, ensuring `laserColor` adheres strictly to the authentic song palette and preserves extracted `spotlightColors`.
- **Expanded Palette Signature Invalidation:** Updated `ThinLasersEffect.updatePaletteColors` signature check to include `spotlightColors` and `laserColor`, guaranteeing instant material updates on the GPU when thumbnails or custom palettes load.

#### 3. 360° 3D End-to-End Laser Geometry (`laserChoreography.ts` & `ThinLasersEffect.ts`)
- **360° Spherical Trajectories Across 3 Dimensions:** Overhauled all 22 choreographies in `laserChoreography.ts` to generate full 3D direction vectors:
  - **Ceiling & Sky Zenith:** Upward elevation $\phi > 0$ targeting $Y \in [14, 26]$.
  - **Stage Floor & Pit:** Downward elevation $\phi < 0$ targeting $Y \in [-10, 0]$.
  - **Wide Horizontal Span:** Azimuth covering the full peripheral width ($X \in [-35, +35]$).
  - **Audience & Camera Projections:** Forward depth $Z \in [0, 25]$, targeting and flying past the camera position at $(0, 1.8, 9.2)$.
- **End-to-End Ray Length:** In `ThinLasersEffect.update`, normalized the 3D direction vector $\mathbf{D} = \frac{\mathbf{T} - \mathbf{O}}{\|\mathbf{T} - \mathbf{O}\|}$ and scaled cylinder length to `FULL_WINDOW_BEAM_LENGTH = 85.0`:
  $$\mathbf{P}_{\text{end}} = \mathbf{O} + \mathbf{D} \cdot 85.0$$
  This guarantees every beam pierces completely from its nozzle origin through and beyond the browser window boundaries, covering the entire width and height from edge to edge.

#### 4. Full-Window Blinder Wash & Increased Brightness (`VisualEngine.ts` & `index.css`)
- **Expansive Elliptical Gradients:** Updated `#festival-window-blinder` background styles to maintain intense illumination across all 4 corners and window edges:
  - White Blinder: `radial-gradient(ellipse at center, rgba(255,255,255,1.0) 0%, rgba(255,255,255,0.96) 35%, rgba(255,255,255,0.85) 70%, rgba(255,255,255,0.72) 100%)`
  - Song Palette Blinder: `radial-gradient(ellipse at center, rgba(255,255,255,1.0) 0%, rgba(255,255,255,0.92) 25%, rgba(r,g,b,0.90) 60%, rgba(r,g,b,0.75) 100%)`
- **Noticeable Brightness Ceiling:** Increased peak blinder opacity from `0.80` to `0.96`, with baseline transient kick response scaled to `(0.50 + kickVal * 0.48) * maxBri`.
- **Fixed Inset Pinning:** Updated CSS `.festival-window-blinder` to `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 15; pointer-events: none;`.

#### 5. High-Precision Audio & Video Synchronization (`YouTubeStagePlayer.tsx`)
- **Master Audio Clock Integration:** Connected `getAudioCurrentTime={() => audioEngine.getCurrentTime()}` directly into `YouTubeStagePlayer`.
- **Startup Buffer Snap:** In `onStateChange`, when YouTube video state transitions to `PLAYING` (state 1), measured drift against the master audio clock and snapped with `seekTo(masterTime, true)` if drift $> 0.08\text{s}$, completely eliminating initial buffering latency.
- **Continuous 100ms Drift Loop:** Dedicated high-frequency monitor checking drift every 100ms during playback; applies micro-seek adjustments whenever drift exceeds $140\text{ms}$ with a $200\text{ms}$ debounce lockout to prevent seek fluttering.

#### 6. Pinpointed Tri-STEM Peak Drop Activation Engine (`AudioEngine.ts` & `demucs_service.py`)
- **Full-Track Static Stem Baselines:** Extracted song-wide static average amplitudes across the entire audio timeline:
  $$\bar{A}_{\text{drums}} = \frac{1}{N}\sum D[i], \quad \bar{A}_{\text{bass}} = \frac{1}{N}\sum B[i], \quad \bar{A}_{\text{inst}} = \frac{1}{N}\sum I[i]$$
- **Joint Drop Qualification:** Identified frames satisfying the simultaneous tri-STEM requirement:
  $$\text{isTriDropFrame}[i] = (D[i] > \bar{A}_{\text{drums}}) \land (B[i] > \bar{A}_{\text{bass}}) \land (I[i] > \bar{A}_{\text{inst}})$$
- **Peak Segment Pinpointing:** Evaluated joint intensity $J[i] = \frac{D[i] + B[i] + I[i]}{3}$ for all qualifying frames, setting the drop threshold at the 45th–50th percentile of qualifying frames to isolate the concentrated climax segment (the drop).
- **Temporal Clustering & Hysteresis:** Grouped contiguous qualifying frames into `triStemDropSections: Array<{ startTime: number; endTime: number }>` ($t_{\text{min}} \ge 0.4\text{s}$, merging gaps $< 0.5\text{s}$).
- **Strict Laser Gating:** In `ThinLasersEffect.ts`:
  $$\text{targetActivation} = (\text{isLasersEnabled} \land \text{isTriStemDropActive}) \;?\; 1.0 : 0.0$$
  Outside the pinpointed drop segments, lasers fade out smoothly and are completely hidden (`visible = false`), igniting exclusively during the song's climactic drops.

---

## 6. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build`).
- **Linter Status:** `npm run lint` passes cleanly with **0 errors** across all 48 files.
- **Vite Development Server:** Running continuously at `http://localhost:5173/` (`task-1627`).
- **Audio Intelligence Microservice:** Running continuously as a local daemon at `http://127.0.0.1:8765/` (`task-4600`), handling Demucs neural stem extraction, kick comb filtering, ShazamIO recognition, and ultra-fast stem cache checks (`/api/check-stems-cache`) on Apple Silicon MPS hardware (`device: "mps"`).
- **Phase 1 Startup Gate:** Implemented and active; blocks unauthorized app entry until a YouTube Data API v3 key is validated via Google Cloud.
- **Phase 2 Repository Documentation:** Fully comprehensive, verified dependencies, licenses credited, contributor guides in place.
- **Phase 3 BPM Provenance Engine:** Fully implemented, verified against real tracks, cached per track, and active in the visualizer and telemetry HUD.
- **Phase 4 Symmetrical Spotlight Spawning:** Monotonically mapped across $[70, 160]\text{ BPM}$, symmetrically framing Top, Left, and Right of the YouTube player, with smooth transitions and zero visual jumps.
- **Phase 5 Logo Visibility & Decoupling:** SYNWAVE logo permanently remains visible at `(20px, 14px)`, smoothly dims to `0.45` opacity during upper menu auto-hide, returns to `1.0` on menu reveal or hover, with full click interactivity and zero positional shifting.
- **Phase 6 Laser Colors & Border Elimination:** Tri-layer volumetric additive architecture (Core + Sheath + Halo) for glowing, clean-edged festival laser fans.
- **Phase 7 Audio-Aware Laser Activation:** Full-track static average amplitude reference pre-computed before playback; smooth $0.35\text{s}/0.60\text{s}$ fading; directionally synchronized master movement driven by kick transients.
- **Phase 9 Pre-Playback Menu Visibility & Media Readiness Gate:** Bottom transport menu automatically appears once audio and video are loaded; remains persistently visible throughout paused and pre-playback states; auto-hide seamlessly activates only after confirmed playback begins.
- **Phase 10 Fullscreen Scaling & Spotlight Positioning:** Player dimensions constrained to `width: min(68vw, calc(62vh * (16 / 9))); top: 48%;`; spotlight positions and perimeter lights dynamically calculated relative to player container bounds; full compatibility across window resize and fullscreen toggles.
- **Phase 11 Dynamic Song-Palette Colors:** Immediate palette propagation on track load, pause, and thumbnail arrival.
- **Phase 12 Dynamic Song-Palette Flash-Screen with Compulsory White:** Flash-screen effect synchronized with kick onsets; pure white (`#FFFFFF`) on downbeats and phrase starts while distributing primary, secondary, and accent/laser song palette colors.
- **Phase 13 Shazam-First Recognition & Correctly Named Stage STEM Extraction:** 5-step sequential pipeline introduced; ShazamIO runs before Demucs starts; recognition metadata saved in track state (`recognitionStatus`, `shazamMatch`); extraction status and loader display `Extracting Stage STEMs — ${songTitle}`; stable audio fingerprint caching (`getTrackFingerprint`) eliminates redundant queries.
- **Phase 14 22-Pattern Concert Laser Choreography Engine:** 22 distinct concert laser movement choreographies implemented in `laserChoreography.ts`; real-time mid-range spectral analysis ($250\text{ Hz} - 4\text{ kHz}$) and Demucs instrumental stem extraction driving choreography transitions; Demucs drum kick events providing musical timing anchors; bass strictly purged from pattern selection; minimum dwell time of $3.5\text{s}$ enforced; Hermite cubic smoothstep transition blending ($0.50\text{s}$) eliminating visual pops.
- **STEM Caching Architecture:** In-memory client cache ($0\text{ms}$), browser IndexedDB store ($<5\text{ms}$), and Python server disk cache ($<15\text{ms}$) with `/api/check-stems-cache` pre-flight check implemented; stems indexed by file fingerprint, SHA256 content hash, and unique song identity (`title:::artist`).
- **Phase 15 Clean Video Aperture & Caption Management:** Synwave-generated overlays completely eliminated from the YouTube video screen container; video metadata and status relocated outside the video aperture; YouTube player configured with `cc_load_policy: 0`, `controls: 0`, and `disablekb: 1`; caption options safely inspected with `unloadModule('captions')`.
- **Dual-Layer Audio Impact Architecture (Restored):** 3D stage layer zooms and punches dynamically with sub-bass hits ($20-100\text{Hz}$) through camera FOV zoom punch; YouTube stage video iframe element shakes in 2D space on drum kicks through `onStageShake`; concert moving heads and perimeter lights track cleanly with high visual fidelity and bilateral symmetry.
- **Phase 17 Conditional Laser Colours, Full-Screen Light Paths & Reliable Space Controls:** Normalized and deduplicated palette processing in `laserColorUtils.ts`; permanent ref-backed keyboard listener on `window` with capture phase eliminates listener churn, prevents page scrolling, guards against duplicate button toggles, protects text inputs, and automatically reclaims focus from cross-origin iframes.
- **Phase 18 Fix Screen Flash & Synchronize with Active Song Colour Palette:** Vertical-sync direct DOM mutation on `#festival-window-blinder`, eliminating React re-render lag and asynchronous state batch cancellation; fixed kick onset detection in `AudioEngine.ts` to prevent drum energy level-locking.
- **Phase 19 Multi-Colour Lasers, 360° 3D End-to-End Rays, Full-Window Blinder, Audio-Video Lock & Tri-STEM Drop Pinpointing:**
  - Multi-colour songs directly map authentic chromatic palette colours (Tone 1 = Color 1, Tone 2 = Color 2) without 180° opposite hue inversion.
  - 360° 3D beam trajectories deployed across all 22 choreographies: sweeping upward to ceiling zenith ($Y \in [14, 26]$), downward to stage floor ($Y \in [-10, 0]$), wide horizontal sweeps ($X \in [-35, +35]$), and forward auditorium projections ($Z \in [0, 25]$) aimed directly at and past the camera at $(0, 1.8, 9.2)$.
  - 85m cylinder beam length extends end-to-end completely covering browser window width and height.
  - Full-window blinder wash with elliptical radial gradients and increased peak brightness ($0.96$) pinned to `inset: 0` covering entire viewport (`100vw` by `100vh`).
  - Master audio hardware clock drift monitoring loop ($100\text{ms}$) with instant snap on `PLAYING` transitions to ensure perfect audio-video lip-sync.
  - Pinpointed Tri-STEM drop activation engine: computes track-wide baselines $\bar{A}_{\text{drums}}, \bar{A}_{\text{bass}}, \bar{A}_{\text{inst}}$, isolating the smaller peak drop segments where all 3 stems simultaneously exceed their averages, gating lasers to only activate during climactic drop sections.
### 5.19 Phase 20 — Razor-Thin Laser Geometries, Routing Width Slider, Instant On/Off Transitions, Exact Spike Timestamp Alignment & Unified .syncwave_cache

#### 1. Architectural Motivation & Problem Diagnosis
During rigorous festival visual testing, four key refinements were identified:
1. **Volumetric Beam Thickness:** Previous laser cylinder radii ($r_{\text{core}} = 0.005 - 0.012$, $r_{\text{sheath}} = 0.018 - 0.040$, $r_{\text{halo}} = 0.040 - 0.085$) appeared bulky rather than razor-sharp stadium diode beams. Users lacked an interactive runtime calibration slider in the Audio-to-Visual Routing Console.
2. **Gradual Fade In/Out Latency:** Previous activation applied a continuous exponential interpolation ($\text{fadeRate} = 3.5 / 1.8$, $\approx 0.35\text{s} - 0.60\text{s}$), softening the arrival of drops and creating visual sluggishness.
3. **Drop Boundary Alignment with Musical Spike:** The initial tri-STEM frame cluster start occurred when joint energy passed the static threshold, which often caught pre-drop risers or drum rolls $100\text{ms} - 300\text{ms}$ before the actual drop downbeat impact.
4. **Cache Directory Standardization:** Standardized the disk cache directory across Python microservices to `.syncwave_cache/stems` and `.syncwave_cache/temp`, purging old/ambiguous cache locations.
5. **Repository Hygiene:** Purged local `My Music` folder and untracked sample blueprints from git history and workspace.

#### 2. Razor-Thin Geometries & User Width Slider (`ThinLasersEffect.ts`, `RoutingConsole.tsx`, `types/index.ts`)
- **Ultra-Thin Diode Geometries:**
  - Luminous Core: $r_{\text{top}} = 0.002, r_{\text{bottom}} = 0.0045$ (reduced by $> 60\%$ to achieve needle-thin neon filaments).
  - Volumetric Sheath: $r_{\text{top}} = 0.0055, r_{\text{bottom}} = 0.012$.
  - Atmospheric Halo: $r_{\text{top}} = 0.012, r_{\text{bottom}} = 0.025$.
  - Diode Dot Emitter: Sphere radius reduced to $0.025\text{m}$.
- **Interactive Routing Slider (`laserBeamWidth`):**
  - Added `laserBeamWidth?: number` ($0.2\times$ to $2.5\times$, default $1.0\times$) in `AudioVisualRoutingConfig`.
  - Added dedicated slider in Section 4 ("360° DOWNWARD INSTRUMENT LASERS") of `RoutingConsole.tsx`.
  - In `ThinLasersEffect.update`, beam thickness is computed as:
    $$\text{beamThickness} = \text{userWidthScale} \times \left(1.0 + \min(0.25, E_{\text{mid}} \times 0.15 + I_{\text{kick}} \times 0.20)\right)$$

#### 3. Instant On / Off Transitions Without Fading (`ThinLasersEffect.ts`)
- Completely eliminated the gradual exponential easing curve:
  $$\text{currentBeamOpacity} = \text{isEligible} \;?\; 1.0 : 0.0$$
- If $\text{currentBeamOpacity} \le 0$, `setAllLasersVisible(false)` is invoked immediately and the render loop exits.
- When entering a drop, lasers ignite to full $1.0$ opacity with zero-frame latency, creating dramatic concert lighting cuts.

#### 4. Exact Downbeat Spike Timestamp Alignment (`AudioEngine.ts`, `demucs_service.py`, `AudioAnalyzer.ts`)
- **Sudden Music Spike Detector (`findSuddenMusicSpikeTimestamp`):**
  - For each qualifying drop cluster starting at raw time $t_{\text{raw}}$, searches the immediate temporal neighborhood $[t_{\text{raw}} - 0.18\text{s}, t_{\text{raw}} + 0.55\text{s}]$.
  - Computes the instantaneous energy surge derivative:
    $$\Delta \text{surge}[j] = 1.6 \times (D[j] - D[j-1]) + 1.6 \times (B[j] - B[j-1]) + (I[j] - I[j-1])$$
  - Filters nearby kick onsets from `kickOnsets`. If a kick onset is located near the peak surge ($\le 0.25\text{s}$), snaps $t_{\text{start}}$ directly to that kick downbeat timestamp; otherwise snaps to the peak derivative frame.
  - Guarantees that lasers ignite precisely on the sudden music spike downbeat.

#### 5. Cache Directory Standardization to `.syncwave_cache`
- Updated `CACHE_DIR = BASE_DIR / ".syncwave_cache" / "stems"` in `demucs_service.py`.
- Updated `temp_dir = Path(__file__).resolve().parent / ".syncwave_cache" / "temp"` in `shazam_server.py`.
- Added `.syncwave_cache/` to `.gitignore`.
- Purged any obsolete `.synwave_cache` files.

### 5.20 Phase 21 — Unified Server Disk Cache Architecture (`.synwave_cache`), Dual Shazam & Demucs Disk Stores, and Elimination of Cache Desynchronization

#### 1. Problem Diagnosis & Root Cause Analysis
During local testing of fresh song imports, the following discrepancies were identified:
1. **Missing Disk Cache Folder:** The cache directory was mistakenly named `.syncwave_cache` (with a 'c') in `demucs_service.py` and `shazam_server.py`, conflicting with the canonical project name `Synwave`.
2. **Hidden Browser Storage Interception:** The client application persisted Shazam metadata in browser `localStorage` (`synwave_shazam_cache_v2`) and stem envelopes in browser `IndexedDB` (`synwave_stems_db`). When a user uploaded an audio file that had been tested in a prior session, the frontend checked client-side storage first and returned the old data immediately without contacting the Python backend. Consequently, neither `/api/recognize` nor `/api/separate-stems` were executed, and no disk cache folder was ever created.
3. **Absence of Shazam Server-Side Disk Caching:** `shazam_server.py` possessed no server-side disk caching mechanism for song identification; recognition results were only cached on the client browser.
4. **Lack of Cache Invalidation / Re-generation Synchronization:** If a user cleared or deleted the cache folder on disk intending to trigger a fresh analysis, the browser silently served cached data from IndexedDB/localStorage, preventing `.synwave_cache` from re-populating.

#### 2. Unified `.synwave_cache` File Hierarchy
Standardized the disk cache structure into three discrete, dedicated subdirectories under `BASE_DIR / ".synwave_cache"`:
- **`stems/`:** Stores pre-computed Demucs 4-stem 25 FPS normalized RMS curves, kick onsets, transient events, and `demucsBpm` keyed by SHA-256 digest, audio fingerprint, and song identity (`song_{hash}.json`).
- **`shazam/`:** Stores verified Shazam recognition payloads (title, artist, album, genre, coverArt, verified BPM, and confidence) keyed by stable audio fingerprint and SHA-256 digest.
- **`temp/`:** Ephemeral staging directory for multi-part file uploads during neural processing, cleaned automatically on completion.
- **Legacy Migration:** Both `demucs_service.py` and `shazam_server.py` automatically detect and migrate any residual files from `.syncwave_cache` to `.synwave_cache` on initialization.

#### 3. Authoritative Server Disk Cache Synchronization (`shazamService.ts`, `demucsService.ts`)
- **Server-First Hierarchy:**
  - Microservice online: Disk store (`.synwave_cache`) is the single source of truth.
  - If `.synwave_cache` is missing or does not contain a track, the frontend executes live Shazam identification (`/api/recognize`) and Demucs separation (`/api/separate-stems`), ensuring `.synwave_cache` is created and populated on disk.
  - Microservice offline: Browser `localStorage` and `IndexedDB` act strictly as graceful offline fallbacks so the visualizer can still function when the user runs Vite in standalone mode.
- **New Microservice Endpoints (`shazam_server.py`):**
  - `POST /api/check-shazam-cache`: Fast (<5ms) pre-flight check to verify if Shazam metadata already exists in `.synwave_cache/shazam`.
  - `POST /api/recognize`: Live ShazamIO recognition with disk caching in `.synwave_cache/shazam`.
  - `GET /api/cache/info`: Returns cache directory path, existence, and file counts for stems and shazam.
  - `POST /api/cache/clear`: Wipes all files from `.synwave_cache/stems`, `.synwave_cache/shazam`, and `.synwave_cache/temp`.

#### 4. Real-Time Telemetry HUD & Universal Cache Invalidation
- **Live Disk Cache Status (`DiagnosticOverlay.tsx`):**
  - Added real-time disk store indicator displaying active `.synwave_cache` status, total stems count, and total shazam count.
  - Added interactive "PURGE ALL CACHES" button in the HUD to wipe server disk files, browser IndexedDB stems, and localStorage recognition simultaneously with a single click.

### 5.21 Phase 22 — Canonical Single-File Caching Architecture, Strict Namespace Separation (`shazam_*.json` vs `stems_*.json`), and Content-Aware Alias Indexing

#### 1. Problem Diagnosis & Directory Redundancy Analysis
An investigation into `.synwave_cache/shazam` and `.synwave_cache/stems` revealed significant duplication and naming collisions:
1. **Identical Candidate-Key Filenames Across Directories:** Both `shazam_server.py` and `demucs_service.py` wrote cached JSON files directly named after candidate lookup keys (`file_{name}_{size}_{mtime}.json`, `song_{hash}.json`, and raw SHA-256 digests). Consequently, `.synwave_cache/shazam` and `.synwave_cache/stems` contained identical file names (e.g. `file_ILLENIUM....json`, `song_02870d34....json`), creating the impression that both folders were storing duplicate data.
2. **Multi-File Redundancy within Folders:** For every uploaded track, both services iterated over all candidate lookup keys and saved a separate, identical copy of the JSON payload under each key. For stems, a single song created up to five 244 KB duplicate files in `.synwave_cache/stems`, wasting disk space and causing cache bloat.
3. **Lack of Self-Documenting Payloads:** Cached JSON files lacked explicit typing metadata indicating whether they contained Demucs stem curves or Shazam song recognition metadata.

#### 2. Architecture & Design Principles
Implemented a strict, canonical single-file caching architecture with index table indirection:
1. **Strict Namespace Prefixing & Type Tagging:**
   - **`shazam/` Store:** Exactly ONE canonical file per track prefixed with `shazam_`:
     `shazam_{canonical_hash}.json` containing:
     ```json
     {
       "service": "shazam",
       "type": "song_metadata",
       "title": "...",
       "artist": "...",
       "album": "...",
       "genre": "...",
       "coverArt": "...",
       "bpm": 140.0,
       "bpmSource": "shazamio",
       "bpmConfidence": 1.0,
       "cached": true
     }
     ```
   - **`stems/` Store:** Exactly ONE canonical file per track prefixed with `stems_`:
     `stems_{canonical_hash}.json` containing:
     ```json
     {
       "service": "demucs",
       "type": "stem_envelopes",
       "fps": 25,
       "durationSeconds": 220.68,
       "stems": { "drums": [...], "bass": [...], "instruments": [...], "vocals": [...] },
       "kickEvents": [...],
       "kickOnsets": [...],
       "demucsBpm": { "bpm": 140.0, "confidence": 0.88, "source": "demucs" }
     }
     ```
2. **Zero-Duplication Alias Indexing (`index.json`):**
   - Maintained `.synwave_cache/shazam/index.json` and `.synwave_cache/stems/index.json`.
   - Each `index.json` provides an $O(1)$ dictionary mapping of all alias candidate keys (`fingerprint`, `file_hash`, `song_key`, path digests, raw hashes) to their respective canonical file (`shazam_{id}.json` or `stems_{id}.json`).
   - Eliminates duplicate file copies on disk while preserving instantaneous lookup across any alias key.
3. **Cross-Service Type Safety & Content Validation:**
   - `get_cached_shazam_result` strictly verifies that payloads contain `"title"` and do NOT contain `"stems"`.
   - `get_cached_result` in `DemucsService` strictly verifies that payloads contain `"stems"`.
   - Cross-contamination between folders is completely prevented at the parser and retrieval layer.
4. **Automated Migration & Content Deduplication:**
   - Both services include self-healing startup migration routines (`migrate_legacy_shazam_cache()` and `migrate_legacy_stems_cache()`).
   - Existing legacy un-prefixed files and duplicate candidate files are automatically consolidated into single canonical files and registered in `index.json`.
   - Duplicate stem files sharing identical audio envelope signatures are merged, reclaiming disk space.

### 5.22 Phase 23 — Universal Multi-Stem Drop Laser Activation, Windowed Envelope Followers, and Kick-Synchronized Screen Flash Strobe

#### 1. Problem Diagnosis & Mathematical Root Causes
1. **Drop Laser Failure on Saturated Multi-Stem Drops:**
   - In songs where kick, bass, and instruments exploded simultaneously at the drop, lasers were failing to activate or flickering intermittently.
   - Tracing revealed that `tri_drop_mask` in `demucs_service.py` evaluated instantaneous 40ms RMS frames ($25\text{ FPS}$). Because drum and kick transients decay in $\approx 80\text{ms}$, the drums stem envelope dropped below average every $200-400\text{ms}$ between consecutive kick hits.
   - As a result, the boolean product $\text{kick}[i] > \text{avg} \land \text{bass}[i] > \text{avg} \land \text{inst}[i] > \text{avg}$ fragmented what should have been a continuous 20–30s musical drop into disjoint 0.4s micro-slices. The subsequent filtering $\Delta t \ge 2.5\text{s}$ discarded all these micro-slices, leaving `triStemDropSections: []` completely empty (e.g. on tracks like *Waves*).
   - In `ThinLasersEffect.ts`, the activation gate strictly checked `isTriStemDropActive ?? isAboveAverageAmplitude`, failing to consider real-time drop detection or real-time dual-stem energy surges.
2. **Screen Flash / Kick Desynchronization:**
   - The screen flash blinder effect was desynchronized from the physical kick drum hits in several songs.
   - In `VisualEngine.ts`, `isTransientKick` evaluated `isKickOnset || isBeatKick`. `isBeatKick` was derived from `features.isBeat`, which fired on mathematical metronome BPM grid clock ticks from the `BeatGridEngine`. On syncopated rhythms, half-time beats, swing tempos, or breakdowns, the beat grid tick fired when no kick was present.
   - Worse, this false beat trigger set `this.lastKickTimestamp = trackTimeSeconds`, and the subsequent lockout `timeSinceLastKick > 0.16` blocked the actual physical kick transient when it arrived 80–120ms later.
   - Furthermore, `features.kickIntensity || 0.5` defaulted to 0.5 on zero intensity, causing quiet non-kick frames to fire at half-intensity.
   - In `demucsService.ts`, `Math.abs(timeSeconds - event.time) < 0.08` marked `isKickOnset = true` up to 80ms *before* the kick arrived, triggering flashes prematurely.

#### 2. Architecture & Implementation Journey
1. **Windowed Envelope Followers & Multi-Second Gap Bridging (`demucs_service.py`):**
   - Implemented rolling window smoothing ($W = 1.5\text{s} = 37\text{ frames}$) for stem envelopes:
     $$\bar{E}_{\text{kick}}[i] = \frac{1}{W}\sum_{k=i-W/2}^{i+W/2} E_{\text{kick}}[k]$$
   - Formulated a joint multi-stem drop metric:
     $$J[i] = 0.45 \cdot \bar{E}_{\text{kick}}[i] + 0.45 \cdot \bar{E}_{\text{bass}}[i] + 0.10 \cdot \bar{E}_{\text{inst}}[i]$$
   - Applied a resilient dual-condition drop mask:
     $$\text{isDropFrame}[i] = (\bar{E}_{\text{kick}}[i] \ge 0.85 \cdot \mu_{\text{kick}} \land \bar{E}_{\text{bass}}[i] \ge 0.85 \cdot \mu_{\text{bass}}) \lor (J[i] \ge 1.08 \cdot \mu_J)$$
   - Introduced a 2.0s gap bridging window to fuse off-beat rhythmic spaces between kick beats into unified, contiguous musical drop sections.
   - Integrated step 3 in `migrate_legacy_stems_cache()` to automatically re-compute and update `triStemDropSections` across all existing cache files in `.synwave_cache/stems/`.
2. **5-Tier Resilient Drop Laser Activation Gate (`ThinLasersEffect.ts`, `AudioEngine.ts`):**
   - Upgraded `ThinLasersEffect.ts` activation criteria to guarantee lasers fire on EVERY song at the drop:
     - **Tier 1:** Pre-computed Demucs multi-stem continuous drop sections (`features.isTriStemDropActive`).
     - **Tier 2:** Real-time drop condition detected in `AudioEngine` (`features.isDrop`).
     - **Tier 3:** High-energy euphoric drop mood classification (`features.mood === 'euphoric-drop'`).
     - **Tier 4:** Saturated dual-stem surge (`kick > 0.40 && bass > 0.40`).
     - **Tier 5:** Climax amplitude above track average during active festival mode (`isAboveAverageAmplitude && festival`).
   - Added `dropHoldTimer = 0.80s` decay bridge to sustain lasers seamlessly across 8-beat or 16-beat syncopated pauses within drop sections.
3. **Transient-Locked Kick Screen Flash Synchronization (`VisualEngine.ts`, `demucsService.ts`):**
   - Removed `isBeatKick` entirely from `VisualEngine.ts`. The screen flash is now strictly keyed to audio kick transients (`isKickOnset = features.isKick && !this.wasKickLastFrame`).
   - Narrowed `sampleStemValues` kick onset window in `demucsService.ts` from $\pm 80\text{ms}$ to $[-15\text{ms}, +48\text{ms}]$, locking the trigger exactly to the leading-edge transient arrival.
   - Screen flash intensity is dynamically modulated by `kickVal = Math.max(features.kickIntensity, features.stems.kick) * routingConfig.kickSensitivity`, eliminating artificial defaults and scaling target opacity directly with the acoustic punch of the kick drum.
   - Reduced lockout to 100ms with negative delta handling, preventing duplicate flashes on a single kick while supporting double-kicks and drum rolls up to 600 BPM and handling user scrubbing seamlessly.

4. **Unified Concurrent Development Runner (`start.sh`, `package.json`):**
   - Engineered an automated, unified execution script `start.sh` and npm workflow (`npm start` / `npm run dev`) that concurrently launches the Python Audio Intelligence Microservice (`shazam_server.py` on port 8765) and the Vite Frontend Development Server (port 5173).
   - Automatically detects and activates virtual environments (`.venv` or `venv`), verifies and resolves Python microservice dependencies, and manages child PIDs with a POSIX signal trap (`cleanup` on `INT`, `TERM`, `EXIT`) to guarantee clean termination of both servers without orphaned zombie processes on port 8765.
5. **Showcase Demo Media Integration & Attribution (`README.md`, `demo/demo.mp4`):**
   - Optimized demonstration video `demo/demo.mp4` to under 10MB (8.7MB) and uploaded to GitHub's native asset CDN (`user-attachments/assets/c813d12a-8a76-4ba4-ac8e-d8f42dc462b0`), guaranteeing that GitHub's markdown parser directly displays the interactive HTML5 video player (play, pause, scrub, volume, fullscreen) without sanitization stripping.
   - Preserved full music and visual attribution for *Abandoned - Destroyer Of Worlds (Oppenheimer Remix) [Music Video]* ([@AbandonedOfficial](https://www.youtube.com/@AbandonedOfficial)) in the showcase header and third-party attribution tables.


### 5.23 Phase 24 — Professional Concert Laser Show Director Refactor

#### 1. Problem Diagnosis & Mathematical Motivation
1. **Permissive OR-Based Gating & Constant Laser Saturation:**
   - Prior to this refactor, `ThinLasersEffect.ts` employed an overly permissive activation gate: any transient kick, elevated bass, euphoric-drop mood tag, or amplitude spike could activate the entire 3-station laser rig.
   - Consequently, in energetic dance, EDM, or rock tracks, lasers remained persistently active across verses, intros, and buildups, stripping drops and climaxes of visual impact.
2. **Feature Conflation & Amplitude Ambiguity:**
   - In `AudioEngine.ts`, `isAboveAverageAmplitude` was hardcoded to return `this.isTriStemDropActive(currentTime)`. This created a circular confirmation loop where amplitude and multi-stem drops were identical boolean signals, undermining independent drop corroboration.
3. **Absence of Musical Choreography Structure:**
   - Choreography patterns switched based on arbitrary elapsed-time intervals (~14 seconds) or random transient events. Patterns flipped mid-bar or mid-beat without regard to musical motifs, phrase boundaries, or 4-bar arcs.
   - All 22 trajectories in `laserChoreography.ts` were treated uniformly: full-360° omnidirectional superfans could trigger randomly during quiet melodic bridges, while restrained directional fans could trigger during peak drops.
4. **Multi-Frame Downbeat Re-triggering:**
   - In `BeatGridEngine`, `isBar` remains true for the entire duration where `beatPhase < 0.12` (~7 frames at 60 FPS). Without monotonic measure index tracking, bar-triggered state machines would attempt to advance or cycle patterns multiple times across consecutive frames of a single downbeat.
5. **Architectural Divergence Between Laser Rigs:**
   - `LaserBeamsEffect.ts` maintained an independent 14-second mode timer, unsynchronized rainbow color cycling, and local activation heuristics that conflicted directly with the top-aperture rig in `ThinLasersEffect.ts`.

---

#### 2. Architecture & Implementation Journey

##### 1. Semantic Laser Implementation Labels & 22-Choreography Mapping (`laserChoreography.ts`)
- Defined a typed semantic state model (`LaserSemanticState`):
  - `OFF`: Complete rig blackout when no authorized musical cue exists.
  - `CINEMATIC_DIRECTIONAL`: Restrained, sparse beams thrown in deliberate directions with slow instrumental tracking (e.g. *Audience Ocean Scan*, *3D Sonic Sine Wave*).
  - `MELODIC_ANTHEM`: Spacious, slow aerial canopies for emotional or melodic choruses (e.g. *Forward Auditorium Scissor Canopy*, *Skyward Crown Fan*).
  - `BUILD_RISER`: Progressive, tension-building upward fans and accelerating geometric lattices (e.g. *Stadium 3D Skyward Dome*, *3D Kinetic Hypercube*).
  - `DROP_IMPACT`: High-impact transient bursts synchronized strictly to drop onsets or downbeat accents (e.g. *Camera-Targeting Concentrated Burst*, *Full-Window Slashes*).
  - `DROP_GROOVE`: Sustained drop choreography with beat-synchronized pulses and bar-by-bar motif variations (e.g. *Cathedral Scissor Matrix*, *3D Vortex Tunnel*).
  - `CLIMAX_OMNIDIRECTIONAL`: Maximum spatial coverage reserved exclusively for peak climaxes (e.g. *360° Radial Starburst*, *Climax Omnidirectional Superfan*).
- Created `LASER_CHOREOGRAPHY_METADATA` establishing semantic class, 4-bar arc roles (`motif`, `development`, `tension`, `accent`), speed scaling, beam density, and elevation profiles for all 22 existing trajectories.
- Implemented `selectChoreographyForArc()` enabling structured 4-bar phrase development using deterministic track-seeded selection within permitted families.

##### 2. Decoupled Amplitude Feature Semantics (`AudioEngine.ts`)
- Fixed `isTimestampAboveAverage(currentTime)` to evaluate precomputed `aboveAverageSections` and check RMS against calibrated `trackAverageAmplitude`.
- Decoupled `isAboveAverageAmplitude` from `isTriStemDropActive`, restoring genuine multi-signal corroboration.

##### 3. Hierarchical Activation Gate & Multi-Signal Drop Confidence (`LaserShowController.ts`)
- Implemented a single authoritative decision engine enforcing strict hierarchical eligibility:
  1. User laser routing enabled (`routingConfig.enabledEffects.lasers`).
  2. Section director laser permission (`directorState.allowedEffects.lasers`).
  3. Valid, active playback clock (clearing all pending cues and holds on pause/seek/track-change).
  4. Section-level policy filtering (verses, intros, breakdowns, and outros default to `OFF`).
- Formulated an auditable multi-signal Drop Confidence score $C_{\text{drop}} \in [0, 1]$:
  $$C_{\text{drop}} = 0.35 \cdot S_{\text{demucs}} + 0.25 \cdot S_{\text{director}} + 0.15 \cdot S_{\text{stems}} + 0.10 \cdot S_{\text{transient}} + 0.05 \cdot S_{\text{downbeat}} + 0.10 \cdot S_{\text{intensity}}$$
  where:
  - $S_{\text{demucs}} = 1.0$ if precomputed multi-stem continuous drop active, else $0$.
  - $S_{\text{director}} = 1.0$ if director section is `'drop'`, $0.4$ if late buildup, else $0$.
  - $S_{\text{stems}} = \min(1.0, \frac{\text{kick} + \text{bass} + \text{inst}}{1.8})$.
  - $S_{\text{transient}} = \min(1.0, \text{kickIntensity} \cdot 1.2)$ on active kick.
  - $S_{\text{downbeat}} = 1.0$ if downbeat confirmed within beat confidence.
  - $S_{\text{intensity}} = \text{dropIntensity}$.
- Enforced Schmitt-trigger hysteresis ($C_{\text{drop}} \ge 0.60$ for activation; $C_{\text{drop}} < 0.38$ for release) with a $0.85\text{s}$ drop-hold decay timer to bridge syncopated kick pauses within active drops while cutting cleanly outside drop sections.

##### 4. Melodic Anthem & Progressive Buildup Behaviors
- **Melodic Anthem Candidate Detection:** Evaluates sustained instrumental activity ($\ge 0.45$), moderate energy, and absence of drop confirmation over multiple beats. Permitted patterns are restricted to restrained, slow directional fans without strobing or omnidirectional coverage.
- **Buildup Tension Riser:** In late buildups ($sectionProgress \ge 0.45$ + rising HF trend), progressively ramps movement speed, raises upward beam elevation bias ($+8.5^\circ$), and scales beam density towards the drop entrance downbeat.

##### 5. Beat-Grid-Aware 4-Bar Choreography Arc Scheduler
- Replaced wall-clock timers with monotonic measure indexing:
  $$\text{absoluteBarCounter} = \lfloor \text{beatIndex} / 4 \rfloor$$
- Guarded bar transitions to execute strictly once per measure:
  $$\text{canTransition} = \text{isBar} \land (\text{absoluteBarCounter} \ne \text{lastProcessedAbsoluteBar})$$
- Arranged 4-bar phrase progression across distinct roles:
  - **Bar 1 (Motif):** Establishes the visual theme with moderate spread.
  - **Bar 2 (Develop):** Introduces geometric variations or alternate bank sweeping.
  - **Bar 3 (Tension):** Increases trajectory speed, fan width, and elevation.
  - **Bar 4 (Accent):** Delivers phrase accent or downbeat impact.
- Applied smooth $350\text{ms}$ trajectory interpolation between pattern transitions.
- Integrated low-confidence BPM fallback relying on physical kick transients with conservative, smoothly timed sweeping.

##### 6. Deliberate Acoustic Modulation Engine
- **Kick Impulse Envelope:** Fast attack with $140\text{ms}$ exponential decay modulating beam pulse brightness.
- **Beat-Gated Call-and-Response:** In `DROP_GROOVE` mode, alternates active station masks (`[true, false, true]` vs `[false, true, false]`) on alternating beats, creating physical concert lighting dialogue.
- **Sub-Bass Dynamics:** Modulates beam spread and beam thickness dynamically without altering choreography geometry.
- **Instrumental Tracking:** Smoothly steers horizontal and vertical pan/tilt angles based on sustained upper-mid and instrument stem trajectories.

##### 7. Unified Laser Architecture & Telemetry
- Integrated `LaserShowController` into `ShowDirector.ts` and passed the resulting `LaserShowDecision` via `VisualEffectContext` in `VisualEngine.ts`.
- Refactored `ThinLasersEffect.ts` and `LaserBeamsEffect.ts` as pure geometry renderers driven by the shared director decision.
- Removed unsynchronized timers, independent rainbow color loops, and local activation gates from `LaserBeamsEffect.ts`, mapping perimeter modes (`Scissor Cross`, `Wide Horizon Fan`, `Liquid Sky`, `Drop Frenzy`) to semantic states using song-derived complementary color palettes.
- Enhanced `DiagnosticOverlay.tsx` to display real-time laser state, cue reason, drop confidence %, 4-bar phrase arc stage, and active choreography metadata.


### 5.24 Phase 25 (Phase 18) — Cinematic Camera-Facing Instrument Drift

#### 1. Problem Diagnosis & Motivation
1. **Absence of Dedicated Low-Percussion Melodic Choreography:**
   - Prior choreography patterns in Synwave were predominantly designed around high-energy rhythmic sections, drops, and buildups with active kick transients.
   - In spacious cinematic melodic choruses, vocal-instrumental bridges, and emotional passages with little or no kick drum activity, existing patterns either remained completely blacked out or cycled through wide spatial sweeps and rotational matrices that felt too aggressive for atmospheric passages.
2. **Requirement for Static-but-Dynamic Forward Projection:**
   - Cinematic concert lighting requires a static-but-dynamic presentation:
     - *Static composition:* The beams remain oriented forward toward the viewer/camera plane, maintaining a recognizable, narrow forward-facing arrangement.
     - *Dynamic movement:* The overall aim point drifts smoothly across a bounded area in response to the musical evolution of the melody.
     - *Sparse presentation:* Only a controlled subset of beams is active (15–30% density; ~2 beams per station).
     - *Restrained timing:* Activates when a suitable melodic section begins with low kick activity, fading in smoothly and remaining almost still when the melody holds.

---

#### 2. Architecture & Implementation Journey

##### 1. Dedicated Pattern ID 22 (`laserChoreography.ts`)
- Appended **ID 22: `Cinematic Camera-Facing Instrument Drift`** to `LASER_CHOREOGRAPHIES` without renumbering or modifying existing IDs 0–21.
- Registered in `LASER_CHOREOGRAPHY_METADATA`:
  - Primary category: `CINEMATIC_DIRECTIONAL`
  - Compatible categories: `['CINEMATIC_DIRECTIONAL', 'MELODIC_ANTHEM']`
  - Four-bar arc role: `'motif'`
  - Default density: `0.25` (sparse filament presentation)
  - Default speed scale: `0.40`
  - Max spread aperture: `45°` (narrow, cohesive forward fan)
- **Forward-Facing Stage Geometry:**
  - Projects towards a camera-facing target plane situated just in front of the viewer/camera ($Z_{\text{target}} = \text{cameraZ} - 1.6 \approx 7.6\text{m}$, $Y_{\text{target}} \approx 2.4\text{m}$, $X_{\text{target}} \approx 0$).
  - Maintains small, consistent horizontal and vertical offsets between beams within each station ($c \cdot 1.25\text{m}$ spread; alternating $\pm 0.12\text{m}$ vertical stagger) so individual beams remain visually distinguishable.
  - Applies subtle coordinated station offsets ($\Delta X = -0.45\text{m}$ for left, $+0.20\text{m}$ $Y$ for center, $+0.45\text{m}$ for right), preserving the 3-station top-aperture rig.
  - Dynamically adapts to aspect ratio and screen resizing using authoritative stage dimensions from `calculateStageDimensions()`.

##### 2. Inexpensive Smoothed Mid-Band Spectral Contour (`AudioEngine.ts`)
- Added `midSpectralContour` and `midContourTrend` to `AudioFeatures`:
  - Evaluates weighted centroid across the 250 Hz–4 kHz mid-range bins (bins 12 to 186).
  - Enforces a continuity check clamping frame-to-frame jumps to $\pm 0.045$, preventing erratic octave jumps between unrelated harmonics.
  - Derives `smoothedContourTrend` indicating melodic movement direction: positive for rising melody, negative for falling melody, and zero for sustained stable tones.

##### 3. Music-Informed 2D Drift State (`LaserShowController.ts`)
- Created continuous 2D motion coordinates `cinematicAimX` and `cinematicAimY`:
  - **Vertical Drift:** Steered by `midContourTrend` and modulated by spectral flux stability factor ($1.0$ when coherent, down to $0.08$ when chaotic). Rising melodic contour drifts upward; falling contour drifts downward; sustained notes decay velocity to zero and hold position; noisy/unstable flux reduces movement rather than jittering.
  - **Horizontal Drift:** Driven by a slow musical wander (8–20s period) modulated by instrumental energy and upper-mid vs lower-mid distribution sway.
  - Normalized target area corresponds to 5–15% of usable visual width and 3–8% of usable visual height.

##### 4. Hierarchical Activation & Kick History Evaluation
- Maintained a short, beat-aware rolling kick history window (`rollingKickHistory` over 40 frames).
- Condition for cinematic drift:
  $$\text{isLowKick} = (\bar{E}_{\text{kick}} < 0.28) \land (\text{avgInstSustain} > 0.38) \land (\text{midRangeEnergy} > 0.22) \land (\text{midSpectralFlux} < 0.60) \land (C_{\text{drop}} < 0.40)$$
- **Strict Cue Precedence:** Drops, buildups, and climaxes immediately override the cinematic state. Isolated kicks do not trigger drops or cause aim jumps.
- **Envelope Tuning:** Smoothed fade-in (~700ms) and clean release fade-out (~450ms).
- **Phrase Scheduler Protection:** When locked into Pattern 22 in `CINEMATIC_DIRECTIONAL`, bar-by-bar pattern switching is disabled, maintaining a cohesive forward visual composition throughout the passage.

---

### Phase 26 — Spotlight-Synchronized Laser Movement Dynamics, 4-Bar Paced Choreography Gating, and Organic Drum/Kick Heartbeat Pulse

#### Objective & Architectural Motivation
Refactor laser movement dynamics, choreography alteration cadence, and physical acoustic responsiveness so that:
1. **Movement Dynamics Match Spotlights:** Lasers exhibit the identical energy-level movement as the moving-head spotlights surrounding the YouTube iframe screen (`StageLightsEffect.ts`), responding directly to tempo, instrumental presence, bass, and drops.
2. **Paced Mode Alteration (1 Bar of Every 4 Bars):** Eliminate frequent measure-by-measure pattern switching; alter the active laser mode strictly on downbeat Bar 1 of each 4-bar phrase, holding the mode steady through Bars 2, 3, and 4.
3. **5-Tier Acoustic Energy Classification:** Map active Top aperture and Perimeter rigs strictly according to the user-supplied 5-tier acoustic specification (from 1/5 Very low to 5/5 Very high).
4. **Cardiovascular Heartbeat Pulse:** Introduce an organic "lub-dub" double-pulse envelope synchronized to kicks and drums, expanding beam girth and core radiance.

#### Key Architectural Implementations:

##### 1. Spotlight-Synchronized Movement Dynamics (`LaserShowController.ts`)
- Extracted spotlight energy formula from `StageLightsEffect.ts`:
  - Verified tempo speed factor: $\text{verifiedTempoSpeed} = \text{clamp}(\text{BPM} / 128.0, 0.6, 1.8)$.
  - Base spotlight speed: $(0.8 + \text{instStem} \cdot 1.4 + \text{bassStem} \cdot 0.4) \cdot \text{verifiedTempoSpeed}$.
  - Drop / climax surge: $(2.8 + \text{kickStem} \cdot 0.8 + \text{bassStem} \cdot 0.6) \cdot \text{verifiedTempoSpeed}$, up to $3.4$ during peak climax.
  - Multiplied by tier base speed scale ($T1: 0.45, T2: 0.75, T3: 1.15, T4: 1.70, T5: 2.40$) and user routing multiplier.
  - Trajectory tracking agility lerp at $\Delta t \cdot (4.0 + \text{instStem} \cdot 5.0)$, exactly matching the moving-head spotlights surrounding the YouTube iframe.

##### 2. Paced 4-Bar Choreography Scheduling (`LaserShowController.ts`)
- In `advanceChoreographyScheduler`, restricted pattern alteration strictly to:
  $$\text{isPhraseDownbeat} = (\text{barInPhraseCounter} == 1)$$
- On Bar 1, `selectChoreographyForTier` deterministically selects the Top pattern and Perimeter mode for the 4-bar phrase.
- During Bars 2, 3, and 4, the active laser mode is locked steady, eliminating erratic mode hopping while continuous spotlight-synchronized movement develops the phrase.
- Urgent drop impact entrances (`DROP_IMPACT`) retain instantaneous override capability to preserve downbeat impact accuracy.

##### 3. Authoritative 5-Tier Acoustic Classification Table (`laserChoreography.ts`)
- Formalized typed registry `LASER_ENERGY_TIERS` and selector `selectChoreographyForTier`:
  - **Tier 1 (1/5 · Very low, Base Speed 0.45):**
    - Top Rig: `[22]` (`Cinematic Camera-Facing Instrument Drift`)
    - Perimeter Rig: Mode `2` (`Liquid Sky`)
  - **Tier 2 (2/5 · Low, Base Speed 0.75):**
    - Top Rig: `[12]` (`Skyward Crown Fan`)
    - Perimeter Rig: Mode `2` (`Liquid Sky`)
  - **Tier 3 (3/5 · Medium, Base Speed 1.15):**
    - Top Rig: `[7, 11, 15, 20, 18, 3]` (`Scissor Canopy`, `Ocean Scan`, `Sine Wave`, `Starlight Cascade`, `Aerial Grid`, `Skyward Dome`)
    - Perimeter Rig: Mode `1` (`Wide Horizon Fan`)
  - **Tier 4 (4/5 · High, Base Speed 1.70):**
    - Top Rig: `[0, 2, 4, 6, 8, 13, 14, 17, 19]` (`Fly-Through`, `Cathedral Scissor`, `Concentrated Burst`, `360 Rake`, `Helicoid Spiral`, `Plane Slicer`, `Hypercube`, `Prism Split`, `Waterfall & Geyser`)
    - Perimeter Rig: Mode `0` (`Scissor Cross`)
  - **Tier 5 (5/5 · Very high, Base Speed 2.40):**
    - Top Rig: `[9, 1, 5, 10, 16, 21]` (`Full-Window Slashes`, `Orbital Gimbal`, `Vortex Tunnel`, `Radial Starburst`, `Conical Fan`, `Climax Superfan`)
    - Perimeter Rig: Mode `3` (`Drop Frenzy`)

##### 4. Organic Kick / Drum Heartbeat Dual-Pulse Envelope (`ThinLasersEffect.ts` & `LaserBeamsEffect.ts`)
- Cardiovascular "lub-dub" double-pulse generator in `LaserShowController.ts`:
  $$p_{\text{systole}}(t) = \sin\left(\frac{t}{0.09}\pi\right) \cdot 1.0 \quad (0 \le t \le 0.09\text{s})$$
  $$p_{\text{diastole}}(t) = \sin\left(\frac{t - 0.11}{0.13}\pi\right) \cdot 0.55 \quad (0.11 \le t \le 0.24\text{s})$$
- Applied to Top Rig (`ThinLasersEffect.ts`):
  - Arterial beam girth expansion: $\text{beamThickness} \cdot (1.0 + \text{heartbeatPulse} \cdot 0.45)$.
  - Core & sheath luminosity pump: $+\text{heartbeatPulse} \cdot 0.35$ opacity.
- Applied to Perimeter Rig (`LaserBeamsEffect.ts`):
  - Direct consumption of `decision.perimeterMode` from tier table.
  - Volumetric beamScale expansion: $\text{scale} \cdot (1.0 + \text{heartbeatPulse} \cdot 0.40)$.
  - Core line and glow mesh luminosity pulse: $+\text{heartbeatPulse} \cdot 0.35$ opacity.

---

### Phase 27 — Comprehensive Musical Laser Classifier, Single Top-Center Rig & Full-Window Reach

#### Objective & Problem Analysis
1. **Mode Stagnation Resolution:** Previous implementations suffered from artificial verse/intro blackouts and a narrow activation window, causing only 2–3 modes to ever be seen during an entire track.
2. **Uniform Beam Thickness:** Tapered cylinder geometry ($r_{\text{top}} = 0.002, r_{\text{bottom}} = 0.0045$) and call-and-response station dimming caused some beams to appear paper-thin and fade out into sub-pixel rasterization.
3. **End-to-End Window Reach & Clean Origin:** Beams occasionally terminated prematurely or protruded backwards through emitter origins.
4. **Single Top-Center Fixture:** Previous rig featured 3 fixtures (Left, Center, Right); refactored to remove the 2 side fixtures and consolidate all laser beams into a single top-center emitter directly above the YouTube video screen.

#### Architectural Implementations

##### 1. Full 23-Mode Musical & Acoustic Classifier (`laserChoreography.ts` & `LaserShowController.ts`)
Implemented `classifyLaserChoreography(section, features, phraseIndex, trackSeed, currentPatternId, dropConfidence, sectionProgress)` mapping all 23 trajectories across all song sections:
- **Intro & Ambient:** Skyward Crown Fan (`#12`), Cinematic Camera-Facing Drift (`#22`), Skyward Dome (`#3`), Starlight Cascade (`#18`). (Tier 1–2, Perimeter Mode 2).
- **Verse · Calm / Vocal:** Cinematic Camera-Facing Drift (`#22`), Ocean Scan (`#11`), Sine Wave Ribbon (`#15`), Scissor Canopy (`#7`). (Tier 1–2, Perimeter Mode 2).
- **Verse · Active / Groove:** Aerial Crossing Grid (`#20`), Starlight Cascade (`#18`), Cathedral Scissor Matrix (`#2`), Dual Helicoid (`#8`). (Tier 3, Perimeter Mode 1).
- **Buildup · Early Anticipation:** Skyward Crown Fan (`#12`), Prism Split (`#17`), Horizon Rake (`#6`), Skyward Dome (`#3`). (Tier 2–3, Perimeter Mode 2).
- **Buildup · Late Pre-Drop Riser:** Concentrated Stage Burst (`#4`), Waterfall & Geyser (`#19`), Hypercube Cage (`#14`), Multi-Plane Slicer (`#13`), Prism Split (`#17`). (Tier 4, Perimeter Mode 0).
- **Drop · Downbeat Slam / Impact:** Concentrated Stage Burst (`#4`), Fly-Through (`#0`), Full-Window Slashes (`#9`), Radial Starburst (`#10`), Climax Superfan (`#21`). (Tier 5, Perimeter Mode 3).
- **Drop · Heavy Bass / Tech Groove:** Dual Helicoid Spiral (`#8`), Vortex Tunnel (`#5`), Hypercube Cage (`#14`), Multi-Plane Slicer (`#13`), Cathedral Scissor (`#2`). (Tier 4, Perimeter Mode 0).
- **Drop · High-BPM / Euphoria:** Full-Window Slashes (`#9`), 360° Orbital Gimbal (`#1`), Radial Starburst (`#10`), Conical Superfan (`#16`), Climax Superfan (`#21`). (Tier 5, Perimeter Mode 3).
- **Chorus · Uplifting Anthem:** Skyward Dome (`#3`), Scissor Canopy (`#7`), Ocean Scan (`#11`), Conical Superfan (`#16`), Aerial Grid (`#20`). (Tier 3, Perimeter Mode 1).
- **Chorus · Driving Rhythm:** Fly-Through (`#0`), Cathedral Scissor (`#2`), Conical Superfan (`#16`), Dual Helicoid (`#8`), Multi-Plane Slicer (`#13`). (Tier 4, Perimeter Mode 0).
- **Climax · Peak Omnidirectional:** Climax Omnidirectional Superfan (`#21`), 360° Orbital Gimbal (`#1`), Radial Starburst (`#10`), Conical Superfan (`#16`), Full-Window Slashes (`#9`). (Tier 5, Perimeter Mode 3).
- **Breakdown / Bridge:** Cinematic Drift (`#22`), Sine Wave Ribbon (`#15`), Skyward Crown Fan (`#12`), Ocean Scan (`#11`). (Tier 1–2, Perimeter Mode 2).
- **Outro · Horizon Resolution:** Skyward Crown Fan (`#12`), Skyward Dome (`#3`), Cinematic Drift (`#22`). (Tier 1–2, Perimeter Mode 2).

##### 2. Single Top-Center Laser Rig (`ThinLasersEffect.ts`)
- Eliminated Station 0 (Top-Left) and Station 2 (Top-Right).
- Mounted a single authoritative top-center station at:
  $$\mathbf{P}_{\text{emitter}} = (0.0, \text{dims.topY} + 0.55, \text{dims.screenZ} + 0.5)$$
- Consolidates 20 razor-sharp beams radiating symmetrically from the single diode nozzle dot.
- Trajectory evaluation passes authoritative center station index (`stationIdx: 1`), keeping coordinate math centered.

##### 3. Uniform Non-Tapered Beam Thickness (`ThinLasersEffect.ts`)
- Eliminated conical tapering: replaced with constant-radius cylinders:
  - Neon Core: `CORE_RADIUS = 0.024` ($r_{\text{top}} = r_{\text{bottom}} = 0.024\text{m}$).
  - Glow Sheath: `SHEATH_RADIUS = 0.060` ($r_{\text{top}} = r_{\text{bottom}} = 0.060\text{m}$).
  - Atmospheric Halo: `HALO_RADIUS = 0.100` ($r_{\text{top}} = r_{\text{bottom}} = 0.100\text{m}$).
- Removed station call-and-response masking dimming (`stationScale = 1.0` uniformly across all beams).
- All 20 beams receive identical uniform scaling and opacity across the entire show.

##### 4. Origin-Locked Full-Window Reach (`ThinLasersEffect.ts`)
- Geometry translation and rotation:
  $$\text{geo.translate}(0, 0.5, 0) \longrightarrow \text{geo.rotateX}(\pi / 2)$$
  Extends cylinder from $Z=0$ to $Z=1.0$ along local $+Z$ axis.
- Core, sheath, and halo meshes positioned at $(0, 0, 0)$ inside `beam.group` (which is positioned at $\mathbf{P}_{\text{emitter}}$).
- Length scaled to $200.0\text{m}$ (`FULL_WINDOW_BEAM_LENGTH = 200.0`), traversing the arena ceiling, floor, stage, and auditorium completely through and past all viewport boundaries without clipping.

---

### Phase 28 — Complete Laser System Decommission & Dual Corner White Sky Searchlights

#### Objective & Problem Analysis
1. **Total Laser Decommissioning:** Remove all laser engines, 3D laser geometries, procedural laser choreographies, laser color derivation, laser director telemetry, and routing configurations across the entire codebase.
2. **Dual Corner White Stage Spotlights:** Mount two dedicated high-intensity white spotlights flanking the left and right corners of the YouTube stage screen aperture.
3. **Sky-Oriented Pan/Tilt Choreography:** The white spotlights utilize the same tempo-synchronized and stem-responsive movement dynamics as the colouring stage moving heads, but with a strict directional invariant: **never focus in a downward direction or tilt toward the stage floor/bottom**. They function as outdoor arena searchlights / stage sky-cannons throwing 45-meter volumetric beams into the sky, sweeping across Left, Top (sky zenith), and Right.

#### Architectural Implementations

##### 1. Full Laser Architecture Deletion
Cleanly removed all laser-specific files and dependencies:
- Deleted `src/visualizer/effects/ThinLasersEffect.ts`.
- Deleted `src/visualizer/effects/LaserBeamsEffect.ts`.
- Deleted `src/visualizer/effects/laserChoreography.ts`.
- Deleted `src/visualizer/director/LaserShowController.ts`.
- Replaced `laserColorUtils.ts` with `src/visualizer/effects/flashColorUtils.ts` (preserving `resolveFlashPaletteColors` and pure color normalization functions for screen kick flashes without laser dependencies).
- Purged all laser fields from `src/types/index.ts` (`LaserSemanticState`, `LaserShowDecision`, `LaserEnergyTier`, `ColorPalette.laserColor`, `EnabledEffectsConfig.lasers`, `laserDensity`, `laserBeamWidth`, and `laserDecision`).
- Removed laser controls and routing configuration from `RoutingStore.ts` (bumped storage key to `v5` to prevent stale localStorage state).
- Streamlined `ShowDirector.ts` to manage stage lighting and scene progression without laser sub-orchestration.
- Updated `DiagnosticOverlay.tsx` (replaced laser state telemetry with real-time white sky searchlight status) and `RoutingConsole.tsx` (updated Section 4 to White Sky Searchlights & Instrumental Agility).
- Updated `App.tsx` and `StemSeparationLoader.tsx` to remove all laser references.

##### 2. Corner White Sky Searchlights Rig (`StageLightsEffect.ts`)
Integrated two dedicated white searchlight fixtures mounted at the lower stage corners flanking the YouTube aperture:
- **Left Stage Corner:**
  $$\mathbf{P}_{\text{left}} = (\text{dims.leftX} - 0.45, \text{dims.bottomY} + 0.15, \text{dims.screenZ} + 0.55)$$
- **Right Stage Corner:**
  $$\mathbf{P}_{\text{right}} = (\text{dims.rightX} + 0.45, \text{dims.bottomY} + 0.15, \text{dims.screenZ} + 0.55)$$
- **Optics & Beam Geometry:**
  - Metallic chassis cylinder with white lens flare sphere (`0xffffff`, opacity 0.95).
  - 45-meter volumetric beam cone (`skyConeLength = 45.0`, base radius 0.25, aperture radius 2.2) extending along local $+Z$ with additive blending (`THREE.AdditiveBlending`).
  - Responsive beam shaft expansion on sub-bass / kick hits ($1.0 + \text{bassStem} \cdot 0.35$).

##### 3. Upward Sky Sweep Dynamics (Left, Zenith/Top, Right — Never Downward)
- **Tempo & Stem Synchronization:**
  Calculates sweep angular velocity using the exact colouring spotlight speed equation:
  $$\omega_{\text{sweep}} = (0.8 + \text{instStem} \cdot 1.4) \cdot v_{\text{tempo}}$$
  where $v_{\text{tempo}}$ is the verified track tempo factor relative to 128 BPM.
- **Strict Directional Invariant ($Y_{\text{target}} \ge \text{dims.topY} + 4.0$):**
  The target coordinate strictly resides in the upper hemisphere ($Y \in [14.0, 22.0]$), with the base mount at $Y \approx 1.5 - 2.0$. Consequently, the aiming vector always exhibits a steep positive $\Delta Y \ge +12.0\text{m}$.
- **Kinematic Aiming Profiles:**
  - **Left Searchlight:**
    - *Normal Mode:* Sweeps across from left stage flank through the celestial zenith over to the right:
      $$X_t = (\text{dims.leftX} + 2.0) + \sin(t \cdot \omega_{\text{sweep}}) \cdot (\text{dims.halfWidth} + 4.5)$$
      $$Y_t = \max(\text{dims.topY} + 4.0, Y_{\text{sky}} + \cos(t \cdot 0.7 \cdot v_{\text{tempo}}) \cdot 3.0)$$
    - *Drop Mode:* Fast-sweeping zenith scissor sweeps:
      $$X_t = (\text{dims.leftX} \cdot 0.4) + \sin(t \cdot 2.8 \cdot v_{\text{tempo}}) \cdot (\text{dims.halfWidth} + 5.0)$$
      $$Y_t = \max(\text{dims.topY} + 4.0, Y_{\text{sky}} + 2.5 + \cos(t \cdot 2.4 \cdot v_{\text{tempo}}) \cdot 3.5)$$
  - **Right Searchlight:** Symmetrically counter-phased with a $0.65\text{ rad}$ offset, crossing overhead in the sky with the left beam.
- **Smooth Target Tracking:** Lerps smoothly at rate $(4.0 + \text{instStem} \cdot 5.0) \cdot \Delta t$, freezing instantly on pause (`deltaSeconds === 0`).

##### 4. Fixed-Origin Searchlight Architecture, Bass Activation & Kick-Synchronized Blinking (Phase 29)
- **Stationary Chassis & Origin Rig (`fixedBaseMesh` & `headGroup`):**
  - Fixture base chassis (`fixedBaseMesh`) is attached directly to the visualizer root group at $\mathbf{P}_{\text{left}}$ and $\mathbf{P}_{\text{right}}$, remaining strictly stationary with zero runtime translation, rotation, or audio shake.
  - Optical head (`headGroup`) is co-located at $\mathbf{P}_{\text{left}}$ and $\mathbf{P}_{\text{right}}$ with emitter lens and beam cone apex anchored at $(0, 0, 0)$.
  - Look-at orientation tracks dynamic sky targets without applying any positional displacement or audio-reactive shake to the fixture origin.
- **Bass-Presence Activation:**
  - Evaluates track bass energy across stems and spectrum:
    $$\text{effectiveBass} = \max(\text{stems.bass}, \text{features.bass}, \text{features.subBass} \cdot 0.90)$$
  - Activates when $\text{effectiveBass} > 0.08$, smoothly scaling presence to $1.0$ at $\ge 0.30$.
  - Employs an asymmetrical envelope with rapid attack ($\Delta t \cdot 18.0$) on bass arrival and musical release ($\Delta t \cdot 5.0$) on bass exit.
  - When bass presence drops $\le 0.005$, lens and cone materials fade completely to zero opacity (fully OFF during bass-free passages).
- **Synchronous Kick Drum Hit Blinking:**
  - Gated to percussive transient kick hits (`features.isKick` and stem kick spikes).
  - Triggers a precise 130ms concert lighting shutter blink cycle:
    - **Strike Flash ($t \in [0, 35\text{ms}]$):** $2.4\times$ intensity white burst.
    - **Shutter Cut Notch ($t \in [35, 75\text{ms}]$):** Sharp $0.10\times$ notch cut creating an authentic concert shutter blink.
    - **Settle Recovery ($t \in [75, 130\text{ms}]$):** Smooth linear recovery back to steady bass illumination.
- **Beam Shaft Volumetric Expansion:**
  - Shaft width expands subtly ($1.0 + \text{bassFactor} \cdot 0.35$) with an additional $1.15\times$ radial pulse during active kick blink windows, maintaining a fixed cone apex at the spotlight origin.

##### 7. Stage Playlist Drawer, Persistent Song Library & Direct Cached Track Loading (Phase 32)
- **Removal of Redundant Environment Files:**
  - Deleted `.env` and `.env.example` as all YouTube video playback, audio extraction, metadata ingestion, and Demucs neural separation operate 100% locally through `yt-dlp`, `ffmpeg`, YouTube oEmbed, and PyTorch MPS without requiring external API keys.
- **Backend Persistent Playlist Ingestion (`server.py`):**
  - Implemented `GET /api/playlist` endpoint that introspects `.synwave_cache/audio/yt_*.wav` files.
  - Automatically loads or fetches metadata via `.synwave_cache/metadata/meta_yt_{video_id}.json` using YouTube's oEmbed endpoint (with fallback to yt-dlp extracted names and unverified SSL context on macOS).
  - Cross-references cached Demucs neural stems via `demucs_service.get_cached_result(file_hash=unique_id, song_key=canonical_url)` to verify stem availability and detected BPM.
  - Returns a chronological JSON list of all previously processed tracks sorted newest first.
- **Frontend Storage & Sync Service (`youtubeAudioService.ts`):**
  - Defined `PlaylistItem` data contract with video ID, title, artist, duration, thumbnail URL, audio URL, stem availability, and BPM.
  - Created `fetchProcessedPlaylist()` which synchronizes backend `/api/playlist` responses with browser `localStorage` (`synwave_processed_playlist_v1`), ensuring offline resilience.
  - Created `saveTrackToLocalPlaylist()` which appends or updates newly processed tracks immediately upon completion of stage preparation.
- **Floating Header Integration (`Header.tsx`):**
  - Integrated `ListMusic` icon button into the top-right button cluster (`playlist-toggle-btn`), positioned flush alongside Console and Diagnostic HUD toggles.
  - Features a numeric count badge (`playlist-badge-count`) indicating the number of processed tracks available in the library.
  - Tooltip reflects `Stage Playlist (Hotkey: P)` and highlights with neon active state when open.
- **Stage Playlist Drawer Component (`PlaylistDrawer.tsx` & `index.css`):**
  - Premium glassmorphic slide-out panel on the right side of the screen with `backdrop-filter: blur(28px)` and glowing neon borders.
  - Real-time search filter filtering by track title, artist, or YouTube video ID.
  - Rich 16:9 thumbnail preview aperture with duration tag, hover play overlay, and 3-bar animated soundwave equalizer for the active track.
  - Metadata badge tags highlighting `STEMS READY` (cyan), `BPM` (amber), and `FAST LOAD` (emerald).
  - Keyboard shortcuts: `P` / `p` toggles the drawer from anywhere on stage, `Escape` cleanly dismisses it.
- **Sub-10ms Instant Song Loading (`App.tsx`):**
  - Selecting any card in the playlist drawer immediately triggers `handleYouTubeUrlSubmit(item.youtubeUrl)`.
##### 8. Kick-Activated Screen Flash: 1/2 Bar Pure White Anchor & Circular Authentic Palette Washes (Phase 33)
- **Screen Flash Pure Color Isolation:**
  - Removed central white wash/bleed from colored flash frames. Chromatic flashes now execute with 100% pure RGB values directly from the active song/stage palette (`radial-gradient(ellipse at center, rgba(r,g,b,1.0) 0%, rgba(r,g,b,0.95) 40%, rgba(r,g,b,0.82) 80%, rgba(r,g,b,0.70) 100%)`).
  - White flash frames execute as pure, high-impact brilliant white blinders (`rgba(255,255,255,1.0)`).
- **1/2 Bar White Anchor Rule:**
  - Musical half-bar tracking derived from the authoritative beat grid:
    $$\text{halfBarIndex} = \left\lfloor \frac{\text{beatIndex}}{2} \right\rfloor$$
  - Every 1/2 bar boundary (every 2 beats in standard 4/4 meter) resets the half-bar kick counter (`kicksInCurrentHalfBar = 0`).
  - The first kick/drum hit within every 1/2 bar ALWAYS triggers a pure brilliant white flash (`#ffffff`), anchoring the musical rhythm.
- **Circular Palette Color Rotation on Subsequent Kicks:**
  - When more kicks occur within the same 1/2 bar (e.g. 2nd kick in 4-on-the-floor, or rapid drum rolls/fills), each subsequent kick draws from the extracted chromatic palette (`resolvePureChromaticPaletteColors`), advancing the pointer `circularPaletteIndex = (circularPaletteIndex + 1) % palette.length`.
  - When the song advances to the next 1/2 bar, the first kick resets back to white, and subsequent kicks resume the circular rotation, ensuring all extracted palette hues receive balanced visual representation across the show.
- **Uncompromised Kick Transient Reliability:**
  - Eliminated arbitrary threshold filters (`kickVal > 0.13`) that previously caused quiet kicks to drop.
  - Screen flash is reliably triggered on every kick hit (`(features.isKick && !wasKickLastFrame) || isKickTransientRise || (features.isKick && isLockoutCleared)`) with a minimum 80ms refractory period supporting drum rolls up to 750 BPM.
  - Flash opacity scales with kick energy with a solid minimum baseline ($0.50$ to $0.98$), guaranteeing vertical-sync visual feedback on every drum beat.

##### 9. YouTube Iframe Centered 16:9 Caption-Masking Crop Architecture (Phase 34)
- **Empirical YouTube Closed Caption Space Analysis:**
  - YouTube HTML5 player renders closed captions and auto-subtitles inside the dynamically injected container `.caption-window.ytp-caption-window-bottom`.
  - In embedded players where controls are hidden (`controls=0`), the caption window sits with a bottom offset of $12\text{px}$ to $24\text{px}$ ($\sim 2\%$ to $4\%$ of player height).
  - Caption typography defaults to $\sim 3.8\%$ to $4.5\%$ of player height per line, scaling up to $10\% - 11.5\%$ for 2-line captions including line padding and background highlight box.
  - In worst-case conditions (user font magnification of 150% or multi-line roll-up auto-captions), the upper boundary of the caption container reaches between $12\%$ and $14\%$ of player height from the bottom edge.
- **Centered 16:9 Crop Mathematical Formulation:**
  - When scaling an iframe uniformly by factor $S$ within a fixed 16:9 container using `overflow: hidden` and `transform-origin: center center`:
    $$\text{Crop fraction per edge} = \frac{S - 1}{2S}$$
  - For $S = 1.30$, bottom crop is $11.54\%$ (insufficient; 2-line subtitles or magnified text can peek into view).
  - For $S = 1.35$, bottom crop is $12.96\%$ (marginal clearance).
  - For $S = 1.40$, bottom crop is $\frac{0.40}{2.80} = 14.286\%$ ($\approx 14.3\%$).
  - A scale factor of $S = 1.40$ establishes the golden ratio for standard video embeds:
    - Exactly $14.29\%$ is cropped from the bottom, completely masking the subtitle container, closed captions, and bottom player watermarks.
    - Exactly $14.29\%$ is cropped from the top, simultaneously eliminating any embed title bars or channel badges.
    - Exactly $14.29\%$ is cropped from left and right, maintaining an identical horizontal-to-vertical scale ($1.40\times / 1.40\times = 1.0$), ensuring the visible aperture preserves a pristine, non-distorted $16:9$ aspect ratio.
    - Symmetrically centered from $(50\%, 50\%)$, retaining $71.4\%$ of both width and height to safeguard focal concert performance elements, musicians, and stage lighting from being over-cropped.
- **Component & Layout Architecture (`YouTubeStagePlayer.tsx` & `index.css`):**
  - Configured design token `--yt-crop-scale: 1.4;` in `:root`.
  - Introduced `.yt-crop-container` wrapper with `position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: inherit; display: flex; align-items: center; justify-content: center;`.
  - Applied absolute centering and scaling to `.yt-iframe-target, .synwave-youtube-stage-screen iframe`:
    `position: absolute; top: 50%; left: 50%; width: 100% !important; height: 100% !important; transform: translate(-50%, -50%) scale(var(--yt-crop-scale, 1.4)); transform-origin: center center;`.
  - Added ref-backed container recreation (`cropContainerRef`) in `YouTubeStagePlayer.tsx` to automatically re-instantiate `#synwave-yt-iframe-player` in the DOM if a prior `player.destroy()` call removed the node during video switching.
##### 10. High-Fidelity 1K Video Rendering & Strict Authentic Thumbnail Flash Color Isolation (Phase 35)
- **YouTube 1K Resolution Strict Enforcement:**
  - Configured `vq: 'hd1080'` and `suggestedQuality: 'hd1080'` in `playerVars` to signal Full HD preference immediately on iframe instantiation.
  - Initialized `new window.YT.Player` with explicit `width: '100%'` and `height: '100%'` options to prevent YouTube from defaulting to small 640x360 player bounds.
  - Implemented `enforceHighestResolutionTill1K(player)` which introspects `player.getAvailableQualityLevels()`, prioritizing `hd1080` (1080p / 1K) and `hd720` (720p HD), while strictly capping out resolutions $> 1\text{K}$ (e.g. `highres`, 1440p, 4K) to maintain peak GPU efficiency and fluid 60 FPS concert rendering.
  - Utilizes both `player.setPlaybackQuality(best1K)` and `player.setPlaybackQualityRange(best1K, best1K)` to pin down stream quality.
  - Hooked resolution enforcement into `onReady`, `onStateChange` (buffering and playback starts), and `onPlaybackQualityChange` (detecting and pulling back any auto-promoted 1440p/4K streams or unintended downscales).
- **Backend CORS-Free Thumbnail Proxy (`server.py`):**
  - Added `@app.get("/api/thumbnail/{video_id}")` with local disk caching under `.synwave_cache/thumbnails/thumb_{video_id}.jpg`.
  - Multi-source fallback pipeline inspecting `i.ytimg.com` and `img.youtube.com` across `maxresdefault`, `hqdefault`, and `mqdefault`.
  - Delivers YouTube video thumbnails with permissive `Access-Control-Allow-Origin: *` headers, completely eliminating browser canvas CORS tainted errors and `SecurityError` exceptions during pixel sampling.
- **Strict Authentic Thumbnail Color Extraction (`thumbnailColorService.ts`):**
  - Completely purged hardcoded synthetic fallback colors (`#ffaa00` orange, `#ff3c00` red, `#00ffcc` teal/green) that previously contaminated monochromatic and blue-dominant video palettes.
  - Implemented Dominant Hue Family Identification (12 buckets of 30° across the 360° color wheel):
    - Any isolated fringe hue representing $< 6\%$ of the chromatic volume (such as tiny watermarks, publisher logos, or compression artifacts) is filtered out.
    - If a video thumbnail is dominated by blue (e.g. 99% blue/cyan content), all non-blue fringe noise is purged, guaranteeing 100% pure blue pixel pools.
  - Implemented 3D Euclidean clustering in normalized RGB space ($r, g, b \in [0, 1]$) with centroid averaging and saturation weighting.
  - Accurately captures distinct shades within the same color family (e.g. dark navy blue, deep royal blue, vibrant sky blue, electric cyan) instead of discarding similar hues.
  - Generates luminous stage-emissive hexes (`stageHex`) boosting luminance for deep shades (e.g. navy and cobalt) while strictly preserving authentic hue and chromatic balance so screen blinders flash with vibrant festival luminescence.
- **Dedicated Screen Flash Thumbnail Color Isolation (`flashColorUtils.ts` & `VisualEngine.ts`):**
  - Introduced dedicated `thumbnailFlashColors` state in `VisualEngine.ts`, completely decoupling the screen flash system from the procedural 3D scene `activePalette`.
  - Overhauled `resolvePureChromaticPaletteColors`: strictly prioritizes `spotlightColors` extracted from the video thumbnail. If no chromatic swatches exist, returns an empty array `[]`.
  - Screen flashes strictly alternate between pure white (`#ffffff`) on the downbeat of every 1/2 bar, and the authentic thumbnail colors (e.g. 2–3 shades of blue) on subsequent kicks.
  - If a video has not yet loaded its thumbnail, or if the thumbnail is monochromatic, `getPurePaletteColors()` strictly returns `[]`, causing the flash system to flash pure white (`#ffffff`) on all kicks with zero synthetic green, red, or violet bleeding.
  - In `App.tsx`, `loadTrack` immediately resets `visualEngine.setSongPalette(null)` on track change so previous songs' colors never bleed into newly selected tracks, and immediately re-applies `track.extractedColors` if cached.

##### 11. Spotlight Movement & Pre-Analysis Dynamics (Phase 36)
- **Iterative Peak-of-Peaks (IPOP) Pre-Analysis on Instrument STEM:**
  - Implemented an algorithm to pre-analyze the separated instrument STEM amplitude envelope for each song:
    $$\text{Global Maximum } A_{\text{max}} = \max_{0 \le t \le T} A_{\text{inst}}(t)$$
    $$\text{Stop Threshold } \theta_{\text{stop}} = 0.52 \cdot A_{\text{max}}$$
  - In each iteration, the peak amplitude within the remaining envelope is located at timestamp $t_{\text{peak}}$. A segment $[t_{\text{peak}} - T_w, t_{\text{peak}} + T_w]$ (where half-window $T_w = 1.8\text{s}$) is carved out, recorded with normalized intensity, and zeroed out from the working buffer until remaining peaks fall below $\theta_{\text{stop}}$.
  - Adjacent and overlapping windows within $\Delta t \le 0.15\text{s}$ are merged into contiguous IPOP instrument peak segments.
  - **Strict Segment Gating:** The moving head spotlights framing the YouTube iframe screen (`this.fixtures`) and the dual white bottom sky spotlights (`whiteSkySpotlights`) turn **ON exclusively during these IPOP segments** (`effectiveInstActivation <= 0.01` deactivates lens and volumetric cone opacity to 0).
  - Wired directly from `App.tsx` and `VisualEngine.ts` via `context.demucsStems`, fingerprinted per track to eliminate redundant re-computation.
- **20–85 Hz Sub-Bass Frequency Analysis on BASS STEM:**
  - Formulated a targeted sub-bass frequency analysis pipeline (`analyzeBassStemFrequency`):
    - Calibrated frequency bounds for modern EDM: $\text{SUB\_BASS\_FREQ\_MIN} = 20\text{Hz}$, $\text{SUB\_BASS\_FREQ\_MAX} = 85\text{Hz}$.
    - At $44,100\text{Hz}$ with FFT size 2048 (bin resolution $\approx 21.53\text{Hz}$), bins 1 to 4 span $21.5\text{Hz}$ to $86.1\text{Hz}$, capturing fundamental sub frequencies (808s, synthesized sub bass, and drop rumbles).
    - Detects dominant sub-bass frequency $f_{\text{peak}} = \text{argmax}(\text{FFT}_{1..4}) \cdot 21.53\text{Hz}$ and tests inclusion in $[20\text{Hz}, 85\text{Hz}]$.
    - Couples spectral sub energy with the separated Demucs BASS STEM amplitude:
      $$E_{\text{sub}} = 0.55 \cdot E_{\text{FFT}} + 0.45 \cdot \text{stem}_{\text{bass}}$$
    - Activates continuous 360° rotation gate whenever $E_{\text{sub}} \ge 0.18$ and frequency is within the calibrated range.
- **Continuous 360° Conical Rotation:**
  - When the sub-bass gate triggers, spotlights around the YouTube iframe screen (`this.fixtures`) transition from melodic sine sweeps to continuous 360° conical rotations around their forward projection vector:
    $$x_{\text{target}} = x_{\text{slot}} + \sin(\theta_{\text{rot}}) \cdot R_x, \quad y_{\text{target}} = y_0 + \cos(\theta_{\text{rot}}) \cdot R_y, \quad z_{\text{target}} = z_0 + \sin(2\theta_{\text{rot}}) \cdot R_z$$
  - Angle $\theta_{\text{rot}}$ advances monotonically without reversing:
    $$\frac{d\theta_{\text{rot}}}{dt} = (1.0 + 6.5 \cdot \text{subBassExcess}) \cdot \omega_{\text{mult}}$$
- **Dual White Bottom Spotlights with Strictly Upward Projection:**
  - Mounted at bottom left and right stage corners flanking the YouTube player aperture.
  - Follow identical IPOP instrument peak gating, 360° sub-bass rotation, and kick drum sync.
  - **Strict Upward Constraint:** Target elevation is clamped strictly to $Y \ge \text{topY} + 4.0\text{m}$ (into the open sky/zenith). During 360° rotation, the beam sweeps in the horizontal sky plane $(X, Z)$ overhead, projecting strictly upward and never pointing downwards.
- **Complete Kick Drum STEM Synchronization:**
  - Kick hits directly from the separated Kick STEM drive punchy, synchronous glow bursts across both colouring spotlights and sky searchlights without dark shutter dropouts:
    $$\text{kickGlowFactor} = 1.0 + 1.5 \cdot \text{kickStem} + \text{transientBurst}$$
  - Lens and volumetric beam opacity scale proportionally with kick drum strikes, widening beam cone geometry during impactful transients.

---

## 6. Current Implementation State & Quality Verification

- **TypeScript Compilation:** `npm run build` compiles with **0 errors** (`tsc -b && vite build`).
- **Linter Status:** `npm run lint` passes cleanly with **0 errors** across all files.
- **Unified Dev Runner:** Single-command execution via `./start.sh` or `npm start` orchestrating both FastAPI microservice (`server.py`) and Vite frontend with clean signal handling.
- **Vite Development Server:** Ready for launch at `http://localhost:5173/`.
- **Audio Intelligence Microservice:** Unified Python backend (`server.py`) running on port 8765 with canonical single-file caching and alias indexing under `.synwave_cache/audio` (`yt_*.wav`), `.synwave_cache/stems` (`stems_yt_*.json`), `.synwave_cache/metadata` (`meta_yt_*.json`), and `.synwave_cache/thumbnails` (`thumb_*.jpg`).
- **Spotlight Movement & Pre-Analysis Dynamics (Phase 36):**
  - Iterative Peak-of-Peaks (IPOP) pre-analysis on instrument STEM amplitude envelope turning on spotlights strictly during peak segments.
  - 20–85 Hz sub-bass frequency analysis on BASS STEM driving continuous 360° rotation around forward axes.
  - Dual white bottom stage spotlights following the same logics with strictly upward sky projection ($Y \ge \text{topY} + 4.0\text{m}$).
  - Kick STEM synchronization dynamically scaling spotlight glow intensity on every kick transient without shutter dropouts.
- **High-Fidelity 1K Video Rendering & Strict Thumbnail Flash Colors (Phase 35):**
  - YouTube iframe locked to highest resolution up to 1K (`hd1080` / `hd720`), capping out $> 1\text{K}$ streams.
  - Screen flash strictly constrained to authentic thumbnail colors (e.g. shades of blue) + pure white downbeats (`#ffffff`), with 0 synthetic green, red, or violet bleeding.
  - Backend CORS thumbnail proxy under `/api/thumbnail/{video_id}` guarantees 100% reliable canvas sampling.
- **YouTube Iframe Centered 16:9 Caption Masking (Phase 34):**
  - Standard 16:9 centered crop scaled at $1.40\times$ cleanly pushing bottom captions, subtitles, and watermarks out of frame.
  - Zero distortion across all YouTube resolutions (360p, 720p, 1080p, 4K) and aspect ratios (16:9 native, 21:9 anamorphic, 4:3 pillarbox).
  - Defensively maintains DOM element nodes across video transitions and synchronizes with kick stage shake.
- **Kick Screen Flash Mechanics (Phase 33):**
  - Pure white impact on the downbeat kick of every 1/2 bar.
  - Circular chromatic cycling through pure song palette colors for any additional kicks within each 1/2 bar.
  - Reliable kick triggering with 0 dropped hits and no white contamination in color flash frames.
- **Stage Playlist Library (Phase 32):**
  - Persistent playlist accessible via top-right floating header button (`ListMusic`) and `P` hotkey.
  - Auto-populates all processed tracks from both backend cache and local storage.
  - Instant single-click loading into Synwave with zero wait time for pre-cached tracks.
  - `.env` and `.env.example` removed from repository root.
- **YouTube Concert Stage Architecture (Phase 31):**
  - Direct YouTube URL workflow with automatic video ID extraction and stage iframe mounting.
  - Pure uncompressed WAV extraction via `yt-dlp` & `ffmpeg`.
  - Meta Demucs v4 4-stem neural source separation on Apple Silicon MPS verified operational with 25 FPS envelopes and 199+ kick events per track.
  - Dual corner white stage sky spotlights mounted flanking the YouTube screen aperture with stationary chassis/head origins and omnidirectional double-sided $55\text{m}$ volumetric beams.
  - Symmetrical BPM-mapped colouring moving heads (2 to 12 fixtures).
  - 12x 360° continuous rotatable perimeter bass moving heads.
- **Repository Hygiene:** Clean workspace with no stray temporary test scripts (all removed per User Rule 3).




















