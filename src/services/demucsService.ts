import type { DemucsStemData } from '../types';

export function getTrackFingerprint(fileOrPath: File | string): string {
  if (typeof fileOrPath === 'string') {
    return `fp-${fileOrPath}`;
  }
  return `fp-${fileOrPath.name}-${fileOrPath.size}-${fileOrPath.lastModified}`;
}

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
  kickEvents?: { time: number; intensity: number }[];
  instrumentalActivity?: number[];
  globalIntensity?: number[];
  demucsBpm?: {
    bpm?: number | null;
    candidateBpm?: number | null;
    confidence?: number;
    source?: string;
  };
  averageAmplitude?: number;
  aboveAverageSections?: Array<{ startTime: number; endTime: number }>;
  triStemDropSections?: Array<{ startTime: number; endTime: number }>;
  drumsAverageAmplitude?: number;
  bassAverageAmplitude?: number;
  instAverageAmplitude?: number;
  spotlightAnalysis?: import('../types').SpotlightAnalysisData;
  error?: string;
}

export interface StemSeparationOptions {
  fingerprint?: string;
  songTitle?: string;
  songArtist?: string;
  onProgress?: (status: string) => void;
}

// -----------------------------------------------------------------------------
// 1. In-Memory Stem Cache (Instantaneous 0ms access within active browser session)
// -----------------------------------------------------------------------------
const inMemoryStemCache = new Map<string, DemucsStemData>();

// -----------------------------------------------------------------------------
// 2. Persistent IndexedDB Cache (High-capacity, survives page reloads & browser restarts)
// -----------------------------------------------------------------------------
const DB_NAME = 'synwave_stems_db';
const DB_VERSION = 1;
const STORE_NAME = 'stems_v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[DemucsService] IndexedDB open error:', request.error);
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

/**
 * Compute unique song key based on normalized track title and artist.
 */
export function getSongIdentityKey(title?: string, artist?: string): string | undefined {
  if (!title) return undefined;
  const cleanTitle = title.trim().toLowerCase();
  const cleanArtist = (artist || '').trim().toLowerCase();
  return `song:${cleanTitle}:::${cleanArtist}`;
}

/**
 * Retrieve cached stem data from in-memory cache or IndexedDB across multiple candidate keys.
 */
export async function getCachedStemData(
  candidateKeys: (string | undefined | null)[]
): Promise<{ data: DemucsStemData; source: 'memory' | 'indexeddb' } | null> {
  const validKeys = candidateKeys.filter((k): k is string => Boolean(k && k.trim().length > 0));

  // 1. Check in-memory cache
  for (const key of validKeys) {
    const memoryHit = inMemoryStemCache.get(key);
    if (memoryHit) {
      return { data: memoryHit, source: 'memory' };
    }
  }

  // 2. Check IndexedDB
  try {
    const db = await getIndexedDB();
    for (const key of validKeys) {
      const hit = await new Promise<DemucsStemData | null>((resolve) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result && req.result.data) {
              resolve(req.result.data as DemucsStemData);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (hit) {
        // Hydrate in-memory cache for all valid keys
        for (const k of validKeys) {
          inMemoryStemCache.set(k, hit);
        }
        return { data: hit, source: 'indexeddb' };
      }
    }
  } catch (err) {
    console.warn('[DemucsService] IndexedDB cache read bypass:', err);
  }

  return null;
}

/**
 * Persist computed stem data to in-memory cache and IndexedDB under all candidate keys.
 */
export async function saveCachedStemData(
  candidateKeys: (string | undefined | null)[],
  data: DemucsStemData
): Promise<void> {
  const validKeys = candidateKeys.filter((k): k is string => Boolean(k && k.trim().length > 0));
  if (validKeys.length === 0 || !data || !data.stems) return;

  // 1. Populate in-memory cache
  for (const key of validKeys) {
    inMemoryStemCache.set(key, data);
  }

  // 2. Persist to IndexedDB
  try {
    const db = await getIndexedDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const now = Date.now();

    for (const key of validKeys) {
      store.put({
        key,
        data,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('[DemucsService] IndexedDB cache write bypass:', err);
  }
}

/**
 * Ultra-fast server disk cache verification (<15ms).
 * Checks whether the Python microservice already has pre-computed stems on disk in .synwave_cache/stems/.
 */
export async function checkServerStemsCache(
  fingerprint?: string,
  songTitle?: string,
  songArtist?: string
): Promise<{ status: 'hit'; data: DemucsStemData } | { status: 'miss' } | { status: 'offline' }> {
  const CHECK_URL = 'http://127.0.0.1:8765/api/check-stems-cache';
  try {
    const formData = new FormData();
    if (fingerprint) formData.append('fingerprint', fingerprint);
    if (songTitle) formData.append('songTitle', songTitle);
    if (songArtist) formData.append('songArtist', songArtist);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(CHECK_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return { status: 'miss' };
    const data: StemSeparationResult = await response.json();
    if (data.success && data.cached && data.stems && data.fps) {
      return {
        status: 'hit',
        data: {
          fps: data.fps,
          durationSeconds: data.durationSeconds || 0,
          stems: {
            drums: data.stems.drums || [],
            bass: data.stems.bass || [],
            instruments: data.stems.instruments || [],
            vocals: data.stems.vocals || [],
          },
          kickEvents: data.kickEvents || [],
          kickOnsets: data.kickOnsets || [],
          instrumentalActivity: data.instrumentalActivity || [],
          globalIntensity: data.globalIntensity || [],
          averageAmplitude: data.averageAmplitude,
          aboveAverageSections: data.aboveAverageSections || [],
          triStemDropSections: data.triStemDropSections || [],
          drumsAverageAmplitude: data.drumsAverageAmplitude,
          bassAverageAmplitude: data.bassAverageAmplitude,
          instAverageAmplitude: data.instAverageAmplitude,
          demucsBpm: data.demucsBpm,
          spotlightAnalysis: data.spotlightAnalysis || (data.stems as any)?.spotlightAnalysis,
        },
      };
    }
    return { status: 'miss' };
  } catch {
    return { status: 'offline' };
  }
}

/**
 * Clear stems stored in browser IndexedDB and in-memory session cache.
 */
export async function clearIndexedDBStems(): Promise<void> {
  inMemoryStemCache.clear();
  try {
    const db = await getIndexedDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.warn('[DemucsService] IndexedDB clear notice:', err);
  }
}

/**
 * Clear all Synwave caches (server disk store .synwave_cache, browser IndexedDB, and localStorage).
 */
export async function clearAllSynwaveCaches(): Promise<{ success: boolean; message: string }> {
  // 1. Purge server disk cache (.synwave_cache)
  let serverNotice = '';
  try {
    const res = await fetch('http://127.0.0.1:8765/api/cache/clear', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      serverNotice = data.message || 'Server disk cache purged.';
    }
  } catch {
    serverNotice = 'Microservice offline (disk cache untouched).';
  }

  // 2. Clear browser IndexedDB stems
  await clearIndexedDBStems();

  // 3. Clear browser BPM local storage
  try {
    localStorage.removeItem('synwave_shazam_cache_v2'); // Clean up any legacy items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('synwave_track_bpm_cache_v1')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }

  return {
    success: true,
    message: `All caches cleared. ${serverNotice}`,
  };
}

/**
 * Request 4-stem separation from Demucs or return pre-computed cached envelopes.
 * - Prioritizes .synwave_cache/stems/ on disk when the microservice is online.
 * - If server disk cache does not have the track (e.g. cache deleted or new file),
 *   executes full Demucs neural stem separation and persists to .synwave_cache/stems/.
 * - Falls back to browser IndexedDB only if the Python microservice is completely offline.
 */
export async function separateAudioWithDemucs(
  fileOrPath: File | string,
  optionsOrProgress?: StemSeparationOptions | ((status: string) => void)
): Promise<DemucsStemData | null> {
  const options: StemSeparationOptions =
    typeof optionsOrProgress === 'function'
      ? { onProgress: optionsOrProgress }
      : optionsOrProgress || {};

  const onProgress = options.onProgress;
  const fingerprint = options.fingerprint || getTrackFingerprint(fileOrPath);
  const songKey = getSongIdentityKey(options.songTitle, options.songArtist);
  const candidateKeys = [fingerprint, songKey];

  // 1. Check Python Server Disk Cache (.synwave_cache/stems)
  onProgress?.('Checking .synwave_cache disk store...');
  const serverCheck = await checkServerStemsCache(fingerprint, options.songTitle, options.songArtist);

  if (serverCheck.status === 'hit') {
    console.info(`[DemucsService] Instant server disk cache hit (.synwave_cache/stems) for ${options.songTitle || fingerprint}`);
    onProgress?.('Loaded from .synwave_cache');
    await saveCachedStemData(candidateKeys, serverCheck.data);
    return serverCheck.data;
  }

  if (serverCheck.status === 'offline') {
    // Microservice is not running — fall back to browser IndexedDB if previously extracted
    const localCache = await getCachedStemData(candidateKeys);
    if (localCache) {
      console.info(`[DemucsService] Microservice offline — using offline ${localCache.source} cache for ${options.songTitle || fingerprint}`);
      onProgress?.('Loaded from offline browser storage');
      return localCache.data;
    }
    console.warn('[DemucsService] Python microservice offline and no local cache available.');
    return null;
  }

  // 2. Server is online, but .synwave_cache has NO cached stems for this track (e.g. cache deleted or new song)
  // Run full Demucs neural stem separation on the local microservice and persist to disk cache!
  onProgress?.('Extracting 4 audio stems with Demucs HTDemucs...');
  const SERVER_URL = 'http://127.0.0.1:8765/api/separate-stems';
  const formData = new FormData();

  if (typeof fileOrPath === 'string') {
    let resolvedPath = fileOrPath;
    if (resolvedPath.startsWith('/music/')) {
      resolvedPath = `public${resolvedPath}`;
    }
    formData.append('filePath', resolvedPath);
  } else {
    formData.append('file', fileOrPath, fileOrPath.name);
  }

  if (fingerprint) formData.append('fingerprint', fingerprint);
  if (options.songTitle) formData.append('songTitle', options.songTitle);
  if (options.songArtist) formData.append('songArtist', options.songArtist);

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Demucs server HTTP ${response.status}: ${response.statusText}`);
    }

    const data: StemSeparationResult = await response.json();
    if (data.success && data.stems && data.fps) {
      const stemData: DemucsStemData = {
        fps: data.fps,
        durationSeconds: data.durationSeconds || 0,
        stems: {
          drums: data.stems.drums || [],
          bass: data.stems.bass || [],
          instruments: data.stems.instruments || [],
          vocals: data.stems.vocals || [],
        },
        kickEvents: data.kickEvents || [],
        kickOnsets: data.kickOnsets || [],
        instrumentalActivity: data.instrumentalActivity || [],
        globalIntensity: data.globalIntensity || [],
        averageAmplitude: data.averageAmplitude,
        aboveAverageSections: data.aboveAverageSections || [],
        triStemDropSections: data.triStemDropSections || [],
        drumsAverageAmplitude: data.drumsAverageAmplitude,
        bassAverageAmplitude: data.bassAverageAmplitude,
        instAverageAmplitude: data.instAverageAmplitude,
        demucsBpm: data.demucsBpm,
      };

      // Persist across candidate keys and fileHash
      const allKeys = [...candidateKeys, data.fileHash];
      await saveCachedStemData(allKeys, stemData);
      console.info(`[DemucsService] Stem separation saved to .synwave_cache/stems for ${options.songTitle || fingerprint}`);

      return stemData;
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
): {
  kick: number;
  bass: number;
  instruments: number;
  vocals: number;
  instrumentalActivity: number;
  globalIntensity: number;
  isKickOnset: boolean;
  kickIntensity: number;
} {
  if (!data) {
    return {
      kick: 0,
      bass: 0,
      instruments: 0,
      vocals: 0,
      instrumentalActivity: 0,
      globalIntensity: 0,
      isKickOnset: false,
      kickIntensity: 0,
    };
  }

  // Support both nested data.stems ({ drums, bass, ... }) and flat structure
  const rawStems = data.stems || (data as unknown as { drums?: number[]; bass?: number[]; instruments?: number[]; vocals?: number[] });
  const stemsDict = rawStems && ('drums' in rawStems || 'bass' in rawStems) ? rawStems : null;

  if (!stemsDict) {
    return {
      kick: 0,
      bass: 0,
      instruments: 0,
      vocals: 0,
      instrumentalActivity: 0,
      globalIntensity: 0,
      isKickOnset: false,
      kickIntensity: 0,
    };
  }

  const fps = typeof data.fps === 'number' && data.fps > 0 ? data.fps : 25;
  const samplePos = Math.max(0, timeSeconds * fps);
  const i0 = Math.floor(samplePos);
  const i1 = i0 + 1;
  const frac = samplePos - i0;

  const sampleArray = (arr?: number[]) => {
    if (!arr || arr.length === 0) return 0;
    if (i0 < 0) return arr[0] || 0;
    if (i0 >= arr.length - 1) return arr[arr.length - 1] || 0;
    const v0 = arr[i0] ?? 0;
    const v1 = arr[i1] ?? v0;
    return v0 + (v1 - v0) * frac;
  };

  const kick = sampleArray(stemsDict.drums);
  const bass = sampleArray(stemsDict.bass);
  const instruments = sampleArray(stemsDict.instruments);
  const vocals = sampleArray(stemsDict.vocals);
  const instrumentalActivity = sampleArray(data.instrumentalActivity);
  const globalIntensity = sampleArray(data.globalIntensity);

  // Check if precisely at kick onset (window aligned with exact transient arrival: -15ms to +50ms)
  let isKickOnset = false;
  let kickIntensity = 0;
  if (data.kickEvents && data.kickEvents.length > 0) {
    for (const event of data.kickEvents) {
      const dt = timeSeconds - event.time;
      if (dt >= -0.015 && dt <= 0.052) {
        isKickOnset = true;
        kickIntensity = event.intensity;
        break;
      }
    }
  } else if (data.kickOnsets && data.kickOnsets.length > 0) {
    for (const onset of data.kickOnsets) {
      const dt = timeSeconds - onset;
      if (dt >= -0.015 && dt <= 0.052) {
        isKickOnset = true;
        kickIntensity = Math.max(0.75, kick);
        break;
      }
    }
  }

  return {
    kick,
    bass,
    instruments,
    vocals,
    instrumentalActivity,
    globalIntensity,
    isKickOnset,
    kickIntensity: Math.max(kickIntensity, kick),
  };
}
