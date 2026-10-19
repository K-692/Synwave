/**
 * Synwave Track Tempo & BPM Provenance Service
 * 
 * Provides verified BPM resolution with strict source attribution:
 * 1. Primary: ShazamIO song identification (verified BPM if explicitly returned)
 * 2. Secondary fallback: Demucs neural kick-event timestamp periodicity calculation
 * 3. Graceful fallback: Explicit 'unavailable' state (no fabricated/assumed BPM)
 * 4. Per-track caching to prevent redundant API and audio analysis calls
 */

export type BpmSource = 'shazamio' | 'demucs' | 'unavailable';

export interface BpmResolution {
  bpm: number | null;
  candidateBpm?: number | null;
  source: BpmSource;
  confidence: number;
  isVerified: boolean;
  matchedKicks?: number;
  totalKicks?: number;
  reason?: string;
}

const STORAGE_CACHE_KEY = 'synwave_track_bpm_cache_v1';

/**
 * Retrieve cached BPM resolution for a track from local storage
 */
export function getCachedTrackBpm(trackKey: string): BpmResolution | null {
  if (!trackKey) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_CACHE_KEY}_${trackKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as BpmResolution;
      if (parsed && typeof parsed.source === 'string') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[TempoService] Error reading cached BPM resolution:', err);
  }
  return null;
}

/**
 * Persist BPM resolution for a track to local storage
 */
export function setCachedTrackBpm(trackKey: string, resolution: BpmResolution): void {
  if (!trackKey) return;
  try {
    localStorage.setItem(`${STORAGE_CACHE_KEY}_${trackKey}`, JSON.stringify(resolution));
  } catch (err) {
    console.warn('[TempoService] Error persisting BPM resolution:', err);
  }
}

/**
 * Calculate tempo from Demucs kick-event timestamps using multi-interval periodicity analysis.
 * Accounts for missed kicks, extra detections, syncopation, and half-time/double-time ambiguities.
 */
export function calculateBpmFromKickOnsets(onsets: number[]): BpmResolution {
  if (!onsets || onsets.length < 8) {
    return {
      bpm: null,
      candidateBpm: null,
      source: 'unavailable',
      confidence: 0.0,
      totalKicks: onsets?.length || 0,
      matchedKicks: 0,
      isVerified: false,
      reason: 'Too few kick events detected (< 8 kicks).',
    };
  }

  // Deduplicate and sort timestamps in ascending order
  const sorted = Array.from(new Set(onsets)).sort((a, b) => a - b);
  const intervals: { dt: number; weight: number }[] = [];

  // Collect intervals between consecutive and skip kicks up to span 4 within [0.22s, 3.2s]
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < Math.min(i + 5, sorted.length); j++) {
      const dt = sorted[j] - sorted[i];
      if (dt >= 0.22 && dt <= 3.2) {
        const weight = 1.0 / (j - i);
        intervals.push({ dt, weight });
      }
    }
  }

  if (intervals.length === 0) {
    return {
      bpm: null,
      candidateBpm: null,
      source: 'unavailable',
      confidence: 0.0,
      totalKicks: sorted.length,
      matchedKicks: 0,
      isVerified: false,
      reason: 'No periodic intervals found within plausible tempo bounds.',
    };
  }

  const sigma = 0.038;
  let bestBpm = 120.0;
  let bestScore = -1.0;
  const scores = new Map<number, number>();

  // Test plausible tempo spectrum from 65.0 to 190.0 BPM in 0.5 BPM steps
  for (let bpmInt = 130; bpmInt <= 380; bpmInt++) {
    const testBpm = bpmInt * 0.5;
    const period = 60.0 / testBpm;
    let score = 0.0;

    for (const { dt, weight } of intervals) {
      const k = Math.round(dt / period);
      if (k >= 1 && k <= 4) {
        const err = Math.abs(dt - k * period);
        score += weight * Math.exp(-(err * err) / (2 * sigma * sigma));
      }
    }

    scores.set(testBpm, score);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = testBpm;
    }
  }

  // Rhythmic ambiguity resolution (half-time / double-time standardisation)
  const doubleBpm = bestBpm * 2;
  const halfBpm = bestBpm / 2;

  if (bestBpm < 85.0 && scores.has(doubleBpm)) {
    const doubleScore = scores.get(doubleBpm) || 0;
    if (doubleScore >= 0.70 * bestScore) {
      bestBpm = doubleBpm;
      bestScore = doubleScore;
    }
  } else if (bestBpm > 175.0 && scores.has(halfBpm)) {
    const halfScore = scores.get(halfBpm) || 0;
    if (halfScore >= 0.70 * bestScore) {
      bestBpm = halfBpm;
      bestScore = halfScore;
    }
  }

  // Grid alignment verification across all kicks
  const period = 60.0 / bestBpm;
  let bestAlign = 0;

  for (let p = 0; p < 100; p++) {
    const ph = sorted[0] + (p * 0.01 * period);
    let aligned = 0;
    for (const t of sorted) {
      const offset = (t - ph) / period;
      const nearestK = Math.round(offset);
      const err = Math.abs((t - ph) - nearestK * period);
      if (err < 0.06) {
        aligned++;
      }
    }
    if (aligned > bestAlign) {
      bestAlign = aligned;
    }
  }

  const fAlign = bestAlign / sorted.length;
  let totalScoreSum = 0;
  for (const s of scores.values()) {
    totalScoreSum += s;
  }
  const avgScore = totalScoreSum / Math.max(1, scores.size);
  const contrast = bestScore / (avgScore + 1e-6);
  const conf = Math.min(1.0, (fAlign * 0.60) + Math.min(1.0, contrast / 3.5) * 0.40);

  const isReliable = conf >= 0.35 && bestAlign >= 6;
  const roundedBpm = Math.round(bestBpm * 10) / 10;
  const roundedConf = Math.round(conf * 100) / 100;

  return {
    bpm: isReliable ? roundedBpm : null,
    candidateBpm: roundedBpm,
    source: isReliable ? 'demucs' : 'unavailable',
    confidence: roundedConf,
    matchedKicks: bestAlign,
    totalKicks: sorted.length,
    isVerified: false,
    reason: isReliable ? undefined : 'Inconsistent rhythmic periodicity (confidence < 0.35).',
  };
}

/**
 * Resolves the authoritative track BPM following Phase 3 priority rules:
 * 1. Checks track cache first.
 * 2. Uses verified ShazamIO BPM if explicitly present and within [50, 240].
 * 3. Falls back to Demucs kick timestamp periodicity calculation.
 * 4. Yields explicit 'unavailable' state if neither source provides a reliable tempo.
 */
export function resolveTrackBpm(
  trackKey: string,
  shazamResult?: { bpm?: number | null; bpmSource?: string | null } | null,
  demucsStems?: {
    kickOnsets?: number[];
    kickEvents?: { time: number; intensity: number }[];
    demucsBpm?: { bpm?: number | null; confidence?: number; source?: string };
  } | null
): BpmResolution {
  // 1. Prioritize verified ShazamIO BPM if explicitly present and within [50, 240]
  if (shazamResult && typeof shazamResult.bpm === 'number' && !isNaN(shazamResult.bpm)) {
    const rawBpm = shazamResult.bpm;
    if (rawBpm >= 50.0 && rawBpm <= 240.0) {
      const verifiedResolution: BpmResolution = {
        bpm: Math.round(rawBpm * 10) / 10,
        source: 'shazamio',
        confidence: 1.0,
        isVerified: true,
      };
      setCachedTrackBpm(trackKey, verifiedResolution);
      return verifiedResolution;
    }
  }

  // 2. Check local track cache
  const cached = getCachedTrackBpm(trackKey);
  if (cached && (cached.source === 'shazamio' || (cached.source === 'demucs' && cached.bpm))) {
    return cached;
  }

  // 3. Demucs-based fallback using kick timestamps
  if (demucsStems) {
    // If pre-computed by Python microservice
    if (demucsStems.demucsBpm && typeof demucsStems.demucsBpm.bpm === 'number') {
      const demucsResolution: BpmResolution = {
        bpm: demucsStems.demucsBpm.bpm,
        source: (demucsStems.demucsBpm.source as BpmSource) || 'demucs',
        confidence: demucsStems.demucsBpm.confidence ?? 0.65,
        isVerified: false,
      };
      setCachedTrackBpm(trackKey, demucsResolution);
      return demucsResolution;
    }

    // Compute from kick onsets array
    const onsets = demucsStems.kickOnsets || demucsStems.kickEvents?.map((k) => k.time) || [];
    if (onsets.length > 0) {
      const calculated = calculateBpmFromKickOnsets(onsets);
      setCachedTrackBpm(trackKey, calculated);
      return calculated;
    }
  }

  // 4. Neither source is currently available
  const unavailableResolution: BpmResolution = {
    bpm: null,
    source: 'unavailable',
    confidence: 0.0,
    isVerified: false,
    reason: 'Waiting for ShazamIO recognition or Demucs stem extraction.',
  };
  return unavailableResolution;
}

/**
 * Phase 4: Maps BPM to spotlight count using clamped linear interpolation across [70, 160] BPM.
 * - BPM <= 70 uses minimum count
 * - BPM >= 160 uses maximum count
 * - 70 < BPM < 160 linearly interpolates monotonically between min and max
 * - If BPM is undefined/unavailable, returns median between min and max
 */
export function mapBpmToSpotlightCount(
  bpm: number | null | undefined,
  minCount = 1,
  maxCount = 7
): number {
  const min = Math.max(1, Math.min(8, Math.round(minCount)));
  const max = Math.max(min, Math.min(8, Math.round(maxCount)));

  if (typeof bpm !== 'number' || isNaN(bpm) || bpm <= 0) {
    return Math.round((min + max) / 2);
  }

  // Clamped linear interpolation across requested range 70 - 160 BPM
  const clampedBpm = Math.max(70.0, Math.min(160.0, bpm));
  const t = (clampedBpm - 70.0) / (160.0 - 70.0);
  const count = Math.round(min + t * (max - min));
  return Math.max(min, Math.min(max, count));
}

