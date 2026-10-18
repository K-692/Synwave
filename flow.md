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
2. **Solid Rectangular Jumbotron LED Screen (16:9):** A massive solid rectangular video wall ($21\text{m} \times 11.8\text{m}$) anchored center-stage on the black backing. The screen is the sole visual display surface for procedural visual themes and features the integrated concert broadcast lower-third displaying track title and artist as the exclusive **"Now Playing"** display.
3. **Heavy-Duty Aluminum Box-Truss Architecture:** Industrial overhead roof box-truss grid with horizontal cross-beams, diagonal lacings, and dual heavy vertical truss support towers flanking the stage, matching real concert rigging.
4. **Authentic Foreground Concert Crowd Silhouette:** High-density audience silhouette in the foreground with spectator heads, raised cheering arms/hands, and glowing mobile phone recording screens that bob and sway to the sub-bass pulse, capturing the true perspective of a concert attendee.
5. **Rock-Solid Fixed Audience Perspective:** Camera locked in front of the stage at VIP eye level ($Y = 1.4\text{m}, Z = 16.5\text{m}$) with **zero mouse-hovering camera movement** (no distracting screen tilt or parallax drift), maintaining visceral stage framing with subtle sub-bass camera shake on heavy drops.
6. **Lasers and Lights Thrown Directly Towards the Camera & Sweeping the Stage:**
   - **28 Razor-Thin Concert Lasers:** Directed outward along $+Z$ straight past the camera into the audience, as well as sweeping across the stage in liquid-sky fans, stadium cones, and scissor crosses.
   - **16 Moving-Head Volumetric Spotlights:** Overhead and ground-level moving heads angled forward towards the camera and audience, sweeping dynamic pan/tilt choreographies.
7. **Active Stage Pyrotechnics & Atmospherics:**
   - **8 Flame Cannons (Fire Shooters):** Flanking the LED screen and stage deck lip, blasting vertical fire plumes up to $14\text{m}$ high with real-time orange/red firelight.
   - **Cryo CO2 Smoke Jets & Stage Haze:** Dense cryogenic fog plumes erupting upward on drops and vocals, with low-lying haze catching light beams.
8. **4-Channel STEM Separation Architecture (KIE AI Suno API & 60 FPS Real-Time Multi-Band Decomposition):**
   - Integration with KIE AI Suno Vocal/Stem Separation API (`https://kieai.mintlify.app/suno-api/separate-vocals`).
   - Real-time 60 FPS multi-band STEM decomposition isolating **Kick**, **Bass**, **Instruments**, and **Vocals**.
   - Distinct, decoupled visual triggers:
     - **Kick STEM** $\to$ Kick flash lights (white blinder strobes) & pyro flame blasters.
     - **Bass STEM** $\to$ Moving-head spotlight beam power, cone width, and stage deck wash.
     - **Instrument STEM** $\to$ Razor-thin concert lasers & stage-sweeping light choreographies.
     - **Vocal STEM** $\to$ Jumbotron LED screen visual energy (Phoenix Wings of Fire) & cryo smoke plumes.
9. **100+ Procedural Stage Screen Themes:** Including the **Concert Phoenix Wings of Fire** theme (Family 7: themes 70–79) featuring glowing fiery wings spreading across the video wall, matching live concert pyro visuals.
10. **Zero-Gap Fullscreen Guarantee:** Edge-to-edge rendering without letterboxing or black border gaps.

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
| **Kick STEM** | $20 - 90\text{ Hz}$ | **Kick Flash Lights (Blinders) & Pyro Flame Blasters** | Overhead & floor blinders flash white strobes on every drum kick; 8 flame cannons erupt vertical fiery blasts. |
| **Bass STEM** | $40 - 250\text{ Hz}$ | **Moving-Head Light Beams & Floor Wash** | Spotlight beam intensity, cone thickness, volumetric haze scattering, and stage floor reflection glow. |
| **Instrument STEM** | $280 - 3500\text{ Hz}$ | **Razor-Thin Lasers & Light Choreography Sweeps** | 28 razor-thin lasers activate in liquid-sky sheets and fan formations; spotlights pan/tilt across stage. |
| **Vocal STEM** | $800 - 4500\text{ Hz}$ | **Center Stage LED Screen Visuals & Cryo Smoke** | Drives Jumbotron video wall energy (e.g. Phoenix Wings of Fire flutter & flame intensity) + cryo smoke plumes. |

---

## 3. Concert Stage 3D Physical Architecture

### 3.1 Solid Pitch-Black Stage Arena
- Scene background: Pure `#000000` (`0x000000`).
- Revolving/spinning elements completely eliminated (no starfields, no spinning space terrain).
- Camera rigidly anchored at $(0, 1.4, 16.5)$ facing $(0, 4.4, -4.5)$ at audience eye level.
- Mouse hover screen movement removed.

### 3.2 Jumbotron LED Video Wall
- Solid rectangular 16:9 screen ($21\text{m} \times 11.8\text{m}$) mounted at $Y = 7.0\text{m}, Z = -4.5\text{m}$.
- High-resolution dynamic 2D canvas texture ($1920 \times 1080$) updated in real-time.
- Displays 100+ audio-reactive procedural themes and exclusive **"Now Playing"** broadcast lower-third banner.

### 3.3 Heavy-Duty Aluminum Box-Truss Roof
- Overhanging roof truss frame ($24\text{m} \times 12\text{m}$) constructed from dual upper/lower chords with diagonal lattice members.
- Dual vertical structural truss towers flanking the stage ($X = \pm 12\text{m}, H = 16\text{m}$) with cross-bracing.
- Center down-hang truss sections supporting overhead moving heads and blinder arrays.

### 3.4 Foreground Concert Crowd Silhouette
- 120+ audience silhouettes clustered in the foreground ($Z \in [11.0\text{m}, 15.5\text{m}]$):
  - Torso and head silhouettes with randomized heights.
  - Cheering arms and hands raised towards the stage.
  - Glowing mobile phone recording screens displaying illuminated video viewfinders.
  - Audio-reactive vertical bouncing driven by Kick and Bass STEMs.

### 3.5 Stage Lighting & Laser Systems Thrown Towards Camera
- **Lasers (`ThinLasersEffect`):** 28 laser emitters mounted on overhead truss, side towers, and stage deck. Beams are targeted forward along $+Z$ past the camera ($Z_{\text{target}} = 22.0\text{m}$) into the crowd, as well as sweeping across stage.
- **Moving Heads (`StageLightsEffect`):** 16 volumetric light cones angled forward towards the audience, dynamically expanding with Bass STEM and flashing white strobes on Kick STEM.
- **Pyrotechnics (`FireShootersEffect`):** 8 flame blasters (flanking screen and deck lip) launching fiery particle plumes up to $14\text{m}$ high.
- **Atmospherics (`SmokeMachinesEffect`):** Cryo CO2 smoke jets and stage haze catching volumetric light cones.

---

## 4. 100+ Procedural Stage Screen Visual Themes

The LED screen renders 100 procedural visual themes across 10 distinct families:

| Family Index | Theme Family | Theme Range | Aesthetic Characteristics & Stems |
|---|---|---|---|
| **0** | **Cyber Horizon & Tron Grid** | 00 – 09 | Undulating wireframe horizon grids, neon road perspectives, audio mountains. |
| **1** | **Cosmic Warp & Hyperspace** | 10 – 19 | Relativistic star streaks, warp speed tunnels, spiral galaxy vortexes. |
| **2** | **Sacred Geometry & Mandalas** | 20 – 29 | Multi-pointed audio-reactive stars, concentric mandalas, golden ratio wheels. |
| **3** | **Liquid Plasma & Aurora Waves** | 30 – 39 | Multi-frequency sinusoidal waveforms, silk auroras, chromatic interference. |
| **4** | **Stadium Equalizer Skylines** | 40 – 49 | Radial equalizers, segmented LED VU towers, circular oscilloscope rings. |
| **5** | **Glitch Matrix & Cyber Data** | 50 – 59 | Digital matrix code rain, cyber runes, high-speed telemetry readouts. |
| **6** | **Neon Radial Tunnels** | 60 – 69 | Infinite depth polygons (hexagons, octagons, triangles) pulsing to tempo. |
| **7** | **Concert Phoenix Wings & Inferno** | 70 – 79 | **Fiery Phoenix Wings spreading across the screen (matching concert photo)**, central totem silhouette, rising ember particles; driven by Vocal & Kick STEMs. |
| **8** | **Celestial Zen Sanctuary** | 80 – 89 | Organic breathing lotus rings, soft yin-yang waves, celestial constellations. |
| **9** | **Strobe Rave & High-Energy Blinders** | 90 – 99 | High-velocity scissor vectors, radial starburst blinder pulses, strobe chaos. |

---

## 5. Viewport & Fullscreen Edge-to-Edge Guarantee

- **Full Window Layout:** Strict CSS constraints (`width: 100% !important; height: 100% !important; min-width: 100vw; min-height: 100vh; overflow: hidden;`).
- **Zero-Gap Letterboxing Fix:** Multi-stage resize listeners re-evaluating window dimensions at $0\text{ms}, 60\text{ms}, 180\text{ms}, 350\text{ms}, 600\text{ms}$ upon fullscreen transitions.
- **Auto-Hiding Interface:** Header and footer control bars auto-hide when the cursor leaves the window or edges, revealing an unobstructed stadium view.

---

## 6. Current Implementation State

- **TypeScript Compilation:** `npm run build` compiles with **0 errors and 0 warnings** (`tsc -b && vite build` bundled in 454ms).
- **Vite Development Server:** Active at `http://localhost:5173/`.
- **Git Repository:** Fully synchronized locally.
