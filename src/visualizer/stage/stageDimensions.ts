/**
 * Synwave Stage Dimensions & Viewport Coordinate Calculations
 *
 * Provides authoritative screen, stage, and frustum geometry calculations
 * that precisely synchronize DOM YouTube player layout with the 3D WebGL stage,
 * guaranteeing consistent aspect ratio, symmetric spotlight distribution,
 * and zero clipping across window resizes and fullscreen toggles.
 */

import * as THREE from 'three';

export interface StageDimensions {
  viewportWidth: number;
  viewportHeight: number;
  aspect: number;
  // DOM Player Screen Dimensions
  domPlayerWidth: number;
  domPlayerHeight: number;
  // 3D Frustum at Screen Plane (Z = -4.5 with camera at Z = 9.2, Y = 1.8, FOV = 60°)
  frustumWidth: number;
  frustumHeight: number;
  // 3D Player Screen Geometry
  screenWidth: number;
  screenHeight: number;
  screenCenterY: number;
  screenZ: number;
  // Boundaries
  halfWidth: number;
  halfHeight: number;
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
}

export const STAGE_CONFIG = {
  CAMERA_Z: 9.2,
  CAMERA_Y: 1.8,
  SCREEN_Z: -4.5,
  CAMERA_FOV_DEG: 60,
  CAMERA_LOOKAT_Y: 4.4,
  // CSS: width: min(68vw, calc(62vh * (16 / 9))); top: 48%;
  MAX_VW_PERCENT: 0.68,
  MAX_VH_PERCENT: 0.62,
  DOM_TOP_PERCENT: 0.48,
  ASPECT_RATIO: 16 / 9,
} as const;

/**
 * Calculates authoritative stage dimensions matching DOM CSS rules.
 */
export function calculateStageDimensions(
  viewportWidth: number,
  viewportHeight: number
): StageDimensions {
  const w = Math.max(1, viewportWidth);
  const h = Math.max(1, viewportHeight);
  const aspect = w / h;

  // DOM Player calculation: width: min(68vw, calc(62vh * (16 / 9)));
  const maxWByVw = w * STAGE_CONFIG.MAX_VW_PERCENT;
  const maxWByVh = h * STAGE_CONFIG.MAX_VH_PERCENT * STAGE_CONFIG.ASPECT_RATIO;
  const domPlayerWidth = Math.min(maxWByVw, maxWByVh);
  const domPlayerHeight = domPlayerWidth / STAGE_CONFIG.ASPECT_RATIO;

  const fracH = domPlayerHeight / h;

  // Frustum at Z = -4.5:
  // Distance from camera Z (9.2) to screen Z (-4.5) is 13.7m
  const distZ = STAGE_CONFIG.CAMERA_Z - STAGE_CONFIG.SCREEN_Z;
  const halfFovRad = THREE.MathUtils.degToRad(STAGE_CONFIG.CAMERA_FOV_DEG / 2);
  const frustumHeight = 2 * distZ * Math.tan(halfFovRad); // ~15.8194m
  const frustumWidth = frustumHeight * aspect;

  const screenHeight = fracH * frustumHeight;
  const screenWidth = screenHeight * STAGE_CONFIG.ASPECT_RATIO;

  // CSS top: 48% means player center is (0.50 - 0.48) = 2% above viewport midpoint.
  // Frustum center Y is 4.4 (where camera looks at).
  const screenCenterY =
    STAGE_CONFIG.CAMERA_LOOKAT_Y +
    (0.50 - STAGE_CONFIG.DOM_TOP_PERCENT) * frustumHeight;

  const halfWidth = screenWidth / 2;
  const halfHeight = screenHeight / 2;

  return {
    viewportWidth: w,
    viewportHeight: h,
    aspect,
    domPlayerWidth,
    domPlayerHeight,
    frustumWidth,
    frustumHeight,
    screenWidth,
    screenHeight,
    screenCenterY,
    screenZ: STAGE_CONFIG.SCREEN_Z,
    halfWidth,
    halfHeight,
    topY: screenCenterY + halfHeight,
    bottomY: screenCenterY - halfHeight,
    leftX: -halfWidth,
    rightX: halfWidth,
  };
}
