/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * Professional concert stage lighting rig:
 * - Dynamic Colouring Spotlights: Default count of 3 (adjustable via slider),
 *   colored dynamically by sampling the official video thumbnail color gradients!
 * - 360° Continuous Rotatable Perimeter Lights around the YouTube Screen:
 *   Activated and manipulated on the BASS STEM and bass frequency with high visibility.
 * - Bottom white blinder circles removed; kick impact is handled by window screen flash.
 * - Freeze support: when playback is paused (deltaSeconds === 0), all lights freeze in place.
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

interface PerimeterBassLight {
  group: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  baseTarget: THREE.Vector3;
  currentTarget: THREE.Vector3;
  side: 'left' | 'right' | 'top' | 'bottom';
  phaseOffset: number;
  index: number;
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & 360° Perimeter Bass Beams';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // Colouring Spotlights: default count 3, adjustable via slider
  private spotlightCount = 3;
  private customSpotlightColors: THREE.Color[] = [];

  private fixtures: MovingHead[] = [];
  private perimeterBassLights: PerimeterBassLight[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  // Internal time accumulation (freezes when deltaSeconds === 0)
  private internalTime = 0;
  private perimeterRotationAngle = 0;

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
    const lensGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward along local +Z axis
    const coneLength = 26;
    const coneGeo = new THREE.ConeGeometry(1.3, coneLength, 16, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Body extends along +Z
    this.disposables.push(coneGeo);

    // 1. Colouring Spotlights (Up to 8 fixtures mounted on overhead truss)
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

    // 2. High-Intensity 360° Perimeter Bass Lights Framing the YouTube Screen
    // Wide conical beam geometry for maximum visual presence across the stage
    const periConeLength = 28;
    const periConeGeo = new THREE.ConeGeometry(1.4, periConeLength, 16, 1, true);
    periConeGeo.translate(0, -periConeLength / 2, 0);
    periConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(periConeGeo);

    const perimeterConfigs: {
      pos: THREE.Vector3;
      target: THREE.Vector3;
      side: 'left' | 'right' | 'top' | 'bottom';
      phaseOffset: number;
    }[] = [
      // Left tower fixtures (aim across towards right & forward)
      { pos: new THREE.Vector3(-12.0, 2.2, -4.1), target: new THREE.Vector3(12.0, 2.0, 12.0), side: 'left', phaseOffset: 0.0 },
      { pos: new THREE.Vector3(-12.0, 4.6, -4.1), target: new THREE.Vector3(11.0, 3.8, 14.0), side: 'left', phaseOffset: 0.8 },
      { pos: new THREE.Vector3(-12.0, 7.0, -4.1), target: new THREE.Vector3(10.0, 5.5, 16.0), side: 'left', phaseOffset: 1.6 },
      { pos: new THREE.Vector3(-12.0, 9.4, -4.1), target: new THREE.Vector3(9.0, 7.0, 18.0), side: 'left', phaseOffset: 2.4 },

      // Right tower fixtures (aim across towards left & forward)
      { pos: new THREE.Vector3(12.0, 2.2, -4.1), target: new THREE.Vector3(-12.0, 2.0, 12.0), side: 'right', phaseOffset: 3.2 },
      { pos: new THREE.Vector3(12.0, 4.6, -4.1), target: new THREE.Vector3(-11.0, 3.8, 14.0), side: 'right', phaseOffset: 4.0 },
      { pos: new THREE.Vector3(12.0, 7.0, -4.1), target: new THREE.Vector3(-10.0, 5.5, 16.0), side: 'right', phaseOffset: 4.8 },
      { pos: new THREE.Vector3(12.0, 9.4, -4.1), target: new THREE.Vector3(-9.0, 7.0, 18.0), side: 'right', phaseOffset: 5.6 },

      // Top truss fixtures (sweep downward across the deck)
      { pos: new THREE.Vector3(-6.5, 11.4, -4.2), target: new THREE.Vector3(7.5, 0.8, 14.0), side: 'top', phaseOffset: 1.2 },
      { pos: new THREE.Vector3(6.5, 11.4, -4.2), target: new THREE.Vector3(-7.5, 0.8, 14.0), side: 'top', phaseOffset: 4.4 },

      // Bottom screen frame fixtures (cross upward into audience space)
      { pos: new THREE.Vector3(-8.0, 0.8, -4.1), target: new THREE.Vector3(8.0, 6.0, 15.0), side: 'bottom', phaseOffset: 2.0 },
      { pos: new THREE.Vector3(8.0, 0.8, -4.1), target: new THREE.Vector3(-8.0, 6.0, 15.0), side: 'bottom', phaseOffset: 5.2 },
    ];

    for (let i = 0; i < perimeterConfigs.length; i++) {
      const cfg = perimeterConfigs[i];
      const pGroup = new THREE.Group();
      pGroup.position.copy(cfg.pos);

      const pLensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.95,
      });
      this.disposables.push(pLensMat);
      const pLens = new THREE.Mesh(lensGeo, pLensMat);
      pLens.position.set(0, 0, 0.1);
      pGroup.add(pLens);

      const pConeMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(pConeMat);
      const pCone = new THREE.Mesh(periConeGeo, pConeMat);
      pCone.position.set(0, 0, 0.1);
      pGroup.add(pCone);

      pGroup.lookAt(cfg.target);
      this.group.add(pGroup);

      this.perimeterBassLights.push({
        group: pGroup,
        lensMesh: pLens,
        coneMesh: pCone,
        basePos: cfg.pos,
        baseTarget: cfg.target.clone(),
        currentTarget: cfg.target.clone(),
        side: cfg.side,
        phaseOffset: cfg.phaseOffset,
        index: i,
      });
    }

    // 3. Dynamic Stage Wash Point Lights (Tinted by Thumbnail Palette)
    this.washLight1 = new THREE.PointLight(0xff6600, 0.6, 25, 1.8);
    this.washLight1.position.set(-6, 6.0, -1.0);
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.6, 25, 1.8);
    this.washLight2.position.set(6, 6.0, -1.0);
    this.group.add(this.washLight2);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;

    // Time advances strictly when playing (deltaSeconds > 0). Freezes when paused!
    this.internalTime += deltaSeconds;
    const time = this.internalTime;

    const isLightsEnabled =
      (routingConfig?.enabledEffects?.lights ?? true) &&
      (directorState?.allowedEffects?.lights ?? true);

    if (!isLightsEnabled) {
      for (const fix of this.fixtures) {
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const p of this.perimeterBassLights) {
        (p.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (p.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      this.washLight1.intensity = 0;
      this.washLight2.intensity = 0;
      return;
    }

    const bassBeamMult = routingConfig?.bassToBeamIntensity ?? 1.0;
    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const periSpeedMult = routingConfig?.perimeterBassRotationSpeed ?? 1.0;

    const bassStem = features.stems.bass;
    const instStem = features.stems.instruments;
    const bassFactor = Math.max(bassStem, features.bass || 0);

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
    const baseBrightness = Math.min(0.22 * maxBri, rawBrightness * maxBri);

    // -------------------------------------------------------------
    // 1. Colouring Spotlights (Active Count: this.spotlightCount)
    // -------------------------------------------------------------
    const activeCount = Math.min(this.fixtures.length, this.spotlightCount);

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      if (i >= activeCount) {
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

      if (deltaSeconds > 0) {
        fix.currentTarget.lerp(fix.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      }
      fix.group.lookAt(fix.currentTarget);

      // Color from thumbnail extracted color gradient
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(0.95 * maxBri, baseBrightness * 4.2);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = Math.min(0.22 * maxBri, baseBrightness);

      const beamScale = 1.0 + bassStem * 0.35 * bassBeamMult;
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }

    // -------------------------------------------------------------
    // 2. 360° Rotatable Perimeter Lights Around Screen (BASS ACTIVATED)
    // -------------------------------------------------------------
    // The rotation speed and movements are directly manipulated by bass frequency and energy.
    // Full 360° continuous rotation around their mounts!
    const bassRotationSpeed = (1.4 + Math.pow(bassFactor, 1.3) * 5.5) * periSpeedMult;
    if (deltaSeconds > 0) {
      this.perimeterRotationAngle += deltaSeconds * bassRotationSpeed;
    }

    // Instrumental intensity and rate of immediate frequency changes
    // High intensity tracks with rapid frequency shifts scale up to MAX spotlights; calm tracks scale down to MIN
    const instActivity = features.instrumentalActivity ?? (features.stems.instruments * 0.7 + (features.highMid + features.treble) * 0.3);
    const freqChangeRate = features.onsetStrength || 0;
    const dynamicInstrumentScore = Math.min(1.0, (instActivity * 0.65) + (freqChangeRate * 0.35));

    const minSpotlights = 2;
    const maxSpotlights = this.perimeterBassLights.length; // 12 fixtures
    const activePerimeterSpotlightsCount = Math.max(
      minSpotlights,
      Math.min(maxSpotlights, Math.round(THREE.MathUtils.lerp(minSpotlights, maxSpotlights, dynamicInstrumentScore)))
    );

    for (let i = 0; i < this.perimeterBassLights.length; i++) {
      const pLight = this.perimeterBassLights[i];

      if (i >= activePerimeterSpotlightsCount) {
        (pLight.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (pLight.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // 360° Continuous orbital rotation angle modulated by bass
      const orbitAngle = this.perimeterRotationAngle + pLight.phaseOffset;
      const orbitRadiusX = 5.5 + bassFactor * 6.5;
      const orbitRadiusY = 3.8 + bassFactor * 5.0;

      const target = pLight.baseTarget.clone();

      if (pLight.side === 'left') {
        // Full 360° cone rotation sweeping across the stage & ceiling
        target.x += Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.cos(orbitAngle) * orbitRadiusY;
        target.z += Math.sin(orbitAngle * 1.5) * 5.0 + bassFactor * 4.0;
      } else if (pLight.side === 'right') {
        // Reverse 360° cone rotation symmetrically
        target.x -= Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.cos(orbitAngle) * orbitRadiusY;
        target.z += Math.sin(orbitAngle * 1.5) * 5.0 + bassFactor * 4.0;
      } else if (pLight.side === 'top') {
        // Top lights orbit in circular sweeps down across the stage
        target.x += Math.cos(orbitAngle) * orbitRadiusX;
        target.y += Math.sin(orbitAngle) * (orbitRadiusY * 0.7);
        target.z += Math.cos(orbitAngle * 2.0) * 4.0;
      } else {
        // Bottom lights sweep up into the arena
        target.x += Math.sin(orbitAngle) * orbitRadiusX;
        target.y += Math.abs(Math.cos(orbitAngle)) * orbitRadiusY + 1.0;
        target.z += Math.sin(orbitAngle) * 4.0;
      }

      if (deltaSeconds > 0) {
        pLight.currentTarget.lerp(target, deltaSeconds * (6.0 + bassFactor * 9.0));
      }
      pLight.group.lookAt(pLight.currentTarget);

      // Color from thumbnail palette
      const crossCol = colorPaletteArray[(i + 1) % colorPaletteArray.length];

      const pLensMat = pLight.lensMesh.material as THREE.MeshBasicMaterial;
      pLensMat.color.copy(crossCol);
      pLensMat.opacity = Math.min(0.98 * maxBri, (0.65 + bassFactor * 0.35) * maxBri);

      // Prominent, highly visible volumetric cone
      const pConeMat = pLight.coneMesh.material as THREE.MeshBasicMaterial;
      pConeMat.color.copy(crossCol);
      const bassBrightness = (0.16 + bassFactor * 0.32 * bassBeamMult) * maxBri;
      pConeMat.opacity = Math.min(0.48 * maxBri, bassBrightness);

      // Expand beam thickness with bass hits
      const beamExpansion = 1.0 + bassFactor * 0.45 * bassBeamMult;
      pLight.coneMesh.scale.set(beamExpansion, beamExpansion, 1.0);
    }

    // -------------------------------------------------------------
    // 3. Wash Lights (Tinted by Thumbnail Palette)
    // -------------------------------------------------------------
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.45 + bassStem * 0.55 * bassBeamMult) * maxBri);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.45 + instStem * 0.55 * bassBeamMult) * maxBri);
  }
}
