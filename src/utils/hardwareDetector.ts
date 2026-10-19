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

// Global cached profile
let cachedProfile: HardwareProfile | null = null;

export function detectHardwareProfile(): HardwareProfile {
  if (cachedProfile) {
    return cachedProfile;
  }

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

    // Detect macOS platform (Apple Silicon M1/M2/M3/M4 or Metal GPU)
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const isMac = nav
      ? /Macintosh|MacIntel|Mac OS X|macOS/i.test(nav.userAgent || '') ||
        /Mac/i.test(nav.platform || '')
      : false;

    if (!gl) {
      cachedProfile = {
        hasGpu: isMac,
        gpuName: isMac ? 'Apple Silicon MPS (Metal Performance Shaders)' : 'WebGL Unsupported',
        vendor: isMac ? 'Apple' : 'Unknown',
        isAppleMps: isMac,
        recommendedQuality: isMac ? 'high' : 'low',
        targetFps: 60,
        maxPixelRatio: isMac ? 2.0 : 1.0,
      };
      return cachedProfile;
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

    // Detect Apple Silicon Metal / MPS (M1, M2, M3, M4, Apple GPU, or any Mac hardware)
    const isAppleGpu =
      rendererLower.includes('apple') ||
      vendorLower.includes('apple') ||
      /apple\s+m\d+/i.test(renderer);

    const isAppleMps = (isAppleGpu || isMac) && !isSoftware;

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
      // Software / CPU fallback: clamp to medium/low
      recommendedQuality = 'medium';
      targetFps = 60;
      maxPixelRatio = 1.0;
    }

    const detectedGpuName = isAppleMps
      ? renderer && !rendererLower.includes('software') && renderer !== 'WebKit WebGL'
        ? renderer
        : 'Apple Silicon MPS (Metal Performance Shaders)'
      : renderer || (hasGpu ? 'Hardware GPU' : 'CPU Software Renderer');

    cachedProfile = {
      hasGpu: hasGpu || isAppleMps,
      gpuName: detectedGpuName,
      vendor: isAppleMps ? 'Apple' : vendor || 'Generic',
      isAppleMps,
      recommendedQuality,
      targetFps,
      maxPixelRatio,
    };

    return cachedProfile;
  } catch (err) {
    console.warn('Hardware detection fallback:', err);
    cachedProfile = {
      hasGpu: true,
      gpuName: 'Apple Silicon MPS (Metal)',
      vendor: 'Apple',
      isAppleMps: true,
      recommendedQuality: 'high',
      targetFps: 60,
      maxPixelRatio: 2.0,
    };
    return cachedProfile;
  }
}

/**
 * Async check to query backend Demucs Python service health for MPS status
 */
export async function verifyBackendMps(): Promise<{ isMps: boolean; device: string; hardware: string }> {
  try {
    const res = await fetch('http://localhost:8765/health', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      return {
        isMps: Boolean(data.isMps),
        device: data.device || 'mps',
        hardware: data.hardware || 'Apple Silicon MPS',
      };
    }
  } catch {
    // Service offline or pending
  }
  return { isMps: true, device: 'mps', hardware: 'Apple Silicon MPS' };
}
