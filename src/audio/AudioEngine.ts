/**
 * Synwave Audio Engine
 * Manages Web Audio API graph, authoritative media clock, and real-time audio feature extraction.
 */

import type { AudioFeatures } from '../types';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private frequencyData: Uint8Array<ArrayBuffer>;
  private timeDomainData: Uint8Array<ArrayBuffer>;

  // Smoothed feature caches for visual continuity
  private smoothedRms = 0;
  private smoothedBass = 0;
  private smoothedLowMid = 0;
  private smoothedHighMid = 0;
  private smoothedTreble = 0;
  private smoothedCentroid = 0;

  // Transient beat detection state
  private energyHistory: number[] = [];
  private beatHoldFrames = 0;
  private lastBeatTime = 0;

  // Callbacks
  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;
  public onTrackEnded?: () => void;
  public onError?: (error: Error) => void;

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

    this.audioElement.addEventListener('play', () => {
      this.onPlayStateChange?.(true);
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
   * Loads a track by audio URL or Object URL.
   */
  public async loadTrack(url: string, autoPlay = false): Promise<void> {
    try {
      this.audioElement.src = url;
      this.audioElement.load();

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
        lowMid: Math.max(0, this.smoothedLowMid * 0.9),
        highMid: Math.max(0, this.smoothedHighMid * 0.9),
        treble: Math.max(0, this.smoothedTreble * 0.9),
        spectralCentroid: this.smoothedCentroid,
        onsetStrength: 0,
        beatConfidence: 0,
        isBeat: false,
        frequencyData: this.frequencyData,
        timeDomainData: this.timeDomainData,
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
    // Sub-bass & Bass: 20 - 250 Hz -> bins 1 to 12
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
    this.smoothedLowMid = lerp(this.smoothedLowMid, rawLowMid, 0.35);
    this.smoothedHighMid = lerp(this.smoothedHighMid, rawHighMid, 0.35);
    this.smoothedTreble = lerp(this.smoothedTreble, rawTreble, 0.35);
    this.smoothedCentroid = lerp(this.smoothedCentroid, rawCentroid, 0.25);

    // Transient & Beat Onset Detection
    // Combines bass surge + sudden broadband flux
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

    const now = performance.now();
    if (this.beatHoldFrames > 0) {
      this.beatHoldFrames--;
    }

    if (instantEnergy > dynamicThreshold && this.beatHoldFrames === 0 && (now - this.lastBeatTime > 220)) {
      isBeat = true;
      this.beatHoldFrames = 8;
      this.lastBeatTime = now;
      onsetStrength = Math.min(1, (instantEnergy - dynamicThreshold) * 3 + 0.4);
    }

    return {
      timeSeconds: currentTime,
      rms: this.smoothedRms,
      bass: this.smoothedBass,
      lowMid: this.smoothedLowMid,
      highMid: this.smoothedHighMid,
      treble: this.smoothedTreble,
      spectralCentroid: this.smoothedCentroid,
      onsetStrength,
      beatConfidence: isBeat ? 0.9 : 0.2,
      isBeat,
      frequencyData: this.frequencyData,
      timeDomainData: this.timeDomainData,
    };
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
