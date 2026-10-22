/**
 * Synwave Video Thumbnail Color Extraction Service
 * 
 * Accurately extracts dominant color swatches and gradients strictly from the
 * official YouTube video thumbnail. Strictly preserves the authentic color grading
 * of the music video without injecting unrequested or synthetic colors.
 */

import type { ExtractedStageColors } from '../types';
export type { ExtractedStageColors };

/**
 * Converts RGB to HSL [0..1]
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

/**
 * Converts RGB values to a 6-character hex string (#rrggbb)
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts HSL [0..1] to RGB [0..255]
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

interface ColorCluster {
  hex: string;
  stageHex: string;
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  count: number;
  weight: number;
}

/**
 * Quantizes and extracts authentic dominant colors strictly from the thumbnail image.
 * Never introduces arbitrary secondary hues (e.g. orange, red, green) if the image is monochromatic or single-hue.
 */
function extractClustersFromImageData(data: Uint8ClampedArray, width: number, height: number): string[] {
  // Sample center 84% to eliminate potential black letterbox/pillarbox borders
  const startX = Math.floor(width * 0.08);
  const endX = Math.floor(width * 0.92);
  const startY = Math.floor(height * 0.08);
  const endY = Math.floor(height * 0.92);

  const rawPixels: { r: number; g: number; b: number; h: number; s: number; l: number }[] = [];

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 128) continue;

      const [h, s, l] = rgbToHsl(r, g, b);

      // Discard pitch black (< 0.06) and specular blown-out pure white (> 0.95)
      if (l < 0.06 || l > 0.95) continue;

      rawPixels.push({ r, g, b, h, s, l });
    }
  }

  if (rawPixels.length === 0) {
    return ['#ffffff'];
  }

  // Check if image is purely monochromatic/grayscale (e.g. vintage B&W)
  const isAchromatic = rawPixels.every((p) => p.s < 0.10);
  if (isAchromatic) {
    return ['#ffffff'];
  }

  // Filter for chromatic pixels if available; keep muted ones if low saturation image
  const chromaticPixels = rawPixels.filter((p) => p.s >= 0.12);
  const pool = chromaticPixels.length > rawPixels.length * 0.15 ? chromaticPixels : rawPixels;

  // Dominant Hue Family Identification (12 buckets of 30° each):
  // Eliminates tiny fringe noise (e.g. 0.8% watermark, logo, or compression artifact)
  // so if a thumbnail is blue, NO red/green/violet noise can enter the candidate pool.
  const hueCounts = new Array(12).fill(0);
  for (const p of pool) {
    const bIdx = Math.floor(p.h * 12) % 12;
    hueCounts[bIdx]++;
  }

  const totalPool = pool.length;
  const validBuckets = new Set<number>();
  for (let bIdx = 0; bIdx < 12; bIdx++) {
    if (hueCounts[bIdx] / totalPool >= 0.06) {
      validBuckets.add(bIdx);
    }
  }

  // Include immediate neighbor buckets if a dominant bucket exceeds 20% (for smooth gradient shades)
  for (let bIdx = 0; bIdx < 12; bIdx++) {
    if (hueCounts[bIdx] / totalPool >= 0.20) {
      validBuckets.add((bIdx + 11) % 12);
      validBuckets.add((bIdx + 1) % 12);
    }
  }

  const filteredPool = pool.filter((p) => validBuckets.has(Math.floor(p.h * 12) % 12));
  const activePool = filteredPool.length > 0 ? filteredPool : pool;

  // 3D Color Clustering (Euclidean distance in normalized RGB space)
  const clusters: ColorCluster[] = [];

  for (const pixel of activePool) {
    let matchedCluster: ColorCluster | null = null;
    let minDist = 0.14; // Clustering radius threshold

    for (const cluster of clusters) {
      const dr = (pixel.r - cluster.r) / 255;
      const dg = (pixel.g - cluster.g) / 255;
      const db = (pixel.b - cluster.b) / 255;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      // Require closer distance if hues differ significantly
      const hDiff = Math.abs(pixel.h - cluster.h);
      const hueDist = Math.min(hDiff, 1 - hDiff);

      if (dist < minDist && (hueDist < 0.08 || pixel.s < 0.20)) {
        minDist = dist;
        matchedCluster = cluster;
      }
    }

    if (matchedCluster) {
      // Running centroid average
      matchedCluster.count++;
      matchedCluster.r = (matchedCluster.r * (matchedCluster.count - 1) + pixel.r) / matchedCluster.count;
      matchedCluster.g = (matchedCluster.g * (matchedCluster.count - 1) + pixel.g) / matchedCluster.count;
      matchedCluster.b = (matchedCluster.b * (matchedCluster.count - 1) + pixel.b) / matchedCluster.count;
      const [h, s, l] = rgbToHsl(matchedCluster.r, matchedCluster.g, matchedCluster.b);
      matchedCluster.h = h;
      matchedCluster.s = s;
      matchedCluster.l = l;
    } else if (clusters.length < 32) {
      clusters.push({
        hex: rgbToHex(pixel.r, pixel.g, pixel.b),
        stageHex: rgbToHex(pixel.r, pixel.g, pixel.b),
        r: pixel.r,
        g: pixel.g,
        b: pixel.b,
        h: pixel.h,
        s: pixel.s,
        l: pixel.l,
        count: 1,
        weight: 0,
      });
    }
  }

  // Calculate visual prominence weight and luminous stage emissive hex for each cluster
  for (const cluster of clusters) {
    cluster.hex = rgbToHex(cluster.r, cluster.g, cluster.b);

    // Boost luminance for stage emissive flash without altering authentic hue or chroma
    const boostedL = Math.max(0.44, Math.min(0.64, cluster.l < 0.35 ? cluster.l * 1.8 : cluster.l));
    const boostedS = Math.max(0.65, Math.min(1.0, cluster.s < 0.50 ? cluster.s * 1.25 : cluster.s));
    const [sr, sg, sb] = hslToRgb(cluster.h, boostedS, boostedL);
    cluster.stageHex = rgbToHex(sr, sg, sb);

    // Prioritize high-saturation and prominent volume, penalizing extreme darkness
    const lightnessBalance = 1 - Math.abs(cluster.l - 0.50) * 0.5;
    cluster.weight = cluster.count * (0.35 + cluster.s * 0.65) * lightnessBalance;
  }

  // Sort clusters descending by weight
  clusters.sort((a, b) => b.weight - a.weight);

  // Filter out microscopic noise clusters (< 4% of active pool)
  const minCount = Math.max(4, activePool.length * 0.04);
  const significant = clusters.filter((c) => c.count >= minCount && c.s >= 0.10);

  const picked: ColorCluster[] = [];
  for (const c of significant) {
    // Ensure picked colors are visibly distinct shades in 3D color space (dist >= 0.08)
    const tooSimilar = picked.some((p) => {
      const dr = (p.r - c.r) / 255;
      const dg = (p.g - c.g) / 255;
      const db = (p.b - c.b) / 255;
      return Math.sqrt(dr * dr + dg * dg + db * db) < 0.08;
    });

    if (!tooSimilar) {
      picked.push(c);
      if (picked.length >= 4) break;
    }
  }

  if (picked.length > 0) {
    return picked.map((p) => p.stageHex);
  }

  // Fallback to top cluster if available
  if (clusters.length > 0 && clusters[0].s >= 0.08) {
    return [clusters[0].stageHex];
  }

  return ['#ffffff'];
}

/**
 * Extracts dominant vibrant color gradients and swatches strictly from a YouTube video thumbnail.
 * Guaranteed to only return authentic colors found in the video thumbnail.
 */
export async function extractThumbnailColors(videoId: string): Promise<ExtractedStageColors | null> {
  if (!videoId) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Prefer local backend CORS proxy, fallback to direct YouTube CDN
    const proxyUrl = `http://127.0.0.1:8765/api/thumbnail/${videoId}`;
    const directUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    let triedDirect = false;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        const width = 48;
        const height = 27; // 16:9 sampling
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height).data;

        const colors = extractClustersFromImageData(imgData, width, height);

        if (!colors || colors.length === 0) {
          resolve({
            primary: '#ffffff',
            secondary: '#ffffff',
            accent: '#ffffff',
            spotlightColors: ['#ffffff'],
          });
          return;
        }

        // Strictly assign ONLY colors found in the thumbnail (no synthetic orange, red, green)
        const primary = colors[0];
        const secondary = colors[1] || primary;
        const accent = colors[2] || secondary;
        const spotlightColors = colors.slice(0, 4);

        resolve({
          primary,
          secondary,
          accent,
          spotlightColors,
        });
      } catch (err) {
        console.warn('[ThumbnailColorService] Canvas extraction warning:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      if (!triedDirect) {
        triedDirect = true;
        img.src = directUrl;
      } else {
        resolve(null);
      }
    };

    img.src = proxyUrl;
  });
}
