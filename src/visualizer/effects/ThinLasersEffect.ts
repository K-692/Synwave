/**
 * Synwave Concert Razor-Thin Lasers Effect
 * 
 * Precision concert laser arrays with 24 razor-thin laser beam projectors:
 * - Mounted on overhead truss, side towers, and stage deck lip
 * - Razor-sharp beams with high-intensity additive bloom
 * - Audio-reactive concert laser modes:
 *     1. Liquid Sky (horizontal laser sheet skimming above the crowd)
 *     2. Stadium Fan Beams (sharp fingers opening and pinching with highs)
 *     3. Scissor Cross Matrix (interlocking high-speed sweeps)
 *     4. Aerial Tunnel / Cone (circular laser envelope)
 *     5. Drop Strobe Frenzy (rapid laser burst chopping on dubstep/EDM drops)
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';

export class ThinLasersEffect extends BaseEffect {
  readonly id = 'thin-lasers';
  readonly name = 'Concert Razor-Thin Lasers';
  readonly family = 'Lasers';
  readonly cost = 'medium';

  private laserCount = 24;
  private lineMesh!: THREE.LineSegments;
  private positions!: Float32Array;
  private colors!: Float32Array;

  private beamOrigins: THREE.Vector3[] = [];
  private beamTargets: THREE.Vector3[] = [];
  private currentPattern = 0; // 0: Liquid Sky, 1: Stadium Fan, 2: Scissor Cross, 3: Drop Frenzy
  private patternTimer = 0;

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // Setup 24 laser projector positions
    this.beamOrigins = [];
    this.beamTargets = [];

    // Overhead truss lasers (12 projectors along overhead truss at y = 14.2, z = -5.0)
    for (let i = 0; i < 12; i++) {
      const x = -15 + i * (30 / 11);
      this.beamOrigins.push(new THREE.Vector3(x, 14.2, -5.0));
      this.beamTargets.push(new THREE.Vector3(x * 1.5, 0, 18.0));
    }

    // Left Wing Tower lasers (4 projectors along left truss tower)
    for (let i = 0; i < 4; i++) {
      this.beamOrigins.push(new THREE.Vector3(-17.2, 4 + i * 2.8, -5.0));
      this.beamTargets.push(new THREE.Vector3(10, 2 + i * 2, 16.0));
    }

    // Right Wing Tower lasers (4 projectors along right truss tower)
    for (let i = 0; i < 4; i++) {
      this.beamOrigins.push(new THREE.Vector3(17.2, 4 + i * 2.8, -5.0));
      this.beamTargets.push(new THREE.Vector3(-10, 2 + i * 2, 16.0));
    }

    // Stage Deck Lip lasers (4 projectors)
    for (let i = 0; i < 4; i++) {
      const x = -9 + i * 6;
      this.beamOrigins.push(new THREE.Vector3(x, -0.15, 4.8));
      this.beamTargets.push(new THREE.Vector3(x * 1.8, 12, 18.0));
    }

    this.laserCount = this.beamOrigins.length;

    // Buffer Geometry for 24 thin lines (each line has 2 vertices = 48 vertices)
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
      linewidth: 1.5, // Crisp thin laser wire
    });
    this.disposables.push(mat);

    this.lineMesh = new THREE.LineSegments(geo, mat);
    this.group.add(this.lineMesh);
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;
    const time = performance.now() * 0.001;

    // Pattern switching logic: Drops trigger instant Drop Frenzy, otherwise rotate every 12s
    this.patternTimer += deltaSeconds;
    if (features.isDrop) {
      this.currentPattern = 3; // Drop Frenzy
    } else if (this.patternTimer > 12) {
      this.currentPattern = (this.currentPattern + 1) % 3;
      this.patternTimer = 0;
    }

    const primaryCol = new THREE.Color(palette.primary);
    const secondaryCol = new THREE.Color(palette.secondary);
    const accentCol = new THREE.Color(palette.accent);
    const whiteCol = new THREE.Color(0xffffff);

    // Audio modulation
    const trebleMod = features.treble * 1.4;
    const bassMod = features.bass * 1.2;
    const fanSpread = 1.0 + features.highMid * 1.8;

    for (let i = 0; i < this.laserCount; i++) {
      const origin = this.beamOrigins[i];
      const target = this.beamTargets[i];

      const pIdx = i * 6;
      const cIdx = i * 6;

      // Start vertex (projector nozzle)
      this.positions[pIdx] = origin.x;
      this.positions[pIdx + 1] = origin.y;
      this.positions[pIdx + 2] = origin.z;

      // End vertex (target sweep based on current pattern)
      let endX = target.x;
      let endY = target.y;
      let endZ = target.z;

      if (this.currentPattern === 0) {
        // Mode 0: Liquid Sky (horizontal flat razor-thin laser plane skimming above audience)
        const wave = Math.sin(time * 3 + origin.x * 0.2) * 0.4 * (1 + bassMod);
        endY = 1.2 + wave; // Skims just over head height
        endX = origin.x * 2.2 + Math.cos(time * 2 + i) * 3;
        endZ = 22;
      } else if (this.currentPattern === 1) {
        // Mode 1: Stadium Fan Beams (sharp fingers opening/pinching with music highs)
        const angle = ((i - this.laserCount / 2) / this.laserCount) * Math.PI * 0.7 * fanSpread;
        endX = Math.sin(angle + Math.sin(time * 1.5) * 0.2) * 28;
        endY = Math.cos(angle) * 10 - 2 + trebleMod * 2;
        endZ = 20;
      } else if (this.currentPattern === 2) {
        // Mode 2: Scissor Cross Matrix (interlocking sweeping criss-cross beams)
        const sweepSpeed = time * 2.5;
        const dir = i % 2 === 0 ? 1 : -1;
        endX = Math.sin(sweepSpeed * dir + i * 0.5) * 20;
        endY = 1.5 + Math.cos(sweepSpeed * 0.5 + i) * 5;
        endZ = 20;
      } else {
        // Mode 3: Drop Frenzy (strobe chopping, frantic sweeping across the venue)
        const strobe = Math.floor(time * 16) % 2 === 0;
        const angle = Math.sin(time * 6 + i * 1.2) * Math.PI * 0.8;
        endX = Math.sin(angle) * 32;
        endY = strobe ? Math.cos(time * 8 + i) * 12 : -1;
        endZ = 20;
      }

      this.positions[pIdx + 3] = endX;
      this.positions[pIdx + 4] = endY;
      this.positions[pIdx + 5] = endZ;

      // Color computation
      let beamColor = i % 2 === 0 ? primaryCol : secondaryCol;
      if (features.isDrop) {
        beamColor = Math.random() < 0.3 ? whiteCol : accentCol;
      }

      // Nozzle point brightness
      this.colors[cIdx] = beamColor.r;
      this.colors[cIdx + 1] = beamColor.g;
      this.colors[cIdx + 2] = beamColor.b;

      // Target point brightness (fades slightly into distance)
      const fade = features.isDrop ? 1.0 : 0.8;
      this.colors[cIdx + 3] = beamColor.r * fade;
      this.colors[cIdx + 4] = beamColor.g * fade;
      this.colors[cIdx + 5] = beamColor.b * fade;
    }

    this.lineMesh.geometry.attributes.position.needsUpdate = true;
    this.lineMesh.geometry.attributes.color.needsUpdate = true;

    // Laser visibility & strobe during drop
    const mat = this.lineMesh.material as THREE.LineBasicMaterial;
    if (features.isDrop) {
      // 16Hz strobe chop on dubstep drops
      mat.opacity = Math.floor(time * 24) % 4 === 0 ? 0.3 : 1.0;
    } else {
      mat.opacity = 0.85 + features.rms * 0.15;
    }
  }
}
