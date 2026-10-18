/**
 * Synwave Concert Moving-Head Stage Lights Effect
 * 
 * Professional concert stage lighting rig matching live festival stages:
 * - Transparent, elegant volumetric light cones thrown towards audience and camera
 * - Fanned white kick blinder spotlights activated on sharp drum kicks (never blinding out the scene)
 * - Subtle ambient stage wash that complements the black stage screen without washing it out
 * - Dedicated STEM Separation Activation:
 *     1. BASS STEM: Drives moving-head light beam intensity, core glow, and stage floor wash
 *     2. KICK STEM: Drives crisp white volumetric blinder flashes
 *     3. INSTRUMENT STEM: Drives pan/tilt beam choreographies across the stage
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
  targetPos: THREE.Vector3;
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
    const baseGeo = new THREE.CylinderGeometry(0.25, 0.32, 0.35, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.disposables.push(baseGeo, baseMat);

    // High-power lens flare
    const lensGeo = new THREE.SphereGeometry(0.20, 10, 10);
    this.disposables.push(lensGeo);

    // Volumetric Light Cone thrown forward along local +Z axis towards audience
    const coneLength = 24;
    const coneGeo = new THREE.ConeGeometry(1.2, coneLength, 16, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Body extends along +Z
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
        opacity: 0.85,
      });
      this.disposables.push(lensMat);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.1);
      fixtureGroup.add(lensMesh);

      // Volumetric beam cone: FrontSide and subtle opacity prevents screen blowout
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.10,
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

    // 2. Dedicated Kick-Activated White Spotlights (Blinders)
    // Mounted along the overhead front truss and stage lip, fanned forward into the audience space
    const blinderConfigs = [
      { pos: new THREE.Vector3(-9.0, 11.5, 1.2), tgt: new THREE.Vector3(-7.5, 1.8, 16.0) },
      { pos: new THREE.Vector3(-4.5, 11.5, 1.2), tgt: new THREE.Vector3(-3.5, 2.0, 16.0) },
      { pos: new THREE.Vector3(0.0, 11.5, 1.2), tgt: new THREE.Vector3(0.0, 2.2, 16.0) },
      { pos: new THREE.Vector3(4.5, 11.5, 1.2), tgt: new THREE.Vector3(3.5, 2.0, 16.0) },
      { pos: new THREE.Vector3(9.0, 11.5, 1.2), tgt: new THREE.Vector3(7.5, 1.8, 16.0) },
      { pos: new THREE.Vector3(-5.5, 0.4, 4.0), tgt: new THREE.Vector3(-4.5, 1.6, 16.0) },
      { pos: new THREE.Vector3(0.0, 0.4, 4.2), tgt: new THREE.Vector3(0.0, 1.6, 16.0) },
      { pos: new THREE.Vector3(5.5, 0.4, 4.0), tgt: new THREE.Vector3(4.5, 1.6, 16.0) },
    ];

    const blinderConeGeo = new THREE.ConeGeometry(0.7, 18, 14, 1, true);
    blinderConeGeo.translate(0, -9, 0);
    blinderConeGeo.rotateX(-Math.PI / 2);
    this.disposables.push(blinderConeGeo);

    for (let i = 0; i < blinderConfigs.length; i++) {
      const cfg = blinderConfigs[i];
      const bGroup = new THREE.Group();
      bGroup.position.copy(cfg.pos);

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
        side: THREE.FrontSide,
      });
      this.disposables.push(bConeMat);
      const bCone = new THREE.Mesh(blinderConeGeo, bConeMat);
      bGroup.add(bCone);

      bGroup.lookAt(cfg.tgt);

      this.group.add(bGroup);

      this.kickBlinders.push({
        group: bGroup,
        lensMesh: bLens,
        coneMesh: bCone,
        basePos: cfg.pos,
        targetPos: cfg.tgt,
        intensity: 0.0,
      });
    }

    // 3. Dynamic Stage Wash Point Lights (Subtle ambient fill that never bleeds to pure white)
    this.washLight1 = new THREE.PointLight(0xff6600, 0.6, 25, 1.8);
    this.washLight1.position.set(-6, 6.0, -1.0);
    this.group.add(this.washLight1);

    this.washLight2 = new THREE.PointLight(0xff0077, 0.6, 25, 1.8);
    this.washLight2.position.set(6, 6.0, -1.0);
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

    // Dynamic moving-head beam brightness (controlled and translucent)
    const baseBrightness = 0.07 + bassStem * 0.08 + (features.isDrop ? 0.05 : 0);

    // 1. Moving Heads Sweeping across Venue
    const sweepSpeed = 1.0 + instStem * 2.2;

    for (let i = 0; i < this.fixtures.length; i++) {
      const fix = this.fixtures[i];

      if (features.isDrop) {
        // High-energy drop sweeps
        const spreadX = Math.sin(time * 3.2 + i * 0.6) * 11.0;
        const spreadY = 2.0 + Math.cos(time * 2.8 + i * 0.4) * 2.2;
        const spreadZ = 14.0 + Math.sin(time * 2.0 + i) * 3.0;
        fix.targetPos.set(spreadX, spreadY, spreadZ);
      } else {
        // Standard groove: dynamic waves fanning forward through the arena
        const offset = (i / this.fixtures.length) * Math.PI * 2;
        const sweepX = Math.sin(time * sweepSpeed + offset) * 9.0;
        const sweepY = 2.0 + Math.sin(time * (sweepSpeed * 0.6) + offset * 0.5) * 1.8;
        const sweepZ = 14.0 + Math.cos(time * sweepSpeed * 0.4 + offset) * 2.5;
        fix.targetPos.set(sweepX, sweepY, sweepZ);
      }

      // Smooth target interpolation
      const smoothRate = deltaSeconds * (4.0 + instStem * 6.0);
      fix.currentTarget.lerp(fix.targetPos, smoothRate);

      // Point fixture at target
      fix.group.lookAt(fix.currentTarget);

      // Color selection from palette
      const lightCol = i % 2 === 0 ? primaryCol : secondaryCol;

      const lensMat = fix.lensMesh.material as THREE.MeshBasicMaterial;
      lensMat.color.copy(lightCol);
      lensMat.opacity = Math.min(0.9, baseBrightness * 4.0);

      const coneMat = fix.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(lightCol);
      coneMat.opacity = Math.min(0.16, baseBrightness);

      // Beam cone width expands slightly with BASS STEM
      const beamScale = 1.0 + bassStem * 0.35;
      fix.coneMesh.scale.set(beamScale, beamScale, 1.0);
    }

    // 2. White Spotlights Activated by Sharp Kicks
    const isKickTrigger = features.isKick && kickStem > 0.45;

    for (let i = 0; i < this.kickBlinders.length; i++) {
      const blinder = this.kickBlinders[i];

      if (isKickTrigger) {
        blinder.intensity = 1.0;
      } else {
        blinder.intensity = Math.max(0, blinder.intensity - deltaSeconds * 7.5);
      }

      const bLensMat = blinder.lensMesh.material as THREE.MeshBasicMaterial;
      bLensMat.opacity = blinder.intensity * 0.85;

      const bConeMat = blinder.coneMesh.material as THREE.MeshBasicMaterial;
      bConeMat.opacity = blinder.intensity * 0.15; // Controlled translucency (never blinds camera)

      const scale = 1.0 + blinder.intensity * 0.25;
      blinder.coneMesh.scale.set(scale, scale, 1.0);
    }

    // 3. Wash Lights Making Screen & Stage Glow with Spotlight Color (Subtle, never washed out)
    this.washLight1.color.copy(primaryCol);
    this.washLight1.intensity = 0.5 + bassStem * 0.5;

    this.washLight2.color.copy(secondaryCol);
    this.washLight2.intensity = 0.5 + instStem * 0.5;
  }
}
