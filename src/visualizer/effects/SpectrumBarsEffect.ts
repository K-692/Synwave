/**
 * Synwave 3D Horizon Spectrogram Bars Effect
 * Elegant horizon equalizer skyline situated in the background, framing the scene without occluding the center.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class SpectrumBarsEffect extends BaseEffect {
  readonly id = 'spectrum-bars';
  readonly name = '3D Horizon Equalizer Skyline';
  readonly family = 'Waveforms & Frequency Forms';
  readonly cost = 'medium';

  private barCount = 48;
  private bars: THREE.Mesh[] = [];
  private barHeights: number[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.barCount = 32;
    else if (quality === 'ultra') this.barCount = 64;

    this.bars = [];
    this.barHeights = new Array(this.barCount).fill(0.1);

    const spanWidth = 55;
    const barSpacing = spanWidth / this.barCount;
    const barWidth = barSpacing * 0.7;

    for (let i = 0; i < this.barCount; i++) {
      const u = (i / (this.barCount - 1)) - 0.5; // -0.5 to 0.5
      const x = u * spanWidth;
      // Gentle parabolic curve backwards so edges curve away
      const z = -25.0 - Math.pow(u * 2, 2) * 8.0;

      const geometry = new THREE.BoxGeometry(barWidth, 1, barWidth * 0.8);
      geometry.translate(0, 0.5, 0); // Base at 0
      this.disposables.push(geometry);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.secondary),
        emissive: new THREE.Color(palette.primary),
        emissiveIntensity: 0.5,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85,
      });
      this.disposables.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, -6.5, z);

      this.bars.push(mesh);
      this.group.add(mesh);
    }
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || this.bars.length === 0) return;

    const { features, deltaSeconds, palette } = context;
    const freqData = features.frequencyData;
    if (!freqData || freqData.length === 0) return;

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);

    const binStep = Math.floor(180 / this.barCount);

    for (let i = 0; i < this.barCount; i++) {
      // Mirror symmetrical spectrum around center
      const centerDist = Math.abs(i - this.barCount / 2);
      const binIndex = Math.min(255, Math.floor(centerDist * binStep) + 2);

      const rawMagnitude = freqData[binIndex] / 255.0;
      const targetHeight = Math.max(0.15, Math.pow(rawMagnitude, 1.5) * 8.5 * this.intensity);

      // Smooth rise and fall
      this.barHeights[i] = this.lerp(
        this.barHeights[i],
        targetHeight,
        targetHeight > this.barHeights[i] ? deltaSeconds * 22.0 : deltaSeconds * 9.0
      );

      const bar = this.bars[i];
      bar.scale.y = this.barHeights[i];

      // Material color modulation based on bar height
      const mat = bar.material as THREE.MeshStandardMaterial;
      const factor = Math.min(1, this.barHeights[i] / 6.0);
      mat.color.copy(secondaryColor).lerp(primaryColor, factor);
      mat.emissive.copy(primaryColor);
      mat.emissiveIntensity = 0.3 + factor * 0.9 + (features.isBeat ? 0.5 : 0);
    }
  }
}
