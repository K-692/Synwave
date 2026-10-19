/**
 * Synwave Video Thumbnail Color Extraction Service
 * 
 * Extracts dominant vibrant color gradients and swatches from the synchronized
 * YouTube video thumbnail image. Sets concert spotlights and stage palette
 * to match the artistic color grading of the official music video.
 */

export interface ExtractedStageColors {
  primary: string;
  secondary: string;
  accent: string;
  spotlightColors: string[];
}

/**
 * Converts RGB to HSL
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
 * Converts RGB values to a 6-character hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts the top vibrant color gradients from a YouTube video thumbnail.
 */
export async function extractThumbnailColors(videoId: string): Promise<ExtractedStageColors | null> {
  if (!videoId) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Use hqdefault (universally available on all YouTube videos)
    img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        const width = 48;
        const height = 27; // 16:9 sampling
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Sample center 80% to avoid letterboxing black bars
        const startX = Math.floor(width * 0.1);
        const endX = Math.floor(width * 0.9);
        const startY = Math.floor(height * 0.1);
        const endY = Math.floor(height * 0.9);

        const imgData = ctx.getImageData(startX, startY, endX - startX, endY - startY).data;

        interface ColorCandidate {
          hex: string;
          r: number;
          g: number;
          b: number;
          h: number;
          s: number;
          l: number;
          score: number;
        }

        const candidates: ColorCandidate[] = [];

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];

          const [h, s, l] = rgbToHsl(r, g, b);

          // Discard near-black, pure white, and desaturated grey pixels
          if (l < 0.16 || l > 0.88 || s < 0.18) continue;

          // Vibrancy score: prioritize high saturation with balanced lightness
          const score = s * 1.5 + (1 - Math.abs(l - 0.52)) * 1.0;

          candidates.push({
            hex: rgbToHex(r, g, b),
            r,
            g,
            b,
            h,
            s,
            l,
            score,
          });
        }

        if (candidates.length === 0) {
          // Deliberate fallback if video is purely black/monochrome (avoids locking to cyan/blue)
          resolve({
            primary: '#ffaa00',
            secondary: '#ff3c00',
            accent: '#00ffcc',
            spotlightColors: ['#ffaa00', '#ff3c00', '#00ffcc'],
          });
          return;
        }

        // Sort by vibrancy score
        candidates.sort((a, b) => b.score - a.score);

        // Pick distinct color clusters (separate hue ranges)
        const picked: ColorCandidate[] = [];
        for (const c of candidates) {
          const tooClose = picked.some((p) => {
            const hDiff = Math.abs(p.h - c.h);
            const hueDistance = Math.min(hDiff, 1 - hDiff);
            return hueDistance < 0.12; // Minimum hue separation
          });

          if (!tooClose) {
            picked.push(c);
            if (picked.length >= 4) break;
          }
        }

        // If not enough distinct hues, add highest scored candidates
        for (const c of candidates) {
          if (picked.length >= 4) break;
          if (!picked.some((p) => p.hex === c.hex)) {
            picked.push(c);
          }
        }

        const primary = picked[0]?.hex || '#ff5500';
        const secondary = picked[1]?.hex || '#ffaa00';
        const accent = picked[2]?.hex || '#ff0044';

        const spotlightColors = [primary, secondary, accent];

        resolve({
          primary,
          secondary,
          accent,
          spotlightColors,
        });
      } catch (err) {
        console.warn('Thumbnail color extraction exception:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };
  });
}
