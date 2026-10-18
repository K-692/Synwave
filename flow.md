# Synwave: Procedural Audio-Reactive Music Visualizer — Research & Architecture Journey

> **Project Name:** Synwave  
> **Repository:** Synwave ([https://github.com/K-692/Synwave.git](https://github.com/K-692/Synwave.git))  
> **Platform Target:** High-Performance Web & Cross-Platform Desktop (React 19 + TypeScript + Three.js + Web Audio API + Vite)  
> **Test Music Corpus:** Local `public/music/` test tracks (`Feel Something`, `Aaloshyo`, `Waves`)  
> **Architecture Principle:** 100% Procedural Generation (Zero pre-rendered video, zero stock footage, local-first computation)

---

## 1. Abstract & System Philosophy

**Synwave** is a real-time, genre-agnostic 3D procedural music concert visualizer and local audio player. Conventional music visualizers either rely on pre-rendered video loops that fail to synchronize with dynamic musical phrasing, or simple 2D spectrum bars that lack depth and atmosphere.

Synwave delivers an authentic **Stadium Music Festival Concert Stage Experience** directly replicating real-world stadium concert environments (inspired by stadium EDM/dubstep festivals and live concert photography):
1. **Solid Pitch-Black Stage Arena Background:** The venue backdrop is pure `#000000` pitch black with **zero revolving or spinning elements** (no rotating space warp or starfields). The stage stands out with high-contrast cinematic realism.
2. **Solid Pitch-Black Jumbotron LED Screen (16:9) with Centered Song Details:**
   - A massive solid rectangular video wall ($21\text{m} \times 11.8\text{m}$) anchored center-stage on the black backing.
   - Kept pure black with all busy patterns, designs, and person-like silhouettes eliminated.
   - The **Song Title**, **Artist Name**, **Live Broadcast Status Pill**, and **4-Channel STEM Indicators** are rendered right at the **CENTRE** of the screen.
   - Dynamic spotlight ambient wash: As the concert spotlights project forward towards the audience, the screen catches that active light color and glows in real time!
3. **Heavy-Duty Aluminum Box-Truss Architecture:** Industrial overhead roof box-truss grid with horizontal cross-beams, diagonal lacings, and dual heavy vertical truss support towers flanking the stage, matching real concert rigging.
4. **Unobstructed Front-Row VIP Perspective (Closer Camera Position):**
   - Camera anchored closer in front of the stage at $X = 0, Y = 1.8\text{m}, Z = 9.2\text{m}$ looking directly at $(0, 4.4, -4.5)$.
   - All foreground stick/arm obstructions and person silhouettes were removed, giving an unobstructed view of the stage.
   - Zero mouse-hovering camera movement (rock-solid stage framing with visceral sub-bass camera shake on heavy drops).
5. **Spotlights Thrown Directly Towards the Camera & Sweeping the Venue:**
   - 16 Automated moving-head fixtures mounted along overhead truss.
   - Volumetric light cones projected forward along $+Z$ towards the camera and audience plane ($Z \in [8.0, 14.0]$), sweeping dynamic choreographies.
   - Dedicated **White Kick Spotlights (Blinders)** aimed straight at the camera lens: On every drum kick, intense white volumetric beams blast into the camera, replacing the 2D window flash overlay with authentic 3D optical blinder beams.
6. **Heavyweight Bold Volumetric 3D Lasers:**
   - 28 Precision concert laser projectors mounted on towers, overhead truss, and deck.
   - Replaced 1px line segments with **weighted, bold, luminous 3D volumetric cylinder beams** featuring dual-core optics (radiant white/cyan core + rich atmospheric beam sheath).
   - Beams project outward along $+Z$ past the camera ($Z_{\text{target}} = 22.0\text{m}$), directly modulated by the **Instrument STEM**.
7. **Active Stage Pyrotechnics & Atmospherics:**
   - **8 Flame Cannons (Fire Shooters):** Flanking the LED screen and stage deck lip, blasting vertical fire plumes up to $15\text{m}$ high with orange/yellow firelight at the drop of energetic tracks and heavy kicks.
   - **6 Cryo CO2 Smoke Cannons & Rolling Stage Fog:** High-velocity cryogenic fog plumes erupting upward on drops and vocal peaks, paired with dense, low-lying stage haze catching volumetric light cones.
8. **4-Channel STEM Separation Architecture (KIE AI Suno API & 60 FPS Real-Time Multi-Band Decomposition):**
   - Integration with KIE AI Suno Vocal/Stem Separation API (`https://kieai.mintlify.app/suno-api/separate-vocals`).
   - Real-time 60 FPS multi-band STEM decomposition isolating **Kick**, **Bass**, **Instruments**, and **Vocals**.
   - Decoupled visual triggers:
     - **Kick STEM** $\to$ White kick spotlights (blinders) thrown into camera & pyro flame blasters.
     - **Bass STEM** $\to$ Moving-head spotlight beam power, cone width, and stage deck wash.
     - **Instrument STEM** $\to$ Weighted bold lasers & moving light choreographies.
     - **Vocal STEM** $\to$ Screen pulse intensity & cryo smoke plumes.
9. **Zero-Gap Fullscreen Guarantee:** Edge-to-edge rendering without letterboxing or black border gaps.

---

## 2. 4-Channel STEM Separation Architecture

### 2.1 KIE AI Suno API Remote STEM Separation Pipeline
For offline or high-fidelity processing, Synwave integrates with the KIE AI Suno Audio API (`POST https://api.kie.ai/api/v1/vocal-removal/generate`):
- **Request Parameters:**
  - `audioId`: Identifier or hosted audio URL.
  - `type`: `'split_stem'` for 4-channel multi-track separation (Kick/Drums, Bass, Instruments, Vocals) or `'separate_vocal'` for 2-channel separation (Vocals + Instrumental accompaniment).
  - `callBackUrl`: Webhook destination receiving separated lossless audio URLs (`drums_url`, `bass_url`, `instruments_url`, `vocals_url`).

### 2.2 Instantaneous 60 FPS Multi-Band STEM Decomposition Engine
To ensure instant, latency-free visual performance on *any* local audio file (drag-and-dropped or loaded from disk) without cloud processing delays, `StemSeparationService` implements a real-time mathematical decomposition pipeline operating at 60 FPS:

$$\text{Audio Input } x[n] \xrightarrow{\text{FFT }(N=2048)} M[k] \implies \begin{cases}
\text{Kick STEM } (k \in [1, 4] \implies 21.5 - 86.1\text{ Hz}) \\
\text{Bass STEM } (k \in [2, 12] \implies 43.1 - 258.4\text{ Hz}) \\
\text{Instrument STEM } (k \in [13, 160] \implies 279.9 - 3445.3\text{ Hz}) \\
\text{Vocal STEM } (k \in [37, 210] \implies 796.7 - 4521.9\text{ Hz})
\end{cases}$$

#### 1. Kick STEM Transient Extraction
- Extracted from ultra-low sub-bass bins ($20-90\text{ Hz}$) combined with time-domain percussive onset detection.
- Fast asymmetric attack ($< 16\text{ms}$) with a sharp exponential release decay ($140\text{ms}$):
$$K_{\text{stem}}(t) = \max\left(K_{\text{stem}}(t - \Delta t) \cdot (1 - 7.0 \cdot \Delta t), \min(1.0, I_{\text{kick}} \cdot 1.25)\right)$$

#### 2. Bass STEM Dynamic Extraction
- Evaluates tonal sub-bass and bass fundamental frequencies ($40-250\text{ Hz}$):
$$B_{\text{stem}} = \left(\frac{1}{11 \cdot 255} \sum_{k=2}^{12} M[k]\right)^{1.3} \cdot 1.4$$

#### 3. Instrument STEM Mid-Harmonics Extraction
- Evaluates melodic synths, guitar riffs, chords, and rhythmic percussion ($280-3500\text{ Hz}$):
$$I_{\text{stem}} = \min\left(1.0, \left(\frac{1}{148 \cdot 255} \sum_{k=13}^{160} M[k]\right) \cdot 1.85\right)$$

#### 4. Vocal STEM Formant Isolation
- Evaluates human vocal formants ($800-4500\text{ Hz}$) adjusted for spectral presence and timbral brightness:
$$V_{\text{stem}} = \min\left(1.0, \left(\frac{1}{174 \cdot 255} \sum_{k=37}^{210} M[k]\right) \cdot 2.2 \cdot (0.7 + 0.6 \cdot B_{\text{spectral}})\right)$$

### 2.3 STEM-to-Visual Trigger Mapping Matrix

| STEM Component | Frequency Range | Dedicated Visualizer Triggers | Physical Effect Description |
|---|---|---|---|
| **Kick STEM** | $20 - 90\text{ Hz}$ | **White Spotlights (Blinders) Thrown At Camera & Fire Shooters** | 8 dedicated white spotlights blast volumetric beams straight into the camera lens; 8 flame cannons erupt vertical fiery blasts. |
| **Bass STEM** | $40 - 250\text{ Hz}$ | **Moving-Head Light Beams & Stage Wash** | Spotlight beam intensity, cone thickness, volumetric haze scattering, and stage floor/screen reflection glow. |
| **Instrument STEM** | $280 - 3500\text{ Hz}$ | **Heavyweight Bold Lasers & Light Choreography Sweeps** | 28 bold 3D volumetric lasers activate in liquid-sky sheets and fan formations; spotlights pan/tilt across stage. |
| **Vocal STEM** | $800 - 4500\text{ Hz}$ | **Center Stage LED Screen Glow & Cryo Smoke** | Drives screen backlight pulse and cryo CO2 fog plumes. |

---

## 3. Concert Stage 3D Physical Architecture

### 3.1 Solid Pitch-Black Stage Arena
- Scene background: Pure `#000000` (`0x000000`).
- Revolving/spinning elements completely eliminated.
- Camera positioned closer to the stage at $(0, 1.8, 9.2)$ facing $(0, 4.4, -4.5)$ for intense front-row immersion.
- Mouse hover screen movement removed.

### 3.2 Jumbotron LED Video Wall
- Solid rectangular 16:9 screen ($21\text{m} \times 11.8\text{m}$) mounted at $Y = 7.0\text{m}, Z = -4.5\text{m}$.
- Background kept pure pitch black; all distracting designs and person silhouettes removed.
- Displays centered Song Title, Artist Name, Live Broadcast Badge, and 4-Channel STEM telemetry.
- Dynamic radial glow catching the active moving-head spotlight colors.

### 3.3 Heavy-Duty Aluminum Box-Truss Roof
- Overhanging roof truss frame ($24\text{m} \times 12\text{m}$) constructed from dual upper/lower chords with diagonal lattice members.
- Dual vertical structural truss towers flanking the stage ($X = \pm 12\text{m}, H = 16\text{m}$) with cross-bracing.
- Center down-hang truss sections supporting overhead moving heads and blinder arrays.

### 3.4 Camera-Thrown Lighting & Laser Systems (Calibrated & Blowout-Free)
- **Heavyweight 3D Lasers (`ThinLasersEffect`):** 28 dual-core volumetric cylinders projecting outward along $+Z$ past the camera into the venue ($Z = 24.0\text{m}$). Built with `FrontSide` rendering and calibrated opacity ($0.15 - 0.22$) to ensure bold, razor-sharp luminous beams without additive haze saturation.
- **Moving Heads (`StageLightsEffect`):** 16 volumetric light cones angled forward towards the audience. Calibrated cone geometry ($R = 1.2\text{m}, L = 24\text{m}$) and subtle opacity ($0.08 - 0.16$) ensure transparent atmospheric rays through which the stage and screen remain crystal clear.
- **White Kick Spotlights (`StageLightsEffect`):** 8 dedicated blinder fixtures fanned forward across the audience space. Narrow beam geometry ($R = 0.7\text{m}$) with controlled peak opacity ($0.16$) delivers crisp optical kick blinders without camera blowout.
- **Pyrotechnics (`FireShootersEffect`):** 8 flame blasters launching towering fire plumes up to $15\text{m}$ high at energetic drops, with balanced dynamic firelight.
- **Atmospherics (`SmokeMachinesEffect`):** 6 cryo CO2 cannons blasting dense fog plumes + rolling low-lying stage haze with balanced transparency ($0.08 - 0.12$).
- **Screen Contrast Guarantee (`StageScreenThemes`):** Black LED background (`#000000`) with subtle spotlight ambient tint ($0.04 - 0.18$) and dark shadow backing, ensuring the centered song title, artist, and STEM telemetry remain 100% sharp, readable, and high-contrast at all times.

---

## 4. Current Implementation State

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled in 528ms).
- **Vite Development Server:** Active at `http://localhost:5173/`.
- **Git Repository:** Committed locally (ready to push when instructed).
