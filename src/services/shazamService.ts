/**
 * Synwave Shazam Recognition Client Service
 * Communicates with the local ShazamIO Python backend (http://127.0.0.1:8765).
 */

export interface ShazamMatch {
  success: boolean;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  coverArt?: string;
  query?: string;
  shazamKey?: string;
  error?: string;
}

const SHAZAM_ENDPOINT = 'http://127.0.0.1:8765/api/recognize';

export async function identifyAudioWithShazam(file: File | Blob): Promise<ShazamMatch> {
  const formData = new FormData();
  formData.append('file', file, (file as File).name || 'audio_snippet.mp3');

  try {
    const response = await fetch(SHAZAM_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Shazam service returned status ${response.status}`);
    }

    const data: ShazamMatch = await response.json();
    return data;
  } catch (err) {
    console.warn('ShazamIO recognition network fallback:', err);
    return {
      success: false,
      error: (err as Error).message,
    };
  }
}
