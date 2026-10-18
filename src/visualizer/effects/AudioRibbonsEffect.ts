/**
 * Synwave Flowing Audio Ribbons Effect
 * Sinusoidal 3D flowing curves undulating to musical dynamics with fluid ribbons.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class AudioRibbonsEffect extends BaseEffect {
  readonly id = 'audio-ribbons';
  readonly name = 'Fluid Audio Ribbons';
  readonly family = 'Ribbons';
  readonly cost = 'medium';

  private ribbonCount = 5;
  private pointsPerRibbon = 120;
  private ribbonLines: THREE.Line[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') {
      this.ribbonCount = 3;
      this.pointsPerRibbon = 80;
    } else if (quality === 'ultra') {
      this.ribbonCount = 7;
      this.pointsPerRibbon = 160;
    }

    this.ribbonLines = [];
    const colors = [palette.primary, palette.secondary, palette.accent, palette.glow, palette.laserColor];

    for (let r = 0; r < this.ribbonCount; r++) {
      const points: THREE.Vector3[] = [];
      for (let p = 0; p < this.pointsPerRibbon; p++) {
        points.push(new THREE.Vector3(0, 0, 0));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.disposables.push(geometry);

      const color = new THREE.Color(colors[r % colors.length]);
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(material);

      const line = new THREE.Line(geometry, material);
      this.ribbonLines.push(line);
      this.group.add(line);
    }
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || this.ribbonLines.length === 0) return;

    const { features, trackTimeSeconds } = context;
    const time = trackTimeSeconds;

    for (let r = 0; r < this.ribbonLines.length; r++) {
      const line = this.ribbonLines[r];
      const positions = line.geometry.attributes.position as THREE.BufferAttribute;
      const phaseOffset = (r / this.ribbonCount) * Math.PI * 2;
      const ribbonRadius = 6.0 + r * 1.8;

      for (let p = 0; p < this.pointsPerRibbon; p++) {
        const u = p / this.pointsPerRibbon;
        const theta = u * Math.PI * 2 + time * 0.4 + phaseOffset;

        // Wave oscillation harmonics driven by audio
        const wave1 = Math.sin(theta * 3.0 + time * 2.0) * (1.5 + features.lowMid * 2.5);
        const wave2 = Math.cos(theta * 5.0 - time * 3.0) * (0.8 + features.highMid * 2.0);

        const currentR = ribbonRadius + wave1 * this.intensity;
        const x = Math.cos(theta) * currentR;
        const y = Math.sin(theta) * currentR;
        const z = wave2 * this.intensity * 2.5 + (Math.sin(u * Math.PI * 4 + time) * features.bass * 3.0);

        positions.setXYZ(p, x, y, z);
      }

      positions.needsUpdate = true;
    }

    // Dynamic rotation of ribbon group
    this.group.rotation.x = Math.sin(time * 0.3) * 0.3;
    this.group.rotation.y = time * 0.15;
  }
}
