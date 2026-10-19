/**
 * Synwave YouTube Data API v3 Service & Startup Key Validation
 * 
 * Secure key management, lightweight validation, error diagnosis,
 * and official music video metadata extraction.
 */

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  description?: string;
  producer?: string;
}

export type ApiKeyErrorType =
  | 'invalid_key'
  | 'quota_exhausted'
  | 'api_not_enabled'
  | 'forbidden'
  | 'network_error'
  | 'unknown';

export interface ApiKeyValidationResult {
  isValid: boolean;
  errorType?: ApiKeyErrorType;
  errorMessage?: string;
  details?: string;
}

// Storage keys
const STORAGE_KEY_V3 = 'synwave_yt_api_key_v3';
const STORAGE_KEY_LEGACY = 'synwave_youtube_api_key';

/**
 * Simple obfuscation helper so raw API keys are not stored in plaintext in local storage
 */
function obfuscateKey(rawKey: string): string {
  try {
    return 'enc:' + btoa(rawKey.trim());
  } catch {
    return rawKey.trim();
  }
}

function deobfuscateKey(storedVal: string): string {
  try {
    if (storedVal.startsWith('enc:')) {
      return atob(storedVal.slice(4)).trim();
    }
    return storedVal.trim();
  } catch {
    return storedVal.trim();
  }
}

/**
 * Retrieve the configured YouTube API Key.
 * Checks secure localStorage first, then legacy localStorage, then env var.
 */
export function getYouTubeApiKey(): string {
  try {
    // 1. Check v3 obfuscated storage
    const storedV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (storedV3) {
      const decoded = deobfuscateKey(storedV3);
      if (decoded) return decoded;
    }

    // 2. Check legacy plain storage and migrate
    const legacyKey = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacyKey && legacyKey.trim()) {
      const cleanLegacy = legacyKey.trim();
      setYouTubeApiKey(cleanLegacy);
      return cleanLegacy;
    }

    // 3. Check environment variable (Vite)
    const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_YOUTUBE_API_KEY;
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }
  } catch (err) {
    console.warn('Error reading stored YouTube API key:', err);
  }
  return '';
}

/**
 * Persist the YouTube API Key to local storage (obfuscated)
 */
export function setYouTubeApiKey(key: string): void {
  try {
    const cleanKey = key?.trim();
    if (cleanKey) {
      localStorage.setItem(STORAGE_KEY_V3, obfuscateKey(cleanKey));
      localStorage.removeItem(STORAGE_KEY_LEGACY);
    } else {
      localStorage.removeItem(STORAGE_KEY_V3);
      localStorage.removeItem(STORAGE_KEY_LEGACY);
    }
  } catch (err) {
    console.warn('Error storing YouTube API key:', err);
  }
}

/**
 * Quick check if any key is currently stored or present in environment
 */
export function hasConfiguredApiKey(): boolean {
  return Boolean(getYouTubeApiKey());
}

/**
 * Mask an API key for safe display in UI: "AIzaSy••••••••••••••••••••••••Ww"
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const clean = key.trim();
  if (clean.length <= 10) return '••••••••';
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  const dots = '•'.repeat(Math.max(12, clean.length - 10));
  return `${prefix}${dots}${suffix}`;
}

/**
 * Lightweight Validation Request:
 * Uses Google Cloud YouTube Data API v3 'videoCategories.list' endpoint.
 * Quota cost: 1 unit only (preserves user quota).
 */
export async function validateYouTubeApiKey(key: string): Promise<ApiKeyValidationResult> {
  const cleanKey = key?.trim();
  if (!cleanKey) {
    return {
      isValid: false,
      errorType: 'invalid_key',
      errorMessage: 'No API key provided. Please enter your Google Cloud YouTube Data API v3 key.',
    };
  }

  // Google Cloud API keys start with "AIzaSy" and are typically 39 chars
  if (!cleanKey.startsWith('AIzaSy') || cleanKey.length < 35) {
    return {
      isValid: false,
      errorType: 'invalid_key',
      errorMessage: 'Invalid Key Format: Google Cloud API keys typically start with "AIzaSy" and are 39 characters long. Double-check your copied key.',
    };
  }

  try {
    const testUrl = `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=US&key=${encodeURIComponent(cleanKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const resp = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.items && Array.isArray(data.items)) {
        return { isValid: true };
      }
    }

    const errData = await resp.json().catch(() => ({}));
    const err = errData.error || {};
    const code = err.code || resp.status;
    const message = (err.message || '').toString();
    const reason = (err.errors?.[0]?.reason || err.details?.[0]?.reason || '').toString();

    // 1. Invalid Key (400 Bad Request)
    if (code === 400 || message.includes('API key not valid') || reason === 'API_KEY_INVALID') {
      return {
        isValid: false,
        errorType: 'invalid_key',
        errorMessage: 'Invalid API Key: Google rejected this API key. Please verify that you copied the complete key without trailing spaces.',
        details: message,
      };
    }

    // 2. Quota / Permission / Access Issues (403 Forbidden)
    if (code === 403) {
      if (reason === 'quotaExceeded' || message.toLowerCase().includes('quota') || reason.includes('RESOURCE_EXHAUSTED')) {
        return {
          isValid: false,
          errorType: 'quota_exhausted',
          errorMessage: 'Quota Exceeded: Your Google Cloud YouTube Data API v3 daily quota (10,000 units/day) has been exhausted for this project. Please provide a key from another project or wait for quota reset.',
          details: message,
        };
      }
      if (reason === 'accessNotConfigured' || message.includes('has not been used in project') || message.includes('disabled')) {
        return {
          isValid: false,
          errorType: 'api_not_enabled',
          errorMessage: 'YouTube Data API v3 Not Enabled: The API is disabled in your Google Cloud project. Go to Google Cloud Console > APIs & Services > Enable "YouTube Data API v3".',
          details: message,
        };
      }
      if (reason.includes('Blocked') || reason.includes('forbidden') || message.includes('restricted') || message.includes('blocked')) {
        return {
          isValid: false,
          errorType: 'forbidden',
          errorMessage: 'API Key Restricted: This key has HTTP Referrer, IP, or API restrictions blocking requests. In Google Cloud Console, set Application Restrictions to "None" or allow localhost.',
          details: message,
        };
      }
      return {
        isValid: false,
        errorType: 'forbidden',
        errorMessage: `Access Forbidden (403): ${message || 'Permission denied by Google Cloud.'}`,
        details: message,
      };
    }

    return {
      isValid: false,
      errorType: 'unknown',
      errorMessage: `API Validation Failed (${code}): ${message || 'Unexpected response from Google APIs.'}`,
      details: message,
    };
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === 'AbortError';
    return {
      isValid: false,
      errorType: 'network_error',
      errorMessage: isAbort
        ? 'Connection Timeout: Request to Google YouTube API timed out. Please check your internet connection.'
        : 'Network Error: Failed to connect to Google YouTube API. Please check your internet connection or firewall.',
      details: String(err),
    };
  }
}

function decodeHtmlEntities(str: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function extractProducerFromDescription(desc: string): string | undefined {
  if (!desc) return undefined;
  const producerMatch = desc.match(/(?:produced by|music producer|producer|composed by|composer)[:\s]+([^\n\r,;]+)/i);
  if (producerMatch) {
    return producerMatch[1].trim();
  }
  return undefined;
}

/**
 * Search YouTube Data API v3 for the official video and rich metadata
 */
export async function searchYouTubeVideo(query: string): Promise<YouTubeSearchResult | null> {
  const apiKey = getYouTubeApiKey();

  if (!apiKey) {
    console.warn('YouTube Data API v3 Key not configured yet.');
    return null;
  }

  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
      cleanQuery + ' music video'
    )}&key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(searchUrl);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      console.warn('YouTube Data API search error:', resp.status, errData?.error?.message);
      return null;
    }

    const data = await resp.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const rawTitle = item.snippet?.title || cleanQuery;
    const decodedTitle = decodeHtmlEntities(rawTitle);
    const channel = decodeHtmlEntities(item.snippet?.channelTitle || 'Official Artist');
    const desc = item.snippet?.description || '';
    const publishedAt = item.snippet?.publishedAt
      ? new Date(item.snippet.publishedAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : undefined;

    const producer = extractProducerFromDescription(desc);

    return {
      videoId: item.id.videoId,
      title: decodedTitle,
      channelTitle: channel,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
      publishedAt,
      description: desc,
      producer,
    };
  } catch (err) {
    console.warn('YouTube search exception:', err);
    return null;
  }
}
