/**
 * Synwave 3D Concert Stage Visual Engine
 * 
 * Orchestrates a real-world music festival concert stage visualization:
 * - Solid pitch-black stadium background with ZERO revolving elements
 * - Fixed audience camera locked in front of the stage (NO mouse hovering movement)
 * - Solid rectangular Jumbotron LED screen displaying the song title and audio visualizer
 * - 16 Moving-head volumetric stage lights THROWN TOWARDS THE CAMERA & sweeping across stage
 * - 28 Razor-thin concert lasers THROWN TOWARDS THE CAMERA & audience
 * - 8 Pyro flame cannons flanking the screen and stage lip
 * - 4 High-velocity Cryo CO2 smoke cannons and rolling stage haze
 * - Dedicated STEM Separation Activation:
 *     - Kick STEM -> Kick flash lights (blinders) & pyro flame blasters
 *     - Bass STEM -> Moving-head light beam intensity & stage floor wash
 *     - Instrument STEM -> Razor-thin lasers & pan/tilt sweeps
 *     - Vocal STEM -> Stage screen visual energy & cryo smoke plumes
 */

import * as THREE from 'three';
import type {
  AudioFeatures,
  AudioVisualRoutingConfig,
  BeatGridState,
  ColorPalette,
  MusicMood,
  QualityPreset,
  ShowDirectorState,
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
import { ShowDirector } from './director/ShowDirector';
import { RoutingStore } from './director/RoutingStore';

export interface VisualSceneConfig {
  id: string;
  name: string;
  activeEffectIds: string[];
}

const CONCERT_SCENES: VisualSceneConfig[] = [
  {
    id: 'stadium-mainstage',
    name: 'MAINSTAGE FESTIVAL',
    activeEffectIds: ['stage-structure', 'stage-lights', 'thin-lasers', 'fire-shooters', 'smoke-machines', 'shockwave-rings'],
  },
  {
    id: 'pyro-drop-frenzy',
    name: 'MAINSTAGE DROP FRENZY',
    activeEffectIds: ['stage-structure', 'fire-shooters', 'thin-lasers', 'smoke-machines', 'stage-lights', 'shockwave-rings'],
  },
  {
    id: 'laser-cathedral',
    name: 'MAINSTAGE LASER CATHEDRAL',
    activeEffectIds: ['stage-structure', 'thin-lasers', 'stage-lights', 'smoke-machines'],
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

  // Effects Catalogue (Zero revolving elements)
  private effects: VisualEffect[] = [];
  private activePalette: ColorPalette;
  private targetPalette: ColorPalette;

  // Animation and Timing
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private trackSeed = 42;
  private trackAnalysis: TrackAnalysis | null = null;

  // Track Metadata for Stage Screen
  private trackTitle = 'SYNWAVE';
  private trackArtist = 'STAGE READY • SELECT OR DROP AUDIO';
  private currentMood: MusicMood = 'uplifting-melodic';

  // Procedural Show Director & Track Duration
  private showDirector = new ShowDirector();
  private trackDuration = 240;
  private currentDirectorState: ShowDirectorState | null = null;

  // Scene Choreography
  private currentSceneIndex = 0;
  private sceneTimer = 0;
  private lastDetectedSection = '';

  // Camera Dynamics (Fixed closer in front of the stage; NO mouse hovering movement)
  private cameraBaseX = 0;
  private cameraBaseY = 1.8;
  private cameraBaseZ = 9.2;
  private cameraTargetFov = 60;

  // Active Video State for Stage Screen Pass-Through
  private hasActiveVideo = false;

  // Settings
  private quality: QualityPreset = 'high';
  private effectIntensity = 1.0;

  // Live state callbacks
  public onCurrentSectionChange?: (section: string) => void;
  public onWindowFlash?: (opacity: number, colorHex: string) => void;
  public onStageShake?: (shakeXPixels: number, shakeYPixels: number) => void;

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
      alpha: true, // Transparent WebGL canvas so video is visible behind it
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

    // Update style to guarantee exact edge-to-edge full bleed
    this.renderer.setSize(width, height, true);
    this.applyPixelRatioForQuality(this.quality);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    // Null background allows transparent compositing over DOM elements (e.g. YouTube stage video)
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.012);

    // Fixed camera in front of the stage (Audience View matching reference photo)
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 600);
    this.camera.position.set(this.cameraBaseX, this.cameraBaseY, this.cameraBaseZ);
    this.camera.lookAt(0, 4.4, -4.5);

    // Dynamic Concert Stage Lighting
    this.ambientLight = new THREE.AmbientLight(0x05070f, 1.2);
    this.scene.add(this.ambientLight);

    this.stageKeyLight = new THREE.PointLight(0x00f0ff, 1.2, 35, 1.8);
    this.stageKeyLight.position.set(10, 12, 1);
    this.scene.add(this.stageKeyLight);

    this.stageFillLight = new THREE.PointLight(0xff007f, 1.0, 35, 1.8);
    this.stageFillLight.position.set(-10, 12, 1);
    this.scene.add(this.stageFillLight);
  }

  private initEffects(): void {
    // Modular concert stage architecture (Zero revolving elements)
    this.effects = [
      new StageStructureEffect(), // Solid rectangular LED screen, box truss, crowd silhouette
      new StageLightsEffect(),     // 16 Moving-head volumetric lights thrown forward towards camera
      new ThinLasersEffect(),      // 28 Razor-thin lasers thrown forward towards camera & audience
      new FireShootersEffect(),    // 8 Front & flank flame blasters (Kick STEM activated)
      new SmokeMachinesEffect(),   // 4 Cryo CO2 smoke cannons & rolling stage haze
      new ShockwaveRingEffect(),   // Bass stage floor shockwave ripples
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
        stems: {
          kick: 0,
          bass: 0,
          instruments: 0,
          vocals: 0,
        },
        estimatedBpm: 128,
        beatIndex: 0,
        barIndex: 1,
        beatPhase: 0,
        isBar: false,
        isPhrase: false,
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
    trackTimeSeconds: number,
    directorState?: ShowDirectorState,
    routingConfig?: AudioVisualRoutingConfig
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
      directorState: directorState || this.currentDirectorState || undefined,
      routingConfig: routingConfig || RoutingStore.getInstance().getConfig(),
      hasVideo: this.hasActiveVideo,
    };
  }

  private setupWindowListeners(): void {
    window.addEventListener('resize', this.triggerResize);
    document.addEventListener('fullscreenchange', this.triggerResize);
    document.addEventListener('webkitfullscreenchange', this.triggerResize);
    document.addEventListener('mozfullscreenchange', this.triggerResize);
    document.addEventListener('MSFullscreenChange', this.triggerResize);
    window.addEventListener('orientationchange', this.triggerResize);
    // Mouse hover screen movement is removed per user request:
    // Camera stays firmly fixed in front of the stage!
  }

  /**
   * Resizes renderer with zero-gap full bleed guarantee.
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
    this.applyPixelRatioForQuality(quality);
  }

  private applyPixelRatioForQuality(quality: QualityPreset): void {
    if (!this.renderer) return;
    if (quality === 'ultra') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    } else if (quality === 'high') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(1.0);
    } else {
      this.renderer.setPixelRatio(0.85);
    }
  }

  private applyScene(sceneConfig: VisualSceneConfig): void {
    for (const effect of this.effects) {
      if (effect.id === 'stage-structure') {
        effect.enabled = true;
      } else {
        effect.enabled = sceneConfig.activeEffectIds.includes(effect.id);
      }
    }
  }

  /**
   * Mood-driven concert color palette manager
   */
  private evaluateMusicMoodPalette(features: AudioFeatures, deltaSeconds: number): void {
    const mood = this.currentMood || features.mood || 'euphoric-drop';

    let targetIndex = 0;
    if (mood === 'chill-ambient') {
      targetIndex = 3; // Deep Space Indigo
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
      sectionLabel = 'MAINSTAGE ATMOSPHERE';
      this.onCurrentSectionChange?.(sectionLabel);
      this.switchScene('stadium-mainstage');
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

    const routingStore = RoutingStore.getInstance();
    const routingConfig = routingStore.getConfig();

    // Beat grid extraction from features
    const beatGrid: BeatGridState = {
      bpm: features.estimatedBpm || 128,
      beatIndex: features.beatIndex || 0,
      barIndex: features.barIndex || 1,
      beatPhase: features.beatPhase || 0,
      isBeat: features.isBeat,
      isBar: features.isBar || false,
      isPhrase: features.isPhrase || false,
      confidence: features.beatConfidence || 0.5,
    };

    // Update procedural Show Director
    const directorState = this.showDirector.update(
      trackTimeSeconds,
      this.trackDuration,
      features,
      beatGrid,
      this.trackAnalysis
    );
    this.currentDirectorState = directorState;

    this.onCurrentSectionChange?.(directorState.currentSection.toUpperCase());

    // 1. Mood-driven Palette
    this.evaluateMusicMoodPalette(features, deltaSeconds);

    // 2. Smart Scene Choreographer
    this.updateSmartChoreographer(trackTimeSeconds, features, deltaSeconds);

    // 3. Concert Front View Camera (Locked solidly in front of the stage; NO mouse hovering movement)
    this.camera.position.x = this.cameraBaseX;
    this.camera.position.y = this.cameraBaseY;
    this.camera.position.z = this.cameraBaseZ;

    // Sub-bass rumble / vibration on heavy kicks and drops (governed by routingConfig)
    let rumble = 0;
    let shakeX = 0;
    let shakeY = 0;
    const shakeMult = routingConfig.cameraShakeStrength;
    if (shakeMult > 0 && !routingConfig.reducedFlash) {
      if (features.isDrop) {
        rumble = 0.16 * (1 + features.stems.bass) * shakeMult;
      } else if (features.stems.kick > 0.40 || features.isKick) {
        rumble = (features.stems.kick * 0.12 + features.stems.bass * 0.08) * shakeMult;
      } else if (features.stems.bass > 0.6) {
        rumble = features.stems.bass * 0.07 * shakeMult;
      }
      if (rumble > 0) {
        shakeX = (Math.random() - 0.5) * rumble;
        shakeY = (Math.random() - 0.5) * rumble * 0.85;
        this.camera.position.x += shakeX;
        this.camera.position.y += shakeY;
      }
    }

    // Audio-synchronized shake for the YouTube iframe (pixel displacement)
    if (this.onStageShake) {
      const pixelsPerUnit = window.innerHeight / 15.82;
      const pxX = -shakeX * pixelsPerUnit;
      const pxY = shakeY * pixelsPerUnit;
      this.onStageShake(pxX, pxY);
    }

    // Always look directly at the center of the solid rectangular concert stage screen
    this.camera.lookAt(0, 4.4, -4.5);

    // Dynamic FOV punch on kicks/drops
    const fovPunch = routingConfig.reducedFlash
      ? 0
      : (features.isDrop ? 3.5 : (features.isKick ? features.kickIntensity * 2.5 : 0));
    const desiredFov = 60 + fovPunch;
    this.cameraTargetFov += (desiredFov - this.cameraTargetFov) * deltaSeconds * 14.0;
    this.camera.fov = this.cameraTargetFov;
    this.camera.updateProjectionMatrix();

    // Window flash overlay disabled: visual kick is delivered by 3D white spotlights thrown at camera
    this.renderer.toneMappingExposure = 1.15;
    this.onWindowFlash?.(0, '#ffffff');

    // Dynamic stage key lighting intensity driven by Bass STEM and RoutingConfig
    const maxBri = routingConfig.maxBrightnessLimit || 1.0;
    const beamSens = routingConfig.bassToBeamIntensity || 1.0;
    this.stageKeyLight.intensity = Math.min(1.6 * maxBri, (0.7 + features.stems.bass * 0.7 * beamSens) * maxBri);
    this.stageFillLight.intensity = Math.min(1.4 * maxBri, (0.5 + features.stems.instruments * 0.6 * beamSens) * maxBri);

    // 5. Update and render active effects
    const context = this.createEffectContext(features, deltaSeconds, trackTimeSeconds, directorState, routingConfig);
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

  public setCameraSpeed(_val: number): void {
    // Camera is fixed per user request
  }

  public setTrackDuration(dur: number): void {
    if (dur > 0) this.trackDuration = dur;
  }

  public setVideoActive(active: boolean): void {
    this.hasActiveVideo = active;
    const stageStructure = this.effects.find((e) => e.id === 'stage-structure') as StageStructureEffect | undefined;
    if (stageStructure) {
      stageStructure.setVideoActive(active);
    }
  }

  public setSpotlightCount(count: number): void {
    const lights = this.effects.find((e) => e.id === 'stage-lights') as StageLightsEffect | undefined;
    if (lights) {
      lights.setSpotlightCount(count);
    }
  }

  public getSpotlightCount(): number {
    const lights = this.effects.find((e) => e.id === 'stage-lights') as StageLightsEffect | undefined;
    return lights ? lights.getSpotlightCount() : 3;
  }

  public setCustomSpotlightColors(colors: string[] | null): void {
    const lights = this.effects.find((e) => e.id === 'stage-lights') as StageLightsEffect | undefined;
    if (lights) {
      lights.setSpotlightColors(colors || []);
    }
    if (colors && colors.length > 0) {
      this.targetPalette.primary = colors[0];
      if (colors[1]) this.targetPalette.secondary = colors[1];
      if (colors[2]) this.targetPalette.accent = colors[2];
      this.activePalette = { ...this.targetPalette };
    }
  }

  public getDirectorState(): ShowDirectorState | null {
    return this.currentDirectorState;
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
