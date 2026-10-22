/**
 * Synwave Concert Moving-Head Stage Lights Effect
 *
 * Concert stage lighting rig with dynamic BPM spotlight spawning:
 *
 * ─── Colouring Spotlights ─────────────────────────────────────────────────────
 *   - Symmetrical spawning around YouTube screen dynamically mapped from track BPM.
 *   - Smooth mount position and activation lerping on spawn/despawn.
 *   - Static stage aiming at default targets (no audio-driven movement).
 *
 * ─── Perimeter Lights & White Sky Spotlights ──────────────────────────────────
 *   - Static stage perimeter fixtures framing the arena.
 *   - Static upward white sky beams at bottom corners of YouTube screen.
 *   - Audio manipulation of spotlight movements removed.
 *
 * ─── General ──────────────────────────────────────────────────────────────────
 *   - Freeze support: when playback is paused (deltaSeconds === 0), all lights
 *     freeze in place with zero animation drift.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';
import { mapBpmToSpotlightCount } from '../../services/tempoService';
import { calculateStageDimensions, type StageDimensions } from '../stage/stageDimensions';

// ─── Interfaces ────────────────────────────────────────────────────────────────

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

// ─── Class ────────────────────────────────────────────────────────────────────

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & 360° Perimeter Bass Beams';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // ── Spotlight configuration ─────────────────────────────────────────────────
  private targetSpotlightCount = 3;
  private minSpotlightCount = 1;
  private maxSpotlightCount = 7;
  private autoBpmSpawning = true;
  private customSpotlightColors: THREE.Color[] = [];
  private currentDimensions: StageDimensions = calculateStageDimensions(
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080
  );

  // ── Three.js scene objects ──────────────────────────────────────────────────
  private fixtures: MovingHead[] = [];
  private perimeterBassLights: PerimeterBassLight[] = [];
  private whiteSkySpotlights: WhiteSkySpotlight[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  // ── Frequency pre-analysis & audio-reactive spotlight state ─────────────────
  private isSpotlightsTurnedOn: boolean = false;
  private currentMovementAngle: number = 0; // radians
  private currentGlowingFactor: number = 0; // 0.0 to 1.0 continuous
  private smoothTurnOnFactor: number = 0;   // 0.0 to 1.0 smooth fade

  // ── Kick trigger & intense white flash state ─────────────────────────────────
  private leftKickOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private rightKickOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private topKickOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private kickImpulseTime: number = 0;
  private whiteKickIntensity: number = 1.0;
  private wasKickTriggered: boolean = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  public setSpotlightCount(count: number): void {
    this.targetSpotlightCount = Math.max(1, Math.min(8, Math.round(count)));
  }

  public getSpotlightCount(): number {
    return this.targetSpotlightCount;
  }

  public getIsSpotlightsTurnedOn(): boolean {
    return this.isSpotlightsTurnedOn;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Symmetrical Spotlight Layout
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Phase 4 & 10: Symmetrical spotlight mount positions around the YouTube stage
   * screen (Top, Left, Right). Generates a perfectly balanced, non-clustered,
   * bilateral layout relative to current player stage dimensions.
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
    const halfW   = d.halfWidth;
    const halfH   = d.halfHeight;
    const topY    = d.topY + 1.25;
    const zPos    = d.screenZ + 0.5;
    const leftX   = d.leftX - 1.55;
    const rightX  = d.rightX + 1.55;
    const midY    = d.screenCenterY + 0.15 * halfH;
    const upperY  = d.screenCenterY + 0.60 * halfH;
    const lowerY  = d.screenCenterY - 0.25 * halfH;

    switch (c) {
      case 1:
        layout.push({
          pos: new THREE.Vector3(0.0, topY, zPos),
          side: 'top',
          defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0),
        });
        break;

      case 2:
        layout.push(
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 3:
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 4:
        layout.push(
          { pos: new THREE.Vector3(-0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.48 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(2.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 5:
        layout.push(
          { pos: new THREE.Vector3(0.0, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(0.0, 1.8, 14.0) },
          { pos: new THREE.Vector3(-0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(-3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(0.60 * halfW, topY, zPos), side: 'top', defaultTarget: new THREE.Vector3(3.5, 1.8, 14.0) },
          { pos: new THREE.Vector3(leftX, midY, zPos), side: 'left', defaultTarget: new THREE.Vector3(3.5, 2.0, 14.0) },
          { pos: new THREE.Vector3(rightX, midY, zPos), side: 'right', defaultTarget: new THREE.Vector3(-3.5, 2.0, 14.0) }
        );
        break;

      case 6:
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────

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

    // 1. Colouring Spotlights (8 fixtures with symmetrical default layout)
    const baseLayout = StageLightsEffect.getSymmetricalSpotlightLayout(8, this.currentDimensions);

    for (let i = 0; i < baseLayout.length; i++) {
      const slot = baseLayout[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(slot.pos);

      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixtureGroup.add(baseMesh);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

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
      // Left tower fixtures
      { pos: new THREE.Vector3(-12.0, 2.2, -4.1), target: new THREE.Vector3(12.0, 2.0, 12.0), side: 'left', phaseOffset: 0.0 },
      { pos: new THREE.Vector3(-12.0, 4.6, -4.1), target: new THREE.Vector3(11.0, 3.8, 14.0), side: 'left', phaseOffset: 0.8 },
      { pos: new THREE.Vector3(-12.0, 7.0, -4.1), target: new THREE.Vector3(10.0, 5.5, 16.0), side: 'left', phaseOffset: 1.6 },
      { pos: new THREE.Vector3(-12.0, 9.4, -4.1), target: new THREE.Vector3(9.0, 7.0, 18.0), side: 'left', phaseOffset: 2.4 },
      // Right tower fixtures
      { pos: new THREE.Vector3(12.0, 2.2, -4.1), target: new THREE.Vector3(-12.0, 2.0, 12.0), side: 'right', phaseOffset: 3.2 },
      { pos: new THREE.Vector3(12.0, 4.6, -4.1), target: new THREE.Vector3(-11.0, 3.8, 14.0), side: 'right', phaseOffset: 4.0 },
      { pos: new THREE.Vector3(12.0, 7.0, -4.1), target: new THREE.Vector3(-10.0, 5.5, 16.0), side: 'right', phaseOffset: 4.8 },
      { pos: new THREE.Vector3(12.0, 9.4, -4.1), target: new THREE.Vector3(-9.0, 7.0, 18.0), side: 'right', phaseOffset: 5.6 },
      // Top truss fixtures
      { pos: new THREE.Vector3(-6.5, 11.4, -4.2), target: new THREE.Vector3(7.5, 0.8, 14.0), side: 'top', phaseOffset: 1.2 },
      { pos: new THREE.Vector3(6.5, 11.4, -4.2), target: new THREE.Vector3(-7.5, 0.8, 14.0), side: 'top', phaseOffset: 4.4 },
      // Bottom screen frame fixtures
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

    // 3. White Stage Sky Spotlights at Bottom Corners of YouTube Screen
    // Strictly project upward (never downward)
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

      // Fixed base chassis
      const fixedBaseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixedBaseMesh.position.copy(cfg.pos);
      this.group.add(fixedBaseMesh);

      // Optical head group
      const headGroup = new THREE.Group();
      headGroup.position.copy(cfg.pos);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0);
      headGroup.add(lensMesh);

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

    // 4. Dynamic Stage Wash Point Lights
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Resize
  // ─────────────────────────────────────────────────────────────────────────────

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
      // Left tower fixtures
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.65 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX + 1.2, dims.screenCenterY - 0.70 * dims.halfHeight, 12.0),
        side: 'left', phaseOffset: 0.0,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY - 0.20 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX, dims.screenCenterY - 0.20 * dims.halfHeight, 14.0),
        side: 'left', phaseOffset: 0.8,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.25 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 1.0, dims.screenCenterY + 0.20 * dims.halfHeight, 16.0),
        side: 'left', phaseOffset: 1.6,
      },
      {
        pos: new THREE.Vector3(dims.leftX - 1.2, dims.screenCenterY + 0.70 * dims.halfHeight, dims.screenZ + 0.4),
        target: new THREE.Vector3(dims.rightX - 2.0, dims.screenCenterY + 0.55 * dims.halfHeight, 18.0),
        side: 'left', phaseOffset: 2.4,
      },
      // Right tower fixtures
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
      // Top truss fixtures
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
      // Bottom screen frame fixtures
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Update Loop
  // ─────────────────────────────────────────────────────────────────────────────

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;

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

    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;

    // ─── Colour palette ──────────────────────────────────────────────────────
    const hasCustomColors   = this.customSpotlightColors.length > 0;
    const primaryCol        = hasCustomColors ? this.customSpotlightColors[0] : new THREE.Color(palette.primary);
    const secondaryCol      = hasCustomColors
      ? (this.customSpotlightColors[1] || this.customSpotlightColors[0])
      : new THREE.Color(palette.secondary);
    const accentCol         = hasCustomColors
      ? (this.customSpotlightColors[2] || this.customSpotlightColors[0])
      : new THREE.Color(palette.accent || palette.primary);
    const colorPaletteArray = hasCustomColors
      ? this.customSpotlightColors
      : [primaryCol, secondaryCol, accentCol];

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. FREQUENCY PRE-ANALYSIS EVALUATION & AUDIO-REACTIVE TRACKING
    // ═══════════════════════════════════════════════════════════════════════════

    // Auto BPM-based spotlight count mapping (preserves dynamic spawning)
    if (routingConfig?.minSpotlightCount !== undefined) this.minSpotlightCount = routingConfig.minSpotlightCount;
    if (routingConfig?.maxSpotlightCount !== undefined) this.maxSpotlightCount = routingConfig.maxSpotlightCount;
    if (routingConfig?.autoBpmSpotlightSpawning !== undefined) this.autoBpmSpawning = routingConfig.autoBpmSpotlightSpawning;

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

    // Retrieve pre-analyzed frequency movement data from Demucs stem pre-analysis
    const spotlightAnalysis = context.spotlightAnalysis || context.demucsStems?.spotlightAnalysis;
    let targetThetaRad = 0;
    let targetGlowFactor = 0.5;
    let isTurnedOn = false;

    if (spotlightAnalysis && spotlightAnalysis.frameCount > 0 && spotlightAnalysis.timestampsMs?.length > 0) {
      const fps = spotlightAnalysis.fps || 25;
      const t = Math.max(0, context.trackTimeSeconds);
      const exactFrame = t * fps;
      const frameIdx = Math.min(spotlightAnalysis.frameCount - 1, Math.floor(exactFrame));
      const nextIdx = Math.min(spotlightAnalysis.frameCount - 1, frameIdx + 1);
      const frac = exactFrame - frameIdx;

      // 360° frequency movement distribution (remember 1)
      const degA = spotlightAnalysis.movementAnglesDeg[frameIdx] ?? 0;
      const degB = spotlightAnalysis.movementAnglesDeg[nextIdx] ?? degA;
      let dDeg = degB - degA;
      if (dDeg > 180) dDeg -= 360;
      if (dDeg < -180) dDeg += 360;
      const interpDeg = (degA + dDeg * frac + 360) % 360;
      targetThetaRad = (interpDeg * Math.PI) / 180.0;

      // Continuous glowing factor (0.0 to 1.0) based on Bass STEM min/max
      const glowA = spotlightAnalysis.glowingFactors[frameIdx] ?? 0.5;
      const glowB = spotlightAnalysis.glowingFactors[nextIdx] ?? glowA;
      targetGlowFactor = Math.max(0.0, Math.min(1.0, glowA + (glowB - glowA) * frac));

      // Simultaneous dual-stem average crossing state:
      // Turn ON when both Instrument and Bass frequencies cross and rise above average at the same time.
      // Turn OFF before that, and turn OFF if both go below average together.
      isTurnedOn = spotlightAnalysis.spotlightsActive[frameIdx] ?? false;
    } else {
      // Graceful real-time DSP fallback if pre-analysis is still generating
      const instSig = Math.max(features.highMid * 0.4 + features.treble * 0.6, features.stems?.instruments ?? 0);
      const bassSig = Math.max(features.bass * 0.7 + features.subBass * 0.3, features.stems?.bass ?? 0);
      targetThetaRad = ((instSig * 360.0) * Math.PI) / 180.0;
      targetGlowFactor = Math.max(0.0, Math.min(1.0, bassSig));
      isTurnedOn = instSig > 0.28 && bassSig > 0.28;
    }

    this.isSpotlightsTurnedOn = isTurnedOn;

    // ── Kick Transient Detection from Kick STEM ────────────────────────────────
    const kickPower = Math.max(
      features.stems?.kick ?? 0,
      features.isKick ? (features.kickIntensity || 1.0) : 0
    );
    const isKickOnset = (features.isKick || kickPower > 0.36) && !this.wasKickTriggered;
    this.wasKickTriggered = features.isKick || kickPower > 0.36;

    if (isKickOnset && deltaSeconds > 0) {
      // If Kick/drum hits from Kick STEM, all spotlight light beams take a random position
      const randAngle = Math.random() * Math.PI * 2;
      const randDist = 4.2 + Math.random() * 3.8;
      const randElev = (Math.random() - 0.5) * 3.2;

      const kX = Math.cos(randAngle) * randDist;
      const kY = randElev;
      const kZ = Math.sin(randAngle) * randDist;

      // Spotlights at left side will be in sync together
      this.leftKickOffset.set(kX, kY, kZ);

      // Spotlights at right side will be in sync together, opposite movement angles to left
      this.rightKickOffset.set(-kX, kY, -kZ);

      // Spotlights at top side will be in sync together
      const topAngle = Math.random() * Math.PI * 2;
      const topDist = 3.8 + Math.random() * 3.0;
      this.topKickOffset.set(
        Math.cos(topAngle) * topDist,
        -1.2 - Math.random() * 2.2,
        Math.sin(topAngle) * topDist
      );

      this.kickImpulseTime = 1.0;

      // The 2 white spotlights at bottom: Kick will make those 2 spotlights glow intensely
      this.whiteKickIntensity = Math.min(2.8, 1.0 + 1.8 * Math.max(kickPower, 0.65));
    }

    // Dynamic interpolation & continuous updates (strictly zero drift when paused)
    if (deltaSeconds > 0) {
      this.kickImpulseTime = Math.max(0.0, this.kickImpulseTime - deltaSeconds * 3.2);
      this.whiteKickIntensity = Math.max(1.0, this.whiteKickIntensity - deltaSeconds * 5.8);

      // Continuous movement angle and glowing factor lerping
      this.currentMovementAngle += (targetThetaRad - this.currentMovementAngle) * Math.min(1.0, deltaSeconds * 12.0);
      this.currentGlowingFactor += (targetGlowFactor - this.currentGlowingFactor) * Math.min(1.0, deltaSeconds * 14.0);

      // Smooth attack/release for simultaneous dual-stem average crossing activation
      if (isTurnedOn) {
        this.smoothTurnOnFactor = Math.min(1.0, this.smoothTurnOnFactor + deltaSeconds * 9.0);
      } else {
        this.smoothTurnOnFactor = Math.max(0.0, this.smoothTurnOnFactor - deltaSeconds * 6.0);
      }
    }

    // Effective continuous glowing factor (0.0 to 1.0) scaled by activation
    const effectiveGlow = this.currentGlowingFactor * this.smoothTurnOnFactor;

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. COLOURING SPOTLIGHTS (360° Movement, Opposite Right, Kick Sync)
    // ═══════════════════════════════════════════════════════════════════════════
    const thetaRad = this.currentMovementAngle;
    const radiusX = 4.2;
    const radiusY = 2.6;
    const radiusZ = 3.6;

    // Left side: in sync together with thetaRad across 360 degrees
    const leftOffsetX = radiusX * Math.cos(thetaRad);
    const leftOffsetY = radiusY * Math.sin(thetaRad);
    const leftOffsetZ = radiusZ * Math.sin(2.0 * thetaRad);

    // Right side: in sync together, movement angles opposite to left (-thetaRad)
    const rightOffsetX = radiusX * Math.cos(-thetaRad);
    const rightOffsetY = radiusY * Math.sin(-thetaRad);
    const rightOffsetZ = radiusZ * Math.sin(-2.0 * thetaRad);

    // Top side: in sync together across 360 degrees
    const topRadiusX = 4.6;
    const topRadiusY = 2.0;
    const topRadiusZ = 3.0;
    const topOffsetX = topRadiusX * Math.sin(thetaRad);
    const topOffsetY = topRadiusY * Math.cos(thetaRad);
    const topOffsetZ = topRadiusZ * Math.cos(2.0 * thetaRad);

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];
      const isActive = i < currentLayout.length;

      // Activation factor lerping (smooth appearance/disappearance on dynamic BPM count change)
      if (isActive) {
        const slot = currentLayout[i];
        fix.targetSlotPos.copy(slot.pos);
        fix.side = slot.side;
        fix.targetPos.copy(slot.defaultTarget);
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

      // Smooth mount position lerp to target slot
      if (deltaSeconds > 0) {
        fix.group.position.lerp(fix.targetSlotPos, deltaSeconds * 4.5);
      } else {
        fix.group.position.copy(fix.targetSlotPos);
      }

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;

      // Fully turned OFF when slot deactivated OR dual-stem average frequency condition not met
      if (fix.activationFactor <= 0.001 || this.smoothTurnOnFactor <= 0.001) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Target aiming with 360° frequency movement & synced Kick jumps
      if (isActive) {
        const slot = currentLayout[i];
        if (fix.side === 'left') {
          // Left side spotlights in sync together
          const targetX = slot.defaultTarget.x + leftOffsetX + this.leftKickOffset.x * this.kickImpulseTime;
          const targetY = slot.defaultTarget.y + leftOffsetY + this.leftKickOffset.y * this.kickImpulseTime;
          const targetZ = slot.defaultTarget.z + leftOffsetZ + this.leftKickOffset.z * this.kickImpulseTime;
          fix.targetPos.set(targetX, targetY, targetZ);
        } else if (fix.side === 'right') {
          // Right side spotlights in sync together, opposite movement angles to left
          const targetX = slot.defaultTarget.x + rightOffsetX + this.rightKickOffset.x * this.kickImpulseTime;
          const targetY = slot.defaultTarget.y + rightOffsetY + this.rightKickOffset.y * this.kickImpulseTime;
          const targetZ = slot.defaultTarget.z + rightOffsetZ + this.rightKickOffset.z * this.kickImpulseTime;
          fix.targetPos.set(targetX, targetY, targetZ);
        } else {
          // Top side spotlights in sync together
          const targetX = slot.defaultTarget.x + topOffsetX + this.topKickOffset.x * this.kickImpulseTime;
          const targetY = slot.defaultTarget.y + topOffsetY + this.topKickOffset.y * this.kickImpulseTime;
          const targetZ = slot.defaultTarget.z + topOffsetZ + this.topKickOffset.z * this.kickImpulseTime;
          fix.targetPos.set(targetX, targetY, targetZ);
        }
      }

      if (deltaSeconds > 0) {
        fix.currentTarget.lerp(fix.targetPos, Math.min(1.0, deltaSeconds * 9.5));
      }
      fix.group.lookAt(fix.currentTarget);

      // Colors & continuous glowing intensity factor (0.0 to 1.0) based on Bass STEM
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];
      lensMat.color.copy(lightCol);
      coneMat.color.copy(lightCol);

      const glow = effectiveGlow * fix.activationFactor;
      lensMat.opacity = Math.min(0.98, 0.88 * maxBri * glow);
      coneMat.opacity = Math.min(0.35, 0.22 * maxBri * glow);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PERIMETER LIGHTS (360° Coordinated Sweeps)
    // ═══════════════════════════════════════════════════════════════════════════
    for (let i = 0; i < this.perimeterBassLights.length; i++) {
      const pLight = this.perimeterBassLights[i];
      const pLensMat = pLight.lensMesh.material as THREE.MeshBasicMaterial;
      const pConeMat = pLight.coneMesh.material as THREE.MeshBasicMaterial;

      if (this.smoothTurnOnFactor <= 0.001) {
        pLensMat.opacity = 0;
        pConeMat.opacity = 0;
        continue;
      }

      pLight.group.position.copy(pLight.basePos);
      const isRight = pLight.side === 'right';
      const sideAngle = isRight ? -thetaRad : thetaRad;

      const sweepOffsetX = Math.cos(sideAngle + pLight.phaseOffset) * 2.8;
      const sweepOffsetY = Math.sin(sideAngle + pLight.phaseOffset) * 1.8;
      const sweepOffsetZ = Math.sin((sideAngle + pLight.phaseOffset) * 2.0) * 2.4;

      const pTargetX = pLight.baseTarget.x + sweepOffsetX;
      const pTargetY = pLight.baseTarget.y + sweepOffsetY;
      const pTargetZ = pLight.baseTarget.z + sweepOffsetZ;
      pLight.currentTarget.set(pTargetX, pTargetY, pTargetZ);

      pLight.group.lookAt(pLight.currentTarget);

      const crossCol = colorPaletteArray[(i + 1) % colorPaletteArray.length];
      pLensMat.color.copy(crossCol);
      pConeMat.color.copy(crossCol);

      pLensMat.opacity = Math.min(0.95, 0.72 * maxBri * effectiveGlow);
      pConeMat.opacity = Math.min(0.30, 0.16 * maxBri * effectiveGlow);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. WHITE SKY SPOTLIGHTS (Bottom Corners, 360° Sweeps, Intense Kick Glow)
    // ═══════════════════════════════════════════════════════════════════════════
    const skyBaseY = Math.max(16.0, this.currentDimensions.topY + 6.0);
    const minTargetY = this.currentDimensions.topY + 4.5;
    const skyRadiusX = 4.2;
    const skyRadiusZ = 3.8;

    for (let i = 0; i < this.whiteSkySpotlights.length; i++) {
      const spot = this.whiteSkySpotlights[i];
      const isLeft = spot.corner === 'left';
      const lensMat = spot.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = spot.coneMesh.material as THREE.MeshBasicMaterial;

      // Turn OFF if dual-stem frequency condition not met
      if (this.smoothTurnOnFactor <= 0.001) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Left follows left angle (thetaRad), Right follows opposite angle (-thetaRad)
      const cornerAngle = isLeft ? thetaRad : -thetaRad;
      const baseCornerX = isLeft
        ? this.currentDimensions.leftX - 3.0
        : this.currentDimensions.rightX + 3.0;

      // 360 degree upward sky orbit (strictly projecting upward)
      const sweepX = baseCornerX + Math.cos(cornerAngle) * skyRadiusX;
      const sweepZ = 14.0 + Math.sin(cornerAngle) * skyRadiusZ;
      const sweepY = skyBaseY + Math.sin(2.0 * cornerAngle) * 2.5;

      spot.targetPos.set(sweepX, Math.max(minTargetY, sweepY), sweepZ);

      if (deltaSeconds > 0) {
        spot.currentTarget.lerp(spot.targetPos, Math.min(1.0, deltaSeconds * 9.5));
      }
      spot.currentTarget.y = Math.max(minTargetY, spot.currentTarget.y);

      spot.fixedBaseMesh.position.copy(spot.basePos);
      spot.headGroup.position.copy(spot.basePos);
      spot.headGroup.lookAt(spot.currentTarget);

      // The Kick makes these 2 bottom white spotlights glow intensely when kick hits!
      const whiteGlow = effectiveGlow * this.whiteKickIntensity;

      lensMat.opacity = Math.min(1.0, 0.90 * maxBri * whiteGlow);
      coneMat.opacity = Math.min(0.85, 0.28 * maxBri * whiteGlow);

      // Beam flare expansion on intense kick glow
      const kickScale = 1.0 + (this.whiteKickIntensity - 1.0) * 0.20;
      spot.coneMesh.scale.set(kickScale, kickScale, 1.0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. WASH LIGHTS (Dynamic Stage Ambient Illumination)
    // ═══════════════════════════════════════════════════════════════════════════
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.35 + 0.55 * effectiveGlow) * maxBri);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.35 + 0.55 * effectiveGlow) * maxBri);
  }
}
