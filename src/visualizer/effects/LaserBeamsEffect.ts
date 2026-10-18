/**
 * Synwave Volumetric Concert Lasers Effect
 * Overhead concert stadium lasers scanning dynamically across the arena floor with transient strobing.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class LaserBeamsEffect extends BaseEffect {
  readonly id = 'laser-beams';
  readonly name = 'Concert Stadium Lasers';
  readonly family = 'Lasers & Light Beams';
  readonly cost = 'medium';

  private laserCount = 8;
  private lasers: THREE.Line[] = [];
  private baseAngles: number[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.laserCount = 6;
    else if (quality === 'ultra') this.laserCount = 12;

    this.lasers = [];
    this.baseAngles = [];

    const length = 90;
    const points = [
      new THREE.Vector3(0, 0, 0), // Beam origin
      new THREE.Vector3(0, 0, length), // Beam target
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.disposables.push(geometry);

    for (let i = 0; i < this.laserCount; i++) {
      const u = i / (this.laserCount - 1);
      const originX = (u - 0.5) * 36.0;

      const isAlt = i % 2 === 0;
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(isAlt ? palette.laserColor : palette.primary),
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(material);

      const laser = new THREE.Line(geometry, material);
      laser.position.set(originX, 11, -30); // Overhead rear truss
      this.baseAngles.push((u - 0.5) * 0.8);

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
      const baseAngle = this.baseAngles[i];

      // Concert fan sweep motion
      const sweepY = baseAngle + Math.sin(time * 1.8 + i * 0.5) * 0.6;
      const sweepX = -0.3 + Math.sin(time * 2.2 + i * 0.3) * 0.25;

      laser.rotation.y = sweepY;
      laser.rotation.x = sweepX;

      // Pulse brightness on beat
      const mat = laser.material as THREE.LineBasicMaterial;
      const beatBoost = features.isBeat ? 1.0 : features.onsetStrength * 0.6;
      mat.opacity = Math.min(1.0, 0.2 + beatBoost * 0.8);
      mat.color.copy(i % 2 === 0 ? laserColor : primaryColor);
    }
  }
}
