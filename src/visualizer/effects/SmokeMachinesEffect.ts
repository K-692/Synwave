/**
 * Synwave Concert Stage Smoke Machines & Cryo Jets Effect
 * 
 * Volumetric concert stage smoke and cryo atmospherics:
 * - 6 High-velocity Cryo CO2 cannons blasting dense, towering cryogenic fog plumes
 * - Rich rolling stage floor fog and atmospheric smoke clouds drifting through the light beams
 * - Illuminated by the active concert lights and glowing in stage colors
 * - Activated on drops, snare rolls, vocal peaks, and energetic musical sections
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface CryoJet {
  baseMesh: THREE.Mesh;
  plumeMesh: THREE.Mesh;
  innerCoreMesh: THREE.Mesh;
  position: THREE.Vector3;
  angleZ: number;
  intensity: number;
  height: number;
  targetHeight: number;
  cooldownTimer: number;
}

export class SmokeMachinesEffect extends BaseEffect {
  readonly id = 'smoke-machines';
  readonly name = 'Concert Cryo Jets & Stage Smoke';
  readonly family = 'Atmospherics';
  readonly cost = 'medium';

  private cryoJets: CryoJet[] = [];
  private floorHazeMesh!: THREE.InstancedMesh;
  private hazeCount = 56;
  private dummy = new THREE.Object3D();

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. 6 Heavy Cryo CO2 Cannons on Stage Wings and Deck
    const jetConfigs = [
      { pos: new THREE.Vector3(-13.5, -0.2, 3.8), angleZ: -0.16 },
      { pos: new THREE.Vector3(-7.0, -0.2, 4.2), angleZ: -0.08 },
      { pos: new THREE.Vector3(-2.2, -0.2, 4.4), angleZ: 0.0 },
      { pos: new THREE.Vector3(2.2, -0.2, 4.4), angleZ: 0.0 },
      { pos: new THREE.Vector3(7.0, -0.2, 4.2), angleZ: 0.08 },
      { pos: new THREE.Vector3(13.5, -0.2, 3.8), angleZ: 0.16 },
    ];

    // Jet Nozzle Geometry
    const nozzleGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.65, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x1f2430,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.disposables.push(nozzleGeo, nozzleMat);

    // Cryo Outer Plume Geometry (expanding high-velocity cone)
    const plumeGeo = new THREE.ConeGeometry(3.0, 15, 16, 4, true);
    plumeGeo.translate(0, 7.5, 0); // Anchor at base
    this.disposables.push(plumeGeo);

    // Cryo Inner Dense Core Geometry
    const innerCoreGeo = new THREE.ConeGeometry(1.5, 13, 12, 3, true);
    innerCoreGeo.translate(0, 6.5, 0);
    this.disposables.push(innerCoreGeo);

    for (const cfg of jetConfigs) {
      // Base
      const baseMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
      baseMesh.position.copy(cfg.pos);
      baseMesh.rotation.z = cfg.angleZ;
      this.group.add(baseMesh);

      // Outer Cryo Plume Mesh (Dense white/ice-blue fog)
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0xebf5ff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(plumeMat);

      const plumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
      plumeMesh.position.copy(cfg.pos);
      plumeMesh.rotation.z = cfg.angleZ;
      plumeMesh.scale.set(0.001, 0.001, 0.001);
      this.group.add(plumeMesh);

      // Inner Core Mesh (Pure dense white steam)
      const innerCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(innerCoreMat);

      const innerCoreMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
      innerCoreMesh.position.copy(cfg.pos);
      innerCoreMesh.rotation.z = cfg.angleZ;
      innerCoreMesh.scale.set(0.001, 0.001, 0.001);
      this.group.add(innerCoreMesh);

      this.cryoJets.push({
        baseMesh,
        plumeMesh,
        innerCoreMesh,
        position: cfg.pos,
        angleZ: cfg.angleZ,
        intensity: 0,
        height: 0,
        targetHeight: 0,
        cooldownTimer: 0,
      });
    }

    // 2. Rolling Stage Floor Fog & Atmospheric Clouds
    // 56 instanced volumetric clouds billowed across the stage
    const hazeGeo = new THREE.PlaneGeometry(8.5, 5.5);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0xc8ddf5,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.push(hazeGeo, hazeMat);

    this.floorHazeMesh = new THREE.InstancedMesh(hazeGeo, hazeMat, this.hazeCount);
    for (let i = 0; i < this.hazeCount; i++) {
      const x = (Math.random() - 0.5) * 34;
      const y = -0.3 + Math.random() * 2.8;
      const z = -6.0 + Math.random() * 16;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, 0, Math.random() * Math.PI);
      const s = 1.0 + Math.random() * 1.8;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.floorHazeMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.floorHazeMesh);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;
    const time = performance.now() * 0.001;

    // Check if smoke / atmospherics are allowed
    const isSmokeEnabled =
      (routingConfig?.enabledEffects?.smoke ?? true) &&
      (directorState?.allowedEffects?.smoke ?? true);

    if (!isSmokeEnabled) {
      for (const jet of this.cryoJets) {
        jet.height = 0;
        jet.targetHeight = 0;
        jet.intensity = 0;
        (jet.plumeMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (jet.innerCoreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      (this.floorHazeMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }

    // Trigger cryo fog blasts on drops, energetic kick rolls, and vocal peaks
    const isCryoTrigger =
      features.isDrop ||
      (directorState?.currentSection === 'buildup' && features.beatPhase > 0.85 && Math.random() < 0.4) ||
      (features.stems.vocals > 0.55 && features.stems.kick > 0.3) ||
      (features.stems.kick > 0.55 && Math.random() < 0.6) ||
      (features.subBass + features.rms) > 0.75;

    for (let i = 0; i < this.cryoJets.length; i++) {
      const jet = this.cryoJets[i];
      jet.cooldownTimer -= deltaSeconds;

      if (isCryoTrigger && jet.cooldownTimer <= 0) {
        jet.targetHeight = features.isDrop ? 1.4 : 0.95;
        jet.intensity = 1.0;
        jet.cooldownTimer = features.isDrop ? 0.25 : 0.6;
      }

      // Smooth expansion & billow
      if (jet.intensity > 0.02) {
        jet.height = this.lerp(jet.height, jet.targetHeight, deltaSeconds * 20);
        const decay = features.isDrop ? 1.4 : 2.5;
        jet.intensity = Math.max(0, jet.intensity - deltaSeconds * decay);
      } else {
        jet.height = this.lerp(jet.height, 0, deltaSeconds * 9);
        jet.targetHeight = 0;
      }

      // Scale plumes
      const currentH = Math.max(0.001, jet.height);
      const billow = 1.0 + Math.sin(time * 18.0 + i * 1.5) * 0.12;
      const spread = (0.6 + currentH * 0.9) * billow;

      jet.plumeMesh.scale.set(spread, currentH, spread);
      jet.innerCoreMesh.scale.set(spread * 0.6, currentH * 0.85, spread * 0.6);

      // Colors & Opacity (Controlled, translucent, non-overexposing)
      const plumeMat = jet.plumeMesh.material as THREE.MeshBasicMaterial;
      plumeMat.opacity = jet.intensity * 0.38;
      plumeMat.color.set(palette.secondary).lerp(new THREE.Color(0xffffff), 0.75);

      const coreMat = jet.innerCoreMesh.material as THREE.MeshBasicMaterial;
      coreMat.opacity = jet.intensity * 0.45;
      coreMat.color.setHex(0xffffff);
    }

    // Drifting floor haze animation:
    // Rolling smoke catching stage illumination
    const hazeTime = performance.now() * 0.0005;
    const hazeMat = this.floorHazeMesh.material as THREE.MeshBasicMaterial;

    // Translucent soft floor haze
    const targetHazeOpacity = 0.07 + features.rms * 0.05 + (features.isDrop ? 0.04 : 0);
    hazeMat.opacity = this.lerp(hazeMat.opacity, targetHazeOpacity, deltaSeconds * 4);
    // Haze softly tinted by primary stage light color
    hazeMat.color.set(palette.primary).lerp(new THREE.Color(0xd0e4ff), 0.55);

    for (let i = 0; i < this.hazeCount; i++) {
      this.floorHazeMesh.getMatrixAt(i, this.dummy.matrix);
      this.dummy.position.setFromMatrixPosition(this.dummy.matrix);
      // Continuous gentle drift across the stage
      this.dummy.position.x += Math.sin(hazeTime + i * 0.6) * 0.025;
      this.dummy.position.z += Math.cos(hazeTime * 0.8 + i * 0.4) * 0.02;

      if (this.dummy.position.x > 18) this.dummy.position.x = -18;
      if (this.dummy.position.x < -18) this.dummy.position.x = 18;
      if (this.dummy.position.z > 10) this.dummy.position.z = -6;
      if (this.dummy.position.z < -6) this.dummy.position.z = 10;

      this.dummy.updateMatrix();
      this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.floorHazeMesh.instanceMatrix.needsUpdate = true;
  }
}
