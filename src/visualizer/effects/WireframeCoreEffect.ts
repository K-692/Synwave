/**
 * Synwave Wireframe Core & Gimbal Rings Effect
 * A central 3D geometric solid with audio-reactive vertex displacement,
 * surrounded by concentric neon gyroscopic orbital rings.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class WireframeCoreEffect extends BaseEffect {
  readonly id = 'wireframe-core';
  readonly name = 'Geometric Core';
  readonly family = 'Geometry';
  readonly cost = 'medium';

  private coreMesh!: THREE.Mesh;
  private innerCoreMesh!: THREE.Mesh;
  private ring1!: THREE.Line;
  private ring2!: THREE.Line;
  private ring3!: THREE.Line;

  private originalPositions!: Float32Array;
  private currentScale = 1.0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { palette, quality } = context;
    const detail = quality === 'low' ? 1 : quality === 'medium' ? 2 : 3;

    // Outer wireframe icosahedron
    const coreGeometry = new THREE.IcosahedronGeometry(4.0, detail);
    this.originalPositions = new Float32Array(coreGeometry.attributes.position.array);
    this.disposables.push(coreGeometry);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.primary),
      wireframe: true,
      emissive: new THREE.Color(palette.primary),
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.disposables.push(coreMaterial);

    this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    this.group.add(this.coreMesh);

    // Inner glowing solid crystal octahedron
    const innerGeometry = new THREE.OctahedronGeometry(1.8, 0);
    this.disposables.push(innerGeometry);

    const innerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.secondary),
      emissive: new THREE.Color(palette.secondary),
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true,
    });
    this.disposables.push(innerMaterial);

    this.innerCoreMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    this.group.add(this.innerCoreMesh);

    // Orbital gimbal rings
    this.ring1 = this.createGimbalRing(7.0, palette.secondary, 64);
    this.ring2 = this.createGimbalRing(8.5, palette.accent, 64);
    this.ring3 = this.createGimbalRing(10.0, palette.primary, 64);

    this.group.add(this.ring1);
    this.group.add(this.ring2);
    this.group.add(this.ring3);
  }

  private createGimbalRing(radius: number, colorHex: string, segments: number): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.disposables.push(geometry);

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(material);

    return new THREE.Line(geometry, material);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || !this.coreMesh) return;

    const { features, deltaSeconds, palette } = context;

    // React to bass with an explosive scale pop
    const targetScale = 1.0 + features.bass * 0.7 * this.intensity + (features.isBeat ? 0.35 : 0);
    this.currentScale = this.lerp(this.currentScale, targetScale, deltaSeconds * 12.0);
    this.coreMesh.scale.setScalar(this.currentScale);
    this.innerCoreMesh.scale.setScalar(1.0 + features.highMid * 0.5);

    // Rotate core and inner structure
    const rotSpeed = (0.5 + features.rms * 1.5) * deltaSeconds;
    this.coreMesh.rotation.x += rotSpeed * 0.7;
    this.coreMesh.rotation.y += rotSpeed;
    this.innerCoreMesh.rotation.x -= rotSpeed * 1.2;
    this.innerCoreMesh.rotation.z += rotSpeed * 0.9;

    // Orbital rings rotations (gimbal effect)
    this.ring1.rotation.x += deltaSeconds * (0.8 + features.bass * 2.0);
    this.ring1.rotation.y += deltaSeconds * 0.4;

    this.ring2.rotation.y += deltaSeconds * (0.6 + features.lowMid * 1.5);
    this.ring2.rotation.z += deltaSeconds * 0.3;

    this.ring3.rotation.z += deltaSeconds * (0.4 + features.highMid * 2.0);
    this.ring3.rotation.x += deltaSeconds * 0.5;

    // Vertex displacement shader/mesh animation using bass & time
    const pos = this.coreMesh.geometry.attributes.position as THREE.BufferAttribute;
    const time = context.trackTimeSeconds;
    const vertexCount = pos.count;

    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3;
      const ox = this.originalPositions[idx];
      const oy = this.originalPositions[idx + 1];
      const oz = this.originalPositions[idx + 2];

      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (len > 0.001) {
        const nx = ox / len;
        const ny = oy / len;
        const nz = oz / len;

        // Wave displacement on sphere surface
        const displacement = Math.sin(time * 6.0 + ox * 2.0 + oy * 2.0) * features.bass * 1.2 * this.intensity;
        pos.setXYZ(i, ox + nx * displacement, oy + ny * displacement, oz + nz * displacement);
      }
    }
    pos.needsUpdate = true;

    // Emissive intensity flash on beat
    const coreMat = this.coreMesh.material as THREE.MeshStandardMaterial;
    coreMat.color.set(palette.primary);
    coreMat.emissive.set(palette.primary);
    coreMat.emissiveIntensity = 0.5 + (features.isBeat ? 1.5 : features.bass * 0.8);
  }
}
