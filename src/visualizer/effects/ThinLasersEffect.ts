/**
 * Synwave Arena Cathedral Crossing Fan Lasers Effect
 * 
 * Re-architected to match the real-world arena concert stage reference image:
 * - Left & Right Concentrated Stage Floor Projector Stations shooting wide crossing radial fans
 *   of straight, razor-sharp beams into the arena ceiling and stands.
 * - Crossing beams form an authentic geometric stadium diamond canopy.
 * - Central stage hub projector shooting vertical-diagonal cathedral rays.
 * - Driven dynamically by the INSTRUMENTAL STEM and instrumentalActivity:
 *   Higher instrumental frequency/activity -> faster sweeping, wider fan spread, and dynamic scissor crossing.
 * - Top-of-screen straight bass laser machines throwing high-power beams towards the camera.
 * - Freeze support: when music is paused (deltaSeconds === 0), all beams freeze completely in place.
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

interface StadiumFanRay {
  meshGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  sheathMesh: THREE.Mesh;
  origin: THREE.Vector3;
  baseAzimuth: number;
  baseElevation: number;
  currentEndpoint: THREE.Vector3;
  station: 'left' | 'right' | 'center';
  rayIndex: number;
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
  readonly name = 'Arena Cathedral Crossing Fan Lasers';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private stadiumRays: StadiumFanRay[] = [];
  private topBassMachines: TopBassLaserMachine[] = [];

  // Emitter flare meshes at each station
  private leftStationFlare!: THREE.Mesh;
  private rightStationFlare!: THREE.Mesh;
  private centerStationFlare!: THREE.Mesh;

  // Internal time accumulator (freezes when deltaSeconds === 0)
  private internalTime = 0;
  private instrumentalSweepPhase = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Razor-Thin Volumetric Beam Geometries (Unit cylinder aligned along +Z)
    const coreGeo = new THREE.CylinderGeometry(0.006, 0.012, 1.0, 8, 1, true);
    coreGeo.rotateX(Math.PI / 2);
    this.disposables.push(coreGeo);

    const sheathGeo = new THREE.CylinderGeometry(0.016, 0.032, 1.0, 8, 1, true);
    sheathGeo.rotateX(Math.PI / 2);
    this.disposables.push(sheathGeo);

    // Emitter flare sphere geometry
    const flareGeo = new THREE.SphereGeometry(0.40, 16, 16);
    this.disposables.push(flareGeo);

    // 2. High-Power Arena Stage Projector Stations (Flanking the screen)
    // Left Wing Station (x = -5.0, y = 0.5, z = -1.2)
    // Right Wing Station (x = +5.0, y = 0.5, z = -1.2)
    // Center Stage Station (x = 0.0, y = 0.6, z = -2.2)
    const leftStationPos = new THREE.Vector3(-5.0, 0.5, -1.2);
    const rightStationPos = new THREE.Vector3(5.0, 0.5, -1.2);
    const centerStationPos = new THREE.Vector3(0.0, 0.6, -2.2);

    const flareMatLeft = new THREE.MeshBasicMaterial({
      color: 0x88eeff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const flareMatRight = flareMatLeft.clone();
    const flareMatCenter = flareMatLeft.clone();
    this.disposables.push(flareMatLeft, flareMatRight, flareMatCenter);

    this.leftStationFlare = new THREE.Mesh(flareGeo, flareMatLeft);
    this.leftStationFlare.position.copy(leftStationPos);
    this.group.add(this.leftStationFlare);

    this.rightStationFlare = new THREE.Mesh(flareGeo, flareMatRight);
    this.rightStationFlare.position.copy(rightStationPos);
    this.group.add(this.rightStationFlare);

    this.centerStationFlare = new THREE.Mesh(flareGeo, flareMatCenter);
    this.centerStationFlare.position.copy(centerStationPos);
    this.group.add(this.centerStationFlare);

    // 3. Generate Crossing Cathedral Fan Rays
    // Left Station: 16 straight razor beams fanning up & crossing right into arena
    const leftRayCount = 16;
    for (let i = 0; i < leftRayCount; i++) {
      const t = i / (leftRayCount - 1); // 0 to 1
      // Azimuth: from outward left (-20°) across to right stands (+65°)
      const azimuth = THREE.MathUtils.degToRad(-20 + t * 85);
      // Elevation: from 14° up to 72° into ceiling
      const elevation = THREE.MathUtils.degToRad(14 + Math.pow(t, 0.85) * 58);

      this.createFanRay(leftStationPos, azimuth, elevation, 'left', i, coreGeo, sheathGeo);
    }

    // Right Station: 16 straight razor beams symmetrically fanning up & crossing left into arena
    const rightRayCount = 16;
    for (let i = 0; i < rightRayCount; i++) {
      const t = i / (rightRayCount - 1);
      // Azimuth: from outward right (+20°) across to left stands (-65°)
      const azimuth = THREE.MathUtils.degToRad(20 - t * 85);
      const elevation = THREE.MathUtils.degToRad(14 + Math.pow(t, 0.85) * 58);

      this.createFanRay(rightStationPos, azimuth, elevation, 'right', i, coreGeo, sheathGeo);
    }

    // Center Station: 8 straight razor beams bursting vertically into stadium apex
    const centerRayCount = 8;
    for (let i = 0; i < centerRayCount; i++) {
      const t = (i / (centerRayCount - 1)) * 2 - 1; // -1 to +1
      const azimuth = THREE.MathUtils.degToRad(t * 38);
      const elevation = THREE.MathUtils.degToRad(35 + Math.abs(t) * 25);

      this.createFanRay(centerStationPos, azimuth, elevation, 'center', i, coreGeo, sheathGeo);
    }

    // 4. Two Top-of-Screen Bass Laser Machines (Retained for high-power straight bass projection)
    const chassisGeo = new THREE.BoxGeometry(0.85, 0.55, 0.70);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c14,
      metalness: 0.9,
      roughness: 0.25,
    });
    this.disposables.push(chassisGeo, chassisMat);

    const lensGeo = new THREE.SphereGeometry(0.18, 12, 12);
    this.disposables.push(lensGeo);

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

      const chassis = new THREE.Mesh(chassisGeo, chassisMat);
      mGroup.add(chassis);

      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
      });
      this.disposables.push(lensMat);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 0, 0.36);
      mGroup.add(lens);

      const beamGroup = new THREE.Group();

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

  private createFanRay(
    origin: THREE.Vector3,
    azimuth: number,
    elevation: number,
    station: 'left' | 'right' | 'center',
    rayIndex: number,
    coreGeo: THREE.BufferGeometry,
    sheathGeo: THREE.BufferGeometry
  ): void {
    const meshGroup = new THREE.Group();

    // Razor-bright white/cyan laser core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.disposables.push(coreMat);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    meshGroup.add(coreMesh);

    // Electric cyan/blue volumetric laser sheath
    const sheathMat = new THREE.MeshBasicMaterial({
      color: 0x00d8ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.disposables.push(sheathMat);
    const sheathMesh = new THREE.Mesh(sheathGeo, sheathMat);
    meshGroup.add(sheathMesh);

    this.group.add(meshGroup);

    this.stadiumRays.push({
      meshGroup,
      coreMesh,
      sheathMesh,
      origin: origin.clone(),
      baseAzimuth: azimuth,
      baseElevation: elevation,
      currentEndpoint: new THREE.Vector3(),
      station,
      rayIndex,
    });
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette, directorState, routingConfig } = context;

    // Time advances strictly during active playback. Freezes when paused!
    this.internalTime += deltaSeconds;
    const time = this.internalTime;

    const isLasersEnabled =
      (routingConfig?.enabledEffects?.lasers ?? true) &&
      (directorState?.allowedEffects?.lasers ?? true);

    if (!isLasersEnabled) {
      for (const ray of this.stadiumRays) {
        (ray.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (ray.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      for (const m of this.topBassMachines) {
        (m.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (m.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (m.fanMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      (this.leftStationFlare.material as THREE.MeshBasicMaterial).opacity = 0;
      (this.rightStationFlare.material as THREE.MeshBasicMaterial).opacity = 0;
      (this.centerStationFlare.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }

    const laserDensity = routingConfig?.laserDensity ?? 1.0;
    const maxBri = routingConfig?.maxBrightnessLimit ?? 1.0;
    const instSpeedMult = routingConfig?.instrumentalMovementSpeed ?? 1.0;

    // Instrumental Stem & Activity driving the Cathedral Fan Lasers
    const instStem = features.stems.instruments;
    const instActivity = features.instrumentalActivity ?? instStem;
    const combinedInstEnergy = Math.max(0, Math.min(1.0, instActivity * 0.7 + instStem * 0.5));

    // Movement speed increases proportionally with instrumental section frequency & activity
    const instrumentalSpeed = (0.75 + combinedInstEnergy * 3.8) * instSpeedMult;
    if (deltaSeconds > 0) {
      this.instrumentalSweepPhase += deltaSeconds * instrumentalSpeed;
    }
    const sweepPhase = this.instrumentalSweepPhase;

    // Fan spread expansion: when instrumental energy is high, the fan spreads wider across the stadium
    const fanSpreadMultiplier = 1.0 + combinedInstEnergy * 0.35;

    // Scissor oscillation angles driven by instruments
    const scissorSweep = Math.sin(sweepPhase) * 0.16 * fanSpreadMultiplier;
    const elevationOscillation = Math.cos(sweepPhase * 0.8) * 0.08 * fanSpreadMultiplier;

    // Beam colors: razor cyan-white core with vivid electric blue / palette accents
    const primaryCol = new THREE.Color(palette.primary);
    const cyanCol = new THREE.Color(0x00f0ff);
    const whiteCol = new THREE.Color(0xffffff);

    // Beam beam reach into the stadium
    const beamDistance = 48.0;

    // -------------------------------------------------------------
    // 1. UPDATE ARENA CATHEDRAL FAN RAYS
    // -------------------------------------------------------------
    const activeRayCount = Math.max(8, Math.min(this.stadiumRays.length, Math.round(this.stadiumRays.length * Math.min(1.0, laserDensity))));

    for (let i = 0; i < this.stadiumRays.length; i++) {
      const ray = this.stadiumRays[i];

      if (i >= activeRayCount) {
        (ray.coreMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        (ray.sheathMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      // Compute modulated azimuth & elevation for straight beam
      let azimuth = ray.baseAzimuth;
      let elevation = ray.baseElevation;

      if (ray.station === 'left') {
        azimuth += scissorSweep;
        elevation += elevationOscillation;
      } else if (ray.station === 'right') {
        azimuth -= scissorSweep;
        elevation += elevationOscillation;
      } else {
        azimuth += Math.sin(sweepPhase * 1.4 + ray.rayIndex) * 0.12;
        elevation += Math.cos(sweepPhase * 1.2) * 0.06;
      }

      // Convert spherical angles to straight 3D Cartesian endpoint
      // cos(elevation) is radius in XZ plane, sin(elevation) is Y
      const cosElev = Math.cos(elevation);
      const sinElev = Math.sin(elevation);
      const endX = ray.origin.x + Math.sin(azimuth) * cosElev * beamDistance;
      const endY = ray.origin.y + sinElev * beamDistance;
      const endZ = ray.origin.z + Math.cos(azimuth) * cosElev * beamDistance;

      ray.currentEndpoint.set(endX, endY, endZ);

      // Position straight beam cylinder between origin and endpoint
      const midpoint = new THREE.Vector3().addVectors(ray.origin, ray.currentEndpoint).multiplyScalar(0.5);
      const dist = ray.origin.distanceTo(ray.currentEndpoint);

      ray.meshGroup.position.copy(midpoint);
      ray.meshGroup.lookAt(ray.currentEndpoint);

      // Razor thinness scaled by quality and instrumental intensity
      const beamThickness = (0.35 + combinedInstEnergy * 0.25) * Math.min(1.0, laserDensity);
      ray.meshGroup.scale.set(beamThickness, beamThickness, dist);

      // Shading and intensity
      const coreMat = ray.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteCol).lerp(cyanCol, 0.2);
      coreMat.opacity = Math.min(0.95 * maxBri, (0.55 + combinedInstEnergy * 0.40) * maxBri);

      const sheathMat = ray.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(cyanCol).lerp(primaryCol, (i % 4) / 4);
      sheathMat.opacity = Math.min(0.42 * maxBri, (0.18 + combinedInstEnergy * 0.24) * maxBri);
    }

    // Emitter station flares pulsing with instrumental energy
    const flareOpacity = Math.min(0.95 * maxBri, (0.50 + combinedInstEnergy * 0.45) * maxBri);
    (this.leftStationFlare.material as THREE.MeshBasicMaterial).opacity = flareOpacity;
    (this.rightStationFlare.material as THREE.MeshBasicMaterial).opacity = flareOpacity;
    (this.centerStationFlare.material as THREE.MeshBasicMaterial).opacity = flareOpacity;

    const flareScale = 1.0 + combinedInstEnergy * 0.5;
    this.leftStationFlare.scale.set(flareScale, flareScale, flareScale);
    this.rightStationFlare.scale.set(flareScale, flareScale, flareScale);
    this.centerStationFlare.scale.set(flareScale, flareScale, flareScale);

    // -------------------------------------------------------------
    // 2. TWO TOP-OF-SCREEN BASS LASER MACHINES (WINDOW COVERAGE)
    // -------------------------------------------------------------
    const bassStem = features.stems.bass;
    const bassFactor = Math.max(0, Math.min(1.0, bassStem * 1.1 + (features.subBass || 0) * 0.9));
    const bassPulse = Math.pow(bassFactor, 1.3);
    const bassStrobe = Math.sin(time * (24.0 + bassFactor * 20.0)) * 0.15 + 0.85;

    for (let k = 0; k < this.topBassMachines.length; k++) {
      const machine = this.topBassMachines[k];

      const target = machine.target.clone();
      if (bassFactor > 0.4 && deltaSeconds > 0) {
        target.x += (Math.random() - 0.5) * 0.4 * bassFactor;
        target.y += (Math.random() - 0.5) * 0.3 * bassFactor;
      }
      if (deltaSeconds > 0) {
        machine.currentTarget.lerp(target, deltaSeconds * 12.0);
      }

      machine.group.lookAt(machine.currentTarget);

      const dist = machine.origin.distanceTo(machine.currentTarget);
      const midpoint = new THREE.Vector3().addVectors(machine.origin, machine.currentTarget).multiplyScalar(0.5);

      machine.beamGroup.position.copy(midpoint);
      machine.beamGroup.lookAt(machine.currentTarget);

      const bassThickness = (0.32 + bassPulse * 0.38) * Math.min(1.0, laserDensity);
      machine.beamGroup.scale.set(bassThickness, bassThickness, dist);

      const fanSpread = (1.0 + bassPulse * 0.9) * bassStrobe;
      machine.fanMesh.scale.set(fanSpread, 1.0, fanSpread);

      const bassLaserCol = new THREE.Color(palette.accent || 0x00f0ff);

      const coreMat = machine.coreMesh.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(whiteCol).lerp(bassLaserCol, 0.25);
      coreMat.opacity = Math.min(0.95 * maxBri, (0.45 + bassPulse * 0.55) * bassStrobe * maxBri);

      const sheathMat = machine.sheathMesh.material as THREE.MeshBasicMaterial;
      sheathMat.color.copy(bassLaserCol);
      sheathMat.opacity = Math.min(0.40 * maxBri, (0.16 + bassPulse * 0.35) * bassStrobe * maxBri);

      const fanMat = machine.fanMesh.material as THREE.MeshBasicMaterial;
      fanMat.color.copy(bassLaserCol);
      fanMat.opacity = Math.min(0.32 * maxBri, (0.08 + bassPulse * 0.28) * bassStrobe * maxBri);

      const lensMat = machine.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(bassLaserCol);
      lensMat.opacity = Math.min(0.95 * maxBri, (0.6 + bassPulse * 0.4) * maxBri);
    }
  }
}
