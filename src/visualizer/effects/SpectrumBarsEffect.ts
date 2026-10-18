/**
 * Synwave 3D Spectrum Arena Bars Effect
 * Radial 3D frequency bars oscillating to multi-band FFT data with glowing emissive caps.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class SpectrumBarsEffect extends BaseEffect {
  readonly id = 'spectrum-bars';
  readonly name = '3D Spectrum Arena';
  readonly family = 'Waveforms';
  readonly cost = 'medium';

  private barCount = 64;
  private radius = 16.0;
  private bars: THREE.Mesh[] = [];
  private barHeights: number[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.barCount = 32;
    else if (quality === 'ultra') this.barCount = 96;

    this.bars = [];
    this.barHeights = new Array(this.barCount).fill(0.1);

    const barWidth = (2 * Math.PI * this.radius) / (this.barCount * 2.2);

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      const x = Math.cos(angle) * this.radius;
      const z = Math.sin(angle) * this.radius;

      // 1 unit high box geometry, anchor bottom at 0
      const geometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
      geometry.translate(0, 0.5, 0); // Origin at bottom of bar
      this.disposables.push(geometry);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.secondary),
        emissive: new THREE.Color(palette.primary),
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.7,
      });
      this.disposables.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, -5, z);
      mesh.lookAt(0, -5, 0); // Face inward

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

    // Map the 64 bars to log/linear frequency bins across the spectrum
    const binStep = Math.floor(256 / this.barCount);

    for (let i = 0; i < this.barCount; i++) {
      // Mirror symmetrical spectrum around the circle for aesthetic balance
      const mirrorIndex = i < this.barCount / 2 ? i : this.barCount - 1 - i;
      const binIndex = Math.min(255, mirrorIndex * binStep + 1);

      const rawMagnitude = freqData[binIndex] / 255.0; // 0 to 1
      const targetHeight = Math.max(0.2, Math.pow(rawMagnitude, 1.4) * 12.0 * this.intensity);

      // Smooth rise and fall
      this.barHeights[i] = this.lerp(
        this.barHeights[i],
        targetHeight,
        targetHeight > this.barHeights[i] ? deltaSeconds * 20.0 : deltaSeconds * 8.0
      );

      const bar = this.bars[i];
      bar.scale.y = this.barHeights[i];

      // Material color modulation based on bar height
      const mat = bar.material as THREE.MeshStandardMaterial;
      const factor = Math.min(1, this.barHeights[i] / 8.0);
      mat.color.copy(secondaryColor).lerp(primaryColor, factor);
      mat.emissive.copy(primaryColor);
      mat.emissiveIntensity = 0.2 + factor * 0.8 + (features.isBeat ? 0.4 : 0);
    }

    // Slow arena rotation
    this.group.rotation.y += deltaSeconds * 0.1;
  }
}
