/**
 * Synwave Concert Laser Choreography Engine
 * Contains 22 distinct concert-grade laser trajectory patterns with full 360° 3D coverage.
 * 
 * Expands light paths across the ENTIRE visualizer screen & 3D space:
 * - 360° in 3 Dimensions:
 *   - Upward into arena ceiling & festival sky (Y > 12 to 26)
 *   - Downward into stage floor & pit (Y < 0 to -12)
 *   - Wide horizontal sweeps spanning beyond screen edges (X: -35 to +35)
 *   - Forward auditorium & camera-targeting projections (Z > 0 to +25, projecting directly at & past camera at Z = 9.2)
 * - Beams reach end-to-end covering the entire width and height of the browser window.
 * - Pattern selection and transitions driven strictly by:
 *   - Demucs drum kick events (musical timing anchors)
 *   - Mid-range spectral characteristics (250 Hz - 4 kHz instrumental energy, centroid, flux, distribution)
 *   - Track seed for deterministic phrase-to-phrase variation
 *   - Minimum 3.5s dwell time to prevent erratic flickering
 *   - Smooth cubic hermite blend transitions between patterns
 * 
 * NOTE: Bass is deliberately NOT used as the pattern-selection driver.
 */

export interface LaserBeamParams {
  stationIdx: number;            // 0: Left, 1: Center, 2: Right
  rayIdx: number;                // 0 to 7
  totalBeams: number;            // 8
  masterAngle: number;           // Continuous synchronized sweep angle
  midRangeEnergy: number;        // 0.0 to 1.0 (250 Hz - 4 kHz mid-range instrumental energy)
  midSpectralCentroid: number;   // 0.0 to 1.0 (mid-range spectral brightness)
  midSpectralFlux: number;       // 0.0 to 1.0 (mid-range spectral flux / note attack rate)
  midEnergyDistribution: number; // 0.0 to 1.0 (ratio of upper-mid vs lower-mid energy)
  kickImpulse: number;           // 0.0 to 1.0 (drum kick transient impulse)
  timeSeconds: number;           // Track playback time
  seed: number;                  // Deterministic track seed
  stationOrigin?: { x: number; y: number; z: number };
}

export interface LaserBeamTrajectory {
  targetX: number;   // 3D stage target X
  targetY: number;   // 3D stage target Y
  targetZ: number;   // 3D stage target Z
  azimuth: number;   // Compatible horizontal angle (radians)
  elevation: number; // Compatible vertical angle (radians)
}

export type LaserSemanticState =
  | 'OFF'
  | 'CINEMATIC_DIRECTIONAL'
  | 'MELODIC_ANTHEM'
  | 'BUILD_RISER'
  | 'DROP_IMPACT'
  | 'DROP_GROOVE'
  | 'CLIMAX_OMNIDIRECTIONAL';

export interface LaserChoreographyMetadata {
  readonly id: number;
  readonly name: string;
  readonly primaryCategory: LaserSemanticState;
  readonly compatibleCategories: readonly LaserSemanticState[];
  readonly roleInFourBar: 'motif' | 'develop' | 'tension' | 'accent' | 'any';
  readonly defaultDensity: number;       // 0.2 to 1.0 (recommended beam density)
  readonly defaultSpeedScale: number;    // 0.3 to 2.5 (recommended sweep speed scale)
  readonly beatGatedSupport: boolean;    // Supports rhythmic on-off pulses
  readonly maxSpreadDegrees: number;     // Spatial aperture limit in degrees
  readonly intendedUse: string;          // Human-readable concert lighting role
}

export interface LaserChoreography {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  calculateTrajectory(params: LaserBeamParams): LaserBeamTrajectory;
}

// Helper: centered beam coordinate [-0.5, 0.5]
const getCenteredU = (rayIdx: number, totalBeams: number) => (rayIdx / (totalBeams - 1)) - 0.5;
// Helper: normalized beam coordinate [0.0, 1.0]
const getNormalizedU = (rayIdx: number, totalBeams: number) => rayIdx / (totalBeams - 1);

// Helper to construct trajectory with both 3D coordinates and compatible spherical angles
function makeTrajectory(
  tx: number,
  ty: number,
  tz: number,
  originX: number = 0,
  originY: number = 11.2,
  originZ: number = -3.8
): LaserBeamTrajectory {
  const dx = tx - originX;
  const dy = ty - originY;
  const dz = tz - originZ;
  const horizDist = Math.sqrt(dx * dx + dz * dz);
  return {
    targetX: tx,
    targetY: ty,
    targetZ: tz,
    azimuth: Math.atan2(dx, dz),
    elevation: Math.atan2(dy, horizDist),
  };
}

export const LASER_CHOREOGRAPHIES: LaserChoreography[] = [
  // 1. Audience & Camera Fly-Through Projection
  // Projects directly forward into the auditorium, skimming past the camera (Z = 9.2)
  {
    id: 0,
    name: 'Audience & Camera Fly-Through',
    description: 'Beams sweep forward through 3D space directly at and past the camera plane',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const sweepX = Math.sin(p.masterAngle * 0.9) * 12.0;
      // Camera is at (0, 1.8, 9.2) - target forward Z past camera
      const tx = sweepX + c * 16.0 + (p.stationIdx - 1) * 4.0;
      const ty = 1.8 + Math.cos(p.masterAngle * 1.1 + c * 2.0) * 4.5 + p.kickImpulse * 2.0;
      const tz = 12.0 + Math.sin(p.masterAngle * 0.7) * 8.0 + (p.rayIdx % 2 === 0 ? 5.0 : -3.0);
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 2. 360° Orbital Sphere Gimbal
  // Radiates in full 360° spherical coordinates rotating around station origins across all 3 axes
  {
    id: 1,
    name: '360° Orbital Sphere Gimbal',
    description: 'Full 360-degree spherical rotation across pitch, yaw, and depth axes',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const theta = p.masterAngle * 1.3 + u * Math.PI * 2 + p.stationIdx * (Math.PI * 2 / 3);
      const phi = Math.sin(p.masterAngle * 0.8 + u * Math.PI) * (Math.PI * 0.45); // -80° to +80° elevation
      const radius = 25.0 + p.kickImpulse * 8.0;
      const ox = (p.stationIdx - 1) * 5.5;
      const oy = 11.2;
      const oz = -3.8;
      const tx = ox + radius * Math.cos(phi) * Math.sin(theta);
      const ty = oy + radius * Math.sin(phi); // Sweeps both up into sky and down to floor
      const tz = oz + radius * Math.cos(phi) * Math.cos(theta); // Sweeps front to back
      return makeTrajectory(tx, ty, tz, ox, oy, oz);
    },
  },

  // 3. Cathedral 3D Scissor Matrix
  // Diagonal scissor planes crossing across screen and sweeping depth Z from -4 to +16
  {
    id: 2,
    name: 'Cathedral 3D Scissor Matrix',
    description: 'Crossing diagonal beams oscillating in both horizontal width and forward depth',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const breathing = Math.sin(p.masterAngle * 1.2) * 6.0;
      let tx: number;
      if (p.stationIdx === 0) {
        tx = 10.0 + c * 14.0 + breathing;
      } else if (p.stationIdx === 2) {
        tx = -10.0 + c * 14.0 - breathing;
      } else {
        tx = c * 18.0 + Math.sin(p.masterAngle * 0.6) * 5.0;
      }
      const ty = -1.0 + Math.sin(p.masterAngle * 1.1 + c * Math.PI) * 7.0;
      const tz = 5.0 + Math.cos(p.masterAngle * 0.85) * 9.0; // Sweeps in front of & behind camera
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 4. Stadium 3D Skyward Dome
  // Beams sweep UPWARD into the ceiling, festival sky, and upper corners (Y: 14 to 26)
  {
    id: 3,
    name: 'Stadium 3D Skyward Dome',
    description: 'Beams sweep upward into the festival sky and arena ceiling dome',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const spread = 28.0 + p.midRangeEnergy * 10.0 + p.kickImpulse * 6.0;
      const tx = c * spread + (p.stationIdx - 1) * 8.0 + Math.sin(p.masterAngle * 0.5) * 5.0;
      const ty = 16.0 + Math.cos(p.masterAngle * 0.9 + c * 2.0) * 8.0; // High elevation: Y: 14 to 24+
      const tz = 4.0 + Math.sin(p.masterAngle * 0.7) * 7.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 5. Camera-Targeting Concentrated Burst
  // All beams converge directly onto the camera position (0, 1.8, 9.2) with pulse spreads
  {
    id: 4,
    name: 'Camera-Targeting Concentrated Burst',
    description: 'Stations lock directly onto the camera lens with synchronized transient pulses',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const burstPulse = (p.kickImpulse * 4.0) + Math.sin(p.masterAngle * 2.0) * 1.5;
      const camX = 0.0;
      const camY = 1.8;
      const camZ = 9.2;
      const tx = camX + c * burstPulse + (p.stationIdx - 1) * (0.8 + burstPulse * 0.4);
      const ty = camY + (p.rayIdx % 2 === 0 ? burstPulse : -burstPulse) * 0.6;
      const tz = camZ + (p.kickImpulse > 0.3 ? 4.0 : 0.0);
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 6. 3D Vortex Tunnel
  // Circular 3D conical tunnel projecting forward from the stage screen towards the camera
  {
    id: 5,
    name: '3D Vortex Tunnel',
    description: 'Conical rotating tunnel of light wrapping around the camera field of view',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const vAngle = p.masterAngle * 1.8 + u * Math.PI * 2 + (p.stationIdx * 0.7);
      const depth = 2.0 + u * 14.0; // Projects forward towards camera
      const radiusX = 4.0 + (depth * 0.45) + p.kickImpulse * 3.0;
      const radiusY = 2.5 + (depth * 0.35);
      const tx = Math.cos(vAngle) * radiusX;
      const ty = 2.0 + Math.sin(vAngle) * radiusY;
      const tz = -1.0 + depth;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 7. 360° Horizon & Zenith Rake
  // Continuous vertical rake sweeping from sky zenith (Y = +25) down through horizon to floor (Y = -8)
  {
    id: 6,
    name: '360° Horizon & Zenith Rake',
    description: 'Continuous vertical sweep from overhead zenith through horizon to stage floor',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const rakePhase = p.masterAngle * 1.2;
      const tx = (p.stationIdx - 1) * 10.0 + c * 16.0 + Math.sin(p.masterAngle * 0.5) * 4.0;
      // Full vertical travel from -8 to +24
      const ty = 8.0 + Math.sin(rakePhase) * 16.0;
      const tz = 3.0 + Math.cos(rakePhase) * 8.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 8. Forward Auditorium Scissor Canopy
  // Crosses forward over the audience towards the camera, forming a ceiling over the crowd
  {
    id: 7,
    name: 'Forward Auditorium Scissor Canopy',
    description: 'Interlocking aerial beams forming an overhead canopy directly above the viewer',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const angle = p.masterAngle * 1.1;
      let tx: number;
      if (p.stationIdx === 0) {
        tx = 8.0 + c * 12.0 + Math.sin(angle) * 4.0;
      } else if (p.stationIdx === 2) {
        tx = -8.0 + c * 12.0 - Math.sin(angle) * 4.0;
      } else {
        tx = c * 16.0;
      }
      const ty = 4.5 + Math.sin(angle * 1.4 + c * 3.0) * 4.0;
      const tz = 10.0 + Math.cos(angle * 0.8) * 6.0; // Near camera depth
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 9. 3D Dual Helicoid Spiral
  // Beams twist like a 3D double helix projecting forward along Z towards the camera
  {
    id: 8,
    name: '3D Dual Helicoid Spiral',
    description: 'Double helix twisting through 3D space projecting directly at the audience',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const helixPhase = p.masterAngle * 2.0 + (p.rayIdx % 2 === 0 ? 0 : Math.PI) + u * Math.PI;
      const radius = 6.0 + p.kickImpulse * 3.0;
      const tx = (p.stationIdx - 1) * 6.0 + Math.cos(helixPhase) * radius;
      const ty = 3.0 + Math.sin(helixPhase) * radius * 0.8;
      const tz = 1.0 + u * 16.0; // Projects from screen forward to camera
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 10. Full-Window Corner-to-Corner Slashes
  // Full diagonal slashes cutting across the 3D viewport from ceiling corners to floor corners
  {
    id: 9,
    name: 'Full-Window Corner-to-Corner Slashes',
    description: 'Massive diagonal slashes slicing corner-to-corner across 3D viewport',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const slashPhase = Math.sin(p.masterAngle * 1.5);
      const tx = p.stationIdx === 0
        ? -25.0 + u * 50.0
        : p.stationIdx === 2
          ? 25.0 - u * 50.0
          : c * 35.0 * slashPhase;
      const ty = 20.0 - u * 28.0 + slashPhase * 4.0; // From Y = 20 down to Y = -8
      const tz = 2.0 + slashPhase * 8.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 11. 360° Radial Starburst
  // Instantaneous 360° spherical starburst shooting out in all directions
  {
    id: 10,
    name: '360° Radial Starburst',
    description: 'Explosive radial starburst deploying beams into every quadrant of 3D space',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const angle = p.masterAngle * 1.4 + u * Math.PI * 2;
      const pitch = (p.rayIdx % 4 === 0 ? 0.7 : p.rayIdx % 4 === 1 ? -0.7 : 0.0) + Math.sin(p.masterAngle) * 0.3;
      const distance = 25.0 + p.kickImpulse * 10.0;
      const ox = (p.stationIdx - 1) * 5.5;
      const oy = 11.2;
      const oz = -3.8;
      const tx = ox + Math.cos(angle) * Math.cos(pitch) * distance;
      const ty = oy + Math.sin(pitch) * distance;
      const tz = oz + Math.sin(angle) * Math.cos(pitch) * distance;
      return makeTrajectory(tx, ty, tz, ox, oy, oz);
    },
  },

  // 12. Audience Ocean Scan
  // Horizontal sheets of light sweeping forward across the crowd at eye level (Y = 1.8)
  {
    id: 11,
    name: 'Audience Ocean Scan',
    description: 'Horizontal planar waves rolling forward through the audience at eye level',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const wave = Math.sin(p.masterAngle * 1.6 + c * Math.PI) * 3.0;
      const tx = c * 32.0 + Math.sin(p.masterAngle * 0.7) * 8.0;
      const ty = 1.8 + wave; // Eye level with camera
      const tz = 8.0 + Math.cos(p.masterAngle * 1.1 + c * 2.0) * 8.0; // Around camera plane
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 13. Skyward Crown Fan
  // Regal upward fan projecting into the ceiling and stadium sky (Y: 18 to 26)
  {
    id: 12,
    name: 'Skyward Crown Fan',
    description: 'Upward-pointing crown fan illuminating the stadium ceiling and night sky',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const tx = (p.stationIdx - 1) * 6.0 + c * 35.0;
      const ty = 22.0 + Math.cos(p.masterAngle * 0.8 + c * 2.0) * 6.0; // High in sky
      const tz = 2.0 + Math.sin(p.masterAngle * 0.9) * 6.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 14. Camera Plane Slicer
  // Beams oscillate across the exact plane of the camera (Z = 9.2), framing the viewer
  {
    id: 13,
    name: 'Camera Plane Slicer',
    description: 'Laser beams sweeping precisely across the camera aperture and foreground',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const sweepY = Math.sin(p.masterAngle * 1.3) * 6.0;
      const tx = c * 22.0 + (p.stationIdx - 1) * 3.0;
      const ty = 1.8 + sweepY + (u - 0.5) * 8.0;
      const tz = 9.2 + Math.sin(p.masterAngle * 2.0 + u * Math.PI) * 1.5; // Locked to camera Z
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 15. 3D Kinetic Hypercube
  // Rotating 3D bounding geometry surrounding the entire screen and auditorium
  {
    id: 14,
    name: '3D Kinetic Hypercube',
    description: 'Geometric 3D lattice rotating in full 3D space around the stage and viewer',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const rot = p.masterAngle * 1.1;
      const side = (p.rayIdx % 2 === 0 ? 1 : -1);
      const tx = Math.sin(rot + u * Math.PI) * 18.0 * side;
      const ty = 6.0 + Math.cos(rot + u * Math.PI) * 12.0;
      const tz = 5.0 + Math.sin(rot * 0.7 + p.stationIdx) * 10.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 16. 3D Sonic Sine Wave
  // Undulating 3D ribbon with sinusoidal oscillation in both Y (amplitude) and Z (depth)
  {
    id: 15,
    name: '3D Sonic Sine Wave',
    description: 'Three-dimensional traveling sine wave undulating in vertical amplitude and depth',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const waveX = (p.stationIdx - 1) * 12.0 + c * 16.0;
      const phase = waveX * 0.3 + p.masterAngle * 2.2;
      const tx = waveX;
      const ty = 4.0 + Math.sin(phase) * 8.0;
      const tz = 4.0 + Math.cos(phase * 0.8) * 9.0; // Undulates towards and away from camera
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 17. 360° Conical Fan Sweep
  // Tumbling 360° cone tilting from ceiling, through camera, to stage floor
  {
    id: 16,
    name: '360° Conical Fan Sweep',
    description: 'Tumbling 360-degree cone sweeping from ceiling through camera to stage floor',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const coneAngle = p.masterAngle * 1.7 + u * Math.PI * 2;
      const tilt = Math.sin(p.masterAngle * 0.7) * 8.0;
      const tx = (p.stationIdx - 1) * 5.5 + Math.cos(coneAngle) * 16.0;
      const ty = 10.0 + Math.sin(coneAngle) * 14.0 + tilt; // Full height sweep
      const tz = 2.0 + Math.sin(coneAngle * 0.5) * 12.0; // Full depth sweep
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 18. Prism Split 3D
  // Focal cluster that explodes outward into a 3D hemisphere spanning upward, sideways, and forward
  {
    id: 17,
    name: 'Prism Split 3D',
    description: 'Tight focal laser beam splitting into an expansive 3D hemispherical array',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const splitSpread = Math.sin(p.masterAngle * 1.6) * 16.0 + p.kickImpulse * 8.0;
      const tx = (p.stationIdx - 1) * 8.0 + c * Math.abs(splitSpread);
      const ty = 5.0 + Math.cos(p.masterAngle * 1.4 + c * 2.0) * 10.0;
      const tz = 4.0 + Math.sin(p.masterAngle * 1.2 + c * 3.0) * 8.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 19. Aerial Crossing Grid
  // Multi-layered horizontal and vertical lattice in front of the video aperture (Z: 2 to 14)
  {
    id: 18,
    name: 'Aerial Crossing Grid',
    description: 'Multi-layered 3D lattice framing the stage screen and auditorium',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const isHoriz = (p.rayIdx % 2 === 0);
      const tx = isHoriz ? -22.0 + u * 44.0 : (p.stationIdx - 1) * 12.0 + c * 10.0;
      const ty = isHoriz ? 1.0 + Math.sin(p.masterAngle) * 6.0 : 18.0 - u * 24.0;
      const tz = 3.0 + (isHoriz ? 8.0 : 2.0) + Math.cos(p.masterAngle * 0.9) * 4.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 20. 360° Waterfall & Geyser
  // Even beams shoot down into floor (Y = -10), odd beams shoot UP into sky (Y = +24)
  {
    id: 19,
    name: '360° Waterfall & Geyser',
    description: 'Opposing vertical beams: geysers erupt into the sky while waterfalls pour to floor',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const isGeyser = (p.rayIdx % 2 !== 0);
      const tx = (p.stationIdx - 1) * 8.0 + c * 18.0 + Math.sin(p.masterAngle * 1.2) * 5.0;
      // Geysers point high into sky (Y = 22), waterfalls point down (Y = -8)
      const ty = isGeyser ? (18.0 + Math.cos(p.masterAngle * 1.5) * 6.0) : (-8.0 + Math.sin(p.masterAngle * 1.5) * 3.0);
      const tz = isGeyser ? (6.0 + Math.sin(p.masterAngle) * 6.0) : (-2.0 + Math.cos(p.masterAngle) * 4.0);
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 21. Forward Starlight Cascade
  // Beams step down from ceiling towards camera in a progressive cascade of light drops
  {
    id: 20,
    name: 'Forward Starlight Cascade',
    description: 'Cascading steps of laser light descending from the ceiling towards the camera',
    calculateTrajectory: (p) => {
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const cascade = ((p.masterAngle * 2.0 + u * 2.0 + p.stationIdx * 0.8) % 2.0) - 1.0;
      const tx = (p.stationIdx - 1) * 10.0 + c * 16.0;
      const ty = 14.0 - cascade * 18.0; // From Y = 14 down to Y = -4
      const tz = 2.0 + (cascade + 1.0) * 5.0; // Moves forward in depth
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },

  // 22. Climax 3D Omnidirectional Superfan
  // Maximum aperture 360° deployment: beams point at camera, straight up, far left, right, and down
  {
    id: 21,
    name: 'Climax 3D Omnidirectional Superfan',
    description: 'All 24 beams deployed in maximum 360-degree spread covering all dimensions',
    calculateTrajectory: (p) => {
      const c = getCenteredU(p.rayIdx, p.totalBeams);
      const u = getNormalizedU(p.rayIdx, p.totalBeams);
      const spreadX = 35.0 + p.kickImpulse * 8.0;
      const tx = (p.stationIdx - 1) * 6.0 + c * spreadX;
      // Spans from -8 to +24
      const ty = -6.0 + Math.sin(u * Math.PI) * 26.0 + Math.cos(p.masterAngle * 1.5) * 4.0;
      // Projects forward past camera to Z = 16
      const tz = -1.0 + Math.cos(u * Math.PI) * 14.0 + Math.sin(p.masterAngle * 1.2) * 5.0;
      return makeTrajectory(tx, ty, tz, (p.stationIdx - 1) * 5.5, 11.2, -3.8);
    },
  },
];

/**
 * Phase 2 — Authoritative Concert Lighting Choreography Metadata Table
 * Classifies each of the 22 top-aperture laser trajectories according to its intended
 * semantic use, musical state eligibility, four-bar phrase role, density, and dynamics.
 */
export const LASER_CHOREOGRAPHY_METADATA: readonly LaserChoreographyMetadata[] = [
  // 0: Audience & Camera Fly-Through
  {
    id: 0,
    name: 'Audience & Camera Fly-Through',
    primaryCategory: 'CINEMATIC_DIRECTIONAL',
    compatibleCategories: ['CINEMATIC_DIRECTIONAL', 'DROP_IMPACT'],
    roleInFourBar: 'motif',
    defaultDensity: 0.50,
    defaultSpeedScale: 0.60,
    beatGatedSupport: false,
    maxSpreadDegrees: 90,
    intendedUse: 'A sparse forward projection with slow instrumental tracking; may also be used as a controlled drop accent.',
  },
  // 1: 360° Orbital Sphere Gimbal
  {
    id: 1,
    name: '360° Orbital Sphere Gimbal',
    primaryCategory: 'CLIMAX_OMNIDIRECTIONAL',
    compatibleCategories: ['CLIMAX_OMNIDIRECTIONAL'],
    roleInFourBar: 'accent',
    defaultDensity: 1.0,
    defaultSpeedScale: 1.80,
    beatGatedSupport: false,
    maxSpreadDegrees: 360,
    intendedUse: 'Full spatial movement, reserved for high-impact climax sections.',
  },
  // 2: Cathedral 3D Scissor Matrix
  {
    id: 2,
    name: 'Cathedral 3D Scissor Matrix',
    primaryCategory: 'DROP_GROOVE',
    compatibleCategories: ['DROP_GROOVE'],
    roleInFourBar: 'motif',
    defaultDensity: 0.85,
    defaultSpeedScale: 1.20,
    beatGatedSupport: true,
    maxSpreadDegrees: 140,
    intendedUse: 'Rhythmic crossing movements; vary the crossing direction at bar boundaries.',
  },
  // 3: Stadium 3D Skyward Dome
  {
    id: 3,
    name: 'Stadium 3D Skyward Dome',
    primaryCategory: 'BUILD_RISER',
    compatibleCategories: ['BUILD_RISER'],
    roleInFourBar: 'tension',
    defaultDensity: 0.75,
    defaultSpeedScale: 1.10,
    beatGatedSupport: false,
    maxSpreadDegrees: 160,
    intendedUse: 'Gradually broaden and raise the fan during a qualified buildup; may resolve into a drop pattern.',
  },
  // 4: Camera-Targeting Concentrated Burst
  {
    id: 4,
    name: 'Camera-Targeting Concentrated Burst',
    primaryCategory: 'DROP_IMPACT',
    compatibleCategories: ['DROP_IMPACT'],
    roleInFourBar: 'accent',
    defaultDensity: 0.90,
    defaultSpeedScale: 1.50,
    beatGatedSupport: true,
    maxSpreadDegrees: 45,
    intendedUse: 'Brief synchronized burst on a confirmed drop entrance or exceptional kick accent.',
  },
  // 5: 3D Vortex Tunnel
  {
    id: 5,
    name: '3D Vortex Tunnel',
    primaryCategory: 'DROP_GROOVE',
    compatibleCategories: ['DROP_GROOVE'],
    roleInFourBar: 'develop',
    defaultDensity: 0.85,
    defaultSpeedScale: 1.40,
    beatGatedSupport: true,
    maxSpreadDegrees: 120,
    intendedUse: 'Forward-facing tunnel movement for a sustained, high-energy drop.',
  },
  // 6: 360° Horizon & Zenith Rake
  {
    id: 6,
    name: '360° Horizon & Zenith Rake',
    primaryCategory: 'DROP_GROOVE',
    compatibleCategories: ['DROP_GROOVE'],
    roleInFourBar: 'develop',
    defaultDensity: 0.80,
    defaultSpeedScale: 1.30,
    beatGatedSupport: false,
    maxSpreadDegrees: 240,
    intendedUse: 'Controlled vertical sweeping; use phrase-aware changes rather than uncontrolled continuous rotation.',
  },
  // 7: Forward Auditorium Scissor Canopy
  {
    id: 7,
    name: 'Forward Auditorium Scissor Canopy',
    primaryCategory: 'MELODIC_ANTHEM',
    compatibleCategories: ['MELODIC_ANTHEM'],
    roleInFourBar: 'motif',
    defaultDensity: 0.55,
    defaultSpeedScale: 0.65,
    beatGatedSupport: false,
    maxSpreadDegrees: 110,
    intendedUse: 'Slow aerial canopy for spacious melodic passages; keep movement restrained.',
  },
  // 8: 3D Dual Helicoid Spiral
  {
    id: 8,
    name: '3D Dual Helicoid Spiral',
    primaryCategory: 'MELODIC_ANTHEM',
    compatibleCategories: ['MELODIC_ANTHEM', 'DROP_GROOVE'],
    roleInFourBar: 'develop',
    defaultDensity: 0.65,
    defaultSpeedScale: 0.80,
    beatGatedSupport: true,
    maxSpreadDegrees: 130,
    intendedUse: 'Slow spirals for sustained melodic motion; accelerate only in a confirmed drop.',
  },
  // 9: Full-Window Corner-to-Corner Slashes
  {
    id: 9,
    name: 'Full-Window Corner-to-Corner Slashes',
    primaryCategory: 'DROP_IMPACT',
    compatibleCategories: ['DROP_IMPACT'],
    roleInFourBar: 'accent',
    defaultDensity: 0.90,
    defaultSpeedScale: 1.60,
    beatGatedSupport: true,
    maxSpreadDegrees: 180,
    intendedUse: 'Use as a deliberate full-width accent, not as a persistent background effect.',
  },
  // 10: 360° Radial Starburst
  {
    id: 10,
    name: '360° Radial Starburst',
    primaryCategory: 'CLIMAX_OMNIDIRECTIONAL',
    compatibleCategories: ['CLIMAX_OMNIDIRECTIONAL'],
    roleInFourBar: 'accent',
    defaultDensity: 1.0,
    defaultSpeedScale: 2.00,
    beatGatedSupport: false,
    maxSpreadDegrees: 360,
    intendedUse: 'Reserve for major phrase accents and exceptional climaxes.',
  },
  // 11: Audience Ocean Scan
  {
    id: 11,
    name: 'Audience Ocean Scan',
    primaryCategory: 'CINEMATIC_DIRECTIONAL',
    compatibleCategories: ['CINEMATIC_DIRECTIONAL'],
    roleInFourBar: 'motif',
    defaultDensity: 0.45,
    defaultSpeedScale: 0.50,
    beatGatedSupport: false,
    maxSpreadDegrees: 90,
    intendedUse: 'Smooth horizontal movement tracking sustained instrumental energy.',
  },
  // 12: Skyward Crown Fan
  {
    id: 12,
    name: 'Skyward Crown Fan',
    primaryCategory: 'MELODIC_ANTHEM',
    compatibleCategories: ['MELODIC_ANTHEM', 'BUILD_RISER'],
    roleInFourBar: 'develop',
    defaultDensity: 0.60,
    defaultSpeedScale: 0.70,
    beatGatedSupport: false,
    maxSpreadDegrees: 140,
    intendedUse: 'Slow upward illumination for emotional lifts; expand only as tension rises.',
  },
  // 13: Camera Plane Slicer
  {
    id: 13,
    name: 'Camera Plane Slicer',
    primaryCategory: 'DROP_GROOVE',
    compatibleCategories: ['DROP_GROOVE'],
    roleInFourBar: 'develop',
    defaultDensity: 0.80,
    defaultSpeedScale: 1.30,
    beatGatedSupport: true,
    maxSpreadDegrees: 150,
    intendedUse: 'Use beat-indexed or kick-indexed sweeps; avoid unsynchronized oscillation.',
  },
  // 14: 3D Kinetic Hypercube
  {
    id: 14,
    name: '3D Kinetic Hypercube',
    primaryCategory: 'BUILD_RISER',
    compatibleCategories: ['BUILD_RISER'],
    roleInFourBar: 'tension',
    defaultDensity: 0.70,
    defaultSpeedScale: 1.20,
    beatGatedSupport: false,
    maxSpreadDegrees: 150,
    intendedUse: 'Geometric motion that increases progressively during a qualified build.',
  },
  // 15: 3D Sonic Sine Wave
  {
    id: 15,
    name: '3D Sonic Sine Wave',
    primaryCategory: 'CINEMATIC_DIRECTIONAL',
    compatibleCategories: ['CINEMATIC_DIRECTIONAL'],
    roleInFourBar: 'motif',
    defaultDensity: 0.45,
    defaultSpeedScale: 0.55,
    beatGatedSupport: false,
    maxSpreadDegrees: 85,
    intendedUse: 'A restrained, smooth waveform following instrumental motion and sustained upper-mid movement.',
  },
  // 16: 360° Conical Fan Sweep
  {
    id: 16,
    name: '360° Conical Fan Sweep',
    primaryCategory: 'CLIMAX_OMNIDIRECTIONAL',
    compatibleCategories: ['CLIMAX_OMNIDIRECTIONAL'],
    roleInFourBar: 'tension',
    defaultDensity: 1.0,
    defaultSpeedScale: 1.70,
    beatGatedSupport: false,
    maxSpreadDegrees: 360,
    intendedUse: 'A sweeping full-space transition reserved for a major drop or climax.',
  },
  // 17: Prism Split 3D
  {
    id: 17,
    name: 'Prism Split 3D',
    primaryCategory: 'BUILD_RISER',
    compatibleCategories: ['BUILD_RISER', 'DROP_IMPACT'],
    roleInFourBar: 'accent',
    defaultDensity: 0.75,
    defaultSpeedScale: 1.20,
    beatGatedSupport: true,
    maxSpreadDegrees: 135,
    intendedUse: 'Progress from a narrow focal beam to a wider array on an intentional transition.',
  },
  // 18: Aerial Crossing Grid
  {
    id: 18,
    name: 'Aerial Crossing Grid',
    primaryCategory: 'BUILD_RISER',
    compatibleCategories: ['BUILD_RISER', 'DROP_GROOVE'],
    roleInFourBar: 'develop',
    defaultDensity: 0.80,
    defaultSpeedScale: 1.10,
    beatGatedSupport: true,
    maxSpreadDegrees: 140,
    intendedUse: 'Progressively expand the lattice during a build or synchronize it to bar-level drop choreography.',
  },
  // 19: 360° Waterfall & Geyser
  {
    id: 19,
    name: '360° Waterfall & Geyser',
    primaryCategory: 'CLIMAX_OMNIDIRECTIONAL',
    compatibleCategories: ['CLIMAX_OMNIDIRECTIONAL'],
    roleInFourBar: 'accent',
    defaultDensity: 1.0,
    defaultSpeedScale: 1.90,
    beatGatedSupport: false,
    maxSpreadDegrees: 360,
    intendedUse: 'Opposing vertical cascades for a major climax only.',
  },
  // 20: Forward Starlight Cascade
  {
    id: 20,
    name: 'Forward Starlight Cascade',
    primaryCategory: 'BUILD_RISER',
    compatibleCategories: ['BUILD_RISER'],
    roleInFourBar: 'tension',
    defaultDensity: 0.65,
    defaultSpeedScale: 0.90,
    beatGatedSupport: false,
    maxSpreadDegrees: 120,
    intendedUse: 'Restrained cascading motion approaching a drop; intensify late in the buildup.',
  },
  // 21: Climax 3D Omnidirectional Superfan
  {
    id: 21,
    name: 'Climax 3D Omnidirectional Superfan',
    primaryCategory: 'CLIMAX_OMNIDIRECTIONAL',
    compatibleCategories: ['CLIMAX_OMNIDIRECTIONAL'],
    roleInFourBar: 'accent',
    defaultDensity: 1.0,
    defaultSpeedScale: 2.20,
    beatGatedSupport: false,
    maxSpreadDegrees: 360,
    intendedUse: 'The highest-impact pattern. Reserve it for exceptional climaxes, not every drop or every phrase.',
  },
];

/**
 * Retrieves choreography metadata by ID (0-21).
 */
export function getChoreographyMetadata(id: number): LaserChoreographyMetadata {
  return LASER_CHOREOGRAPHY_METADATA[id] ?? LASER_CHOREOGRAPHY_METADATA[0];
}

/**
 * Returns all pattern IDs permitted for a given semantic state.
 */
export function getPatternsForSemanticState(state: LaserSemanticState): number[] {
  if (state === 'OFF') return [];
  const matches: number[] = [];
  for (const meta of LASER_CHOREOGRAPHY_METADATA) {
    if (meta.primaryCategory === state || meta.compatibleCategories.includes(state)) {
      matches.push(meta.id);
    }
  }
  return matches.length > 0 ? matches : [0];
}

/**
 * Selects an intentional choreography pattern for a four-bar sequence:
 * - Bar 1: Motif establishment
 * - Bar 2: Motif development / variation
 * - Bar 3: Tension or movement acceleration
 * - Bar 4: Phrase accent / impact resolution
 */
export function selectChoreographyForArc(
  state: LaserSemanticState,
  barInPhrase: number, // 1 to 4
  trackSeed: number,
  currentPatternId: number,
  phraseIndex: number = 0
): number {
  if (state === 'OFF') return currentPatternId;

  const permitted = getPatternsForSemanticState(state);
  if (permitted.length === 0) return 0;
  if (permitted.length === 1) return permitted[0];

  // Map the desired 4-bar arc role
  const targetRole: 'motif' | 'develop' | 'tension' | 'accent' =
    barInPhrase === 1 ? 'motif' :
    barInPhrase === 2 ? 'develop' :
    barInPhrase === 3 ? 'tension' : 'accent';

  // Filter candidates matching role if available, otherwise use all permitted
  const roleCandidates = permitted.filter((id) => {
    const meta = getChoreographyMetadata(id);
    return meta.roleInFourBar === targetRole || meta.roleInFourBar === 'any';
  });

  const pool = roleCandidates.length > 0 ? roleCandidates : permitted;

  // For cinematic and melodic states, retain consistency across the phrase
  if (state === 'CINEMATIC_DIRECTIONAL' || state === 'MELODIC_ANTHEM') {
    // Pick once per phrase using seed + phraseIndex
    const seedHash = Math.abs(trackSeed * 31 + phraseIndex * 17);
    return pool[seedHash % pool.length];
  }

  // For drops and builds, provide deterministic bar-by-bar progression
  const seedHash = Math.abs(trackSeed * 37 + phraseIndex * 23 + barInPhrase * 11);
  const selected = pool[seedHash % pool.length];

  // If same pattern selected and alternate available in pool, pick adjacent for variation
  if (selected === currentPatternId && pool.length > 1) {
    const nextIdx = (pool.indexOf(selected) + 1) % pool.length;
    return pool[nextIdx];
  }

  return selected;
}

/**
 * Legacy compatibility: Deterministically selects the next choreography using mid-range spectral features.
 */
export function selectNextLaserPattern(
  currentPatternId: number,
  trackSeed: number,
  midRangeEnergy: number,
  midSpectralCentroid: number
): number {
  const patternCount = LASER_CHOREOGRAPHIES.length; // 22 patterns

  const energyBand = midRangeEnergy > 0.65 ? 'high' : midRangeEnergy < 0.35 ? 'low' : 'mid';
  const centroidHigh = midSpectralCentroid > 0.55;

  let candidateOffset = 1;
  if (energyBand === 'high') {
    candidateOffset = 1 + (Math.abs(trackSeed + Math.round(midRangeEnergy * 100)) % 7);
  } else if (centroidHigh) {
    candidateOffset = 2 + (Math.abs(trackSeed + Math.round(midSpectralCentroid * 50)) % 5);
  } else {
    candidateOffset = 1 + (Math.abs(trackSeed) % 3);
  }

  let nextId = (currentPatternId + candidateOffset) % patternCount;
  if (nextId === currentPatternId) {
    nextId = (currentPatternId + 1) % patternCount;
  }

  return nextId;
}

