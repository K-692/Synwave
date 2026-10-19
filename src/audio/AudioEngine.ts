/**
 * Synwave Audio Engine
 * Manages Web Audio API graph, authoritative media clock, and real-time audio feature extraction.
 */

import type { AudioFeatures, AudioStems, BeatGridState, DemucsStemData, MusicMood, TrackAnalysis } from '../types';
import { StemSeparationService } from './StemSeparationService';
import { BeatGridEngine } from './BeatGridEngine';
import { sampleStemValues } from '../services/demucsService';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private beatGridEngine: BeatGridEngine = new BeatGridEngine();

  private frequencyData: Uint8Array<ArrayBuffer>;
  private timeDomainData: Uint8Array<ArrayBuffer>;

  // Smoothed feature caches for visual continuity
  private smoothedRms = 0;
  private smoothedBass = 0;
  private smoothedSubBass = 0;
  private smoothedLowMid = 0;
  private smoothedHighMid = 0;
  private smoothedTreble = 0;
  private smoothedCentroid = 0;

  // Mid-range spectral analysis (250 Hz – 4 kHz, instrumental characteristics)
  private prevMidRangeSpectrum: Float32Array = new Float32Array(175); // Bins 12 to 186
  private smoothedMidRangeEnergy = 0;
  private smoothedMidSpectralCentroid = 0.5;
  private smoothedMidSpectralFlux = 0;
  private smoothedMidEnergyDistribution = 0.5;

  // Transient beat and drum kick detection state
  private energyHistory: number[] = [];
  private subBassHistory: number[] = [];
  private recentEnergyWindow: number[] = [];
  private beatHoldFrames = 0;
  private kickHoldFrames = 0;
  private lastBeatTime = 0;
  private lastKickTime = 0;
  private dropConfidence = 0;
  private currentKickStem = 0;
  private lastFeatureTime = performance.now();
  private demucsStems: DemucsStemData | null = null;
  private trackAnalysis: TrackAnalysis | null = null;
  private trackAverageAmplitude = 0.30;
  private aboveAverageSections: Array<{ startTime: number; endTime: number }> = [];
  private triStemDropSections: Array<{ startTime: number; endTime: number }> = [];
  private drumsAverageAmplitude = 0.25;
  private bassAverageAmplitude = 0.25;
  private instAverageAmplitude = 0.25;

  // Callbacks
  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;
  public onTrackEnded?: () => void;
  public onError?: (error: Error) => void;
  public onAudioReady?: () => void;
  public onPlaybackStarted?: () => void;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    // 1024 bins from FFT size 2048
    this.frequencyData = new Uint8Array(1024);
    this.timeDomainData = new Uint8Array(1024);

    this.setupAudioListeners();
  }

  /**
   * Initializes the Web Audio API context. Must be triggered via user interaction.
   */
  public async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.gainNode = this.audioContext.createGain();

      try {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.analyserNode);
        this.analyserNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      } catch (err) {
        console.warn('Audio source connection note:', err);
      }
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private setupAudioListeners(): void {
    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
      }
    });

    this.audioElement.addEventListener('canplay', () => {
      this.onAudioReady?.();
    });

    this.audioElement.addEventListener('loadeddata', () => {
      this.onAudioReady?.();
    });

    this.audioElement.addEventListener('play', () => {
      this.onPlayStateChange?.(true);
    });

    this.audioElement.addEventListener('playing', () => {
      this.onPlayStateChange?.(true);
      this.onPlaybackStarted?.();
    });

    this.audioElement.addEventListener('pause', () => {
      this.onPlayStateChange?.(false);
    });

    this.audioElement.addEventListener('ended', () => {
      this.onPlayStateChange?.(false);
      this.onTrackEnded?.();
    });

    this.audioElement.addEventListener('error', () => {
      const errorMsg = this.audioElement.error?.message || 'Error loading audio media';
      this.onError?.(new Error(errorMsg));
    });
  }

  /**
   * Returns whether audio media data is loaded and ready to play.
   */
  public isAudioReady(): boolean {
    return this.audioElement.readyState >= 2;
  }

  /**
   * Loads a track by audio URL or Object URL.
   */
  public async loadTrack(url: string, autoPlay = false): Promise<void> {
    try {
      this.audioElement.src = url;
      this.audioElement.load();

      if (this.audioElement.readyState >= 2) {
        this.onAudioReady?.();
      }

      if (autoPlay) {
        await this.play();
      }
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  public async play(): Promise<void> {
    await this.initAudioContext();
    try {
      await this.audioElement.play();
    } catch (err) {
      console.warn('Autoplay prevented or interrupted:', err);
    }
  }

  public pause(): void {
    this.audioElement.pause();
  }

  public seek(seconds: number): void {
    if (isFinite(seconds)) {
      this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.audioElement.duration || 0));
    }
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = clamped;
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(clamped, this.audioContext?.currentTime || 0);
    }
  }

  public setMute(mute: boolean): void {
    this.audioElement.muted = mute;
  }

  public getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.audioElement.duration || 0;
  }

  public isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  /**
   * Computes multi-band spectral features, dynamic RMS, centroid, and transient beat onset.
   */
  public getLiveFeatures(): AudioFeatures {
    const currentTime = this.audioElement.currentTime || 0;

    if (!this.analyserNode || !this.isPlaying()) {
      // Return zeroed/decayed fallback if audio is paused or not connected
      return {
        timeSeconds: currentTime,
        rms: Math.max(0, this.smoothedRms * 0.9),
        bass: Math.max(0, this.smoothedBass * 0.9),
        subBass: Math.max(0, this.smoothedSubBass * 0.9),
        lowMid: Math.max(0, this.smoothedLowMid * 0.9),
        highMid: Math.max(0, this.smoothedHighMid * 0.9),
        treble: Math.max(0, this.smoothedTreble * 0.9),
        spectralCentroid: this.smoothedCentroid,
        onsetStrength: 0,
        beatConfidence: 0,
        isBeat: false,
        isKick: false,
        kickIntensity: 0,
        isDrop: false,
        dropIntensity: 0,
        musicMode: 'festival',
        mood: 'retro-groove',
        stems: {
          kick: 0,
          bass: 0,
          instruments: 0,
          vocals: 0,
        },
        estimatedBpm: this.beatGridEngine.getBpm(),
        bpmSource: this.beatGridEngine.getBpmSource(),
        bpmConfidence: this.beatGridEngine.getConfidence(),
        beatIndex: 0,
        barIndex: 1,
        beatPhase: 0,
        isBar: false,
        isPhrase: false,
        frequencyData: this.frequencyData,
        timeDomainData: this.timeDomainData,
        isAboveAverageAmplitude: this.isTimestampAboveAverage(currentTime),
        trackAverageAmplitude: this.trackAverageAmplitude,
        currentAmplitude: 0,
        lowFreqDistribution: 0.5,
        midRangeEnergy: 0,
        midSpectralCentroid: 0.5,
        midSpectralFlux: 0,
        midEnergyDistribution: 0.5,
      };
    }

    // Populate FFT arrays
    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.analyserNode.getByteTimeDomainData(this.timeDomainData);

    // Calculate RMS from time-domain PCM
    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rawRms = Math.min(1, Math.sqrt(sumSquares / this.timeDomainData.length) * 2.2);

    // Frequency bands:
    // Sample rate ~44100Hz -> Nyquist 22050Hz across 1024 bins (~21.5 Hz per bin)
    // Sub-bass: 20 - 100 Hz -> bins 1 to 5
    // Bass: 100 - 250 Hz -> bins 5 to 12
    // Low-mid: 250 - 500 Hz -> bins 12 to 24
    // Mid & High-mid: 500 - 2000 Hz -> bins 24 to 95
    // Treble: 2000 - 16000 Hz -> bins 95 to 750

    const calcBandAverage = (startBin: number, endBin: number): number => {
      let sum = 0;
      const count = Math.max(1, endBin - startBin);
      for (let i = startBin; i < endBin && i < this.frequencyData.length; i++) {
        sum += this.frequencyData[i];
      }
      return sum / count / 255;
    };

    const rawSubBass = Math.min(1, calcBandAverage(1, 6) * 1.85);
    const rawBass = Math.min(1, calcBandAverage(1, 14) * 1.5);
    const rawLowMid = Math.min(1, calcBandAverage(14, 28) * 1.3);
    const rawHighMid = Math.min(1, calcBandAverage(28, 100) * 1.4);
    const rawTreble = Math.min(1, calcBandAverage(100, 600) * 1.8);

    // Calculate Spectral Centroid (perceived spectral brightness)
    let centroidNumerator = 0;
    let centroidDenominator = 0;
    for (let i = 0; i < 512; i++) {
      const magnitude = this.frequencyData[i];
      centroidNumerator += i * magnitude;
      centroidDenominator += magnitude;
    }
    const rawCentroid = centroidDenominator > 0
      ? Math.min(1, (centroidNumerator / centroidDenominator) / 200)
      : 0.2;

    // Smooth values for visual elegance
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    this.smoothedRms = lerp(this.smoothedRms, rawRms, 0.35);
    this.smoothedBass = lerp(this.smoothedBass, rawBass, 0.45);
    this.smoothedSubBass = lerp(this.smoothedSubBass, rawSubBass, 0.45);
    this.smoothedLowMid = lerp(this.smoothedLowMid, rawLowMid, 0.35);
    this.smoothedHighMid = lerp(this.smoothedHighMid, rawHighMid, 0.35);
    this.smoothedTreble = lerp(this.smoothedTreble, rawTreble, 0.35);
    this.smoothedCentroid = lerp(this.smoothedCentroid, rawCentroid, 0.25);

    // Phase 14: Mid-Range Spectral Analysis (250 Hz – 4 kHz, bins 12 to 186):
    // Extracts mid-range energy, centroid, spectral flux, and upper vs lower mid energy balance
    const midStartBin = 12;
    const midSplitBin = 46; // ~1000 Hz
    const midEndBin = 186;  // ~4000 Hz

    let midSum = 0;
    let midCentroidNumerator = 0;
    let midCentroidDenominator = 0;
    let midFluxSum = 0;
    let lowerMidEnergy = 0;
    let upperMidEnergy = 0;

    for (let i = midStartBin; i < midEndBin && i < this.frequencyData.length; i++) {
      const mag = this.frequencyData[i] / 255;
      midSum += mag;

      const binWeight = (i - midStartBin) / (midEndBin - midStartBin);
      midCentroidNumerator += binWeight * mag;
      midCentroidDenominator += mag;

      const prevMag = this.prevMidRangeSpectrum[i - midStartBin] || 0;
      if (mag > prevMag) {
        midFluxSum += (mag - prevMag);
      }
      this.prevMidRangeSpectrum[i - midStartBin] = mag;

      if (i < midSplitBin) {
        lowerMidEnergy += mag;
      } else {
        upperMidEnergy += mag;
      }
    }

    const midCount = Math.max(1, midEndBin - midStartBin);
    const rawMidBandEnergy = Math.min(1.0, (midSum / midCount) * 1.6);
    const rawMidCentroid = midCentroidDenominator > 0 ? (midCentroidNumerator / midCentroidDenominator) : 0.5;
    const rawMidFlux = Math.min(1.0, (midFluxSum / midCount) * 14.0);
    const rawMidDistribution = (lowerMidEnergy + upperMidEnergy) > 0.001
      ? upperMidEnergy / (lowerMidEnergy + upperMidEnergy)
      : 0.5;

    this.smoothedMidRangeEnergy = lerp(this.smoothedMidRangeEnergy, rawMidBandEnergy, 0.35);
    this.smoothedMidSpectralCentroid = lerp(this.smoothedMidSpectralCentroid, rawMidCentroid, 0.30);
    this.smoothedMidSpectralFlux = lerp(this.smoothedMidSpectralFlux, rawMidFlux, 0.40);
    this.smoothedMidEnergyDistribution = lerp(this.smoothedMidEnergyDistribution, rawMidDistribution, 0.30);

    // Track dynamic rolling sub-bass baseline for Drum Kick Detection
    this.subBassHistory.push(rawSubBass);
    if (this.subBassHistory.length > 30) {
      this.subBassHistory.shift();
    }
    const avgSubBass = this.subBassHistory.reduce((a, b) => a + b, 0) / this.subBassHistory.length;

    // Track rolling energy for calm vs festival mode classification
    this.recentEnergyWindow.push(rawRms * 0.4 + rawBass * 0.6);
    if (this.recentEnergyWindow.length > 80) {
      this.recentEnergyWindow.shift();
    }
    const avgEnergyWindow = this.recentEnergyWindow.reduce((a, b) => a + b, 0) / this.recentEnergyWindow.length;
    const isCalm = avgEnergyWindow < 0.24 && rawSubBass < 0.35 && avgSubBass < 0.22;
    const musicMode: 'calm' | 'festival' = isCalm ? 'calm' : 'festival';

    // Drum Kick Detection (Specifically low-frequency percussive transient)
    let isKick = false;
    let kickIntensity = 0;
    const now = performance.now();

    if (this.kickHoldFrames > 0) {
      this.kickHoldFrames--;
    }
    const kickThreshold = avgSubBass * 1.35 + 0.12;
    if (rawSubBass > kickThreshold && rawSubBass > 0.32 && this.kickHoldFrames === 0 && (now - this.lastKickTime > 160)) {
      isKick = true;
      this.kickHoldFrames = 6;
      this.lastKickTime = now;
      kickIntensity = Math.min(1.0, (rawSubBass - kickThreshold) * 3.0 + 0.4);
    }

    // Drop Climax Detection (Massive wall of sub-bass in EDM / Melodic Dubstep)
    const isDropCondition = rawSubBass > 0.55 && rawRms > 0.42 && musicMode === 'festival';
    if (isDropCondition) {
      this.dropConfidence = Math.min(1.0, this.dropConfidence + 0.15);
    } else {
      this.dropConfidence = Math.max(0, this.dropConfidence - 0.05);
    }
    const isDrop = this.dropConfidence > 0.35;
    const dropIntensity = isDrop ? Math.min(1.0, rawSubBass * 0.6 + rawRms * 0.4) : 0;

    // Transient & Beat Onset Detection
    const instantEnergy = rawBass * 0.7 + rawRms * 0.3;
    this.energyHistory.push(instantEnergy);
    if (this.energyHistory.length > 40) {
      this.energyHistory.shift();
    }

    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const energyVariance = this.energyHistory.reduce((acc, val) => acc + Math.pow(val - avgEnergy, 2), 0) / this.energyHistory.length;
    const dynamicThreshold = avgEnergy + Math.max(0.08, Math.sqrt(energyVariance) * 1.4);

    let isBeat = false;
    let onsetStrength = 0;

    if (this.beatHoldFrames > 0) {
      this.beatHoldFrames--;
    }

    if (instantEnergy > dynamicThreshold && this.beatHoldFrames === 0 && (now - this.lastBeatTime > 220)) {
      isBeat = true;
      this.beatHoldFrames = 8;
      this.lastBeatTime = now;
      onsetStrength = Math.min(1, (instantEnergy - dynamicThreshold) * 3 + 0.4);
    }

    // Dynamic Live Mood Classifier (Librosa / Mood-Detector inspired)
    let mood: MusicMood = 'retro-groove';
    if (isDrop) {
      mood = 'euphoric-drop';
    } else if (isCalm) {
      mood = 'chill-ambient';
    } else if (this.smoothedCentroid > 0.58 && onsetStrength > 0.4) {
      mood = 'uplifting-melodic';
    } else if (this.smoothedSubBass > 0.48 && this.smoothedCentroid < 0.38) {
      mood = 'dark-aggressive';
    } else if (this.smoothedRms > 0.32) {
      mood = 'retro-groove';
    } else {
      mood = 'deep-hypnotic';
    }

    const deltaSeconds = Math.min(0.1, (now - this.lastFeatureTime) / 1000);
    this.lastFeatureTime = now;

    // Pre-computed 4-STEM Decomposition (Demucs Neural Stems)
    let stems: AudioStems;
    let instrumentalActivity = 0;
    let precomputedGlobalIntensity = 0;

    if (this.demucsStems) {
      const sampled = sampleStemValues(this.demucsStems, currentTime);
      stems = {
        kick: sampled.kick,
        bass: sampled.bass,
        instruments: sampled.instruments,
        vocals: sampled.vocals,
      };
      instrumentalActivity = sampled.instrumentalActivity;
      precomputedGlobalIntensity = sampled.globalIntensity;

      // True transient kick onset detection (avoids holding isKick true continuously during sustained drum sections)
      const isKickTransientSpike = sampled.kick > 0.38 && sampled.kick > this.currentKickStem * 1.20;
      if (sampled.isKickOnset || isKickTransientSpike) {
        isKick = true;
        kickIntensity = Math.max(kickIntensity, sampled.kickIntensity, sampled.kick);
      }
    } else {
      stems = StemSeparationService.extractRealtimeStems(
        this.frequencyData,
        this.timeDomainData,
        isKick,
        kickIntensity,
        this.currentKickStem,
        deltaSeconds
      );
    }
    this.currentKickStem = stems.kick;

    // Beat Grid Synchronization (Continuous phase, monotonic beat & bar indexing)
    const beatGrid = this.beatGridEngine.update(currentTime, isBeat, onsetStrength);

    return {
      timeSeconds: currentTime,
      rms: precomputedGlobalIntensity > 0 ? (this.smoothedRms * 0.3 + precomputedGlobalIntensity * 0.7) : this.smoothedRms,
      bass: this.demucsStems ? stems.bass : this.smoothedBass,
      subBass: this.demucsStems ? stems.bass : this.smoothedSubBass,
      lowMid: this.smoothedLowMid,
      highMid: this.smoothedHighMid,
      treble: this.smoothedTreble,
      spectralCentroid: this.smoothedCentroid,
      onsetStrength,
      beatConfidence: beatGrid.confidence,
      isBeat: beatGrid.isBeat,
      isKick,
      kickIntensity,
      isDrop,
      dropIntensity,
      musicMode,
      mood,
      stems,
      instrumentalActivity,
      globalIntensity: precomputedGlobalIntensity || this.smoothedRms,
      estimatedBpm: beatGrid.bpm,
      bpmSource: beatGrid.bpmSource || this.beatGridEngine.getBpmSource(),
      bpmConfidence: beatGrid.confidence,
      beatIndex: beatGrid.beatIndex,
      barIndex: beatGrid.barIndex,
      beatPhase: beatGrid.beatPhase,
      isBar: beatGrid.isBar,
      isPhrase: beatGrid.isPhrase,
      frequencyData: this.frequencyData,
      timeDomainData: this.timeDomainData,
      isAboveAverageAmplitude: this.isTriStemDropActive(currentTime),
      isTriStemDropActive: this.isTriStemDropActive(currentTime),
      trackAverageAmplitude: this.trackAverageAmplitude,
      currentAmplitude: precomputedGlobalIntensity > 0 ? (this.smoothedRms * 0.3 + precomputedGlobalIntensity * 0.7) : this.smoothedRms,
      lowFreqDistribution: (rawSubBass + rawBass) > 0.01 ? (rawSubBass / (rawSubBass + rawBass)) : 0.5,
      midRangeEnergy: this.demucsStems
        ? Math.min(1.0, stems.instruments * 0.65 + this.smoothedMidRangeEnergy * 0.35)
        : this.smoothedMidRangeEnergy,
      midSpectralCentroid: this.smoothedMidSpectralCentroid,
      midSpectralFlux: this.smoothedMidSpectralFlux,
      midEnergyDistribution: this.smoothedMidEnergyDistribution,
    };
  }

  public setTrackAnalysis(analysis: TrackAnalysis | null): void {
    this.trackAnalysis = analysis;
    if (analysis) {
      if (typeof analysis.averageAmplitude === 'number') {
        this.trackAverageAmplitude = analysis.averageAmplitude;
      }
      if (analysis.aboveAverageSections && analysis.aboveAverageSections.length > 0) {
        this.aboveAverageSections = analysis.aboveAverageSections;
      }
      if (analysis.triStemDropSections && analysis.triStemDropSections.length > 0) {
        this.triStemDropSections = analysis.triStemDropSections;
      }
      if (analysis.demucsStems) {
        this.setDemucsStems(analysis.demucsStems);
      }
    } else {
      this.trackAverageAmplitude = 0.30;
      this.aboveAverageSections = [];
      this.triStemDropSections = [];
    }
  }

  public getTrackAnalysis(): TrackAnalysis | null {
    return this.trackAnalysis;
  }

  /**
   * Pinpoints the drop segments where Kick (drums), Bass, and Instruments
   * ALL simultaneously exceed their full-track average amplitude values,
   * isolating the smaller segments where all 3 STEMs are at their highest joint amplitude.
   */
  private computeTriStemDropSections(data: DemucsStemData): void {
    const drums = data.stems.drums || [];
    const bass = data.stems.bass || [];
    const inst = data.stems.instruments || [];
    const fps = data.fps;

    const n = Math.min(drums.length, bass.length, inst.length);
    if (n < fps * 2) {
      this.triStemDropSections = [];
      return;
    }

    // 1. Calculate song-wide static average amplitude for each of the 3 stems
    let sumD = 0;
    let sumB = 0;
    let sumI = 0;
    for (let i = 0; i < n; i++) {
      sumD += drums[i];
      sumB += bass[i];
      sumI += inst[i];
    }
    const avgDrums = sumD / n;
    const avgBass = sumB / n;
    const avgInst = sumI / n;

    this.drumsAverageAmplitude = avgDrums;
    this.bassAverageAmplitude = avgBass;
    this.instAverageAmplitude = avgInst;

    // 2. Identify frames where ALL 3 STEMs simultaneously exceed their song averages
    const jointScores: number[] = new Array(n).fill(0);
    const qualifyingScores: number[] = [];

    for (let i = 0; i < n; i++) {
      const d = drums[i];
      const b = bass[i];
      const ins = inst[i];

      if (d > avgDrums && b > avgBass && ins > avgInst) {
        // Combined joint intensity of the 3 stems
        const score = (d + b + ins) / 3;
        jointScores[i] = score;
        qualifyingScores.push(score);
      }
    }

    if (qualifyingScores.length === 0) {
      this.triStemDropSections = [];
      return;
    }

    // 3. Pinpoint the highest amplitude segments (the smaller drop segments)
    qualifyingScores.sort((a, b) => a - b);
    // Take the 50th percentile of the qualifying set to isolate the highest-amplitude smaller segment
    const dropThreshold = qualifyingScores[Math.floor(qualifyingScores.length * 0.45)] || 0;

    // 4. Cluster contiguous qualifying frames into drop sections with hysteresis
    const sections: Array<{ startTime: number; endTime: number }> = [];
    let inSection = false;
    let secStart = 0;
    const minDurationSec = 0.4;

    for (let i = 0; i < n; i++) {
      const isDropFrame = jointScores[i] >= dropThreshold && jointScores[i] > 0;
      const t = i / fps;

      if (isDropFrame && !inSection) {
        inSection = true;
        secStart = t;
      } else if (!isDropFrame && inSection) {
        if (t - secStart >= minDurationSec) {
          sections.push({
            startTime: Number(secStart.toFixed(2)),
            endTime: Number(t.toFixed(2)),
          });
        }
        inSection = false;
      }
    }

    if (inSection) {
      const finalT = n / fps;
      if (finalT - secStart >= minDurationSec) {
        sections.push({
          startTime: Number(secStart.toFixed(2)),
          endTime: Number(finalT.toFixed(2)),
        });
      }
    }

    // Merge adjacent drop segments separated by small gaps (< 0.5s)
    const mergedSections: Array<{ startTime: number; endTime: number }> = [];
    for (const sec of sections) {
      const last = mergedSections[mergedSections.length - 1];
      if (last && sec.startTime - last.endTime <= 0.5) {
        last.endTime = Math.max(last.endTime, sec.endTime);
      } else {
        mergedSections.push({ ...sec });
      }
    }

    this.triStemDropSections = mergedSections;
    console.info(`[AudioEngine] Pinpointed ${mergedSections.length} tri-STEM drop segments (avgD: ${avgDrums.toFixed(2)}, avgB: ${avgBass.toFixed(2)}, avgI: ${avgInst.toFixed(2)})`);
  }

  public isTriStemDropActive(currentTime: number): boolean {
    if (this.triStemDropSections.length > 0) {
      return this.triStemDropSections.some(
        (sec) => currentTime >= sec.startTime && currentTime <= sec.endTime
      );
    }
    if (this.aboveAverageSections.length > 0) {
      return this.aboveAverageSections.some(
        (sec) => currentTime >= sec.startTime && currentTime <= sec.endTime
      );
    }
    if (this.demucsStems) {
      const sampled = sampleStemValues(this.demucsStems, currentTime);
      const isAboveAll =
        sampled.kick > this.drumsAverageAmplitude &&
        sampled.bass > this.bassAverageAmplitude &&
        sampled.instruments > this.instAverageAmplitude;
      const jointIntensity = (sampled.kick + sampled.bass + sampled.instruments) / 3;
      const avgJoint = (this.drumsAverageAmplitude + this.bassAverageAmplitude + this.instAverageAmplitude) / 3;
      return isAboveAll && jointIntensity >= avgJoint * 1.25;
    }
    // Real-time fallback
    const isAboveAll =
      this.currentKickStem > this.drumsAverageAmplitude &&
      this.smoothedBass > this.bassAverageAmplitude &&
      this.smoothedMidRangeEnergy > this.instAverageAmplitude;
    const jointIntensity = (this.currentKickStem + this.smoothedBass + this.smoothedMidRangeEnergy) / 3;
    const avgJoint = (this.drumsAverageAmplitude + this.bassAverageAmplitude + this.instAverageAmplitude) / 3;
    return isAboveAll && jointIntensity >= avgJoint * 1.25;
  }

  public isTimestampAboveAverage(currentTime: number): boolean {
    return this.isTriStemDropActive(currentTime);
  }

  public setTrackBeatGrid(
    trackId: string,
    preAnalyzedBpm?: number | null,
    confidence?: number,
    source?: 'shazamio' | 'demucs' | 'unavailable'
  ): void {
    this.beatGridEngine.setTrack(trackId, preAnalyzedBpm, confidence, source);
  }

  public setDemucsStems(data: DemucsStemData | null): void {
    this.demucsStems = data;
    if (data) {
      if (typeof data.averageAmplitude === 'number') {
        this.trackAverageAmplitude = data.averageAmplitude;
      }
      if (data.aboveAverageSections && data.aboveAverageSections.length > 0) {
        this.aboveAverageSections = data.aboveAverageSections;
      }
      if (data.stems && data.fps > 0) {
        this.computeTriStemDropSections(data);
      }
    } else {
      this.triStemDropSections = [];
    }
  }

  public getDemucsStems(): DemucsStemData | null {
    return this.demucsStems;
  }

  public setManualBpm(bpm: number): void {
    this.beatGridEngine.setBpm(bpm, 'demucs', true);
  }

  public getBeatGridState(): BeatGridState {
    return this.beatGridEngine.getState();
  }

  public dispose(): void {
    this.audioElement.pause();
    this.audioElement.src = '';
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
