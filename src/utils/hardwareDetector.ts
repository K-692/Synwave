/**
 * Synwave Hardware & GPU/MPS Detection Utility
 * 
 * Detects whether the host system is running hardware-accelerated GPU
 * (including Apple Silicon MPS / Metal, NVIDIA, AMD Radeon, Intel Arc)
 * versus software CPU rendering (SwiftShader, llvmpipe), and chooses
 * optimal default visualizer quality and target framerate presets.
 */

import type { QualityPreset } from '../types';

export interface HardwareProfile {
  hasGpu: boolean;
  gpuName: string;
  vendor: string;
  isAppleMps: boolean;
  recommendedQuality: QualityPreset;
  targetFps: number;
  maxPixelRatio: number;
}

export function detectHardwareProfile(): HardwareProfile {
  if (typeof window === 'undefined') {
    return {
      hasGpu: true,
      gpuName: 'Server / Headless',
      vendor: 'Generic',
      isAppleMps: false,
      recommendedQuality: 'high',
      targetFps: 60,
      maxPixelRatio: 1.0,
    };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);

    if (!gl) {
      return {
        hasGpu: false,
        gpuName: 'WebGL Unsupported (Software Fallback)',
        vendor: 'Unknown',
        isAppleMps: false,
        recommendedQuality: 'low',
        targetFps: 60,
        maxPixelRatio: 1.0,
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let renderer = '';
    let vendor = '';

    if (debugInfo) {
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    } else {
      renderer = gl.getParameter(gl.RENDERER) || '';
      vendor = gl.getParameter(gl.VENDOR) || '';
    }

    const rendererLower = renderer.toLowerCase();
    const vendorLower = vendor.toLowerCase();

    // Check for software / CPU rasterizer emulation
    const isSoftware =
      rendererLower.includes('swiftshader') ||
      rendererLower.includes('llvmpipe') ||
      rendererLower.includes('software rasterizer') ||
      rendererLower.includes('microsoft basic render') ||
      rendererLower.includes('mesa software');

    // Detect Apple Silicon Metal / MPS (M1, M2, M3, M4, Apple GPU)
    const isAppleMps =
      rendererLower.includes('apple') ||
      vendorLower.includes('apple') ||
      /apple\s+m\d+/i.test(renderer);

    // Detect dedicated / discrete or hardware GPU
    const hasGpu =
      !isSoftware &&
      (isAppleMps ||
        rendererLower.includes('nvidia') ||
        rendererLower.includes('geforce') ||
        rendererLower.includes('rtx') ||
        rendererLower.includes('gtx') ||
        rendererLower.includes('amd') ||
        rendererLower.includes('radeon') ||
        rendererLower.includes('iris') ||
        rendererLower.includes('arc') ||
        rendererLower.includes('intel') ||
        rendererLower.includes('adreno') ||
        rendererLower.includes('mali'));

    let recommendedQuality: QualityPreset = 'high';
    let targetFps = 60;
    let maxPixelRatio = 2.0;

    if (isAppleMps) {
      // Apple Silicon Metal / MPS has unified memory & high compute throughput
      recommendedQuality = 'high';
      targetFps = 60;
      maxPixelRatio = 2.0;
    } else if (hasGpu) {
      // Hardware GPU present
      recommendedQuality = 'high';
      targetFps = 60;
      maxPixelRatio = 2.0;
    } else {
      // Software / CPU fallback: clamp to medium/low and 60fps cap
      recommendedQuality = 'medium';
      targetFps = 60;
      maxPixelRatio = 1.0;
    }

    return {
      hasGpu,
      gpuName: renderer || (hasGpu ? 'Hardware GPU' : 'CPU Software Renderer'),
      vendor: vendor || 'Generic',
      isAppleMps,
      recommendedQuality,
      targetFps,
      maxPixelRatio,
    };
  } catch (err) {
    console.warn('Hardware detection fallback:', err);
    return {
      hasGpu: true,
      gpuName: 'Standard GPU',
      vendor: 'Generic',
      isAppleMps: false,
      recommendedQuality: 'high',
      targetFps: 60,
      maxPixelRatio: 1.5,
    };
  }
}
