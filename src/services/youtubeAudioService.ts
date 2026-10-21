/**
 * Synwave YouTube Audio Extraction & Neural Demucs Client Service
 * 
 * Interacts with the local Python microservice (http://127.0.0.1:8765) to:
 * - Extract and stream WAV audio from YouTube links via yt-dlp
 * - Retrieve Demucs 4-stem envelopes, kick onsets, and tempo grids
 * - Cache everything persistently under .synwave_cache by YouTube URL
 */

import type { DemucsStemData } from '../types';

export interface YouTubeProcessResult {
  success: boolean;
  cached: boolean;
  youtubeUrl: string;
  videoId: string;
  uniqueId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  duration?: number;
  thumbnailUrl: string;
  audioUrl: string;
  stems: DemucsStemData;
  error?: string;
  kickEvents?: { time: number; intensity: number }[];
  kickOnsets?: number[];
  instrumentalActivity?: number[];
  globalIntensity?: number[];
  averageAmplitude?: number;
  aboveAverageSections?: { startTime: number; endTime: number }[];
  triStemDropSections?: { startTime: number; endTime: number }[];
  demucsBpm?: {
    bpm: number | null;
    candidateBpm?: number | null;
    confidence: number;
    source: 'demucs' | 'unavailable';
  };
}

const SERVER_ENDPOINT = 'http://127.0.0.1:8765';

/**
 * Extracts the 11-character YouTube video ID from any standard or shorthand URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  const patterns = [
    /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?\/]|$)/,
    /youtu\.be\/([0-9A-Za-z_-]{11})/,
    /embed\/([0-9A-Za-z_-]{11})/,
    /shorts\/([0-9A-Za-z_-]{11})/,
    /^([0-9A-Za-z_-]{11})$/,
  ];

  for (const regex of patterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Quick ping to check if the Python microservice is online and accessible.
 */
export async function checkMicroserviceHealth(): Promise<{
  online: boolean;
  device?: string;
  hardwareAccel?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SERVER_ENDPOINT}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        device: data.device,
        hardwareAccel: data.hardware_accel,
      };
    }
  } catch {
    // Offline
  }
  return { online: false };
}

/**
 * Sends YouTube link to the Python microservice for audio extraction and Demucs stem separation.
 */
export async function processYouTubeUrl(
  youtubeUrl: string,
  onProgress?: (message: string) => void
): Promise<YouTubeProcessResult> {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error(
      `Invalid YouTube URL: "${youtubeUrl}". Please provide a valid YouTube link (e.g. https://www.youtube.com/watch?v=...)`
    );
  }

  onProgress?.('Contacting audio processing microservice...');

  const response = await fetch(`${SERVER_ENDPOINT}/api/youtube/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: youtubeUrl }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData.detail || `Server error (HTTP ${response.status}): ${response.statusText}`;
    throw new Error(message);
  }

  const result: YouTubeProcessResult = await response.json();
  return result;
}
