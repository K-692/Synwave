/**
 * Synwave Offline Audio Analyzer
 * Decodes audio in memory and produces pre-computed feature timelines,
 * estimated BPM, dynamic section boundaries, and deterministic visual choreographies.
 */

import type { FeatureFrame, SectionEvent, TimedEvent, TrackAnalysis } from '../types';

export class AudioAnalyzer {
  private static cache = new Map<string, TrackAnalysis>();

  /**
   * Analyzes an audio file or URL asynchronously by decoding its PCM audio buffer.
   */
  public static async analyzeTrack(trackId: string, audioSource: File | string): Promise<TrackAnalysis> {
    if (this.cache.has(trackId)) {
      return this.cache.get(trackId)!;
    }

    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof audioSource === 'string') {
        const response = await fetch(audioSource);
        arrayBuffer = await response.arrayBuffer();
      } else {
        arrayBuffer = await audioSource.arrayBuffer();
      }

      // Use an OfflineAudioContext for fast headless audio decoding
      const sampleRate = 44100;
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();

      const duration = decodedBuffer.duration;
      const channelData = decodedBuffer.getChannelData(0); // Primary channel
      const totalSamples = channelData.length;

      // Analysis hop: 50ms frames = 20 frames per second
      const hopSize = Math.floor(sampleRate * 0.05);
      const windowSize = Math.floor(sampleRate * 0.1); // 100ms window with 50% overlap
      const numFrames = Math.floor((totalSamples - windowSize) / hopSize);

      const frames: FeatureFrame[] = [];
      const onsets: TimedEvent[] = [];
      let totalRms = 0;
      let totalCentroid = 0;

      // Extract frame features
      for (let i = 0; i < numFrames; i++) {
        const start = i * hopSize;
        const timeSeconds = start / sampleRate;

        let sumSquares = 0;
        let zeroCrossings = 0;
        let prevSample = 0;

        for (let j = 0; j < windowSize; j++) {
          const sample = channelData[start + j] || 0;
          sumSquares += sample * sample;
          if (j > 0 && ((sample >= 0 && prevSample < 0) || (sample < 0 && prevSample >= 0))) {
            zeroCrossings++;
          }
          prevSample = sample;
        }

        const rms = Math.min(1, Math.sqrt(sumSquares / windowSize) * 2.5);
        totalRms += rms;

        // Approximate spectral brightness via Zero Crossing Rate (ZCR) proxy
        const spectralCentroid = Math.min(1, (zeroCrossings / windowSize) * 5.0);
        totalCentroid += spectralCentroid;

        // Band approximations for pre-planning
        const bass = Math.min(1, rms * (1.2 - spectralCentroid * 0.6));
        const lowMid = Math.min(1, rms * 0.9);
        const highMid = Math.min(1, rms * (0.5 + spectralCentroid * 0.5));
        const treble = Math.min(1, spectralCentroid * rms * 1.5);

        // Transient onset detection by comparing against previous frame RMS
        const prevRms = frames.length > 0 ? frames[frames.length - 1].rms : 0;
        const onsetStrength = Math.max(0, rms - prevRms);

        frames.push({
          timeSeconds,
          rms,
          bass,
          lowMid,
          highMid,
          treble,
          spectralCentroid,
          onsetStrength,
        });

        // Threshold for prominent onsets
        if (onsetStrength > 0.25) {
          onsets.push({
            timeSeconds,
            type: 'beat',
            confidence: Math.min(1, onsetStrength * 2),
            label: 'detected_onset',
          });
        }
      }

      // Estimate BPM using Inter-Onset Interval (IOI) histogram
      const estimatedBpm = this.estimateBpmFromOnsets(onsets);

      // Section boundary segmentation (intro, build, drop, breakdown, outro)
      const sections = this.detectSections(frames, duration);

      // Descriptors
      const avgRms = frames.length > 0 ? totalRms / frames.length : 0.3;
      const avgCentroid = frames.length > 0 ? totalCentroid / frames.length : 0.5;
      const onsetRate = onsets.length / Math.max(1, duration);

      const analysis: TrackAnalysis = {
        schemaVersion: 1,
        trackId,
        durationSeconds: duration,
        estimatedBpm,
        bpmConfidence: 0.85,
        frames,
        events: onsets,
        sections,
        descriptors: {
          energy: avgRms > 0.45 ? 'high' : avgRms > 0.22 ? 'medium' : 'low',
          brightness: avgCentroid > 0.6 ? 'bright' : avgCentroid > 0.35 ? 'balanced' : 'dark',
          transientDensity: onsetRate > 2.5 ? 'dense' : onsetRate > 1.2 ? 'moderate' : 'sparse',
          rhythmicRegularity: estimatedBpm > 0 ? 'steady' : 'variable',
        },
      };

      this.cache.set(trackId, analysis);
      return analysis;
    } catch (err) {
      console.warn('Offline analysis warning, generating synthetic feature timeline:', err);
      // Fallback synthetic analysis so playback never blocks
      return this.createFallbackAnalysis(trackId);
    }
  }

  /**
   * Estimates tempo (BPM) based on time delta intervals between prominent onsets.
   */
  private static estimateBpmFromOnsets(onsets: TimedEvent[]): number {
    if (onsets.length < 4) return 128; // Standard default EDM/Electronic tempo

    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      const delta = onsets[i].timeSeconds - onsets[i - 1].timeSeconds;
      if (delta >= 0.28 && delta <= 1.0) { // Valid musical intervals (60 - 210 BPM)
        intervals.push(delta);
      }
    }

    if (intervals.length === 0) return 128;

    // Convert intervals to BPM candidates
    const bpmCandidates = intervals.map(dt => Math.round(60 / dt));
    const frequencyMap = new Map<number, number>();

    for (const bpm of bpmCandidates) {
      // Group in buckets of +/- 2 BPM
      const rounded = Math.round(bpm / 2) * 2;
      frequencyMap.set(rounded, (frequencyMap.get(rounded) || 0) + 1);
    }

    let topBpm = 128;
    let maxCount = 0;
    frequencyMap.forEach((count, bpm) => {
      if (count > maxCount && bpm >= 70 && bpm <= 180) {
        maxCount = count;
        topBpm = bpm;
      }
    });

    return topBpm;
  }

  /**
   * Segments the song into structural sections based on energy trajectory.
   */
  private static detectSections(frames: FeatureFrame[], duration: number): SectionEvent[] {
    const sections: SectionEvent[] = [];
    if (duration <= 10) {
      return [{
        startTime: 0,
        endTime: duration,
        type: 'drop',
        label: 'FULL MIX',
        energyLevel: 0.8,
      }];
    }

    // Macro structural chunks (e.g., ~15-30s blocks)
    const chunkSize = Math.max(10, Math.floor(duration / 6));
    const numChunks = Math.ceil(duration / chunkSize);

    for (let c = 0; c < numChunks; c++) {
      const startTime = c * chunkSize;
      const endTime = Math.min(duration, (c + 1) * chunkSize);

      // Calculate average RMS in this section
      const chunkFrames = frames.filter(f => f.timeSeconds >= startTime && f.timeSeconds < endTime);
      const avgRms = chunkFrames.length > 0
        ? chunkFrames.reduce((acc, f) => acc + f.rms, 0) / chunkFrames.length
        : 0.4;

      let type: SectionEvent['type'] = 'build';
      let label = 'BUILD';

      if (c === 0) {
        type = 'intro';
        label = 'INTRO';
      } else if (c === numChunks - 1) {
        type = 'outro';
        label = 'OUTRO';
      } else if (avgRms > 0.42) {
        type = 'drop';
        label = 'CLIMAX / DROP';
      } else if (avgRms < 0.2) {
        type = 'breakdown';
        label = 'BREAKDOWN';
      }

      sections.push({
        startTime,
        endTime,
        type,
        label,
        energyLevel: Math.min(1, avgRms * 1.5),
      });
    }

    return sections;
  }

  private static createFallbackAnalysis(trackId: string): TrackAnalysis {
    return {
      schemaVersion: 1,
      trackId,
      durationSeconds: 180,
      estimatedBpm: 128,
      bpmConfidence: 0.6,
      frames: [],
      events: [],
      sections: [
        { startTime: 0, endTime: 30, type: 'intro', label: 'INTRO', energyLevel: 0.3 },
        { startTime: 30, endTime: 60, type: 'build', label: 'BUILD', energyLevel: 0.6 },
        { startTime: 60, endTime: 120, type: 'drop', label: 'DROP', energyLevel: 0.9 },
        { startTime: 120, endTime: 150, type: 'breakdown', label: 'BREAKDOWN', energyLevel: 0.4 },
        { startTime: 150, endTime: 180, type: 'outro', label: 'OUTRO', energyLevel: 0.3 },
      ],
      descriptors: {
        energy: 'medium',
        brightness: 'balanced',
        transientDensity: 'moderate',
        rhythmicRegularity: 'steady',
      },
    };
  }

  public static clearCache(): void {
    this.cache.clear();
  }
}
