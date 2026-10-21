/**
 * Synwave Music Festival Concert Laser Rig Effect
 * High-intensity 32-beam volumetric concert laser arrays with overhead truss,
 * wing scissor cannons, floor uplight fans, and explosive drop manipulation.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';
import { LaserShowController } from '../director/LaserShowController';
import { resolveLaserPaletteColors } from './laserColorUtils';

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

    const { features, deltaSeconds, trackTimeSeconds, palette, routingConfig, directorState, seed } = context;
    const time = trackTimeSeconds;

    // Phase 7: Consume unified LaserShowController decision
    const laserController = LaserShowController.getInstance();
    const decision = context.laserDecision || laserController.update(
      features,
      deltaSeconds,
      trackTimeSeconds,
      seed || 1337,
      routingConfig,
      directorState
    );

    // If disabled or in OFF state, smoothly fade out perimeter lasers
    if (!decision.isPermitted || decision.semanticState === 'OFF' || features.musicMode === 'calm') {
      for (const fix of this.fixtures) {
        const lineMat = fix.coreLine.material as THREE.LineBasicMaterial;
        const beamMat = fix.beamMesh.material as THREE.MeshBasicMaterial;
        lineMat.opacity = Math.max(0, lineMat.opacity - deltaSeconds * 3.0);
        beamMat.opacity = Math.max(0, beamMat.opacity - deltaSeconds * 3.0);
      }
      return;
    }

    // Freeze animation when paused
    if (deltaSeconds <= 0) return;

    // Map semantic state to perimeter mode:
    // 0: Scissor Cross (DROP_GROOVE)
    // 1: Wide Horizon Fan (CINEMATIC / MELODIC)
    // 2: Liquid Sky (BUILD_RISER)
    // 3: Drop Frenzy (DROP_IMPACT / CLIMAX)
    switch (decision.semanticState) {
      case 'CINEMATIC_DIRECTIONAL':
      case 'MELODIC_ANTHEM':
        this.laserPattern = 1; // Wide Horizon Fan
        break;
      case 'BUILD_RISER':
        this.laserPattern = 2; // Liquid Sky ceiling sheet
        break;
      case 'DROP_IMPACT':
      case 'CLIMAX_OMNIDIRECTIONAL':
        this.laserPattern = 3; // Drop Frenzy
        break;
      case 'DROP_GROOVE':
      default:
        // Use Scissor Cross with bar-level direction variation or Wide Fan on bar 3
        this.laserPattern = decision.barInPhrase === 3 ? 1 : 0;
        break;
    }

    // Coherent palette colors derived from song palette
    const resolvedColors = resolveLaserPaletteColors(palette, seed || 1337);
    const laserColor = resolvedColors.core1;
    const primaryColor = resolvedColors.core2;
    const whiteColor = new THREE.Color('#ffffff');

    const sweepSpeed = decision.movementSpeed * (decision.semanticState === 'CLIMAX_OMNIDIRECTIONAL' ? 2.5 : 1.2);
    const scissorDir = decision.barInPhrase % 2 === 0 ? 1 : -1;

    for (const fix of this.fixtures) {
      let targetRotY = fix.baseAngleY;
      let targetRotX = fix.baseAngleX;
      let targetOpacity = decision.beamIntensity * (0.60 + features.rms * 0.40);

      // Beat-synchronized accents
      if (decision.isBeatGated) {
        targetOpacity *= decision.beatGateFactor;
      }
      if (decision.pulseBrightness > 0.1) {
        targetOpacity = Math.min(1.0, targetOpacity + decision.pulseBrightness * 0.4);
      }

      // Pattern Motions:
      switch (this.laserPattern) {
        case 0: {
          // Scissor Cross with bar-level direction flipping
          if (fix.type === 'left-wing') {
            targetRotY = fix.baseAngleY + Math.sin(time * sweepSpeed + fix.index * 0.4) * 0.65 * scissorDir;
            targetRotX = fix.baseAngleX + Math.cos(time * sweepSpeed * 0.7) * 0.3;
          } else if (fix.type === 'right-wing') {
            targetRotY = fix.baseAngleY - Math.sin(time * sweepSpeed + fix.index * 0.4) * 0.65 * scissorDir;
            targetRotX = fix.baseAngleX + Math.cos(time * sweepSpeed * 0.7) * 0.3;
          } else {
            const dir = fix.index % 2 === 0 ? 1 : -1;
            targetRotY = fix.baseAngleY + Math.sin(time * sweepSpeed + fix.index * 0.3) * 0.5 * dir * scissorDir;
            targetRotX = fix.baseAngleX + Math.sin(time * 1.5) * 0.2;
          }
          break;
        }

        case 1: {
          // Wide Horizon Fan
          const fanWave = Math.sin(time * sweepSpeed * 0.6 + fix.baseAngleY * 2.0);
          targetRotY = fix.baseAngleY * (1.2 + Math.sin(time * 1.0) * 0.3);
          targetRotX = fix.baseAngleX + fanWave * 0.30;
          break;
        }

        case 2: {
          // Liquid Sky undulating ceiling plane
          targetRotX = -0.05 + Math.sin(time * 2.0 + fix.baseAngleY * 3.5) * 0.10 * (1 + features.bass * 0.5);
          targetRotY = fix.baseAngleY * 1.30;
          break;
        }

        case 3:
        default: {
          // Drop Frenzy: High-speed multi-axis concert explosion reserved for climax/impact
          const chaosY = Math.sin(time * sweepSpeed * 1.1 + fix.index * 0.8) * 0.75;
          const chaosX = Math.cos(time * sweepSpeed * 1.3 + fix.index * 0.5) * 0.40;
          targetRotY = fix.baseAngleY + chaosY;
          targetRotX = fix.baseAngleX + chaosX;
          break;
        }
      }

      // Smooth rotation
      const agility = deltaSeconds * (decision.semanticState === 'CLIMAX_OMNIDIRECTIONAL' ? 16.0 : 8.5);
      fix.group.rotation.y = this.lerp(fix.group.rotation.y, targetRotY, agility);
      fix.group.rotation.x = this.lerp(fix.group.rotation.x, targetRotX, agility);

      // Consistent Palette Colors
      const lineMat = fix.coreLine.material as THREE.LineBasicMaterial;
      const beamMat = fix.beamMesh.material as THREE.MeshBasicMaterial;

      let activeColor = fix.index % 2 === 0 ? laserColor : primaryColor;
      if (decision.pulseBrightness > 0.45) {
        activeColor = whiteColor;
      }

      lineMat.color.copy(activeColor);
      beamMat.color.copy(activeColor);

      const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
      lineMat.opacity = Math.min(1.0, targetOpacity * this.intensity * maxBri);
      beamMat.opacity = Math.min(0.60, targetOpacity * 0.38 * this.intensity * maxBri);

      // Volumetric beam scale pulses with bass
      const beamScale = decision.beamThicknessMultiplier * (1.0 + features.bass * 0.6);
      fix.beamMesh.scale.set(beamScale, 1.0, beamScale);
    }
  }
}
