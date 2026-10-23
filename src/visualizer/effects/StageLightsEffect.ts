/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * ===============================================
 *
 * Concert stage lighting rig with music-synchronized full-screen movement:
 *
 * 1. Stationary Fixtures & Attachment Layer:
 *    - All spotlight chassis, mounting bases, and attachment origins remain strictly
 *      FIXED at designated physical stage positions throughout playback.
 *    - Zero physical lerping or translation of fixture origins during audio playback.
 *    - Activation state (verse/solo sections) controls beam and lens opacity smoothly.
 *
 * 2. Full-Screen Trajectories & Synchronized Groups:
 *    - Coordinated full-screen movement paths powered by SpotlightMovementController:
 *      horizontal sweeps, vertical sweeps, perimeter, diagonal, arc-fan, asymmetric,
 *      elliptical, and slow-cinematic paths traversing the entire viewport outside the iframe.
 *    - All Left-side spotlights move in synchronization with each other.
 *    - All Right-side spotlights move in synchronization with opposite angular reference (-theta)
 *      and spatial elevation offsets, avoiding repetitive central "X" criss-crossing.
 *    - All Top-side spotlights move in synchronization along the overhead truss.
 *    - Two White Bottom Spotlights project skyward searchlights across the viewport.
 *      They NEVER change beam direction on kick events.
 *
 * 3. Kick Transient Synchronization:
 *    - Main coloured spotlights smoothly deflect to deterministic target directions on kicks during verses/solos.
 *    - Two white bottom spotlights surge in glow intensity only on kicks, then decay smoothly.
 *    - Outside verses and solos, kick events do NOT reactivate spotlights.
 *
 * 4. Continuous Frequency-Driven Glow:
 *    - Continuous Bass STEM frequency drives silky-smooth glow intensity across [0.0, 1.0].
 *    - Blended with base glow, kick glow envelope, and verse/solo activation fades.
 *
 * 5. Media Clock Synchronization:
 *    - Synchronized with authoritative media clock.
 *    - Immediate state restoration on seek without replaying stale impulses.
 *    - Freeze in place on pause (deltaSeconds === 0).
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';
import { mapBpmToSpotlightCount } from '../../services/tempoService';
import { calculateStageDimensions, type StageDimensions } from '../stage/stageDimensions';
import {
  SpotlightMovementController,
  type SpotlightTargetCoordinates,
} from './SpotlightMovementController';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface MovingHead {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentTarget: THREE.Vector3;
  side: 'top' | 'left' | 'right';
  activationFactor: number;
  index: number;
  // Spatial offset relative to group target for cohesive array spread
  offsetVector: THREE.Vector3;
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
  readonly name = 'Concert Moving Head Lights & Coordinated Full-Screen Beams';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  // ── Spotlight configuration ─────────────────────────────────────────────────
  private targetSpotlightCount = 10;
  private minSpotlightCount = 1;
  private maxSpotlightCount = 10;
  private autoBpmSpawning = true;
  private customSpotlightColors: THREE.Color[] = [];
  private currentDimensions: StageDimensions = calculateStageDimensions(
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080
  );

  // ── Three.js scene objects ──────────────────────────────────────────────────
  private fixtures: MovingHead[] = [];
  private whiteSkySpotlights: WhiteSkySpotlight[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

  // ── Coordinated Movement Controller ─────────────────────────────────────────
  private movementController = new SpotlightMovementController();

  // ── Audio-reactive spotlight state ──────────────────────────────────────────
  private isSpotlightsTurnedOn: boolean = false;
  private currentMovementAngle: number = 0; // radians
  private currentGlowingFactor: number = 0.5; // 0.0 to 1.0 continuous
  private smoothTurnOnFactor: number = 0; // 0.0 to 1.0 smooth fade for primary coloured lights
  private whitePlaybackFactor: number = 0; // 0.0 before playback, 1.0 once playback starts
  private lastTrackTimeSeconds: number = -1.0;

  // ── White spotlight kick-glow impulse ───────────────────────────────────────
  private whiteKickIntensity: number = 1.0;
  private wasKickTriggered: boolean = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  public setSpotlightCount(count: number): void {
    this.targetSpotlightCount = Math.max(1, Math.min(10, Math.round(count)));
  }

  public getSpotlightCount(): number {
    return this.targetSpotlightCount;
  }

  public getIsSpotlightsTurnedOn(): boolean {
    return this.isSpotlightsTurnedOn;
  }

  public setSpotlightLimits(min: number, max: number): void {
    this.minSpotlightCount = Math.max(1, Math.min(10, Math.round(min)));
    this.maxSpotlightCount = Math.max(this.minSpotlightCount, Math.min(10, Math.round(max)));
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
   * Complete reset of lighting playback state when switching videos or returning to initial state.
   */
  public resetPlaybackState(): void {
    this.isSpotlightsTurnedOn = false;
    this.smoothTurnOnFactor = 0.0;
    this.whitePlaybackFactor = 0.0;
    this.currentMovementAngle = 0.0;
    this.currentGlowingFactor = 0.0;
    this.whiteKickIntensity = 1.0;
    this.wasKickTriggered = false;
    this.lastTrackTimeSeconds = -1.0;
    this.turnOffAllLights();
    for (const fix of this.fixtures) {
      fix.activationFactor = 0.0;
    }
  }

  /**
   * Symmetrical fixture index selection based on musical energy / spotlight count.
   * - High Energy (10 lights): 4 Top (0, 1, 2, 3), 3 Left (4, 5, 6), 3 Right (7, 8, 9).
   * - Smooth / Low Energy (4 lights): 2 Top (inner pair 1 & 2 around iframe center), 1 Left (5), 1 Right (8).
   */
  public static getSymmetricalIndices(count: number): number[] {
    if (count >= 10) {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
    if (count >= 8) {
      return [0, 1, 2, 3, 4, 6, 7, 9];
    }
    if (count >= 6) {
      return [1, 2, 4, 6, 7, 9];
    }
    // Default smooth / low-energy configuration: 4 primary spotlights
    return [1, 2, 5, 8];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Symmetrical Spotlight Mount Layout (Fixed Origins)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates fixed, stationary mounting coordinates for the 10 concert fixtures
   * positioned symmetrically around the YouTube iframe:
   * - Top: 4 spotlights along the overhead truss
   * - Left: 3 spotlights along the left vertical tower (upper, middle, lower)
   * - Right: 3 spotlights along the right vertical tower (upper, middle, lower)
   */
  public static getStationarySpotlightLayout(
    dims?: StageDimensions
  ): {
    pos: THREE.Vector3;
    side: 'top' | 'left' | 'right';
    offsetVector: THREE.Vector3;
  }[] {
    const layout: { pos: THREE.Vector3; side: 'top' | 'left' | 'right'; offsetVector: THREE.Vector3 }[] = [];

    const d = dims || calculateStageDimensions(1920, 1080);
    const halfW   = d.halfWidth;
    const halfH   = d.halfHeight;
    const topY    = d.topY + 1.25;
    const zPos    = d.screenZ + 0.5;
    const leftX   = d.leftX - 1.55;
    const rightX  = d.rightX + 1.55;
    const upperY  = d.screenCenterY + 0.65 * halfH;
    const middleY = d.screenCenterY;
    const lowerY  = d.screenCenterY - 0.65 * halfH;

    // Top fixtures (0, 1, 2, 3) - 4 spotlights along overhead truss
    layout.push(
      { pos: new THREE.Vector3(-0.65 * halfW, topY, zPos), side: 'top', offsetVector: new THREE.Vector3(-3.0, 0, 0) },
      { pos: new THREE.Vector3(-0.22 * halfW, topY, zPos), side: 'top', offsetVector: new THREE.Vector3(-1.0, 0, 0) },
      { pos: new THREE.Vector3(0.22 * halfW, topY, zPos), side: 'top', offsetVector: new THREE.Vector3(1.0, 0, 0) },
      { pos: new THREE.Vector3(0.65 * halfW, topY, zPos), side: 'top', offsetVector: new THREE.Vector3(3.0, 0, 0) }
    );

    // Left fixtures (4, 5, 6) - 3 spotlights along left vertical tower
    layout.push(
      { pos: new THREE.Vector3(leftX, upperY, zPos), side: 'left', offsetVector: new THREE.Vector3(-1.0, 2.0, 0) },
      { pos: new THREE.Vector3(leftX, middleY, zPos), side: 'left', offsetVector: new THREE.Vector3(-1.0, 0.0, 0) },
      { pos: new THREE.Vector3(leftX, lowerY, zPos), side: 'left', offsetVector: new THREE.Vector3(-1.0, -2.0, 0) }
    );

    // Right fixtures (7, 8, 9) - 3 spotlights along right vertical tower (symmetrically mirrored)
    layout.push(
      { pos: new THREE.Vector3(rightX, upperY, zPos), side: 'right', offsetVector: new THREE.Vector3(1.0, 2.0, 0) },
      { pos: new THREE.Vector3(rightX, middleY, zPos), side: 'right', offsetVector: new THREE.Vector3(1.0, 0.0, 0) },
      { pos: new THREE.Vector3(rightX, lowerY, zPos), side: 'right', offsetVector: new THREE.Vector3(1.0, -2.0, 0) }
    );

    return layout;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Ensure the attachment layer stays completely stationary
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);

    // Chassis geometry for stationary moving-head bases
    const baseGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.38, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.disposables.push(baseGeo, baseMat);

    // Lens flare sphere
    const lensGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward across the entire viewport (length = 34 units)
    const coneLength = 34;
    const coneGeo = new THREE.ConeGeometry(1.65, coneLength, 16, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Cone body projects along +Z
    this.disposables.push(coneGeo);

    // 1. Eight Stationary Moving-Head Fixtures
    const fixedLayout = StageLightsEffect.getStationarySpotlightLayout(this.currentDimensions);

    for (let i = 0; i < fixedLayout.length; i++) {
      const slot = fixedLayout[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(slot.pos);

      // Chassis base
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixtureGroup.add(baseMesh);

      // Optical lens
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

      // Volumetric beam cone
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.disposables.push(coneMat);

      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(coneMesh);

      const defaultAim = new THREE.Vector3(slot.pos.x * 1.5, slot.pos.y - 2.0, 14.0);
      fixtureGroup.lookAt(defaultAim);
      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: slot.pos.clone(),
        targetPos: defaultAim.clone(),
        currentTarget: defaultAim.clone(),
        side: slot.side,
        activationFactor: 0.0,
        index: i,
        offsetVector: slot.offsetVector.clone(),
      });
    }

    // 2. White Stage Sky Spotlights at Bottom Corners of YouTube Screen
    // High-altitude searchlights (length = 60 units) projecting skyward
    const skyConeLength = 60;
    const skyConeGeo = new THREE.ConeGeometry(2.5, skyConeLength, 18, 1, true);
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
          -(this.currentDimensions.halfWidth + 4.0),
          this.currentDimensions.topY + 7.0,
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
          this.currentDimensions.halfWidth + 4.0,
          this.currentDimensions.topY + 7.0,
          14.0
        ),
      },
    ];

    for (let i = 0; i < whiteCorners.length; i++) {
      const cfg = whiteCorners[i];

      // Stationary base chassis
      const fixedBaseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixedBaseMesh.position.copy(cfg.pos);
      this.group.add(fixedBaseMesh);

      // Optical head group with stationary origin
      const headGroup = new THREE.Group();
      headGroup.position.copy(cfg.pos);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
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

    // 3. Stage Wash Point Lights (Atmospheric stage ambient lighting)
    this.washLight1 = new THREE.PointLight(0xff6600, 0.0, 28, 1.8);
    this.washLight1.position.set(
      -0.5 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.0, 28, 1.8);
    this.washLight2.position.set(
      0.5 * this.currentDimensions.halfWidth,
      this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
      -1.0
    );
    this.group.add(this.washLight2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Viewport Resize (Updates Stationary Mounting Locations)
  // ─────────────────────────────────────────────────────────────────────────────

  public override resize(width: number, height: number): void {
    this.currentDimensions = calculateStageDimensions(width, height);
    const layout = StageLightsEffect.getStationarySpotlightLayout(this.currentDimensions);

    for (let i = 0; i < this.fixtures.length && i < layout.length; i++) {
      const fix = this.fixtures[i];
      const slot = layout[i];
      fix.basePos.copy(slot.pos);
      fix.group.position.copy(slot.pos);
      fix.side = slot.side;
      fix.offsetVector.copy(slot.offsetVector);
    }

    if (this.whiteSkySpotlights.length >= 2) {
      this.whiteSkySpotlights[0].basePos.set(
        this.currentDimensions.leftX - 0.45,
        this.currentDimensions.bottomY + 0.15,
        this.currentDimensions.screenZ + 0.55
      );
      this.whiteSkySpotlights[0].fixedBaseMesh.position.copy(this.whiteSkySpotlights[0].basePos);
      this.whiteSkySpotlights[0].headGroup.position.copy(this.whiteSkySpotlights[0].basePos);

      this.whiteSkySpotlights[1].basePos.set(
        this.currentDimensions.rightX + 0.45,
        this.currentDimensions.bottomY + 0.15,
        this.currentDimensions.screenZ + 0.55
      );
      this.whiteSkySpotlights[1].fixedBaseMesh.position.copy(this.whiteSkySpotlights[1].basePos);
      this.whiteSkySpotlights[1].headGroup.position.copy(this.whiteSkySpotlights[1].basePos);
    }

    if (this.washLight1 && this.washLight2) {
      this.washLight1.position.set(
        -0.5 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
      this.washLight2.position.set(
        0.5 * this.currentDimensions.halfWidth,
        this.currentDimensions.screenCenterY + 0.15 * this.currentDimensions.halfHeight,
        -1.0
      );
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
      this.turnOffAllLights();
      return;
    }

    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const tSec = Math.max(0, context.trackTimeSeconds);

    // ── Seek Detection & Immediate State Restoration ───────────────────────────
    if (this.lastTrackTimeSeconds >= 0 && Math.abs(tSec - this.lastTrackTimeSeconds) > 0.40) {
      // Direct media seek occurred: immediately reset transient kick timers to avoid burst shakes/jumps
      this.movementController.resetImpulses();
      this.whiteKickIntensity = 1.0;
    }
    this.lastTrackTimeSeconds = tSec;

    // ── Colour Palette ─────────────────────────────────────────────────────────
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

    // ── Pre-Playback Initial Gate: All Spotlights Start Completely OFF ─────────
    if (!context.hasPlaybackStarted) {
      this.turnOffAllLights();
      this.smoothTurnOnFactor = 0.0;
      this.whitePlaybackFactor = 0.0;
      return;
    }

    // ── Update White Spotlight Playback Readiness ──────────────────────────────
    if (deltaSeconds > 0) {
      this.whitePlaybackFactor = Math.min(1.0, this.whitePlaybackFactor + deltaSeconds * 3.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. PRE-ANALYZED FREQUENCY, GLOW & VERSE/SOLO/INST SEGMENT EVALUATION
    // ═══════════════════════════════════════════════════════════════════════════
    const spotlightAnalysis = context.spotlightAnalysis || context.demucsStems?.spotlightAnalysis;
    let targetThetaRad = 0;
    let targetGlowFactor = 0.5;
    let isTurnedOn = false;
    let activeSectionType: 'verse' | 'solo' | 'inst' | 'inactive' = 'inactive';
    let currentKickTarget: {
      left: [number, number, number];
      right: [number, number, number];
      top: [number, number, number];
    } | undefined = undefined;

    // Dynamically select spotlight count based on song's musical energy classification
    if (spotlightAnalysis) {
      const energyCount = spotlightAnalysis.spotlightCount ??
        spotlightAnalysis.musicalEnergy?.spotlightCount ??
        (spotlightAnalysis.energyLevel === 'high' ? 10 : (spotlightAnalysis.energyLevel ? 4 : undefined));
      if (typeof energyCount === 'number' && (energyCount === 10 || energyCount === 4)) {
        this.targetSpotlightCount = energyCount;
      }
    } else if (this.autoBpmSpawning && features.estimatedBpm && features.estimatedBpm > 0 && features.bpmSource !== 'unavailable') {
      // Dynamic fallback mapping if precomputed energy analysis is unavailable
      const mappedCount = mapBpmToSpotlightCount(
        features.estimatedBpm,
        this.minSpotlightCount,
        this.maxSpotlightCount
      );
      this.targetSpotlightCount = mappedCount >= 8 ? 10 : 4;
    }

    if (spotlightAnalysis && spotlightAnalysis.frameCount > 0 && spotlightAnalysis.timestampsMs?.length > 0) {
      const fps = spotlightAnalysis.fps || 25;
      const exactFrame = tSec * fps;
      const frameIdx = Math.min(spotlightAnalysis.frameCount - 1, Math.floor(exactFrame));
      const nextIdx = Math.min(spotlightAnalysis.frameCount - 1, frameIdx + 1);
      const frac = exactFrame - frameIdx;

      // 360° Instrument frequency angular reference: theta(t) = 360 * f_norm(t)
      const degA = spotlightAnalysis.movementAnglesDeg[frameIdx] ?? 0;
      const degB = spotlightAnalysis.movementAnglesDeg[nextIdx] ?? degA;
      let dDeg = degB - degA;
      if (dDeg > 180) dDeg -= 360;
      if (dDeg < -180) dDeg += 360;
      const interpDeg = (degA + dDeg * frac + 360) % 360;
      targetThetaRad = (interpDeg * Math.PI) / 180.0;

      // Continuous Bass STEM glowing factor G(t) in [0.0, 1.0]
      const glowA = spotlightAnalysis.glowingFactors[frameIdx] ?? 0.5;
      const glowB = spotlightAnalysis.glowingFactors[nextIdx] ?? glowA;
      targetGlowFactor = Math.max(0.0, Math.min(1.0, glowA + (glowB - glowA) * frac));

      // Spotlight Activation Policy: Eligible sections are verse, solo, and inst segments
      if (spotlightAnalysis.eligibleIntervals && spotlightAnalysis.eligibleIntervals.length > 0) {
        const matchingInterval = spotlightAnalysis.eligibleIntervals.find(
          (iv) => tSec >= iv.start && tSec <= iv.end
        );
        if (matchingInterval) {
          isTurnedOn = true;
          const cat = (matchingInterval.category || matchingInterval.label || '').trim().toLowerCase();
          if (cat.includes('solo')) {
            activeSectionType = 'solo';
          } else if (cat.includes('inst')) {
            activeSectionType = 'inst';
          } else {
            activeSectionType = 'verse';
          }
        }
      } else if (
        (spotlightAnalysis.verseSegments && spotlightAnalysis.verseSegments.length > 0) ||
        (spotlightAnalysis.soloSegments && spotlightAnalysis.soloSegments.length > 0) ||
        (spotlightAnalysis.instSegments && spotlightAnalysis.instSegments.length > 0)
      ) {
        const inVerse = spotlightAnalysis.verseSegments?.some((v) => tSec >= v.start && tSec <= v.end);
        const inSolo = spotlightAnalysis.soloSegments?.some((s) => tSec >= s.start && tSec <= s.end);
        const inInst = spotlightAnalysis.instSegments?.some((i) => tSec >= i.start && tSec <= i.end);
        if (inVerse) {
          isTurnedOn = true;
          activeSectionType = 'verse';
        } else if (inSolo) {
          isTurnedOn = true;
          activeSectionType = 'solo';
        } else if (inInst) {
          isTurnedOn = true;
          activeSectionType = 'inst';
        }
      } else if (spotlightAnalysis.spotlightsActive && spotlightAnalysis.spotlightsActive.length > 0) {
        isTurnedOn = spotlightAnalysis.spotlightsActive[frameIdx] ?? false;
        if (isTurnedOn) activeSectionType = 'verse';
      }

      // Check precomputed kick transient matching current timestamp (within 40ms window)
      if (spotlightAnalysis.kickEvents && spotlightAnalysis.kickEvents.length > 0) {
        const curMs = tSec * 1000.0;
        const matchedKick = spotlightAnalysis.kickEvents.find(
          (ke) => Math.abs(ke.timestampMs - curMs) < 40
        );
        if (matchedKick && matchedKick.directionTarget) {
          currentKickTarget = matchedKick.directionTarget;
        }
      }
    } else {
      // Controlled real-time DSP fallback if pre-analysis is not present
      const instSig = Math.max(features.highMid * 0.4 + features.treble * 0.6, features.stems?.instruments ?? 0);
      const bassSig = Math.max(features.bass * 0.7 + features.subBass * 0.3, features.stems?.bass ?? 0);
      targetThetaRad = ((instSig * 360.0) * Math.PI) / 180.0;
      targetGlowFactor = Math.max(0.0, Math.min(1.0, bassSig));
      isTurnedOn = instSig > 0.28 && bassSig > 0.28;
      activeSectionType = isTurnedOn ? 'verse' : 'inactive';
    }

    this.isSpotlightsTurnedOn = isTurnedOn;

    // ── Kick Transient Response (Active Strictly During Verses, Solos & Inst) ─
    const kickPower = Math.max(
      features.stems?.kick ?? 0,
      features.isKick ? (features.kickIntensity || 1.0) : 0
    );
    const isKickOnset = (features.isKick || kickPower > 0.36) && !this.wasKickTriggered;
    this.wasKickTriggered = features.isKick || kickPower > 0.36;

    if (isKickOnset && deltaSeconds > 0) {
      if (isTurnedOn) {
        // 1. Main coloured spotlights jump to new direction target strictly during eligible sections
        this.movementController.triggerKickDirectionChange(tSec, kickPower, currentKickTarget);
      }
      // 2. Two white bottom spotlights surge in glow intensity ONLY (NEVER change beam direction)
      if (this.whitePlaybackFactor > 0.1) {
        this.whiteKickIntensity = Math.min(2.8, 1.0 + 1.8 * Math.max(kickPower, 0.65));
      }
    }

    // ── Dynamic Interpolation & Time Progression (Zero Drift When Paused) ──────
    if (deltaSeconds > 0) {
      this.whiteKickIntensity = Math.max(1.0, this.whiteKickIntensity - deltaSeconds * 5.2);

      // Smooth interpolation for angular reference and continuous glow
      this.currentMovementAngle += (targetThetaRad - this.currentMovementAngle) * Math.min(1.0, deltaSeconds * 12.0);
      this.currentGlowingFactor += (targetGlowFactor - this.currentGlowingFactor) * Math.min(1.0, deltaSeconds * 14.0);

      // Smooth attack/release for verse/solo/inst spotlight activation (prevents flicker)
      if (isTurnedOn) {
        this.smoothTurnOnFactor = Math.min(1.0, this.smoothTurnOnFactor + deltaSeconds * 6.5);
      } else {
        this.smoothTurnOnFactor = Math.max(0.0, this.smoothTurnOnFactor - deltaSeconds * 4.5);
      }

      // Update movement controller path rotation and transitions
      this.movementController.updatePathSelection(activeSectionType, tSec, deltaSeconds);
    }

    // Explicit continuous glow factor blending
    const baseGlow = 0.15;
    const continuousBassGlow = this.currentGlowingFactor * 0.85;
    const continuousGlow = Math.min(1.0, baseGlow + continuousBassGlow);

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. COORDINATED FULL-SCREEN SPOTLIGHT MOVEMENT EXECUTION
    // ═══════════════════════════════════════════════════════════════════════════
    const targets: SpotlightTargetCoordinates = this.movementController.computeGroupTargets(
      this.currentMovementAngle,
      tSec,
      this.currentDimensions
    );

    // Symmetrical fixture slot selection (10 for high energy, 4 for smooth/low energy)
    const activeSlots = StageLightsEffect.getSymmetricalIndices(this.targetSpotlightCount);

    // Update 10 Stationary Moving Heads (Top, Left, Right)
    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];
      const isSlotActive = activeSlots.includes(i);

      // Architectural Rule: Fixture origins stay completely stationary at fixed mounting slots!
      fix.group.position.copy(fix.basePos);

      // Smooth activation factor lerp for dynamic energy spotlight spawning
      if (isSlotActive) {
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.min(1.0, fix.activationFactor + deltaSeconds * 4.0);
        } else {
          fix.activationFactor = 1.0;
        }
      } else {
        if (deltaSeconds > 0) {
          fix.activationFactor = Math.max(0.0, fix.activationFactor - deltaSeconds * 3.5);
        } else {
          fix.activationFactor = 0.0;
        }
      }

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;

      // Spotlights turn OFF outside eligible sections (verse, solo, inst) or when slot despawned
      if (fix.activationFactor <= 0.001 || this.smoothTurnOnFactor <= 0.001) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Assign target direction based on synchronized group:
      // All fixtures within each group move in sync, offset by their fixture offset vector
      if (fix.side === 'left') {
        fix.targetPos.set(
          targets.left.x + fix.offsetVector.x,
          targets.left.y + fix.offsetVector.y,
          targets.left.z
        );
      } else if (fix.side === 'right') {
        // Right group uses opposite angular relationship (-theta) with spatial elevation offsets
        fix.targetPos.set(
          targets.right.x + fix.offsetVector.x,
          targets.right.y + fix.offsetVector.y,
          targets.right.z
        );
      } else {
        // Top group synchronized together along top truss
        fix.targetPos.set(
          targets.top.x + fix.offsetVector.x,
          targets.top.y + fix.offsetVector.y,
          targets.top.z
        );
      }

      if (deltaSeconds > 0) {
        fix.currentTarget.lerp(fix.targetPos, Math.min(1.0, deltaSeconds * 10.0));
      } else {
        fix.currentTarget.copy(fix.targetPos);
      }
      fix.group.lookAt(fix.currentTarget);

      // Apply color and continuous bass-frequency-driven glow modulated by section activation
      const lightCol = colorPaletteArray[i % colorPaletteArray.length];
      lensMat.color.copy(lightCol);
      coneMat.color.copy(lightCol);

      const combinedIntensity = continuousGlow * fix.activationFactor * this.smoothTurnOnFactor;
      lensMat.opacity = Math.min(0.98, 0.88 * maxBri * combinedIntensity);
      coneMat.opacity = Math.min(0.38, 0.22 * maxBri * combinedIntensity);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. TWO WHITE BOTTOM SPOTLIGHTS (Sky Searchlights & Kick Glow Accent)
    // ═══════════════════════════════════════════════════════════════════════════
    // White spotlights remain enabled throughout playback once started, even outside verses!
    for (let i = 0; i < this.whiteSkySpotlights.length; i++) {
      const spot = this.whiteSkySpotlights[i];
      const isLeft = spot.corner === 'left';
      const lensMat = spot.lensMesh.material as THREE.MeshBasicMaterial;
      const coneMat = spot.coneMesh.material as THREE.MeshBasicMaterial;

      // Architectural Rule: White spotlight origins remain completely stationary
      spot.fixedBaseMesh.position.copy(spot.basePos);
      spot.headGroup.position.copy(spot.basePos);

      // Turn OFF if playback has not started
      if (this.whitePlaybackFactor <= 0.001) {
        lensMat.opacity = 0;
        coneMat.opacity = 0;
        continue;
      }

      // Trajectories follow full-screen sky searchlight coordinates from movement controller
      // Crucial: White spotlights NEVER change beam direction on kick events!
      const skyTarget = isLeft ? targets.whiteLeft : targets.whiteRight;
      spot.targetPos.copy(skyTarget);

      if (deltaSeconds > 0) {
        spot.currentTarget.lerp(spot.targetPos, Math.min(1.0, deltaSeconds * 9.5));
      } else {
        spot.currentTarget.copy(spot.targetPos);
      }
      spot.headGroup.lookAt(spot.currentTarget);

      // Continuous Bass-driven glow + sharp kick transient impulse
      const whiteGlow = Math.min(1.0, continuousGlow * this.whiteKickIntensity) * this.whitePlaybackFactor;

      lensMat.opacity = Math.min(1.0, 0.92 * maxBri * whiteGlow);
      coneMat.opacity = Math.min(0.85, 0.28 * maxBri * whiteGlow);

      // Subtle volumetric beam flare expansion on intense kick glow
      const flareScale = 1.0 + (this.whiteKickIntensity - 1.0) * 0.18;
      spot.coneMesh.scale.set(flareScale, flareScale, 1.0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. WASH LIGHTS (Dynamic Stage Ambient Lighting)
    // ═══════════════════════════════════════════════════════════════════════════
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = Math.min(1.2 * maxBri, (0.25 + 0.65 * continuousGlow) * maxBri) * this.whitePlaybackFactor;

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = Math.min(1.2 * maxBri, (0.25 + 0.65 * continuousGlow) * maxBri) * this.whitePlaybackFactor;
  }

  private turnOffAllLights(): void {
    for (const fix of this.fixtures) {
      (fix.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (fix.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    for (const s of this.whiteSkySpotlights) {
      (s.lensMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (s.coneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.washLight1) this.washLight1.intensity = 0;
    if (this.washLight2) this.washLight2.intensity = 0;
  }
}
