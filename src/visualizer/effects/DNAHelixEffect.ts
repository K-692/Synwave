/**
 * Synwave Procedural DNA Helix Effect
 * Rotating double-helix strands with interconnected glowing audio-reactive rungs.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class DNAHelixEffect extends BaseEffect {
  readonly id = 'dna-helix';
  readonly name = 'Double Helix Symphony';
  readonly family = 'Ribbons & Fluid Waves';
  readonly cost = 'medium';

  private strand1!: THREE.Line;
  private strand2!: THREE.Line;
  private rungs: THREE.Line[] = [];
  private numRungs = 28;
  private length = 32;
  private radius = 3.5;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette } = context;
    const pointsPerStrand = 120;
    const strand1Points: THREE.Vector3[] = [];
    const strand2Points: THREE.Vector3[] = [];

    for (let i = 0; i < pointsPerStrand; i++) {
      const u = i / pointsPerStrand;
      const y = (u - 0.5) * this.length;
      const angle = u * Math.PI * 6;
      strand1Points.push(new THREE.Vector3(Math.cos(angle) * this.radius, y, Math.sin(angle) * this.radius));
      strand2Points.push(new THREE.Vector3(Math.cos(angle + Math.PI) * this.radius, y, Math.sin(angle + Math.PI) * this.radius));
    }

    const geo1 = new THREE.BufferGeometry().setFromPoints(strand1Points);
    const geo2 = new THREE.BufferGeometry().setFromPoints(strand2Points);
    this.disposables.push(geo1, geo2);

    const mat1 = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.primary),
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const mat2 = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.secondary),
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(mat1, mat2);

    this.strand1 = new THREE.Line(geo1, mat1);
    this.strand2 = new THREE.Line(geo2, mat2);
    this.group.add(this.strand1);
    this.group.add(this.strand2);

    // Cross rungs
    this.rungs = [];
    for (let r = 0; r < this.numRungs; r++) {
      const u = (r + 0.5) / this.numRungs;
      const y = (u - 0.5) * this.length;
      const angle = u * Math.PI * 6;

      const p1 = new THREE.Vector3(Math.cos(angle) * this.radius, y, Math.sin(angle) * this.radius);
      const p2 = new THREE.Vector3(Math.cos(angle + Math.PI) * this.radius, y, Math.sin(angle + Math.PI) * this.radius);

      const rungGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      this.disposables.push(rungGeo);

      const rungMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(palette.accent),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(rungMat);

      const rung = new THREE.Line(rungGeo, rungMat);
      this.rungs.push(rung);
      this.group.add(rung);
    }
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.strand1) return;

    const { features, deltaSeconds, palette } = context;

    // Rotate the double helix around its vertical axis
    const rotSpeed = deltaSeconds * (0.8 + features.rms * 1.5);
    this.group.rotation.y += rotSpeed;

    // React to treble/highMid with gentle radius pulsation
    const dynamicRadius = this.radius * (1.0 + features.bass * 0.4 * this.intensity);
    this.strand1.scale.x = dynamicRadius / this.radius;
    this.strand1.scale.z = dynamicRadius / this.radius;
    this.strand2.scale.x = dynamicRadius / this.radius;
    this.strand2.scale.z = dynamicRadius / this.radius;

    // Update colors
    (this.strand1.material as THREE.LineBasicMaterial).color.lerp(new THREE.Color(palette.primary), deltaSeconds * 2);
    (this.strand2.material as THREE.LineBasicMaterial).color.lerp(new THREE.Color(palette.secondary), deltaSeconds * 2);

    for (let i = 0; i < this.rungs.length; i++) {
      const rung = this.rungs[i];
      const mat = rung.material as THREE.LineBasicMaterial;
      mat.opacity = 0.3 + (i % 2 === 0 ? features.bass : features.treble) * 0.7;
    }
  }
}
