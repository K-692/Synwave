/**
 * Synwave Shockwave & Energy Pulse Rings Effect
 * Concentric expanding chromatic shockwave rings emitted dynamically on detected bass kicks and drops.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface RingInstance {
  mesh: THREE.Line;
  scale: number;
  opacity: number;
  maxScale: number;
  speed: number;
}

export class ShockwaveRingEffect extends BaseEffect {
  readonly id = 'shockwave-rings';
  readonly name = 'Shockwave Pulses';
  readonly family = 'Bursts & Pulses';
  readonly cost = 'low';

  private poolSize = 8;
  private ringPool: RingInstance[] = [];

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette } = context;
    const segments = 64;
    const baseRadius = 2.0;

    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * baseRadius, Math.sin(theta) * baseRadius, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.disposables.push(geometry);

    this.ringPool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(palette.accent),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(material);

      const mesh = new THREE.Line(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);

      this.ringPool.push({
        mesh,
        scale: 1,
        opacity: 0,
        maxScale: 25.0,
        speed: 15.0,
      });
    }
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled) return;

    const { features, deltaSeconds, palette } = context;

    // Trigger new ring on kick or drop
    if (features.isKick || (features.isDrop && features.isBeat)) {
      const speed = 22.0 + features.subBass * 16.0;
      const color = features.isDrop ? palette.laserColor : (features.isKick ? '#ffffff' : palette.accent);
      this.triggerShockwave(color, speed);
    }

    // Update active rings
    for (const ring of this.ringPool) {
      if (ring.opacity > 0.01) {
        ring.scale += ring.speed * deltaSeconds * this.intensity;
        ring.opacity -= deltaSeconds * 1.8;

        ring.mesh.scale.setScalar(ring.scale);
        (ring.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, ring.opacity);

        if (ring.opacity <= 0.01 || ring.scale >= ring.maxScale) {
          ring.opacity = 0;
          ring.mesh.visible = false;
        }
      }
    }
  }

  private triggerShockwave(colorHex: string, speed: number): void {
    // Find an inactive ring
    const ring = this.ringPool.find((r) => r.opacity <= 0.01);
    if (ring) {
      ring.scale = 1.0;
      ring.opacity = 0.9;
      ring.speed = speed;
      ring.mesh.visible = true;
      (ring.mesh.material as THREE.LineBasicMaterial).color.set(colorHex);
      ring.mesh.scale.setScalar(1.0);
    }
  }
}
