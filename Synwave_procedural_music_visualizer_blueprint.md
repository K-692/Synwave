# Open-Source Procedural Music Visualizer — Project Blueprint

> **Working title:** PulseForge (placeholder; choose a final name before publishing)  
> **Status:** Architecture and implementation plan  
> **Primary goal:** Build a cross-platform, open-source desktop application that plays local audio files and creates real-time, genre-agnostic procedural visuals synchronized to each track.  
> **Initial platforms:** macOS, Windows, and Linux  
> **Initial input:** One audio file or a user-selected folder containing multiple audio files  
> **Core principle:** All visuals are generated procedurally—particles, geometry, lasers, light, waves, fluid-like ribbons, shaders, and post-processing. No stock footage or stock-image library is required.

---

## 1. Product vision

The application turns a song into a live audiovisual experience. Users can open one audio file or import a folder of music, navigate between tracks, and watch a visual scene that responds to the music's rhythm, spectral content, energy, and broader structure.

The visualizer should work across genres rather than being tuned only for melodic dubstep. It should adapt its visual vocabulary and intensity to different styles—for example, sparse ambient music, acoustic recordings, hip-hop, rock, orchestral music, techno, drum and bass, and melodic dubstep.

The system should not need to render a complete video before playback. It should pre-analyse audio and prepare a track-specific visual plan in the background, then render the scene in real time during playback. This keeps startup responsive and avoids storing large rendered videos.

### Product goals

- Play a single local audio file or a folder-based music library.
- Provide a track queue/playlist with previous, next, play/pause, seeking, volume, shuffle, and repeat.
- Generate an individual analysis profile and visual plan for every track.
- Pre-process tracks in the background so later songs can start quickly.
- Use a library of at least 100 modular procedural effects over the project's development.
- Combine, sequence, and parameterize effects rather than selecting only one fixed visualizer per song.
- Synchronize visual events to playback time, including when the user seeks or changes tracks.
- Keep audio, analysis, and temporary data local by default.
- Publish source code, build instructions, tests, and clear third-party licensing information.

### Non-goals for the first release

- YouTube or streaming-service downloading.
- Downloading copyrighted music from external URLs.
- Pre-rendering every song to a video file.
- Stock video, stock images, or pre-made visual clips.
- Cloud accounts, cloud processing, or mandatory telemetry.
- A full DAW, audio editor, or general-purpose media library manager.

---

## 2. User experience and workflow

### 2.1 Supported input modes

**Single-file mode**
1. The user selects an audio file.
2. The app validates the format and reads metadata.
3. Analysis begins in the background.
4. Playback can begin as soon as the decoder is ready; analysis continues if necessary.
5. The visualizer uses available live audio features and progressively incorporates the analysis results.
6. The completed track profile is cached locally for faster future playback.

**Folder mode**
1. The user chooses a folder through the native folder picker.
2. The app scans supported audio files recursively only if the user enables recursive scanning; otherwise it scans the selected folder itself.
3. Files are sorted using a predictable default (natural filename order), with optional sorting by title, artist, album, duration, or filename.
4. The user sees a playlist/library view with track title, artist when available, duration, analysis status, and playback status.
5. A background job queue analyses tracks without blocking playback or navigation.
6. The current song plays and visualizes in real time while upcoming tracks are analysed.
7. Selecting another track switches to that track's own analysis profile and visual schedule.
8. If the next track is not fully analysed, it can still play using live analysis and a provisional visual plan.
9. The app stores analysis metadata/cache, not a rendered video, and allows the user to clear the cache.

**Important distinction:** Pre-analysis prepares a timeline of likely beats, sections, energy changes, and visual events. It does **not** need to generate or store all rendered frames in advance. Rendering remains real-time.

### 2.2 Main screen layout

Suggested desktop layout:

- **Top bar:** app name, Open File, Open Folder, settings, cache status.
- **Main canvas:** full-size GPU-rendered visual scene.
- **Track panel:** title, artist, album, duration, current time, analysis progress.
- **Transport controls:** previous, play/pause, next, seek bar, elapsed/remaining time, volume.
- **Playlist/library:** track list, current-track indicator, search/filter, sorting, shuffle and repeat.
- **Visual controls:** effect intensity, motion, colour palette, camera movement, quality preset, auto/manual mode, lock seed, favourite presets.
- **Status area:** decoder status, analysis state, GPU fallback/quality warnings where relevant.

The interface should support keyboard shortcuts and basic accessibility, including visible focus states and labels for controls.

### 2.3 Track navigation and state

Each track is an independent visualisation session. The track record should include a stable identifier, file path, metadata, duration, analysis status, analysis version, and optional user-selected visual preset.

On track change:
1. Stop or fade the old scene according to the transition setting.
2. Cancel or deprioritize analysis tasks that are no longer useful.
3. Load the selected track's cached analysis if valid.
4. Initialize its deterministic visual seed and event schedule.
5. Start playback and reset the visual timeline to the new track's position.
6. Continue analysing the rest of the library in the background.

On seek:
- Seek the audio player first and use the resulting playback time as the source of truth.
- Reconstruct visual state from the track's event timeline at the new time.
- Re-evaluate active effects instead of replaying all previous events.
- Keep visual randomness deterministic for a given track and time range so the same seek position produces a reasonably consistent scene.

---

## 3. Proposed technology stack

The exact stack should be confirmed with a small technical spike before implementation. The following is a practical desktop-first proposal.

| Layer | Recommended technology | Responsibility |
|---|---|---|
| Desktop shell | **Tauri 2** | Native window, folder/file dialogs, app packaging, permissions |
| UI | **React + TypeScript + Vite** | Library, playlist, transport controls, settings |
| Styling | CSS Modules or a lightweight utility CSS system | Responsive desktop UI and themes |
| 3D rendering | **Three.js** | Procedural geometry, particles, camera, materials, scene management |
| Custom GPU effects | GLSL shaders through Three.js; WebGPU only as a later optional path | GPU particles, distortion, glow, procedural fields |
| Audio playback | Web Audio API for decoding/analysis where supported; test a dedicated audio backend if codec or gapless-playback requirements exceed browser support | Playback, timing, gain, analyser nodes |
| Audio decoding | Browser-supported decoders initially; optional bundled decoder such as FFmpeg only after licence, packaging, and security review | Broader format support |
| Audio feature extraction | **Essentia.js** or a comparable maintained audio-analysis library, validated against representative files | Spectral features, onset/beat estimates, segments and descriptors |
| Signal utilities | Web Audio `AnalyserNode`, AudioWorklet where useful | Low-latency live frequency/time-domain data |
| Heavy analysis | Web Workers; Rust worker/backend where profiling proves necessary | Keep UI responsive |
| Native backend | Rust via Tauri commands | File enumeration, safe path handling, job orchestration, cache management |
| Persistent settings | Tauri app-data directory + versioned JSON or SQLite | Preferences, library metadata, analysis index |
| Analysis cache | Versioned binary/JSON files or SQLite, with size limits and invalidation | Store compact features and event maps |
| Testing | Vitest, React Testing Library, Playwright where compatible, Rust unit tests | UI, logic, integration and regression tests |
| Packaging/CI | GitHub Actions and Tauri build tooling | Build and test macOS, Windows, Linux |
| Licensing | MIT or Apache-2.0 for project code, with a third-party notices file | Open-source distribution |

### Why Tauri 2?

A desktop application benefits from native file/folder pickers, filesystem permissions, predictable local storage, and packaged installation. Tauri's Rust backend can safely manage scanning and analysis jobs while the web frontend handles the interactive visual scene. The main risk is not Tauri itself but browser/webview differences in audio codecs, GPU features, and performance, so those must be tested early on all target operating systems.

### Alternative approach

A browser-only PWA can be easier to distribute but has more constraints around folder access, background processing, file lifetime, and consistent desktop behaviour. If the primary goal is a dependable local music player with GPU visuals, start with Tauri and keep the visual engine as independent TypeScript modules.

---

## 4. High-level architecture

```text
                    ┌─────────────────────────────┐
                    │ React + TypeScript UI       │
                    │ Library / Playlist / Player │
                    └──────────────┬──────────────┘
                                   │ commands/events
                    ┌──────────────▼──────────────┐
                    │ Track & Playback Controller │
                    │ queue, seek, repeat, shuffle│
                    └─────────┬───────────┬──────┘
                              │           │
                  audio clock │           │ analysis jobs
                              │           ▼
                    ┌─────────▼───┐  ┌─────────────────────┐
                    │ Audio Engine│  │ Analysis Job Queue  │
                    │ decode/play │  │ priority + workers  │
                    └──────┬─────┘  └──────────┬──────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐  ┌─────────────────────┐
                    │ Live Audio  │  │ Track Feature Store │
                    │ Features    │  │ beats/sections/etc. │
                    └──────┬──────┘  └──────────┬──────────┘
                           └──────────┬─────────┘
                                      ▼
                          ┌────────────────────────┐
                          │ Visual Planning Engine │
                          │ mood + event timeline  │
                          └────────────┬───────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ Effect/Scene Scheduler │
                          │ transitions + blending │
                          └────────────┬───────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ Three.js Renderer      │
                          │ GPU scene + post FX    │
                          └────────────────────────┘
```

### Core design rules

1. **Audio playback time is authoritative.** Do not use accumulated frame delta as the master clock for visual timing.
2. **Analysis is asynchronous.** File scanning, decoding, beat estimation, and cache writes must not block UI or rendering.
3. **The visual engine is source-independent.** It receives a playback clock and audio features; it should not depend on how the audio was selected.
4. **Effects are modular.** Every effect has a common lifecycle and parameter contract.
5. **Use deterministic planning where possible.** Seed choices from a stable track ID plus a saved seed, so track switching and seeking remain predictable.
6. **Gracefully degrade.** If analysis is incomplete or GPU resources are constrained, use live audio features and lower-cost effects.
7. **Bound memory.** Do not decode every file in a large folder into memory at once.

---

## 5. Audio analysis methodology

A good visualiser combines offline/precomputed analysis with live playback analysis.

### 5.1 Two complementary analysis paths

**Offline/pre-analysis path**
- Read or decode a track in chunks.
- Calculate compact audio features over short frames.
- Estimate beat/onset times and tempo candidates.
- Estimate section boundaries or changes in texture/energy.
- Build a compact per-track feature timeline.
- Generate a provisional visual event schedule.
- Save the analysis result in a versioned cache.

**Live playback path**
- Read current frequency/time-domain data from the active audio graph.
- Smooth noisy values and calculate low, mid, high, and broadband energy.
- Detect transients from live features as a fallback.
- Feed current features to the renderer every frame.
- Use offline event maps to anticipate transitions and live data to make effects react to the actual signal.

This hybrid design is more robust than relying only on beat detection or only on a live analyser.

### 5.2 Feature set

Start with features that are useful and inexpensive:

- **RMS/loudness proxy:** short-window signal energy.
- **Spectral energy bands:** bass, low-mid, high-mid, treble; calibrate bands and normalization using test tracks.
- **Spectral centroid:** rough measure of spectral brightness.
- **Spectral flux/onset strength:** changes in spectral energy, useful for transient detection.
- **Beat candidates and tempo:** estimates, not guaranteed ground truth.
- **Beat confidence:** confidence or stability measure when available.
- **Low-frequency transient strength:** useful for kick-like events, but not a universal kick detector.
- **Dynamic range/energy envelope:** helps identify builds and drops.
- **Section/novelty boundaries:** likely intros, breakdowns, choruses, drops, or texture changes, where estimators support them.
- **Stereo width/correlation:** optional feature for spatial effects.
- **Silence and low-activity spans:** useful for ambient music and transitions.

Avoid hard-coding assumptions such as “every strong low-frequency transient is a kick” or “every loud section is a drop.” Different genres and recording styles behave differently.

### 5.3 Windowing and sampling strategy

Use a configurable analysis hop and frame size. A reasonable starting point is:
- Live visual control update: tied to the rendering frame, commonly 30–60 updates/second depending on device.
- Offline feature timeline: approximately 10–25 feature frames/second initially, adjusted after profiling.
- Beat/onset detection: use the analysis library's recommended settings and validate them instead of assuming a single universal window size.

Do not persist raw decoded PCM for every song. Store compact feature arrays, event times, confidence values, and metadata. Decode one track or a bounded number of tracks at a time.

### 5.4 Track-level mood and style inference

Mood and genre should be treated as uncertain estimates, not objective labels. A first release can use transparent rule-based descriptors from measurable features:
- energy: low / medium / high;
- transient density: sparse / moderate / dense;
- spectral brightness: dark / balanced / bright;
- rhythmic regularity: steady / variable / uncertain;
- texture: sparse / layered / dense;
- dynamics: restrained / dynamic / compressed.

These descriptors can drive visual selection without needing a large machine-learning model. Later, an optional classifier can suggest genre/mood labels, but it must be evaluated across diverse genres and must not be a requirement for playback.

### 5.5 Analysis status and recovery

Each track can have these states:

`unscanned → queued → analysing → ready`

Additional states: `partial`, `failed`, `unsupported`, and `stale`. A failed offline analysis must not make a playable file unusable; fall back to live features and show a non-blocking status message.

---

## 6. Visual planning and real-time synchronisation

### 6.1 Do not pre-render video

Pre-compute *events and parameters*, not every frame. For each track, build a timeline containing:
- beat/onset markers and confidence;
- energy and spectral envelopes;
- section/novelty boundaries;
- effect transitions;
- seeded effect selections;
- intensity and colour/motion curves;
- optional manual cue points.

The renderer evaluates this plan against the current audio time. This enables instant seeking and avoids enormous storage requirements.

### 6.2 Visual event scheduling

The planner can use a layered scene model:

1. **Base atmosphere:** a continuous background such as stars, fog, slow geometry, or a procedural colour field.
2. **Rhythmic layer:** pulses, rings, waveforms, particle bursts, or geometry reacting to beat/onset strength.
3. **Energy layer:** larger changes driven by smoothed RMS/energy and spectral bands.
4. **Accent layer:** brief events triggered by strong transients or detected section changes.
5. **Transition layer:** crossfades, camera changes, colour shifts, or shader transitions.

Each layer has a limited number of simultaneous effects and a defined GPU/memory budget. Avoid stacking too many expensive effects at once.

### 6.3 Synchronisation rules

- Use the media/audio playback clock as the authoritative timeline.
- Convert event timestamps to track-relative seconds.
- Keep the render loop independent; on each frame, query the current playback time and evaluate the plan.
- For beat-triggered events, use estimated beat time but let live features adjust the response.
- On pause, freeze time-based scene progression or make it follow a clearly documented pause policy.
- On seek, reconstruct the state at the target time rather than attempting to simulate all missed frames.
- On track change, dispose of old track-specific resources and initialize the new plan.
- Keep visual effects deterministic within a track when practical, using seeded pseudo-random values keyed by track ID, event index, and time segment.

No system can promise perfect synchronisation on every device, codec, and webview. Measure actual audio-to-visual latency, avoid blocking the main thread, and provide a reduced-motion/performance mode.

### 6.4 Smoothness and latency

- Keep UI state updates out of the per-frame rendering loop.
- Use Web Workers for CPU-heavy analysis.
- Reuse geometry, materials, and GPU buffers where possible.
- Avoid allocating large arrays or objects every frame.
- Cap particle counts and post-processing passes on weaker devices.
- Add frame-rate and quality presets.
- Measure frame time and audio/visual response under sustained playback.
- Prefer a responsive approximate plan over delaying playback until every analysis job finishes.

---

## 7. Procedural effect library

The long-term target is at least 100 effects. Treat these as effect families with many parameter presets, not 100 unrelated one-off implementations. Every effect must be genuinely procedural and generated at runtime.

| Family | Initial target count | Example effect concepts |
|---|---:|---|
| Particles and physics | 15 | orbiting dust, trails, swarms, gravity wells, burst clouds |
| Lasers and light beams | 12 | crossing beams, scanning planes, radial rays, volumetric-looking shafts |
| Shockwaves and energy bursts | 10 | expanding rings, layered pulses, distortion ripples |
| Procedural geometry | 12 | rotating polyhedra, instanced grids, wireframe structures, fractal-like forms |
| Ribbons and fluid-like motion | 10 | flowing ribbons, curl-noise trails, oscillating surfaces |
| Waveforms and frequency forms | 10 | circular waveform, spectrogram-inspired terrain, radial spectrum bars |
| Fog and atmospheric light | 8 | procedural fog, drifting nebula fields, light shafts |
| Cosmic and spatial fields | 8 | star tunnels, galaxy spirals, orbital systems |
| Glitch and distortion | 7 | scanline distortion, chromatic offsets, digital breakup |
| Shader transitions and post-processing | 8 | bloom-like glow, feedback-inspired trails, colour grading, displacement |
| **Total target** | **100** | |

This is a planning allocation, not a claim that the effects already exist. Build a smaller polished subset first, then grow the catalogue.

### 7.1 Common effect interface

Every effect should declare:
- stable effect ID and version;
- family and tags;
- GPU/CPU cost tier;
- required features (beat, bass, RMS, section markers, etc.);
- parameter schema with safe min/max values;
- initialization, update, render, resize, and disposal hooks;
- deterministic seed support;
- reduced-motion and low-quality behaviour;
- test or demo scene.

Illustrative TypeScript contract:

```ts
export interface AudioFeatures {
  timeSeconds: number;
  rms: number;
  bass: number;
  lowMid: number;
  highMid: number;
  treble: number;
  spectralCentroid: number;
  onsetStrength: number;
  beatPhase?: number;
  beatConfidence?: number;
}

export interface VisualEffectContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  features: AudioFeatures;
  deltaSeconds: number;
  trackTimeSeconds: number;
  seed: number;
  quality: "low" | "medium" | "high";
}

export interface VisualEffect {
  readonly id: string;
  readonly version: number;
  readonly tags: string[];
  readonly cost: "low" | "medium" | "high";
  initialize(context: VisualEffectContext): void;
  update(context: VisualEffectContext): void;
  setIntensity(value: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

The exact interface may change as the renderer is implemented. Keep the contract small and stable, and avoid giving every effect direct access to global application state.

### 7.2 Selecting and blending effects

The planner should score candidate effects using:
- estimated energy and dynamics;
- transient density and beat confidence;
- spectral brightness;
- section/novelty changes;
- user preferences and pinned effects;
- effect compatibility and visual diversity;
- device quality budget;
- recent effect history, to reduce repetition.

Use weighted selection with constraints, not unconstrained randomness. For example, a high-energy section may favour fast particles, sharp geometry, and brief bursts; a quiet ambient section may favour slow ribbons, fog, and gradual colour changes. These are tendencies, not rigid genre rules.

### 7.3 Visual coherence

To avoid a random screensaver:
- Define a track-wide palette and a small number of visual motifs.
- Limit simultaneous high-cost effects.
- Use crossfades or parameter interpolation instead of abrupt unrelated switches.
- Keep a minimum duration for major scenes and a cooldown for repeated accent effects.
- Allow users to lock a palette, family, seed, or preset.
- Save optional per-track overrides without modifying the source audio.

---

## 8. Playback, playlist, and library behaviour

### 8.1 Playback controls

Required:
- play/pause;
- previous/next;
- seek slider with elapsed and total time;
- volume and mute;
- shuffle;
- repeat off / repeat-one / repeat-all;
- keyboard shortcuts;
- clear indication of the currently selected and currently playing track.

Optional later:
- gapless playback;
- crossfade;
- queue editing;
- bookmarks/cue points;
- favourites and custom playlists.

### 8.2 File support

Start with formats reliably supported by the chosen playback stack on all target platforms, such as WAV, MP3, and common AAC/M4A variants where supported. FLAC and Ogg Vorbis may require explicit validation or a bundled decoder depending on the platform/webview. Show unsupported or corrupted files clearly rather than silently skipping them.

Do not promise universal codec support until the packaged app is tested on macOS, Windows, and Linux. If FFmpeg or another decoder is bundled, review the exact build configuration, licensing obligations, redistribution terms, and security update process before shipping it.

### 8.3 Metadata and ordering

Read available metadata such as title, artist, album, track number, duration, and embedded cover art if present. Embedded cover art may be displayed as optional player metadata, but it must not be used as the visualizer's effect source. The visual scene itself remains procedural.

Default folder order should be predictable and stable. Provide natural filename sorting and optional metadata sorting. Detect duplicate paths, inaccessible files, and files that disappear after import.

### 8.4 Folder access and rescanning

- Use a native folder picker.
- Ask for only the access needed to the selected folder.
- Keep the imported library as a user-visible collection, not a hidden full-disk scan.
- Provide Rescan Folder and Remove Folder actions.
- Handle renamed, moved, deleted, or inaccessible files gracefully.
- Do not follow symbolic links recursively by default; if supported, make the behaviour explicit and protect against loops.
- Avoid silently importing files outside the selected directory.

---

## 9. Caching, storage, and privacy

### 9.1 What to store

Store only what materially improves usability:
- library entries and file metadata;
- compact audio feature timelines;
- beat/onset and section event times;
- generated visual event plans;
- user settings and presets;
- cache version and analysis-library version.

Do not store complete rendered videos. Avoid retaining full decoded PCM after analysis unless there is a clear, measured need.

### 9.2 Cache design

Use a versioned cache key based on a stable file identity, such as canonical path plus file size and modification time. A content hash is more reliable for detecting replacement but can be expensive for large libraries; consider hashing asynchronously or using a hybrid strategy. Do not assume path alone identifies unchanged audio.

Invalidate cached analysis when:
- file identity changes;
- analysis schema changes;
- feature-extraction settings change;
- the analysis library/version changes in a way that affects output.

Use a configurable cache-size limit and a clear-cache action. Rebuild missing or stale entries automatically in the background.

### 9.3 Temporary files and cleanup

Prefer in-memory playback and analysis buffers when practical. If temporary decoded files are required:
- place them in the application's designated temporary directory;
- use unpredictable names and restrictive permissions;
- delete them when no longer needed, on track replacement where safe, and on normal app shutdown;
- perform conservative startup cleanup for leftovers from crashes;
- never delete files in the user's music folder;
- make cache and temporary-data locations transparent.

The analysis cache is not the same as temporary audio data: the user may choose to keep compact analysis results to speed up future sessions. Clearly distinguish **analysis cache** from **temporary audio buffers/files** in settings.

### 9.4 Privacy principles

- No audio upload or cloud analysis by default.
- No account requirement.
- No telemetry by default; if telemetry is ever introduced, make it opt-in and document exactly what is sent.
- Never modify or delete original music files.
- Explain which local metadata and analysis results are saved.
- Provide actions to clear the analysis cache and remove a library entry.

---

## 10. Suggested repository structure

```text
pulseforge/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── library/
│       │   │   ├── playlist/
│       │   │   ├── playback/
│       │   │   ├── visualizer/
│       │   │   └── settings/
│       │   ├── hooks/
│       │   ├── styles/
│       │   └── main.tsx
│       └── src-tauri/
│           ├── src/
│           ├── capabilities/
│           └── tauri.conf.json
├── packages/
│   ├── audio-engine/
│   ├── audio-analysis/
│   ├── visual-planner/
│   ├── visual-engine/
│   ├── effect-sdk/
│   ├── effects/
│   │   ├── particles/
│   │   ├── geometry/
│   │   ├── light/
│   │   ├── waves/
│   │   └── postprocessing/
│   ├── shared-types/
│   └── test-audio-fixtures/
├── docs/
│   ├── architecture.md
│   ├── effect-authoring.md
│   ├── audio-analysis.md
│   ├── privacy.md
│   └── release-process.md
├── scripts/
├── tests/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── README.md
└── package.json
```

This is a suggested monorepo layout, not a requirement to create every directory on day one. Start simple and split packages when boundaries become useful.

---

## 11. Data models

Illustrative TypeScript types:

```ts
export type AnalysisStatus =
  | "unscanned"
  | "queued"
  | "analysing"
  | "partial"
  | "ready"
  | "failed"
  | "unsupported"
  | "stale";

export interface TrackRecord {
  id: string;
  path: string;
  fileName: string;
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  sizeBytes: number;
  modifiedAtMs: number;
  analysisStatus: AnalysisStatus;
  analysisVersion?: number;
  cacheKey?: string;
  userPresetId?: string;
}

export interface FeatureFrame {
  timeSeconds: number;
  rms: number;
  bass: number;
  lowMid: number;
  highMid: number;
  treble: number;
  spectralCentroid: number;
  onsetStrength: number;
}

export interface TimedEvent {
  timeSeconds: number;
  type: "beat" | "onset" | "section" | "accent" | "transition";
  confidence?: number;
  payload?: Record<string, number | string | boolean>;
}

export interface TrackAnalysis {
  schemaVersion: number;
  analysisEngineVersion: string;
  trackId: string;
  durationSeconds: number;
  frameHopSeconds: number;
  features: FeatureFrame[];
  events: TimedEvent[];
  descriptors: {
    energy: "low" | "medium" | "high" | "unknown";
    brightness: "dark" | "balanced" | "bright" | "unknown";
    transientDensity: "sparse" | "moderate" | "dense" | "unknown";
    rhythmicRegularity: "steady" | "variable" | "uncertain";
  };
}
```

For large libraries, avoid keeping every `FeatureFrame[]` resident in memory. Load the current track and a small look-ahead window; keep other analyses on disk or in a bounded cache.

---

## 12. Background job scheduling

Analysis should be prioritised so the current user action remains responsive.

Suggested priority order:
1. Analyse the currently playing/selected track if its analysis is missing or stale.
2. Analyse the next track in the playback queue.
3. Analyse a few upcoming tracks.
4. Analyse remaining folder items in the background.
5. Revisit failed jobs only when the user requests retry or after a relevant configuration change.

Job rules:
- Limit concurrent decodes to avoid memory spikes.
- Make jobs cancellable.
- Report progress per track and overall.
- Persist completed results atomically to avoid corrupt cache files.
- Use a bounded retry policy.
- If the app closes, completed cache entries remain valid; unfinished jobs can be resumed later.
- Avoid doing expensive full-track analysis repeatedly when a valid cache exists.

A folder containing hundreds of songs should remain navigable even while analysis continues. Scanning and analysis progress should never block play/pause, seeking, track selection, or window resizing.

---

## 13. Performance and quality strategy

### Initial performance targets

Treat these as targets to measure, not guarantees:
- 60 FPS on capable desktop GPUs at a normal desktop resolution, with a 30 FPS fallback.
- No long UI stalls during folder scanning or analysis.
- Responsive playback controls while background work runs.
- Fast switching to an already-analysed track.
- A low-quality mode for integrated GPUs and battery-powered devices.
- Bounded memory use with large libraries.

### Performance tiers

**Low**
- reduced particle counts;
- simple materials;
- fewer post-processing passes;
- limited simultaneous effects;
- lower internal render resolution if necessary.

**Medium**
- moderate particles and geometry;
- selected post-processing;
- multiple visual layers.

**High**
- denser particle fields;
- more complex shaders;
- more post-processing and richer geometry.

Add an automatic quality mode that uses measured frame time and adjusts quality gradually. Avoid changing visual quality abruptly on every short frame-rate fluctuation.

### Profiling checklist

Measure:
- cold start and library scan time;
- time to first audio;
- time to first responsive visual;
- CPU and memory during analysis;
- GPU frame time;
- audio-to-visual reaction latency;
- seek reconstruction time;
- track-switch time;
- behaviour during long sessions;
- behaviour with a very large folder;
- behaviour when the GPU context is lost or the audio device changes.

---

## 14. Testing and evaluation

### 14.1 Test corpus

Create or obtain a legally usable test set representing different sound profiles:
- ambient/drone with sparse transients;
- acoustic/vocal music;
- hip-hop with strong rhythmic pulses;
- rock with dense drums and guitars;
- orchestral/cinematic material;
- house/techno with regular beats;
- drum and bass with fast transients;
- melodic dubstep with large dynamic changes;
- quiet, noisy, clipped, and low-bitrate recordings;
- mono and stereo files;
- very short clips and long tracks.

Use self-created, public-domain, Creative Commons, or otherwise properly licensed audio. Record attribution and licence requirements for every test asset. Do not commit commercial music into the repository without permission.

### 14.2 Automated tests

- Feature extraction returns finite, bounded values for supported files.
- Beat/onset times are sorted and fall within track duration.
- Cache invalidation works after a file changes.
- Seeking to a given time reconstructs the expected visual-plan state.
- Deterministic seed tests produce stable planning results.
- Track switching disposes of old GPU resources.
- Unsupported/corrupt files fail gracefully.
- Job cancellation does not leave partial cache entries marked as complete.
- Folder scanning does not escape the selected folder.
- Cache cleanup never touches source music files.

### 14.3 Human evaluation

Ask testers to rate:
- perceived synchronisation;
- visual variety;
- coherence across a whole track;
- whether changes feel musically meaningful;
- whether the same effects repeat too often;
- visual comfort and motion intensity;
- playback reliability.

Evaluate both beat-heavy and beat-light music. A visualizer that works only for strongly rhythmic electronic music is not genre-agnostic.

### 14.4 Metrics

Useful engineering metrics:
- percentage of playback time with stable frame rate;
- median and high-percentile frame time;
- audio-to-visual reaction latency;
- analysis throughput (track minutes analysed per wall-clock minute);
- cache hit rate;
- time from track selection to audible playback;
- memory use by library size;
- crash/error rate across supported platforms.

For subjective quality, report user-study methodology and sample size rather than presenting personal impressions as objective performance scores.

---

## 15. Security, permissions, and robustness

- Treat filenames and metadata as untrusted input.
- Do not execute content from audio metadata or user-provided effect presets.
- Validate and clamp all effect parameters.
- Avoid loading arbitrary shader source from unknown plugins in the first release.
- If third-party effects are supported later, define a sandboxing and review model; a plugin running inside the renderer can potentially execute code.
- Use narrow Tauri capabilities and explicit command allowlists.
- Validate paths in Rust and avoid arbitrary filesystem operations from the frontend.
- Handle malformed files defensively; keep decoders and dependencies patched.
- Provide a security contact and responsible-disclosure policy.
- Never remove or overwrite original audio files.

---

## 16. Open-source strategy

### Licence

Choose one main licence:
- **MIT:** simple and permissive, often suitable for a community visualizer.
- **Apache-2.0:** also permissive and includes explicit patent-related provisions.

Before release, review the licences of all dependencies, audio decoders, shaders, fonts, icons, and sample audio. Keep a `THIRD_PARTY_NOTICES.md` file. Do not assume that an open-source licence for the application grants rights to distribute music files.

### Contribution model

- Write a clear README with screenshots or a short demo made from properly licensed audio.
- Publish architecture and effect-authoring documentation.
- Add an issue template for bugs and feature requests.
- Add a pull-request template and contribution guide.
- Label beginner-friendly issues.
- Require tests or a reproducible demo for new effect families.
- Include code formatting, linting, and CI checks.
- Keep effect IDs stable and version parameter schemas when they change.
- Provide a short contributor guide for creating a new effect.

### Potential differentiators

Existing visualizers already offer real-time audio-reactive graphics, so differentiation should come from the complete experience:
- track-specific pre-analysis and visual event planning;
- a large modular procedural effect catalogue;
- coherent multi-layer effect selection rather than random switching;
- deterministic seeking and track-specific scenes;
- folder-level library navigation and background analysis;
- local-first operation and transparent cache management;
- an approachable effect SDK for community contributions.

---

## 17. Implementation roadmap

### Phase 0 — Technical spike

**Goal:** Verify that the chosen desktop stack can play local audio and render reactive graphics reliably.

Tasks:
- Create a minimal Tauri 2 + React + TypeScript application.
- Open one WAV or MP3 file.
- Connect playback to a Web Audio analysis path.
- Render one Three.js scene with a waveform or particle system.
- Verify play/pause, seek, and track-time synchronisation.
- Test on at least one machine per target OS as early as possible.
- Measure codec support, audio routing, and GPU performance.

**Exit criteria:** A single local track plays and drives a stable visual scene without blocking the UI.

### Phase 1 — Minimal playable MVP

- Open one file.
- Basic metadata and playback controls.
- One scene with a small set of procedural effects.
- Live RMS and frequency-band response.
- Pause, seek, resize, and disposal handling.
- Basic settings and quality control.

**Exit criteria:** The app is usable for one track and handles common playback actions reliably.

### Phase 2 — Folder library and playlist

- Native folder picker and file scanner.
- Stable track IDs and natural sorting.
- Playlist view, search, previous/next, shuffle, repeat.
- Per-track loading and error states.
- Bounded resource management and safe folder rescanning.

**Exit criteria:** A folder of many tracks can be navigated while playback remains responsive.

### Phase 3 — Background analysis and cache

- Analysis job queue and Web Worker integration.
- Per-track features, beat/onset estimates, and section/novelty markers.
- Versioned cache and invalidation.
- Current-track and next-track prioritisation.
- Partial-analysis fallback to live features.
- Cache clearing and progress indicators.

**Exit criteria:** Folder analysis continues in the background; revisiting a track reuses valid cached analysis.

### Phase 4 — Visual planning engine

- Per-track event timeline.
- Layered scene planner.
- Deterministic random seeds.
- Seek reconstruction and track-specific presets.
- Smooth effect transitions and cooldowns.
- Initial mood/energy/texture descriptors.

**Exit criteria:** The same track has a coherent visual arc and can seek without losing synchronisation.

### Phase 5 — Effect catalogue expansion

- Establish the effect SDK and visual test harness.
- Implement and document an initial set of 15–25 polished effects.
- Add parameter presets and quality tiers.
- Expand toward 100 effects with tests and documentation.
- Add palette consistency and diversity constraints.

**Exit criteria:** Effects are reusable, performant, documented, and visually coherent when combined.

### Phase 6 — Hardening and public beta

- Cross-platform packaging and CI.
- Large-library, long-session, and corrupted-file tests.
- Accessibility and reduced-motion options.
- Privacy/security review and dependency licence audit.
- Documentation, demo, issue templates, and release notes.
- Public beta with a small group of testers.

**Exit criteria:** Reproducible builds, clear known limitations, and no known data-loss issues.

### Phase 7 — Later enhancements

Only after the core is stable:
- gapless playback and crossfade;
- more advanced genre/mood models;
- custom visual presets and user-defined cue points;
- optional audio-reactive recording/export, if required;
- additional decoder formats after licensing and platform validation;
- a reviewed third-party effect/plugin system.

---

## 18. MVP acceptance checklist

The first public MVP should meet these requirements:

- [ ] User can open one supported local audio file.
- [ ] User can select a folder and build a playlist of supported files.
- [ ] User can move between songs using previous/next and playlist selection.
- [ ] Playback supports play/pause, seeking, volume, shuffle, and repeat.
- [ ] Every track has its own analysis record and visual plan.
- [ ] Analysis runs in the background and does not freeze the interface.
- [ ] Unanalysed tracks remain playable through live-analysis fallback.
- [ ] Seeking reconstructs the visual state for the new playback position.
- [ ] Visuals are generated procedurally; no stock footage is needed.
- [ ] Effect count can grow through a documented modular interface.
- [ ] Temporary files, if used, are cleaned safely; originals are never modified.
- [ ] Analysis cache is versioned, bounded, and clearable.
- [ ] App functions offline after installation for local files.
- [ ] Supported formats and platform limitations are documented.
- [ ] Third-party dependencies and sample assets have documented licences.
- [ ] CI runs automated tests and builds supported desktop targets.

---

## 19. Main risks and mitigations

| Risk | Mitigation |
|---|---|
| Beat estimates are wrong on some genres | Combine offline estimates with live features; treat confidence as data; never make beat detection mandatory |
| Large folders create memory pressure | Decode a bounded number of tracks; persist compact features; use a bounded in-memory cache |
| Webview codec differences | Test packaged builds early; document supported formats; add a reviewed decoder only if necessary |
| GPU overload from too many effects | Effect cost tiers, concurrency limits, automatic quality, profiling |
| Visuals feel random rather than musical | Track-wide palette, scene motifs, transition rules, cooldowns, user controls |
| Seeking causes visual discontinuity | Timeline-based evaluation and deterministic seeds |
| Analysis blocks playback | Workers, cancellable jobs, prioritised scheduling, live fallback |
| Dependency licensing complicates release | Licence audit, third-party notices, review bundled codecs |
| Crash leaves temporary data | Startup cleanup of app-owned temporary files and atomic cache writes |
| Genre bias | Diverse test corpus and human evaluation across sparse and dense music |

---

## 20. Decisions to settle before serious implementation

1. **Project name and licence:** choose a non-conflicting name and MIT or Apache-2.0.
2. **Platform scope:** desktop-first (recommended) versus browser-first.
3. **Minimum supported audio formats:** define from real packaged-build tests.
4. **Playback backend:** confirm Web Audio/browser media playback meets the desired format and gapless requirements.
5. **Analysis library:** benchmark Essentia.js or alternatives on representative music and platforms.
6. **Minimum hardware target:** define resolution, FPS target, and integrated-GPU support.
7. **Cache policy:** default cache size, expiry behaviour, and user-facing controls.
8. **Visual direction:** define a few visual design principles and coherent palette rules before adding dozens of effects.
9. **Effect contribution contract:** settle lifecycle, parameter validation, quality tiers, and versioning before community contributions.
10. **Release process:** CI matrix, signing/notarisation expectations, dependency update policy, and security reporting.

---

## 21. Recommended first development sprint

Keep the first sprint narrow. Do not attempt to build 100 effects, advanced AI mood detection, and a complete library manager simultaneously.

1. Scaffold Tauri 2 + React + TypeScript.
2. Add a native file picker and load one supported audio file.
3. Build a small audio engine with play/pause, current time, duration, and seeking.
4. Connect audio analysis to a Three.js scene.
5. Implement three effects: a reactive waveform, a particle field, and a beat/onset pulse.
6. Confirm seeking and track switching do not desynchronise the visual scene.
7. Add a basic test track set with proper licences.
8. Profile the application before selecting more complex shaders or adding a large effect catalogue.

Once this works reliably, add folder scanning, playlist navigation, background analysis, and the persistent per-track visual plan.

---

## 22. Final recommendation

Build the project as a **local-first, desktop application with a real-time rendering engine and a background per-track analysis pipeline**. Treat each song as its own session with cached feature data and a deterministic visual timeline. Pre-analysis should make transitions and later playback smarter, but it should never be a prerequisite for starting a song. Render visuals live, keep the user in control of playback and quality, and expand the effect catalogue only after the core engine is stable.

The strongest first milestone is not “100 effects”; it is **one local song that plays smoothly, responds convincingly to the audio, survives seeking, and can be switched without glitches**. That foundation will make the folder workflow and the larger procedural effect library much easier to build well.
