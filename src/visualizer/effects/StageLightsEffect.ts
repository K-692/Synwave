/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * Professional concert stage lighting rig matching live festival stages:
 * - Volumetric light cones THROWN DIRECTLY TOWARDS THE CAMERA and sweeping across the audience
 * - White kick blinder spotlights pointed directly at the camera lens, activated on drum kicks
 *   (replacing the artificial 2D window flash with visceral 3D light beams)
 * - Dedicated STEM Separation Activation:
 *     1. BASS STEM: Drives moving-head light beam intensity, core glow, and stage floor wash!
 *     2. KICK STEM: Blasts white volumetric spotlight beams straight into the camera lens!
 *     3. INSTRUMENT STEM: Drives pan/tilt beam choreographies and dynamic sweeps across the venue!
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

interface KickBlinder {
  group: THREE.Group;
  lensMesh: THREE.Mesh;
  coneMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  intensity: number;
}

export class StageLightsEffect extends BaseEffect {
  readonly id = 'stage-lights';
  readonly name = 'Concert Moving Head Lights & Kick Blinders';
  readonly family = 'Stage Lighting';
  readonly cost = 'medium';

  private fixtures: MovingHead[] = [];
  private kickBlinders: KickBlinder[] = [];
  private washLight1!: THREE.PointLight;
  private washLight2!: THREE.PointLight;

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
    const lensGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward along local +Z axis towards the camera
    const coneLength = 30;
    const coneGeo = new THREE.ConeGeometry(3.6, coneLength, 20, 1, true);
    // Apex at (0, 0, 0) and body expanding along +Z towards +coneLength
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Body now extends along +Z
    this.disposables.push(coneGeo);

    // 1. 16 Moving-Head Fixtures mounted on the overhead box-truss
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

    for (let i = 0; i < fixturePositions.length; i++) {
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
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

      // Volumetric beam cone projecting forward along +Z towards the camera
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
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
        targetPos: new THREE.Vector3(0, 1.8, 9.2),
        currentTarget: new THREE.Vector3(0, 1.8, 9.2),
        index: i,
      });
    }

    // 2. Dedicated Kick-Activated White Spotlights (Blinders)
    // Mounted along the overhead front truss and stage lip, aiming DIRECTLY AT THE CAMERA (0, 1.8, 9.2)
    const blinderPositions = [
      new THREE.Vector3(-9.0, 11.5, 1.2),
      new THREE.Vector3(-4.5, 11.5, 1.2),
      new THREE.Vector3(0.0, 11.5, 1.2),
      new THREE.Vector3(4.5, 11.5, 1.2),
      new THREE.Vector3(9.0, 11.5, 1.2),
      new THREE.Vector3(-6.0, 0.4, 4.0),
      new THREE.Vector3(0.0, 0.4, 4.2),
      new THREE.Vector3(6.0, 0.4, 4.0),
    ];

    const blinderConeGeo = new THREE.ConeGeometry(4.2, coneLength, 16, 1, true);
    blinderConeGeo.translate(0, -coneLength / 2, 0);
    blinderConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(blinderConeGeo);

    for (let i = 0; i < blinderPositions.length; i++) {
      const pos = blinderPositions[i];
      const bGroup = new THREE.Group();
      bGroup.position.copy(pos);

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
        side: THREE.DoubleSide,
      });
      this.disposables.push(bConeMat);
      const bCone = new THREE.Mesh(blinderConeGeo, bConeMat);
      bGroup.add(bCone);

      // Aim directly at camera position (0, 1.8, 9.2)
      bGroup.lookAt(0, 1.8, 9.2);

      this.group.add(bGroup);

      this.kickBlinders.push({
        group: bGroup,
        lensMesh: bLens,
        coneMesh: bCone,
        basePos: pos,
        intensity: 0.0,
      });
    }

    // 3. Dynamic Stage Wash Point Lights (Making the screen and stage glow with the light color)
    this.washLight1 = new THREE.PointLight(0xff6600, 2.5, 38, 1.6);
    this.washLight1.position.set(-6, 7.0, -1.0);
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 2.5, 38, 1.6);
    this.washLight2.position.set(6, 7.0, -1.0);
    this.group.add(this.washLight2);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // STEM ACTIVATIONS:
    const bassStem = features.stems.bass;
    const kickStem = features.stems.kick;
    const instStem = features.stems.instruments;

    const primaryCol = new THREE.Color(palette.primary);
    const secondaryCol = new THREE.Color(palette.secondary);

    // Dynamic moving-head beam brightness directly driven by Bass STEM
    const baseBrightness = 0.20 + bassStem * 0.55 + (features.isDrop ? 0.35 : 0);

    // Camera position
    const camTarget = new THREE.Vector3(0, 1.8, 9.2);

    // 1. Moving Heads Sweeping towards Camera and Audience
    const sweepSpeed = 1.2 + instStem * 2.8;

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      // Aim beams forward towards camera / audience plane (z ~ 8.0 to 14.0)
      if (features.isDrop) {
        // High-energy drop: frantic criss-cross sweeps towards camera
        const spreadX = Math.sin(time * 3.8 + i * 0.7) * 9.0;
        const spreadY = 1.8 + Math.cos(time * 3.2 + i * 0.5) * 2.0;
        const spreadZ = 9.2 + Math.sin(time * 2.5 + i) * 3.0;
        fix.targetPos.set(spreadX, spreadY, spreadZ);
      } else {
        // Standard groove: dynamic waves fanning through the camera and front crowd
        const offset = (i / this.fixtures.length) * Math.PI * 2;
        const sweepX = Math.sin(time * sweepSpeed + offset) * 7.5;
        const sweepY = 1.8 + Math.sin(time * (sweepSpeed * 0.7) + offset * 0.5) * 1.6;
        const sweepZ = 9.2 + Math.cos(time * sweepSpeed * 0.5 + offset) * 2.5;
        fix.targetPos.set(sweepX, sweepY, sweepZ);
      }

      // Smooth target interpolation
      const smoothRate = deltaSeconds * (5.0 + instStem * 7.0);
      fix.currentTarget.lerp(fix.targetPos, smoothRate);

      // Point fixture directly at target (beam extends forward along +Z towards camera!)
      fix.group.lookAt(fix.currentTarget);

      // Color selection from palette
      const lightCol = i % 2 === 0 ? primaryCol : secondaryCol;

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(1.0, baseBrightness * 2.4);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = Math.min(0.85, baseBrightness);

      // Beam cone width expands with BASS STEM
      const beamScale = 1.0 + bassStem * 0.55;
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }

    // 2. White Spotlights Activated by Kicks (Thrown directly at the camera!)
    const isKickTrigger = (features.isKick && kickStem > 0.35) || (features.isDrop && Math.floor(time * 16) % 2 === 0);

    for (let i = 0; i < this.kickBlinders.length; i++) {
      const blinder = this.kickBlinders[i];

      if (isKickTrigger) {
        blinder.intensity = 1.0;
      } else {
        blinder.intensity = Math.max(0, blinder.intensity - deltaSeconds * 6.5);
      }

      // Always aimed at camera
      blinder.group.lookAt(camTarget);

      const bLensMat = blinder.lensMesh.material as THREE.MeshBasicMaterial;
      bLensMat.opacity = blinder.intensity;

      const bConeMat = blinder.coneMesh.material as THREE.MeshBasicMaterial;
      bConeMat.opacity = blinder.intensity * 0.85;

      const scale = 1.0 + blinder.intensity * 0.35;
      blinder.coneMesh.scale.set(scale, scale, 1.0);
    }

    // 3. Wash Lights Making Screen & Stage Glow with Spotlight Color
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = (2.0 + bassStem * 4.5) * (features.isDrop ? 1.6 : 1.0);

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = (2.0 + instStem * 4.0) * (features.isDrop ? 1.6 : 1.0);
  }
}
