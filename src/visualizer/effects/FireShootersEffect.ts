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

    // 8 Flame Cannons: Flanking both sides of the screen (in reference photo) and along stage front
    const cannonConfigs = [
      // Left Flank of screen (angled outward like photo)
      { pos: new THREE.Vector3(-11.5, 0.4, -3.2), rotZ: 0.18 },
      { pos: new THREE.Vector3(-8.8, 0.1, -2.5), rotZ: 0.10 },
      // Left Front Deck
      { pos: new THREE.Vector3(-5.5, -0.4, 3.8), rotZ: 0.05 },
      { pos: new THREE.Vector3(-2.0, -0.4, 4.0), rotZ: 0.0 },
      // Right Front Deck
      { pos: new THREE.Vector3(2.0, -0.4, 4.0), rotZ: 0.0 },
      { pos: new THREE.Vector3(5.5, -0.4, 3.8), rotZ: -0.05 },
      // Right Flank of screen (angled outward like photo)
      { pos: new THREE.Vector3(8.8, 0.1, -2.5), rotZ: -0.10 },
      { pos: new THREE.Vector3(11.5, 0.4, -3.2), rotZ: -0.18 },
    ];

    // Shared Cannon Base Geometry
    const baseGeo = new THREE.CylinderGeometry(0.35, 0.48, 0.6, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x11141c,
      metalness: 0.9,
      roughness: 0.4,
    });
    this.disposables.push(baseGeo, baseMat);

    // Inner Radiant Flame Core (cylinder stretching upward from base)
    const coreGeo = new THREE.CylinderGeometry(0.25, 0.9, 13.0, 12, 6, true);
    coreGeo.translate(0, 6.5, 0); // Pivot at base
    this.disposables.push(coreGeo);

    // Outer Billowing Flame Plume (expanding tapered cone)
    const outerGeo = new THREE.ConeGeometry(2.4, 15.0, 16, 6, true);
    outerGeo.translate(0, 7.5, 0); // Pivot at base
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
    const { features, deltaSeconds } = context;
    const time = performance.now() * 0.001;

    // Energetic song detection:
    const isEnergeticMode =
      features.musicMode === 'festival' ||
      features.mood === 'euphoric-drop' ||
      features.mood === 'dark-aggressive' ||
      features.rms > 0.25 ||
      features.subBass > 0.38;

    // AT THE DROP OF AN ENERGETIC SONG:
    // Fire flames throw heavily and continuously/rhythmically!
    const isDropFiring = features.isDrop && (isEnergeticMode || features.rms > 0.22);
    const isKickSpike = features.isKick && features.stems.kick > 0.35;
    const isHeavySubBass = features.stems.kick > 0.65;

    for (let i = 0; i < this.cannons.length; i++) {
      const cannon = this.cannons[i];
      cannon.cooldownTimer -= deltaSeconds;

      // Trigger logic:
      if (cannon.cooldownTimer <= 0) {
        if (isDropFiring) {
          // Drop mode: Continuous rhythmic massive fire throwing!
          const beatSync = Math.sin(time * 12.0 + i * 0.8) > -0.2;
          if (beatSync) {
            cannon.targetHeight = 1.0 + Math.random() * 0.35;
            cannon.intensity = 1.0;
            cannon.cooldownTimer = 0.10;
          }
        } else if (isEnergeticMode && (isKickSpike || isHeavySubBass)) {
          // Energetic song kick hits: Massive fire erupts
          const isScreenFlank = i === 0 || i === 1 || i === 6 || i === 7;
          if (isScreenFlank || Math.random() < 0.75) {
            cannon.targetHeight = 0.85 + Math.random() * 0.4;
            cannon.intensity = 1.0;
            cannon.cooldownTimer = 0.18;
          }
        }
      }

      // Smooth height interpolation
      if (cannon.intensity > 0.04) {
        cannon.height = this.lerp(cannon.height, cannon.targetHeight, deltaSeconds * 26);
        // During drops, fire stays roaring; otherwise sharp decay
        const decayRate = isDropFiring ? 1.6 : 3.8;
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
      coreMat.opacity = cannon.intensity * 0.95;

      const outerMat = cannon.outerFlameMesh.material as THREE.MeshBasicMaterial;
      outerMat.opacity = cannon.intensity * 0.88;

      if (cannon.intensity > 0.55) {
        coreMat.color.setHex(0xffffff); // White-hot core
        outerMat.color.setHex(0xff6600); // Vibrant orange flame
      } else {
        coreMat.color.setHex(0xffbb22); // Yellow-gold
        outerMat.color.setHex(0xdd1100); // Crimson flame edge
      }

      // Dynamic point light illumination (subtle warm flicker, non-overexposing)
      cannon.fireLight.intensity = cannon.intensity * 1.5;

      // Pilot spark
      const pilotMat = cannon.pilotMesh.material as THREE.MeshBasicMaterial;
      pilotMat.opacity = 0.4 + Math.sin(time * 15.0 + i) * 0.3;
    }
  }
}
