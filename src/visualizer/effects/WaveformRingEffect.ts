/**
 * Synwave Circular Waveform Oscilloscope Effect
 * 3D circular audio waveform displaced in real-time by live PCM time-domain samples.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class WaveformRingEffect extends BaseEffect {
  readonly id = 'waveform-ring';
  readonly name = 'Circular Oscilloscope';
  readonly family = 'Waveforms';
  readonly cost = 'low';

  private line!: THREE.Line;
  private glowLine!: THREE.Line;
  private segments = 256;
  private radius = 12.0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.segments = 128;
    else if (quality === 'ultra') this.segments = 512;

    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= this.segments; i++) {
      const theta = (i / this.segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * this.radius, Math.sin(theta) * this.radius, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.disposables.push(geometry);

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.primary),
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(material);

    this.line = new THREE.Line(geometry, material);
    this.group.add(this.line);

    // Glow clone
    const glowMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.glow),
      linewidth: 4,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(glowMaterial);

    this.glowLine = new THREE.Line(geometry.clone(), glowMaterial);
    this.disposables.push(this.glowLine.geometry);
    this.glowLine.scale.setScalar(1.02);
    this.group.add(this.glowLine);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.line) return;

    const { features, palette } = context;
    const timeDomain = features.timeDomainData;
    if (!timeDomain || timeDomain.length === 0) return;

    const positions = (this.line.geometry.attributes.position as THREE.BufferAttribute);
    const glowPositions = (this.glowLine.geometry.attributes.position as THREE.BufferAttribute);

    const step = Math.floor(timeDomain.length / this.segments);

    for (let i = 0; i <= this.segments; i++) {
      const theta = (i / this.segments) * Math.PI * 2;
      // Get sample from time-domain PCM: 0-255 centered at 128
      const sampleIdx = Math.min(timeDomain.length - 1, (i * step) % timeDomain.length);
      const sample = (timeDomain[sampleIdx] - 128) / 128; // -1 to 1

      // Radial displacement
      const r = this.radius + sample * 3.5 * this.intensity * (1 + features.bass * 0.8);
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const z = sample * 2.0 * this.intensity;

      positions.setXYZ(i, x, y, z);
      glowPositions.setXYZ(i, x * 1.02, y * 1.02, z * 1.02);
    }

    positions.needsUpdate = true;
    glowPositions.needsUpdate = true;

    // Palette tint update
    (this.line.material as THREE.LineBasicMaterial).color.set(palette.primary);
    (this.glowLine.material as THREE.LineBasicMaterial).color.set(palette.glow);

    // Subtle breathing rotation
    this.group.rotation.z += context.deltaSeconds * 0.15;
  }
}
