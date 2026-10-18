/**
 * Synwave Logarithmic Particle Vortex Effect
 * Swirling spiral particle vortex orbiting a central gravitational singularity.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class ParticleVortexEffect extends BaseEffect {
  readonly id = 'particle-vortex';
  readonly name = 'Singularity Spiral Vortex';
  readonly family = 'Cosmic & Spatial Fields';
  readonly cost = 'medium';

  private points!: THREE.Points;
  private angles!: Float32Array;
  private radii!: Float32Array;
  private heights!: Float32Array;
  private count = 1800;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    if (quality === 'low') this.count = 900;
    else if (quality === 'ultra') this.count = 3000;

    const prng = this.seededRandom(context.seed + 333);
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    this.angles = new Float32Array(this.count);
    this.radii = new Float32Array(this.count);
    this.heights = new Float32Array(this.count);

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      // Spiral radius distribution
      const r = 2.0 + Math.pow(prng(), 1.6) * 28.0;
      const angle = prng() * Math.PI * 8.0;
      const y = (prng() - 0.5) * (4.0 + r * 0.25);

      this.radii[i] = r;
      this.angles[i] = angle;
      this.heights[i] = y;

      positions[idx] = Math.cos(angle) * r;
      positions[idx + 1] = y;
      positions[idx + 2] = Math.sin(angle) * r;

      const mix = prng();
      const col = primaryColor.clone().lerp(secondaryColor, mix);
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.disposables.push(geometry);

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(material);

    this.points = new THREE.Points(geometry, material);
    this.group.add(this.points);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.points) return;

    const { features, deltaSeconds, palette } = context;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const colors = this.points.geometry.attributes.color as THREE.BufferAttribute;

    const vortexSpeed = deltaSeconds * (0.8 + features.bass * 2.5) * this.intensity;
    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);

    for (let i = 0; i < this.count; i++) {
      // Closer particles orbit much faster (Keplerian orbital dynamics)
      const r = this.radii[i];
      const orbitalVelocity = vortexSpeed / Math.sqrt(Math.max(1, r * 0.4));
      this.angles[i] += orbitalVelocity;

      const angle = this.angles[i];
      const dynamicR = r + (features.isBeat ? Math.sin(angle * 2) * 1.5 : 0);

      pos.setXYZ(i, Math.cos(angle) * dynamicR, this.heights[i], Math.sin(angle) * dynamicR);

      // Color shift
      if (features.isBeat) {
        colors.setXYZ(i, primaryColor.r, primaryColor.g, primaryColor.b);
      } else {
        colors.setXYZ(i, secondaryColor.r, secondaryColor.g, secondaryColor.b);
      }
    }

    pos.needsUpdate = true;
    colors.needsUpdate = true;

    this.group.rotation.y += deltaSeconds * 0.1;
  }
}
