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
import { mapBpmToSpotlightCount } from '../../services/tempoService';
import { calculateStageDimensions, type StageDimensions } from '../stage/stageDimensions';

interface MovingHead {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  targetSlotPos: THREE.Vector3;
  side: 'top' | 'left' | 'right';
  activationFactor: number;
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

interface WhiteSkySpotlight {
  fixedBaseMesh: THREE.Mesh;
  headGroup: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  corner: 'left' | 'right';
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & 360° Perimeter Bass Beams';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // Colouring Spotlights: default count 3, mapped from BPM in [70, 160] with configurable limits
  private targetSpotlightCount = 3;
  private minSpotlightCount = 1;
  private maxSpotlightCount = 7;
  private autoBpmSpawning = true;
  private customSpotlightColors: THREE.Color[] = [];
  private currentDimensions: StageDimensions = calculateStageDimensions(
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080
  );

  private fixtures: MovingHead[] = [];
  private perimeterBassLights: PerimeterBassLight[] = [];
  private whiteSkySpotlights: WhiteSkySpotlight[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  // White Sky Spotlight audio-reactive state: turned ON by bass, blinks on kick hits
  private whiteSpotlightBassPresence = 0;
  private kickBlinkTimer = 0;

  // Internal time accumulation (freezes when deltaSeconds === 0)
  private internalTime = 0;
  private perimeterRotationAngle = 0;

  public setSpotlightCount(count: number): void {
    this.targetSpotlightCount = Math.max(1, Math.min(8, Math.round(count)));
  }

  public getSpotlightCount(): number {
    return this.targetSpotlightCount;
  }

  public setSpotlightLimits(min: number, max: number): void {
    this.minSpotlightCount = Math.max(1, Math.min(8, Math.round(min)));
    this.maxSpotlightCount = Math.max(this.minSpotlightCount, Math.min(8, Math.round(max)));
  }

  public setAutoBpmSpawning(enabled: boolean): void {
    this.autoBpmSpawning = enabled;
  }

  public setSpotlightColors(colors: string[]): void {
    if (colors && colors.length > 0) {
      this.customSpotlightColors = colors.map((hex) => new THREE.Color(hex));
    }
  }

  /**
   * Phase 4 & 10: Symmetrical spotlight mount positions around the YouTube stage screen (Top, Left, Right).
   * Generates perfectly balanced, non-clustered, bilateral layout relative to current player stage dimensions.
   */
  public static getSymmetricalSpotlightLayout(
    count: number,
    dims?: StageDimensions
  ): {
    pos: THREE.Vector3;
    side: 'top' | 'left' | 'right';
    defaultTarget: THREE.Vector3;
  }[] {
    const c = Math.max(1, Math.min(8, Math.round(count)));
    const layout: { pos: THREE.Vector3; side: 'top' | 'left' | 'right'; defaultTarget: THREE.Vector3 }[] = [];

    const d = dims || calculateStageDimensions(1920, 1080);
    const halfW = d.halfWidth;
    const halfH = d.halfHeight;
    const topY = d.topY + 1.25;
    const zPos = d.screenZ + 0.5;
    const leftX = d.leftX - 1.55;
    const rightX = d.rightX + 1.55;
    const midY = d.screenCenterY + 0.15 * halfH;
    const upperY = d.screenCenterY + 0.60 * halfH;
    const lowerY = d.screenCenterY - 0.25 * halfH;

    switch (c) {
      case 1:
        // 1 Top Center
        layout.push({
          pos: new THREE.Vector3(0.0, topY, zPos),
          side: 'top',
          defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0),
        });
        break;

      case 2:
        // 1 Left, 1 Right (flanking player symmetrically at vertical center)
        layout.push(
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 3:
        // 1 Top Center, 1 Left, 1 Right
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 4:
        // 2 Top, 1 Left, 1 Right
        layout.push(
          { pos: new THREE.Vector3(-0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 5:
        // 3 Top (Center at X = 0, Outer at ±0.60 * halfW), 1 Left, 1 Right
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 6:
        // 2 Top (±0.48 * halfW), 2 Left, 2 Right
        layout.push(
          { pos: new THREE.Vector3(-0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;

      case 7:
        // 3 Top (Center at X = 0, Outer at ±0.60 * halfW), 2 Left, 2 Right
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;

      case 8:
      default:
        // 4 Top (±0.30 * halfW, ±0.75 * halfW), 2 Left, 2 Right
        layout.push(
          { pos: new THREE.Vector3(-0.30 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-1.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.30 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(1.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.75 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-4.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.75 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(4.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.0, 2.5, 14.0) },
          { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', defaultTarget: new THREE.Vector3(4.5, 1.5, 14.0) },
          { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-4.5, 1.5, 14.0) }
        );
        break;
    }

    return layout;
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

    // 1. Colouring Spotlights (Instantiate 8 fixtures with symmetrical default layout)
    const baseLayout = StageLightsEffect.getSymmetricalSpotlightLayout(8, this.currentDimensions);

    for (let i = 0; i < baseLayout.length; i++) {
      const slot = baseLayout[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(slot.pos);

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

      fixtureGroup.lookAt(slot.defaultTarget);
      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: slot.pos.clone(),
        targetSlotPos: slot.pos.clone(),
        targetPos: slot.defaultTarget.clone(),
        currentTarget: slot.defaultTarget.clone(),
        side: slot.side,
        activationFactor: i < this.targetSpotlightCount ? 1.0 : 0.0,
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
        basePos: cfg.pos.clone(),
        baseTarget: cfg.target.clone(),
        currentTarget: cfg.target.clone(),
        side: cfg.side,
        phaseOffset: cfg.phaseOffset,
        index: i,
      });
    }

    // Align perimeter lights with current dimensions
    this.recalculatePerimeterPositions(this.currentDimensions);

    // 3. White Stage Sky Spotlights Flanking the Left & Right Corners of YouTube Screen
    // Shoots long, powerful white volumetric beams into the sky/zenith (never focusing downward)
    const skyConeLength = 55;
    const skyConeGeo = new THREE.ConeGeometry(2.4, skyConeLength, 18, 1, true);
    skyConeGeo.translate(0, -skyConeLength / 2, 0);
    skyConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(skyConeGeo);

    const whiteCorners: {
      corner: 'left' | 'right';
      pos: THREE.Vector3;
      defaultTarget: THREE.Vector3;
    }[] = [
      {
        corner: 'left',
        pos: new THREE.Vector3(
          this.currentDimensions.leftX - 0.45,
          this.currentDimensions.bottomY + 0.15,
          this.currentDimensions.screenZ + 0.55
        ),
        defaultTarget: new THREE.Vector3(
          this.currentDimensions.leftX - 3.0,
          Math.max(16.0, this.currentDimensions.topY + 6.0),
          14.0
        ),
      },
      {
        corner: 'right',
        pos: new THREE.Vector3(
          this.currentDimensions.rightX + 0.45,
          this.currentDimensions.bottomY + 0.15,
          this.currentDimensions.screenZ + 0.55
        ),
        defaultTarget: new THREE.Vector3(
          this.currentDimensions.rightX + 3.0,
          Math.max(16.0, this.currentDimensions.topY + 6.0),
          14.0
        ),
      },
    ];

    for (let i = 0; i < whiteCorners.length; i++) {
      const cfg = whiteCorners[i];

      // 1. Fixed Base Mount / Chassis: Added directly to this.group and strictly fixed in stage space (no translation/shake)
      const fixedBaseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixedBaseMesh.position.copy(cfg.pos);
      this.group.add(fixedBaseMesh);

      // 2. Optical Head Group: Anchored at cfg.pos with no offset, pivots purely in rotation around the stationary origin
      const headGroup = new THREE.Group();
      headGroup.position.copy(cfg.pos);

      // White Lens Flare Sphere (at optical center 0, 0, 0)
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0);
      headGroup.add(lensMesh);

      // High-intensity white volumetric beam cone projecting into the sky (apex at 0, 0, 0, DoubleSide for omnidirectional visibility)
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coneMat);
      const coneMesh = new THREE.Mesh(skyConeGeo, coneMat);
      coneMesh.position.set(0, 0, 0);
      headGroup.add(coneMesh);

      headGroup.lookAt(cfg.defaultTarget);
      this.group.add(headGroup);

      this.whiteSkySpotlights.push({
        fixedBaseMesh,
        headGroup,
        lensMesh,
        coneMesh,
        basePos: cfg.pos.clone(),
        targetPos: cfg.defaultTarget.clone(),
        currentTarget: cfg.defaultTarget.clone(),
        corner: cfg.corner,
      });
    }

    // 4. Dynamic Stage Wash Point Lights (Tinted by Thumbnail Palette)
    this.washLight1 = new THREE.PointLight(0xff6600, 0.6, 25, 1.8);
    this.washLight1.position.set(
      -0.45 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.6, 25, 1.8);
    this.washLight2.position.set(
      0.45 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight2);
  }

  public override resize(width: number, height: number): void {
    this.currentDimensions = calculateStageDimensions(width, height);
    this.recalculateSpotlightPositions(this.currentDimensions);
    this.recalculatePerimeterPositions(this.currentDimensions);
    this.recalculateWhiteSkySpotlightPositions(this.currentDimensions);
    if (this.washLight1 && this.washLight2) {
      this.washLight1.position.set(
        -0.45 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
      this.washLight2.position.set(
        0.45 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
    }
  }

  private recalculateWhiteSkySpotlightPositions(dims: StageDimensions): void {
    if (this.whiteSkySpotlights.length >= 2) {
      this.whiteSkySpotlights[0].basePos.set(
        dims.leftX - 0.45,
        dims.bottomY + 0.15,
        dims.screenZ + 0.55
      );
      this.whiteSkySpotlights[0].fixedBaseMesh.position.copy(this.whiteSkySpotlights[0].basePos);
      this.whiteSkySpotlights[0].headGroup.position.copy(this.whiteSkySpotlights[0].basePos);

      this.whiteSkySpotlights[1].basePos.set(
        dims.rightX + 0.45,
        dims.bottomY + 0.15,
        dims.screenZ + 0.55
      );
      this.whiteSkySpotlights[1].fixedBaseMesh.position.copy(this.whiteSkySpotlights[1].basePos);
      this.whiteSkySpotlights[1].headGroup.position.copy(this.whiteSkySpotlights[1].basePos);
    }
  }

  private recalculateSpotlightPositions(dims: StageDimensions): void {
    const layout = StageLightsEffect.getSymmetricalSpotlightLayout(this.targetSpotlightCount, dims);
    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];
      if (i < layout.length) {
        fix.targetSlotPos.copy(layout[i].pos);
        fix.side = layout[i].side;
        fix.targetPos.copy(layout[i].defaultTarget);
        fix.group.position.copy(layout[i].pos);
      }
    }
  }

  private recalculatePerimeterPositions(dims: StageDimensions): void {
    const configs: {
      pos: THREE.Vector3;
      target: THREE.Vector3;
      side: 'left' | 'right' | 'top' | 'bottom';
      phaseOffset: number;
    }[] = [
      // Left tower fixtures (aim across towards right & forward)
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.65 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.70 * dims.halfHeight, 12.0),
        side: 'left',
        phaseOffset: 0.0,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.20 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX, dims.screenCenterY - 0.20 * dims.halfHeight, 14.0),
        side: 'left',
        phaseOffset: 0.8,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.25 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 1.0, dims.screenCenterY + 0.20 * dims.halfHeight, 16.0),
        side: 'left',
        phaseOffset: 1.6,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.70 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 2.0, dims.screenCenterY + 0.55 * dims.halfHeight, 18.0),
        side: 'left',
        phaseOffset: 2.4,
      },

      // Right tower fixtures (aim across towards left & forward)
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.65 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.70 * dims.halfHeight, 12.0),
        side: 'right',
        phaseOffset: 3.2,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.20 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX, dims.screenCenterY - 0.20 * dims.halfHeight, 14.0),
        side: 'right',
        phaseOffset: 4.0,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY + 0.25 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX + 1.0, dims.screenCenterY + 0.20 * dims.halfHeight, 16.0),
        side: 'right',
        phaseOffset: 4.8,
      },
      {
        pos: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY + 0.70 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.leftX + 2.0, dims.screenCenterY + 0.55 * dims.halfHeight, 18.0),
        side: 'right',
        phaseOffset: 5.6,
      },

      // Top truss fixtures (sweep downward across the deck)
      {
        pos: new THREE.Vector3(-0.65 * dims.halfWidth, dims.topY + 0.6, dims.screenZ + 0.3),
        target: new THREE.Vector3(0.65 * dims.halfWidth, 0.8, 14.0),
        side: 'top',
        phaseOffset: 1.2,
      },
      {
        pos: new THREE.Vector3(0.65 * dims.halfWidth, dims.topY + 0.6, dims.screenZ + 0.3),
        target: new THREE.Vector3(-0.65 * dims.halfWidth, 0.8, 14.0),
        side: 'top',
        phaseOffset: 4.4,
      },

      // Bottom screen frame fixtures (cross upward into audience space)
      {
        pos: new THREE.Vector3(-0.70 * dims.halfWidth, dims.bottomY - 0.4, dims.screenZ + 0.4),
        target: new THREE.Vector3(0.70 * dims.halfWidth, 6.0, 15.0),
        side: 'bottom',
        phaseOffset: 2.0,
      },
      {
        pos: new THREE.Vector3(0.70 * dims.halfWidth, dims.bottomY - 0.4, dims.screenZ + 0.4),
        target: new THREE.Vector3(-0.70 * dims.halfWidth, 6.0, 15.0),
        side: 'bottom',
        phaseOffset: 5.2,
      },
    ];

    for (let i = 0; i < this.perimeterBassLights.length && i < configs.length; i++) {
      const p = this.perimeterBassLights[i];
      const cfg = configs[i];
      p.basePos.copy(cfg.pos);
      p.baseTarget.copy(cfg.target);
      p.group.position.copy(cfg.pos);
      p.side = cfg.side;
    }
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
      for (const s of this.whiteSkySpotlights) {
        (s.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (s.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
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

    // Spotlight tempo synchronization based on BPM provenance
    const bpmSource = features.bpmSource || 'unavailable';
    const bpmConfidence = features.bpmConfidence ?? (bpmSource === 'demucs' ? 0.85 : (bpmSource === 'manual' ? 1.0 : 0.0));
    const verifiedTempoSpeed = (bpmSource !== 'unavailable' && features.estimatedBpm > 0)
      ? Math.max(0.6, Math.min(1.8, features.estimatedBpm / 128.0))
      : 1.0;

    // Rhythmic pulse: locked on Demucs neural kick timestamps, zero when unavailable
    const beatPulse = (bpmSource !== 'unavailable')
      ? Math.sin(features.beatPhase * Math.PI) * (0.015 + bpmConfidence * 0.02)
      : 0.0;

    const rawBrightness = 0.07 + (bassStem * 0.09 * bassBeamMult) + beatPulse + (features.isDrop ? 0.05 : 0);
    const baseBrightness = Math.min(0.22 * maxBri, rawBrightness * maxBri);

    // -------------------------------------------------------------
    // 1. Colouring Spotlights (Symmetrical layout across Top, Left, Right based on BPM)
    // -------------------------------------------------------------
    // Auto BPM mapping: update count monotonically based on BPM across [70, 160] range
    if (routingConfig?.minSpotlightCount !== undefined) {
      this.minSpotlightCount = routingConfig.minSpotlightCount;
    }
    if (routingConfig?.maxSpotlightCount !== undefined) {
      this.maxSpotlightCount = routingConfig.maxSpotlightCount;
    }
    if (routingConfig?.autoBpmSpotlightSpawning !== undefined) {
      this.autoBpmSpawning = routingConfig.autoBpmSpotlightSpawning;
    }

    if (this.autoBpmSpawning && features.estimatedBpm && features.estimatedBpm > 0 && features.bpmSource !== 'unavailable') {
      const mappedCount = mapBpmToSpotlightCount(
        features.estimatedBpm,
        this.minSpotlightCount,
        this.maxSpotlightCount
      );
      if (mappedCount !== this.targetSpotlightCount) {
        this.targetSpotlightCount = mappedCount;
      }
    }

    const currentLayout = StageLightsEffect.getSymmetricalSpotlightLayout(
      this.targetSpotlightCount,
      this.currentDimensions
    );
    const activeCount = this.targetSpotlightCount;

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];
      const isActive = i < currentLayout.length;

      // Update target slot position and side if active
      if (isActive) {
        fix.targetSlotPos.copy(currentLayout[i].pos);
        fix.side = currentLayout[i].side;
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.min(1.0, fix.activationFactor + deltaSeconds * 3.5);
        } else {
          fix.activationFactor = 1.0;
        }
      } else {
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.max(0.0, fix.activationFactor - deltaSeconds * 3.0);
        } else {
          fix.activationFactor = 0.0;
        }
      }

      // Smooth mount position lerp
      if (deltaSeconds > 0) {
        fix.group.position.lerp(fix.targetSlotPos, deltaSeconds * 4.5);
      } else {
        fix.group.position.copy(fix.targetSlotPos);
      }

      // If fully deactivated, zero out opacities and skip lookAt/scale
      if (fix.activationFactor <= 0.001) {
        (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // Dynamic pan/tilt sweeps tailored to Top, Left, and Right mounts
      const offset = (i / Math.max(1, activeCount)) * Math.PI * 2;
      const sweepSpeed = (0.8 + instStem * 1.4) * verifiedTempoSpeed;

      if (fix.side === 'top') {
        if (features.isDrop) {
          const spreadX = fix.targetSlotPos.x * 0.6 + Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 8.0;
          const spreadY = 1.8 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 1.8;
          const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
          fix.targetPos.set(spreadX, spreadY, spreadZ);
        } else {
          const sweepX = fix.targetSlotPos.x * 0.5 + Math.sin(time * sweepSpeed + offset) * 6.5;
          const sweepY = 1.8 + Math.sin(time * 0.6 * verifiedTempoSpeed + offset * 0.5) * 1.4;
          const sweepZ = 13.5 + Math.cos(time * 0.5 + offset) * 2.2;
          fix.targetPos.set(sweepX, sweepY, sweepZ);
        }
      } else if (fix.side === 'left') {
        // Left tower: aims across towards right stage and forward into audience
        if (features.isDrop) {
          const spreadX = 2.5 + Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 6.0;
          const spreadY = 2.4 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 2.2;
          const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
          fix.targetPos.set(spreadX, spreadY, spreadZ);
        } else {
          const sweepX = 3.0 + Math.sin(time * sweepSpeed + offset) * 5.0;
          const sweepY = 2.5 + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 2.0;
          const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.2;
          fix.targetPos.set(sweepX, sweepY, sweepZ);
        }
      } else {
        // Right tower: mirrors left fixture symmetrically!
        if (features.isDrop) {
          const spreadX = -2.5 - Math.sin(time * (3.0 * verifiedTempoSpeed) + i * 1.2) * 6.0;
          const spreadY = 2.4 + Math.cos(time * (2.6 * verifiedTempoSpeed) + i * 0.8) * 2.2;
          const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
          fix.targetPos.set(spreadX, spreadY, spreadZ);
        } else {
          const sweepX = -3.0 - Math.sin(time * sweepSpeed + offset) * 5.0;
          const sweepY = 2.5 + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 2.0;
          const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.2;
          fix.targetPos.set(sweepX, sweepY, sweepZ);
        }
      }

      if (deltaSeconds > 0) {
        fix.currentTarget.lerp(fix.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      }
      fix.group.lookAt(fix.currentTarget);

      // Color from thumbnail extracted color gradient
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(0.95 * maxBri, baseBrightness * 4.2) * fix.activationFactor;

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = Math.min(0.22 * maxBri, baseBrightness) * fix.activationFactor;

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

      pLight.group.position.copy(pLight.basePos);

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
    // 3. White Stage Sky Spotlights (Flanking Left & Right Corners of Screen)
    // -------------------------------------------------------------
    // - Fixed Origins: Chassis (fixedBaseMesh) and Head (headGroup) origins are strictly stationary (no translation or audio shake).
    // - Beam Movement: Uses the same tempo/instrumental agility and drop logic as colouring spotlights.
    //   Strictly restricted to Left, Top (sky zenith), and Right — NEVER downward.
    // - Bass Presence: Turned ON when bass is present; turns OFF when bass is absent.
    // - Kick Blinking: Blinks in tight synchronization with kick/drum hits (strike flash -> shutter cut -> recovery).

    // 3a. Bass presence evaluation (Turns ON when bass > 0.04)
    const effectiveBass = Math.max(
      features.stems.bass,
      features.bass || 0,
      (features.subBass || 0) * 0.90
    );
    const targetBassPresence = effectiveBass > 0.04
      ? Math.min(1.0, (effectiveBass - 0.04) / 0.18)
      : 0.0;

    if (deltaSeconds > 0) {
      if (targetBassPresence > this.whiteSpotlightBassPresence) {
        // Fast, crisp attack when bass hits
        this.whiteSpotlightBassPresence += (targetBassPresence - this.whiteSpotlightBassPresence) * Math.min(1.0, deltaSeconds * 18.0);
      } else {
        // Smooth musical release when bass ceases
        this.whiteSpotlightBassPresence += (targetBassPresence - this.whiteSpotlightBassPresence) * Math.min(1.0, deltaSeconds * 5.0);
      }
    }

    // 3b. Kick drum hit detection and blink synchronization
    const kickDuration = 0.14; // 140ms concert blink cycle
    if (features.isKick || (features.stems.kick > 0.38 && this.kickBlinkTimer <= 0.03)) {
      this.kickBlinkTimer = kickDuration;
    }

    if (deltaSeconds > 0 && this.kickBlinkTimer > 0) {
      this.kickBlinkTimer = Math.max(0, this.kickBlinkTimer - deltaSeconds);
    }

    let blinkMultiplier = 1.0;
    if (this.kickBlinkTimer > 0) {
      const elapsedKick = kickDuration - this.kickBlinkTimer;
      if (elapsedKick < 0.035) {
        // Phase 1 (0-35ms): Instant kick impact strike flash (2.5x burst)
        blinkMultiplier = 2.5;
      } else if (elapsedKick < 0.075) {
        // Phase 2 (35-75ms): Sharp concert shutter blink cut (0.08x notch)
        blinkMultiplier = 0.08;
      } else {
        // Phase 3 (75-140ms): Smooth recovery back to steady bass illumination
        const recovery = (elapsedKick - 0.075) / (0.140 - 0.075);
        blinkMultiplier = 0.08 + 0.92 * recovery;
      }
    }

    const skyBaseY = Math.max(14.0, this.currentDimensions.topY + 5.0);
    const bassDrive = this.whiteSpotlightBassPresence;

    for (let i = 0; i < this.whiteSkySpotlights.length; i++) {
      const spot = this.whiteSkySpotlights[i];
      const isLeft = spot.corner === 'left';
      const offset = isLeft ? 0.0 : 0.65;
      const sweepSpeed = (0.8 + instStem * 1.4) * verifiedTempoSpeed;

      if (isLeft) {
        if (features.isDrop) {
          // Energetic wide crossing sky scissor sweeps during drops
          const spreadX = (this.currentDimensions.leftX * 0.3) + Math.sin(time * (3.0 * verifiedTempoSpeed)) * (this.currentDimensions.halfWidth + 5.5);
          const spreadY = skyBaseY + 3.0 + Math.cos(time * (2.6 * verifiedTempoSpeed)) * 4.0;
          const spreadZ = 14.0 + Math.sin(time * 2.0) * 3.0;
          spot.targetPos.set(spreadX, Math.max(this.currentDimensions.topY + 4.0, spreadY), spreadZ);
        } else {
          // Melodic/tempo-synced skyward sweeps panning from Left to Top/Zenith to Right
          const sweepX = (this.currentDimensions.leftX + 2.0) + Math.sin(time * sweepSpeed) * (this.currentDimensions.halfWidth + 4.5);
          const sweepY = skyBaseY + Math.cos(time * 0.7 * verifiedTempoSpeed) * 3.0;
          const sweepZ = 13.5 + Math.sin(time * 0.5) * 2.5;
          spot.targetPos.set(sweepX, Math.max(this.currentDimensions.topY + 4.0, sweepY), sweepZ);
        }
      } else {
        if (features.isDrop) {
          // Counter-crossing scissor sweep high across zenith
          const spreadX = (this.currentDimensions.rightX * 0.3) - Math.sin(time * (3.0 * verifiedTempoSpeed) + offset) * (this.currentDimensions.halfWidth + 5.5);
          const spreadY = skyBaseY + 3.0 + Math.cos(time * (2.6 * verifiedTempoSpeed) + offset) * 4.0;
          const spreadZ = 14.0 + Math.sin(time * 2.0 + offset) * 3.0;
          spot.targetPos.set(spreadX, Math.max(this.currentDimensions.topY + 4.0, spreadY), spreadZ);
        } else {
          const sweepX = (this.currentDimensions.rightX - 2.0) - Math.sin(time * sweepSpeed + offset) * (this.currentDimensions.halfWidth + 4.5);
          const sweepY = skyBaseY + Math.cos(time * 0.7 * verifiedTempoSpeed + offset) * 3.0;
          const sweepZ = 13.5 + Math.sin(time * 0.5 + offset) * 2.5;
          spot.targetPos.set(sweepX, Math.max(this.currentDimensions.topY + 4.0, sweepY), sweepZ);
        }
      }

      // Smooth pan/tilt tracking towards sky target (same agility scaling as colouring spotlights)
      if (deltaSeconds > 0) {
        spot.currentTarget.lerp(spot.targetPos, deltaSeconds * (4.0 + instStem * 5.0));
      }

      // Strictly fixed origins: Chassis and Optical Head positions NEVER translate or shake
      spot.fixedBaseMesh.position.copy(spot.basePos);
      spot.headGroup.position.copy(spot.basePos);
      spot.headGroup.lookAt(spot.currentTarget);

      const lensMat = spot.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = spot.coneMesh.material as THREE.MeshBasicMaterial;

      // Turn OFF completely when bass is absent
      if (bassDrive <= 0.005) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Pure white concert searchlight optics (activated by bass, blinking on kick drum hits)
      const rawLensOpacity = (0.88 + instStem * 0.16 + (features.isDrop ? 0.10 : 0)) * bassDrive;
      const rawConeOpacity = (0.36 + instStem * 0.20 + (features.isDrop ? 0.10 : 0)) * bassDrive;

      lensMat.opacity = Math.min(1.0, Math.min(0.99 * maxBri, rawLensOpacity * blinkMultiplier));
      coneMat.opacity = Math.min(0.90, Math.min(0.68 * maxBri, rawConeOpacity * blinkMultiplier));

      // Volumetric beam width expands subtly with bass & kick hits (origin remains 100% fixed)
      const skyBeamScale = (1.0 + bassFactor * 0.35 * bassBeamMult) * (this.kickBlinkTimer > 0 ? 1.15 : 1.0);
      spot.coneMesh.scale.set(skyBeamScale, skyBeamScale, 1.0);
    }

    // -------------------------------------------------------------
    // 4. Wash Lights (Tinted by Thumbnail Palette)
    // -------------------------------------------------------------
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.45 + bassStem * 0.55 * bassBeamMult) * maxBri);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.45 + instStem * 0.55 * bassBeamMult) * maxBri);
  }
}
