/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * 16 Professional moving-head spotlight fixtures matching the user's reference photo:
 * - Mounted along the overhead aluminum box-truss grid
 * - Volumetric light cones THROWN DIRECTLY TOWARDS THE CAMERA and sweeping across the stage
 * - Dedicated STEM Separation Activation:
 *     1. BASS STEM: Drives moving-head light beam intensity, core glow, and stage floor wash!
 *     2. KICK STEM: Drives instant blinding white flash strobes on drum hits!
 *     3. INSTRUMENT STEM: Drives pan/tilt beam choreographies and dynamic sweeps across the crowd!
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
  panAngle: number;
  tiltAngle: number;
  targetPan: number;
  targetTilt: number;
  index: number;
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  private fixtures: MovingHead[] = [];
  private lightCount = 16;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Chassis geometry
    const baseGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.4, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.disposables.push(baseGeo, baseMat);

    // High-power lens flare
    const lensGeo = new THREE.SphereGeometry(0.22, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward towards the camera (cone length 32m)
    const coneLength = 32;
    const coneGeo = new THREE.ConeGeometry(3.2, coneLength, 16, 1, true);
    // Align cone so apex is at the fixture lens and body points along Z forward towards the camera
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(Math.PI / 2); // Orient forward along Z
    this.disposables.push(coneGeo);

    // 16 Fixtures mounted on the overhead box-truss (8 rear overhead, 8 front overhead)
    const fixturePositions: THREE.Vector3[] = [];

    // Rear overhead truss (8 lights across x = -13 to +13, y = 12.2, z = -4.0)
    for (let i = 0; i < 8; i++) {
      const x = -13.0 + i * (26.0 / 7);
      fixturePositions.push(new THREE.Vector3(x, 12.2, -4.0));
    }

    // Front overhead truss (8 lights across x = -12 to +12, y = 11.8, z = 1.0)
    for (let i = 0; i < 8; i++) {
      const x = -12.0 + i * (24.0 / 7);
      fixturePositions.push(new THREE.Vector3(x, 11.8, 1.0));
    }

    this.lightCount = fixturePositions.length;

    for (let i = 0; i < this.lightCount; i++) {
      const pos = fixturePositions[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(pos);

      // Fixture base chassis
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      fixtureGroup.add(baseMesh);

      // Lens
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.95,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, -0.15, 0.1);
      fixtureGroup.add(lensMesh);

      // Volumetric beam cone projecting forward towards the camera
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coneMat);

      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, -0.15, 0.1);
      fixtureGroup.add(coneMesh);

      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: pos,
        panAngle: 0,
        tiltAngle: 0.35,
        targetPan: 0,
        targetTilt: 0.35,
        index: i,
      });
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // STEM SEPARATION DRIVEN VISUALIZATIONS:
    // 1. BASS STEM: Controls moving head light beam intensity & thickness
    const bassStem = features.stems.bass;
    // 2. KICK STEM: Triggers instant kick flash lights (blinder strobe)
    const kickStem = features.stems.kick;
    // 3. INSTRUMENT STEM: Drives pan/tilt sweeps and choreographies across the stage
    const instStem = features.stems.instruments;

    const primaryCol = new THREE.Color(palette.primary);
    const secondaryCol = new THREE.Color(palette.secondary);
    const whiteCol = new THREE.Color(0xffffff);

    // Kick flash blinder check
    const isKickFlash = (features.isKick && kickStem > 0.45) || (features.isDrop && Math.floor(time * 18) % 2 === 0);

    // Beam brightness directly driven by BASS STEM
    const baseBrightness = 0.12 + bassStem * 0.45 + (features.isDrop ? 0.25 : 0);
    const finalBrightness = isKickFlash ? 0.85 : baseBrightness;

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      // Pan & Tilt choreographies driven by INSTRUMENT STEM & time
      // The beams are THROWN TOWARDS THE CAMERA (tiltAngle pointing down & forward into the audience)
      const sweepSpeed = 1.0 + instStem * 2.5;

      if (features.isDrop) {
        // Drop mode: Frantic criss-cross sweeps towards audience
        fix.targetPan = Math.sin(time * 4.0 + i * 0.6) * 0.75;
        fix.targetTilt = 0.32 + Math.cos(time * 3.5 + i * 0.4) * 0.25;
      } else {
        // Standard groove: Wave motion sweeping across stage and crowd
        const offset = (i / this.fixtures.length) * Math.PI * 2;
        fix.targetPan = Math.sin(time * sweepSpeed + offset) * 0.55;
        // Tilt slightly down and forward towards the camera (z ~ 16.5)
        fix.targetTilt = 0.35 + Math.sin(time * (sweepSpeed * 0.8) + offset * 0.5) * 0.22;
      }

      // Smooth interpolation
      const smoothRate = deltaSeconds * (6.0 + instStem * 8.0);
      fix.panAngle = this.lerp(fix.panAngle, fix.targetPan, smoothRate);
      fix.tiltAngle = this.lerp(fix.tiltAngle, fix.targetTilt, smoothRate);

      // Apply rotation: Y is pan, X is tilt forward towards the camera
      fix.group.rotation.set(0, 0, 0);
      fix.group.rotation.y = fix.panAngle;
      fix.group.rotation.x = fix.tiltAngle;

      // Color selection: Kick flash turns lights pure brilliant white; otherwise palette
      let lightCol = i % 2 === 0 ? primaryCol : secondaryCol;
      if (isKickFlash) {
        lightCol = whiteCol;
      }

      // Update materials
      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(1.0, finalBrightness * 2.2);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = finalBrightness;

      // Volumetric beam width expands with BASS STEM
      const beamScale = 1.0 + bassStem * 0.4;
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }
  }
}
