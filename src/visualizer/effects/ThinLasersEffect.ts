/**
 * Synwave Concert Weighted Bold Lasers Effect
 * 
 * Includes:
 * 1. 28 Heavy-duty concert laser fixtures throwing bold beams across the stage.
 * 2. TWO SEPARATE TOP-OF-SCREEN LASER MACHINES:
 *    - Mounted on the top truss framing the screen (Top-Left & Top-Right)
 *    - Throw straight high-power laser beams directly towards the camera
 *    - Expanding volumetric laser fans that cover the entire window/viewport
 *    - Activated, pulsed, and manipulated directly on the BASS STEM and sub-bass!
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

interface TopBassLaserMachine {
  group: THREE.Group;
  chassisMesh: THREE.Mesh;
  lensMesh: THREE.Mesh;
  beamGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  sheathMesh: THREE.Mesh;
  fanMesh: THREE.Mesh;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  currentTarget: THREE.Vector3;
}

export class ThinLasersEffect extends BaseEffect {
  readonly id = 'thin-lasers';
  readonly name = 'Concert Heavyweight Lasers & Top Screen Bass Cannons';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private lasers: LaserFixture[] = [];
  private topBassMachines: TopBassLaserMachine[] = [];
  private currentPattern = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Sleek, Bold Volumetric Beam Geometries (unit length along Z)
    const coreGeo = new THREE.CylinderGeometry(0.02, 0.045, 1.0, 8, 1, true);
    coreGeo.rotateX(Math.PI / 2); // Align length along Z
    this.disposables.push(coreGeo);

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

    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];
      const target = baseTargets[i];

      const meshGroup = new THREE.Group();

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

    // -------------------------------------------------------------
    // 2. TWO SEPARATE TOP-OF-SCREEN LASER MACHINES (BASS ACTIVATED)
    // -------------------------------------------------------------
    // Top-Left and Top-Right machines throwing straight beams towards camera
    const chassisGeo = new THREE.BoxGeometry(0.85, 0.55, 0.70);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c14,
      metalness: 0.9,
      roughness: 0.25,
    });
    this.disposables.push(chassisGeo, chassisMat);

    const lensGeo = new THREE.SphereGeometry(0.18, 12, 12);
    this.disposables.push(lensGeo);

    // Expanding volumetric laser pyramid / cone geometry that covers the window
    const fanLength = 32.0;
    const fanGeo = new THREE.ConeGeometry(8.5, fanLength, 16, 2, true);
    fanGeo.translate(0, -fanLength / 2, 0);
    fanGeo.rotateX(-Math.PI / 2);
    this.disposables.push(fanGeo);

    const topConfigs = [
      {
        origin: new THREE.Vector3(-8.0, 11.2, -4.3),
        target: new THREE.Vector3(-1.0, 2.0, 22.0),
      },
      {
        origin: new THREE.Vector3(8.0, 11.2, -4.3),
        target: new THREE.Vector3(1.0, 2.0, 22.0),
      },
    ];

    for (let k = 0; k < topConfigs.length; k++) {
      const cfg = topConfigs[k];
      const mGroup = new THREE.Group();
      mGroup.position.copy(cfg.origin);

      // Heavy industrial projector chassis
      const chassis = new THREE.Mesh(chassisGeo, chassisMat);
      mGroup.add(chassis);

      // Glowing emitter lens
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
      });
      this.disposables.push(lensMat);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 0, 0.36);
      mGroup.add(lens);

      // Straight Laser Beam Assembly
      const beamGroup = new THREE.Group();

      // High-power straight core beam
      const bCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(bCoreMat);
      const bCore = new THREE.Mesh(coreGeo, bCoreMat);
      beamGroup.add(bCore);

      // Intense outer beam sheath
      const bSheathMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(bSheathMat);
      const bSheath = new THREE.Mesh(sheathGeo, bSheathMat);
      beamGroup.add(bSheath);

      // Window-covering volumetric laser fan
      const fanMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(fanMat);
      const fanMesh = new THREE.Mesh(fanGeo, fanMat);
      fanMesh.position.set(0, 0, 0.36);
      mGroup.add(fanMesh);

      this.group.add(mGroup);
      this.group.add(beamGroup);

      this.topBassMachines.push({
        group: mGroup,
        chassisMesh: chassis,
        lensMesh: lens,
        beamGroup,
        coreMesh: bCore,
        sheathMesh: bSheath,
        fanMesh,
        origin: cfg.origin,
        target: cfg.target,
        currentTarget: cfg.target.clone(),
      });
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;
    const time = performance.now() * 0.001;

    const isLasersEnabled =
      (routingConfig?.enabledEffects?.lasers ?? true) &&
      (directorState?.allowedEffects?.lasers ?? true);

    if (!isLasersEnabled) {
      for (const laser of this.lasers) {
        (laser.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (laser.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const m of this.topBassMachines) {
        (m.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (m.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (m.fanMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      return;
    }

    const laserDensity = routingConfig?.laserDensity ?? 1.0;
    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const instStem = features.stems.instruments;
    const bassStem = features.stems.bass;
    const kickStem = features.stems.kick;

    // -------------------------------------------------------------
    // 1. STAGE RIG LASER BEAMS
    // -------------------------------------------------------------
    if (features.isDrop) {
      this.currentPattern = 3; // Drop frenzy
    } else if (directorState?.currentSection === 'buildup') {
      this.currentPattern = 4; // Converging tunnel
    } else {
      this.currentPattern = (Math.floor(features.beatIndex / 8)) % 3;
    }

    const primaryCol = new THREE.Color(palette.primary);
    const cyanLaser = new THREE.Color(0x00f0ff);
    const whiteLaser = new THREE.Color(0xffffff);

    const baseLaserBrightness = (0.22 + instStem * 0.35 + (features.isDrop ? 0.15 : 0)) * maxBri;
    const beamThickness = (1.0 + instStem * 0.45) * Math.min(1.4, laserDensity);
    const activeLaserCount = Math.max(4, Math.min(this.lasers.length, Math.round(this.lasers.length * Math.min(1.0, laserDensity))));

    for (let i = 0; i < this.lasers.length; i++) {
      const laser = this.lasers[i];

      if (i >= activeLaserCount) {
        (laser.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (laser.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      const target = laser.target;
      let endX = target.x;
      let endY = target.y;
      const endZ = 24.0;

      if (this.currentPattern === 0) {
        const sweep = Math.sin(time * 2.5 + i * 0.4) * 7.5 * (1 + instStem * 0.5);
        endX = target.x + sweep;
        endY = target.y + Math.cos(time * 2.0 + i) * 1.4;
      } else if (this.currentPattern === 1) {
        const cross = Math.sin(time * 3.0 + (i % 2 === 0 ? 0 : Math.PI)) * 8.5;
        endX = (i % 2 === 0 ? 1 : -1) * cross;
        endY = target.y + Math.sin(time * 1.8 + i * 0.3) * 2.0;
      } else if (this.currentPattern === 2) {
        endX = target.x + Math.sin(time * 1.8 + i * 0.2) * 3.5;
        endY = 3.0 + Math.sin(time * 3.5) * 0.4;
      } else if (this.currentPattern === 3) {
        endX = Math.sin(time * 6.5 + i * 1.2) * 10.5;
        endY = Math.cos(time * 5.5 + i * 1.0) * 3.8 + 2.0;
      } else {
        const tunnelRadius = 2.2 * (1.0 - (directorState?.sectionProgress ?? 0.5) * 0.5);
        endX = Math.cos(i * (Math.PI * 2 / this.lasers.length)) * tunnelRadius;
        endY = 2.4 + Math.sin(i * (Math.PI * 2 / this.lasers.length)) * tunnelRadius;
      }

      laser.currentTarget.lerp(new THREE.Vector3(endX, endY, endZ), deltaSeconds * (5.0 + instStem * 8.0));

      const origin = laser.origin;
      const currTgt = laser.currentTarget;
      const dist = origin.distanceTo(currTgt);
      const midpoint = new THREE.Vector3().addVectors(origin, currTgt).multiplyScalar(0.5);

      laser.meshGroup.position.copy(midpoint);
      laser.meshGroup.lookAt(currTgt);
      laser.meshGroup.scale.set(beamThickness, beamThickness, dist);

      const isDropActive = features.isDrop || kickStem > 0.65;
      let activeCol = cyanLaser;
      if (isDropActive && i % 3 === 0) {
        activeCol = whiteLaser;
      } else if (i % 2 === 0) {
        activeCol = primaryCol;
      }

      const coreMat = laser.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteLaser).lerp(activeCol, 0.4);
      coreMat.opacity = Math.min(0.70 * maxBri, baseLaserBrightness * 1.6);

      const sheathMat = laser.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(activeCol);
      sheathMat.opacity = Math.min(0.22 * maxBri, baseLaserBrightness * 0.45);
    }

    // -------------------------------------------------------------
    // 2. TWO TOP-OF-SCREEN BASS LASER MACHINES (WINDOW COVERAGE)
    // -------------------------------------------------------------
    // Activated and manipulated on BASS & SUB-BASS!
    // Throws straight laser beams towards camera covering the window
    const bassFactor = Math.max(0, Math.min(1.0, bassStem * 1.1 + features.subBass * 0.9));
    const bassPulse = Math.pow(bassFactor, 1.3);

    // Strobe frequency modulated by bass
    const bassStrobe = Math.sin(time * (24.0 + bassFactor * 20.0)) * 0.15 + 0.85;

    for (let k = 0; k < this.topBassMachines.length; k++) {
      const machine = this.topBassMachines[k];

      // Aim straight towards camera with subtle sub-bass vibration
      const target = machine.target.clone();
      if (bassFactor > 0.4) {
        target.x += (Math.random() - 0.5) * 0.4 * bassFactor;
        target.y += (Math.random() - 0.5) * 0.3 * bassFactor;
      }
      machine.currentTarget.lerp(target, deltaSeconds * 12.0);

      machine.group.lookAt(machine.currentTarget);

      // Position straight beam between machine nozzle and target
      const dist = machine.origin.distanceTo(machine.currentTarget);
      const midpoint = new THREE.Vector3().addVectors(machine.origin, machine.currentTarget).multiplyScalar(0.5);

      machine.beamGroup.position.copy(midpoint);
      machine.beamGroup.lookAt(machine.currentTarget);

      // Bass thickness expansion
      const bassThickness = (1.4 + bassPulse * 1.8) * Math.min(1.4, laserDensity);
      machine.beamGroup.scale.set(bassThickness, bassThickness, dist);

      // Window coverage fan scale: expands outward towards the camera edges
      const fanSpread = (1.0 + bassPulse * 0.9) * bassStrobe;
      machine.fanMesh.scale.set(fanSpread, 1.0, fanSpread);

      // Color: Electric Emerald/Cyan or Palette Accent
      const bassLaserCol = new THREE.Color(palette.accent || 0x00f0ff);

      // Core: brilliant white/cyan laser beam
      const coreMat = machine.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteLaser).lerp(bassLaserCol, 0.25);
      coreMat.opacity = Math.min(0.95 * maxBri, (0.45 + bassPulse * 0.55) * bassStrobe * maxBri);

      // Sheath
      const sheathMat = machine.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(bassLaserCol);
      sheathMat.opacity = Math.min(0.40 * maxBri, (0.16 + bassPulse * 0.35) * bassStrobe * maxBri);

      // Window coverage fan: sweeps over the viewport
      const fanMat = machine.fanMesh.material as THREE.MeshBasicMaterial;
      fanMat.color.copy(bassLaserCol);
      fanMat.opacity = Math.min(0.32 * maxBri, (0.08 + bassPulse * 0.28) * bassStrobe * maxBri);

      // Lens emitter glow
      const lensMat = machine.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(bassLaserCol);
      lensMat.opacity = Math.min(0.95 * maxBri, (0.6 + bassPulse * 0.4) * maxBri);
    }
  }
}
