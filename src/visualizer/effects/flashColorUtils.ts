/**
 * Synwave Flash Palette Resolution & Color Normalization Engine
 * 
 * Provides color normalization and authentic palette color sequences
 * for full-screen camera and screen blinder flashes:
 * - Compulsory pure white (#ffffff) impact frame.
 * - Followed by authentic chromatic colors from active song thumbnail/palette.
 * - Deduplicates visually identical colors and filters near-white/achromatic swatches.
 * - Deterministic fallback from track seed if palette is entirely achromatic.
 */

import * as THREE from 'three';
import type { ColorPalette } from '../../types';
import type { ExtractedStageColors } from '../../services/thumbnailColorService';

export interface NormalizedColor {
  hex: string;
  hsl: { h: number; s: number; l: number };
  rgb: { r: number; g: number; b: number };
}

/**
 * Checks whether a color is pure white, near-white, or achromatic gray/black.
 */
export function isNearWhiteOrAchromatic(
  hsl: { h: number; s: number; l: number },
  rgb: { r: number; g: number; b: number }
): boolean {
  if (hsl.l >= 0.90) return true;
  if (rgb.r > 0.92 && rgb.g > 0.92 && rgb.b > 0.92) return true;
  if (hsl.l >= 0.82 && hsl.s <= 0.08) return true;
  if (hsl.l <= 0.04) return true;
  if (hsl.s <= 0.08) return true;
  return false;
}

/**
 * Checks if two chromatic colors are visually near-identical using perceptual distance.
 */
export function areColorsNearIdentical(c1: NormalizedColor, c2: NormalizedColor): boolean {
  if (c1.hex.toLowerCase() === c2.hex.toLowerCase()) return true;

  const dr = c1.rgb.r - c2.rgb.r;
  const dg = c1.rgb.g - c2.rgb.g;
  const db = c1.rgb.b - c2.rgb.b;
  const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);

  // Only merge if virtually indistinguishable
  return rgbDist < 0.05;
}

/**
 * Converts a hex or CSS color string to NormalizedColor.
 */
export function parseColor(colorStr: string): NormalizedColor | null {
  if (!colorStr) return null;
  try {
    const c = new THREE.Color(colorStr);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return {
      hex: `#${c.getHexString()}`,
      hsl,
      rgb: { r: c.r, g: c.g, b: c.b },
    };
  } catch {
    return null;
  }
}

/**
 * Resolves purely chromatic colors strictly from the active video thumbnail palette.
 * Strictly guarantees that ONLY colors actually present in the thumbnail are returned.
 * If the thumbnail has only shades of one hue (e.g. blue), strictly returns those shades.
 * Never injects synthetic or procedural colors (no random green, red, violet).
 */
export function resolvePureChromaticPaletteColors(
  palette: ColorPalette | ExtractedStageColors | null | undefined,
  _fallbackSeed: number = 1337
): string[] {
  const rawSwatches: string[] = [];
  if (palette) {
    if ('spotlightColors' in palette && Array.isArray((palette as ExtractedStageColors).spotlightColors) && (palette as ExtractedStageColors).spotlightColors.length > 0) {
      for (const col of (palette as ExtractedStageColors).spotlightColors) {
        if (col && !rawSwatches.includes(col)) rawSwatches.push(col);
      }
    } else {
      if ('rawSwatches' in palette && Array.isArray((palette as ColorPalette).rawSwatches)) {
        for (const col of (palette as ColorPalette).rawSwatches!) {
          if (col && !rawSwatches.includes(col)) rawSwatches.push(col);
        }
      }
      if ('primary' in palette && palette.primary && !rawSwatches.includes(palette.primary)) {
        rawSwatches.push(palette.primary);
      }
      if ('secondary' in palette && palette.secondary && !rawSwatches.includes(palette.secondary)) {
        rawSwatches.push(palette.secondary);
      }
      if ('accent' in palette && palette.accent && !rawSwatches.includes(palette.accent)) {
        rawSwatches.push(palette.accent);
      }
    }
  }

  const chromaticColors: NormalizedColor[] = [];
  for (const raw of rawSwatches) {
    const parsed = parseColor(raw);
    if (!parsed) continue;

    if (isNearWhiteOrAchromatic(parsed.hsl, parsed.rgb)) {
      continue;
    }

    const isDuplicate = chromaticColors.some((existing) => areColorsNearIdentical(existing, parsed));
    if (!isDuplicate) {
      chromaticColors.push(parsed);
    }
  }

  if (chromaticColors.length > 0) {
    return chromaticColors.map((c) => c.hex);
  }

  // If no chromatic colors are found in the thumbnail, strictly return an empty array.
  // The screen flash system will strictly flash pure white (#ffffff) on all kicks.
  return [];
}

/**
 * Resolves color flash sequence for kick impact and drop blinder flashes:
 * - First frame: Pure white (#ffffff)
 * - Subsequent frames: Authentic chromatic swatches from active track palette
 */
export function resolveFlashPaletteColors(
  palette: ColorPalette | ExtractedStageColors | null | undefined,
  fallbackSeed: number = 1337
): string[] {
  const chromatic = resolvePureChromaticPaletteColors(palette, fallbackSeed);
  return ['#ffffff', ...chromatic];
}
