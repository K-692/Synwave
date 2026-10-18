/**
 * Synwave Morphing Torus Knot Effect
 * Elegant mathematical 3D knot with audio-driven radial displacement and continuous twisting.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class TorusKnotEffect extends BaseEffect {
  readonly id = 'torus-knot';
  readonly name = 'Morphing Torus Knot';
  readonly family = 'Procedural Geometry';
  readonly cost = 'medium';

  private knotMesh!: THREE.Mesh;
  private wireMesh!: THREE.LineSegments;
  private scale = 1.0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    const tubularSegments = quality === 'low' ? 64 : quality === 'medium' ? 100 : 160;
    const radialSegments = quality === 'low' ? 8 : 14;

    const geometry = new THREE.TorusKnotGeometry(3.6, 0.9, tubularSegments, radialSegments, 2, 3);
    this.disposables.push(geometry);

    // Glowing translucent solid
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.secondary),
      emissive: new THREE.Color(palette.primary),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    this.disposables.push(material);

    this.knotMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.knotMesh);

    // Wireframe overlay for crisp geometric lines
    const wireGeo = new THREE.WireframeGeometry(geometry);
    this.disposables.push(wireGeo);

    const wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(wireMat);

    this.wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    this.group.add(this.wireMesh);

    this.group.position.set(0, 0, 0);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.knotMesh) return;

    const { features, deltaSeconds, palette } = context;

    // React to bass surges
    const targetScale = 1.0 + features.bass * 0.5 * this.intensity + (features.isBeat ? 0.25 : 0);
    this.scale = this.lerp(this.scale, targetScale, deltaSeconds * 10.0);

    this.knotMesh.scale.setScalar(this.scale);
    this.wireMesh.scale.setScalar(this.scale * 1.01);

    // Rotations around multi-axis
    const rotSpeed = deltaSeconds * (0.4 + features.highMid * 1.2);
    this.group.rotation.x += rotSpeed * 0.7;
    this.group.rotation.y += rotSpeed;
    this.group.rotation.z += rotSpeed * 0.4;

    // Emissive color modulation
    const mat = this.knotMesh.material as THREE.MeshStandardMaterial;
    mat.emissive.lerp(new THREE.Color(palette.primary), deltaSeconds * 3.0);
    mat.emissiveIntensity = 0.5 + features.bass * 1.2 + (features.isBeat ? 1.0 : 0);

    const wireMat = this.wireMesh.material as THREE.LineBasicMaterial;
    wireMat.color.lerp(new THREE.Color(palette.accent), deltaSeconds * 3.0);
  }
}
