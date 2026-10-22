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
  spotlightAnalysis?: DemucsStemData['spotlightAnalysis'];
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

export interface PlaylistItem {
  videoId: string;
  uniqueId?: string;
  title: string;
  artist: string;
  duration: number;
  durationSeconds?: number;
  thumbnailUrl: string;
  youtubeUrl: string;
  audioUrl: string;
  cached?: boolean;
  hasStems?: boolean;
  hasDemucsStems?: boolean;
  bpm?: number | null;
  processedAt?: number;
}

/**
 * Retrieves all processed and cached songs from the backend service.
 * Automatically synchronizes with local persistent storage for instant offline availability.
 */
export async function fetchProcessedPlaylist(): Promise<PlaylistItem[]> {
  try {
    const res = await fetch(`${SERVER_ENDPOINT}/api/playlist`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.tracks)) {
        try {
          localStorage.setItem('synwave_processed_playlist', JSON.stringify(data.tracks));
        } catch {
          // ignore
        }
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn('[YouTubeAudioService] Backend playlist query warning:', err);
  }

  // Fallback to local storage if server is starting up
  try {
    const saved = localStorage.getItem('synwave_processed_playlist');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Saves or updates a processed track at the top of the local persistent playlist.
 */
export function saveTrackToLocalPlaylist(item: PlaylistItem): void {
  try {
    const saved = localStorage.getItem('synwave_processed_playlist');
    let list: PlaylistItem[] = saved ? JSON.parse(saved) : [];
    list = list.filter((t) => t.videoId !== item.videoId);
    list.unshift(item);
    localStorage.setItem('synwave_processed_playlist', JSON.stringify(list));
  } catch {
    // ignore
  }
}
