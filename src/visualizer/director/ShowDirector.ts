/**
 * Synwave Procedural Show Director
 * 
 * Orchestrates concert-stage choreography across musical phrases and song sections:
 * - Decides which effects should happen when (intro, verse, buildup, drop, breakdown, outro)
 * - Prevents chaotic uncoordinated triggering across independent audio frames
 * - Coordinates synchronized lighting sweeps, laser fan geometries, and pyro bursts
 * - Respects the user's active StageProfile and AudioVisualRoutingConfig
 */

import type {
  AudioFeatures,
  BeatGridState,
  EnabledEffectsConfig,
  ShowDirectorState,
  ShowSection,
  StageProfile,
  TrackAnalysis,
} from '../../types';
import { RoutingStore } from './RoutingStore';
import { LaserShowController } from './LaserShowController';

export class ShowDirector {
  private currentSection: ShowSection = 'intro';
  private sectionProgress = 0;
  private choreographyPattern = 'Ethereal Dawn';
  private intensityMultiplier = 1.0;

  // Trajectory tracking for live section inference
  private rollingEnergy: number[] = [];
  private buildupCounter = 0;
  private dropCooldown = 0;

  public update(
    trackTimeSeconds: number,
    trackDuration: number,
    features: AudioFeatures,
    beatGrid: BeatGridState,
    analysis?: TrackAnalysis | null,
    seed: number = 1337,
    deltaSeconds: number = 0.016
  ): ShowDirectorState {
    const routingStore = RoutingStore.getInstance();
    const activeProfile: StageProfile = routingStore.getActiveProfile();
    const routingConfig = routingStore.getConfig();

    // 1. Determine Section & Progress
    this.detectSection(trackTimeSeconds, trackDuration, features, analysis);

    // 2. Select Choreography Pattern & Allowed Effects based on Section + Profile
    const allowedEffects: EnabledEffectsConfig = {
      lights: routingConfig.enabledEffects.lights,
      lasers: routingConfig.enabledEffects.lasers,
    };

    switch (this.currentSection) {
      case 'intro': {
        this.choreographyPattern = 'Ethereal Dawn';
        this.intensityMultiplier = 0.65;
        allowedEffects.lasers = false;
        break;
      }

      case 'verse': {
        this.choreographyPattern = 'Festival Groove Synchronizer';
        this.intensityMultiplier = 0.95;
        break;
      }

      case 'buildup': {
        this.choreographyPattern = 'Tension Accelerando';
        // Escalating intensity towards the climax: 1.1 -> 1.55
        this.intensityMultiplier = 1.1 + this.sectionProgress * 0.45;
        break;
      }

      case 'drop': {
        this.choreographyPattern = 'Ultra Stadium Climax';
        this.intensityMultiplier = 1.5 * (1 + features.dropIntensity * 0.35);
        // All effects unleashed in the drop!
        break;
      }

      case 'breakdown': {
        this.choreographyPattern = 'Atmospheric Drift';
        this.intensityMultiplier = 0.7;
        allowedEffects.lasers = false;
        break;
      }

      case 'outro': {
        this.choreographyPattern = 'Gentle Dissolve';
        this.intensityMultiplier = 0.5;
        allowedEffects.lasers = false;
        break;
      }
    }

    const provisionalState: ShowDirectorState = {
      currentSection: this.currentSection,
      sectionProgress: Math.max(0, Math.min(1, this.sectionProgress)),
      activeProfile,
      choreographyPattern: this.choreographyPattern,
      allowedEffects,
      intensityMultiplier: this.intensityMultiplier,
      beatGrid,
    };

    // 3. Delegate Authoritative Laser Show Orchestration to LaserShowController
    const laserDecision = LaserShowController.getInstance().update(
      features,
      deltaSeconds,
      trackTimeSeconds,
      seed,
      routingConfig,
      provisionalState
    );
    provisionalState.laserDecision = laserDecision;

    return provisionalState;
  }

  private detectSection(
    timeSeconds: number,
    duration: number,
    features: AudioFeatures,
    analysis?: TrackAnalysis | null
  ): void {
    // A. If pre-computed analysis has sections, align with the authoritative audio clock
    if (analysis && analysis.sections && analysis.sections.length > 0) {
      const sec = analysis.sections.find(
        (s) => timeSeconds >= s.startTime && timeSeconds < s.endTime
      );
      if (sec) {
        const secDuration = Math.max(0.1, sec.endTime - sec.startTime);
        this.sectionProgress = (timeSeconds - sec.startTime) / secDuration;

        switch (sec.type) {
          case 'intro':
            this.currentSection = 'intro';
            return;
          case 'build':
            this.currentSection = 'buildup';
            return;
          case 'drop':
            this.currentSection = 'drop';
            return;
          case 'breakdown':
            this.currentSection = 'breakdown';
            return;
          case 'outro':
            this.currentSection = 'outro';
            return;
        }
      }
    }

    // B. Real-time Trajectory Inference (when pre-analysis not available or during live playback)
    const dur = duration > 0 ? duration : 240;

    // Track energy window
    this.rollingEnergy.push(features.rms);
    if (this.rollingEnergy.length > 50) this.rollingEnergy.shift();
    const avgEnergy = this.rollingEnergy.reduce((a, b) => a + b, 0) / this.rollingEnergy.length;

    // 1. Explicit Intro window
    if (timeSeconds < 14) {
      this.currentSection = 'intro';
      this.sectionProgress = timeSeconds / 14;
      return;
    }

    // 2. Explicit Outro window
    if (dur > 30 && timeSeconds > dur - 16) {
      this.currentSection = 'outro';
      this.sectionProgress = (timeSeconds - (dur - 16)) / 16;
      return;
    }

    // 3. Drop Detection (Real-time drop condition or precomputed continuous multi-stem drop)
    if (features.isDrop || features.isTriStemDropActive) {
      this.currentSection = 'drop';
      this.dropCooldown = 15; // hold drop for at least 15 frames
      this.sectionProgress = 0.5;
      return;
    }

    if (this.dropCooldown > 0) {
      this.dropCooldown--;
      this.currentSection = 'drop';
      return;
    }

    // 4. Buildup Detection (Rising energy + high-mid/treble presence + steady beat)
    if (features.onsetStrength > 0.45 && features.rms > avgEnergy * 1.25 && features.subBass < 0.5) {
      this.buildupCounter++;
      if (this.buildupCounter > 12) {
        this.currentSection = 'buildup';
        this.sectionProgress = Math.min(1.0, this.buildupCounter / 40);
        return;
      }
    } else {
      this.buildupCounter = Math.max(0, this.buildupCounter - 1);
    }

    // 5. Breakdown Detection (Quiet section in the middle of track)
    if (features.rms < 0.22 && features.subBass < 0.25 && timeSeconds > 30 && timeSeconds < dur - 30) {
      this.currentSection = 'breakdown';
      this.sectionProgress = 0.5;
      return;
    }

    // 6. Default to Verse / Groove
    this.currentSection = 'verse';
    this.sectionProgress = (timeSeconds % 32) / 32;
  }
}
