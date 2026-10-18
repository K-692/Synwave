/**
 * Synwave Volumetric Crossing Lasers Effect
 * High-intensity procedural laser beams that sweep, intersect, and pulse violently on rhythmic drops.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class LaserBeamsEffect extends BaseEffect {
  readonly id = 'laser-beams';
  readonly name = 'Crossing Lasers';
  readonly family = 'Lasers & Light';
  readonly cost = 'medium';

  private laserCount = 8;
  private lasers: THREE.Line[] = [];
  private angles: number[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.laserCount = 4;
    else if (quality === 'ultra') this.laserCount = 12;

    this.lasers = [];
    this.angles = [];

    const prng = this.seededRandom(context.seed + 77);

    for (let i = 0; i < this.laserCount; i++) {
      const length = 120;
      const points = [
        new THREE.Vector3(0, 0, -length / 2),
        new THREE.Vector3(0, 0, length / 2),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.disposables.push(geometry);

      const isAlt = i % 2 === 0;
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(isAlt ? palette.laserColor : palette.primary),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(material);

      const laser = new THREE.Line(geometry, material);
      const angle = (i / this.laserCount) * Math.PI * 2;
      this.angles.push(angle);

      laser.position.set(Math.cos(angle) * 15, Math.sin(angle) * 15, (prng() - 0.5) * 20);
      this.lasers.push(laser);
      this.group.add(laser);
    }
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || this.lasers.length === 0) return;

    const { features, trackTimeSeconds, palette } = context;
    const time = trackTimeSeconds;

    const laserColor = new THREE.Color(palette.laserColor);
    const primaryColor = new THREE.Color(palette.primary);

    for (let i = 0; i < this.lasers.length; i++) {
      const laser = this.lasers[i];
      const baseAngle = this.angles[i];

      // Oscillate orientation and sweep angles
      const sweepX = Math.sin(time * 1.5 + baseAngle) * 0.8 * (1 + features.highMid);
      const sweepY = Math.cos(time * 1.2 + baseAngle) * 0.8 * (1 + features.bass);

      laser.rotation.x = sweepX;
      laser.rotation.y = sweepY;
      laser.rotation.z = baseAngle + time * 0.2;

      // Pulse brightness on beat
      const mat = laser.material as THREE.LineBasicMaterial;
      const beatBoost = features.isBeat ? 1.0 : features.onsetStrength * 0.6;
      mat.opacity = Math.min(1.0, 0.4 + beatBoost);
      mat.color.copy(i % 2 === 0 ? laserColor : primaryColor);
    }

    this.group.rotation.z = time * 0.1;
  }
}
