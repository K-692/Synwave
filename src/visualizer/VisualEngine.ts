/**
 * Synwave 3D Concert Stage Visual Engine
 * 
 * Orchestrates a music festival stage visualization:
 * - Camera fixed directly in front of the stage from audience/VIP perspective
 * - Curved Jumbotron LED screen with 100+ audio-reactive visual themes & Now Playing HUD
 * - 14 Moving-head volumetric stage spotlights
 * - 24 Razor-thin concert lasers (Liquid sky, stadium fan, scissor cross, drop strobe)
 * - 6 Front-stage pyro flame blasters bursting fire plumes on kicks & drops
 * - 4 High-velocity Cryo CO2 cannons and rolling stage fog
 * - Bass floor shockwaves and stadium arena backdrop
 * - Zero center spiral/particle clutter
 * - Edge-to-edge true fullscreen guarantee with zero black gaps
 */

import * as THREE from 'three';
import type {
  AudioFeatures,
  ColorPalette,
  MusicMood,
  QualityPreset,
  TrackAnalysis,
  VisualEffect,
  VisualEffectContext,
} from '../types';
import { COLOR_PALETTES } from './palettes';
import { StageStructureEffect } from './effects/StageStructureEffect';
import { StageLightsEffect } from './effects/StageLightsEffect';
import { ThinLasersEffect } from './effects/ThinLasersEffect';
import { FireShootersEffect } from './effects/FireShootersEffect';
import { SmokeMachinesEffect } from './effects/SmokeMachinesEffect';
import { ShockwaveRingEffect } from './effects/ShockwaveRingEffect';
import { StarfieldEffect } from './effects/StarfieldEffect';
import { TerrainGridEffect } from './effects/TerrainGridEffect';

export interface VisualSceneConfig {
  id: string;
  name: string;
  activeEffectIds: string[];
}

const CONCERT_SCENES: VisualSceneConfig[] = [
  {
    id: 'stadium-mainstage',
    name: 'MAINSTAGE FESTIVAL',
    activeEffectIds: ['stage-structure', 'stage-lights', 'thin-lasers', 'fire-shooters', 'smoke-machines', 'starfield-warp', 'shockwave-rings'],
  },
  {
    id: 'pyro-drop-frenzy',
    name: 'PYRO DROP FRENZY',
    activeEffectIds: ['stage-structure', 'fire-shooters', 'thin-lasers', 'smoke-machines', 'stage-lights', 'shockwave-rings'],
  },
  {
    id: 'laser-cathedral',
    name: 'LASER CATHEDRAL',
    activeEffectIds: ['stage-structure', 'thin-lasers', 'stage-lights', 'smoke-machines', 'starfield-warp'],
  },
  {
    id: 'ambient-sanctuary',
    name: 'CELESTIAL CHILL',
    activeEffectIds: ['stage-structure', 'stage-lights', 'smoke-machines', 'starfield-warp'],
  },
  {
    id: 'cryo-horizon',
    name: 'CRYO STADIUM',
    activeEffectIds: ['stage-structure', 'smoke-machines', 'stage-lights', 'thin-lasers', 'terrain-grid', 'starfield-warp'],
  },
];

export class VisualEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  // Concert Lighting
  private ambientLight!: THREE.AmbientLight;
  private stageKeyLight!: THREE.PointLight;
  private stageFillLight!: THREE.PointLight;

  // Effects Catalogue
  private effects: VisualEffect[] = [];
  private activePalette: ColorPalette;
  private targetPalette: ColorPalette;

  // Animation and Timing
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private trackSeed = 42;
  private trackAnalysis: TrackAnalysis | null = null;

  // Track Metadata for Stage Screen
  private trackTitle = 'Feel Something';
  private trackArtist = 'ILLENIUM, Excision, I Prevail';
  private currentMood: MusicMood = 'euphoric-drop';

  // Scene Choreography
  private currentSceneIndex = 0;
  private sceneTimer = 0;
  private lastDetectedSection = '';

  // Camera Dynamics (Fixed in front of the stage with subtle parallax and bass rumble)
  private cameraBaseX = 0;
  private cameraBaseY = 1.4;
  private cameraBaseZ = 17.5;
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
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

    // Update style to guarantee exact edge-to-edge full bleed
    this.renderer.setSize(width, height, true);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020308);
    this.scene.fog = new THREE.FogExp2(0x020308, 0.014);

    // Fixed camera in front of the stage (Audience VIP View)
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 600);
    this.camera.position.set(this.cameraBaseX, this.cameraBaseY, this.cameraBaseZ);
    this.camera.lookAt(0, 3.8, -4.0);

    // Dynamic Concert Stage Lighting
    this.ambientLight = new THREE.AmbientLight(0x0a1020, 1.4);
    this.scene.add(this.ambientLight);

    this.stageKeyLight = new THREE.PointLight(0x00f0ff, 4.0, 60);
    this.stageKeyLight.position.set(12, 14, 2);
    this.scene.add(this.stageKeyLight);

    this.stageFillLight = new THREE.PointLight(0xff007f, 3.5, 60);
    this.stageFillLight.position.set(-12, 14, 2);
    this.scene.add(this.stageFillLight);
  }

  private initEffects(): void {
    // Modular concert stage architecture
    this.effects = [
      new StageStructureEffect(), // Curved LED Jumbotron Screen, 100+ Themes, Deck, Truss, Speakers
      new StageLightsEffect(),     // 14 Moving-head volumetric spotlights
      new ThinLasersEffect(),      // 24 Razor-thin lasers
      new FireShootersEffect(),    // 6 Front-stage flame blasters
      new SmokeMachinesEffect(),   // 4 Cryo CO2 jets & rolling stage haze
      new ShockwaveRingEffect(),   // Bass stage floor shockwave ripples
      new StarfieldEffect(),       // Stadium arena night sky
      new TerrainGridEffect(),     // Horizon stage grid
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
        mood: 'euphoric-drop',
        frequencyData: new Uint8Array(1024),
        timeDomainData: new Uint8Array(1024),
      },
      0.016,
      0
    );

    for (const effect of this.effects) {
      effect.initialize(context);
    }

    this.applyScene(CONCERT_SCENES[0]);
  }

  public setTrackInfo(title: string, artist: string, mood?: MusicMood): void {
    this.trackTitle = title;
    this.trackArtist = artist;
    if (mood) {
      this.currentMood = mood;
    }
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
      trackTitle: this.trackTitle,
      trackArtist: this.trackArtist,
      mood: this.currentMood || features.mood || 'euphoric-drop',
    };
  }

  private setupWindowListeners(): void {
    window.addEventListener('resize', this.triggerResize);
    document.addEventListener('fullscreenchange', this.triggerResize);
    document.addEventListener('webkitfullscreenchange', this.triggerResize);
    document.addEventListener('mozfullscreenchange', this.triggerResize);
    document.addEventListener('MSFullscreenChange', this.triggerResize);
    window.addEventListener('orientationchange', this.triggerResize);

    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  /**
   * Resizes renderer with zero-gap full bleed guarantee.
   * Dispatches multiple micro-delays to account for macOS fullscreen transition animation.
   */
  public triggerResize = (): void => {
    this.handleResize();
    setTimeout(this.handleResize, 60);
    setTimeout(this.handleResize, 180);
    setTimeout(this.handleResize, 350);
    setTimeout(this.handleResize, 600);
  };

  private handleResize = (): void => {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Passing true explicitly sets canvas.style.width and canvas.style.height
    this.renderer.setSize(width, height, true);

    for (const effect of this.effects) {
      effect.resize(width, height);
    }
  };

  public setTrackProfile(seed: number, analysis?: TrackAnalysis): void {
    this.trackSeed = seed;
    this.trackAnalysis = analysis || null;
    if (analysis?.descriptors?.mood) {
      this.currentMood = analysis.descriptors.mood;
    }
    this.currentSceneIndex = Math.abs(seed) % CONCERT_SCENES.length;
    this.applyScene(CONCERT_SCENES[this.currentSceneIndex]);
  }

  public setQuality(quality: QualityPreset): void {
    this.quality = quality;
  }

  private applyScene(sceneConfig: VisualSceneConfig): void {
    for (const effect of this.effects) {
      // Stage structure is always active
      if (effect.id === 'stage-structure') {
        effect.enabled = true;
      } else {
        effect.enabled = sceneConfig.activeEffectIds.includes(effect.id);
      }
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Mood-driven concert color palette manager
   */
  private evaluateMusicMoodPalette(features: AudioFeatures, deltaSeconds: number): void {
    const mood = this.currentMood || features.mood || 'euphoric-drop';

    let targetIndex = 0;
    if (mood === 'chill-ambient') {
      targetIndex = 3; // Deep Space Indigo / Chill
    } else if (mood === 'euphoric-drop' || features.isDrop) {
      targetIndex = 4; // Solar Flare Amber / Fiery Rave
    } else if (mood === 'dark-aggressive') {
      targetIndex = 4; // Solar Flare Crimson
    } else if (mood === 'uplifting-melodic') {
      targetIndex = 0; // Cyberpunk Neon
    } else if (mood === 'retro-groove') {
      targetIndex = 1; // Warm Sunset
    } else {
      targetIndex = 2; // Matrix Emerald
    }

    this.targetPalette = COLOR_PALETTES[targetIndex];

    const lerpRate = deltaSeconds * 2.8;
    const targetPrimCol = new THREE.Color(this.targetPalette.primary);
    const targetSecCol = new THREE.Color(this.targetPalette.secondary);

    const primCol = new THREE.Color(this.activePalette.primary);
    primCol.lerp(targetPrimCol, lerpRate);
    this.activePalette.primary = `#${primCol.getHexString()}`;

    const secCol = new THREE.Color(this.activePalette.secondary);
    secCol.lerp(targetSecCol, lerpRate);
    this.activePalette.secondary = `#${secCol.getHexString()}`;

    this.stageKeyLight.color.lerp(targetPrimCol, lerpRate);
    this.stageFillLight.color.lerp(targetSecCol, lerpRate);
  }

  /**
   * Smart Scene Choreographer for Concert Stage
   */
  private updateSmartChoreographer(
    trackTimeSeconds: number,
    features: AudioFeatures,
    deltaSeconds: number
  ): void {
    let sectionLabel = 'GROOVE';

    if (features.musicMode === 'calm' || this.currentMood === 'chill-ambient') {
      sectionLabel = 'CALM SANCTUARY';
      this.onCurrentSectionChange?.(sectionLabel);
      this.switchScene('ambient-sanctuary');
      return;
    }

    if (features.isDrop) {
      sectionLabel = 'CLIMAX / DROP';
      this.onCurrentSectionChange?.(sectionLabel);
      this.switchScene('pyro-drop-frenzy');
      return;
    }

    if (this.trackAnalysis && this.trackAnalysis.sections.length > 0) {
      const activeSection = this.trackAnalysis.sections.find(
        (s) => trackTimeSeconds >= s.startTime && trackTimeSeconds < s.endTime
      );
      if (activeSection) {
        sectionLabel = activeSection.label;
      }
    } else {
      if (features.subBass > 0.55 || features.rms > 0.55) {
        sectionLabel = 'CLIMAX / DROP';
      } else if (features.rms < 0.22) {
        sectionLabel = 'ATMOSPHERE';
      } else {
        sectionLabel = 'FESTIVAL BUILD';
      }
    }

    this.onCurrentSectionChange?.(sectionLabel);

    if (sectionLabel !== this.lastDetectedSection) {
      this.lastDetectedSection = sectionLabel;
      this.sceneTimer = 0;

      if (sectionLabel.includes('DROP')) {
        this.switchScene('pyro-drop-frenzy');
      } else if (sectionLabel.includes('BUILD')) {
        this.switchScene('laser-cathedral');
      } else {
        this.switchScene('stadium-mainstage');
      }
    } else {
      this.sceneTimer += deltaSeconds;
      if (this.sceneTimer > 28.0) {
        this.sceneTimer = 0;
        this.currentSceneIndex = (this.currentSceneIndex + 1) % CONCERT_SCENES.length;
        this.applyScene(CONCERT_SCENES[this.currentSceneIndex]);
      }
    }
  }

  private switchScene(sceneId: string): void {
    const idx = CONCERT_SCENES.findIndex((s) => s.id === sceneId);
    if (idx !== -1) {
      this.currentSceneIndex = idx;
      this.applyScene(CONCERT_SCENES[idx]);
    }
  }

  /**
   * Main per-frame render loop
   */
  public renderFrame(getLiveFeatures: () => AudioFeatures, getCurrentTime: () => number): void {
    const now = performance.now();
    const deltaSeconds = Math.min(0.08, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const trackTimeSeconds = getCurrentTime();
    const features = getLiveFeatures();

    // 1. Mood-driven Palette
    this.evaluateMusicMoodPalette(features, deltaSeconds);

    // 2. Smart Scene Choreographer
    this.updateSmartChoreographer(trackTimeSeconds, features, deltaSeconds);

    // 3. Concert Front View Camera (Fixed in front of the stage with subtle parallax and bass rumble)
    const targetX = this.cameraBaseX + this.mouseX * 1.5;
    const targetY = this.cameraBaseY + this.mouseY * 0.7;
    const targetZ = this.cameraBaseZ;

    const camLerp = deltaSeconds * 4.0 * this.cameraSpeedMultiplier;
    this.camera.position.x += (targetX - this.camera.position.x) * camLerp;
    this.camera.position.y += (targetY - this.camera.position.y) * camLerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * camLerp;

    // Sub-bass rumble / vibration on heavy kicks and drops (gives visceral festival chest-thump)
    let rumble = 0;
    if (features.isDrop) {
      rumble = 0.16 * (1 + features.subBass);
    } else if (features.isKick) {
      rumble = features.kickIntensity * 0.12;
    }
    if (rumble > 0) {
      this.camera.position.x += (Math.random() - 0.5) * rumble;
      this.camera.position.y += (Math.random() - 0.5) * rumble * 0.8;
    }

    // Always look directly at the center of the concert stage screen
    this.camera.lookAt(0, 3.8, -4.0);

    // Dynamic FOV punch on kicks/drops
    const fovPunch = features.isDrop ? 3.5 : (features.isKick ? features.kickIntensity * 2.5 : 0);
    const desiredFov = 60 + fovPunch;
    this.cameraTargetFov += (desiredFov - this.cameraTargetFov) * deltaSeconds * 14.0;
    this.camera.fov = this.cameraTargetFov;
    this.camera.updateProjectionMatrix();

    // 4. Strobe Blinder Flash on drops and kick attacks
    if (features.isDrop) {
      const isStrobe = Math.sin(trackTimeSeconds * 36.0) > 0.3;
      const flashVal = isStrobe ? 0.9 : 0.0;
      this.renderer.toneMappingExposure = 1.15 + flashVal * 1.2;
      this.onWindowFlash?.(flashVal, '#ffffff');
    } else if (features.isKick && features.kickIntensity > 0.6) {
      const flashVal = features.kickIntensity * 0.5;
      this.renderer.toneMappingExposure = 1.15 + flashVal * 1.0;
      this.onWindowFlash?.(flashVal, features.musicMode === 'calm' ? '#00f0ff' : '#ffffff');
    } else {
      this.renderer.toneMappingExposure = this.lerp(
        this.renderer.toneMappingExposure,
        1.15,
        deltaSeconds * 12.0
      );
      this.onWindowFlash?.(0, '#ffffff');
    }

    // Dynamic stage lighting intensity
    this.stageKeyLight.intensity = 3.0 + features.subBass * 4.5;
    this.stageFillLight.intensity = 2.5 + features.highMid * 3.5;

    // 5. Update and render active effects
    const context = this.createEffectContext(features, deltaSeconds, trackTimeSeconds);
    for (const effect of this.effects) {
      if (effect.enabled) {
        effect.update(context);
      }
    }

    // 6. Render Pass
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
    if (effect && effect.id !== 'stage-structure') {
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
    window.removeEventListener('resize', this.triggerResize);
    document.removeEventListener('fullscreenchange', this.triggerResize);
    document.removeEventListener('webkitfullscreenchange', this.triggerResize);
    document.removeEventListener('mozfullscreenchange', this.triggerResize);
    document.removeEventListener('MSFullscreenChange', this.triggerResize);
    window.removeEventListener('orientationchange', this.triggerResize);

    for (const effect of this.effects) {
      effect.dispose();
    }
    this.effects = [];

    this.renderer.dispose();
  }
}
