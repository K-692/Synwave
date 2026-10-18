/**
 * Synwave Base Procedural Effect
 * Abstract base class providing common math, deterministic random generation, and resource disposal.
 */

import * as THREE from 'three';
import type { VisualEffect, VisualEffectContext } from '../../types';

export abstract class BaseEffect implements VisualEffect {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly family: string;
  abstract readonly cost: 'low' | 'medium' | 'high';

  public enabled = true;
  protected intensity = 1.0;
  protected group = new THREE.Group();
  protected disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

  public initialize(context: VisualEffectContext): void {
    context.scene.add(this.group);
  }

  abstract update(context: VisualEffectContext): void;

  public setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(3, value));
  }

  public resize(_width: number, _height: number): void {
    // Override if needed
  }

  /**
   * Linear interpolation helper
   */
  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Deterministic pseudo-random generator seeded for reproducibility
   */
  protected seededRandom(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  public dispose(): void {
    // Remove group from parent
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Traverse and dispose children
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });

    // Dispose cached assets
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables = [];
  }
}
