/**
 * Synwave Concert Weighted Bold Lasers Effect
 * 
 * 28 Heavy-duty concert laser fixtures matching live stadium shows:
 * - Weighted, bold, luminous 3D volumetric laser beams thrown directly towards the camera
 * - Volumetric dual-core construction (radiant white/cyan core + rich atmospheric beam sheath)
 * - Directly activated and modulated by the INSTRUMENT STEM (synths, leads, guitars, drop riffs)
 * - Sweeping liquid-sky fans, scissor crosses, and stadium crowd pierce choreographies
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

    // 1. Dual-Core Volumetric Beam Geometries (unit length along Z)
    // Inner high-intensity laser core
    const coreGeo = new THREE.CylinderGeometry(0.04, 0.09, 1.0, 8, 1, true);
    coreGeo.rotateX(Math.PI / 2); // Align length along Z
    this.disposables.push(coreGeo);

    // Outer bold volumetric beam sheath
    const sheathGeo = new THREE.CylinderGeometry(0.12, 0.28, 1.0, 10, 1, true);
    sheathGeo.rotateX(Math.PI / 2); // Align length along Z
    this.disposables.push(sheathGeo);

    const origins: THREE.Vector3[] = [];
    const baseTargets: THREE.Vector3[] = [];

    // Stage Left Wing Lasers (8 projectors mounted on left vertical truss)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      origins.push(new THREE.Vector3(-12.8, y, -4.0));
      baseTargets.push(new THREE.Vector3(3.0 + i * 1.6, 0.8 + i * 0.3, 22.0));
    }

    // Stage Right Wing Lasers (8 projectors mounted on right vertical truss)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      origins.push(new THREE.Vector3(12.8, y, -4.0));
      baseTargets.push(new THREE.Vector3(-3.0 - i * 1.6, 0.8 + i * 0.3, 22.0));
    }

    // Overhead Truss Lasers (8 projectors spanning above the screen)
    for (let i = 0; i < 8; i++) {
      const x = -10.5 + i * 3.0;
      origins.push(new THREE.Vector3(x, 11.5, -4.2));
      baseTargets.push(new THREE.Vector3(x * 1.8, 0.2, 22.0));
    }

    // Stage Deck Lip Lasers (4 projectors fanning up and forward)
    for (let i = 0; i < 4; i++) {
      const x = -7.5 + i * 5.0;
      origins.push(new THREE.Vector3(x, -0.2, 3.8));
      baseTargets.push(new THREE.Vector3(x * 2.2, 7.5, 22.0));
    }

    const laserCount = origins.length;

    for (let i = 0; i < laserCount; i++) {
      const origin = origins[i];
      const target = baseTargets[i];

      const meshGroup = new THREE.Group();

      // Core Material (Brilliant bright neon)
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coreMat);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      meshGroup.add(coreMesh);

      // Sheath Material (Bold weighted atmospheric glow)
      const sheathMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
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

    // Laser colors: Electric Cyan, Neon Magenta, White, or Palette Primary
    const primaryCol = new THREE.Color(palette.primary);
    const cyanLaser = new THREE.Color(0x00f0ff);
    const whiteLaser = new THREE.Color(0xffffff);

    // Dynamic laser brightness and thickness from Instrument STEM
    const baseLaserBrightness = 0.35 + instStem * 0.65 + (features.isDrop ? 0.35 : 0);
    const beamThickness = 1.0 + instStem * 0.8 + (features.isDrop ? 0.5 : 0);

    for (let i = 0; i < this.lasers.length; i++) {
      const laser = this.lasers[i];
      const target = laser.target;

      let endX = target.x;
      let endY = target.y;
      const endZ = 22.0; // Thrown forward past camera into crowd

      if (this.currentPattern === 0) {
        // Pattern 0: Crowd Pierce (Horizontal laser needles slicing towards camera)
        const sweep = Math.sin(time * 2.8 + i * 0.45) * 8.0 * (1 + instStem);
        endX = target.x + sweep;
        endY = target.y + Math.cos(time * 2.2 + i) * 1.8;
      } else if (this.currentPattern === 1) {
        // Pattern 1: Scissor Matrix (Beams crossing diagonally over camera)
        const cross = Math.sin(time * 3.5 + (i % 2 === 0 ? 0 : Math.PI)) * 9.5;
        endX = (i % 2 === 0 ? 1 : -1) * cross;
        endY = target.y + Math.sin(time * 2.0 + i * 0.3) * 2.5;
      } else if (this.currentPattern === 2) {
        // Pattern 2: Stadium Liquid Sky Fan (Flat plane of bold lasers slicing overhead)
        endX = target.x + Math.sin(time * 2.0 + i * 0.2) * 4.0;
        endY = 2.4 + Math.sin(time * 4.0) * 0.4;
      } else {
        // Pattern 3: Drop Frenzy (Strobe chaos fanning wildly into the camera)
        const franticX = Math.sin(time * 7.5 + i * 1.3) * 12.0;
        const franticY = Math.cos(time * 6.5 + i * 1.1) * 4.5 + 2.0;
        endX = franticX;
        endY = franticY;
      }

      // Smooth target interpolation
      const targetVec = new THREE.Vector3(endX, endY, endZ);
      const lerpSpeed = deltaSeconds * (6.0 + instStem * 10.0);
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
      const isDropActive = features.isDrop || kickStem > 0.6;
      let activeCol = cyanLaser;
      if (isDropActive && i % 3 === 0) {
        activeCol = whiteLaser;
      } else if (i % 2 === 0) {
        activeCol = primaryCol;
      }

      // Material updates
      const coreMat = laser.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteLaser).lerp(activeCol, 0.35);
      coreMat.opacity = Math.min(1.0, baseLaserBrightness * 1.2);

      const sheathMat = laser.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(activeCol);
      sheathMat.opacity = Math.min(0.85, baseLaserBrightness * 0.75);
    }
  }
}
