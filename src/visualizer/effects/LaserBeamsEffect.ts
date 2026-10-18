/**
 * Synwave Music Festival Concert Laser Rig Effect
 * High-intensity 32-beam volumetric concert laser arrays with overhead truss,
 * wing scissor cannons, floor uplight fans, and explosive drop manipulation.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface LaserFixture {
  group: THREE.Group;
  coreLine: THREE.Line;
  beamMesh: THREE.Mesh;
  origin: THREE.Vector3;
  baseAngleY: number;
  baseAngleX: number;
  type: 'overhead' | 'left-wing' | 'right-wing' | 'floor';
  index: number;
}

export class LaserBeamsEffect extends BaseEffect {
  readonly id = 'laser-beams';
  readonly name = 'Concert Stadium Lasers';
  readonly family = 'Lasers & Light Beams';
  readonly cost = 'medium';

  private fixtures: LaserFixture[] = [];
  private laserCount = 28;
  private currentModeTimer = 0;
  private laserPattern = 0; // 0: Scissor Cross, 1: Wide Horizon Fan, 2: Liquid Sky, 3: Drop Frenzy

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    const { quality } = context;
    if (quality === 'low') this.laserCount = 16;
    else if (quality === 'medium') this.laserCount = 24;
    else if (quality === 'high') this.laserCount = 28;
    else if (quality === 'ultra') this.laserCount = 36;

    this.fixtures = [];
    const beamLength = 120;

    // 1. Shared Geometry
    // Core line geometry
    const linePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, beamLength)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    this.disposables.push(lineGeo);

    // Volumetric tapering cylinder beam geometry
    // RadiusTop (at source) is small, RadiusBottom (at target) spreads slightly
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.55, beamLength, 8, 1, true);
    beamGeo.translate(0, beamLength / 2, 0);
    beamGeo.rotateX(Math.PI / 2); // Align with Z axis
    this.disposables.push(beamGeo);

    // Create Fixtures
    // A. Overhead Truss (half of lasers)
    const overheadCount = Math.floor(this.laserCount * 0.5);
    for (let i = 0; i < overheadCount; i++) {
      const u = i / (overheadCount - 1);
      const originX = (u - 0.5) * 44.0;
      const origin = new THREE.Vector3(originX, 15.0, -32.0);
      this.createFixture(origin, (u - 0.5) * 0.9, -0.35, 'overhead', i, lineGeo, beamGeo, context);
    }

    // B. Left Wing Scissor Tower
    const wingCount = Math.floor(this.laserCount * 0.2);
    for (let i = 0; i < wingCount; i++) {
      const u = i / Math.max(1, wingCount - 1);
      const origin = new THREE.Vector3(-26.0, 3.0 + u * 10.0, -22.0);
      this.createFixture(origin, 0.45 + u * 0.35, -0.15, 'left-wing', i, lineGeo, beamGeo, context);
    }

    // C. Right Wing Scissor Tower
    for (let i = 0; i < wingCount; i++) {
      const u = i / Math.max(1, wingCount - 1);
      const origin = new THREE.Vector3(26.0, 3.0 + u * 10.0, -22.0);
      this.createFixture(origin, -0.45 - u * 0.35, -0.15, 'right-wing', i, lineGeo, beamGeo, context);
    }

    // D. Floor Uplight Cannons
    const floorCount = this.laserCount - overheadCount - wingCount * 2;
    for (let i = 0; i < floorCount; i++) {
      const u = i / Math.max(1, floorCount - 1);
      const origin = new THREE.Vector3((u - 0.5) * 32.0, -1.5, -18.0);
      this.createFixture(origin, (u - 0.5) * 0.8, 0.25, 'floor', i, lineGeo, beamGeo, context);
    }
  }

  private createFixture(
    origin: THREE.Vector3,
    baseAngleY: number,
    baseAngleX: number,
    type: LaserFixture['type'],
    index: number,
    lineGeo: THREE.BufferGeometry,
    beamGeo: THREE.CylinderGeometry,
    context: VisualEffectContext
  ): void {
    const fixtureGroup = new THREE.Group();
    fixtureGroup.position.copy(origin);

    const isAlt = index % 2 === 0;
    const initialColor = new THREE.Color(isAlt ? context.palette.laserColor : context.palette.primary);

    // Inner bright laser core
    const lineMat = new THREE.LineBasicMaterial({
      color: initialColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(lineMat);
    const coreLine = new THREE.Line(lineGeo, lineMat);
    fixtureGroup.add(coreLine);

    // Volumetric glow envelope
    const beamMat = new THREE.MeshBasicMaterial({
      color: initialColor,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(beamMat);
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    fixtureGroup.add(beamMesh);

    this.fixtures.push({
      group: fixtureGroup,
      coreLine,
      beamMesh,
      origin,
      baseAngleY,
      baseAngleX,
      type,
      index,
    });

    this.group.add(fixtureGroup);
  }

  public update(context: VisualEffectContext): void {
    if (!this.enabled || this.fixtures.length === 0) return;

    const { features, deltaSeconds, trackTimeSeconds, palette } = context;
    const time = trackTimeSeconds;

    // 1. Calm Mode Behavior: If calm/acoustic music (e.g. Aaloshyo), fade lasers out into gentle ambient glow
    if (features.musicMode === 'calm') {
      for (const fix of this.fixtures) {
        const lineMat = fix.coreLine.material as THREE.LineBasicMaterial;
        const beamMat = fix.beamMesh.material as THREE.MeshBasicMaterial;
        lineMat.opacity = Math.max(0, lineMat.opacity - deltaSeconds * 2.0);
        beamMat.opacity = Math.max(0, beamMat.opacity - deltaSeconds * 2.0);
      }
      return;
    }

    // 2. Festival Mode: Pattern switching every 14 seconds or immediately on DROP
    this.currentModeTimer += deltaSeconds;
    if (features.isDrop) {
      this.laserPattern = 3; // Drop Frenzy Mode
    } else if (this.currentModeTimer > 14.0) {
      this.currentModeTimer = 0;
      this.laserPattern = (this.laserPattern + 1) % 3;
    }

    const laserColor = new THREE.Color(palette.laserColor);
    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);
    const whiteColor = new THREE.Color('#ffffff');

    // Drop intensity multiplier
    const dropMultiplier = features.isDrop ? 2.8 : 1.0;
    const sweepSpeed = (features.isDrop ? 5.5 : 2.0) * (1 + features.rms * 0.8);

    for (const fix of this.fixtures) {
      let targetRotY = fix.baseAngleY;
      let targetRotX = fix.baseAngleX;
      let targetOpacity = 0.5 + features.rms * 0.45;

      // Drop strobe blinder effect
      if (features.isDrop) {
        // High-speed 16th-note strobing during dubstep drop
        const strobePulse = Math.sin(time * 30.0 + fix.index * 1.2) > 0 ? 1.0 : 0.35;
        targetOpacity = Math.min(1.0, (0.7 + features.bass * 0.3) * strobePulse);
      } else if (features.isKick) {
        targetOpacity = Math.min(1.0, targetOpacity + features.kickIntensity * 0.5);
      }

      // Pattern Motions:
      switch (this.laserPattern) {
        case 0: {
          // Scissor Cross: Wing lasers and overhead lasers cross in razor X patterns
          if (fix.type === 'left-wing') {
            targetRotY = fix.baseAngleY + Math.sin(time * sweepSpeed + fix.index * 0.4) * 0.65;
            targetRotX = fix.baseAngleX + Math.cos(time * sweepSpeed * 0.7) * 0.3;
          } else if (fix.type === 'right-wing') {
            targetRotY = fix.baseAngleY - Math.sin(time * sweepSpeed + fix.index * 0.4) * 0.65;
            targetRotX = fix.baseAngleX + Math.cos(time * sweepSpeed * 0.7) * 0.3;
          } else {
            // Overhead scissor fan
            const dir = fix.index % 2 === 0 ? 1 : -1;
            targetRotY = fix.baseAngleY + Math.sin(time * sweepSpeed + fix.index * 0.3) * 0.5 * dir;
            targetRotX = fix.baseAngleX + Math.sin(time * 1.5) * 0.2;
          }
          break;
        }

        case 1: {
          // Wide 180-degree Horizon Fan Sweep
          const fanWave = Math.sin(time * sweepSpeed * 0.8 + fix.baseAngleY * 2.0);
          targetRotY = fix.baseAngleY * (1.2 + Math.sin(time * 1.2) * 0.4);
          targetRotX = fix.baseAngleX + fanWave * 0.35;
          break;
        }

        case 2: {
          // Liquid Sky: Razor-thin flat laser plane undulating with the live audio waveform
          targetRotX = -0.05 + Math.sin(time * 2.5 + fix.baseAngleY * 4.0) * 0.12 * (1 + features.bass);
          targetRotY = fix.baseAngleY * 1.35;
          break;
        }

        case 3:
        default: {
          // DROP FRENZY: Insane high-speed multi-axis concert explosion!
          const chaosY = Math.sin(time * sweepSpeed * 1.2 + fix.index * 0.8) * 0.8;
          const chaosX = Math.cos(time * sweepSpeed * 1.4 + fix.index * 0.5) * 0.45;
          targetRotY = fix.baseAngleY + chaosY;
          targetRotX = fix.baseAngleX + chaosX;
          break;
        }
      }

      // Smooth rotation with high agility
      const agility = deltaSeconds * (features.isDrop ? 18.0 : 9.0);
      fix.group.rotation.y = this.lerp(fix.group.rotation.y, targetRotY, agility);
      fix.group.rotation.x = this.lerp(fix.group.rotation.x, targetRotX, agility);

      // Color Strobes & Cycling
      const lineMat = fix.coreLine.material as THREE.LineBasicMaterial;
      const beamMat = fix.beamMesh.material as THREE.MeshBasicMaterial;

      let activeColor = fix.index % 2 === 0 ? laserColor : primaryColor;
      if (features.isDrop) {
        // In drops, cycle aggressively between electric cyan, laser pink, white, and secondary
        const colorIdx = (Math.floor(time * 12.0) + fix.index) % 4;
        if (colorIdx === 0) activeColor = whiteColor;
        else if (colorIdx === 1) activeColor = laserColor;
        else if (colorIdx === 2) activeColor = secondaryColor;
        else activeColor = primaryColor;
      } else if (features.isKick) {
        // Flash to white/laser tint on kick
        activeColor = whiteColor;
      }

      lineMat.color.copy(activeColor);
      beamMat.color.copy(activeColor);

      lineMat.opacity = Math.min(1.0, targetOpacity * this.intensity);
      beamMat.opacity = Math.min(0.65, targetOpacity * 0.42 * this.intensity * dropMultiplier);

      // Volumetric beam scale pulses with bass
      const beamScale = 1.0 + features.bass * 1.2 + (features.isKick ? 0.8 : 0);
      fix.beamMesh.scale.set(beamScale, 1.0, beamScale);
    }
  }
}
