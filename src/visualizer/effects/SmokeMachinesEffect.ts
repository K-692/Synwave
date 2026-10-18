/**
 * Synwave Concert Stage Smoke Machines & Cryo Jets Effect
 * 
 * 4 High-velocity Cryo CO2 jets mounted on stage wings and deck corners,
 * bursting dense white cryogenic fog plumes during drops, buildups, and snare sweeps,
 * accompanied by rolling atmospheric stage haze drifting along the concert floor.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface CryoJet {
  baseMesh: THREE.Mesh;
  plumeMesh: THREE.Mesh;
  position: THREE.Vector3;
  direction: THREE.Vector3;
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
  private hazeCount = 48;
  private dummy = new THREE.Object3D();

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Create 4 Cryo CO2 Cannons on Stage Front & Wings
    const jetConfigs = [
      { pos: new THREE.Vector3(-14.0, -0.2, 4.0), angleY: 0.25, angleZ: -0.18 },
      { pos: new THREE.Vector3(-5.0, -0.2, 4.8), angleY: 0.08, angleZ: -0.08 },
      { pos: new THREE.Vector3(5.0, -0.2, 4.8), angleY: -0.08, angleZ: 0.08 },
      { pos: new THREE.Vector3(14.0, -0.2, 4.0), angleY: -0.25, angleZ: 0.18 },
    ];

    // Jet Nozzle Geometry
    const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.6, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x1f2430,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.disposables.push(nozzleGeo, nozzleMat);

    // Cryo Plume Geometry (expanding high-velocity cone)
    const plumeGeo = new THREE.ConeGeometry(2.4, 14, 16, 4, true);
    plumeGeo.translate(0, 7, 0); // Anchor at base
    this.disposables.push(plumeGeo);

    for (const cfg of jetConfigs) {
      // Base
      const baseMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
      baseMesh.position.copy(cfg.pos);
      baseMesh.rotation.y = cfg.angleY;
      baseMesh.rotation.z = cfg.angleZ;
      this.group.add(baseMesh);

      // Cryo Jet Plume Mesh
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0xe6f4ff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(plumeMat);

      const plumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
      plumeMesh.position.copy(cfg.pos);
      plumeMesh.rotation.y = cfg.angleY;
      plumeMesh.rotation.z = cfg.angleZ;
      plumeMesh.scale.set(0.001, 0.001, 0.001);
      this.group.add(plumeMesh);

      this.cryoJets.push({
        baseMesh,
        plumeMesh,
        position: cfg.pos,
        direction: new THREE.Vector3(0, 1, 0),
        intensity: 0,
        height: 0,
        targetHeight: 0,
        cooldownTimer: 0,
      });
    }

    // 2. Rolling Stage Floor Haze (Instanced softly drifting fog puffs)
    const hazeGeo = new THREE.PlaneGeometry(6, 4);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0xa8c4e0,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.push(hazeGeo, hazeMat);

    this.floorHazeMesh = new THREE.InstancedMesh(hazeGeo, hazeMat, this.hazeCount);
    for (let i = 0; i < this.hazeCount; i++) {
      const x = (Math.random() - 0.5) * 32;
      const y = -0.6 + Math.random() * 1.8;
      const z = -10 + Math.random() * 18;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, Math.random() * Math.PI);
      const s = 1.0 + Math.random() * 1.5;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.floorHazeMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.floorHazeMesh);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;

    // Trigger cryo bursts on drops, snare rolls, or heavy energy buildups
    const isCryoTrigger =
      features.isDrop ||
      (features.onsetStrength > 0.82 && features.highMid > 0.65) ||
      (features.isKick && Math.random() < 0.25);

    for (let i = 0; i < this.cryoJets.length; i++) {
      const jet = this.cryoJets[i];
      jet.cooldownTimer -= deltaSeconds;

      if (isCryoTrigger && jet.cooldownTimer <= 0) {
        jet.targetHeight = features.isDrop ? 1.3 : 0.9;
        jet.intensity = 1.0;
        jet.cooldownTimer = features.isDrop ? 0.35 : 0.8;
      }

      // Smooth expansion & dissipation
      if (jet.intensity > 0.02) {
        jet.height = this.lerp(jet.height, jet.targetHeight, deltaSeconds * 22);
        jet.intensity = Math.max(0, jet.intensity - deltaSeconds * 2.2);
      } else {
        jet.height = this.lerp(jet.height, 0, deltaSeconds * 8);
        jet.targetHeight = 0;
      }

      // Plume scaling
      const currentH = Math.max(0.001, jet.height);
      const spread = 0.5 + currentH * 0.8;
      jet.plumeMesh.scale.set(spread, currentH, spread);

      // Color/Opacity
      const mat = jet.plumeMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = jet.intensity * 0.75;
      // Slight palette tint
      mat.color.set(palette.secondary).lerp(new THREE.Color(0xffffff), 0.7);
    }

    // Drifting floor haze animation
    const hazeTime = performance.now() * 0.0004;
    const hazeMat = this.floorHazeMesh.material as THREE.MeshBasicMaterial;
    // Haze thickens during drops and high energy
    const targetHazeOpacity = 0.05 + features.rms * 0.08 + (features.isDrop ? 0.06 : 0);
    hazeMat.opacity = this.lerp(hazeMat.opacity, targetHazeOpacity, deltaSeconds * 3);
    hazeMat.color.set(palette.primary).lerp(new THREE.Color(0xa0c8f0), 0.6);

    for (let i = 0; i < this.hazeCount; i++) {
      this.floorHazeMesh.getMatrixAt(i, this.dummy.matrix);
      this.dummy.position.setFromMatrixPosition(this.dummy.matrix);
      // Gentle drift along X and Z
      this.dummy.position.x += Math.sin(hazeTime + i) * 0.02;
      this.dummy.position.z += Math.cos(hazeTime * 0.8 + i) * 0.015;
      if (this.dummy.position.x > 18) this.dummy.position.x = -18;
      if (this.dummy.position.x < -18) this.dummy.position.x = 18;
      this.dummy.updateMatrix();
      this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.floorHazeMesh.instanceMatrix.needsUpdate = true;
  }
}
