/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * Professional concert stage lighting rig matching live festival stages:
 * - Dynamic Colouring Spotlights: Default count of 3 (adjustable via slider),
 *   colored dynamically by sampling the official video thumbnail color gradients!
 * - Perimeter Screen Cross-Beam Lights: Fixtures all around the screen frame
 *   throwing criss-crossing scissor beams across the stage, with their pan/tilt
 *   sweeping movements driven directly by the VOCAL STEM!
 * - Dedicated Kick-Activated White Spotlights (Blinders) flashing on sharp drum kicks.
 * - Subtle ambient stage wash matching the video thumbnail palette.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface MovingHead {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  index: number;
}

interface PerimeterCrossLight {
  group: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  baseTarget: THREE.Vector3;
  currentTarget: THREE.Vector3;
  side: 'left' | 'right' | 'top';
  index: number;
}

interface KickBlinder {
  group: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  intensity: number;
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & Kick Blinders';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // Colouring Spotlights: default count 3, adjustable via slider
  private spotlightCount = 3;
  private customSpotlightColors: THREE.Color[] = [];

  private fixtures: MovingHead[] = [];
  private perimeterCrossLights: PerimeterCrossLight[] = [];
  private kickBlinders: KickBlinder[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  public setSpotlightCount(count: number): void {
    this.spotlightCount = Math.max(1, Math.min(8, Math.round(count)));
  }

  public getSpotlightCount(): number {
    return this.spotlightCount;
  }

  public setSpotlightColors(colors: string[]): void {
    if (colors && colors.length > 0) {
      this.customSpotlightColors = colors.map((hex) => new THREE.Color(hex));
    }
  }

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Chassis geometry
    const baseGeo = new THREE.CylinderGeometry(0.25, 0.32, 0.35, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.disposables.push(baseGeo, baseMat);

    // Lens flare sphere
    const lensGeo = new THREE.SphereGeometry(0.20, 10, 10);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward along local +Z axis
    const coneLength = 26;
    const coneGeo = new THREE.ConeGeometry(1.3, coneLength, 16, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Body extends along +Z
    this.disposables.push(coneGeo);

    // 1. Colouring Spotlights (Up to 8 fixtures mounted on overhead truss)
    // Symmetrically spaced across the stage: x = -10.5 to +10.5
    const overheadPositions: THREE.Vector3[] = [
      new THREE.Vector3(-7.5, 12.2, -4.0), // 0: Left
      new THREE.Vector3(0.0, 12.4, -4.0),  // 1: Center
      new THREE.Vector3(7.5, 12.2, -4.0),  // 2: Right
      new THREE.Vector3(-4.0, 12.3, -4.0), // 3: Mid-Left
      new THREE.Vector3(4.0, 12.3, -4.0),  // 4: Mid-Right
      new THREE.Vector3(-11.0, 12.0, -4.0),// 5: Far-Left
      new THREE.Vector3(11.0, 12.0, -4.0), // 6: Far-Right
      new THREE.Vector3(0.0, 11.8, 0.8),   // 7: Front Center
    ];

    for (let i = 0; i < overheadPositions.length; i++) {
      const pos = overheadPositions[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(pos);

      // Chassis
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixtureGroup.add(baseMesh);

      // Lens
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

      // Volumetric beam cone
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(coneMat);

      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(coneMesh);

      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: pos,
        targetPos: new THREE.Vector3(0, 1.8, 14.0),
        currentTarget: new THREE.Vector3(0, 1.8, 14.0),
        index: i,
      });
    }

    // 2. Perimeter Screen Cross-Beam Lights (All around the screen)
    // Mounted along left tower, right tower, and top truss around the screen frame
    const crossConeLength = 25;
    const crossConeGeo = new THREE.ConeGeometry(0.9, crossConeLength, 14, 1, true);
    crossConeGeo.translate(0, -crossConeLength / 2, 0);
    crossConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(crossConeGeo);

    const perimeterConfigs: { pos: THREE.Vector3; target: THREE.Vector3; side: 'left' | 'right' | 'top' }[] = [
      // Left side tower fixtures (aim across to stage right)
      { pos: new THREE.Vector3(-11.8, 2.2, -4.1), target: new THREE.Vector3(12.0, 1.8, 12.0), side: 'left' },
      { pos: new THREE.Vector3(-11.8, 4.6, -4.1), target: new THREE.Vector3(11.0, 3.5, 14.0), side: 'left' },
      { pos: new THREE.Vector3(-11.8, 7.0, -4.1), target: new THREE.Vector3(9.5, 5.0, 16.0), side: 'left' },
      { pos: new THREE.Vector3(-11.8, 9.4, -4.1), target: new THREE.Vector3(8.0, 6.5, 18.0), side: 'left' },

      // Right side tower fixtures (aim across to stage left)
      { pos: new THREE.Vector3(11.8, 2.2, -4.1), target: new THREE.Vector3(-12.0, 1.8, 12.0), side: 'right' },
      { pos: new THREE.Vector3(11.8, 4.6, -4.1), target: new THREE.Vector3(-11.0, 3.5, 14.0), side: 'right' },
      { pos: new THREE.Vector3(11.8, 7.0, -4.1), target: new THREE.Vector3(-9.5, 5.0, 16.0), side: 'right' },
      { pos: new THREE.Vector3(11.8, 9.4, -4.1), target: new THREE.Vector3(-8.0, 6.5, 18.0), side: 'right' },

      // Top truss fixtures (aim down-cross across stage)
      { pos: new THREE.Vector3(-6.0, 11.2, -4.2), target: new THREE.Vector3(7.0, 0.8, 14.0), side: 'top' },
      { pos: new THREE.Vector3(6.0, 11.2, -4.2), target: new THREE.Vector3(-7.0, 0.8, 14.0), side: 'top' },
    ];

    for (let i = 0; i < perimeterConfigs.length; i++) {
      const cfg = perimeterConfigs[i];
      const pGroup = new THREE.Group();
      pGroup.position.copy(cfg.pos);

      const pLensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
      });
      this.disposables.push(pLensMat);
      const pLens = new THREE.Mesh(lensGeo, pLensMat);
      pLens.position.set(0, 0, 0.1);
      pGroup.add(pLens);

      const pConeMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(pConeMat);
      const pCone = new THREE.Mesh(crossConeGeo, pConeMat);
      pCone.position.set(0, 0, 0.1);
      pGroup.add(pCone);

      pGroup.lookAt(cfg.target);
      this.group.add(pGroup);

      this.perimeterCrossLights.push({
        group: pGroup,
        lensMesh: pLens,
        coneMesh: pCone,
        basePos: cfg.pos,
        baseTarget: cfg.target.clone(),
        currentTarget: cfg.target.clone(),
        side: cfg.side,
        index: i,
      });
    }

    // 3. Dedicated Kick-Activated White Spotlights (Blinders)
    const blinderConfigs = [
      { pos: new THREE.Vector3(-9.0, 11.5, 1.2), tgt: new THREE.Vector3(-7.5, 1.8, 16.0) },
      { pos: new THREE.Vector3(-4.5, 11.5, 1.2), tgt: new THREE.Vector3(-3.5, 2.0, 16.0) },
      { pos: new THREE.Vector3(0.0, 11.5, 1.2), tgt: new THREE.Vector3(0.0, 2.2, 16.0) },
      { pos: new THREE.Vector3(4.5, 11.5, 1.2), tgt: new THREE.Vector3(3.5, 2.0, 16.0) },
      { pos: new THREE.Vector3(9.0, 11.5, 1.2), tgt: new THREE.Vector3(7.5, 1.8, 16.0) },
      { pos: new THREE.Vector3(-5.5, 0.4, 4.0), tgt: new THREE.Vector3(-4.5, 1.6, 16.0) },
      { pos: new THREE.Vector3(0.0, 0.4, 4.2), tgt: new THREE.Vector3(0.0, 1.6, 16.0) },
      { pos: new THREE.Vector3(5.5, 0.4, 4.0), tgt: new THREE.Vector3(4.5, 1.6, 16.0) },
    ];

    const blinderConeGeo = new THREE.ConeGeometry(0.7, 18, 14, 1, true);
    blinderConeGeo.translate(0, -9, 0);
    blinderConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(blinderConeGeo);

    for (let i = 0; i < blinderConfigs.length; i++) {
      const cfg = blinderConfigs[i];
      const bGroup = new THREE.Group();
      bGroup.position.copy(cfg.pos);

      const bLensMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(bLensMat);
      const bLens = new THREE.Mesh(lensGeo, bLensMat);
      bGroup.add(bLens);

      const bConeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(bConeMat);
      const bCone = new THREE.Mesh(blinderConeGeo, bConeMat);
      bGroup.add(bCone);

      bGroup.lookAt(cfg.tgt);
      this.group.add(bGroup);

      this.kickBlinders.push({
        group: bGroup,
        lensMesh: bLens,
        coneMesh: bCone,
        basePos: cfg.pos,
        targetPos: cfg.tgt,
        intensity: 0.0,
      });
    }

    // 4. Dynamic Stage Wash Point Lights
    this.washLight1 = new THREE.PointLight(0xff6600, 0.6, 25, 1.8);
    this.washLight1.position.set(-6, 6.0, -1.0);
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.6, 25, 1.8);
    this.washLight2.position.set(6, 6.0, -1.0);
    this.group.add(this.washLight2);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;
    const time = performance.now() * 0.001;

    const isLightsEnabled =
      (routingConfig?.enabledEffects?.lights ?? true) &&
      (directorState?.allowedEffects?.lights ?? true);

    if (!isLightsEnabled) {
      for (const fix of this.fixtures) {
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const p of this.perimeterCrossLights) {
        (p.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (p.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const blinder of this.kickBlinders) {
        (blinder.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (blinder.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      this.washLight1.intensity = 0;
      this.washLight2.intensity = 0;
      return;
    }

    const bassBeamMult = routingConfig?.bassToBeamIntensity ?? 1.0;
    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const isReducedFlash = routingConfig?.reducedFlash ?? false;
    const kickSens = routingConfig?.kickSensitivity ?? 1.0;

    const bassStem = features.stems.bass;
    const kickStem = features.stems.kick;
    const instStem = features.stems.instruments;
    const vocalStem = features.stems.vocals;

    // Palette: utilize video thumbnail colors if extracted, otherwise fallback to stage palette
    const hasCustomColors = this.customSpotlightColors.length > 0;
    const primaryCol = hasCustomColors ? this.customSpotlightColors[0] : new THREE.Color(palette.primary);
    const secondaryCol = hasCustomColors
      ? (this.customSpotlightColors[1] || this.customSpotlightColors[0])
      : new THREE.Color(palette.secondary);
    const accentCol = hasCustomColors
      ? (this.customSpotlightColors[2] || this.customSpotlightColors[0])
      : new THREE.Color(palette.accent || palette.primary);

    const colorPaletteArray = hasCustomColors
      ? this.customSpotlightColors
      : [primaryCol, secondaryCol, accentCol];

    const beatPulse = Math.sin(features.beatPhase * Math.PI) * 0.025;
    const rawBrightness = 0.07 + (bassStem * 0.09 * bassBeamMult) + beatPulse + (features.isDrop ? 0.05 : 0);
    const baseBrightness = Math.min(0.18 * maxBri, rawBrightness * maxBri);

    // -------------------------------------------------------------
    // 1. Colouring Spotlights (Active Count: this.spotlightCount)
    // -------------------------------------------------------------
    const activeCount = Math.min(this.fixtures.length, this.spotlightCount);

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      if (i >= activeCount) {
        // Disabled beyond selected count
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // Dynamic pan/tilt sweeps
      if (features.isDrop) {
        const spreadX = Math.sin(time * 3.2 + i * 1.2) * 9.5;
        const spreadY = 2.0 + Math.cos(time * 2.8 + i * 0.8) * 2.0;
        const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
        fix.targetPos.set(spreadX, spreadY, spreadZ);
      } else {
        const offset = (i / activeCount) * Math.PI * 2;
        const sweepX = Math.sin(time * (0.8 + instStem * 1.4) + offset) * 7.5;
        const sweepY = 2.2 + Math.sin(time * 0.6 + offset * 0.5) * 1.5;
        const sweepZ = 13.5 + Math.cos(time * 0.5 + offset) * 2.0;
        fix.targetPos.set(sweepX, sweepY, sweepZ);
      }

      fix.currentTarget.lerp(fix.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      fix.group.lookAt(fix.currentTarget);

      // Color from thumbnail extracted color gradient
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(0.95 * maxBri, baseBrightness * 4.2);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = Math.min(0.18 * maxBri, baseBrightness);

      const beamScale = 1.0 + bassStem * 0.35 * bassBeamMult;
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }

    // -------------------------------------------------------------
    // 2. Perimeter Screen Cross-Beam Lights (VOCAL REACTIVE)
    // -------------------------------------------------------------
    // The lights all around the screen cross the stage across,
    // with their pan/tilt scissor movement driven directly by VOCALS!
    const vocalEnergy = Math.max(0, vocalStem);
    const vocalSpeed = 1.2 + vocalEnergy * 2.8;

    for (let i = 0; i < this.perimeterCrossLights.length; i++) {
      const pLight = this.perimeterCrossLights[i];

      // Scissor crossing motion driven by vocal stem
      const vocalSweep = Math.sin(time * vocalSpeed + i * 0.65) * (0.35 + vocalEnergy * 0.85);
      const verticalSweep = Math.cos(time * (vocalSpeed * 0.8) + i * 0.5) * (0.4 + vocalEnergy * 0.6);

      const target = pLight.baseTarget.clone();

      if (pLight.side === 'left') {
        // Sweep across towards right and forward into arena
        target.x += vocalSweep * 6.5;
        target.y += verticalSweep * 3.0;
        target.z += vocalEnergy * 4.0;
      } else if (pLight.side === 'right') {
        // Sweep across towards left and forward into arena
        target.x -= vocalSweep * 6.5;
        target.y += verticalSweep * 3.0;
        target.z += vocalEnergy * 4.0;
      } else {
        // Top lights cross down across the deck
        target.x += Math.sin(time * vocalSpeed * 1.2 + i) * (4.0 + vocalEnergy * 5.0);
        target.y += Math.cos(time * vocalSpeed + i) * 2.0;
      }

      pLight.currentTarget.lerp(target, deltaSeconds * (5.0 + vocalEnergy * 8.0));
      pLight.group.lookAt(pLight.currentTarget);

      // Color from thumbnail palette
      const crossCol = colorPaletteArray[(i + 1) % colorPaletteArray.length];

      const pLensMat = pLight.lensMesh.material as THREE.MeshBasicMaterial;
      pLensMat.color.copy(crossCol);
      pLensMat.opacity = Math.min(0.95 * maxBri, (0.55 + vocalEnergy * 0.45) * maxBri);

      const pConeMat = pLight.coneMesh.material as THREE.MeshBasicMaterial;
      pConeMat.color.copy(crossCol);
      // Brightness dynamically pulses with vocal movements
      const vocalBrightness = (0.08 + vocalEnergy * 0.14) * maxBri;
      pConeMat.opacity = Math.min(0.24 * maxBri, vocalBrightness);

      const crossScale = 1.0 + vocalEnergy * 0.4;
      pLight.coneMesh.scale.set(crossScale, crossScale, 1.0);
    }

    // -------------------------------------------------------------
    // 3. Kick-Activated White Spotlights (Blinders)
    // -------------------------------------------------------------
    const isKickTrigger = features.isKick && (kickStem * kickSens) > 0.40;

    for (let i = 0; i < this.kickBlinders.length; i++) {
      const blinder = this.kickBlinders[i];

      if (isKickTrigger) {
        blinder.intensity = 1.0;
      } else {
        const decaySpeed = 7.5 / (routingConfig?.effectDecay ?? 1.0);
        blinder.intensity = Math.max(0, blinder.intensity - deltaSeconds * decaySpeed);
      }

      const maxBlinderOpacity = isReducedFlash ? 0.05 : (0.16 * maxBri);

      const bLensMat = blinder.lensMesh.material as THREE.MeshBasicMaterial;
      bLensMat.opacity = blinder.intensity * 0.85 * maxBri;

      const bConeMat = blinder.coneMesh.material as THREE.MeshBasicMaterial;
      bConeMat.opacity = blinder.intensity * maxBlinderOpacity;

      const scale = 1.0 + blinder.intensity * 0.25;
      blinder.coneMesh.scale.set(scale, scale, 1.0);
    }

    // -------------------------------------------------------------
    // 4. Wash Lights (Tinted by Thumbnail Palette)
    // -------------------------------------------------------------
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.45 + bassStem * 0.55 * bassBeamMult) * maxBri);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.45 + vocalStem * 0.55 * bassBeamMult) * maxBri);
  }
}
