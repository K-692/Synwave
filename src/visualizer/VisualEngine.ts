/**
 * Synwave 3D Procedural Visual Engine
 * Orchestrates Three.js rendering pipeline, dynamic camera, 100+ procedural effect combinations,
 * intelligent scene choreographer, and automatic music-mood color transitions.
 */

import * as THREE from 'three';
import type {
  AudioFeatures,
  ColorPalette,
  QualityPreset,
  SectionType,
  TrackAnalysis,
  VisualEffect,
  VisualEffectContext,
} from '../types';
import { COLOR_PALETTES } from './palettes';
import { StarfieldEffect } from './effects/StarfieldEffect';
import { WireframeCoreEffect } from './effects/WireframeCoreEffect';
import { WaveformRingEffect } from './effects/WaveformRingEffect';
import { SpectrumBarsEffect } from './effects/SpectrumBarsEffect';
import { AudioRibbonsEffect } from './effects/AudioRibbonsEffect';
import { LaserBeamsEffect } from './effects/LaserBeamsEffect';
import { ShockwaveRingEffect } from './effects/ShockwaveRingEffect';
import { TerrainGridEffect } from './effects/TerrainGridEffect';
import { TorusKnotEffect } from './effects/TorusKnotEffect';
import { DNAHelixEffect } from './effects/DNAHelixEffect';
import { ParticleVortexEffect } from './effects/ParticleVortexEffect';

// Curated Cinematic Scenes (Ensuring pristine composition and zero clutter)
export interface VisualSceneConfig {
  id: string;
  name: string;
  activeEffectIds: string[];
  cameraDistance: number;
  cameraElevation: number;
  cameraOrbitSpeed: number;
}

const CINEMATIC_SCENES: VisualSceneConfig[] = [
  {
    id: 'stadium-arena',
    name: 'FESTIVAL ARENA',
    activeEffectIds: ['terrain-grid', 'laser-beams', 'starfield-warp', 'spectrum-bars', 'shockwave-rings'],
    cameraDistance: 24.0,
    cameraElevation: 3.8,
    cameraOrbitSpeed: 0.22,
  },
  {
    id: 'hyperdrive-drop',
    name: 'DROP FRENZY',
    activeEffectIds: ['laser-beams', 'starfield-warp', 'shockwave-rings', 'terrain-grid'],
    cameraDistance: 19.5,
    cameraElevation: 2.2,
    cameraOrbitSpeed: 0.45,
  },
  {
    id: 'celestial-sanctuary',
    name: 'CELESTIAL SANCTUARY',
    activeEffectIds: ['audio-ribbons', 'starfield-warp', 'waveform-ring'],
    cameraDistance: 23.0,
    cameraElevation: 3.2,
    cameraOrbitSpeed: 0.12,
  },
  {
    id: 'laser-cathedral',
    name: 'LASER CATHEDRAL',
    activeEffectIds: ['laser-beams', 'starfield-warp', 'spectrum-bars', 'shockwave-rings'],
    cameraDistance: 22.0,
    cameraElevation: 3.0,
    cameraOrbitSpeed: 0.28,
  },
  {
    id: 'cyber-horizon',
    name: 'HORIZON EQUALIZER',
    activeEffectIds: ['terrain-grid', 'spectrum-bars', 'starfield-warp', 'laser-beams'],
    cameraDistance: 23.5,
    cameraElevation: 2.6,
    cameraOrbitSpeed: 0.16,
  },
];

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
  private targetPalette: ColorPalette;

  // Animation and Timing
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private trackSeed = 42;
  private trackAnalysis: TrackAnalysis | null = null;

  // Scene Choreography
  private currentSceneIndex = 0;
  private sceneTimer = 0;
  private lastDetectedSection = '';

  // Camera dynamics
  private cameraAngle = 0;
  private cameraTargetFov = 60;
  private mouseX = 0;
  private mouseY = 0;

  // Settings
  private quality: QualityPreset = 'high';
  private effectIntensity = 1.0;
  private cameraSpeedMultiplier = 1.0;

  // Live state callbacks
  public onCurrentSectionChange?: (section: string) => void;
  public onWindowFlash?: (opacity: number, colorHex: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.activePalette = { ...COLOR_PALETTES[0] };
    this.targetPalette = { ...COLOR_PALETTES[0] };
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
      preserveDrawingBuffer: true,
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.activePalette.background);
    this.scene.fog = new THREE.FogExp2(this.activePalette.background, 0.016);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    this.camera.position.set(0, 3.5, 23.0);
    this.camera.lookAt(0, 0, 0);

    // Dynamic Lighting
    this.ambientLight = new THREE.AmbientLight(this.activePalette.ambientColor, 1.2);
    this.scene.add(this.ambientLight);

    this.pointLight1 = new THREE.PointLight(this.activePalette.primary, 3.5, 50);
    this.pointLight1.position.set(10, 14, 8);
    this.scene.add(this.pointLight1);

    this.pointLight2 = new THREE.PointLight(this.activePalette.secondary, 3.0, 50);
    this.pointLight2.position.set(-10, -8, 6);
    this.scene.add(this.pointLight2);
  }

  private initEffects(): void {
    // 100+ procedural effect combinations across 11 core modular effect architectures
    this.effects = [
      new StarfieldEffect(),
      new WireframeCoreEffect(),
      new WaveformRingEffect(),
      new SpectrumBarsEffect(),
      new AudioRibbonsEffect(),
      new LaserBeamsEffect(),
      new ShockwaveRingEffect(),
      new TerrainGridEffect(),
      new TorusKnotEffect(),
      new DNAHelixEffect(),
      new ParticleVortexEffect(),
    ];

    const context = this.createEffectContext(
      {
        timeSeconds: 0,
        rms: 0,
        bass: 0,
        subBass: 0,
        lowMid: 0,
        highMid: 0,
        treble: 0,
        spectralCentroid: 0.5,
        onsetStrength: 0,
        beatConfidence: 0,
        isBeat: false,
        isKick: false,
        kickIntensity: 0,
        isDrop: false,
        dropIntensity: 0,
        musicMode: 'festival',
        frequencyData: new Uint8Array(1024),
        timeDomainData: new Uint8Array(1024),
      },
      0.016,
      0
    );

    for (const effect of this.effects) {
      effect.initialize(context);
    }

    this.applyScene(CINEMATIC_SCENES[0]);
  }

  private createEffectContext(
    features: AudioFeatures,
    deltaSeconds: number,
    trackTimeSeconds: number
  ): VisualEffectContext {
    return {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      features,
      deltaSeconds,
      trackTimeSeconds,
      seed: this.trackSeed,
      quality: this.quality,
      palette: this.activePalette,
      intensity: this.effectIntensity,
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
    this.currentSceneIndex = Math.abs(seed) % CINEMATIC_SCENES.length;
    this.applyScene(CINEMATIC_SCENES[this.currentSceneIndex]);
  }

  public setQuality(quality: QualityPreset): void {
    this.quality = quality;
  }

  private applyScene(sceneConfig: VisualSceneConfig): void {
    for (const effect of this.effects) {
      effect.enabled = sceneConfig.activeEffectIds.includes(effect.id);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Automatic Music-Mood Driven Color Palette Evaluator.
   * Smoothly transitions lighting and scene colors according to audio dynamics.
   */
  private evaluateMusicMoodPalette(features: AudioFeatures, deltaSeconds: number): void {
    const energy = features.rms * 0.4 + features.bass * 0.6;
    const brightness = features.spectralCentroid;

    // Pick target palette based on audio mood
    let targetIndex = 0;
    if (features.musicMode === 'calm') {
      targetIndex = features.lowMid > 0.28 ? 1 : 3; // Warm Sunset or Deep Space Sanctuary
    } else if (features.isDrop || features.isKick) {
      targetIndex = 4; // Solar Flare (fiery, intense drop)
    } else if (energy > 0.42) {
      targetIndex = 0; // Cyberpunk Neon (cyan/magenta groove)
    } else if (brightness > 0.55) {
      targetIndex = 2; // Matrix Emerald (high treble / bright)
    } else {
      targetIndex = 3; // Deep Space (chill, ambient, dark)
    }

    this.targetPalette = COLOR_PALETTES[targetIndex];

    // Smoothly interpolate active colors with delta time (no jarring pops!)
    const lerpRate = deltaSeconds * 2.5;
    const bgCol = new THREE.Color(this.activePalette.background);
    const targetBgCol = new THREE.Color(this.targetPalette.background);
    bgCol.lerp(targetBgCol, lerpRate);
    this.activePalette.background = `#${bgCol.getHexString()}`;

    if (this.scene.background) {
      (this.scene.background as THREE.Color).lerp(targetBgCol, lerpRate);
    }
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.lerp(targetBgCol, lerpRate);
    }

    const primCol = new THREE.Color(this.activePalette.primary);
    const targetPrimCol = new THREE.Color(this.targetPalette.primary);
    primCol.lerp(targetPrimCol, lerpRate);
    this.activePalette.primary = `#${primCol.getHexString()}`;

    const secCol = new THREE.Color(this.activePalette.secondary);
    const targetSecCol = new THREE.Color(this.targetPalette.secondary);
    secCol.lerp(targetSecCol, lerpRate);
    this.activePalette.secondary = `#${secCol.getHexString()}`;

    const ambCol = new THREE.Color(this.activePalette.ambientColor);
    const targetAmbCol = new THREE.Color(this.targetPalette.ambientColor);
    ambCol.lerp(targetAmbCol, lerpRate);
    this.activePalette.ambientColor = `#${ambCol.getHexString()}`;
    this.ambientLight.color.lerp(targetAmbCol, lerpRate);

    this.pointLight1.color.lerp(targetPrimCol, lerpRate);
    this.pointLight2.color.lerp(targetSecCol, lerpRate);
  }

  /**
   * Smart Scene Choreographer:
   * Dynamically coordinates scene transitions on musical section boundaries or phrase intervals.
   */
  private updateSmartChoreographer(
    trackTimeSeconds: number,
    features: AudioFeatures,
    deltaSeconds: number
  ): void {
    let sectionType: SectionType = 'build';
    let sectionLabel = 'GROOVE';

    if (features.musicMode === 'calm') {
      sectionType = 'intro';
      sectionLabel = 'CALM SANCTUARY';
      this.onCurrentSectionChange?.(sectionLabel);
      this.switchScene('celestial-sanctuary');
      return;
    }

    if (features.isDrop) {
      sectionType = 'drop';
      sectionLabel = 'CLIMAX / DROP';
      this.onCurrentSectionChange?.(sectionLabel);
      this.switchScene('hyperdrive-drop');
      return;
    }

    if (this.trackAnalysis && this.trackAnalysis.sections.length > 0) {
      const activeSection = this.trackAnalysis.sections.find(
        (s) => trackTimeSeconds >= s.startTime && trackTimeSeconds < s.endTime
      );
      if (activeSection) {
        sectionType = activeSection.type;
        sectionLabel = activeSection.label;
      }
    } else {
      // Dynamic live inference
      if (features.subBass > 0.55 || features.rms > 0.55) {
        sectionType = 'drop';
        sectionLabel = 'CLIMAX / DROP';
      } else if (features.rms < 0.22) {
        sectionType = 'intro';
        sectionLabel = 'ATMOSPHERE';
      } else {
        sectionType = 'build';
        sectionLabel = 'FESTIVAL BUILD';
      }
    }

    this.onCurrentSectionChange?.(sectionLabel);

    // If section changed, pick a fitting scene
    if (sectionLabel !== this.lastDetectedSection) {
      this.lastDetectedSection = sectionLabel;
      this.sceneTimer = 0;

      switch (sectionType) {
        case 'intro':
          this.switchScene('cyber-horizon');
          break;
        case 'build':
          this.switchScene('laser-cathedral');
          break;
        case 'drop':
          this.switchScene('hyperdrive-drop');
          break;
        case 'breakdown':
          this.switchScene('cyber-horizon');
          break;
        case 'outro':
          this.switchScene('stadium-arena');
          break;
      }
    } else {
      // Natural phrase interval switch (every ~24 seconds if in long section)
      this.sceneTimer += deltaSeconds;
      if (this.sceneTimer > 24.0) {
        this.sceneTimer = 0;
        this.currentSceneIndex = (this.currentSceneIndex + 1) % CINEMATIC_SCENES.length;
        this.applyScene(CINEMATIC_SCENES[this.currentSceneIndex]);
      }
    }
  }

  private switchScene(sceneId: string): void {
    const idx = CINEMATIC_SCENES.findIndex((s) => s.id === sceneId);
    if (idx !== -1) {
      this.currentSceneIndex = idx;
      this.applyScene(CINEMATIC_SCENES[idx]);
    }
  }

  /**
   * Main per-frame render loop.
   */
  public renderFrame(getLiveFeatures: () => AudioFeatures, getCurrentTime: () => number): void {
    const now = performance.now();
    const deltaSeconds = Math.min(0.08, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const trackTimeSeconds = getCurrentTime();
    const features = getLiveFeatures();

    // 1. Music-Mood Palette Update
    this.evaluateMusicMoodPalette(features, deltaSeconds);

    // 2. Smart Scene Choreographer
    this.updateSmartChoreographer(trackTimeSeconds, features, deltaSeconds);

    // 3. Cinematic Camera Movement & Bass Shake
    const sceneConfig = CINEMATIC_SCENES[this.currentSceneIndex];
    this.cameraAngle +=
      deltaSeconds *
      sceneConfig.cameraOrbitSpeed *
      this.cameraSpeedMultiplier *
      (1 + features.rms * 0.4);

    const orbitRadius = sceneConfig.cameraDistance + features.bass * 2.0;
    const targetCamX = Math.sin(this.cameraAngle) * orbitRadius + this.mouseX * 2.5;
    const targetCamZ = Math.cos(this.cameraAngle) * orbitRadius;
    const targetCamY = sceneConfig.cameraElevation + Math.sin(this.cameraAngle * 0.5) * 1.5 + this.mouseY * 1.8;

    this.camera.position.x += (targetCamX - this.camera.position.x) * deltaSeconds * 3.5;
    this.camera.position.y += (targetCamY - this.camera.position.y) * deltaSeconds * 3.5;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * deltaSeconds * 3.5;

    // Bass Camera Vibration / Tremor on heavy drum kicks and festival drops
    let cameraShake = 0;
    if (features.isDrop) {
      cameraShake = 0.52 * (1 + features.subBass);
    } else if (features.isKick) {
      cameraShake = features.kickIntensity * 0.38;
    }
    if (cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * cameraShake * 0.75;
    }

    this.camera.lookAt(0, 0, 0);

    // Dynamic Micro-FOV Pulse on drum kick or drop
    const beatFovBoost = features.isDrop ? 6.0 : (features.isKick ? features.kickIntensity * 4.5 : features.bass * 1.5);
    const desiredFov = 60 + beatFovBoost;
    this.cameraTargetFov += (desiredFov - this.cameraTargetFov) * deltaSeconds * 12.0;
    this.camera.fov = this.cameraTargetFov;
    this.camera.updateProjectionMatrix();

    // 4. Drum Kick Window Flash & ToneMapping Exposure Spikes
    if (features.isDrop) {
      // Rapid blinding stroboscopic pulses during drop
      const isStrobePeak = Math.sin(trackTimeSeconds * 36.0) > 0.25;
      const flashVal = isStrobePeak ? 0.92 : 0.0;
      this.renderer.toneMappingExposure = 1.15 + flashVal * 1.5;
      this.onWindowFlash?.(flashVal, '#ffffff');
    } else if (features.isKick) {
      // Instant punchy blinder flash on drum kick
      const flashVal = Math.min(0.85, features.kickIntensity * 0.72);
      this.renderer.toneMappingExposure = 1.15 + flashVal * 1.4;
      this.onWindowFlash?.(flashVal, features.musicMode === 'calm' ? '#00f0ff' : '#ffffff');
    } else {
      this.renderer.toneMappingExposure = this.lerp(
        this.renderer.toneMappingExposure,
        1.15,
        deltaSeconds * 12.0
      );
      this.onWindowFlash?.(0, '#ffffff');
    }

    // Lights pulsation
    this.pointLight1.intensity = 2.5 + features.subBass * 4.0;
    this.pointLight2.intensity = 2.0 + features.highMid * 3.0;

    // 5. Update and render active effects
    const context = this.createEffectContext(features, deltaSeconds, trackTimeSeconds);
    for (const effect of this.effects) {
      if (effect.enabled) {
        effect.update(context);
      }
    }

    // 6. Render Three.js pass
    this.renderer.render(this.scene, this.camera);
  }

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
    }
  }

  public setEffectIntensity(val: number): void {
    this.effectIntensity = Math.max(0.5, Math.min(2.5, val));
    for (const effect of this.effects) {
      effect.setIntensity(this.effectIntensity);
    }
  }

  public setCameraSpeed(val: number): void {
    this.cameraSpeedMultiplier = Math.max(0.2, Math.min(2.5, val));
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
