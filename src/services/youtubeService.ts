/**
 * Synwave YouTube Data API v3 Search Service
 * Searches for official music videos and retrieves rich metadata (Title, Artist, Producer, Release Date).
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

const STORAGE_KEY = 'synwave_youtube_api_key';

export function getYouTubeApiKey(): string {
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_YOUTUBE_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setYouTubeApiKey(key: string): void {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function decodeHtmlEntities(str: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function extractProducerFromDescription(desc: string): string | undefined {
  if (!desc) return undefined;
  // Check for "Produced by", "Producer", "Music Producer", "Composed by"
  const producerMatch = desc.match(/(?:produced by|music producer|producer|composed by|composer)[:\s]+([^\n\r,;]+)/i);
  if (producerMatch) {
    return producerMatch[1].trim();
  }
  return undefined;
}

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
    )}&key=${apiKey}`;

    const resp = await fetch(searchUrl);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      console.error('YouTube Data API search failed:', resp.status, errData);
      return null;
    }

    const data = await resp.json();
    if (!data.items || data.items.length === 0) {
      console.warn('No YouTube video results found for:', cleanQuery);
      return null;
    }

    const item = data.items[0];
    const rawTitle = item.snippet.title || cleanQuery;
    const decodedTitle = decodeHtmlEntities(rawTitle);
    const channel = decodeHtmlEntities(item.snippet.channelTitle || 'Official Artist');
    const desc = item.snippet.description || '';
    const publishedAt = item.snippet.publishedAt
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
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
      publishedAt,
      description: desc,
      producer,
    };
  } catch (err) {
    console.error('YouTube search exception:', err);
    return null;
  }
}
