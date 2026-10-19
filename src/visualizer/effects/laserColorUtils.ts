/**
 * Synwave Laser Palette Resolution & Color Normalization Engine (Phase 17)
 * 
 * Implements strict conditional laser color logic:
 * - Normalizes and deduplicates chromatic colors from active song palette.
 * - Excludes pure white and near-white swatches from chromatic count.
 * - Case A: Exactly 1 distinct chromatic color -> uses original chromatic color (no 180° rotation, no blue/violet substitute).
 * - Case B: Multiple distinct chromatic colors -> uses authentic chromatic colors from active song palette directly (Tone 1 = Color 1, Tone 2 = Color 2; no opposite/complementary rotation).
 * - Case C: Entirely white/achromatic -> deterministic fallback from track seed (never hardcoded blue/violet).
 */

import * as THREE from 'three';
import type { ColorPalette } from '../../types';
import type { ExtractedStageColors } from '../../services/thumbnailColorService';

export interface NormalizedLaserColor {
  hex: string;
  hsl: { h: number; s: number; l: number };
  rgb: { r: number; g: number; b: number };
}

export interface ResolvedLaserColors {
  caseType: 'A' | 'B' | 'C';
  emitterDot: THREE.Color;
  // Tone 1 (Primary ray set)
  core1: THREE.Color;
  glow1: THREE.Color;
  halo1: THREE.Color;
  // Tone 2 (Secondary ray set for dual-tone alternating fans)
  core2: THREE.Color;
  glow2: THREE.Color;
  halo2: THREE.Color;
}

/**
 * Checks whether a color is pure white or near-white (or black/achromatic gray).
 * Excludes white from the chromatic color count.
 */
export function isNearWhiteOrAchromatic(hsl: { h: number; s: number; l: number }, rgb: { r: number; g: number; b: number }): boolean {
  // Pure white or extremely bright near-white (L >= 0.88 or R,G,B all > 0.90)
  if (hsl.l >= 0.88) return true;
  if (rgb.r > 0.90 && rgb.g > 0.90 && rgb.b > 0.90) return true;

  // Desaturated bright white/gray (L >= 0.78 with low saturation S <= 0.12)
  if (hsl.l >= 0.78 && hsl.s <= 0.12) return true;

  // Near-black swatches (L <= 0.08)
  if (hsl.l <= 0.08) return true;

  // Achromatic neutral gray (S <= 0.12)
  if (hsl.s <= 0.12) return true;

  return false;
}

/**
 * Checks if two chromatic colors are visually near-identical using perceptual distance.
 */
export function areColorsNearIdentical(c1: NormalizedLaserColor, c2: NormalizedLaserColor): boolean {
  // Hue distance on circular 360° color wheel
  const hDiff = Math.abs(c1.hsl.h - c2.hsl.h);
  const hueDist = Math.min(hDiff, 1.0 - hDiff);

  // Euclidean RGB distance
  const dr = c1.rgb.r - c2.rgb.r;
  const dg = c1.rgb.g - c2.rgb.g;
  const db = c1.rgb.b - c2.rgb.b;
  const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);

  // Lightness distance
  const lDist = Math.abs(c1.hsl.l - c2.hsl.l);

  // Near-identical if RGB distance is very small (< 0.14) OR hue is very close (< 0.08) with similar lightness
  if (rgbDist < 0.14) return true;
  if (hueDist < 0.08 && lDist < 0.15) return true;

  return false;
}

/**
 * Converts a hex or CSS color string to a NormalizedLaserColor.
 */
export function parseColor(colorStr: string): NormalizedLaserColor | null {
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
 * Authoritative Laser Color Resolution Engine (Phase 17)
 */
export function resolveLaserPaletteColors(
  palette: ColorPalette | ExtractedStageColors | null | undefined,
  fallbackSeed: number = 1337
): ResolvedLaserColors {
  // 1. Gather all raw color swatches from incoming palette, preserving original order
  const rawSwatches: string[] = [];
  if (palette) {
    if ('primary' in palette && palette.primary) rawSwatches.push(palette.primary);
    if ('secondary' in palette && palette.secondary) rawSwatches.push(palette.secondary);
    if ('accent' in palette && palette.accent) rawSwatches.push(palette.accent);
    if ('spotlightColors' in palette && Array.isArray((palette as ExtractedStageColors).spotlightColors)) {
      for (const col of (palette as ExtractedStageColors).spotlightColors) {
        if (col && !rawSwatches.includes(col)) rawSwatches.push(col);
      }
    }
  }

  // 2. Parse, filter out white/near-white/achromatic, and deduplicate visually near-identical swatches
  const chromaticColors: NormalizedLaserColor[] = [];

  for (const raw of rawSwatches) {
    const parsed = parseColor(raw);
    if (!parsed) continue;

    // Exclude pure white and near-white from chromatic count
    if (isNearWhiteOrAchromatic(parsed.hsl, parsed.rgb)) {
      continue;
    }

    // Deduplicate near-identical swatches against already accepted chromatic colors
    const isDuplicate = chromaticColors.some((existing) => areColorsNearIdentical(existing, parsed));
    if (!isDuplicate) {
      chromaticColors.push(parsed);
    }
  }

  const chromaticCount = chromaticColors.length;

  // -------------------------------------------------------------------------
  // Case A — Exactly one distinct non-white color
  // -------------------------------------------------------------------------
  // Use original chromatic palette color for all laser components.
  // DO NOT rotate hue, DO NOT generate complementary color, DO NOT substitute blue/violet.
  // Apply same base hue to core, glow sheath, halo, and emitter with depth variations.
  if (chromaticCount === 1) {
    const single = chromaticColors[0];
    const baseHue = single.hsl.h;
    const baseSat = Math.max(0.75, single.hsl.s);

    const emitterDot = new THREE.Color().setHSL(baseHue, 1.0, 0.60);
    // Core: luminous high-brightness neon filament
    const core1 = new THREE.Color().setHSL(baseHue, 1.0, 0.68);
    // Sheath: rich volumetric colored beam envelope
    const glow1 = new THREE.Color().setHSL(baseHue, baseSat, 0.50);
    // Halo: soft feathered atmospheric falloff
    const halo1 = new THREE.Color().setHSL(baseHue, Math.min(1.0, baseSat * 0.95), 0.38);

    // Uniform hue across all secondary beams
    const core2 = core1.clone();
    const glow2 = glow1.clone();
    const halo2 = halo1.clone();

    return {
      caseType: 'A',
      emitterDot,
      core1,
      glow1,
      halo1,
      core2,
      glow2,
      halo2,
    };
  }

  // -------------------------------------------------------------------------
  // Case B — Multiple distinct non-white colors
  // -------------------------------------------------------------------------
  // Use the exact chromatic colors present in the song directly.
  // DO NOT compute opposite / complementary colors. Tone 1 uses Color 1, Tone 2 uses Color 2.
  if (chromaticCount >= 2) {
    const col1 = chromaticColors[0];
    const col2 = chromaticColors[1];

    const hue1 = col1.hsl.h;
    const sat1 = Math.max(0.75, col1.hsl.s);

    const hue2 = col2.hsl.h;
    const sat2 = Math.max(0.75, col2.hsl.s);

    const emitterDot = new THREE.Color().setHSL(hue1, 1.0, 0.60);

    // Tone 1: Authentic Song Palette Color 1
    const core1 = new THREE.Color().setHSL(hue1, 1.0, 0.68);
    const glow1 = new THREE.Color().setHSL(hue1, sat1, 0.50);
    const halo1 = new THREE.Color().setHSL(hue1, Math.min(1.0, sat1 * 0.95), 0.38);

    // Tone 2: Authentic Song Palette Color 2
    const core2 = new THREE.Color().setHSL(hue2, 1.0, 0.68);
    const glow2 = new THREE.Color().setHSL(hue2, sat2, 0.50);
    const halo2 = new THREE.Color().setHSL(hue2, Math.min(1.0, sat2 * 0.95), 0.38);

    return {
      caseType: 'B',
      emitterDot,
      core1,
      glow1,
      halo1,
      core2,
      glow2,
      halo2,
    };
  }

  // -------------------------------------------------------------------------
  // Case C — Entirely white or achromatic palette (chromaticCount === 0)
  // -------------------------------------------------------------------------
  // Do NOT derive complementary hues from white or gray.
  // Use documented deterministic fallback derived from Synwave's track-palette generation seed.
  // Never default to fixed blue (#00f0ff) or violet (#9900ff).
  const deterministicSeedHue = (Math.abs(fallbackSeed * 0.618033988749895) % 1.0);
  const fallbackHue1 = deterministicSeedHue;
  const fallbackHue2 = (deterministicSeedHue + 0.33) % 1.0;

  const emitterDot = new THREE.Color().setHSL(fallbackHue1, 1.0, 0.60);

  const core1 = new THREE.Color().setHSL(fallbackHue1, 1.0, 0.68);
  const glow1 = new THREE.Color().setHSL(fallbackHue1, 0.90, 0.50);
  const halo1 = new THREE.Color().setHSL(fallbackHue1, 0.85, 0.38);

  const core2 = new THREE.Color().setHSL(fallbackHue2, 1.0, 0.68);
  const glow2 = new THREE.Color().setHSL(fallbackHue2, 0.90, 0.50);
  const halo2 = new THREE.Color().setHSL(fallbackHue2, 0.85, 0.38);

  return {
    caseType: 'C',
    emitterDot,
    core1,
    glow1,
    halo1,
    core2,
    glow2,
    halo2,
  };
}

/**
 * Resolves the active song's flash color sequence (Phase 18).
 * - Guaranteed to include pure white (#ffffff) as compulsory first color.
 * - Followed by the authentic chromatic colors from the active song palette.
 * - Deduplicates near-identical colors and excludes pure white from the chromatic selection so
 *   subsequent colors are distinctly colorful.
 * - Case C fallback uses deterministic track seed if the palette is entirely achromatic.
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

  const chromaticColors: NormalizedLaserColor[] = [];
  for (const raw of rawSwatches) {
    const parsed = parseColor(raw);
    if (!parsed) continue;

    // Filter out white and near-white/achromatic swatches so the chromatic steps are authentically colorful
    if (isNearWhiteOrAchromatic(parsed.hsl, parsed.rgb)) {
      continue;
    }

    const isDuplicate = chromaticColors.some((existing) => areColorsNearIdentical(existing, parsed));
    if (!isDuplicate) {
      chromaticColors.push(parsed);
    }
  }

  const sequence: string[] = ['#ffffff']; // Compulsory pure white (#FFFFFF) always included!

  if (chromaticColors.length > 0) {
    for (const c of chromaticColors) {
      sequence.push(c.hex);
    }
  } else {
    // Case C: Entirely achromatic or white palette -> deterministic fallback from track seed
    const deterministicSeedHue = (Math.abs(fallbackSeed * 0.618033988749895) % 1.0);
    const col1 = new THREE.Color().setHSL(deterministicSeedHue, 0.90, 0.55);
    const col2 = new THREE.Color().setHSL((deterministicSeedHue + 0.35) % 1.0, 0.90, 0.55);
    sequence.push(`#${col1.getHexString()}`, `#${col2.getHexString()}`);
  }

  return sequence;
}
