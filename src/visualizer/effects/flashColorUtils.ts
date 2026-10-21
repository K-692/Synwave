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
  if (hsl.l >= 0.88) return true;
  if (rgb.r > 0.90 && rgb.g > 0.90 && rgb.b > 0.90) return true;
  if (hsl.l >= 0.78 && hsl.s <= 0.12) return true;
  if (hsl.l <= 0.08) return true;
  if (hsl.s <= 0.12) return true;
  return false;
}

/**
 * Checks if two chromatic colors are visually near-identical using perceptual distance.
 */
export function areColorsNearIdentical(c1: NormalizedColor, c2: NormalizedColor): boolean {
  const hDiff = Math.abs(c1.hsl.h - c2.hsl.h);
  const hueDist = Math.min(hDiff, 1.0 - hDiff);

  const dr = c1.rgb.r - c2.rgb.r;
  const dg = c1.rgb.g - c2.rgb.g;
  const db = c1.rgb.b - c2.rgb.b;
  const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);

  const lDist = Math.abs(c1.hsl.l - c2.hsl.l);

  if (rgbDist < 0.14) return true;
  if (hueDist < 0.08 && lDist < 0.15) return true;

  return false;
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
 * Resolves color flash sequence for kick impact and drop blinder flashes:
 * - First frame: Pure white (#ffffff)
 * - Subsequent frames: Authentic chromatic swatches from active track palette
 */
export function resolveFlashPaletteColors(
  palette: ColorPalette | ExtractedStageColors | null | undefined,
  fallbackSeed: number = 1337
): string[] {
  const rawSwatches: string[] = [];
  if (palette) {
    if ('primary' in palette && palette.primary) rawSwatches.push(palette.primary);
    if ('secondary' in palette && palette.secondary) rawSwatches.push(palette.secondary);
    if ('accent' in palette && palette.accent) rawSwatches.push(palette.accent);
    if ('rawSwatches' in palette && Array.isArray((palette as ColorPalette).rawSwatches)) {
      for (const col of (palette as ColorPalette).rawSwatches!) {
        if (col && !rawSwatches.includes(col)) rawSwatches.push(col);
      }
    }
    if ('spotlightColors' in palette && Array.isArray((palette as ExtractedStageColors).spotlightColors)) {
      for (const col of (palette as ExtractedStageColors).spotlightColors) {
        if (col && !rawSwatches.includes(col)) rawSwatches.push(col);
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

  const sequence: string[] = ['#ffffff']; // Compulsory pure white (#ffffff) impact frame

  if (chromaticColors.length > 0) {
    for (const c of chromaticColors) {
      sequence.push(c.hex);
    }
  } else {
    // Entirely achromatic or white palette -> deterministic fallback from track seed
    const deterministicSeedHue = (Math.abs(fallbackSeed * 0.618033988749895) % 1.0);
    const col1 = new THREE.Color().setHSL(deterministicSeedHue, 0.90, 0.55);
    const col2 = new THREE.Color().setHSL((deterministicSeedHue + 0.35) % 1.0, 0.90, 0.55);
    sequence.push(`#${col1.getHexString()}`, `#${col2.getHexString()}`);
  }

  return sequence;
}
