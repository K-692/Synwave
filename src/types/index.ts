/**
 * Synwave Core Type Definitions
 * Contracts for Audio Processing, Visual Effects, Analysis, and UI State.
 */

import * as THREE from 'three';

export type AnalysisStatus =
  | 'unscanned'
  | 'queued'
  | 'analysing'
  | 'partial'
  | 'ready'
  | 'failed';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type DirectorMode = 'auto' | 'manual';

export type RepeatMode = 'off' | 'one' | 'all';

export interface ColorPalette {
  id: string;
  name: string;
  primary: string;       // Primary neon accent (e.g. #00f0ff cyan)
  secondary: string;     // Secondary neon accent (e.g. #ff007f magenta)
  accent: string;        // Highlight accent (e.g. #ffe600 yellow/gold)
  background: string;    // Deep dark background (e.g. #050711)
  glow: string;          // Emissive glow color
  ambientColor: string;  // Scene ambient lighting
  spotlightColors?: string[]; // Per-spotlight fixture assignments
  rawSwatches?: string[];     // Authentic unmapped song swatches for dynamic palette derivation
}

export interface ExtractedStageColors {
  primary: string;
  secondary: string;
  accent: string;
  spotlightColors: string[];
}

export type MusicMood =
  | 'euphoric-drop'
  | 'chill-ambient'
  | 'retro-groove'
  | 'dark-aggressive'
  | 'uplifting-melodic'
  | 'deep-hypnotic';

export interface AudioStems {
  kick: number;        // 0.0 to 1.0 (Kick transient & punch -> triggers kick flash lights & flame blasters)
  bass: number;        // 0.0 to 1.0 (Sub-bass & bass notes -> triggers moving head stage lights & floor wash)
  instruments: number; // 0.0 to 1.0 (Synths, guitars, keys, melodies -> triggers stage spotlights & sweeps)
  vocals: number;      // 0.0 to 1.0 (Vocal formants & upper harmonics -> triggers stage screen visuals & smoke)
}

export interface AudioFeatures {
  timeSeconds: number;
  rms: number;               // 0.0 to 1.0 (signal loudness proxy)
  bass: number;              // 0.0 to 1.0 (sub-bass + bass: 20-250 Hz)
  subBass: number;           // 0.0 to 1.0 (sub-bass punch: 20-100 Hz)
  lowMid: number;            // 0.0 to 1.0 (250-500 Hz)
  highMid: number;           // 0.0 to 1.0 (500-2000 Hz)
  treble: number;            // 0.0 to 1.0 (2000-16000 Hz)
  spectralCentroid: number;  // 0.0 to 1.0 (spectral brightness indicator)
  onsetStrength: number;     // 0.0 to 1.0 (energy flux transient)
  beatConfidence: number;    // 0.0 to 1.0
  isBeat: boolean;           // True on transient beat spike
  isKick: boolean;           // True specifically on heavy drum kick transient
  kickIntensity: number;     // 0.0 to 1.0 (intensity of the drum kick hit)
  isDrop: boolean;           // True during massive festival drop climax
  dropIntensity: number;     // 0.0 to 1.0 (drop climax intensity)
  musicMode: 'calm' | 'festival'; // Detected music style: calm acoustic vs festival dubstep
  mood: MusicMood;           // Detailed Librosa-inspired mood classification
  stems: AudioStems;         // 4-stem separated real-time signals: Kick, Bass, Instruments, Vocals
  instrumentalActivity?: number; // Pre-processed instrumental activity & transient speed (0.0 to 1.0)
  globalIntensity?: number;      // Pre-processed overall track acoustic energy (0.0 to 1.0)
  estimatedBpm: number;      // Current tempo / BPM (or fallback)
  bpmSource?: 'demucs' | 'manual' | 'unavailable'; // Strict provenance of tempo value
  bpmConfidence?: number;    // 0.0 to 1.0 confidence in tempo value
  beatIndex: number;         // Monotonic beat counter
  barIndex: number;          // Bar index (1 to 4/8 in current phrase)
  beatPhase: number;         // 0.0 to 1.0 within active beat
  isBar: boolean;            // True on downbeat (every 4 beats)
  isPhrase: boolean;         // True on phrase boundary (every 8/16 beats)
  frequencyData: Uint8Array; // Raw FFT bins (0-255)
  timeDomainData: Uint8Array;// Raw PCM waveform samples (0-255)
  isAboveAverageAmplitude?: boolean; // True when current playback amplitude exceeds full-track average
  isTriStemDropActive?: boolean;     // True when kick, bass, and instruments simultaneously exceed their track-wide averages in peak drop segments
  trackAverageAmplitude?: number;    // Pre-calculated full-track average reference
  currentAmplitude?: number;         // Current playback RMS amplitude
  lowFreqDistribution?: number;      // Ratio of sub-bass vs upper bass energy (0.0 to 1.0)
  midRangeEnergy?: number;           // 0.0 to 1.0 (250 Hz to 4 kHz mid-range instrumental energy)
  midSpectralCentroid?: number;      // 0.0 to 1.0 (mid-range spectral brightness/center)
  midSpectralFlux?: number;          // 0.0 to 1.0 (mid-range spectral flux / note attack rate)
  midEnergyDistribution?: number;    // 0.0 to 1.0 (ratio of upper-mid vs lower-mid energy)
  midSpectralContour?: number;       // 0.0 to 1.0 (weighted, temporally smoothed spectral contour in 250 Hz - 4 kHz)
  midContourTrend?: number;          // -1.0 to +1.0 (smoothed contour movement: positive rising, negative falling)
}

export type ShowSection = 'intro' | 'verse' | 'buildup' | 'drop' | 'breakdown' | 'outro';
export type StageProfile = 'festival-mainstage';

export interface EnabledEffectsConfig {
  lights: boolean;
}

export interface AudioVisualRoutingConfig {
  kickSensitivity: number;              // 0.2 to 2.0 (default 1.0)
  spotlightShakeIntensity?: number;     // Optional alias
  screenShakeIntensity: number;         // 0.0 to 2.5 (YouTube screen kick displacement)
  screenFlashIntensity: number;         // 0.0 to 2.0 (default 1.0)
  screenFlashColorSaturation: number;   // 0.0 to 2.0 (default 1.0, blends thumbnail colors on bass)
  bassToBeamIntensity: number;          // 0.2 to 2.0 (default 1.0)
  perimeterBassRotationSpeed: number;   // 0.2 to 3.0 (default 1.0, 360-degree rotation)
  instrumentalMovementSpeed: number;    // 0.2 to 2.5 (default 1.0, stage lighting sweep speed)
  vocalToScreenGlow: number;            // 0.2 to 2.0 (default 1.0)
  spotlightCount: number;               // 1 to 8 (active/target count, default 3)
  minSpotlightCount?: number;           // 1 to 4 (default 1 at BPM <= 70)
  maxSpotlightCount?: number;           // 4 to 8 (default 7 at BPM >= 160)
  autoBpmSpotlightSpawning?: boolean;   // Automatically map track BPM to spotlight count (default true)
  spotlightIntensity: number;           // 0.5 to 2.5 (default 1.3)
  effectDecay: number;                  // 0.5 to 2.0 (default 1.0)
  cameraShakeStrength: number;          // Legacy alias
  reducedFlash: boolean;                // true/false
  maxBrightnessLimit: number;           // 0.3 to 1.0 (default 1.0)
  enabledEffects: EnabledEffectsConfig;
}

export interface BeatGridState {
  bpm: number;
  bpmSource?: 'demucs' | 'manual' | 'unavailable';
  beatIndex: number;
  barIndex: number;
  beatPhase: number;
  isBeat: boolean;
  isBar: boolean;
  isPhrase: boolean;
  confidence: number;
}

export interface ShowDirectorState {
  currentSection: ShowSection;
  sectionProgress: number; // 0.0 to 1.0
  activeProfile: StageProfile;
  choreographyPattern: string;
  allowedEffects: EnabledEffectsConfig;
  intensityMultiplier: number;
  beatGrid: BeatGridState;
  spotlightCount?: number;
}

export interface KieStemSeparationRequest {
  taskId?: string;
  audioId?: string;
  type?: 'separate_vocal' | 'split_stem';
  callBackUrl?: string;
}

export interface KieStemSeparationResponse {
  code: number;
  msg: string;
  data?: {
    task_id?: string;
    vocal_separation_info?: {
      vocal_url?: string;
      instrumental_url?: string;
      drums_url?: string;
      bass_url?: string;
      guitar_url?: string;
      keyboard_url?: string;
      synth_url?: string;
      percussion_url?: string;
      fx_url?: string;
    };
  };
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

export type SectionType = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro';

export interface SectionEvent {
  startTime: number;
  endTime: number;
  type: SectionType;
  label: string;
  energyLevel: number; // 0 to 1
}

export interface TimedEvent {
  timeSeconds: number;
  type: 'beat' | 'onset' | 'section' | 'accent' | 'drop';
  confidence: number;
  label?: string;
}

export interface SpotlightAnalysisData {
  fps: number;
  durationSeconds: number;
  frameCount: number;
  instMinFreq: number;
  instMaxFreq: number;
  instAvgFreq: number;
  bassMinFreq: number;
  bassMaxFreq: number;
  bassAvgFreq: number;
  timestampsMs: number[];
  instFrequencies: number[];
  bassFrequencies: number[];
  movementAnglesDeg: number[];
  bassAnglesDeg?: number[];
  glowingFactors: number[];
  spotlightsActive: boolean[];
  kickEvents?: Array<{ time: number; timestampMs: number; intensity: number }>;
  segments?: Array<{ label: string; start: number; end: number; startMs: number; endMs: number }>;
  verseSegments?: Array<{ label: string; start: number; end: number; startMs: number; endMs: number }>;
}

export interface DemucsStemData {
  fps: number;
  durationSeconds: number;
  stems: {
    drums: number[];
    bass: number[];
    instruments: number[];
    vocals: number[];
  };
  kickEvents?: { time: number; intensity: number }[];
  kickOnsets: number[];
  instrumentalActivity?: number[];
  globalIntensity?: number[];
  demucsBpm?: {
    bpm?: number | null;
    candidateBpm?: number | null;
    confidence?: number;
    source?: string;
  };
  averageAmplitude?: number;
  aboveAverageSections?: Array<{ startTime: number; endTime: number }>;
  triStemDropSections?: Array<{ startTime: number; endTime: number }>;
  drumsAverageAmplitude?: number;
  bassAverageAmplitude?: number;
  instAverageAmplitude?: number;
  spotlightAnalysis?: SpotlightAnalysisData;
}

export interface TrackAnalysis {
  schemaVersion: number;
  trackId: string;
  durationSeconds: number;
  estimatedBpm: number;
  bpmConfidence: number;
  frames: FeatureFrame[];
  events: TimedEvent[];
  sections: SectionEvent[];
  demucsStems?: DemucsStemData;
  averageAmplitude?: number;
  amplitudeEnvelope?: number[];
  envelopeFps?: number;
  aboveAverageSections?: Array<{ startTime: number; endTime: number }>;
  triStemDropSections?: Array<{ startTime: number; endTime: number }>;
  descriptors: {
    energy: 'low' | 'medium' | 'high';
    brightness: 'dark' | 'balanced' | 'bright';
    transientDensity: 'sparse' | 'moderate' | 'dense';
    rhythmicRegularity: 'steady' | 'variable' | 'uncertain';
    mood: MusicMood;
  };
}

export type PipelineStatus =
  | 'unscanned'
  | 'extracting'
  | 'ready'
  | 'failed'
  | 'cached';

export interface TrackRecord {
  id: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  sizeBytes?: number;
  file?: File;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  analysisStatus: AnalysisStatus;
  analysis?: TrackAnalysis;
  demucsStems?: DemucsStemData;
  bpm?: number | null;
  bpmSource?: 'demucs' | 'manual' | 'unavailable';
  bpmConfidence?: number;
  producer?: string;
  releaseDate?: string;
  description?: string;
  seed: number; // Deterministic random seed for this track
  recognitionStatus?: PipelineStatus;
  extractedColors?: ExtractedStageColors;
}

export interface VisualEffectContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  features: AudioFeatures;
  deltaSeconds: number;
  trackTimeSeconds: number;
  seed: number;
  quality: QualityPreset;
  palette: ColorPalette;
  intensity: number;      // 0.0 to 2.0 user multiplier
  wireframeOnly?: boolean;
  trackTitle?: string;
  trackArtist?: string;
  mood?: MusicMood;
  directorState?: ShowDirectorState;
  routingConfig?: AudioVisualRoutingConfig;
  hasVideo?: boolean;
  /** Full Demucs stem data for per-track pre-analysis (e.g. IPOP on instrument stem). */
  demucsStems?: DemucsStemData;
  /** Pre-computed spotlight frequency and 360-degree movement trajectory */
  spotlightAnalysis?: SpotlightAnalysisData;
}

export interface VisualEffect {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly cost: 'low' | 'medium' | 'high';
  enabled: boolean;
  initialize(context: VisualEffectContext): void;
  update(context: VisualEffectContext): void;
  setIntensity(value: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface VisualSettings {
  effectIntensity: number;   // 0.5 to 2.0
  cameraSpeed: number;       // 0.2 to 2.0
  bloomGlow: boolean;        // On/Off
  wireframe: boolean;        // Wireframe debug
  paletteId: string;         // Active palette ID
  quality: QualityPreset;    // 'low' | 'medium' | 'high' | 'ultra'
  directorMode: DirectorMode;// 'auto' | 'manual'
  activeEffects: string[];   // Enabled effect IDs
}
