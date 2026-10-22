/**
 * Synwave Concert Moving-Head Stage Lights Effect
 *
 * Professional concert stage lighting rig with per-song pre-analysis:
 *
 * ─── Colouring Spotlights ─────────────────────────────────────────────────────
 *   - Activated ONLY during Iterative Peak-of-Peaks (IPOP) segments of the
 *     instrument STEM. Pre-analyzed per track from DemucsStemData.
 *   - 360° beam sweep speed is driven by the sub-bass frequency range (20-80 Hz)
 *     of the BASS STEM. Rotation occurs continuously ONLY when sub-bass energy
 *     exceeds the per-song threshold (modern EDM sub-bass window).
 *   - Kick/drum hits from the Kick STEM cause a bright intensity glow burst,
 *     fully synchronized with each drum transient event.
 *
 * ─── 360° Perimeter Bass Lights ───────────────────────────────────────────────
 *   - Continuous 360° orbital rotation driven by the BASS STEM sub-bass energy.
 *   - Rotation speed scales with sub-bass amplitude reaching into the threshold.
 *   - Kick hits expand beam width and add an intensity flash.
 *
 * ─── White Sky Spotlights (bottom corners) ────────────────────────────────────
 *   - Governed by the same IPOP logic as colouring spotlights (instrument STEM).
 *   - Beam direction is strictly upward (sky / zenith only — NEVER downward).
 *   - Kick hits from the Kick STEM cause a bright blink cycle on these lights.
 *
 * ─── General ──────────────────────────────────────────────────────────────────
 *   - Freeze support: when playback is paused (deltaSeconds === 0), all lights
 *     freeze in place with zero animation drift.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';
import { mapBpmToSpotlightCount } from '../../services/tempoService';
import { calculateStageDimensions, type StageDimensions } from '../stage/stageDimensions';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface MovingHead {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  targetSlotPos: THREE.Vector3;
  side: 'top' | 'left' | 'right';
  activationFactor: number;
  index: number;
}

interface PerimeterBassLight {
  group: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  baseTarget: THREE.Vector3;
  currentTarget: THREE.Vector3;
  side: 'left' | 'right' | 'top' | 'bottom';
  phaseOffset: number;
  index: number;
}

interface WhiteSkySpotlight {
  fixedBaseMesh: THREE.Mesh;
  headGroup: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  corner: 'left' | 'right';
}

/** A segment of time where the instrument STEM peaks above the IPOP threshold. */
interface IpopSegment {
  startTime: number;
  endTime: number;
  /** 0.0–1.0 relative intensity of the peak within this segment. */
  intensity: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Sub-bass frequency range for EDM/modern music: 20–85 Hz.
 * At 44100 Hz sample rate with FFT size 2048, each bin ≈ 21.53 Hz.
 *   Bin 1  ≈ 21.5 Hz  (deep sub-bass, 808 fundamental)
 *   Bin 2  ≈ 43.1 Hz  (sub-bass core punch)
 *   Bin 3  ≈ 64.6 Hz  (upper sub-bass thump)
 *   Bin 4  ≈ 86.1 Hz  (sub-bass to low-bass boundary)
 * We analyze bins 1–4 inclusive (indices 1 to 5 with exclusive bound 5)
 * for a comprehensive 20–86 Hz sub-bass window.
 */
export const SUB_BASS_FREQ_MIN_HZ = 20;
export const SUB_BASS_FREQ_MAX_HZ = 85;
const SUB_BASS_BIN_START = 1;
const SUB_BASS_BIN_END   = 5; // exclusive bound: iterates bins 1, 2, 3, 4 (21.5 to 86.1 Hz)

/**
 * Minimum sub-bass energy (0–1) needed to trigger 360° perimeter rotation.
 * Calibrated for modern EDM: sub-bass must be clearly audible before rotation starts.
 */
const SUB_BASS_ROTATION_THRESHOLD = 0.18;

/**
 * Kick glow burst multiplier applied to both colouring spotlights and sky lights
 * when a kick transient is detected.
 */
const KICK_GLOW_MULTIPLIER = 2.8;

/** Duration (seconds) of the kick glow burst cycle. */
const KICK_GLOW_DURATION = 0.13;

// ─── Class ────────────────────────────────────────────────────────────────────

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & 360° Perimeter Bass Beams';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // ── Spotlight configuration ─────────────────────────────────────────────────
  private targetSpotlightCount = 3;
  private minSpotlightCount = 1;
  private maxSpotlightCount = 7;
  private autoBpmSpawning = true;
  private customSpotlightColors: THREE.Color[] = [];
  private currentDimensions: StageDimensions = calculateStageDimensions(
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080
  );

  // ── Three.js scene objects ──────────────────────────────────────────────────
  private fixtures: MovingHead[] = [];
  private perimeterBassLights: PerimeterBassLight[] = [];
  private whiteSkySpotlights: WhiteSkySpotlight[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  // ── IPOP (Iterative Peak-of-Peaks Detection) state ─────────────────────────
  /**
   * Pre-analyzed IPOP segments for the current track's instrument STEM.
   * Spotlights and sky lights are only active within these windows.
   */
  private ipopSegments: IpopSegment[] = [];

  /**
   * Per-track IPOP analysis identifier so we only re-compute when the track changes.
   * Stores the first 8 values of the instrument stem as a simple fingerprint.
   */
  private ipopTrackFingerprint = '';

  /**
   * Real-time smoothed instrument activation factor (0–1) derived from whether
   * the current playback time falls inside an IPOP segment.
   */
  private instActivationFactor = 0;

  /**
   * Real-time smoothed intensity of the IPOP segment currently active (0–1).
   * Used to scale spotlight brightness during active instrument peak windows.
   */
  private ipopSegmentIntensity = 0;

  // ── Sub-bass state for 360° rotation gate ──────────────────────────────────
  /**
   * Smoothed sub-bass energy extracted from FFT frequencyData bins 1–4.
   * Used to gate and drive perimeter light rotation speed.
   */
  private smoothedSubBassEnergy = 0;

  /**
   * Whether sub-bass energy is currently above the rotation threshold.
   * Drives the gate: perimeter lights only spin when this is true.
   */
  private subBassRotationActive = false;

  // ── White Sky Spotlight state ────────────────────────────────────────────────
  /**
   * Smoothed presence factor for white sky spotlights driven by IPOP instrument activation.
   * Replaces the old bass-presence gating.
   */
  private whiteSpotlightInstPresence = 0;

  // ── Kick glow state ──────────────────────────────────────────────────────────
  /**
   * Remaining time (seconds) for the current kick glow burst.
   * Set on every kick onset detection.
   */
  private kickGlowTimer = 0;

  /**
   * Previous kick stem value used for transient detection (rise detection).
   */
  private prevKickStem = 0;

  // ── Internal time ──────────────────────────────────────────────────────────
  /** Monotonically advancing time, frozen when deltaSeconds === 0. */
  private internalTime = 0;

  /** Accumulated rotation angle for perimeter lights (radians). */
  private perimeterRotationAngle = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  public setSpotlightCount(count: number): void {
    this.targetSpotlightCount = Math.max(1, Math.min(8, Math.round(count)));
  }

  public getSpotlightCount(): number {
    return this.targetSpotlightCount;
  }

  public setSpotlightLimits(min: number, max: number): void {
    this.minSpotlightCount = Math.max(1, Math.min(8, Math.round(min)));
    this.maxSpotlightCount = Math.max(this.minSpotlightCount, Math.min(8, Math.round(max)));
  }

  public setAutoBpmSpawning(enabled: boolean): void {
    this.autoBpmSpawning = enabled;
  }

  public setSpotlightColors(colors: string[]): void {
    if (colors && colors.length > 0) {
      this.customSpotlightColors = colors.map((hex) => new THREE.Color(hex));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IPOP: Iterative Peak-of-Peaks Detection on the Instrument STEM
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Pre-analyzes the instrument STEM amplitude envelope using Iterative Peak-of-Peaks
   * Detection (IPOP). In each iteration, the algorithm:
   *   1. Finds the global maximum of the remaining envelope.
   *   2. Declares a segment around that peak (±halfWindow).
   *   3. Removes that segment from the candidate pool.
   *   4. Repeats until the peak falls below threshold (fracOfMax × peak decay).
   *
   * The result is a set of non-overlapping time windows where the instrument
   * stem is at its highest-energy peaks. Spotlights only activate inside these.
   *
   * @param instEnvelope  Normalized amplitude envelope of the instrument STEM.
   * @param fps           Frames per second of the envelope.
   * @param fracOfMax     Stop iterating when next peak < fracOfMax × first peak.
   * @param halfWindowSec Half-width (seconds) of each segment around a peak.
   * @returns Sorted, non-overlapping IPOP segments.
   */
  private computeIpopSegments(
    instEnvelope: number[],
    fps: number,
    fracOfMax = 0.52,
    halfWindowSec = 1.8
  ): IpopSegment[] {
    if (!instEnvelope || instEnvelope.length < fps * 2) return [];

    const n = instEnvelope.length;
    const halfWin = Math.round(halfWindowSec * fps);

    // Working copy: will be zeroed out iteratively as peaks are consumed
    const remaining = Float32Array.from(instEnvelope);
    const segments: IpopSegment[] = [];

    // Find initial global maximum to set stop threshold
    let globalMax = 0;
    for (let i = 0; i < n; i++) {
      if (remaining[i] > globalMax) globalMax = remaining[i];
    }
    if (globalMax < 0.05) return []; // No meaningful instrument activity

    const stopThreshold = globalMax * fracOfMax;

    // Iterative peak search
    for (let iter = 0; iter < 256; iter++) {
      // Find current maximum
      let peakVal = 0;
      let peakIdx = -1;
      for (let i = 0; i < n; i++) {
        if (remaining[i] > peakVal) {
          peakVal = remaining[i];
          peakIdx = i;
        }
      }

      // Stop when remaining peaks are below relative threshold
      if (peakIdx < 0 || peakVal < stopThreshold) break;

      const startFrame = Math.max(0, peakIdx - halfWin);
      const endFrame   = Math.min(n - 1, peakIdx + halfWin);

      segments.push({
        startTime: startFrame / fps,
        endTime:   endFrame / fps,
        intensity: Math.min(1.0, peakVal),
      });

      // Zero out consumed region so it won't be re-selected
      for (let j = startFrame; j <= endFrame; j++) {
        remaining[j] = 0;
      }
    }

    // Sort chronologically and merge overlapping/adjacent windows
    segments.sort((a, b) => a.startTime - b.startTime);
    const merged: IpopSegment[] = [];
    for (const seg of segments) {
      const last = merged[merged.length - 1];
      if (last && seg.startTime <= last.endTime + 0.15) {
        // Merge: extend end, keep max intensity
        last.endTime  = Math.max(last.endTime, seg.endTime);
        last.intensity = Math.max(last.intensity, seg.intensity);
      } else {
        merged.push({ ...seg });
      }
    }

    return merged;
  }

  /**
   * Returns whether the given playback time falls inside an IPOP segment,
   * and if so, the normalized intensity of that segment.
   */
  private queryIpopActive(timeSeconds: number): { active: boolean; intensity: number } {
    if (this.ipopSegments.length === 0) {
      return { active: false, intensity: 0 };
    }
    for (const seg of this.ipopSegments) {
      if (timeSeconds >= seg.startTime && timeSeconds <= seg.endTime) {
        return { active: true, intensity: seg.intensity };
      }
    }
    return { active: false, intensity: 0 };
  }

  /**
   * Updates IPOP segments when a new track is loaded.
   * Computes a simple fingerprint from the instrument stem to avoid re-computing
   * for the same track.
   */
  private maybeRecomputeIpop(context: VisualEffectContext): void {
    // Access pre-analyzed Demucs stem data passed through VisualEffectContext
    const demucsStems = context.demucsStems;

    // Prefer DemucsStemData from context if available (injected by VisualEngine)
    const instArr: number[] | undefined = demucsStems?.stems?.instruments;
    const fps = demucsStems?.fps ?? 25;

    if (!instArr || instArr.length === 0) {
      if (this.ipopTrackFingerprint !== '') {
        this.ipopTrackFingerprint = '';
        this.ipopSegments = [];
      }
      return;
    }

    // Build a short fingerprint from the first 8 values
    const fp = instArr.slice(0, 8).map(v => v.toFixed(3)).join(',');
    if (fp === this.ipopTrackFingerprint) return; // Same track — skip

    this.ipopTrackFingerprint = fp;
    this.ipopSegments = this.computeIpopSegments(instArr, fps);
    console.info(
      `[StageLightsEffect] IPOP analysis: ${this.ipopSegments.length} instrument peak segments detected.`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sub-bass frequency analysis on BASS STEM
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Frequency analysis on the BASS STEM (20–85 Hz sub-bass range for modern EDM):
   * Analyzes raw FFT bins 1–4 (~21.5–86.1 Hz) and correlates with features.stems.bass.
   * Finds the dominant sub-bass frequency in Hz, checks if it falls within [20, 85] Hz,
   * and computes the combined sub-bass intensity.
   */
  private analyzeBassStemFrequency(
    frequencyData: Uint8Array,
    bassStem: number
  ): { energy: number; dominantFreqHz: number; isInRange: boolean } {
    let sum = 0;
    let maxVal = 0;
    let peakBin = SUB_BASS_BIN_START;
    const binWidth = 44100 / 2048; // ~21.53 Hz per FFT bin

    const count = SUB_BASS_BIN_END - SUB_BASS_BIN_START;
    for (let i = SUB_BASS_BIN_START; i < SUB_BASS_BIN_END; i++) {
      const val = frequencyData[i] ?? 0;
      sum += val;
      if (val > maxVal) {
        maxVal = val;
        peakBin = i;
      }
    }

    const rawEnergy = Math.min(1.0, (sum / count) / 255 * 2.2);
    const dominantFreqHz = peakBin * binWidth;

    // Check if dominant frequency falls in the calibrated sub-bass EDM range (20–85 Hz)
    const isFreqInRange = dominantFreqHz >= SUB_BASS_FREQ_MIN_HZ && dominantFreqHz <= SUB_BASS_FREQ_MAX_HZ;

    // Couple the spectral energy with the separated BASS STEM amplitude
    const combinedEnergy = rawEnergy * 0.55 + bassStem * 0.45;
    const isInRange = isFreqInRange && combinedEnergy >= SUB_BASS_ROTATION_THRESHOLD && (bassStem > 0.12 || rawEnergy > 0.22);

    return {
      energy: combinedEnergy,
      dominantFreqHz,
      isInRange,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Symmetrical Spotlight Layout
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Phase 4 & 10: Symmetrical spotlight mount positions around the YouTube stage
   * screen (Top, Left, Right). Generates a perfectly balanced, non-clustered,
   * bilateral layout relative to current player stage dimensions.
   */
  public static getSymmetricalSpotlightLayout(
    count: number,
    dims?: StageDimensions
  ): {
    pos: THREE.Vector3;
    side: 'top' | 'left' | 'right';
    defaultTarget: THREE.Vector3;
  }[] {
    const c = Math.max(1, Math.min(8, Math.round(count)));
    const layout: { pos: THREE.Vector3; side: 'top' | 'left' | 'right'; defaultTarget: THREE.Vector3 }[] = [];

    const d = dims || calculateStageDimensions(1920, 1080);
    const halfW   = d.halfWidth;
    const halfH   = d.halfHeight;
    const topY    = d.topY + 1.25;
    const zPos    = d.screenZ + 0.5;
    const leftX   = d.leftX - 1.55;
    const rightX  = d.rightX + 1.55;
    const midY    = d.screenCenterY + 0.15 * halfH;
    const upperY  = d.screenCenterY + 0.60 * halfH;
    const lowerY  = d.screenCenterY - 0.25 * halfH;

    switch (c) {
      case 1:
        layout.push({
          pos: new THREE.Vector3(0.0, topY, zPos),
          side: 'top',
          defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0),
        });
        break;

      case 2:
        layout.push(
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 3:
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 4:
        layout.push(
          { pos: new THREE.Vector3(-0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 5:
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 6:
        layout.push(
          { pos: new THREE.Vector3(-0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;

      case 7:
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;

      case 8:
      default:
        layout.push(
          { pos: new THREE.Vector3(-0.30 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-1.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.30 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(1.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.75 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-4.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.75 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(4.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;
    }

    return layout;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Chassis geometry
    const baseGeo = new THREE.CylinderGeometry(0.25, 0.32, 0.35, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.disposables.push(baseGeo, baseMat);

    // Lens flare sphere
    const lensGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward along local +Z axis
    const coneLength = 26;
    const coneGeo = new THREE.ConeGeometry(1.3, coneLength, 16, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Body extends along +Z
    this.disposables.push(coneGeo);

    // 1. Colouring Spotlights (8 fixtures with symmetrical default layout)
    const baseLayout = StageLightsEffect.getSymmetricalSpotlightLayout(8, this.currentDimensions);

    for (let i = 0; i < baseLayout.length; i++) {
      const slot = baseLayout[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(slot.pos);

      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixtureGroup.add(baseMesh);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(coneMat);

      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(coneMesh);

      fixtureGroup.lookAt(slot.defaultTarget);
      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: slot.pos.clone(),
        targetSlotPos: slot.pos.clone(),
        targetPos: slot.defaultTarget.clone(),
        currentTarget: slot.defaultTarget.clone(),
        side: slot.side,
        activationFactor: i < this.targetSpotlightCount ? 1.0 : 0.0,
        index: i,
      });
    }

    // 2. High-Intensity 360° Perimeter Bass Lights Framing the YouTube Screen
    const periConeLength = 28;
    const periConeGeo = new THREE.ConeGeometry(1.4, periConeLength, 16, 1, true);
    periConeGeo.translate(0, -periConeLength / 2, 0);
    periConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(periConeGeo);

    const perimeterConfigs: {
      pos: THREE.Vector3;
      target: THREE.Vector3;
      side: 'left' | 'right' | 'top' | 'bottom';
      phaseOffset: number;
    }[] = [
      // Left tower fixtures
      { pos: new THREE.Vector3(-12.0, 2.2, -4.1), target: new THREE.Vector3(12.0, 2.0, 12.0), side: 'left', phaseOffset: 0.0 },
      { pos: new THREE.Vector3(-12.0, 4.6, -4.1), target: new THREE.Vector3(11.0, 3.8, 14.0), side: 'left', phaseOffset: 0.8 },
      { pos: new THREE.Vector3(-12.0, 7.0, -4.1), target: new THREE.Vector3(10.0, 5.5, 16.0), side: 'left', phaseOffset: 1.6 },
      { pos: new THREE.Vector3(-12.0, 9.4, -4.1), target: new THREE.Vector3(9.0, 7.0, 18.0), side: 'left', phaseOffset: 2.4 },
      // Right tower fixtures
      { pos: new THREE.Vector3(12.0, 2.2, -4.1), target: new THREE.Vector3(-12.0, 2.0, 12.0), side: 'right', phaseOffset: 3.2 },
      { pos: new THREE.Vector3(12.0, 4.6, -4.1), target: new THREE.Vector3(-11.0, 3.8, 14.0), side: 'right', phaseOffset: 4.0 },
      { pos: new THREE.Vector3(12.0, 7.0, -4.1), target: new THREE.Vector3(-10.0, 5.5, 16.0), side: 'right', phaseOffset: 4.8 },
      { pos: new THREE.Vector3(12.0, 9.4, -4.1), target: new THREE.Vector3(-9.0, 7.0, 18.0), side: 'right', phaseOffset: 5.6 },
      // Top truss fixtures
      { pos: new THREE.Vector3(-6.5, 11.4, -4.2), target: new THREE.Vector3(7.5, 0.8, 14.0), side: 'top', phaseOffset: 1.2 },
      { pos: new THREE.Vector3(6.5, 11.4, -4.2), target: new THREE.Vector3(-7.5, 0.8, 14.0), side: 'top', phaseOffset: 4.4 },
      // Bottom screen frame fixtures
      { pos: new THREE.Vector3(-8.0, 0.8, -4.1), target: new THREE.Vector3(8.0, 6.0, 15.0), side: 'bottom', phaseOffset: 2.0 },
      { pos: new THREE.Vector3(8.0, 0.8, -4.1), target: new THREE.Vector3(-8.0, 6.0, 15.0), side: 'bottom', phaseOffset: 5.2 },
    ];

    for (let i = 0; i < perimeterConfigs.length; i++) {
      const cfg = perimeterConfigs[i];
      const pGroup = new THREE.Group();
      pGroup.position.copy(cfg.pos);

      const pLensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.95,
      });
      this.disposables.push(pLensMat);
      const pLens = new THREE.Mesh(lensGeo, pLensMat);
      pLens.position.set(0, 0, 0.1);
      pGroup.add(pLens);

      const pConeMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(pConeMat);
      const pCone = new THREE.Mesh(periConeGeo, pConeMat);
      pCone.position.set(0, 0, 0.1);
      pGroup.add(pCone);

      pGroup.lookAt(cfg.target);
      this.group.add(pGroup);

      this.perimeterBassLights.push({
        group: pGroup,
        lensMesh: pLens,
        coneMesh: pCone,
        basePos: cfg.pos.clone(),
        baseTarget: cfg.target.clone(),
        currentTarget: cfg.target.clone(),
        side: cfg.side,
        phaseOffset: cfg.phaseOffset,
        index: i,
      });
    }

    // Align perimeter lights with current dimensions
    this.recalculatePerimeterPositions(this.currentDimensions);

    // 3. White Stage Sky Spotlights at Bottom Corners of YouTube Screen
    // Strictly project upward (never downward)
    const skyConeLength = 55;
    const skyConeGeo = new THREE.ConeGeometry(2.4, skyConeLength, 18, 1, true);
    skyConeGeo.translate(0, -skyConeLength / 2, 0);
    skyConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(skyConeGeo);

    const whiteCorners: {
      corner: 'left' | 'right';
      pos: THREE.Vector3;
      defaultTarget: THREE.Vector3;
    }[] = [
      {
        corner: 'left',
        pos: new THREE.Vector3(
          this.currentDimensions.leftX - 0.45,
          this.currentDimensions.bottomY + 0.15,
          this.currentDimensions.screenZ + 0.55
        ),
        defaultTarget: new THREE.Vector3(
          this.currentDimensions.leftX - 3.0,
          Math.max(16.0, this.currentDimensions.topY + 6.0),
          14.0
        ),
      },
      {
        corner: 'right',
        pos: new THREE.Vector3(
          this.currentDimensions.rightX + 0.45,
          this.currentDimensions.bottomY + 0.15,
          this.currentDimensions.screenZ + 0.55
        ),
        defaultTarget: new THREE.Vector3(
          this.currentDimensions.rightX + 3.0,
          Math.max(16.0, this.currentDimensions.topY + 6.0),
          14.0
        ),
      },
    ];

    for (let i = 0; i < whiteCorners.length; i++) {
      const cfg = whiteCorners[i];

      // Fixed base chassis
      const fixedBaseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixedBaseMesh.position.copy(cfg.pos);
      this.group.add(fixedBaseMesh);

      // Optical head group
      const headGroup = new THREE.Group();
      headGroup.position.copy(cfg.pos);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0);
      headGroup.add(lensMesh);

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coneMat);
      const coneMesh = new THREE.Mesh(skyConeGeo, coneMat);
      coneMesh.position.set(0, 0, 0);
      headGroup.add(coneMesh);

      headGroup.lookAt(cfg.defaultTarget);
      this.group.add(headGroup);

      this.whiteSkySpotlights.push({
        fixedBaseMesh,
        headGroup,
        lensMesh,
        coneMesh,
        basePos: cfg.pos.clone(),
        targetPos: cfg.defaultTarget.clone(),
        currentTarget: cfg.defaultTarget.clone(),
        corner: cfg.corner,
      });
    }

    // 4. Dynamic Stage Wash Point Lights
    this.washLight1 = new THREE.PointLight(0xff6600, 0.6, 25, 1.8);
    this.washLight1.position.set(
      -0.45 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.6, 25, 1.8);
    this.washLight2.position.set(
      0.45 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Resize
  // ─────────────────────────────────────────────────────────────────────────────

  public override resize(width: number, height: number): void {
    this.currentDimensions = calculateStageDimensions(width, height);
    this.recalculateSpotlightPositions(this.currentDimensions);
    this.recalculatePerimeterPositions(this.currentDimensions);
    this.recalculateWhiteSkySpotlightPositions(this.currentDimensions);
    if (this.washLight1 && this.washLight2) {
      this.washLight1.position.set(
        -0.45 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
      this.washLight2.position.set(
        0.45 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
    }
  }

  private recalculateWhiteSkySpotlightPositions(dims: StageDimensions): void {
    if (this.whiteSkySpotlights.length >= 2) {
      this.whiteSkySpotlights[0].basePos.set(
        dims.leftX - 0.45,
        dims.bottomY + 0.15,
        dims.screenZ + 0.55
      );
      this.whiteSkySpotlights[0].fixedBaseMesh.position.copy(this.whiteSkySpotlights[0].basePos);
      this.whiteSkySpotlights[0].headGroup.position.copy(this.whiteSkySpotlights[0].basePos);

      this.whiteSkySpotlights[1].basePos.set(
        dims.rightX + 0.45,
        dims.bottomY + 0.15,
        dims.screenZ + 0.55
      );
      this.whiteSkySpotlights[1].fixedBaseMesh.position.copy(this.whiteSkySpotlights[1].basePos);
      this.whiteSkySpotlights[1].headGroup.position.copy(this.whiteSkySpotlights[1].basePos);
    }
  }

  private recalculateSpotlightPositions(dims: StageDimensions): void {
    const layout = StageLightsEffect.getSymmetricalSpotlightLayout(this.targetSpotlightCount, dims);
    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];
      if (i < layout.length) {
        fix.targetSlotPos.copy(layout[i].pos);
        fix.side = layout[i].side;
        fix.targetPos.copy(layout[i].defaultTarget);
        fix.group.position.copy(layout[i].pos);
      }
    }
  }

  private recalculatePerimeterPositions(dims: StageDimensions): void {
    const configs: {
      pos: THREE.Vector3;
      target: THREE.Vector3;
      side: 'left' | 'right' | 'top' | 'bottom';
      phaseOffset: number;
    }[] = [
      // Left tower fixtures
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.65 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.70 * dims.halfHeight, 12.0),
        side: 'left', phaseOffset: 0.0,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.20 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX, dims.screenCenterY - 0.20 * dims.halfHeight, 14.0),
        side: 'left', phaseOffset: 0.8,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.25 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 1.0, dims.screenCenterY + 0.20 * dims.halfHeight, 16.0),
        side: 'left', phaseOffset: 1.6,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.70 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 2.0, dims.screenCenterY + 0.55 * dims.halfHeight, 18.0),
        side: 'left', phaseOffset: 2.4,
      },
      // Right tower fixtures
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.65 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.70 * dims.halfHeight, 12.0),
        side: 'right', phaseOffset: 3.2,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.20 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX, dims.screenCenterY - 0.20 * dims.halfHeight, 14.0),
        side: 'right', phaseOffset: 4.0,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY + 0.25 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX + 1.0, dims.screenCenterY + 0.20 * dims.halfHeight, 16.0),
        side: 'right', phaseOffset: 4.8,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY + 0.70 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX + 2.0, dims.screenCenterY + 0.55 * dims.halfHeight, 18.0),
        side: 'right', phaseOffset: 5.6,
      },
      // Top truss fixtures
      {
        pos: new THREE.Vector3(-0.65 * dims.halfWidth, dims.topY + 0.6, dims.screenZ + 0.3),
        target: new THREE.Vector3(0.65 * dims.halfWidth, 0.8, 14.0),
        side: 'top', phaseOffset: 1.2,
      },
      {
        pos: new THREE.Vector3(0.65 * dims.halfWidth, dims.topY + 0.6, dims.screenZ + 0.3),
        target: new THREE.Vector3(-0.65 * dims.halfWidth, 0.8, 14.0),
        side: 'top', phaseOffset: 4.4,
      },
      // Bottom screen frame fixtures
      {
        pos: new THREE.Vector3(-0.70 * dims.halfWidth, dims.bottomY - 0.4, dims.screenZ + 0.4),
        target: new THREE.Vector3(0.70 * dims.halfWidth, 6.0, 15.0),
        side: 'bottom', phaseOffset: 2.0,
      },
      {
        pos: new THREE.Vector3(0.70 * dims.halfWidth, dims.bottomY - 0.4, dims.screenZ + 0.4),
        target: new THREE.Vector3(-0.70 * dims.halfWidth, 6.0, 15.0),
        side: 'bottom', phaseOffset: 5.2,
      },
    ];

    for (let i = 0; i < this.perimeterBassLights.length && i < configs.length; i++) {
      const p = this.perimeterBassLights[i];
      const cfg = configs[i];
      p.basePos.copy(cfg.pos);
      p.baseTarget.copy(cfg.target);
      p.group.position.copy(cfg.pos);
      p.side = cfg.side;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Update Loop
  // ─────────────────────────────────────────────────────────────────────────────

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;

    // Time advances only when playing
    this.internalTime += deltaSeconds;
    const time = this.internalTime;

    const isLightsEnabled =
      (routingConfig?.enabledEffects?.lights ?? true) &&
      (directorState?.allowedEffects?.lights ?? true);

    if (!isLightsEnabled) {
      for (const fix of this.fixtures) {
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const p of this.perimeterBassLights) {
        (p.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (p.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const s of this.whiteSkySpotlights) {
        (s.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (s.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      this.washLight1.intensity = 0;
      this.washLight2.intensity = 0;
      return;
    }

    const bassBeamMult   = routingConfig?.bassToBeamIntensity ?? 1.0;
    const maxBri         = routingConfig?.maxBrightnessLimit ?? 1.0;
    const periSpeedMult  = routingConfig?.perimeterBassRotationSpeed ?? 1.0;

    const bassStem  = features.stems.bass;
    const instStem  = features.stems.instruments;
    const kickStem  = features.stems.kick;

    // ─── Attempt IPOP analysis on new track ──────────────────────────────────
    this.maybeRecomputeIpop(context);

    // ─── Sub-bass frequency analysis on BASS STEM (20–85 Hz EDM sub-bass) ─────
    const bassAnalysis = this.analyzeBassStemFrequency(features.frequencyData, bassStem);
    const targetSubBass = bassAnalysis.energy;

    if (deltaSeconds > 0) {
      // Fast attack, moderate release for snappy response
      const attackRate = targetSubBass > this.smoothedSubBassEnergy
        ? Math.min(1.0, deltaSeconds * 20.0)
        : Math.min(1.0, deltaSeconds * 6.0);
      this.smoothedSubBassEnergy += (targetSubBass - this.smoothedSubBassEnergy) * attackRate;
    } else {
      this.smoothedSubBassEnergy = targetSubBass;
    }

    // Gate: continuous 360° rotation active when bass reaches frequency in sub-bass range
    this.subBassRotationActive = bassAnalysis.isInRange || this.smoothedSubBassEnergy >= SUB_BASS_ROTATION_THRESHOLD;

    // Normalised excess energy above threshold (0 if below, 0–1 above)
    const subBassExcess = Math.max(0, this.smoothedSubBassEnergy - SUB_BASS_ROTATION_THRESHOLD)
      / (1.0 - SUB_BASS_ROTATION_THRESHOLD);

    // Continuous 360° rotation angle advances only when sub-bass reaches target frequency range
    if (this.subBassRotationActive && deltaSeconds > 0) {
      const bassRotationSpeed = (1.0 + subBassExcess * 6.5) * periSpeedMult;
      this.perimeterRotationAngle += deltaSeconds * bassRotationSpeed;
    }

    // ─── IPOP: Is the instrument STEM currently in a peak segment? ────────────
    const trackTime = context.trackTimeSeconds;
    const ipopQuery = this.queryIpopActive(trackTime);

    // Smooth the instrument IPOP activation factor for graceful fade-in/out
    const targetInstActivation = ipopQuery.active ? 1.0 : 0.0;
    if (deltaSeconds > 0) {
      const lerpRate = ipopQuery.active
        ? Math.min(1.0, deltaSeconds * 8.0)   // Fast attack when entering IPOP window
        : Math.min(1.0, deltaSeconds * 3.0);  // Slower release when leaving
      this.instActivationFactor += (targetInstActivation - this.instActivationFactor) * lerpRate;
    } else {
      this.instActivationFactor = targetInstActivation;
    }
    // Also smooth the segment intensity
    const targetSegIntensity = ipopQuery.active ? ipopQuery.intensity : 0.0;
    if (deltaSeconds > 0) {
      this.ipopSegmentIntensity += (targetSegIntensity - this.ipopSegmentIntensity) * Math.min(1.0, deltaSeconds * 5.0);
    }

    // Fallback: if no IPOP data (no Demucs stems), fall back to live instStem
    const effectiveInstActivation = this.ipopSegments.length > 0
      ? this.instActivationFactor
      : (context.demucsStems ? 0.0 : Math.min(1.0, instStem * 2.2));

    // ─── Kick glow burst detection (Kick STEM synchronization) ───────────────
    // Transient rise detection: kick stem must rise sharply (not just sustain)
    const isKickRise = kickStem > 0.32 && kickStem > this.prevKickStem * 1.12;
    const isKickHit  = features.isKick || isKickRise;
    this.prevKickStem = kickStem;

    if (isKickHit && this.kickGlowTimer <= 0.01) {
      this.kickGlowTimer = KICK_GLOW_DURATION;
    }
    if (deltaSeconds > 0 && this.kickGlowTimer > 0) {
      this.kickGlowTimer = Math.max(0, this.kickGlowTimer - deltaSeconds);
    }

    // Kick glow intensity: completely synchronized with Kick STEM
    // Direct kick stem amplitude + punchy transient onset burst
    const kickStemBoost = kickStem * 1.5;
    let transientBurst = 0;
    if (this.kickGlowTimer > 0) {
      const progress = 1.0 - (this.kickGlowTimer / KICK_GLOW_DURATION);
      transientBurst = Math.max(0, 1.0 - progress) * (KICK_GLOW_MULTIPLIER - 1.0);
    }
    const kickGlowFactor = 1.0 + kickStemBoost + transientBurst;

    // ─── Colour palette ──────────────────────────────────────────────────────
    const hasCustomColors   = this.customSpotlightColors.length > 0;
    const primaryCol        = hasCustomColors ? this.customSpotlightColors[0] : new THREE.Color(palette.primary);
    const secondaryCol      = hasCustomColors
      ? (this.customSpotlightColors[1] || this.customSpotlightColors[0])
      : new THREE.Color(palette.secondary);
    const accentCol         = hasCustomColors
      ? (this.customSpotlightColors[2] || this.customSpotlightColors[0])
      : new THREE.Color(palette.accent || palette.primary);
    const colorPaletteArray = hasCustomColors
      ? this.customSpotlightColors
      : [primaryCol, secondaryCol, accentCol];

    // ─── Tempo / BPM state ───────────────────────────────────────────────────
    const bpmSource       = features.bpmSource || 'unavailable';
    const bpmConfidence   = features.bpmConfidence ?? (bpmSource === 'demucs' ? 0.85 : (bpmSource === 'manual' ? 1.0 : 0.0));
    const verifiedTempoSpeed = (bpmSource !== 'unavailable' && features.estimatedBpm > 0)
      ? Math.max(0.6, Math.min(1.8, features.estimatedBpm / 128.0))
      : 1.0;

    const beatPulse = (bpmSource !== 'unavailable')
      ? Math.sin(features.beatPhase * Math.PI) * (0.015 + bpmConfidence * 0.02)
      : 0.0;

    const rawBrightness  = 0.07 + (bassStem * 0.09 * bassBeamMult) + beatPulse + (features.isDrop ? 0.05 : 0);
    const baseBrightness = Math.min(0.22 * maxBri, rawBrightness * maxBri);

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. COLOURING SPOTLIGHTS
    //    Activated ONLY during IPOP instrument peak segments.
    //    Kick hits cause a synchronised glow burst.
    // ═══════════════════════════════════════════════════════════════════════════

    // Auto BPM-based spotlight count mapping
    if (routingConfig?.minSpotlightCount !== undefined) this.minSpotlightCount = routingConfig.minSpotlightCount;
    if (routingConfig?.maxSpotlightCount !== undefined) this.maxSpotlightCount = routingConfig.maxSpotlightCount;
    if (routingConfig?.autoBpmSpotlightSpawning !== undefined) this.autoBpmSpawning = routingConfig.autoBpmSpotlightSpawning;

    if (this.autoBpmSpawning && features.estimatedBpm && features.estimatedBpm > 0 && features.bpmSource !== 'unavailable') {
      const mappedCount = mapBpmToSpotlightCount(
        features.estimatedBpm,
        this.minSpotlightCount,
        this.maxSpotlightCount
      );
      if (mappedCount !== this.targetSpotlightCount) {
        this.targetSpotlightCount = mappedCount;
      }
    }

    const currentLayout = StageLightsEffect.getSymmetricalSpotlightLayout(
      this.targetSpotlightCount,
      this.currentDimensions
    );
    const activeCount = this.targetSpotlightCount;

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix     = this.fixtures[i];
      const isActive = i < currentLayout.length;

      // Activation factor (position-wise: is this fixture slot in use?)
      if (isActive) {
        fix.targetSlotPos.copy(currentLayout[i].pos);
        fix.side = currentLayout[i].side;
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.min(1.0, fix.activationFactor + deltaSeconds * 3.5);
        } else {
          fix.activationFactor = 1.0;
        }
      } else {
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.max(0.0, fix.activationFactor - deltaSeconds * 3.0);
        } else {
          fix.activationFactor = 0.0;
        }
      }

      // Smooth mount position lerp
      if (deltaSeconds > 0) {
        fix.group.position.lerp(fix.targetSlotPos, deltaSeconds * 4.5);
      } else {
        fix.group.position.copy(fix.targetSlotPos);
      }

      // Fully deactivated slot
      if (fix.activationFactor <= 0.001) {
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // IPOP gate: turned ON only during instrument peak segments detected by IPOP analysis
      const ipopGatedFactor = effectiveInstActivation;
      if (ipopGatedFactor <= 0.01) {
        // Outside IPOP instrument peak segment — turn OFF completely
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // Movement calculation:
      // When bass reaches the sub-bass frequency range, rotate continuously in 360°!
      const offset     = (i / Math.max(1, activeCount)) * Math.PI * 2;
      const rotAngle   = this.perimeterRotationAngle + offset;
      const sweepSpeed = (0.8 + instStem * 1.4) * verifiedTempoSpeed;

      if (this.subBassRotationActive) {
        // ── 360° continuous rotation when sub-bass frequency is reached ──────
        const rotRadiusX = 5.0 + subBassExcess * 4.0;
        const rotRadiusY = 3.8 + subBassExcess * 3.2;
        const circleX    = Math.sin(rotAngle) * rotRadiusX;
        const circleY    = Math.cos(rotAngle) * rotRadiusY;
        const circleZ    = 14.0 + Math.sin(rotAngle * 2.0) * 2.0;

        if (fix.side === 'top') {
          fix.targetPos.set(fix.targetSlotPos.x + circleX, 1.8 + circleY, circleZ);
        } else if (fix.side === 'left') {
          fix.targetPos.set(2.5 + circleX, 2.4 + circleY, circleZ);
        } else {
          fix.targetPos.set(-2.5 + circleX, 2.4 + circleY, circleZ);
        }
      } else {
        // Melodic / tempo pan-tilt sweep when not in 360° sub-bass rotation
        if (fix.side === 'top') {
          if (features.isDrop) {
            const spreadX = fix.targetSlotPos.x * 0.6 + Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 8.0;
            const spreadY = 1.8 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 1.8;
            const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
            fix.targetPos.set(spreadX, spreadY, spreadZ);
          } else {
            const sweepX = fix.targetSlotPos.x * 0.5 + Math.sin(time * sweepSpeed + offset) * 6.5;
            const sweepY = 1.8 + Math.sin(time * 0.6 * verifiedTempoSpeed + offset * 0.5) * 1.4;
            const sweepZ = 13.5 + Math.cos(time * 0.5 + offset) * 2.2;
            fix.targetPos.set(sweepX, sweepY, sweepZ);
          }
        } else if (fix.side === 'left') {
          if (features.isDrop) {
            const spreadX = 2.5 + Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 6.0;
            const spreadY = 2.4 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 2.2;
            const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
            fix.targetPos.set(spreadX, spreadY, spreadZ);
          } else {
            const sweepX = 3.0 + Math.sin(time * sweepSpeed + offset) * 5.0;
            const sweepY = 2.5 + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 2.0;
            const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.2;
            fix.targetPos.set(sweepX, sweepY, sweepZ);
          }
        } else {
          // Right side — mirror of left
          if (features.isDrop) {
            const spreadX = -2.5 - Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 6.0;
            const spreadY = 2.4 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 2.2;
            const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
            fix.targetPos.set(spreadX, spreadY, spreadZ);
          } else {
            const sweepX = -3.0 - Math.sin(time * sweepSpeed + offset) * 5.0;
            const sweepY = 2.5 + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 2.0;
            const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.2;
            fix.targetPos.set(sweepX, sweepY, sweepZ);
          }
        }
      }

      if (deltaSeconds > 0) {
        fix.currentTarget.lerp(fix.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      }
      fix.group.lookAt(fix.currentTarget);

      // Colour assignment
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);

      // Opacity: base brightness × IPOP gate × kick glow burst
      const ipopBoost  = 1.0 + this.ipopSegmentIntensity * 0.6;
      const lensBase   = Math.min(0.95 * maxBri, baseBrightness * 4.2) * fix.activationFactor * ipopGatedFactor * ipopBoost;
      const coneBase   = Math.min(0.22 * maxBri, baseBrightness) * fix.activationFactor * ipopGatedFactor * ipopBoost;

      lensMat.opacity = Math.min(0.99, lensBase * kickGlowFactor);
      coneMat.opacity = Math.min(0.30, coneBase * kickGlowFactor);

      // Beam scale driven by bass with kick expansion
      const beamScale = (1.0 + bassStem * 0.35 * bassBeamMult) * (kickGlowFactor > 1.5 ? 1.25 : 1.0);
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. 360° PERIMETER BASS LIGHTS
    //    Continuous rotation ONLY when sub-bass energy exceeds threshold.
    //    Rotation speed scales linearly with sub-bass amplitude above threshold.
    //    Kick hits expand beam width and add an intensity flash.
    // ═══════════════════════════════════════════════════════════════════════════

    // Instrumental activity for perimeter count scaling
    const instActivity  = features.instrumentalActivity ?? (features.stems.instruments * 0.7 + (features.highMid + features.treble) * 0.3);
    const freqChangeRate = features.onsetStrength || 0;
    const dynamicInstrumentScore = Math.min(1.0, (instActivity * 0.65) + (freqChangeRate * 0.35));

    const minPerimeter    = 2;
    const maxPerimeter    = this.perimeterBassLights.length;
    const activePerimeterCount = Math.max(
      minPerimeter,
      Math.min(maxPerimeter, Math.round(THREE.MathUtils.lerp(minPerimeter, maxPerimeter, dynamicInstrumentScore)))
    );

    for (let i = 0; i < this.perimeterBassLights.length; i++) {
      const pLight = this.perimeterBassLights[i];

      if (i >= activePerimeterCount) {
        (pLight.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (pLight.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // If sub-bass is below threshold, dim perimeter lights to near-zero
      if (!this.subBassRotationActive) {
        const idleOpacity = 0.08 * maxBri;
        (pLight.lensMesh.material as THREE.MeshBasicMaterial).opacity = idleOpacity;
        (pLight.coneMesh.material as THREE.MeshBasicMaterial).opacity = idleOpacity * 0.3;
        // Hold position during idle — no lookAt update
        pLight.group.position.copy(pLight.basePos);
        continue;
      }

      // 360° orbital rotation driven by sub-bass energy
      const orbitAngle   = this.perimeterRotationAngle + pLight.phaseOffset;
      const orbitRadiusX = 5.5 + subBassExcess * 6.5;
      const orbitRadiusY = 3.8 + subBassExcess * 5.0;

      const target = pLight.baseTarget.clone();

      if (pLight.side === 'left') {
        target.x += Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.cos(orbitAngle) * orbitRadiusY;
        target.z += Math.sin(orbitAngle * 1.5) * 5.0 + subBassExcess * 4.0;
      } else if (pLight.side === 'right') {
        target.x -= Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.cos(orbitAngle) * orbitRadiusY;
        target.z += Math.sin(orbitAngle * 1.5) * 5.0 + subBassExcess * 4.0;
      } else if (pLight.side === 'top') {
        target.x += Math.cos(orbitAngle) * orbitRadiusX;
        target.y += Math.sin(orbitAngle) * (orbitRadiusY * 0.7);
        target.z += Math.cos(orbitAngle * 2.0) * 4.0;
      } else {
        // Bottom lights sweep up into the arena
        target.x += Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.abs(Math.cos(orbitAngle)) * orbitRadiusY + 1.0;
        target.z += Math.sin(orbitAngle) * 4.0;
      }

      pLight.group.position.copy(pLight.basePos);

      if (deltaSeconds > 0) {
        pLight.currentTarget.lerp(target, deltaSeconds * (6.0 + subBassExcess * 9.0));
      }
      pLight.group.lookAt(pLight.currentTarget);

      // Colour from thumbnail palette
      const crossCol = colorPaletteArray[(i + 1) % colorPaletteArray.length];

      const pLensMat = pLight.lensMesh.material as THREE.MeshBasicMaterial;
      pLensMat.color.copy(crossCol);

      const pConeMat = pLight.coneMesh.material as THREE.MeshBasicMaterial;
      pConeMat.color.copy(crossCol);

      // Opacity: driven by sub-bass excess + kick glow
      const periLensOpacity  = Math.min(0.98 * maxBri, (0.55 + subBassExcess * 0.45) * maxBri * kickGlowFactor);
      const periBassOpacity  = Math.min(0.48 * maxBri, (0.14 + subBassExcess * 0.34 * bassBeamMult) * maxBri * kickGlowFactor);

      pLensMat.opacity = periLensOpacity;
      pConeMat.opacity = periBassOpacity;

      // Beam expansion with sub-bass and kick hit
      const beamExpansion = (1.0 + subBassExcess * 0.45 * bassBeamMult) * (kickGlowFactor > 1.5 ? 1.20 : 1.0);
      pLight.coneMesh.scale.set(beamExpansion, beamExpansion, 1.0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. WHITE SKY SPOTLIGHTS (Bottom corners → strictly upward projection)
    //
    //    ● Turned ON only during IPOP instrument peak segments (same as colouring
    //      spotlights). NOT driven by bass presence anymore.
    //    ● Beam direction is strictly upward (sky/zenith). The lookAt target Y
    //      is always clamped well above the screen top.
    //    ● Kick hits from the Kick STEM trigger a bright blink cycle.
    // ═══════════════════════════════════════════════════════════════════════════

    // Smooth white-spotlight presence from IPOP instrument activation
    const targetWhitePresence = effectiveInstActivation;
    if (deltaSeconds > 0) {
      const wpRate = targetWhitePresence > this.whiteSpotlightInstPresence
        ? Math.min(1.0, deltaSeconds * 14.0)   // Fast attack
        : Math.min(1.0, deltaSeconds * 4.0);   // Slower release
      this.whiteSpotlightInstPresence += (targetWhitePresence - this.whiteSpotlightInstPresence) * wpRate;
    } else {
      this.whiteSpotlightInstPresence = targetWhitePresence;
    }

    const skyBaseY    = Math.max(14.0, this.currentDimensions.topY + 5.0);
    const instPresence = this.whiteSpotlightInstPresence;

    for (let i = 0; i < this.whiteSkySpotlights.length; i++) {
      const spot   = this.whiteSkySpotlights[i];
      const isLeft = spot.corner === 'left';
      const offset = isLeft ? 0.0 : 0.65;
      const sweepSpeed = (0.8 + instStem * 1.4) * verifiedTempoSpeed;

      // ── Strictly upward target computation ──────────────────────────────────
      // Clamp target Y to always be above the screen top — never allow downward aim
      const minTargetY = this.currentDimensions.topY + 4.0;

      if (this.subBassRotationActive) {
        // ── 360° continuous rotation strictly projected in upward sky direction ─
        const rotAngle   = this.perimeterRotationAngle + (isLeft ? 0.0 : Math.PI);
        const skyRadiusX = 5.5 + subBassExcess * 4.5;
        const skyRadiusZ = 5.0 + subBassExcess * 4.0;
        const sweepX     = spot.basePos.x + Math.sin(rotAngle) * skyRadiusX;
        const sweepZ     = 14.0 + Math.cos(rotAngle) * skyRadiusZ;
        const sweepY     = skyBaseY + 3.0 + Math.sin(rotAngle * 2.0) * 2.5;
        spot.targetPos.set(sweepX, Math.max(minTargetY, sweepY), sweepZ);
      } else {
        // Melodic crossing skyward scissor / tempo sweeps
        if (isLeft) {
          if (features.isDrop) {
            const spreadX = (this.currentDimensions.leftX * 0.3) + Math.sin(time * (3.0 * verifiedTempoSpeed)) * (this.currentDimensions.halfWidth + 5.5);
            const spreadY = skyBaseY + 3.0 + Math.cos(time * (2.6 * verifiedTempoSpeed)) * 4.0;
            const spreadZ = 14.0 + Math.sin(time * 2.0) * 3.0;
            spot.targetPos.set(spreadX, Math.max(minTargetY, spreadY), spreadZ);
          } else {
            const sweepX = (this.currentDimensions.leftX + 2.0) + Math.sin(time * sweepSpeed) * (this.currentDimensions.halfWidth + 4.5);
            const sweepY = skyBaseY + Math.cos(time * 0.7 * verifiedTempoSpeed) * 3.0;
            const sweepZ = 13.5 + Math.sin(time * 0.5) * 2.5;
            spot.targetPos.set(sweepX, Math.max(minTargetY, sweepY), sweepZ);
          }
        } else {
          if (features.isDrop) {
            const spreadX = (this.currentDimensions.rightX * 0.3) - Math.sin(time * (3.0 * verifiedTempoSpeed) + offset) * (this.currentDimensions.halfWidth + 5.5);
            const spreadY = skyBaseY + 3.0 + Math.cos(time * (2.6 * verifiedTempoSpeed) + offset) * 4.0;
            const spreadZ = 14.0 + Math.sin(time * 2.0 + offset) * 3.0;
            spot.targetPos.set(spreadX, Math.max(minTargetY, spreadY), spreadZ);
          } else {
            const sweepX = (this.currentDimensions.rightX - 2.0) - Math.sin(time * sweepSpeed + offset) * (this.currentDimensions.halfWidth + 4.5);
            const sweepY = skyBaseY + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 3.0;
            const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.5;
            spot.targetPos.set(sweepX, Math.max(minTargetY, sweepY), sweepZ);
          }
        }
      }

      // Smooth pan/tilt tracking
      if (deltaSeconds > 0) {
        spot.currentTarget.lerp(spot.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      }
      // Enforce upward constraint on live tracked target as well
      spot.currentTarget.y = Math.max(minTargetY, spot.currentTarget.y);

      // Strictly fixed origins (no translation or shake)
      spot.fixedBaseMesh.position.copy(spot.basePos);
      spot.headGroup.position.copy(spot.basePos);
      spot.headGroup.lookAt(spot.currentTarget);

      const lensMat = spot.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = spot.coneMesh.material as THREE.MeshBasicMaterial;

      // Turn OFF when outside IPOP instrument peak segment
      if (instPresence <= 0.01) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Base opacities driven by instrument presence and drop state
      const rawLensOpacity = (0.88 + instStem * 0.16 + (features.isDrop ? 0.10 : 0)) * instPresence;
      const rawConeOpacity = (0.36 + instStem * 0.20 + (features.isDrop ? 0.10 : 0)) * instPresence;

      // Apply kick glow burst to sky spotlights as well
      lensMat.opacity = Math.min(1.0, Math.min(0.99 * maxBri, rawLensOpacity * kickGlowFactor));
      coneMat.opacity = Math.min(0.90, Math.min(0.68 * maxBri, rawConeOpacity * kickGlowFactor));

      // Beam scale expands on kick hits (fixed origin)
      const skyBeamScale = (1.0 + subBassExcess * 0.35 * bassBeamMult) * (kickGlowFactor > 1.5 ? 1.18 : 1.0);
      spot.coneMesh.scale.set(skyBeamScale, skyBeamScale, 1.0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. WASH LIGHTS (Tinted by Thumbnail Palette)
    // ═══════════════════════════════════════════════════════════════════════════
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.45 + bassStem * 0.55 * bassBeamMult) * maxBri);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.45 + instStem * 0.55 * bassBeamMult) * maxBri);
  }
}
