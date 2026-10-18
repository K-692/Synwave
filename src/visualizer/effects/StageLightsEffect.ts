/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * 14 Professional moving-head spotlight fixtures with volumetric light beams:
 * - 8 fixtures mounted along the overhead rear truss
 * - 6 fixtures mounted along the front lighting truss
 * - Volumetric light cones with soft additive falloff
 * - Intelligent pan/tilt choreographies:
 *     1. Arena Audience Sweep
 *     2. Cross-Stage Braid
 *     3. Stage Floor Wash
 *     4. Blinder Strobe Drop Focus
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
  beamLength: number;
  index: number;
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  private fixtures: MovingHead[] = [];
  private lightCount = 14;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Shared Fixture Geometries
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x161922,
      roughness: 0.4,
      metalness: 0.8,
    });
    this.disposables.push(baseGeo, baseMat);

    // Glowing Lens
    const lensGeo = new THREE.SphereGeometry(0.2, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone
    const coneLength = 35;
    const coneGeo = new THREE.ConeGeometry(3.5, coneLength, 16, 1, true);
    // Orient cone so apex is at fixture and it projects downwards/forwards
    coneGeo.translate(0, -coneLength / 2, 0);
    this.disposables.push(coneGeo);

    // Setup 14 fixture positions
    const fixturePositions: THREE.Vector3[] = [];

    // Rear overhead truss (8 lights at y = 14.2, z = -5.0)
    for (let i = 0; i < 8; i++) {
      const x = -14 + i * (28 / 7);
      fixturePositions.push(new THREE.Vector3(x, 14.2, -5.0));
    }

    // Front truss (6 lights at y = 12.8, z = 3.0)
    for (let i = 0; i < 6; i++) {
      const x = -12.5 + i * 5;
      fixturePositions.push(new THREE.Vector3(x, 12.8, 3.0));
    }

    this.lightCount = fixturePositions.length;

    for (let i = 0; i < this.lightCount; i++) {
      const pos = fixturePositions[i];
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.copy(pos);

      // Chassis
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
      lensMesh.position.set(0, -0.2, 0);
      fixtureGroup.add(lensMesh);

      // Volumetric Beam Cone
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(coneMat);
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, -0.2, 0);
      fixtureGroup.add(coneMesh);

      this.group.add(fixtureGroup);

      this.fixtures.push({
        group: fixtureGroup,
        baseMesh,
        lensMesh,
        coneMesh,
        basePos: pos,
        panAngle: 0,
        tiltAngle: 0.5,
        targetPan: 0,
        targetTilt: 0.5,
        beamLength: coneLength,
        index: i,
      });
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    const primaryCol = new THREE.Color(palette.primary);
    const secondaryCol = new THREE.Color(palette.secondary);
    const whiteCol = new THREE.Color(0xffffff);

    // Audio responsiveness
    const isStrobe = features.isDrop && (Math.floor(time * 16) % 2 === 0);
    const beamBrightness = isStrobe
      ? 0.55
      : 0.15 + features.rms * 0.25 + (features.isKick ? 0.2 : 0);

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      // Pan & Tilt calculations based on music mode and rhythm
      if (features.isDrop) {
        // Drop: Dynamic criss-cross sweeps and crowd blinders
        fix.targetPan = Math.sin(time * 3.5 + i * 0.8) * 0.8;
        fix.targetTilt = 0.5 + Math.cos(time * 2.8 + i * 0.5) * 0.45;
      } else if (features.musicMode === 'calm') {
        // Calm: Slow, majestic breathing sweeps
        fix.targetPan = Math.sin(time * 0.5 + i * 0.3) * 0.4;
        fix.targetTilt = 0.6 + Math.cos(time * 0.4 + i * 0.2) * 0.2;
      } else {
        // Standard Groove: Synchronized wave motions
        const offset = (i / this.fixtures.length) * Math.PI * 2;
        fix.targetPan = Math.sin(time * 1.5 + offset) * 0.6;
        fix.targetTilt = 0.65 + Math.sin(time * 2.0 + offset * 0.5) * 0.3;
      }

      // Smooth interpolation
      const smoothSpeed = features.isDrop ? deltaSeconds * 12 : deltaSeconds * 4.5;
      fix.panAngle = this.lerp(fix.panAngle, fix.targetPan, smoothSpeed);
      fix.tiltAngle = this.lerp(fix.tiltAngle, fix.targetTilt, smoothSpeed);

      // Apply rotation to fixture group
      fix.group.rotation.set(0, 0, 0);
      fix.group.rotation.y = fix.panAngle;
      fix.group.rotation.x = fix.tiltAngle;

      // Color selection
      let lightCol = i % 2 === 0 ? primaryCol : secondaryCol;
      if (isStrobe || (features.isKick && features.kickIntensity > 0.8)) {
        lightCol = whiteCol;
      }

      // Update materials
      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(1.0, beamBrightness * 2.5);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = beamBrightness;
    }
  }
}
