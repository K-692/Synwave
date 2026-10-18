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
  laserColor: string;    // Laser beam color
  ambientColor: string;  // Scene ambient lighting
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
  frequencyData: Uint8Array; // Raw FFT bins (0-255)
  timeDomainData: Uint8Array;// Raw PCM waveform samples (0-255)
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

export interface TrackAnalysis {
  schemaVersion: number;
  trackId: string;
  durationSeconds: number;
  estimatedBpm: number;
  bpmConfidence: number;
  frames: FeatureFrame[];
  events: TimedEvent[];
  sections: SectionEvent[];
  descriptors: {
    energy: 'low' | 'medium' | 'high';
    brightness: 'dark' | 'balanced' | 'bright';
    transientDensity: 'sparse' | 'moderate' | 'dense';
    rhythmicRegularity: 'steady' | 'variable' | 'uncertain';
  };
}

export interface TrackRecord {
  id: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  sizeBytes: number;
  file?: File;
  analysisStatus: AnalysisStatus;
  analysis?: TrackAnalysis;
  seed: number; // Deterministic random seed for this track
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
