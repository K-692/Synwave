/**
 * Synwave Starfield & Hyperspace Warp Effect
 * Procedural particle field with audio-driven velocity, relativistic star-stretching, and dynamic hue.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class StarfieldEffect extends BaseEffect {
  readonly id = 'starfield-warp';
  readonly name = 'Hyperspace Starfield';
  readonly family = 'Cosmic';
  readonly cost = 'low';

  private points!: THREE.Points;
  private positions!: Float32Array;
  private velocities!: Float32Array;
  private originalPositions!: Float32Array;
  private colors!: Float32Array;
  private count = 3500;
  private speed = 1.0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Adjust particle count based on quality
    if (context.quality === 'low') this.count = 1500;
    else if (context.quality === 'medium') this.count = 2800;
    else if (context.quality === 'high') this.count = 4200;
    else if (context.quality === 'ultra') this.count = 6000;

    const prng = this.seededRandom(context.seed + 101);
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count);
    this.originalPositions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);

    const primaryColor = new THREE.Color(context.palette.primary);
    const secondaryColor = new THREE.Color(context.palette.secondary);
    const accentColor = new THREE.Color(context.palette.accent);

    const spread = 80;
    const depth = 140;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const x = (prng() - 0.5) * spread;
      const y = (prng() - 0.5) * spread;
      const z = (prng() - 0.5) * depth;

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;

      this.originalPositions[idx] = x;
      this.originalPositions[idx + 1] = y;
      this.originalPositions[idx + 2] = z;

      this.velocities[i] = 0.5 + prng() * 1.5;

      // Color variation between primary, secondary, and accent
      const mix = prng();
      const c = mix < 0.5
        ? primaryColor.clone().lerp(secondaryColor, mix * 2)
        : secondaryColor.clone().lerp(accentColor, (mix - 0.5) * 2);

      this.colors[idx] = c.r;
      this.colors[idx + 1] = c.g;
      this.colors[idx + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.disposables.push(geometry);

    // Particle texture generated procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    this.disposables.push(texture);

    const material = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      map: texture,
      transparent: true,
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

    // Warp speed increases with energy
    const targetSpeed = 0.8 + features.bass * 2.5 + features.rms * 2.0 + (features.isBeat ? 2.5 : 0);
    this.speed = this.lerp(this.speed, targetSpeed, deltaSeconds * 6.0);

    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.points.geometry.attributes.color as THREE.BufferAttribute;

    const zLimitFront = 5.0; // Keep stars well in the background
    const zResetBack = -130.0;

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const v = this.velocities[i] * this.speed * this.intensity;

      this.positions[idx + 2] += v * deltaSeconds * 20.0;

      // Wrap around depth
      if (this.positions[idx + 2] > zLimitFront) {
        this.positions[idx + 2] = zResetBack;
      }

      // Dynamic reactive star brightness on beat
      if (features.isBeat) {
        this.colors[idx] = primaryColor.r;
        this.colors[idx + 1] = primaryColor.g;
        this.colors[idx + 2] = primaryColor.b;
      } else {
        // Return smoothly to palette tones
        this.colors[idx] = this.lerp(this.colors[idx], secondaryColor.r, deltaSeconds * 2);
        this.colors[idx + 1] = this.lerp(this.colors[idx + 1], secondaryColor.g, deltaSeconds * 2);
        this.colors[idx + 2] = this.lerp(this.colors[idx + 2], secondaryColor.b, deltaSeconds * 2);
      }
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Subtle cosmic field rotation
    this.group.rotation.z += deltaSeconds * 0.05 * (1 + features.highMid);
  }
}
