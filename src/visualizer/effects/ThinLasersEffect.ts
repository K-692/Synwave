/**
 * Synwave Concert Razor-Thin Lasers Effect
 * 
 * 28 Precision concert laser projectors matching the user's reference photo:
 * - Projected directly TOWARDS THE CAMERA / AUDIENCE cutting through the darkness
 * - Sweeping and slicing dynamically across the stage floor and stadium wings
 * - Dedicated STEM Activation: Triggered and modulated by the INSTRUMENT STEM
 *     (Synths, guitars, keyboards, melodic leads)
 * - Intense electric cyan, blue, and white razor beams with additive bloom
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class ThinLasersEffect extends BaseEffect {
  readonly id = 'thin-lasers';
  readonly name = 'Concert Razor-Thin Lasers';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private laserCount = 28;
  private lineMesh!: THREE.LineSegments;
  private positions!: Float32Array;
  private colors!: Float32Array;

  private beamOrigins: THREE.Vector3[] = [];
  private beamTargets: THREE.Vector3[] = [];
  private currentPattern = 0; // 0: Crowd Pierce, 1: Stage Wing Slicers, 2: Stadium Horizon Fan, 3: Drop Frenzy
  private patternTimer = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    this.beamOrigins = [];
    this.beamTargets = [];

    // 1. Stage Left Wing Lasers (8 projectors mounted on left truss tower)
    // Shooting across and forward towards the camera (matching the blue lasers in photo)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      this.beamOrigins.push(new THREE.Vector3(-12.8, y, -4.0));
      this.beamTargets.push(new THREE.Vector3(4.0 + i * 1.5, 0.5 + i * 0.4, 22.0));
    }

    // 2. Stage Right Wing Lasers (8 projectors mounted on right truss tower)
    // Shooting across and forward towards the camera (matching the blue lasers in photo)
    for (let i = 0; i < 8; i++) {
      const y = 2.0 + i * 1.3;
      this.beamOrigins.push(new THREE.Vector3(12.8, y, -4.0));
      this.beamTargets.push(new THREE.Vector3(-4.0 - i * 1.5, 0.5 + i * 0.4, 22.0));
    }

    // 3. Overhead Truss Lasers (8 projectors spanning above the screen)
    // Shooting downward and forward straight towards the camera
    for (let i = 0; i < 8; i++) {
      const x = -10.5 + i * 3.0;
      this.beamOrigins.push(new THREE.Vector3(x, 11.5, -4.2));
      this.beamTargets.push(new THREE.Vector3(x * 1.8, -0.5, 22.0));
    }

    // 4. Stage Deck Lip Lasers (4 projectors)
    // Fanning upward and forward into the crowd
    for (let i = 0; i < 4; i++) {
      const x = -7.5 + i * 5.0;
      this.beamOrigins.push(new THREE.Vector3(x, -0.2, 3.8));
      this.beamTargets.push(new THREE.Vector3(x * 2.2, 8.5, 20.0));
    }

    this.laserCount = this.beamOrigins.length;

    // Line segments buffer: 2 vertices per beam = 2 * 3 floats
    this.positions = new Float32Array(this.laserCount * 2 * 3);
    this.colors = new Float32Array(this.laserCount * 2 * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.disposables.push(geo);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      linewidth: 1.5,
    });
    this.disposables.push(mat);

    this.lineMesh = new THREE.LineSegments(geo, mat);
    this.group.add(this.lineMesh);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // STEM TRIGGER: Instrument STEM directly controls laser intensity and movement!
    const instStem = features.stems.instruments;
    const kickStem = features.stems.kick;

    // Pattern rotation
    this.patternTimer += deltaSeconds;
    if (features.isDrop) {
      this.currentPattern = 3; // Drop frenzy
    } else if (this.patternTimer > 10) {
      this.currentPattern = (this.currentPattern + 1) % 3;
      this.patternTimer = 0;
    }

    // Laser colors: Electric Cyan / Blue / White (matching the lasers in the reference photo)
    const cyanLaser = new THREE.Color(0x00f0ff);
    const royalBlueLaser = new THREE.Color(0x1a75ff);
    const whiteLaser = new THREE.Color(0xffffff);
    const dropLaser = new THREE.Color(palette.primary);

    for (let i = 0; i < this.laserCount; i++) {
      const origin = this.beamOrigins[i];
      const target = this.beamTargets[i];

      const pIdx = i * 6;
      const cIdx = i * 6;

      // Projector nozzle origin
      this.positions[pIdx] = origin.x;
      this.positions[pIdx + 1] = origin.y;
      this.positions[pIdx + 2] = origin.z;

      // End target: ALWAYS thrown towards the camera (z ~ 20 to 24), and moving across the stage!
      let endX = target.x;
      let endY = target.y;
      let endZ = 22.0; // Pierces directly towards the viewer/camera

      if (this.currentPattern === 0) {
        // Pattern 0: Crowd Pierce (Horizontal laser needles slicing towards camera)
        const sweep = Math.sin(time * 2.5 + i * 0.4) * 6.0 * (1 + instStem);
        endX = target.x + sweep;
        endY = target.y + Math.cos(time * 2.0 + i) * 1.5;
      } else if (this.currentPattern === 1) {
        // Pattern 1: Scissor Matrix (Beams crossing diagonally over the audience)
        const dir = i % 2 === 0 ? 1 : -1;
        const scissor = Math.sin(time * 3.2 * dir + i * 0.3) * 12.0 * instStem;
        endX = (target.x > 0 ? 8 : -8) + scissor;
        endY = 1.0 + Math.cos(time * 2.0 + i) * 4.0;
      } else if (this.currentPattern === 2) {
        // Pattern 2: Stadium Horizon Fan (Broad sweeping fan opening with instrument highs)
        const fanAngle = ((i - this.laserCount / 2) / this.laserCount) * Math.PI * 0.8 * (1 + instStem);
        endX = Math.sin(fanAngle + Math.sin(time) * 0.2) * 26.0;
        endY = 2.0 + Math.cos(fanAngle) * 5.0;
      } else {
        // Pattern 3: Drop Frenzy (Strobe chopping, fast sweeps)
        const strobe = Math.floor(time * 18) % 2 === 0;
        endX = Math.sin(time * 8.0 + i * 1.4) * 28.0;
        endY = strobe ? Math.cos(time * 9.0 + i) * 8.0 : 0.5;
      }

      this.positions[pIdx + 3] = endX;
      this.positions[pIdx + 4] = endY;
      this.positions[pIdx + 5] = endZ;

      // Color computation: Instrument active -> bright cyan/white laser beams
      let beamColor = i % 2 === 0 ? cyanLaser : royalBlueLaser;
      if (features.isDrop || kickStem > 0.7) {
        beamColor = Math.random() < 0.25 ? whiteLaser : dropLaser;
      }

      this.colors[cIdx] = beamColor.r;
      this.colors[cIdx + 1] = beamColor.g;
      this.colors[cIdx + 2] = beamColor.b;

      // Target intensity
      const beamBrightness = 0.4 + instStem * 0.6;
      this.colors[cIdx + 3] = beamColor.r * beamBrightness;
      this.colors[cIdx + 4] = beamColor.g * beamBrightness;
      this.colors[cIdx + 5] = beamColor.b * beamBrightness;
    }

    this.lineMesh.geometry.attributes.position.needsUpdate = true;
    this.lineMesh.geometry.attributes.color.needsUpdate = true;

    // Laser overall opacity driven by Instrument STEM
    const mat = this.lineMesh.material as THREE.LineBasicMaterial;
    mat.opacity = 0.5 + instStem * 0.5;
  }
}
