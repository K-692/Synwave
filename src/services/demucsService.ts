/**
 * Synwave Demucs Client Service
 * Communicates with the local Python Demucs microservice to extract 4 stems
 * (drums, bass, instruments, vocals) and provides frame-accurate stem amplitudes
 * at any audio playback timestamp.
 */

import type { DemucsStemData } from '../types';

export interface StemSeparationResult {
  success: boolean;
  cached?: boolean;
  fileHash?: string;
  fps?: number;
  durationSeconds?: number;
  stems?: {
    drums: number[];
    bass: number[];
    instruments: number[];
    vocals: number[];
  };
  kickOnsets?: number[];
  error?: string;
}

/**
 * Request 4-stem separation from the local Demucs microservice.
 */
export async function separateAudioWithDemucs(
  fileOrPath: File | string,
  onProgress?: (status: string) => void
): Promise<DemucsStemData | null> {
  const SERVER_URL = 'http://127.0.0.1:8765/api/separate-stems';

  const formData = new FormData();
  if (typeof fileOrPath === 'string') {
    // If it's a URL in public directory or path
    let resolvedPath = fileOrPath;
    if (resolvedPath.startsWith('/music/')) {
      // Map web public url to local filesystem path
      resolvedPath = `public${resolvedPath}`;
    }
    formData.append('filePath', resolvedPath);
  } else {
    formData.append('file', fileOrPath, fileOrPath.name);
  }

  try {
    onProgress?.('Initializing Demucs neural model (HTDemucs)...');
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Demucs server HTTP ${response.status}: ${response.statusText}`);
    }

    const data: StemSeparationResult = await response.json();
    if (data.success && data.stems && data.fps) {
      return {
        fps: data.fps,
        durationSeconds: data.durationSeconds || 0,
        stems: {
          drums: data.stems.drums || [],
          bass: data.stems.bass || [],
          instruments: data.stems.instruments || [],
          vocals: data.stems.vocals || [],
        },
        kickOnsets: data.kickOnsets || [],
      };
    } else {
      console.warn('[DemucsService] Stem separation unfulfilled:', data.error);
      return null;
    }
  } catch (err) {
    console.warn('[DemucsService] Demucs service unavailable:', err);
    return null;
  }
}

/**
 * Sample stem values at any exact audio playback timestamp (with linear interpolation).
 */
export function sampleStemValues(
  data: DemucsStemData | null | undefined,
  timeSeconds: number
): { kick: number; bass: number; instruments: number; vocals: number; isKickOnset: boolean } {
  if (!data || !data.stems || data.fps <= 0) {
    return { kick: 0, bass: 0, instruments: 0, vocals: 0, isKickOnset: false };
  }

  const samplePos = timeSeconds * data.fps;
  const i0 = Math.floor(samplePos);
  const i1 = i0 + 1;
  const frac = samplePos - i0;

  const sampleStem = (arr?: number[]) => {
    if (!arr || arr.length === 0) return 0;
    if (i0 < 0) return arr[0] || 0;
    if (i0 >= arr.length - 1) return arr[arr.length - 1] || 0;
    const v0 = arr[i0] ?? 0;
    const v1 = arr[i1] ?? v0;
    return v0 + (v1 - v0) * frac;
  };

  const kick = sampleStem(data.stems.drums);
  const bass = sampleStem(data.stems.bass);
  const instruments = sampleStem(data.stems.instruments);
  const vocals = sampleStem(data.stems.vocals);

  // Check if near kick onset
  let isKickOnset = false;
  if (data.kickOnsets && data.kickOnsets.length > 0) {
    for (const onset of data.kickOnsets) {
      if (Math.abs(timeSeconds - onset) < 0.08) {
        isKickOnset = true;
        break;
      }
    }
  }

  return {
    kick,
    bass,
    instruments,
    vocals,
    isKickOnset,
  };
}
