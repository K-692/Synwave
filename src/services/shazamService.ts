/**
 * Synwave Shazam Recognition Client Service
 * Communicates with the local ShazamIO Python backend (http://127.0.0.1:8765).
 * Features stable fingerprint-based caching, server disk store (.synwave_cache/shazam),
 * AbortController timeouts to guarantee non-blocking execution, and seamless graceful fallback handling.
 */

import type { ShazamMatchMetadata } from '../types';

export type ShazamMatch = ShazamMatchMetadata;

const SHAZAM_ENDPOINT = 'http://127.0.0.1:8765/api/recognize';
const SHAZAM_CHECK_ENDPOINT = 'http://127.0.0.1:8765/api/check-shazam-cache';
const SHAZAM_CACHE_STORAGE_KEY = 'synwave_shazam_cache_v2';
const DEFAULT_RECOGNITION_TIMEOUT_MS = 15000;

// In-memory cache for ultra-fast instantaneous lookups within the active session
const inMemoryCache = new Map<string, ShazamMatch>();

/**
 * Initializes in-memory cache from browser localStorage where available.
 */
function initializeCacheFromStorage(): void {
  try {
    const raw = localStorage.getItem(SHAZAM_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          if (value && typeof value === 'object') {
            inMemoryCache.set(key, value as ShazamMatch);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ShazamService] Failed to load persisted recognition cache:', err);
  }
}

// Hydrate cache on module evaluation
initializeCacheFromStorage();

/**
 * Persists active in-memory cache to browser localStorage.
 */
function persistCacheToStorage(): void {
  try {
    const record: Record<string, ShazamMatch> = {};
    for (const [key, value] of inMemoryCache.entries()) {
      record[key] = value;
    }
    localStorage.setItem(SHAZAM_CACHE_STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    // Gracefully handle storage quotas or privacy mode restrictions
    console.warn('[ShazamService] LocalStorage persist notice:', err);
  }
}

/**
 * Compute a stable audio fingerprint or identifier key for a track / file.
 * Used for exact-match caching to prevent re-recognizing already identified audio
 * and prevent cross-track metadata contamination.
 */
export function getTrackFingerprint(fileOrPath: File | Blob | string): string {
  if (typeof fileOrPath === 'string') {
    // Normalise path separators and lowercase for uniform string matching
    const cleanPath = fileOrPath.replace(/\\/g, '/').trim().toLowerCase();
    return `path:${cleanPath}`;
  }

  if (fileOrPath instanceof File) {
    // Use filename, exact byte length, and last modified timestamp for uniqueness
    return `file:${fileOrPath.name}:${fileOrPath.size}:${fileOrPath.lastModified}`;
  }

  // Blob fallback based on size and mime-type
  return `blob:${fileOrPath.size}:${fileOrPath.type}`;
}

/**
 * Retrieve cached Shazam recognition match by track fingerprint from in-memory cache.
 */
export function getCachedShazamMatch(fingerprint: string): ShazamMatch | null {
  const match = inMemoryCache.get(fingerprint);
  if (match) {
    // Return an isolated shallow clone with cached flag to prevent mutation crosstalk
    return { ...match, cached: true };
  }
  return null;
}

/**
 * Save a verified Shazam recognition match to memory and persistent storage.
 */
export function setCachedShazamMatch(fingerprint: string, match: ShazamMatch): void {
  if (match.success && match.title) {
    inMemoryCache.set(fingerprint, { ...match, cached: false });
    persistCacheToStorage();
  }
}

/**
 * Clear the recognition cache (useful for testing or diagnostic resets).
 */
export function clearShazamCache(): void {
  inMemoryCache.clear();
  try {
    localStorage.removeItem(SHAZAM_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

export interface ShazamRecognitionOptions {
  timeoutMs?: number;
  customFingerprint?: string;
  songTitle?: string;
  songArtist?: string;
  bypassCache?: boolean;
}

/**
 * Ultra-fast server disk cache verification (<5ms).
 * Checks if the Python microservice has already persisted recognition in .synwave_cache/shazam/.
 */
export async function checkServerShazamCache(
  fingerprint?: string,
  songTitle?: string,
  songArtist?: string
): Promise<{ status: 'hit'; match: ShazamMatch } | { status: 'miss' } | { status: 'offline' }> {
  try {
    const formData = new FormData();
    if (fingerprint) formData.append('fingerprint', fingerprint);
    if (songTitle) formData.append('songTitle', songTitle);
    if (songArtist) formData.append('songArtist', songArtist);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(SHAZAM_CHECK_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return { status: 'miss' };
    const data = await response.json();
    if (data.success && data.cached && data.title) {
      return { status: 'hit', match: { ...data, cached: true } };
    }
    return { status: 'miss' };
  } catch {
    return { status: 'offline' };
  }
}

/**
 * Recognize an audio track using ShazamIO via the local Python microservice.
 * - Always runs BEFORE Stage STEM extraction.
 * - Prioritizes .synwave_cache/shazam/ on disk when microservice is online.
 * - If server disk cache is absent, runs live Shazam recognition and persists to .synwave_cache/shazam/.
 * - Falls back to browser localStorage only if the local Python microservice is completely offline.
 * - Enforces an AbortController timeout so processing NEVER hangs indefinitely.
 */
export async function identifyAudioWithShazam(
  fileOrPath: File | Blob | string,
  options?: ShazamRecognitionOptions
): Promise<ShazamMatch> {
  const fingerprint = options?.customFingerprint || getTrackFingerprint(fileOrPath);

  // 1. Check server disk cache unless explicitly bypassed
  if (!options?.bypassCache) {
    const serverCheck = await checkServerShazamCache(fingerprint, options?.songTitle, options?.songArtist);

    if (serverCheck.status === 'hit') {
      console.info(
        `[ShazamService] Disk cache hit (.synwave_cache/shazam) for [${fingerprint}]: "${serverCheck.match.title}" by "${serverCheck.match.artist}"`
      );
      setCachedShazamMatch(fingerprint, serverCheck.match);
      return serverCheck.match;
    }

    if (serverCheck.status === 'offline') {
      // Python microservice is offline — use offline browser storage fallback
      const offlineHit = getCachedShazamMatch(fingerprint);
      if (offlineHit) {
        console.info(
          `[ShazamService] Microservice offline — using offline browser cache for [${fingerprint}]: "${offlineHit.title}"`
        );
        return offlineHit;
      }
    }
    // If status is 'miss', the Python server is online but .synwave_cache does NOT have this track yet.
    // Proceed to call /api/recognize to perform live identification and write .synwave_cache!
  }

  // 2. Setup FormData according to input type (File or local server path)
  const formData = new FormData();
  formData.append('fingerprint', fingerprint);

  if (typeof fileOrPath === 'string') {
    let resolvedPath = fileOrPath;
    if (resolvedPath.startsWith('/music/')) {
      resolvedPath = `public${resolvedPath}`;
    }
    formData.append('filePath', resolvedPath);
  } else {
    const filename = (fileOrPath as File).name || 'audio_snippet.mp3';
    formData.append('file', fileOrPath, filename);
  }

  // 3. Setup AbortController for reliable timeout protection
  const timeoutMs = options?.timeoutMs ?? DEFAULT_RECOGNITION_TIMEOUT_MS;
  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    console.info(`[ShazamService] Initiating recognition for [${fingerprint}] via microservice (timeout: ${timeoutMs}ms)...`);
    const response = await fetch(SHAZAM_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Shazam service returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ShazamMatch = await response.json();

    if (data.success && data.title) {
      console.info(
        `[ShazamService] Recognition successful: "${data.title}" by "${data.artist || 'Unknown'}" (cached to .synwave_cache/shazam)`
      );
      // Cache successful recognition result keyed by stable audio fingerprint
      setCachedShazamMatch(fingerprint, data);
      return { ...data, cached: Boolean(data.cached) };
    } else {
      console.warn('[ShazamService] Audio unrecognized by Shazam database.');
      return {
        success: false,
        error: data.error || 'No recognition match found',
      };
    }
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = (err as Error)?.name === 'AbortError';
    const message = isTimeout
      ? `Shazam recognition timed out after ${timeoutMs}ms`
      : ((err as Error)?.message || 'Recognition service request failed');

    console.warn(`[ShazamService] Recognition attempt failed: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}
