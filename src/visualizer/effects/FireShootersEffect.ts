/**
 * Synwave Concert Pyro Fire Shooters Effect
 * 
 * 8 Heavy-duty stage flamethrowers positioned flanking the stage screen and along the deck lip
 * matching the user's reference photo.
 * Erupts with massive vertical flame plumes and dynamic warm light flashes
 * triggered specifically by the KICK STEM, heavy drum transients, and festival drops.
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

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 8 Flame Cannons: Flanking both sides of the screen (matching photo) and along the stage lip
    const cannonPositions = [
      // Left Flank of screen (in photo)
      new THREE.Vector3(-11.5, 0.4, -3.2),
      new THREE.Vector3(-8.8, 0.1, -2.5),
      // Left Front Lip
      new THREE.Vector3(-5.5, -0.4, 4.2),
      new THREE.Vector3(-2.0, -0.4, 4.4),
      // Right Front Lip
      new THREE.Vector3(2.0, -0.4, 4.4),
      new THREE.Vector3(5.5, -0.4, 4.2),
      // Right Flank of screen (in photo)
      new THREE.Vector3(8.8, 0.1, -2.5),
      new THREE.Vector3(11.5, 0.4, -3.2),
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
    const flameGeo = new THREE.CylinderGeometry(0.2, 1.4, 11, 16, 8, true);
    flameGeo.translate(0, 5.5, 0); // Anchor pivot at base of flame
    this.disposables.push(flameGeo);

    // Pilot flame geometry (resting spark)
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

      // Flame Plume Mesh with vibrant fiery additive material
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff5500,
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
    this.flameLight1 = new THREE.PointLight(0xff5500, 0, 45, 1.8);
    this.flameLight1.position.set(-8, 3.5, 0);
    this.group.add(this.flameLight1);

    this.flameLight2 = new THREE.PointLight(0xffaa00, 0, 45, 1.8);
    this.flameLight2.position.set(8, 3.5, 0);
    this.group.add(this.flameLight2);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds } = context;

    // STEM TRIGGER: KICK STEM directly triggers the flamethrowers!
    const kickStem = features.stems.kick;
    const shouldErupt =
      (features.isKick && kickStem > 0.38) ||
      kickStem > 0.62 ||
      (features.isDrop && Math.random() < 0.55);

    let anyFiring = false;
    let maxFlameIntensity = 0;

    for (let i = 0; i < this.cannons.length; i++) {
      const cannon = this.cannons[i];
      cannon.cooldownTimer -= deltaSeconds;

      if (shouldErupt && cannon.cooldownTimer <= 0) {
        // Screen flanking cannons (0, 1, 6, 7) fire heavily on drops and kicks (matching photo)
        const isScreenFlank = i === 0 || i === 1 || i === 6 || i === 7;
        const triggerProbability = features.isDrop ? 1.0 : isScreenFlank ? 0.9 : 0.65;

        if (Math.random() < triggerProbability) {
          const power = features.isDrop ? 1.5 : Math.max(0.8, kickStem * 1.35);
          cannon.targetHeight = power * (0.9 + Math.random() * 0.4);
          cannon.intensity = 1.0;
          cannon.cooldownTimer = features.isDrop ? 0.12 : 0.22;
        }
      }

      // Smooth height interpolation
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
      const flickerW = 1.0 + Math.sin(performance.now() * 0.025 + i * 1.5) * 0.18;
      cannon.flameMesh.scale.set(flickerW, currentH, flickerW);

      // Color and opacity
      const mat = cannon.flameMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = cannon.intensity * 0.92;
      if (cannon.intensity > 0.6) {
        mat.color.setHex(0xffdd66); // Radiant white-yellow core
      } else if (cannon.intensity > 0.3) {
        mat.color.setHex(0xff5500); // Fiery orange
      } else {
        mat.color.setHex(0xdd1100); // Deep crimson decay
      }

      // Pilot light spark
      const pilotMat = cannon.pilotMesh.material as THREE.MeshBasicMaterial;
      pilotMat.opacity = 0.5 + Math.sin(performance.now() * 0.015 + i * 2) * 0.3;
    }

    // Update dynamic stage pyro illumination
    if (anyFiring) {
      const lightPower = maxFlameIntensity * 5.0 * (features.isDrop ? 1.5 : 1.0);
      this.flameLight1.intensity = lightPower;
      this.flameLight2.intensity = lightPower;
    } else {
      this.flameLight1.intensity = this.lerp(this.flameLight1.intensity, 0, deltaSeconds * 14);
      this.flameLight2.intensity = this.lerp(this.flameLight2.intensity, 0, deltaSeconds * 14);
    }
  }
}
