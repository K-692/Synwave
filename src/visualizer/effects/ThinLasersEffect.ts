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
import type { VisualEffectContext } from '../../types';

interface TopLaserBeam {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  sheathMesh: THREE.Mesh;
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
  private internalTime = 0;
  private currentSweepAngle = 0;
  private currentBeamOpacity = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Shared Beam Geometries (Unit cylinder aligned along +Z)
    const coreGeo = new THREE.CylinderGeometry(0.007, 0.016, 1.0, 8, 1, true);
    coreGeo.rotateX(Math.PI / 2);
    this.disposables.push(coreGeo);

    const sheathGeo = new THREE.CylinderGeometry(0.024, 0.048, 1.0, 8, 1, true);
    sheathGeo.rotateX(Math.PI / 2);
    this.disposables.push(sheathGeo);

    // 2. Tiny pin-point diode dot geometry for emitter nozzle origin (NO white circles)
    const dotGeo = new THREE.SphereGeometry(0.04, 10, 10);
    this.disposables.push(dotGeo);

    // 3. Mount 3 Stations at the Top of the YouTube Screen (Screen top is Y ~ 10.5 to 11.2, Z ~ -4.0)
    const stationPositions = [
      new THREE.Vector3(-5.5, 11.1, -4.0), // Station 0: Top-Left
      new THREE.Vector3(0.0, 11.4, -4.0),  // Station 1: Top-Center
      new THREE.Vector3(5.5, 11.1, -4.0),  // Station 2: Top-Right
    ];

    this.stations = [];

    // Each station projects 8 razor-sharp beams pointing downwards into stage and crowd
    const beamsPerStation = 8;

    for (let s = 0; s < stationPositions.length; s++) {
      const origin = stationPositions[s];

      // Clean pin-point dot nozzle
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xff3366,
        transparent: true,
        opacity: 0.9,
      });
      this.disposables.push(dotMat);

      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(origin);
      this.group.add(dotMesh);

      const stationBeams: TopLaserBeam[] = [];

      for (let b = 0; b < beamsPerStation; b++) {
        const beamGroup = new THREE.Group();

        // Inner core material
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.disposables.push(coreMat);
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        beamGroup.add(coreMesh);

        // Outer volumetric sheath material
        const sheathMat = new THREE.MeshBasicMaterial({
          color: 0xff3366,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.disposables.push(sheathMat);
        const sheathMesh = new THREE.Mesh(sheathGeo, sheathMat);
        beamGroup.add(sheathMesh);

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
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, routingConfig, directorState } = context;

    const isLasersEnabled =
      (routingConfig?.enabledEffects?.lasers ?? true) &&
      (directorState?.allowedEffects?.lasers ?? true);

    if (!isLasersEnabled) {
      this.setAllLasersVisible(false);
      return;
    }

    // High intensity gating: activated strictly during high intensity music parts
    // (festival drops, buildup climaxes, high global intensity or intense acoustic energy)
    const globalInt = features.globalIntensity ?? 0;
    const isHighIntensity =
      features.isDrop ||
      globalInt > 0.44 ||
      (features.rms > 0.42 && features.bass > 0.38) ||
      directorState?.currentSection === 'drop' ||
      directorState?.currentSection === 'buildup';

    // Smoothly fade lasers in/out based on high-intensity gating
    const targetOpacity = isHighIntensity ? 1.0 : 0.0;
    this.currentBeamOpacity += (targetOpacity - this.currentBeamOpacity) * (deltaSeconds > 0 ? deltaSeconds * 6.0 : 1.0);

    if (this.currentBeamOpacity < 0.01) {
      this.setAllLasersVisible(false);
      return;
    }

    // 1. High frequency instrument driver:
    // Manipulate 360-degree direction and speed based on instrument frequency & rapid changes
    const instStem = features.stems.instruments || 0;
    const highFreqContent = (features.highMid * 0.45 + features.treble * 0.55);
    const instSpeedMultiplier = routingConfig?.instrumentalMovementSpeed ?? 1.0;
    const dynamicInstFrequency = Math.max(instStem, highFreqContent, features.instrumentalActivity || 0);

    // 360-degree rotation speed increases with instrumental high frequency
    const rotationRate = (2.2 + dynamicInstFrequency * 6.5) * instSpeedMultiplier;
    if (deltaSeconds > 0) {
      this.internalTime += deltaSeconds;
      this.currentSweepAngle += deltaSeconds * rotationRate;
    }

    // 2. Compute Opposite (Complementary) Color of the Stage Palette
    // Palette primary hue inverted by 180° (h + 0.5) % 1.0
    const hsl = { h: 0, s: 0, l: 0 };
    const baseColor = new THREE.Color(palette.primary);
    baseColor.getHSL(hsl);

    const oppositeHue = (hsl.h + 0.5) % 1.0;
    const oppositeLaserColor = new THREE.Color().setHSL(oppositeHue, 1.0, 0.55);
    const oppositeCoreColor = new THREE.Color().setHSL(oppositeHue, 0.35, 0.95);

    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const laserDensity = routingConfig?.laserDensity ?? 1.0;

    // 3. Update each of the 3 top stations and their 360° downward throwing beams
    for (let s = 0; s < this.stations.length; s++) {
      const station = this.stations[s];

      // Update nozzle dot diode
      station.dotMat.color.copy(oppositeLaserColor);
      station.dotMat.opacity = this.currentBeamOpacity * 0.95 * maxBri;
      station.dotMesh.visible = this.currentBeamOpacity > 0.05;

      const stationPhase = (s - 1) * 0.8; // -0.8, 0.0, +0.8

      for (let b = 0; b < station.beams.length; b++) {
        const beam = station.beams[b];

        if (b > Math.round(station.beams.length * laserDensity)) {
          beam.group.visible = false;
          continue;
        }
        beam.group.visible = true;

        // 360-degree conical sweep direction based on instrumental high frequency
        const beamOrbitAngle = this.currentSweepAngle + stationPhase + (b / station.beams.length) * Math.PI * 2;
        const conicalSpread = 0.28 + dynamicInstFrequency * 0.55;

        // Conical 360° deflection vector
        const coneX = Math.sin(beamOrbitAngle) * conicalSpread * 14.0;
        const coneY = Math.cos(beamOrbitAngle) * conicalSpread * 7.0;

        // Downward target thrown into stage floor and audience
        // Screen top is at Y ~ 11.2, Z ~ -4.0. Target is down at Y ~ -0.8 to 2.2, Z ~ 12 to 24
        const targetX = (s - 1) * 6.0 + Math.sin(beam.baseAzimuth) * 16.0 + coneX;
        const targetY = -0.5 + Math.sin(beam.baseElevation) * 8.0 + coneY * 0.5;
        const targetZ = 16.0 + (b % 3) * 4.0 + Math.cos(beamOrbitAngle) * 3.0;

        const target = new THREE.Vector3(targetX, targetY, targetZ);

        // Position cylinder between origin and target
        const distance = station.origin.distanceTo(target);
        beam.group.position.copy(station.origin);
        beam.group.lookAt(target);

        // Scale beam length to reach target, expanding thickness slightly on high transients
        const beamThickness = 1.0 + dynamicInstFrequency * 0.35;
        beam.coreMesh.scale.set(beamThickness, beamThickness, distance);
        beam.sheathMesh.scale.set(beamThickness, beamThickness, distance);

        // Position meshes so their center is half distance forward along +Z
        beam.coreMesh.position.set(0, 0, distance / 2);
        beam.sheathMesh.position.set(0, 0, distance / 2);

        // Apply Opposite Colors & Intensity
        const coreMat = beam.coreMesh.material as THREE.MeshBasicMaterial;
        coreMat.color.copy(oppositeCoreColor);
        coreMat.opacity = this.currentBeamOpacity * (0.55 + dynamicInstFrequency * 0.45) * maxBri;

        const sheathMat = beam.sheathMesh.material as THREE.MeshBasicMaterial;
        sheathMat.color.copy(oppositeLaserColor);
        sheathMat.opacity = this.currentBeamOpacity * (0.20 + dynamicInstFrequency * 0.35) * maxBri;
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
