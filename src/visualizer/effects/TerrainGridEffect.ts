/**
 * Synwave Retro Grid & Audio Terrain Effect
 * An infinite procedural wireframe grid plane extending into the horizon,
 * with outer mountain ridges undulating to bass and sub-bass frequencies.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class TerrainGridEffect extends BaseEffect {
  readonly id = 'terrain-grid';
  readonly name = 'Horizon Synthwave Grid';
  readonly family = 'Procedural Geometry';
  readonly cost = 'medium';

  private planeMesh!: THREE.LineSegments;
  private originalVertices!: Float32Array;
  private widthSegments = 40;
  private depthSegments = 40;
  private planeWidth = 90;
  private planeDepth = 90;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette } = context;

    // Plane geometry in X-Z plane
    const geometry = new THREE.PlaneGeometry(
      this.planeWidth,
      this.planeDepth,
      this.widthSegments,
      this.depthSegments
    );
    geometry.rotateX(-Math.PI / 2); // Flat on ground

    // Convert to wireframe lines for sleek cyber aesthetic
    const wireGeometry = new THREE.WireframeGeometry(geometry);
    this.originalVertices = new Float32Array(wireGeometry.attributes.position.array);
    this.disposables.push(geometry, wireGeometry);

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.primary),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(material);

    this.planeMesh = new THREE.LineSegments(wireGeometry, material);
    this.planeMesh.position.set(0, -6.5, -20);
    this.group.add(this.planeMesh);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.planeMesh) return;

    const { features, deltaSeconds, palette, trackTimeSeconds } = context;
    const time = trackTimeSeconds;

    const pos = this.planeMesh.geometry.attributes.position as THREE.BufferAttribute;
    const count = pos.count;

    // Undulate the outer edges into audio mountain ridges
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const ox = this.originalVertices[idx];
      const oz = this.originalVertices[idx + 2];

      // Distance from center corridor (keep center runway smooth)
      const distFromCenter = Math.abs(ox);
      const flankFactor = Math.max(0, (distFromCenter - 8) / 25);

      if (flankFactor > 0) {
        const wave = Math.sin(ox * 0.3 + time * 2.0) * Math.cos(oz * 0.2 - time * 1.5);
        const audioHeight = wave * flankFactor * 4.5 * (features.bass * 1.8 + features.rms * 0.8) * this.intensity;
        pos.setY(i, audioHeight);
      } else {
        // Subtle runway ripple
        const runwayWave = Math.sin(oz * 0.4 - time * 4.0) * features.lowMid * 0.4;
        pos.setY(i, runwayWave);
      }
    }
    pos.needsUpdate = true;

    // Smoothly color lines to active mood palette
    const mat = this.planeMesh.material as THREE.LineBasicMaterial;
    mat.color.lerp(new THREE.Color(palette.primary), deltaSeconds * 3.0);
    mat.opacity = 0.35 + features.rms * 0.3 + (features.isBeat ? 0.2 : 0);
  }
}
