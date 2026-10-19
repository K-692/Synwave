/**
 * Synwave Shazam Recognition Client Service
 * Communicates with the local ShazamIO Python backend (http://127.0.0.1:8765).
 * Features stable fingerprint-based caching, AbortController timeouts to guarantee
 * non-blocking execution, and seamless graceful fallback handling.
 */

import type { ShazamMatchMetadata } from '../types';

export type ShazamMatch = ShazamMatchMetadata;

const SHAZAM_ENDPOINT = 'http://127.0.0.1:8765/api/recognize';
const SHAZAM_CACHE_STORAGE_KEY = 'synwave_shazam_cache_v2';
const DEFAULT_RECOGNITION_TIMEOUT_MS = 9000;

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
 * Retrieve cached Shazam recognition match by track fingerprint.
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
  bypassCache?: boolean;
}

/**
 * Recognize an audio track using ShazamIO via the local Python microservice.
 * - Always runs BEFORE Stage STEM extraction.
 * - Returns cached metadata instantly if previously recognized.
 * - Enforces an AbortController timeout (default 9s) so processing NEVER hangs indefinitely.
 * - Returns a structured failure payload on error, allowing downstream steps to fall back safely.
 */
export async function identifyAudioWithShazam(
  fileOrPath: File | Blob | string,
  options?: ShazamRecognitionOptions
): Promise<ShazamMatch> {
  const fingerprint = options?.customFingerprint || getTrackFingerprint(fileOrPath);

  // 1. Check cache first unless explicitly bypassed
  if (!options?.bypassCache) {
    const cached = getCachedShazamMatch(fingerprint);
    if (cached) {
      console.info(
        `[ShazamService] Recognition cache hit for [${fingerprint}]: "${cached.title}" by "${cached.artist}"`
      );
      return cached;
    }
  }

  // 2. Setup FormData according to input type (File or local server path)
  const formData = new FormData();
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
    console.info(`[ShazamService] Initiating recognition for [${fingerprint}] (timeout: ${timeoutMs}ms)...`);
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
        `[ShazamService] Recognition successful: "${data.title}" by "${data.artist || 'Unknown'}"`
      );
      // Cache successful recognition result keyed by stable audio fingerprint
      setCachedShazamMatch(fingerprint, data);
      return { ...data, cached: false };
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

    console.warn(`[ShazamService] Recognition attempt completed with fallback: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}
