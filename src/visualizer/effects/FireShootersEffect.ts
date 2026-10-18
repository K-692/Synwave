/**
 * Synwave Concert Pyro Fire Shooters Effect
 * 
 * 6 Heavy-duty stage flamethrowers positioned along the front edge of the concert platform.
 * Erupts with massive vertical flame plumes and dynamic stage-illuminating warm light flashes
 * triggered by bass kicks, drops, and high-energy music climaxes.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface FlameCannon {
  baseMesh: THREE.Mesh;
  flameMesh: THREE.Mesh;
  pilotMesh: THREE.Mesh;
  position: THREE.Vector3;
  flameHeight: number;
  targetHeight: number;
  intensity: number;
  cooldownTimer: number;
}

export class FireShootersEffect extends BaseEffect {
  readonly id = 'fire-shooters';
  readonly name = 'Concert Pyro Flame Blasters';
  readonly family = 'Pyrotechnics';
  readonly cost = 'medium';

  private cannons: FlameCannon[] = [];
  private flameLight1!: THREE.PointLight;
  private flameLight2!: THREE.PointLight;
  private fireShaderUniforms = {
    uTime: { value: 0 },
    uNoiseScale: { value: 2.5 },
  };

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 6 Flame Cannons along front stage deck lip (x = -12.5 to +12.5, y = -0.2, z = 4.8)
    const cannonPositions = [
      new THREE.Vector3(-12.5, -0.2, 4.6),
      new THREE.Vector3(-7.5, -0.2, 4.8),
      new THREE.Vector3(-2.5, -0.2, 4.9),
      new THREE.Vector3(2.5, -0.2, 4.9),
      new THREE.Vector3(7.5, -0.2, 4.8),
      new THREE.Vector3(12.5, -0.2, 4.6),
    ];

    // Shared Cannon Base Geometry
    const baseGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.5, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x11141c,
      metalness: 0.9,
      roughness: 0.4,
    });
    this.disposables.push(baseGeo, baseMat);

    // Flame Plume Geometry (tapered cylinder stretching upwards)
    const flameGeo = new THREE.CylinderGeometry(0.2, 1.2, 10, 16, 8, true);
    // Anchor pivot at base of flame
    flameGeo.translate(0, 5, 0);
    this.disposables.push(flameGeo);

    // Pilot flame geometry (subtle resting spark)
    const pilotGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const pilotMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    });
    this.disposables.push(pilotGeo, pilotMat);

    for (let i = 0; i < cannonPositions.length; i++) {
      const pos = cannonPositions[i];

      // Cannon nozzle
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.copy(pos);
      this.group.add(baseMesh);

      // Pilot light
      const pilotMesh = new THREE.Mesh(pilotGeo, pilotMat);
      pilotMesh.position.set(pos.x, pos.y + 0.3, pos.z);
      this.group.add(pilotMesh);

      // Flame Plume Mesh with vibrant fiery additive shader material
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(flameMat);

      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.position.set(pos.x, pos.y + 0.25, pos.z);
      flameMesh.scale.set(1, 0.001, 1);
      this.group.add(flameMesh);

      this.cannons.push({
        baseMesh,
        flameMesh,
        pilotMesh,
        position: pos,
        flameHeight: 0,
        targetHeight: 0,
        intensity: 0,
        cooldownTimer: 0,
      });
    }

    // Dynamic Pyro Stage Point Lights (illumination when flames burst)
    this.flameLight1 = new THREE.PointLight(0xff5500, 0, 35, 1.8);
    this.flameLight1.position.set(-6, 2.5, 5);
    this.group.add(this.flameLight1);

    this.flameLight2 = new THREE.PointLight(0xffaa00, 0, 35, 1.8);
    this.flameLight2.position.set(6, 2.5, 5);
    this.group.add(this.flameLight2);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds } = context;
    this.fireShaderUniforms.uTime.value += deltaSeconds;

    // Trigger logic: Kicks, drops, and high-energy onset
    const shouldErupt =
      (features.isKick && features.kickIntensity > 0.45) ||
      (features.isDrop && Math.random() < 0.45) ||
      (features.onsetStrength > 0.75 && features.bass > 0.65);

    let anyFiring = false;
    let maxFlameIntensity = 0;

    for (let i = 0; i < this.cannons.length; i++) {
      const cannon = this.cannons[i];
      cannon.cooldownTimer -= deltaSeconds;

      // Check if this cannon should burst
      if (shouldErupt && cannon.cooldownTimer <= 0) {
        // Center cannons burst on every kick, outer cannons on drops or heavy beats
        const isCenter = i === 2 || i === 3;
        const isMid = i === 1 || i === 4;
        const triggerProbability = features.isDrop ? 1.0 : isCenter ? 0.95 : isMid ? 0.7 : 0.4;

        if (Math.random() < triggerProbability) {
          const power = features.isDrop ? 1.4 : Math.max(0.7, features.kickIntensity * 1.2);
          cannon.targetHeight = power * (0.9 + Math.random() * 0.4);
          cannon.intensity = 1.0;
          cannon.cooldownTimer = features.isDrop ? 0.12 : 0.22;
        }
      }

      // Smoothly interpolate flame height
      if (cannon.intensity > 0.05) {
        anyFiring = true;
        cannon.flameHeight = this.lerp(cannon.flameHeight, cannon.targetHeight, deltaSeconds * 28);
        cannon.intensity = Math.max(0, cannon.intensity - deltaSeconds * 2.8);
      } else {
        cannon.flameHeight = this.lerp(cannon.flameHeight, 0, deltaSeconds * 12);
        cannon.targetHeight = 0;
      }

      maxFlameIntensity = Math.max(maxFlameIntensity, cannon.intensity);

      // Scale flame plume mesh
      const currentH = Math.max(0.001, cannon.flameHeight);
      const flickerW = 1.0 + Math.sin(performance.now() * 0.02 + i) * 0.15;
      cannon.flameMesh.scale.set(flickerW, currentH, flickerW);

      // Color and opacity
      const mat = cannon.flameMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = cannon.intensity * 0.9;
      if (cannon.intensity > 0.6) {
        // Blazing white-yellow at peak
        mat.color.setHex(0xffdd66);
      } else if (cannon.intensity > 0.3) {
        // Saturated flame orange
        mat.color.setHex(0xff5500);
      } else {
        // Deep fiery crimson at decay
        mat.color.setHex(0xdd1100);
      }

      // Subtle pilot light flickering
      const pilotMat = cannon.pilotMesh.material as THREE.MeshBasicMaterial;
      pilotMat.opacity = 0.5 + Math.sin(performance.now() * 0.015 + i * 2) * 0.3;
    }

    // Update dynamic stage pyro illumination
    if (anyFiring) {
      const lightPower = maxFlameIntensity * 4.5 * (features.isDrop ? 1.5 : 1.0);
      this.flameLight1.intensity = lightPower;
      this.flameLight2.intensity = lightPower;
    } else {
      this.flameLight1.intensity = this.lerp(this.flameLight1.intensity, 0, deltaSeconds * 14);
      this.flameLight2.intensity = this.lerp(this.flameLight2.intensity, 0, deltaSeconds * 14);
    }
  }
}
