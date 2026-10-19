/**
 * Synwave Concert Pyro Fire Shooters Effect
 * 
 * 8 Heavy-duty stadium flamethrowers positioned flanking the stage screen and along the deck lip:
 * - Erupts with massive, towering, roaring vertical and angled fire plumes at the drop of an energetic song
 * - Features billowing multi-tiered flame geometry (brilliant white-yellow core + roaring orange flame tongues)
 * - Directly activated by festival drops, energetic song climaxes, and the KICK STEM
 * - Dynamic stage firelight casting flickering orange/yellow illumination across the venue
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface FlameCannon {
  baseMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  outerFlameMesh: THREE.Mesh;
  pilotMesh: THREE.Mesh;
  fireLight: THREE.PointLight;
  position: THREE.Vector3;
  angleZ: number;
  height: number;
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

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 8 Flame Cannons: Positioned directly in front of the stage screen bottom rim
    const cannonConfigs = [
      { pos: new THREE.Vector3(-7.2, -1.35, -3.85), rotZ: 0.08 },
      { pos: new THREE.Vector3(-5.1, -1.35, -3.85), rotZ: 0.05 },
      { pos: new THREE.Vector3(-3.1, -1.35, -3.85), rotZ: 0.03 },
      { pos: new THREE.Vector3(-1.0, -1.35, -3.85), rotZ: 0.01 },
      { pos: new THREE.Vector3(1.0, -1.35, -3.85), rotZ: -0.01 },
      { pos: new THREE.Vector3(3.1, -1.35, -3.85), rotZ: -0.03 },
      { pos: new THREE.Vector3(5.1, -1.35, -3.85), rotZ: -0.05 },
      { pos: new THREE.Vector3(7.2, -1.35, -3.85), rotZ: -0.08 },
    ];

    // Shared Cannon Base Geometry (compact industrial nozzle)
    const baseGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.45, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x11141c,
      metalness: 0.9,
      roughness: 0.4,
    });
    this.disposables.push(baseGeo, baseMat);

    // Inner Radiant Flame Core (scaled to cover the middle of the screen)
    const coreGeo = new THREE.CylinderGeometry(0.16, 0.45, 5.2, 10, 4, true);
    coreGeo.translate(0, 2.6, 0); // Pivot at base
    this.disposables.push(coreGeo);

    // Outer Billowing Flame Plume (small flame throw covering lower-to-middle screen)
    const outerGeo = new THREE.ConeGeometry(0.95, 6.0, 12, 4, true);
    outerGeo.translate(0, 3.0, 0); // Pivot at base
    this.disposables.push(outerGeo);

    // Pilot flame geometry (resting spark)
    const pilotGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const pilotMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    });
    this.disposables.push(pilotGeo, pilotMat);

    for (let i = 0; i < cannonConfigs.length; i++) {
      const cfg = cannonConfigs[i];

      // Cannon nozzle
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.copy(cfg.pos);
      baseMesh.rotation.z = cfg.rotZ;
      this.group.add(baseMesh);

      // Pilot light
      const pilotMesh = new THREE.Mesh(pilotGeo, pilotMat);
      pilotMesh.position.set(cfg.pos.x, cfg.pos.y + 0.35, cfg.pos.z);
      this.group.add(pilotMesh);

      // Inner Core Mesh (Radiant white-yellow fire)
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffea77,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coreMat);

      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.copy(cfg.pos);
      coreMesh.rotation.z = cfg.rotZ;
      coreMesh.scale.set(0.001, 0.001, 0.001);
      this.group.add(coreMesh);

      // Outer Flame Plume Mesh (Searing orange/red fire tongue)
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(outerMat);

      const outerFlameMesh = new THREE.Mesh(outerGeo, outerMat);
      outerFlameMesh.position.copy(cfg.pos);
      outerFlameMesh.rotation.z = cfg.rotZ;
      outerFlameMesh.scale.set(0.001, 0.001, 0.001);
      this.group.add(outerFlameMesh);

      // Dynamic Pyro Stage Point Light
      const fireLight = new THREE.PointLight(0xff5500, 0, 30, 1.8);
      fireLight.position.set(cfg.pos.x, cfg.pos.y + 2.5, cfg.pos.z);
      this.group.add(fireLight);

      this.cannons.push({
        baseMesh,
        coreMesh,
        outerFlameMesh,
        pilotMesh,
        fireLight,
        position: cfg.pos,
        angleZ: cfg.rotZ,
        height: 0,
        targetHeight: 0,
        intensity: 0,
        cooldownTimer: 0,
      });
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, directorState, routingConfig } = context;
    const time = performance.now() * 0.001;

    // Check if pyrotechnics are allowed by routing settings and show director
    const isFlamesAllowed =
      !(routingConfig?.disablePyrotechnics) &&
      (routingConfig?.enabledEffects?.flames ?? true) &&
      (directorState?.allowedEffects?.flames ?? true);

    if (!isFlamesAllowed) {
      for (const cannon of this.cannons) {
        cannon.height = 0;
        cannon.targetHeight = 0;
        cannon.intensity = 0;
        cannon.fireLight.intensity = 0;
        cannon.coreMesh.scale.set(0.001, 0.001, 0.001);
        cannon.outerFlameMesh.scale.set(0.001, 0.001, 0.001);
        (cannon.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (cannon.outerFlameMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      return;
    }

    const pyroThreshold = routingConfig?.pyroThreshold ?? 0.45;
    const kickSens = routingConfig?.kickSensitivity ?? 1.0;
    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;

    // Energetic drop & kick detection:
    const isDropFiring = features.isDrop && directorState?.currentSection === 'drop';
    const isKickSpike = features.isKick && (features.stems.kick * kickSens) > pyroThreshold;

    for (let i = 0; i < this.cannons.length; i++) {
      const cannon = this.cannons[i];
      cannon.cooldownTimer -= deltaSeconds;

      // Trigger logic with cooldowns:
      if (cannon.cooldownTimer <= 0) {
        if (isDropFiring) {
          // Drop mode: rhythmic bursts synchronized on drum kicks or beat hits
          const beatSync = features.beatPhase < 0.22 && features.stems.kick > 0.35;
          if (beatSync || Math.random() < 0.25) {
            cannon.targetHeight = 0.95 + Math.random() * 0.4;
            cannon.intensity = 1.0;
            cannon.cooldownTimer = 0.22;
          }
        } else if (isKickSpike) {
          // Energetic song kick hits: Screen flank cannons and select front cannons burst
          const isScreenFlank = i === 0 || i === 1 || i === 6 || i === 7;
          if (isScreenFlank || Math.random() < 0.70) {
            cannon.targetHeight = 0.85 + Math.random() * 0.35;
            cannon.intensity = 1.0;
            cannon.cooldownTimer = 0.28;
          }
        }
      }

      // Smooth height interpolation
      if (cannon.intensity > 0.04) {
        cannon.height = this.lerp(cannon.height, cannon.targetHeight, deltaSeconds * 26);
        const decayRate = (isDropFiring ? 2.0 : 4.0) / (routingConfig?.effectDecay ?? 1.0);
        cannon.intensity = Math.max(0, cannon.intensity - deltaSeconds * decayRate);
      } else {
        cannon.height = this.lerp(cannon.height, 0, deltaSeconds * 14);
        cannon.targetHeight = 0;
      }

      // Scaling flame plumes
      const currentH = Math.max(0.001, cannon.height);
      const flicker = 1.0 + Math.sin(time * 30.0 + i * 2.1) * 0.16;

      cannon.coreMesh.scale.set(flicker * 0.9, currentH, flicker * 0.9);
      cannon.outerFlameMesh.scale.set(flicker * 1.3, currentH * 1.05, flicker * 1.3);

      // Colors and opacities
      const coreMat = cannon.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.opacity = cannon.intensity * 0.95 * maxBri;

      const outerMat = cannon.outerFlameMesh.material as THREE.MeshBasicMaterial;
      outerMat.opacity = cannon.intensity * 0.88 * maxBri;

      if (cannon.intensity > 0.55) {
        coreMat.color.setHex(0xffffff); // White-hot core
        outerMat.color.setHex(0xff6600); // Vibrant orange flame
      } else {
        coreMat.color.setHex(0xffbb22); // Yellow-gold
        outerMat.color.setHex(0xdd1100); // Crimson flame edge
      }

      // Dynamic point light illumination
      cannon.fireLight.intensity = cannon.intensity * 1.5 * maxBri;

      // Pilot spark
      const pilotMat = cannon.pilotMesh.material as THREE.MeshBasicMaterial;
      pilotMat.opacity = 0.4 + Math.sin(time * 15.0 + i) * 0.3;
    }
  }
}
