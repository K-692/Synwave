/**
 * Synwave Concert Stage Smoke Machines & Cryo Jets Effect
 * 
 * Optimized per user request:
 * - Default State: Stage is clean and crisp (zero haze obscuring the screen),
 *   matching the pristine stage look of the reference screenshot.
 * - Drop Resolution Aftermath: When extreme music like drops comes to an end,
 *   dense, realistic cryogenic smoke erupts and rolls across the stage and around
 *   the screen wings, catching stage lighting, then dissipating cleanly.
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

  // Drop Ending Detection & Aftermath Smoke State
  private wasInDrop = false;
  private aftermathActive = false;
  private aftermathTimer = 0.0;
  private readonly aftermathDuration = 5.2; // 5.2 seconds of billowing aftermath smoke

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. 6 Heavy Cryo Cannons flanking the stage deck and screen perimeter
    const jetConfigs = [
      { pos: new THREE.Vector3(-12.5, -0.2, 3.5), angleZ: -0.15 },
      { pos: new THREE.Vector3(-6.5, -0.2, 4.0), angleZ: -0.06 },
      { pos: new THREE.Vector3(-2.2, -0.2, 4.2), angleZ: 0.0 },
      { pos: new THREE.Vector3(2.2, -0.2, 4.2), angleZ: 0.0 },
      { pos: new THREE.Vector3(6.5, -0.2, 4.0), angleZ: 0.06 },
      { pos: new THREE.Vector3(12.5, -0.2, 3.5), angleZ: 0.15 },
    ];

    const nozzleGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.65, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x181c26,
      metalness: 0.85,
      roughness: 0.3,
    });
    this.disposables.push(nozzleGeo, nozzleMat);

    // Billowing cone geometry
    const plumeGeo = new THREE.ConeGeometry(3.2, 16, 16, 4, true);
    plumeGeo.translate(0, 8.0, 0); // Anchor at base
    this.disposables.push(plumeGeo);

    const innerCoreGeo = new THREE.ConeGeometry(1.6, 14, 12, 3, true);
    innerCoreGeo.translate(0, 7.0, 0);
    this.disposables.push(innerCoreGeo);

    for (const cfg of jetConfigs) {
      const baseMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
      baseMesh.position.copy(cfg.pos);
      baseMesh.rotation.z = cfg.angleZ;
      this.group.add(baseMesh);

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
      });
    }

    // 2. Realistic Rolling Stage Floor Fog Particles
    // Default opacity is 0.0; only billows during drop resolution aftermath!
    const hazeGeo = new THREE.PlaneGeometry(9.0, 6.0);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0xd6e8ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.push(hazeGeo, hazeMat);

    this.floorHazeMesh = new THREE.InstancedMesh(hazeGeo, hazeMat, this.hazeCount);
    for (let i = 0; i < this.hazeCount; i++) {
      const x = (Math.random() - 0.5) * 36;
      const y = -0.4 + Math.random() * 2.2;
      const z = -4.0 + Math.random() * 16;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.35, 0, Math.random() * Math.PI);
      const s = 1.0 + Math.random() * 1.6;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.floorHazeMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.floorHazeMesh);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // Detect extreme music section (drop)
    const isCurrentlyDrop = features.isDrop || (features.rms > 0.62 && features.subBass > 0.60);

    // Detect when extreme music like drops comes to an end:
    if (this.wasInDrop && !isCurrentlyDrop) {
      this.aftermathActive = true;
      this.aftermathTimer = this.aftermathDuration;
    }
    this.wasInDrop = isCurrentlyDrop;

    // If aftermath is active, countdown and calculate smoke curve
    let smokePower = 0.0;
    if (this.aftermathActive) {
      this.aftermathTimer -= deltaSeconds;

      if (this.aftermathTimer <= 0) {
        this.aftermathActive = false;
        this.aftermathTimer = 0;
        smokePower = 0;
      } else {
        const progress = 1.0 - (this.aftermathTimer / this.aftermathDuration); // 0.0 -> 1.0
        if (progress < 0.25) {
          // Rapid initial blast: 0 -> 1 in ~1.3s
          smokePower = progress / 0.25;
        } else {
          // Gentle dissipation: 1 -> 0 over remainder
          smokePower = Math.pow(1.0 - ((progress - 0.25) / 0.75), 1.5);
        }
      }
    }

    // 1. Cryo Plumes (Erupt during initial aftermath blast)
    for (let i = 0; i < this.cryoJets.length; i++) {
      const jet = this.cryoJets[i];

      if (this.aftermathActive && this.aftermathTimer > (this.aftermathDuration - 2.0)) {
        jet.targetHeight = 1.25;
        jet.intensity = Math.min(1.0, smokePower * 1.3);
      } else {
        jet.targetHeight = 0;
        jet.intensity = Math.max(0, jet.intensity - deltaSeconds * 2.0);
      }

      jet.height = this.lerp(jet.height, jet.targetHeight, deltaSeconds * (jet.targetHeight > 0 ? 12 : 6));

      const currentH = Math.max(0.001, jet.height);
      const billow = 1.0 + Math.sin(time * 14.0 + i * 1.2) * 0.10;
      const spread = (0.55 + currentH * 0.85) * billow;

      jet.plumeMesh.scale.set(spread, currentH, spread);
      jet.innerCoreMesh.scale.set(spread * 0.55, currentH * 0.82, spread * 0.55);

      const plumeMat = jet.plumeMesh.material as THREE.MeshBasicMaterial;
      plumeMat.opacity = jet.intensity * 0.36;
      plumeMat.color.set(palette.secondary || palette.primary).lerp(new THREE.Color(0xffffff), 0.75);

      const coreMat = jet.innerCoreMesh.material as THREE.MeshBasicMaterial;
      coreMat.opacity = jet.intensity * 0.42;
      coreMat.color.setHex(0xffffff);
    }

    // 2. Realistic Rolling Stage Floor Fog
    // Completely clear (0 opacity) during normal playback; billows around stage during drop aftermath!
    const hazeMat = this.floorHazeMesh.material as THREE.MeshBasicMaterial;
    const targetHazeOpacity = smokePower * 0.26;
    hazeMat.opacity = this.lerp(hazeMat.opacity, targetHazeOpacity, deltaSeconds * 3.5);

    if (hazeMat.opacity > 0.005) {
      hazeMat.color.set(palette.primary).lerp(new THREE.Color(0xdceaff), 0.60);

      const hazeSpeed = time * 0.05;
      for (let i = 0; i < this.hazeCount; i++) {
        this.floorHazeMesh.getMatrixAt(i, this.dummy.matrix);
        this.dummy.position.setFromMatrixPosition(this.dummy.matrix);

        // Slow realistic rolling drift across stage floor and around wings
        this.dummy.position.x += Math.sin(hazeSpeed + i * 0.7) * 0.035;
        this.dummy.position.z += Math.cos(hazeSpeed * 0.8 + i * 0.5) * 0.025;

        if (this.dummy.position.x > 18) this.dummy.position.x = -18;
        if (this.dummy.position.x < -18) this.dummy.position.x = 18;
        if (this.dummy.position.z > 12) this.dummy.position.z = -4;
        if (this.dummy.position.z < -4) this.dummy.position.z = 12;

        this.dummy.updateMatrix();
        this.floorHazeMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.floorHazeMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
