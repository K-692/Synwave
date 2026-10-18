/**
 * Synwave Beat Grid & Tempo Synchronization Engine
 * 
 * Provides rock-solid rhythmic quantization and stage synchronization:
 * - Real-time onset interval tracking and tempo (BPM) estimation
 * - Continuous beat phase (0.0 to 1.0) and monotonic beat indexing
 * - Bar indexing (1 to 4/8) and musical phrase boundary detection
 * - Authoritative audio clock alignment with instantaneous seek re-synchronization
 * - Local storage caching of track BPM calibrations and manual overrides
 */

import type { BeatGridState } from '../types';

export class BeatGridEngine {
  private bpm = 128.0;
  private confidence = 0.5;
  private isUserCalibrated = false;

  // Recent onset timestamps for Inter-Onset Interval (IOI) calculation
  private onsetHistory: number[] = [];
  private lastOnsetAudioTime = -1;

  // Cached state
  private currentState: BeatGridState = {
    bpm: 128,
    beatIndex: 0,
    barIndex: 1,
    beatPhase: 0,
    isBeat: false,
    isBar: false,
    isPhrase: false,
    confidence: 0.5,
  };

  private currentTrackId = '';

  constructor(initialBpm = 128) {
    this.bpm = initialBpm;
    this.updateCurrentState(0, false, 0);
  }

  /**
   * Initializes or loads cached beat grid parameters for a specific track.
   */
  public setTrack(trackId: string, preAnalyzedBpm?: number, confidence?: number): void {
    this.currentTrackId = trackId;
    this.onsetHistory = [];
    this.lastOnsetAudioTime = -1;

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(`synwave_beatgrid_${trackId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.bpm && parsed.bpm >= 60 && parsed.bpm <= 220) {
          this.bpm = parsed.bpm;
          this.confidence = parsed.confidence ?? 0.85;
          this.isUserCalibrated = !!parsed.isUserCalibrated;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read beatgrid cache:', e);
    }

    if (preAnalyzedBpm && preAnalyzedBpm >= 60 && preAnalyzedBpm <= 220) {
      this.bpm = preAnalyzedBpm;
      this.confidence = confidence ?? 0.8;
      this.isUserCalibrated = false;
    } else {
      this.bpm = 128;
      this.confidence = 0.4;
      this.isUserCalibrated = false;
    }
  }

  /**
   * Updates the beat grid clock using authoritative audio time and live transient flags.
   */
  public update(
    audioCurrentTime: number,
    rawIsBeat: boolean,
    onsetStrength: number
  ): BeatGridState {
    const beatPeriod = 60.0 / Math.max(40, this.bpm);

    // Dynamic IOI tracking if not manually calibrated
    if (rawIsBeat && !this.isUserCalibrated && audioCurrentTime > 0.5) {
      if (this.lastOnsetAudioTime > 0) {
        const ioi = audioCurrentTime - this.lastOnsetAudioTime;
        // Acceptable intervals: ~70 BPM (0.85s) to ~200 BPM (0.3s)
        if (ioi >= 0.28 && ioi <= 0.95) {
          this.onsetHistory.push(ioi);
          if (this.onsetHistory.length > 20) {
            this.onsetHistory.shift();
          }

          if (this.onsetHistory.length >= 8) {
            this.refineBpmFromHistory();
          }
        }
      }
      this.lastOnsetAudioTime = audioCurrentTime;
    }

    // Phase calculation: continuous 0.0 to 1.0 within active beat
    const totalBeats = audioCurrentTime / beatPeriod;
    const beatIndex = Math.floor(totalBeats);
    const beatPhase = totalBeats - beatIndex;

    // Bar Index: 1 to 4 in a standard 4/4 musical measure (modulo 8 for 2-bar subphrases)
    const measureIndex = Math.floor(beatIndex / 4);
    const barIndex = (measureIndex % 8) + 1;

    // Detect downbeat (Beat 1 of measure) and phrase boundaries (every 4 or 8 bars = 16 or 32 beats)
    const isDownbeat = (beatIndex % 4 === 0) && beatPhase < 0.12;
    const isPhraseBoundary = (beatIndex % 16 === 0) && beatPhase < 0.12;

    const isQuantizedBeat = (rawIsBeat && onsetStrength > 0.3) || (beatPhase < 0.10);

    this.currentState = {
      bpm: Math.round(this.bpm * 10) / 10,
      beatIndex,
      barIndex,
      beatPhase: Math.max(0, Math.min(1, beatPhase)),
      isBeat: isQuantizedBeat,
      isBar: isDownbeat,
      isPhrase: isPhraseBoundary,
      confidence: this.confidence,
    };

    return this.currentState;
  }

  /**
   * Refines BPM using median / mode clustering of Inter-Onset Intervals.
   */
  private refineBpmFromHistory(): void {
    const sorted = [...this.onsetHistory].sort((a, b) => a - b);
    const medianIoi = sorted[Math.floor(sorted.length / 2)];
    if (medianIoi <= 0) return;

    let candidateBpm = 60.0 / medianIoi;
    // Normalize octave: bring into 90 - 180 BPM range
    while (candidateBpm < 90) candidateBpm *= 2;
    while (candidateBpm > 180) candidateBpm /= 2;

    // Smooth update towards candidate
    const alpha = 0.08;
    this.bpm = this.bpm * (1 - alpha) + candidateBpm * alpha;
    this.confidence = Math.min(0.92, this.confidence + 0.02);

    this.persistCache();
  }

  /**
   * Sets or overrides the BPM manually (e.g. from UI tempo tapper or manual input).
   */
  public setBpm(bpm: number, isUser = true): void {
    if (bpm >= 40 && bpm <= 240) {
      this.bpm = bpm;
      this.confidence = 1.0;
      this.isUserCalibrated = isUser;
      this.persistCache();
    }
  }

  public getState(): BeatGridState {
    return this.currentState;
  }

  public getBpm(): number {
    return this.bpm;
  }

  public getConfidence(): number {
    return this.confidence;
  }

  private updateCurrentState(currentTime: number, isBeat: boolean, onsetStrength: number): void {
    this.update(currentTime, isBeat, onsetStrength);
  }

  private persistCache(): void {
    if (!this.currentTrackId) return;
    try {
      localStorage.setItem(
        `synwave_beatgrid_${this.currentTrackId}`,
        JSON.stringify({
          bpm: Math.round(this.bpm * 10) / 10,
          confidence: this.confidence,
          isUserCalibrated: this.isUserCalibrated,
        })
      );
    } catch (e) {
      console.warn('Failed to persist beatgrid cache:', e);
    }
  }
}
