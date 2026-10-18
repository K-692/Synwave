/**
 * Synwave 3D Procedural Visual Engine
 * Orchestrates Three.js rendering pipeline, dynamic camera, layered effect choreography,
 * autonomous director scheduling, and color palette transitions.
 */

import * as THREE from 'three';
import type {
  AudioFeatures,
  ColorPalette,
  SectionType,
  TrackAnalysis,
  VisualEffect,
  VisualEffectContext,
  VisualSettings,
} from '../types';
import { getPaletteById } from './palettes';
import { StarfieldEffect } from './effects/StarfieldEffect';
import { WireframeCoreEffect } from './effects/WireframeCoreEffect';
import { WaveformRingEffect } from './effects/WaveformRingEffect';
import { SpectrumBarsEffect } from './effects/SpectrumBarsEffect';
import { AudioRibbonsEffect } from './effects/AudioRibbonsEffect';
import { LaserBeamsEffect } from './effects/LaserBeamsEffect';
import { ShockwaveRingEffect } from './effects/ShockwaveRingEffect';

export class VisualEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private pointLight1!: THREE.PointLight;
  private pointLight2!: THREE.PointLight;

  // Effects Catalogue
  private effects: VisualEffect[] = [];
  private activePalette: ColorPalette;

  // Animation and Timing
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private trackSeed = 42;
  private trackAnalysis: TrackAnalysis | null = null;

  // Camera dynamics
  private cameraBaseDistance = 24.0;
  private cameraAngle = 0;
  private cameraTargetFov = 60;
  private mouseX = 0;
  private mouseY = 0;

  // Settings
  private settings: VisualSettings = {
    effectIntensity: 1.0,
    cameraSpeed: 1.0,
    bloomGlow: true,
    wireframe: false,
    paletteId: 'cyberpunk-neon',
    quality: 'high',
    directorMode: 'auto',
    activeEffects: [
      'starfield-warp',
      'wireframe-core',
      'waveform-ring',
      'spectrum-bars',
      'audio-ribbons',
      'laser-beams',
      'shockwave-rings',
    ],
  };

  // Live state callback
  public onCurrentSectionChange?: (section: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.activePalette = getPaletteById(this.settings.paletteId);
    this.initThree();
    this.initEffects();
    this.setupWindowListeners();
  }

  private initThree(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Allows high-res screenshots
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.activePalette.background);
    this.scene.fog = new THREE.FogExp2(this.activePalette.background, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    this.camera.position.set(0, 4, this.cameraBaseDistance);
    this.camera.lookAt(0, 0, 0);

    // Dynamic Lighting
    this.ambientLight = new THREE.AmbientLight(this.activePalette.ambientColor, 1.2);
    this.scene.add(this.ambientLight);

    this.pointLight1 = new THREE.PointLight(this.activePalette.primary, 3.0, 50);
    this.pointLight1.position.set(10, 15, 10);
    this.scene.add(this.pointLight1);

    this.pointLight2 = new THREE.PointLight(this.activePalette.secondary, 2.5, 50);
    this.pointLight2.position.set(-10, -10, 5);
    this.scene.add(this.pointLight2);
  }

  private initEffects(): void {
    // Instantiate modular procedural effect catalogue
    this.effects = [
      new StarfieldEffect(),
      new WireframeCoreEffect(),
      new WaveformRingEffect(),
      new SpectrumBarsEffect(),
      new AudioRibbonsEffect(),
      new LaserBeamsEffect(),
      new ShockwaveRingEffect(),
    ];

    const context = this.createEffectContext(
      {
        timeSeconds: 0,
        rms: 0,
        bass: 0,
        lowMid: 0,
        highMid: 0,
        treble: 0,
        spectralCentroid: 0.5,
        onsetStrength: 0,
        beatConfidence: 0,
        isBeat: false,
        frequencyData: new Uint8Array(1024),
        timeDomainData: new Uint8Array(1024),
      },
      0.016,
      0
    );

    for (const effect of this.effects) {
      effect.initialize(context);
    }
  }

  private createEffectContext(features: AudioFeatures, deltaSeconds: number, trackTimeSeconds: number): VisualEffectContext {
    return {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      features,
      deltaSeconds,
      trackTimeSeconds,
      seed: this.trackSeed,
      quality: this.settings.quality,
      palette: this.activePalette,
      intensity: this.settings.effectIntensity,
      wireframeOnly: this.settings.wireframe,
    };
  }

  private setupWindowListeners(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  private handleResize = (): void => {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);

    for (const effect of this.effects) {
      effect.resize(width, height);
    }
  };

  /**
   * Sets deterministic seed and analysis profile for a track.
   */
  public setTrackProfile(seed: number, analysis?: TrackAnalysis): void {
    this.trackSeed = seed;
    this.trackAnalysis = analysis || null;
  }

  /**
   * Updates visual settings (palette, intensity, mode, effects toggle).
   */
  public updateSettings(newSettings: Partial<VisualSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    if (newSettings.paletteId) {
      this.activePalette = getPaletteById(newSettings.paletteId);
      this.scene.background = new THREE.Color(this.activePalette.background);
      if (this.scene.fog) {
        (this.scene.fog as THREE.FogExp2).color.set(this.activePalette.background);
      }
      this.ambientLight.color.set(this.activePalette.ambientColor);
      this.pointLight1.color.set(this.activePalette.primary);
      this.pointLight2.color.set(this.activePalette.secondary);
    }

    if (newSettings.activeEffects) {
      for (const effect of this.effects) {
        effect.enabled = this.settings.activeEffects.includes(effect.id);
      }
    }
  }

  /**
   * Evaluates the current section and adapts effects according to the visual director plan.
   */
  private evaluateAutonomousDirector(trackTimeSeconds: number, features: AudioFeatures): void {
    if (this.settings.directorMode !== 'auto') return;

    let currentSectionType: SectionType = 'build';
    let currentLabel = 'DIRECTOR: ACTIVE';

    if (this.trackAnalysis && this.trackAnalysis.sections.length > 0) {
      const activeSection = this.trackAnalysis.sections.find(
        (s) => trackTimeSeconds >= s.startTime && trackTimeSeconds < s.endTime
      );
      if (activeSection) {
        currentSectionType = activeSection.type;
        currentLabel = activeSection.label;
      }
    } else {
      // Live fallback based on energy
      if (features.bass > 0.65 || features.rms > 0.6) {
        currentSectionType = 'drop';
        currentLabel = 'LIVE: DROP / CLIMAX';
      } else if (features.rms < 0.25) {
        currentSectionType = 'intro';
        currentLabel = 'LIVE: AMBIENT';
      } else {
        currentSectionType = 'build';
        currentLabel = 'LIVE: GROOVE';
      }
    }

    this.onCurrentSectionChange?.(currentLabel);

    // Apply choreography based on section type
    for (const effect of this.effects) {
      switch (currentSectionType) {
        case 'intro':
        case 'outro':
          // Soft ambient atmosphere: starfield, waveforms, gentle ribbons
          if (['starfield-warp', 'waveform-ring', 'audio-ribbons'].includes(effect.id)) {
            effect.enabled = true;
            effect.setIntensity(this.settings.effectIntensity * 0.7);
          } else {
            effect.enabled = false;
          }
          break;

        case 'build':
          // Rising energy: add geometric core, lasers, bars
          effect.enabled = true;
          effect.setIntensity(this.settings.effectIntensity * 1.0);
          break;

        case 'drop':
          // Maximum intensity: all visual weapons firing!
          effect.enabled = true;
          effect.setIntensity(this.settings.effectIntensity * 1.5);
          break;

        case 'breakdown':
          // Stripped back for breathing room
          if (['laser-beams', 'shockwave-rings'].includes(effect.id)) {
            effect.enabled = false;
          } else {
            effect.enabled = true;
            effect.setIntensity(this.settings.effectIntensity * 0.8);
          }
          break;
      }
    }
  }

  /**
   * Main per-frame render loop. Evaluates live audio features and authoritative clock.
   */
  public renderFrame(getLiveFeatures: () => AudioFeatures, getCurrentTime: () => number): void {
    const now = performance.now();
    const deltaSeconds = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const trackTimeSeconds = getCurrentTime();
    const features = getLiveFeatures();

    // Autonomous Director logic
    this.evaluateAutonomousDirector(trackTimeSeconds, features);

    // Camera Motion & Punchy Audio FOV Pulse
    this.cameraAngle += deltaSeconds * 0.15 * this.settings.cameraSpeed * (1 + features.rms * 0.5);

    const orbitRadius = this.cameraBaseDistance + (features.bass * 2.5);
    const targetCamX = Math.sin(this.cameraAngle) * orbitRadius + this.mouseX * 3.0;
    const targetCamZ = Math.cos(this.cameraAngle) * orbitRadius;
    const targetCamY = 3.0 + Math.sin(this.cameraAngle * 0.5) * 2.0 + this.mouseY * 2.0;

    this.camera.position.x += (targetCamX - this.camera.position.x) * deltaSeconds * 4.0;
    this.camera.position.y += (targetCamY - this.camera.position.y) * deltaSeconds * 4.0;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * deltaSeconds * 4.0;
    this.camera.lookAt(0, 0, 0);

    // Audio-reactive punchy FOV kick on beat
    const beatFovBoost = features.isBeat ? 4.5 : features.bass * 2.0;
    const desiredFov = 60 + beatFovBoost;
    this.cameraTargetFov += (desiredFov - this.cameraTargetFov) * deltaSeconds * 12.0;
    this.camera.fov = this.cameraTargetFov;
    this.camera.updateProjectionMatrix();

    // Point lights dynamic pulsation
    this.pointLight1.intensity = 2.0 + features.bass * 4.0;
    this.pointLight2.intensity = 1.8 + features.highMid * 3.5;

    // Render all active procedural effects
    const context = this.createEffectContext(features, deltaSeconds, trackTimeSeconds);
    for (const effect of this.effects) {
      if (effect.enabled) {
        effect.update(context);
      }
    }

    // Three.js Render pass
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Starts the continuous rendering animation loop.
   */
  public start(getLiveFeatures: () => AudioFeatures, getCurrentTime: () => number): void {
    const loop = () => {
      this.renderFrame(getLiveFeatures, getCurrentTime);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Captures a high-resolution PNG screenshot of the current visual frame.
   */
  public captureSnapshot(): string {
    return this.renderer.domElement.toDataURL('image/png');
  }

  public getEffectsList(): { id: string; name: string; family: string; enabled: boolean }[] {
    return this.effects.map((e) => ({
      id: e.id,
      name: e.name,
      family: e.family,
      enabled: e.enabled,
    }));
  }

  public toggleEffect(id: string, enabled?: boolean): void {
    const effect = this.effects.find((e) => e.id === id);
    if (effect) {
      effect.enabled = enabled !== undefined ? enabled : !effect.enabled;
      if (effect.enabled && !this.settings.activeEffects.includes(id)) {
        this.settings.activeEffects.push(id);
      } else if (!effect.enabled) {
        this.settings.activeEffects = this.settings.activeEffects.filter((x) => x !== id);
      }
    }
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);

    for (const effect of this.effects) {
      effect.dispose();
    }
    this.effects = [];

    this.renderer.dispose();
  }
}
