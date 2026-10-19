/**
 * Synwave 360° Downward Instrument Lasers Effect
 * 
 * High-intensity laser system mounted at the TOP of the YouTube screen:
 * - 3 Laser Stations at the top of the video screen facing lights downwards into stage and audience.
 * - Origin emitters are clean pin-point diode dots (no large white circles).
 * - Full 360-degree conical sweeping & manipulation driven by high frequencies of the INSTRUMENTAL STEM
 *   (instruments, highMid, treble, and rapid transient frequency shifts).
 * - Activated strictly during high-intensity music sections (drops, heavy climaxes, high global intensity).
 * - Beam colors are dynamically computed as the exact OPPOSITE (complementary hue) of the active color palette.
 * - Paused playback freezes laser animation in place.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext, ColorPalette } from '../../types';
import { calculateStageDimensions } from '../stage/stageDimensions';
import {
  LASER_CHOREOGRAPHIES,
  selectNextLaserPattern,
  type LaserBeamParams,
} from './laserChoreography';
import { resolveLaserPaletteColors } from './laserColorUtils';

interface TopLaserBeam {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  sheathMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  stationIdx: number;
  rayIdx: number;
  baseAzimuth: number;
  baseElevation: number;
}

interface TopLaserStation {
  origin: THREE.Vector3;
  dotMesh: THREE.Mesh;
  dotMat: THREE.MeshBasicMaterial;
  beams: TopLaserBeam[];
}

export class ThinLasersEffect extends BaseEffect {
  readonly id = 'thin-lasers';
  readonly name = '360° Downward Instrument Lasers';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private stations: TopLaserStation[] = [];
  private currentBeamOpacity = 0;

  // Phase 11: Dynamic Complementary Colors derived from active song palette
  private lastPaletteSignature = '';
  private emitterDotColor = new THREE.Color(0xffaa00);
  private compCoreColor1 = new THREE.Color(0xff5500);
  private compGlowColor1 = new THREE.Color(0xff3300);
  private compHaloColor1 = new THREE.Color(0xcc2200);
  private compCoreColor2 = new THREE.Color(0x00ff88);
  private compGlowColor2 = new THREE.Color(0x00dd66);
  private compHaloColor2 = new THREE.Color(0x00aa44);

  // Phase 14: 22-Pattern Concert Laser Choreography Engine
  private masterSweepAngle = 0;              // Synchronized master sweep angle shared across ALL beams
  private activePatternId = 0;               // Currently active choreography ID (0 to 21)
  private prevPatternId = 0;                 // Previous choreography ID for smooth blending
  private transitionProgress = 1.0;          // 0.0 to 1.0 (1.0 = transition complete)
  private patternTimer = 0;                  // Time elapsed in active pattern (seconds)
  private lastMidCentroid = 0.5;             // Baseline mid-range spectral centroid
  private lastMidDistribution = 0.5;         // Baseline upper vs lower mid energy balance
  private lastMidFlux = 0.0;                 // Baseline mid-range spectral flux
  private kickImpulseDecay = 0;              // Dynamic kick transient impulse with exponential decay
  private lastPlaybackTime = 0;              // Playback clock tracker for seek detection

  public getActiveChoreographyName(): string {
    return LASER_CHOREOGRAPHIES[this.activePatternId]?.name || 'Concert Horizon Sweep';
  }

  public getActiveChoreographyId(): number {
    return this.activePatternId;
  }

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Shared Beam Geometries (Unit cylinder aligned along +Z with smooth 24 radial segments)
    // 24 smooth radial facets completely eliminate polygonal silhouette creases and stroke-like borders
    // - Core: Razor-sharp luminous neon filament
    const coreGeo = new THREE.CylinderGeometry(0.005, 0.012, 1.0, 24, 1, true);
    coreGeo.rotateX(Math.PI / 2);
    this.disposables.push(coreGeo);

    // - Sheath: Concentrated volumetric colored beam envelope
    const sheathGeo = new THREE.CylinderGeometry(0.018, 0.040, 1.0, 24, 1, true);
    sheathGeo.rotateX(Math.PI / 2);
    this.disposables.push(sheathGeo);

    // - Halo: Soft atmospheric dispersion layer providing smooth Gaussian-like feathering
    const haloGeo = new THREE.CylinderGeometry(0.040, 0.085, 1.0, 24, 1, true);
    haloGeo.rotateX(Math.PI / 2);
    this.disposables.push(haloGeo);

    // 2. Tiny pin-point diode dot geometry for emitter nozzle origin (NO white circles)
    const dotGeo = new THREE.SphereGeometry(0.04, 10, 10);
    this.disposables.push(dotGeo);

    // 3. Mount 3 Stations at the Top of the YouTube Screen
    const dims = calculateStageDimensions(
      typeof window !== 'undefined' ? window.innerWidth : 1920,
      typeof window !== 'undefined' ? window.innerHeight : 1080
    );
    const stationPositions = [
      new THREE.Vector3(-0.63 * dims.halfWidth, dims.topY + 0.25, dims.screenZ + 0.5), // Station 0: Top-Left
      new THREE.Vector3(0.0, dims.topY + 0.55, dims.screenZ + 0.5),                    // Station 1: Top-Center
      new THREE.Vector3(0.63 * dims.halfWidth, dims.topY + 0.25, dims.screenZ + 0.5),  // Station 2: Top-Right
    ];

    this.stations = [];

    // Pre-calculate initial laser palette colors (Phase 17)
    if (context.palette) {
      this.updatePaletteColors(context.palette, context.seed || 1337);
    }

    // Each station projects 8 razor-sharp beams pointing downwards into stage and crowd
    const beamsPerStation = 8;

    for (let s = 0; s < stationPositions.length; s++) {
      const origin = stationPositions[s];

      // Clean pin-point dot nozzle in complementary neon color
      const dotMat = new THREE.MeshBasicMaterial({
        color: this.emitterDotColor.clone(),
        transparent: true,
        opacity: 0.9,
      });
      this.disposables.push(dotMat);

      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.frustumCulled = false;
      dotMesh.position.copy(origin);
      this.group.add(dotMesh);

      const stationBeams: TopLaserBeam[] = [];

      for (let b = 0; b < beamsPerStation; b++) {
        const beamGroup = new THREE.Group();
        const isEven = (b % 2 === 0);
        const initCoreColor = (isEven ? this.compCoreColor1 : this.compCoreColor2).clone();
        const initGlowColor = (isEven ? this.compGlowColor1 : this.compGlowColor2).clone();
        const initHaloColor = (isEven ? this.compHaloColor1 : this.compHaloColor2).clone();

        // 1. Inner core: intense complementary neon pigment (NO white)
        const coreMat = new THREE.MeshBasicMaterial({
          color: initCoreColor,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.disposables.push(coreMat);
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.frustumCulled = false;
        beamGroup.add(coreMesh);

        // 2. Volumetric glow sheath: saturated chromatic beam envelope
        const sheathMat = new THREE.MeshBasicMaterial({
          color: initGlowColor,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.disposables.push(sheathMat);
        const sheathMesh = new THREE.Mesh(sheathGeo, sheathMat);
        sheathMesh.frustumCulled = false;
        beamGroup.add(sheathMesh);

        // 3. Atmospheric halo: soft feathered edge falloff (eliminates stroke lines)
        const haloMat = new THREE.MeshBasicMaterial({
          color: initHaloColor,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.disposables.push(haloMat);
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.frustumCulled = false;
        beamGroup.add(haloMesh);

        this.group.add(beamGroup);

        // Base angles: downward facing (elevation < 0 towards stage floor and audience)
        const t = b / (beamsPerStation - 1); // 0 to 1
        const azimuthOffset = (s === 0 ? -0.3 : s === 2 ? 0.3 : 0.0);
        const baseAzimuth = (t - 0.5) * 1.2 + azimuthOffset;
        const baseElevation = THREE.MathUtils.degToRad(-18 - Math.sin(t * Math.PI) * 14);

        stationBeams.push({
          group: beamGroup,
          coreMesh,
          sheathMesh,
          haloMesh,
          stationIdx: s,
          rayIdx: b,
          baseAzimuth,
          baseElevation,
        });
      }

      this.stations.push({
        origin,
        dotMesh,
        dotMat,
        beams: stationBeams,
      });
    }

    if (typeof window !== 'undefined') {
      this.resize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Phase 17: Conditional Laser Color Resolution
   * Implements strict rules:
   * - Case A: Exactly 1 distinct chromatic color -> original chromatic color (no 180° rotation)
   * - Case B: Multiple distinct chromatic colors -> 180° HSL hue-rotation complementary logic
   * - Case C: Entirely white/achromatic -> deterministic fallback from track seed
   */
  public updatePaletteColors(palette: ColorPalette, seed: number = 1337): void {
    if (!palette) return;
    const spotlightPart = (palette.spotlightColors || []).join(',');
    const signature = `${palette.primary}_${palette.secondary}_${palette.accent}_${spotlightPart}_${palette.laserColor || ''}_${seed}`;
    if (signature === this.lastPaletteSignature) {
      return;
    }
    this.lastPaletteSignature = signature;

    const resolved = resolveLaserPaletteColors(palette, seed);

    this.emitterDotColor.copy(resolved.emitterDot);
    this.compCoreColor1.copy(resolved.core1);
    this.compGlowColor1.copy(resolved.glow1);
    this.compHaloColor1.copy(resolved.halo1);
    this.compCoreColor2.copy(resolved.core2);
    this.compGlowColor2.copy(resolved.glow2);
    this.compHaloColor2.copy(resolved.halo2);

    // Apply colors to all stations and beams immediately
    for (let s = 0; s < this.stations.length; s++) {
      const station = this.stations[s];
      station.dotMat.color.copy(this.emitterDotColor);

      for (let b = 0; b < station.beams.length; b++) {
        const beam = station.beams[b];
        const isEven = (b % 2 === 0);
        const coreMat = beam.coreMesh.material as THREE.MeshBasicMaterial;
        const sheathMat = beam.sheathMesh.material as THREE.MeshBasicMaterial;
        const haloMat = beam.haloMesh.material as THREE.MeshBasicMaterial;

        coreMat.color.copy(isEven ? this.compCoreColor1 : this.compCoreColor2);
        sheathMat.color.copy(isEven ? this.compGlowColor1 : this.compGlowColor2);
        haloMat.color.copy(isEven ? this.compHaloColor1 : this.compHaloColor2);
      }
    }
  }

  public override resize(width: number, height: number): void {
    const dims = calculateStageDimensions(width, height);
    const newPositions = [
      new THREE.Vector3(-0.63 * dims.halfWidth, dims.topY + 0.25, dims.screenZ + 0.5),
      new THREE.Vector3(0.0, dims.topY + 0.55, dims.screenZ + 0.5),
      new THREE.Vector3(0.63 * dims.halfWidth, dims.topY + 0.25, dims.screenZ + 0.5),
    ];

    for (let s = 0; s < this.stations.length && s < newPositions.length; s++) {
      this.stations[s].origin.copy(newPositions[s]);
      this.stations[s].dotMesh.position.copy(newPositions[s]);
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, routingConfig, directorState } = context;

    // Phase 17: Dynamically update laser colors whenever the palette changes.
    // Executed unconditionally BEFORE any pause/early-exit gates so that laser colors
    // are immediately refreshed during pauses, track transitions, or inactive sections.
    if (palette) {
      this.updatePaletteColors(palette, context.seed || 1337);
    }

    const isLasersEnabled =
      (routingConfig?.enabledEffects?.lasers ?? true) &&
      (directorState?.allowedEffects?.lasers ?? true);

    // 1. Handle Playback Pauses (Task 8)
    // When playback is paused (deltaSeconds <= 0), freeze all animations in place without resetting
    if (deltaSeconds <= 0) {
      if (!isLasersEnabled) {
        this.setAllLasersVisible(false);
      }
      return;
    }

    // 2. Handle Seeking & Track Changes (Task 8)
    const currentTime = features.timeSeconds;
    const timeDelta = currentTime - this.lastPlaybackTime;
    if (Math.abs(timeDelta) > 0.5) {
      // User seeked or track changed: reset instantaneous transient momentum
      this.kickImpulseDecay = 0;
      if (timeDelta < -2.0) {
        // Track restarted or switched: reset choreography state
        this.activePatternId = 0;
        this.prevPatternId = 0;
        this.transitionProgress = 1.0;
        this.patternTimer = 0;
        this.masterSweepAngle = 0;
      }
    }
    this.lastPlaybackTime = currentTime;

    // 3. Audio-Aware Activation Gate: Pinpointed Tri-STEM Drop Segments
    // The lasers are activated strictly when Kick (drums), Bass, and Instruments ALL simultaneously
    // exceed their full-track average amplitude values in the concentrated drop segments of the song.
    const isTriStemDrop = features.isTriStemDropActive ?? features.isAboveAverageAmplitude ?? false;
    const isEligible = isLasersEnabled && isTriStemDrop;

    // Target activation: 1.0 strictly within drop segments; 0.0 outside
    const targetActivation = isEligible ? 1.0 : 0.0;

    // Configurable fade: Smooth fade-in (~0.35s) and gentle fade-out (~0.60s) to eliminate abrupt visual cuts
    const fadeRate = targetActivation > this.currentBeamOpacity ? 3.5 : 1.8;
    this.currentBeamOpacity += (targetActivation - this.currentBeamOpacity) * Math.min(1.0, deltaSeconds * fadeRate);

    if (this.currentBeamOpacity < 0.005) {
      this.setAllLasersVisible(false);
      return;
    }

    // 4. Mid-Range Spectral & Kick Transient Analysis (Tasks 2, 3, 4)
    // Extract mid-range spectral features (250 Hz - 4 kHz band & instrumental stem)
    const midRangeEnergy = features.midRangeEnergy ?? 0.40;
    const midSpectralCentroid = features.midSpectralCentroid ?? 0.50;
    const midSpectralFlux = features.midSpectralFlux ?? 0.0;
    const midEnergyDistribution = features.midEnergyDistribution ?? 0.50;

    // Decay kick impulse smoothly over ~160ms (reusing Demucs drum stem kick events)
    const kickImpulse = features.isKick ? (features.kickIntensity * 0.45) : 0;
    this.kickImpulseDecay = Math.max(kickImpulse, this.kickImpulseDecay * Math.max(0, 1 - deltaSeconds * 5.5));

    // 5. Pattern Selection & Transition Engine Driven by Kicks and Mid-Range Spectral Characteristics (Task 5)
    // BASS IS STRICTLY NOT USED as the pattern-selection driver.
    this.patternTimer += deltaSeconds;

    // Minimum dwell time of 3.5 seconds enforces musical phrase stability
    if (this.patternTimer >= 3.5) {
      const centroidDelta = Math.abs(midSpectralCentroid - this.lastMidCentroid);
      const distributionDelta = Math.abs(midEnergyDistribution - this.lastMidDistribution);
      const fluxDelta = Math.abs(midSpectralFlux - this.lastMidFlux);
      const isMidSpectralShift = centroidDelta > 0.20 || distributionDelta > 0.22 || fluxDelta > 0.25 || midSpectralFlux > 0.35;
      const isMusicalAnchorKick = features.isKick && (features.isBar || features.isPhrase || features.kickIntensity > 0.60);
      const isMaxDwellExpired = this.patternTimer > 12.0 && features.isKick;

      if ((isMidSpectralShift && features.isKick) || isMusicalAnchorKick || isMaxDwellExpired) {
        this.prevPatternId = this.activePatternId;
        this.activePatternId = selectNextLaserPattern(
          this.activePatternId,
          context.seed || 1337,
          midRangeEnergy,
          midSpectralCentroid
        );
        this.transitionProgress = 0.0;
        this.patternTimer = 0.0;
        this.lastMidCentroid = midSpectralCentroid;
        this.lastMidDistribution = midEnergyDistribution;
        this.lastMidFlux = midSpectralFlux;
      }
    }

    // Advance smooth pattern transition (0.50s cubic hermite blend)
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + deltaSeconds / 0.50);
    }

    // 6. Synchronized Movement Speed Driven by Instrumental Mid-Range Energy and Kick Transients
    const instSpeedMultiplier = routingConfig?.instrumentalMovementSpeed ?? 1.0;
    const sweepSpeed = (1.2 + midRangeEnergy * 1.6 + this.kickImpulseDecay * 1.4) * instSpeedMultiplier;
    this.masterSweepAngle += deltaSeconds * sweepSpeed;

    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const laserDensity = routingConfig?.laserDensity ?? 1.0;

    const currentPattern = LASER_CHOREOGRAPHIES[this.activePatternId] || LASER_CHOREOGRAPHIES[0];
    const prevPattern = LASER_CHOREOGRAPHIES[this.prevPatternId] || LASER_CHOREOGRAPHIES[0];
    const blendFactor = this.transitionProgress < 1.0
      ? this.transitionProgress * this.transitionProgress * (3 - 2 * this.transitionProgress)
      : 1.0;

    // 7. Update Stations and All Synchronized Beams (Tasks 5, 6)
    for (let s = 0; s < this.stations.length; s++) {
      const station = this.stations[s];

      // Update nozzle dot diode
      station.dotMat.opacity = this.currentBeamOpacity * 0.95 * maxBri;
      station.dotMesh.visible = this.currentBeamOpacity > 0.05;

      for (let b = 0; b < station.beams.length; b++) {
        const beam = station.beams[b];

        if (b > Math.round(station.beams.length * laserDensity)) {
          beam.group.visible = false;
          continue;
        }
        beam.group.visible = true;

        const beamParams: LaserBeamParams = {
          stationIdx: s,
          rayIdx: b,
          totalBeams: station.beams.length,
          masterAngle: this.masterSweepAngle,
          midRangeEnergy,
          midSpectralCentroid,
          midSpectralFlux,
          midEnergyDistribution,
          kickImpulse: this.kickImpulseDecay,
          timeSeconds: currentTime,
          seed: context.seed || 1337,
          stationOrigin: { x: station.origin.x, y: station.origin.y, z: station.origin.z },
        };

        const activeTraj = currentPattern.calculateTrajectory(beamParams);
        let targetX = activeTraj.targetX;
        let targetY = activeTraj.targetY;
        let targetZ = activeTraj.targetZ;

        if (this.transitionProgress < 1.0) {
          const prevTraj = prevPattern.calculateTrajectory(beamParams);
          targetX = prevTraj.targetX + (activeTraj.targetX - prevTraj.targetX) * blendFactor;
          targetY = prevTraj.targetY + (activeTraj.targetY - prevTraj.targetY) * blendFactor;
          targetZ = prevTraj.targetZ + (activeTraj.targetZ - prevTraj.targetZ) * blendFactor;
        }

        // 3D Unit direction vector from station origin to 360-degree trajectory target
        const dir = new THREE.Vector3(
          targetX - station.origin.x,
          targetY - station.origin.y,
          targetZ - station.origin.z
        );
        if (dir.lengthSq() < 0.0001) {
          dir.set(0, -1, 0.5);
        }
        dir.normalize();

        // End-to-end full window reach: 85m ray extends completely beyond viewport boundaries
        const FULL_WINDOW_BEAM_LENGTH = 85.0;
        const lookTarget = station.origin.clone().addScaledVector(dir, FULL_WINDOW_BEAM_LENGTH);

        beam.group.position.copy(station.origin);
        beam.group.lookAt(lookTarget);

        // Subtle thickness expansion on kick and mid-range punch
        const beamThickness = 1.0 + Math.min(0.5, midRangeEnergy * 0.25 + this.kickImpulseDecay * 0.35);
        beam.coreMesh.scale.set(beamThickness, beamThickness, FULL_WINDOW_BEAM_LENGTH);
        beam.sheathMesh.scale.set(beamThickness, beamThickness, FULL_WINDOW_BEAM_LENGTH);
        beam.haloMesh.scale.set(beamThickness, beamThickness, FULL_WINDOW_BEAM_LENGTH);

        beam.coreMesh.position.set(0, 0, FULL_WINDOW_BEAM_LENGTH / 2);
        beam.sheathMesh.position.set(0, 0, FULL_WINDOW_BEAM_LENGTH / 2);
        beam.haloMesh.position.set(0, 0, FULL_WINDOW_BEAM_LENGTH / 2);

        // Core Material: intense glowing complementary neon color (zero white borders)
        const coreMat = beam.coreMesh.material as THREE.MeshBasicMaterial;
        coreMat.opacity = this.currentBeamOpacity * (0.80 + this.kickImpulseDecay * 0.20) * maxBri;

        // Sheath Material: volumetric colored beam envelope
        const sheathMat = beam.sheathMesh.material as THREE.MeshBasicMaterial;
        sheathMat.opacity = this.currentBeamOpacity * (0.32 + midRangeEnergy * 0.30) * maxBri;

        // Halo Material: smooth radiant feathering without hard borders or silhouette outlines
        const haloMat = beam.haloMesh.material as THREE.MeshBasicMaterial;
        haloMat.opacity = this.currentBeamOpacity * (0.12 + midRangeEnergy * 0.18) * maxBri;
      }
    }
  }

  private setAllLasersVisible(visible: boolean): void {
    for (const station of this.stations) {
      station.dotMesh.visible = visible;
      for (const beam of station.beams) {
        beam.group.visible = visible;
      }
    }
  }
}
