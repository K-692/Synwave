/**
 * Synwave Concert Weighted Bold Lasers Effect
 * 
 * 28 Heavy-duty concert laser fixtures matching live stadium shows:
 * - Weighted, bold, luminous 3D volumetric laser beams thrown towards the audience space
 * - Volumetric dual-core construction (bright neon core + atmospheric beam sheath) with FrontSide rendering
 * - Directly activated and modulated by the INSTRUMENT STEM (synths, leads, guitars, drop riffs)
 * - Controlled opacity so lasers look razor-sharp and luminous without washing out the stage screen
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface LaserFixture {
  meshGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  sheathMesh: THREE.Mesh;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  currentTarget: THREE.Vector3;
  index: number;
}

export class ThinLasersEffect extends BaseEffect {
  readonly id = 'thin-lasers';
  readonly name = 'Concert Heavyweight Lasers';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private lasers: LaserFixture[] = [];
  private currentPattern = 0;
  private patternTimer = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Sleek, Bold Volumetric Beam Geometries (unit length along Z)
    // Inner high-intensity laser core
    const coreGeo = new THREE.CylinderGeometry(0.02, 0.045, 1.0, 8, 1, true);
    coreGeo.rotateX(Math.PI / 2); // Align length along Z
    this.disposables.push(coreGeo);

    // Outer atmospheric beam sheath
    const sheathGeo = new THREE.CylinderGeometry(0.05, 0.12, 1.0, 8, 1, true);
    sheathGeo.rotateX(Math.PI / 2); // Align length along Z
    this.disposables.push(sheathGeo);

    const origins: THREE.Vector3[] = [];
    const baseTargets: THREE.Vector3[] = [];

    // Stage Left Wing Lasers (8 projectors mounted on left vertical truss)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      origins.push(new THREE.Vector3(-12.8, y, -4.0));
      baseTargets.push(new THREE.Vector3(2.0 + i * 1.8, 0.5 + i * 0.4, 24.0));
    }

    // Stage Right Wing Lasers (8 projectors mounted on right vertical truss)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      origins.push(new THREE.Vector3(12.8, y, -4.0));
      baseTargets.push(new THREE.Vector3(-2.0 - i * 1.8, 0.5 + i * 0.4, 24.0));
    }

    // Overhead Truss Lasers (8 projectors spanning above the screen)
    for (let i = 0; i < 8; i++) {
      const x = -10.5 + i * 3.0;
      origins.push(new THREE.Vector3(x, 11.5, -4.2));
      baseTargets.push(new THREE.Vector3(x * 1.6, -0.2, 24.0));
    }

    // Stage Deck Lip Lasers (4 projectors fanning up and forward)
    for (let i = 0; i < 4; i++) {
      const x = -7.5 + i * 5.0;
      origins.push(new THREE.Vector3(x, -0.2, 3.8));
      baseTargets.push(new THREE.Vector3(x * 2.0, 6.5, 24.0));
    }

    const laserCount = origins.length;

    for (let i = 0; i < laserCount; i++) {
      const origin = origins[i];
      const target = baseTargets[i];

      const meshGroup = new THREE.Group();

      // Core Material (FrontSide prevents double-additive opacity buildup)
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(coreMat);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      meshGroup.add(coreMesh);

      // Sheath Material (Controlled atmospheric translucency)
      const sheathMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(sheathMat);
      const sheathMesh = new THREE.Mesh(sheathGeo, sheathMat);
      meshGroup.add(sheathMesh);

      this.group.add(meshGroup);

      this.lasers.push({
        meshGroup,
        coreMesh,
        sheathMesh,
        origin,
        target,
        currentTarget: target.clone(),
        index: i,
      });
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // STEM TRIGGER: Instrument STEM directly controls laser brightness and bold thickness!
    const instStem = features.stems.instruments;
    const kickStem = features.stems.kick;

    // Pattern rotation
    this.patternTimer += deltaSeconds;
    if (features.isDrop) {
      this.currentPattern = 3; // Drop frenzy
    } else if (this.patternTimer > 8) {
      this.currentPattern = (this.currentPattern + 1) % 3;
      this.patternTimer = 0;
    }

    // Laser colors
    const primaryCol = new THREE.Color(palette.primary);
    const cyanLaser = new THREE.Color(0x00f0ff);
    const whiteLaser = new THREE.Color(0xffffff);

    // Controlled brightness and thickness from Instrument STEM
    const baseLaserBrightness = 0.25 + instStem * 0.35 + (features.isDrop ? 0.15 : 0);
    const beamThickness = 1.0 + instStem * 0.45;

    for (let i = 0; i < this.lasers.length; i++) {
      const laser = this.lasers[i];
      const target = laser.target;

      let endX = target.x;
      let endY = target.y;
      const endZ = 24.0; // Projecting forward past audience

      if (this.currentPattern === 0) {
        // Pattern 0: Crowd Pierce
        const sweep = Math.sin(time * 2.5 + i * 0.4) * 7.5 * (1 + instStem * 0.5);
        endX = target.x + sweep;
        endY = target.y + Math.cos(time * 2.0 + i) * 1.4;
      } else if (this.currentPattern === 1) {
        // Pattern 1: Scissor Matrix
        const cross = Math.sin(time * 3.0 + (i % 2 === 0 ? 0 : Math.PI)) * 8.5;
        endX = (i % 2 === 0 ? 1 : -1) * cross;
        endY = target.y + Math.sin(time * 1.8 + i * 0.3) * 2.0;
      } else if (this.currentPattern === 2) {
        // Pattern 2: Stadium Liquid Sky Fan
        endX = target.x + Math.sin(time * 1.8 + i * 0.2) * 3.5;
        endY = 3.0 + Math.sin(time * 3.5) * 0.4;
      } else {
        // Pattern 3: Drop Frenzy
        const franticX = Math.sin(time * 6.5 + i * 1.2) * 10.5;
        const franticY = Math.cos(time * 5.5 + i * 1.0) * 3.8 + 2.0;
        endX = franticX;
        endY = franticY;
      }

      // Smooth target interpolation
      const targetVec = new THREE.Vector3(endX, endY, endZ);
      const lerpSpeed = deltaSeconds * (5.0 + instStem * 8.0);
      laser.currentTarget.lerp(targetVec, lerpSpeed);

      // Position mesh at midpoint between origin and target
      const origin = laser.origin;
      const currTgt = laser.currentTarget;
      const dist = origin.distanceTo(currTgt);
      const midpoint = new THREE.Vector3().addVectors(origin, currTgt).multiplyScalar(0.5);

      laser.meshGroup.position.copy(midpoint);
      laser.meshGroup.lookAt(currTgt);
      laser.meshGroup.scale.set(beamThickness, beamThickness, dist);

      // Color selection
      const isDropActive = features.isDrop || kickStem > 0.65;
      let activeCol = cyanLaser;
      if (isDropActive && i % 3 === 0) {
        activeCol = whiteLaser;
      } else if (i % 2 === 0) {
        activeCol = primaryCol;
      }

      // Material updates: Translucent, controlled, vibrant
      const coreMat = laser.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteLaser).lerp(activeCol, 0.4);
      coreMat.opacity = Math.min(0.70, baseLaserBrightness * 1.6);

      const sheathMat = laser.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(activeCol);
      sheathMat.opacity = Math.min(0.22, baseLaserBrightness * 0.45);
    }
  }
}
