/**
 * Synwave Bass-Activated Shockwave Particles Effect
 * Replaces aimless particle roaming with true bass-driven shockwaves,
 * drum-kick radial detonations, and calm celestial breathing.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class StarfieldEffect extends BaseEffect {
  readonly id = 'starfield-warp';
  readonly name = 'Bass Shockwave Particles';
  readonly family = 'Cosmic';
  readonly cost = 'medium';

  private points!: THREE.Points;
  private positions!: Float32Array;
  private basePositions!: Float32Array;
  private velocities!: Float32Array; // 3D radial impulse velocities
  private colors!: Float32Array;
  private sizes!: Float32Array;
  private count = 4000;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Adjust particle count based on quality
    if (context.quality === 'low') this.count = 2000;
    else if (context.quality === 'medium') this.count = 3200;
    else if (context.quality === 'high') this.count = 4500;
    else if (context.quality === 'ultra') this.count = 6500;

    const prng = this.seededRandom(context.seed + 101);
    this.positions = new Float32Array(this.count * 3);
    this.basePositions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);

    const primaryColor = new THREE.Color(context.palette.primary);
    const secondaryColor = new THREE.Color(context.palette.secondary);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;

      // Spherical distribution around stage center
      const theta = prng() * Math.PI * 2;
      const phi = Math.acos(prng() * 2 - 1);
      const radius = 15.0 + prng() * 65.0;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = (radius * Math.cos(phi)) - 10.0; // Centered behind / around stage

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;

      this.basePositions[idx] = x;
      this.basePositions[idx + 1] = y;
      this.basePositions[idx + 2] = z;

      this.velocities[idx] = 0;
      this.velocities[idx + 1] = 0;
      this.velocities[idx + 2] = 0;

      this.sizes[i] = 0.4 + prng() * 0.6;

      const mix = prng();
      const c = primaryColor.clone().lerp(secondaryColor, mix);
      this.colors[idx] = c.r;
      this.colors[idx + 1] = c.g;
      this.colors[idx + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.disposables.push(geometry);

    // Procedural soft-glow particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    this.disposables.push(texture);

    const material = new THREE.PointsMaterial({
      size: 0.65,
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

    const { features, deltaSeconds, palette, trackTimeSeconds } = context;
    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.points.geometry.attributes.color as THREE.BufferAttribute;

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);
    const whiteColor = new THREE.Color('#ffffff');

    // 1. Calm Mode Behavior (Gentle breathing stardust)
    if (features.musicMode === 'calm') {
      const slowTime = trackTimeSeconds * 0.4;
      for (let i = 0; i < this.count; i++) {
        const idx = i * 3;
        const bx = this.basePositions[idx];
        const by = this.basePositions[idx + 1];
        const bz = this.basePositions[idx + 2];

        // Soft, serene sinusoidal drift (like ocean dust / fireflies)
        const wave = Math.sin(slowTime + bx * 0.05 + by * 0.05) * 1.5 * (1 + features.lowMid * 0.5);
        this.positions[idx] = bx + wave * 0.5;
        this.positions[idx + 1] = by + Math.cos(slowTime + bz * 0.05) * 1.2;
        this.positions[idx + 2] = bz + wave * 0.8;

        // Soft twilight coloration
        this.colors[idx] = this.lerp(this.colors[idx], primaryColor.r, deltaSeconds * 2.0);
        this.colors[idx + 1] = this.lerp(this.colors[idx + 1], primaryColor.g, deltaSeconds * 2.0);
        this.colors[idx + 2] = this.lerp(this.colors[idx + 2], primaryColor.b, deltaSeconds * 2.0);
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      return;
    }

    // 2. Festival Mode Behavior (BASS-ACTIVATED MOVEMENTS)
    // On drum kick hit: Apply massive explosive radial impulse outward
    const kickForce = features.isKick ? (features.kickIntensity * 32.0) : 0;
    const dropForce = features.isDrop ? (features.subBass * 28.0 + 8.0) : 0;
    const totalImpulse = (kickForce + dropForce) * this.intensity;

    // Fluid drag & spring return forces
    const drag = Math.pow(0.08, deltaSeconds); // rapid deceleration of impulse
    const springRate = deltaSeconds * 4.5;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const px = this.positions[idx];
      const py = this.positions[idx + 1];
      const pz = this.positions[idx + 2];

      const bx = this.basePositions[idx];
      const by = this.basePositions[idx + 1];
      const bz = this.basePositions[idx + 2];

      // Calculate unit vector away from stage center (0, 0, -10)
      const dx = px;
      const dy = py;
      const dz = pz - (-10.0);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Apply explosive blast if kick/drop occurred
      if (totalImpulse > 0) {
        this.velocities[idx] += nx * totalImpulse * (0.8 + (i % 5) * 0.1);
        this.velocities[idx + 1] += ny * totalImpulse * (0.8 + (i % 5) * 0.1);
        this.velocities[idx + 2] += nz * totalImpulse * (0.8 + (i % 5) * 0.1);
      }

      // Update positions with impulse velocity
      this.positions[idx] += this.velocities[idx] * deltaSeconds;
      this.positions[idx + 1] += this.velocities[idx + 1] * deltaSeconds;
      this.positions[idx + 2] += this.velocities[idx + 2] * deltaSeconds;

      // Apply drag
      this.velocities[idx] *= drag;
      this.velocities[idx + 1] *= drag;
      this.velocities[idx + 2] *= drag;

      // Sub-bass continuous radial pulsation
      const bassExpansion = 1.0 + features.subBass * 0.45;
      const targetX = bx * bassExpansion;
      const targetY = by * bassExpansion;
      const targetZ = bz * bassExpansion;

      // Spring pull back toward base position
      this.positions[idx] = this.lerp(this.positions[idx], targetX, springRate);
      this.positions[idx + 1] = this.lerp(this.positions[idx + 1], targetY, springRate);
      this.positions[idx + 2] = this.lerp(this.positions[idx + 2], targetZ, springRate);

      // Color reaction: White-hot on kick, high-energy glow on drop, neon otherwise
      if (features.isKick) {
        this.colors[idx] = whiteColor.r;
        this.colors[idx + 1] = whiteColor.g;
        this.colors[idx + 2] = whiteColor.b;
      } else if (features.isDrop) {
        const dropCol = i % 2 === 0 ? primaryColor : secondaryColor;
        this.colors[idx] = dropCol.r;
        this.colors[idx + 1] = dropCol.g;
        this.colors[idx + 2] = dropCol.b;
      } else {
        this.colors[idx] = this.lerp(this.colors[idx], primaryColor.r, deltaSeconds * 3.0);
        this.colors[idx + 1] = this.lerp(this.colors[idx + 1], primaryColor.g, deltaSeconds * 3.0);
        this.colors[idx + 2] = this.lerp(this.colors[idx + 2], primaryColor.b, deltaSeconds * 3.0);
      }
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Subtle arena rotation modulated by rhythm
    this.group.rotation.z += deltaSeconds * 0.12 * (1 + features.rms);
  }
}
