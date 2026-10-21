/**
 * Synwave 3D Concert Stage Visual Engine
 * 
 * Orchestrates a real-world music festival concert stage visualization:
 * - Solid pitch-black stadium background with ZERO revolving elements
 * - Fixed audience camera locked in front of the stage (NO mouse hovering movement)
 * - Solid rectangular Jumbotron LED screen displaying the song title and audio visualizer
 * - 16 Moving-head volumetric stage lights THROWN TOWARDS THE CAMERA & sweeping across stage
 * - Dual corner high-intensity white spotlights projecting skyward searchlight beams
 * - 8 Pyro flame cannons flanking the screen and stage lip
 * - 4 High-velocity Cryo CO2 smoke cannons and rolling stage haze
 * - Dedicated STEM Separation Activation:
 *     - Kick STEM -> Kick flash lights (blinders) & pyro flame blasters
 *     - Bass STEM -> Moving-head light beam intensity & stage floor wash
 *     - Instrument STEM -> White sky searchlights & pan/tilt sweeps
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
import type { ExtractedStageColors } from '../services/thumbnailColorService';
import { StageStructureEffect } from './effects/StageStructureEffect';
import { StageLightsEffect } from './effects/StageLightsEffect';
import { ShowDirector } from './director/ShowDirector';
import { RoutingStore } from './director/RoutingStore';
import { resolveFlashPaletteColors } from './effects/flashColorUtils';

export interface VisualSceneConfig {
  id: string;
  name: string;
  activeEffectIds: string[];
}

const CONCERT_SCENES: VisualSceneConfig[] = [
  {
    id: 'stadium-mainstage',
    name: 'MAINSTAGE FESTIVAL',
    activeEffectIds: ['stage-structure', 'stage-lights'],
  },
  {
    id: 'mainstage-arena',
    name: 'MAINSTAGE SKY ARENA',
    activeEffectIds: ['stage-structure', 'stage-lights'],
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

  // Phase 11: Dynamic Song & Track Palette State
  private customSongPalette: ColorPalette | null = null;
  private trackSignaturePalette: ColorPalette | null = null;

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
  private isPlaying = false;

  // Phase 18: Flash-Screen Sequence State (Song Palette Synchronized with Compulsory White)
  private currentFlashOpacity = 0;
  private currentFlashBg = 'radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.80) 25%, rgba(255,255,255,0.45) 60%, rgba(255,255,255,0.06) 100%)';
  private flashSequenceStep = 0; // 0: Compulsory White (#FFFFFF), 1, 2, ... Song Palette Colors
  private wasKickLastFrame = false;
  private lastKickTimestamp = 0;
  private hasDispatchedZeroFlash = true;
  private cachedFlashColors: string[] | null = null;

  public getActiveFlashColors(): string[] {
    if (!this.cachedFlashColors) {
      this.cachedFlashColors = resolveFlashPaletteColors(this.activePalette, this.trackSeed);
    }
    return this.cachedFlashColors;
  }

  // Live state callbacks
  public onCurrentSectionChange?: (section: string) => void;
  public onWindowFlash?: (opacity: number, backgroundCss: string) => void;
  public onStageShake?: (shakeXPixels: number, shakeYPixels: number) => void;

  public setIsPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (!playing) {
      this.currentFlashOpacity = 0;
      this.wasKickLastFrame = false;
      if (this.onWindowFlash && !this.hasDispatchedZeroFlash) {
        this.onWindowFlash(0, '#ffffff');
        this.hasDispatchedZeroFlash = true;
      }
    }
  }

  /**
   * Phase 11: Procedural Track Signature Palette Fallback
   * Generates a deterministic, vibrant, aesthetically balanced color palette
   * derived from the track seed and musical analysis. Guarantees that songs without
   * video thumbnails (or before thumbnails load) have a distinctive, beautiful color identity
   * spread across the 360° color wheel rather than being locked to blue, violet, or cyan.
   */
  private generateTrackSignaturePalette(seed: number, mood?: string): ColorPalette {
    // Golden ratio hue stepping distributes consecutive seeds evenly around the 360° color wheel
    const baseHue = (Math.abs(seed * 0.618033988749895) % 1.0);
    let primHue = baseHue;
    let primSat = 0.95;
    let primLight = 0.52;

    if (mood === 'chill-ambient') {
      primSat = 0.85;
      primLight = 0.48;
    } else if (mood === 'euphoric-drop') {
      primSat = 1.0;
      primLight = 0.55;
    } else if (mood === 'retro-groove') {
      primSat = 0.90;
      primLight = 0.52;
    }

    const secHue = (primHue + 0.28) % 1.0;
    const accHue = (primHue + 0.55) % 1.0;

    const primColor = new THREE.Color().setHSL(primHue, primSat, primLight);
    const secColor = new THREE.Color().setHSL(secHue, primSat * 0.92, primLight * 0.95);
    const accColor = new THREE.Color().setHSL(accHue, 1.0, 0.60);

    return {
      id: `track-${seed}`,
      name: `Track Signature ${seed}`,
      primary: `#${primColor.getHexString()}`,
      secondary: `#${secColor.getHexString()}`,
      accent: `#${accColor.getHexString()}`,
      background: '#04060d',
      glow: `#${primColor.getHexString()}`,
      ambientColor: '#100a20',
    };
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.trackSignaturePalette = this.generateTrackSignaturePalette(this.trackSeed, this.currentMood);
    this.activePalette = { ...this.trackSignaturePalette };
    this.targetPalette = { ...this.trackSignaturePalette };
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

    this.stageKeyLight = new THREE.PointLight(new THREE.Color(this.activePalette.primary), 1.2, 35, 1.8);
    this.stageKeyLight.position.set(10, 12, 1);
    this.scene.add(this.stageKeyLight);

    this.stageFillLight = new THREE.PointLight(new THREE.Color(this.activePalette.secondary), 1.0, 35, 1.8);
    this.stageFillLight.position.set(-10, 12, 1);
    this.scene.add(this.stageFillLight);
  }

  private initEffects(): void {
    // Modular concert stage architecture (Zero revolving elements)
    this.effects = [
      new StageStructureEffect(), // Solid rectangular LED screen, box truss, crowd silhouette
      new StageLightsEffect(),     // 16 Moving-head lights & dual white sky searchlights
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
    this.triggerResize();
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

    // Phase 11: Clear previous track's custom palette and establish new track signature palette
    this.customSongPalette = null;
    this.trackSignaturePalette = this.generateTrackSignaturePalette(seed, this.currentMood);
    this.targetPalette = { ...this.trackSignaturePalette };
    this.activePalette = { ...this.trackSignaturePalette };

    // Phase 18: Invalidate flash palette cache and reset flash state on track transition
    this.cachedFlashColors = null;
    this.currentFlashOpacity = 0;
    this.flashSequenceStep = 0;
    this.wasKickLastFrame = false;
    this.lastKickTimestamp = 0;
    if (this.onWindowFlash) {
      this.onWindowFlash(0, '#ffffff');
      this.hasDispatchedZeroFlash = true;
    }
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
    // Phase 11: If a custom song palette is active, preserve the song's color identity
    // and do not overwrite it with static preset palettes!
    if (this.customSongPalette) {
      this.targetPalette = this.customSongPalette;
      const lerpRate = Math.min(1.0, deltaSeconds * 2.8);
      const targetPrimCol = new THREE.Color(this.targetPalette.primary);
      const targetSecCol = new THREE.Color(this.targetPalette.secondary);

      const primCol = new THREE.Color(this.activePalette.primary);
      primCol.lerp(targetPrimCol, lerpRate);
      this.activePalette.primary = `#${primCol.getHexString()}`;

      const secCol = new THREE.Color(this.activePalette.secondary);
      secCol.lerp(targetSecCol, lerpRate);
      this.activePalette.secondary = `#${secCol.getHexString()}`;

      if (this.targetPalette.spotlightColors) {
        this.activePalette.spotlightColors = [...this.targetPalette.spotlightColors];
      }

      this.stageKeyLight.color.lerp(targetPrimCol, lerpRate);
      this.stageFillLight.color.lerp(targetSecCol, lerpRate);
      return;
    }

    // If no custom song palette, use the track's deterministic signature palette
    const effectiveMood = this.currentMood || features.mood || 'euphoric-drop';
    const basePalette = this.trackSignaturePalette || this.generateTrackSignaturePalette(this.trackSeed, effectiveMood);
    this.targetPalette = basePalette;

    const lerpRate = Math.min(1.0, deltaSeconds * 2.8);
    const targetPrimCol = new THREE.Color(this.targetPalette.primary);
    const targetSecCol = new THREE.Color(this.targetPalette.secondary);

    const primCol = new THREE.Color(this.activePalette.primary);
    primCol.lerp(targetPrimCol, lerpRate);
    this.activePalette.primary = `#${primCol.getHexString()}`;

    const secCol = new THREE.Color(this.activePalette.secondary);
    secCol.lerp(targetSecCol, lerpRate);
    this.activePalette.secondary = `#${secCol.getHexString()}`;

    if (this.targetPalette.spotlightColors) {
      this.activePalette.spotlightColors = [...this.targetPalette.spotlightColors];
    }

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
        this.switchScene('mainstage-arena');
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
    const rawDelta = Math.min(0.08, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    // Freeze all movements and time when music is not actively playing
    const deltaSeconds = this.isPlaying ? rawDelta : 0;

    const trackTimeSeconds = getCurrentTime();
    const features = getLiveFeatures();

    const routingStore = RoutingStore.getInstance();
    const routingConfig = routingStore.getConfig();

    // Beat grid extraction from features
    const beatGrid: BeatGridState = {
      bpm: features.estimatedBpm || 120,
      bpmSource: features.bpmSource,
      beatIndex: features.beatIndex || 0,
      barIndex: features.barIndex || 1,
      beatPhase: features.beatPhase || 0,
      isBeat: features.isBeat,
      isBar: features.isBar || false,
      isPhrase: features.isPhrase || false,
      confidence: features.beatConfidence || 0.0,
    };

    // Update procedural Show Director
    const directorState = this.showDirector.update(
      trackTimeSeconds,
      this.trackDuration,
      features,
      beatGrid,
      this.trackAnalysis,
      this.trackSeed,
      deltaSeconds
    );
    this.currentDirectorState = directorState;

    this.onCurrentSectionChange?.(directorState.currentSection.toUpperCase());

    // 1. Mood-driven Palette
    this.evaluateMusicMoodPalette(features, deltaSeconds);

    // 2. Smart Scene Choreographer
    this.updateSmartChoreographer(trackTimeSeconds, features, deltaSeconds);

    // 3. Concert Front View Camera (Locked solidly in front of the stage; ZERO window shake!)
    this.camera.position.set(this.cameraBaseX, this.cameraBaseY, this.cameraBaseZ);

    // Screen shake: ONLY the YouTube iframe stage screen shakes on kicks
    let kickShakeX = 0;
    let kickShakeY = 0;
    const shakeMult = routingConfig.screenShakeIntensity ?? 1.0;
    if (shakeMult > 0 && !routingConfig.reducedFlash && this.isPlaying) {
      const kickPower = Math.max(features.stems.kick, features.isKick ? (features.kickIntensity || 1.0) : 0);
      if (kickPower > 0.22) {
        const shakePx = Math.pow(kickPower, 1.4) * 16.0 * shakeMult;
        kickShakeX = (Math.random() - 0.5) * 2 * shakePx;
        kickShakeY = (Math.random() - 0.5) * 2 * shakePx;
      }
    }

    // Audio-synchronized kick shake for the YouTube iframe (pixel displacement only)
    if (this.onStageShake) {
      this.onStageShake(kickShakeX, kickShakeY);
    }

    // Always look directly at the center of the solid rectangular concert stage screen
    this.camera.lookAt(0, 4.4, -4.5);

    // Dynamic FOV zoom punch driven strictly by isolated deep sub-bass (20-100Hz)
    // Filters out mid-range frequencies and general kick harmonics entirely
    const subBassVal = features.subBass || 0;
    const subBassGate = Math.max(0, subBassVal - 0.28) / 0.72;
    const subBassPunch = Math.pow(subBassGate, 1.8) * 3.5;
    const fovPunch = routingConfig.reducedFlash || !this.isPlaying
      ? 0
      : (features.isDrop ? 3.5 : subBassPunch);
    const desiredFov = 60 + fovPunch;
    this.cameraTargetFov += (desiredFov - this.cameraTargetFov) * (this.isPlaying ? rawDelta * 14.0 : 1.0);
    this.camera.fov = this.cameraTargetFov;
    this.camera.updateProjectionMatrix();

    // 4. Kick Screen Flash with Song Palette Distribution and Compulsory White (Phase 18)
    const flashMult = routingConfig.screenFlashIntensity ?? 1.0;
    const isFlashAllowed = this.isPlaying && !routingConfig.reducedFlash && flashMult > 0.01;

    if (!isFlashAllowed) {
      this.currentFlashOpacity = 0;
      this.wasKickLastFrame = false;
      if (this.onWindowFlash && !this.hasDispatchedZeroFlash) {
        this.onWindowFlash(0, '#ffffff');
        this.hasDispatchedZeroFlash = true;
      }
    } else {
      // Audio-reactivity: Screen flash is strictly manipulated by kick transients (no beat grid clock ticks)
      const timeSinceLastKick = trackTimeSeconds - this.lastKickTimestamp;
      const isKickOnset = features.isKick && !this.wasKickLastFrame;
      this.wasKickLastFrame = Boolean(features.isKick);

      // Lockout of 100ms prevents double-triggering across a single kick's decay while supporting up to 600 BPM rolls.
      // Negative delta handling accounts for user scrubbing/seeking backward.
      const isKickLockoutCleared = timeSinceLastKick > 0.10 || timeSinceLastKick < 0 || this.lastKickTimestamp === 0;
      const kickSens = routingConfig.kickSensitivity ?? 1.0;
      const rawKickPower = Math.max(features.kickIntensity, features.stems?.kick ?? 0);
      const kickVal = rawKickPower * kickSens;

      // Strictly triggered by kick onset and sufficient kick transient energy
      const isTransientKick = isKickOnset && isKickLockoutCleared && kickVal > 0.16;

      if (isTransientKick) {
        this.lastKickTimestamp = trackTimeSeconds;
        const flashColors = this.getActiveFlashColors();

        // Advance flash sequence:
        // A new sequence is initiated on musical phrase/bar boundaries or after pauses (> 0.65s).
        // Every sequence begins with Step 0: Compulsory Pure White (#FFFFFF).
        // Subsequent kicks in the sequence cycle through the active song palette.
        if (timeSinceLastKick > 0.65 || features.isBar) {
          this.flashSequenceStep = 0; // Compulsory Pure White (#FFFFFF)
        } else {
          this.flashSequenceStep = (this.flashSequenceStep + 1) % flashColors.length;
        }

        const selectedHex = flashColors[this.flashSequenceStep] || '#ffffff';
        const satMult = routingConfig.screenFlashColorSaturation ?? 1.0;

        if (this.flashSequenceStep === 0 || selectedHex.toLowerCase() === '#ffffff') {
          // Step 0: Compulsory Brilliant Pure White (#FFFFFF) full-window concert blinder
          this.currentFlashBg = 'radial-gradient(ellipse at center, rgba(255,255,255,1.0) 0%, rgba(255,255,255,0.96) 35%, rgba(255,255,255,0.85) 70%, rgba(255,255,255,0.72) 100%)';
        } else {
          // Distinct Song Palette Colors with white-hot filament center and radiant full-window wash
          const col = new THREE.Color(selectedHex);
          if (satMult !== 1.0) {
            const hsl = { h: 0, s: 0, l: 0 };
            col.getHSL(hsl);
            col.setHSL(hsl.h, Math.min(1.0, hsl.s * satMult), hsl.l);
          }
          const r = Math.round(col.r * 255);
          const g = Math.round(col.g * 255);
          const b = Math.round(col.b * 255);

          this.currentFlashBg = `radial-gradient(ellipse at center, rgba(255,255,255,1.0) 0%, rgba(255,255,255,0.92) 25%, rgba(${r},${g},${b},0.90) 60%, rgba(${r},${g},${b},0.75) 100%)`;
        }

        const maxBri = routingConfig.maxBrightnessLimit || 1.0;
        const maxAllowed = 0.98 * maxBri;
        const targetOpacity = Math.min(maxAllowed, (0.42 + Math.min(1.0, kickVal) * 0.56) * flashMult * maxBri);
        if (targetOpacity > this.currentFlashOpacity) {
          this.currentFlashOpacity = targetOpacity;
        }
      }

      // Smooth musical blinder decay (~150ms to 200ms visible bloom)
      const decayRate = 5.2 * (routingConfig.effectDecay ?? 1.0);
      this.currentFlashOpacity = Math.max(0, this.currentFlashOpacity - (rawDelta * decayRate));

      if (this.onWindowFlash) {
        if (this.currentFlashOpacity > 0.01) {
          this.hasDispatchedZeroFlash = false;
          this.onWindowFlash(this.currentFlashOpacity, this.currentFlashBg);
        } else if (!this.hasDispatchedZeroFlash) {
          this.hasDispatchedZeroFlash = true;
          this.onWindowFlash(0, '#ffffff');
        }
      }
    }

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

  public setSongPalette(extracted: ExtractedStageColors | ColorPalette | null): void {
    if (!extracted) {
      this.customSongPalette = null;
      if (this.trackSignaturePalette) {
        this.targetPalette = { ...this.trackSignaturePalette };
        this.activePalette = { ...this.trackSignaturePalette };
      }
    } else {
      const prim = extracted.primary || '#ffaa00';
      const sec = extracted.secondary || '#ff3c00';
      const acc = ('accent' in extracted && extracted.accent) ? extracted.accent : '#00ffcc';

      const customPal: ColorPalette = {
        id: 'custom-song-palette',
        name: 'Song Palette',
        primary: prim,
        secondary: sec,
        accent: acc,
        background: '#04060d',
        glow: prim,
        ambientColor: '#100a20',
        ...('spotlightColors' in extracted ? { spotlightColors: extracted.spotlightColors } : {}),
      };
      this.customSongPalette = customPal;

      this.targetPalette = { ...customPal };
      this.activePalette = { ...customPal };
    }

    // Phase 18: Invalidate flash palette cache and reset flash state
    this.cachedFlashColors = null;
    this.currentFlashOpacity = 0;
    this.flashSequenceStep = 0;
    this.wasKickLastFrame = false;
    this.lastKickTimestamp = 0;
    if (this.onWindowFlash) {
      this.onWindowFlash(0, '#ffffff');
      this.hasDispatchedZeroFlash = true;
    }
  }

  public setCustomSpotlightColors(colors: string[] | null): void {
    const lights = this.effects.find((e) => e.id === 'stage-lights') as StageLightsEffect | undefined;
    if (lights) {
      lights.setSpotlightColors(colors || []);
    }
    if (colors && colors.length > 0) {
      const prim = colors[0];
      const sec = colors[1] || colors[0];
      const acc = colors[2] || sec;

      const customPal: ColorPalette = {
        id: 'custom-spotlight-palette',
        name: 'Spotlight Song Palette',
        primary: prim,
        secondary: sec,
        accent: acc,
        background: '#04060d',
        glow: prim,
        ambientColor: '#100a20',
        spotlightColors: colors,
      };
      this.customSongPalette = customPal;

      this.targetPalette = { ...customPal };
      this.activePalette = { ...customPal };

      // Phase 18: Invalidate flash palette cache and reset flash state
      this.cachedFlashColors = null;
      this.currentFlashOpacity = 0;
      this.flashSequenceStep = 0;
      this.wasKickLastFrame = false;
      this.lastKickTimestamp = 0;
      if (this.onWindowFlash) {
        this.onWindowFlash(0, '#ffffff');
        this.hasDispatchedZeroFlash = true;
      }
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
