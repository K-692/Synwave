/**
 * Synwave Coordinated Full-Screen Spotlight Movement Controller
 * ==============================================================
 *
 * Implements 10 full-screen movement path families that traverse the entire
 * visualization viewport (including meaningful areas outside all 4 sides of the
 * central YouTube iframe), driven by the instrument-frequency angular reference.
 *
 * Synchronized Groups:
 * 1. Left Group: All left-side spotlights move in synchronization with each other.
 * 2. Right Group: All right-side spotlights move in synchronization with each other,
 *    following the opposite angular reference theta_R = wrap360(-theta + theta_R0),
 *    with spatial trajectory variation to prevent repetitive central "X" mirroring.
 * 3. Top Group: All top-side spotlights move in synchronization with each other.
 * 4. Two White Bottom Spotlights: Synchronized upward-sweeping sky searchlights
 *    that NEVER change beam direction on kick events.
 *
 * Path Families:
 * 1. wide-horizontal: Sweeps across the complete viewport from far left to far right.
 * 2. wide-vertical: Sweeps from bottom stage floor through the upper arena ceiling.
 * 3. perimeter: Traces outer boundaries framing the stage and central iframe.
 * 4. diagonal: Crosses diagonally with varied crossing points across the screen.
 * 5. arc-fan: Broad curved fan-shaped sweeps radiating outward.
 * 6. outer-to-inner: Sweeps from outer stadium periphery inward toward intermediate framing.
 * 7. inner-to-outer: Travels outward from stage toward outer arena darkness.
 * 8. circular-elliptical: Broad elliptical orbits surrounding the visualization.
 * 9. asymmetric: Left and right groups cover distinct independent regions without mirroring.
 * 10. slow-cinematic: Gradual, majestic, long-wavelength sweeps tailored for solos.
 */

import * as THREE from 'three';
import type { StageDimensions } from '../stage/stageDimensions';

export type MovementPathFamily =
  | 'wide-horizontal'
  | 'wide-vertical'
  | 'perimeter'
  | 'diagonal'
  | 'arc-fan'
  | 'outer-to-inner'
  | 'inner-to-outer'
  | 'circular-elliptical'
  | 'asymmetric'
  | 'slow-cinematic';

export interface SpotlightTargetCoordinates {
  left: THREE.Vector3;
  right: THREE.Vector3;
  top: THREE.Vector3;
  whiteLeft: THREE.Vector3;
  whiteRight: THREE.Vector3;
}

export class SpotlightMovementController {
  private currentPath: MovementPathFamily = 'wide-horizontal';
  private targetPath: MovementPathFamily = 'wide-horizontal';
  private pathTransitionProgress: number = 1.0; // 1.0 = fully transitioned
  private readonly pathTransitionDuration: number = 1.6; // seconds

  // Path rotation timeline
  private pathCycleTimer: number = 0;
  private readonly pathCycleInterval: number = 14.0; // seconds per path in verses

  // Kick impulse state for main coloured spotlights
  private kickImpulseFactor: number = 0.0;
  private currentKickTarget: {
    left: THREE.Vector3;
    right: THREE.Vector3;
    top: THREE.Vector3;
  } = {
    left: new THREE.Vector3(0, 0, 0),
    right: new THREE.Vector3(0, 0, 0),
    top: new THREE.Vector3(0, 0, 0),
  };
  private lastKickTimestampSec: number = -1.0;

  // Temporary vectors for zero-allocation computation
  private tmpLeftA = new THREE.Vector3();
  private tmpLeftB = new THREE.Vector3();
  private tmpRightA = new THREE.Vector3();
  private tmpRightB = new THREE.Vector3();
  private tmpTopA = new THREE.Vector3();
  private tmpTopB = new THREE.Vector3();
  private tmpWhiteLeftA = new THREE.Vector3();
  private tmpWhiteLeftB = new THREE.Vector3();
  private tmpWhiteRightA = new THREE.Vector3();
  private tmpWhiteRightB = new THREE.Vector3();

  /**
   * Evaluates the active path selection based on musical context (verse vs solo vs calm).
   */
  public updatePathSelection(
    sectionType: 'verse' | 'solo' | 'inactive',
    trackTimeSeconds: number,
    deltaSeconds: number
  ): void {
    if (deltaSeconds <= 0) return;

    if (sectionType === 'solo') {
      // Solos favor slow cinematic, wide horizontal, or broad arc-fan sweeps
      const soloCycle = Math.floor(trackTimeSeconds / 18.0) % 3;
      const soloPaths: MovementPathFamily[] = ['slow-cinematic', 'arc-fan', 'wide-horizontal'];
      const desired = soloPaths[soloCycle];
      if (desired !== this.targetPath) {
        this.switchPath(desired);
      }
    } else {
      // Verses cycle through varied dynamic paths every 14 seconds
      this.pathCycleTimer += deltaSeconds;
      if (this.pathCycleTimer >= this.pathCycleInterval) {
        this.pathCycleTimer = 0;
        const versePaths: MovementPathFamily[] = [
          'wide-horizontal',
          'perimeter',
          'diagonal',
          'arc-fan',
          'circular-elliptical',
          'asymmetric',
          'inner-to-outer',
          'outer-to-inner',
          'wide-vertical',
        ];
        const nextIdx = (versePaths.indexOf(this.targetPath) + 1) % versePaths.length;
        this.switchPath(versePaths[nextIdx]);
      }
    }

    if (this.pathTransitionProgress < 1.0) {
      this.pathTransitionProgress = Math.min(
        1.0,
        this.pathTransitionProgress + deltaSeconds / this.pathTransitionDuration
      );
      if (this.pathTransitionProgress >= 1.0) {
        this.currentPath = this.targetPath;
      }
    }

    // Decay kick direction impulse smoothly over ~180-220ms
    if (this.kickImpulseFactor > 0.001) {
      this.kickImpulseFactor = Math.max(0, this.kickImpulseFactor - deltaSeconds * 4.8);
    } else {
      this.kickImpulseFactor = 0;
    }
  }

  /**
   * Smoothly initiates a transition to a new movement path family.
   */
  public switchPath(newPath: MovementPathFamily): void {
    if (newPath === this.targetPath) return;
    this.currentPath = this.pathTransitionProgress >= 0.5 ? this.targetPath : this.currentPath;
    this.targetPath = newPath;
    this.pathTransitionProgress = 0.0;
  }

  /**
   * Triggers a temporary kick-synchronized direction jump for main coloured spotlights.
   * Debounced with >= 120ms separation. Precomputed targets from pre-analysis are prioritized.
   */
  public triggerKickDirectionChange(
    timestampSec: number,
    intensity: number,
    precomputedTarget?: {
      left: [number, number, number];
      right: [number, number, number];
      top: [number, number, number];
    }
  ): void {
    if (timestampSec - this.lastKickTimestampSec < 0.12) {
      return; // Debounce
    }
    this.lastKickTimestampSec = timestampSec;

    if (precomputedTarget) {
      this.currentKickTarget.left.set(
        precomputedTarget.left[0],
        precomputedTarget.left[1],
        precomputedTarget.left[2]
      );
      this.currentKickTarget.right.set(
        precomputedTarget.right[0],
        precomputedTarget.right[1],
        precomputedTarget.right[2]
      );
      this.currentKickTarget.top.set(
        precomputedTarget.top[0],
        precomputedTarget.top[1],
        precomputedTarget.top[2]
      );
    } else {
      // Deterministic fallback targets spanning full screen
      const ang = (timestampSec * 3.7) % (Math.PI * 2);
      const radX = 14.0 + (intensity * 4.0);
      const radY = 4.5 + (intensity * 3.5);
      this.currentKickTarget.left.set(
        Math.cos(ang) * radX,
        7.0 + Math.sin(ang) * radY,
        14.0
      );
      this.currentKickTarget.right.set(
        -Math.cos(ang) * radX,
        7.0 + Math.sin(ang) * radY,
        14.0
      );
      this.currentKickTarget.top.set(
        Math.sin(ang * 1.5) * 12.0,
        3.5 + Math.cos(ang) * 4.0,
        14.0
      );
    }

    this.kickImpulseFactor = 1.0;
  }

  /**
   * Resets active impulse timers on media seek or track restart.
   */
  public resetImpulses(): void {
    this.kickImpulseFactor = 0;
    this.lastKickTimestampSec = -1.0;
  }

  /**
   * Computes the 3D target coordinates for all spotlight groups at the current timestamp,
   * fully traversing the visualization viewport outside the YouTube iframe.
   */
  public computeGroupTargets(
    thetaRad: number,
    trackTimeSec: number,
    dims: StageDimensions
  ): SpotlightTargetCoordinates {
    // 1. Calculate base targets for currentPath
    this.samplePath(
      this.currentPath,
      thetaRad,
      trackTimeSec,
      dims,
      this.tmpLeftA,
      this.tmpRightA,
      this.tmpTopA,
      this.tmpWhiteLeftA,
      this.tmpWhiteRightA
    );

    let left = this.tmpLeftA;
    let right = this.tmpRightA;
    let top = this.tmpTopA;
    let whiteLeft = this.tmpWhiteLeftA;
    let whiteRight = this.tmpWhiteRightA;

    // 2. If interpolating between paths, sample targetPath and blend using smoothstep
    if (this.pathTransitionProgress < 1.0) {
      this.samplePath(
        this.targetPath,
        thetaRad,
        trackTimeSec,
        dims,
        this.tmpLeftB,
        this.tmpRightB,
        this.tmpTopB,
        this.tmpWhiteLeftB,
        this.tmpWhiteRightB
      );

      // Smoothstep curve for seamless aesthetic transitions
      const t = this.pathTransitionProgress;
      const smoothT = t * t * (3 - 2 * t);

      this.tmpLeftA.lerp(this.tmpLeftB, smoothT);
      this.tmpRightA.lerp(this.tmpRightB, smoothT);
      this.tmpTopA.lerp(this.tmpTopB, smoothT);
      this.tmpWhiteLeftA.lerp(this.tmpWhiteLeftB, smoothT);
      this.tmpWhiteRightA.lerp(this.tmpWhiteRightB, smoothT);
    }

    // 3. Apply kick direction jump override to main colored spotlights (left, right, top)
    // White bottom spotlights NEVER change beam direction on kicks!
    if (this.kickImpulseFactor > 0.005) {
      const kFactor = this.kickImpulseFactor;
      left.lerp(this.currentKickTarget.left, kFactor);
      right.lerp(this.currentKickTarget.right, kFactor);
      top.lerp(this.currentKickTarget.top, kFactor);
    }

    return {
      left,
      right,
      top,
      whiteLeft,
      whiteRight,
    };
  }

  /**
   * Mathematical generator for the 10 full-screen movement path families.
   * Trajectories reach far outside the iframe on all sides:
   * Viewport bounds: X in [-20, 20], Y in [0.5, 15], Z in [12.5, 15.5]
   */
  private samplePath(
    family: MovementPathFamily,
    thetaRad: number,
    tSec: number,
    dims: StageDimensions,
    outLeft: THREE.Vector3,
    outRight: THREE.Vector3,
    outTop: THREE.Vector3,
    outWhiteLeft: THREE.Vector3,
    outWhiteRight: THREE.Vector3
  ): void {
    // Shared angular parameters
    // Left group advances with thetaRad
    const alphaLeft = thetaRad + tSec * 0.45;
    // Right group advances with opposite angular relationship wrap360(-theta + offset)
    const alphaRight = -thetaRad + tSec * 0.45 + Math.PI * 0.35;

    // Stage dimensions references
    const halfW = dims.halfWidth;
    const halfH = dims.halfHeight;
    const cy = dims.screenCenterY;
    const zPlane = 14.0;

    // Viewport outer reach: well beyond iframe edges (iframe is at X = +/- halfW)
    const xMax = Math.max(18.0, halfW + 6.5);
    const yMax = Math.max(14.0, cy + halfH + 4.5);
    const yMin = Math.max(0.5, cy - halfH - 2.5);

    switch (family) {
      case 'wide-horizontal': {
        // Sweeps horizontally across the entire screen from far left to far right
        const xPosL = Math.sin(alphaLeft) * xMax;
        const yPosL = cy + Math.cos(2.0 * alphaLeft) * (halfH * 0.65);
        outLeft.set(xPosL, yPosL, zPlane);

        // Right group sweeps with phase offset so beams do not collide at center
        const xPosR = Math.sin(alphaRight) * xMax;
        const yPosR = cy + Math.sin(2.0 * alphaRight) * (halfH * 0.65);
        outRight.set(xPosR, yPosR, zPlane);

        // Top group executes high lateral sweep
        outTop.set(Math.cos(alphaLeft * 1.2) * (xMax * 0.8), yMax - 1.5, zPlane);
        break;
      }

      case 'wide-vertical': {
        // Sweeps through upper and lower screen regions
        const yRange = (yMax - yMin) * 0.5;
        const yCenter = (yMax + yMin) * 0.5;

        // Left group sweeps vertically on left flank
        const yPosL = yCenter + Math.sin(alphaLeft) * yRange;
        const xPosL = -(halfW + 3.5 + Math.cos(alphaLeft * 0.5) * 4.0);
        outLeft.set(xPosL, yPosL, zPlane);

        // Right group sweeps vertically on right flank
        const yPosR = yCenter + Math.sin(alphaRight) * yRange;
        const xPosR = halfW + 3.5 + Math.cos(alphaRight * 0.5) * 4.0;
        outRight.set(xPosR, yPosR, zPlane);

        // Top group dips down and up
        outTop.set(Math.sin(alphaLeft) * 8.0, yCenter + Math.cos(alphaLeft) * yRange, zPlane);
        break;
      }

      case 'perimeter': {
        // Travels around the outer regions of the visualization framing the iframe
        const boxT = (alphaLeft / (Math.PI * 2)) % 1.0;
        const pNorm = (boxT + 1.0) % 1.0; // [0, 1] perimeter loop

        // 4 quadrants around outer frame
        let pXL = 0, pYL = 0;
        if (pNorm < 0.25) {
          // Bottom edge: left to right
          const sub = pNorm / 0.25;
          pXL = -xMax + sub * (2 * xMax);
          pYL = yMin;
        } else if (pNorm < 0.50) {
          // Right edge: bottom to top
          const sub = (pNorm - 0.25) / 0.25;
          pXL = xMax;
          pYL = yMin + sub * (yMax - yMin);
        } else if (pNorm < 0.75) {
          // Top edge: right to left
          const sub = (pNorm - 0.50) / 0.25;
          pXL = xMax - sub * (2 * xMax);
          pYL = yMax;
        } else {
          // Left edge: top to bottom
          const sub = (pNorm - 0.75) / 0.25;
          pXL = -xMax;
          pYL = yMax - sub * (yMax - yMin);
        }
        outLeft.set(pXL, pYL, zPlane);

        // Right group follows counter-clockwise on perimeter
        outRight.set(-pXL, pYL, zPlane);
        outTop.set(Math.sin(alphaLeft) * (xMax * 0.75), yMax - 0.8, zPlane);
        break;
      }

      case 'diagonal': {
        // Traverses diagonally with varied crossing points
        const diagL = Math.sin(alphaLeft);
        outLeft.set(
          diagL * xMax,
          cy + diagL * (yMax - cy) * 0.9,
          zPlane
        );

        const diagR = Math.sin(alphaRight);
        outRight.set(
          -diagR * xMax,
          cy - diagR * (cy - yMin) * 0.9,
          zPlane
        );

        outTop.set(
          Math.cos(alphaLeft) * (xMax * 0.7),
          cy + Math.sin(alphaLeft) * (yMax - cy),
          zPlane
        );
        break;
      }

      case 'arc-fan': {
        // Broad curved fan sweeps spreading outward across arena
        const spreadL = Math.sin(alphaLeft) * 1.25;
        const radL = xMax * 0.95;
        outLeft.set(
          Math.sin(spreadL) * radL,
          cy + Math.cos(spreadL) * (halfH * 1.2),
          zPlane
        );

        const spreadR = Math.sin(alphaRight) * 1.25;
        const radR = xMax * 0.95;
        outRight.set(
          -Math.sin(spreadR) * radR,
          cy + Math.cos(spreadR) * (halfH * 1.2),
          zPlane
        );

        outTop.set(
          Math.sin(alphaLeft * 1.5) * (xMax * 0.85),
          cy - 1.0,
          zPlane
        );
        break;
      }

      case 'outer-to-inner': {
        // Sweeps starting from outer regions toward center framing
        const sweepProgress = (Math.sin(alphaLeft) + 1.0) * 0.5; // [0, 1]
        // Left sweeps from -xMax to -(halfW - 2.0)
        const curXL = -xMax + sweepProgress * (xMax - (halfW - 2.0));
        const curYL = cy + Math.sin(alphaLeft * 2.0) * (halfH * 0.8);
        outLeft.set(curXL, curYL, zPlane);

        // Right sweeps from +xMax to +(halfW - 2.0)
        const curXR = xMax - sweepProgress * (xMax - (halfW - 2.0));
        const curYR = cy + Math.cos(alphaRight * 2.0) * (halfH * 0.8);
        outRight.set(curXR, curYR, zPlane);

        outTop.set(Math.sin(alphaLeft) * 6.0, yMax - 2.0 - sweepProgress * 4.0, zPlane);
        break;
      }

      case 'inner-to-outer': {
        // Travels outward toward screen edges
        const sweepProgress = (Math.sin(alphaLeft) + 1.0) * 0.5;
        const curXL = -(halfW - 1.5) - sweepProgress * (xMax - (halfW - 1.5));
        const curYL = cy + Math.cos(alphaLeft * 2.0) * (halfH * 0.8);
        outLeft.set(curXL, curYL, zPlane);

        const curXR = (halfW - 1.5) + sweepProgress * (xMax - (halfW - 1.5));
        const curYR = cy + Math.sin(alphaRight * 2.0) * (halfH * 0.8);
        outRight.set(curXR, curYR, zPlane);

        outTop.set(Math.cos(alphaLeft) * 12.0, yMin + 2.0 + sweepProgress * 6.0, zPlane);
        break;
      }

      case 'circular-elliptical': {
        // Broad elliptical orbits surrounding the visualization
        const rx = xMax * 0.85;
        const ry = (yMax - yMin) * 0.45;
        const yc = (yMax + yMin) * 0.5;

        outLeft.set(
          -4.0 + Math.cos(alphaLeft) * rx,
          yc + Math.sin(alphaLeft) * ry,
          zPlane
        );

        outRight.set(
          4.0 + Math.cos(alphaRight) * rx,
          yc + Math.sin(alphaRight) * ry,
          zPlane
        );

        outTop.set(Math.sin(alphaLeft * 2.0) * (rx * 0.7), yMax - 1.0, zPlane);
        break;
      }

      case 'asymmetric': {
        // Left covers upper-left quadrant; Right covers lower-right quadrant (NO criss-cross X)
        outLeft.set(
          -(halfW + 3.0 + Math.cos(alphaLeft) * (xMax - halfW - 2.0)),
          cy + 1.5 + Math.sin(alphaLeft) * (yMax - cy - 1.0),
          zPlane
        );

        outRight.set(
          halfW + 3.0 + Math.cos(alphaRight) * (xMax - halfW - 2.0),
          cy - 1.5 - Math.sin(alphaRight) * (cy - yMin - 1.0),
          zPlane
        );

        outTop.set(Math.sin(alphaLeft) * (xMax * 0.6), yMax - 0.5, zPlane);
        break;
      }

      case 'slow-cinematic':
      default: {
        // Gradual, majestic, long-wavelength sweeps suitable for solos and calm sections
        const slowL = alphaLeft * 0.45;
        const slowR = alphaRight * 0.45;

        outLeft.set(
          Math.sin(slowL) * xMax,
          cy + Math.cos(slowL * 0.8) * (yMax - cy) * 0.8,
          zPlane
        );

        outRight.set(
          -Math.sin(slowR) * xMax,
          cy + Math.sin(slowR * 0.8) * (yMax - cy) * 0.8,
          zPlane
        );

        outTop.set(Math.cos(slowL * 0.7) * (xMax * 0.65), yMax - 1.2, zPlane);
        break;
      }
    }

    // Two White Bottom Sky Spotlights:
    // Synchronized broad sky searchlight sweeps across the upper viewport and arena sky.
    // They NEVER change direction on kick events!
    const whiteSweepL = alphaLeft * 0.55;
    const whiteSweepR = alphaRight * 0.55;

    outWhiteLeft.set(
      -(halfW + 3.0) + Math.cos(whiteSweepL) * 5.5,
      yMax + 2.5 + Math.sin(2.0 * whiteSweepL) * 3.0,
      zPlane + 1.0
    );

    outWhiteRight.set(
      halfW + 3.0 - Math.cos(whiteSweepR) * 5.5,
      yMax + 2.5 + Math.sin(2.0 * whiteSweepR) * 3.0,
      zPlane + 1.0
    );
  }
}
