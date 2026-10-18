/**
 * Synwave STEM Separation Service
 * 
 * Integrates with the KIE AI Suno Stem Separation API:
 * https://kieai.mintlify.app/suno-api/separate-vocals
 * Endpoint: POST https://api.kie.ai/api/v1/vocal-removal/generate
 * 
 * Separates music tracks into 4 core STEM components:
 * 1. Kick (Drums & percussion transients)
 * 2. Bass (Sub-bass, basslines & 808s)
 * 3. Instruments (Synths, guitars, keys, strings, brass, FX)
 * 4. Vocals (Lead vocals & backing vocals)
 * 
 * Provides both client-side real-time multi-band STEM decomposition
 * and remote KIE AI cloud stem separation requests.
 */

import type { AudioStems, KieStemSeparationRequest, KieStemSeparationResponse } from '../types';

export class StemSeparationService {
  private static readonly API_BASE_URL = 'https://api.kie.ai/api/v1/vocal-removal/generate';

  /**
   * Request remote AI Stem Separation from KIE API (https://api.kie.ai)
   * Splits audio into vocal, accompaniment, or per-instrument stems.
   */
  public static async requestKieStemSeparation(
    apiKey: string,
    params: KieStemSeparationRequest
  ): Promise<KieStemSeparationResponse> {
    const payload = {
      taskId: params.taskId || '',
      audioId: params.audioId || '',
      type: params.type || 'split_stem',
      callBackUrl: params.callBackUrl || 'https://synwave.local/api/callback',
    };

    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`KIE Stem API request failed with HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as KieStemSeparationResponse;
      return data;
    } catch (err) {
      console.warn('KIE Stem Separation API error, using local real-time multi-band decomposition:', err);
      return {
        code: 500,
        msg: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Real-Time Client-Side Multi-Band STEM Decomposition.
   * Extracts instant 4-channel STEM energies (Kick, Bass, Instruments, Vocals)
   * directly from 2048-sample FFT frequency bins and time-domain PCM at 60 FPS.
   */
  public static extractRealtimeStems(
    frequencyData: Uint8Array,
    _timeDomainData: Uint8Array,
    isKick: boolean,
    kickIntensity: number,
    previousKickStem: number,
    deltaSeconds: number
  ): AudioStems {
    // 1. Kick STEM:
    // Focus on ultra-low sub-bass transients (20-90 Hz: bins 1 to 4) with sharp attack and 140ms release
    let currentKick = previousKickStem * Math.max(0, 1 - deltaSeconds * 7.0);
    if (isKick) {
      currentKick = Math.max(currentKick, Math.min(1.0, kickIntensity * 1.25));
    } else {
      // Sub-bass transient energy boost
      const subKickEnergy = (frequencyData[1] + frequencyData[2] + frequencyData[3]) / (3 * 255);
      if (subKickEnergy > 0.5) {
        currentKick = Math.max(currentKick, (subKickEnergy - 0.5) * 1.8);
      }
    }

    // 2. Bass STEM:
    // Focus on sub-bass and bass fundamental notes (40-250 Hz: bins 2 to 12)
    let bassSum = 0;
    const bassBins = 11;
    for (let i = 2; i <= 12; i++) {
      bassSum += frequencyData[i] || 0;
    }
    const rawBassStem = Math.min(1.0, (bassSum / (bassBins * 255)) * 1.55);

    // 3. Instrument STEM:
    // Focus on midrange harmonics, guitars, synths, keyboards, brass, strings (280-3500 Hz: bins 13 to 160)
    let instSum = 0;
    const instBins = 148;
    for (let i = 13; i <= 160; i++) {
      instSum += frequencyData[i] || 0;
    }
    const rawInstStem = Math.min(1.0, (instSum / (instBins * 255)) * 1.6);

    // 4. Vocal STEM:
    // Focus on vocal formants (F1, F2, F3 ~ 800-4500 Hz: bins 38 to 210) & high-mid breath (4500-8000 Hz)
    let vocalSum = 0;
    const vocalBins = 173;
    for (let i = 38; i <= 210; i++) {
      // Weight human vocal resonance band around 1kHz - 3.5kHz
      const weight = i >= 45 && i <= 160 ? 1.35 : 0.8;
      vocalSum += (frequencyData[i] || 0) * weight;
    }
    const rawVocalStem = Math.min(1.0, (vocalSum / (vocalBins * 255)) * 1.45);

    return {
      kick: Math.max(0, Math.min(1, currentKick)),
      bass: Math.max(0, Math.min(1, rawBassStem)),
      instruments: Math.max(0, Math.min(1, rawInstStem)),
      vocals: Math.max(0, Math.min(1, rawVocalStem)),
    };
  }
}
