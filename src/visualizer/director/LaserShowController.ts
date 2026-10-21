/**
 * Synwave Professional Concert Laser Show Director
 * 
 * Orchestrates concert-grade laser choreography, hierarchical state gating,
 * multi-signal drop confidence, four-bar phrase scheduling, and acoustic feature modulation:
 * 
 * - Single authoritative controller for all laser fixtures (top-aperture and perimeter arrays).
 * - Enforces strict hierarchical activation: Lasers are rare, intentional, and musically justified.
 * - Semantic state model: OFF, CINEMATIC_DIRECTIONAL, MELODIC_ANTHEM, BUILD_RISER,
 *   DROP_IMPACT, DROP_GROOVE, CLIMAX_OMNIDIRECTIONAL.
 * - Multi-signal drop confidence combining pre-computed Demucs multi-stem drop sections,
 *   joint stem surges (drums + bass + instruments), kick transients, and downbeat alignment.
 * - Hysteresis gate preventing flickering across rhythmic syncopations or off-beat pauses.
 * - Four-bar musical choreography scheduler synchronized to BeatGridEngine's monotonic
 *   beat index and measure boundaries (Motif -> Develop -> Tension -> Accent).
 * - Independent control dimensions for activation, continuous trajectory movement,
 *   beam density, baseline intensity, and kick pulse brightness.
 * - Clean seek, pause, and track-change state re-synchronization.
 * - Throttled diagnostics for developer observability and real-time DiagnosticOverlay telemetry.
 */

import type {
  AudioFeatures,
  AudioVisualRoutingConfig,
  LaserSemanticState,
  LaserShowDecision,
  ShowDirectorState,
  ShowSection,
} from '../../types';
import {
  getChoreographyMetadata,
  selectChoreographyForArc,
} from '../effects/laserChoreography';

export interface LaserDiagnosticTelemetry {
  readonly semanticState: LaserSemanticState;
  readonly isPermitted: boolean;
  readonly activationReason: string;
  readonly dropConfidence: number;
  readonly activePatternId: number;
  readonly activePatternName: string;
  readonly intendedRole: string;
  readonly barInPhrase: number;
  readonly absoluteBar: number;
  readonly timingConfidence: number;
  readonly bpm: number;
  readonly isBeatGated: boolean;
  readonly density: number;
  readonly speed: number;
  readonly timestamp: number;
}

export class LaserShowController {
  private static instance: LaserShowController | null = null;

  // Authoritative State
  private currentSemanticState: LaserSemanticState = 'OFF';
  private activePatternId = 0;
  private prevPatternId = 0;
  private transitionProgress = 1.0;
  private activationReason = 'System Initializing';
  private dropConfidence = 0.0;

  // Four-Bar Phrase Scheduler State
  private lastProcessedAbsoluteBar = -1;
  private lastProcessedPhrase = -1;
  private absoluteBarCounter = 0;
  private barInPhraseCounter = 1; // 1 to 4
  private phraseCounter = 0;

  // Continuous Trajectory Sweep & Motion State
  private masterAngle = 0;
  private smoothedMovementSpeed = 1.0;
  private kickImpulseDecay = 0.0;
  private beatGateDecay = 0.30;
  private currentBeamOpacity = 0.0; // Smoothed activation envelope (0.0 to 1.0)

  // Temporal Persistence Windows & Filters
  private rollingHighFreqTrend: number[] = [];
  private rollingInstrumentalSustain: number[] = [];
  private melodicAnthemPersistFrames = 0;
  private dropEntranceFrames = 0;
  private dropHoldDuration = 0.0;
  private lastPlaybackTime = 0.0;

  // Rate-Limited Diagnostics Telemetry
  private lastDiagnosticTime = 0;
  private lastLoggedState = '';
  private cachedTelemetry: LaserDiagnosticTelemetry | null = null;

  public static getInstance(): LaserShowController {
    if (!LaserShowController.instance) {
      LaserShowController.instance = new LaserShowController();
    }
    return LaserShowController.instance;
  }

  /**
   * Resets internal scheduler and timing states on track change or user scrubbing.
   */
  public reset(playbackTime: number = 0): void {
    this.currentSemanticState = 'OFF';
    this.activePatternId = 0;
    this.prevPatternId = 0;
    this.transitionProgress = 1.0;
    this.activationReason = 'Playback Seek / Reset';
    this.dropConfidence = 0.0;
    this.lastProcessedAbsoluteBar = -1;
    this.lastProcessedPhrase = -1;
    this.absoluteBarCounter = 0;
    this.barInPhraseCounter = 1;
    this.phraseCounter = 0;
    this.masterAngle = 0;
    this.smoothedMovementSpeed = 1.0;
    this.kickImpulseDecay = 0.0;
    this.beatGateDecay = 0.30;
    this.currentBeamOpacity = 0.0;
    this.rollingHighFreqTrend = [];
    this.rollingInstrumentalSustain = [];
    this.melodicAnthemPersistFrames = 0;
    this.dropEntranceFrames = 0;
    this.dropHoldDuration = 0.0;
    this.lastPlaybackTime = playbackTime;
  }

  /**
   * Evaluates audio features, musical structure, and rhythmic beat grid to produce
   * a single authoritative LaserShowDecision for the current render frame.
   */
  public update(
    features: AudioFeatures,
    deltaSeconds: number,
    trackTimeSeconds: number,
    seed: number,
    routingConfig?: AudioVisualRoutingConfig,
    directorState?: ShowDirectorState
  ): LaserShowDecision {
    const time = trackTimeSeconds;

    // 1. Playback Clock & Seek Detection (Phase 5.3)
    const timeDiscontinuity = time - this.lastPlaybackTime;
    if (Math.abs(timeDiscontinuity) > 0.6) {
      this.reset(time);
    }
    this.lastPlaybackTime = time;

    // 2. Playback Pause Handling
    // When paused (deltaSeconds <= 0), preserve current visual state without advancing motion
    if (deltaSeconds <= 0) {
      return this.buildDecision(false, 'Playback Paused', seed, features, directorState);
    }

    // 3. Hard Eligibility Verification (Phase 3.1)
    const isUserLaserEnabled = routingConfig?.enabledEffects?.lasers ?? true;
    const isDirectorLaserEnabled = directorState?.allowedEffects?.lasers ?? true;

    if (!isUserLaserEnabled) {
      this.currentSemanticState = 'OFF';
      this.currentBeamOpacity = Math.max(0, this.currentBeamOpacity - deltaSeconds * 4.0);
      return this.buildDecision(false, 'User Disabled in Routing Console', seed, features, directorState);
    }

    if (!isDirectorLaserEnabled) {
      this.currentSemanticState = 'OFF';
      this.currentBeamOpacity = Math.max(0, this.currentBeamOpacity - deltaSeconds * 3.5);
      return this.buildDecision(false, 'Director Section Restriction', seed, features, directorState);
    }

    // 4. Update Beat Grid & Absolute Musical Counters (Phase 5)
    this.updateMusicalGrid(features, time);

    // 5. Calculate Multi-Signal Drop Confidence Score (Phase 3.3)
    this.updateDropConfidence(features, directorState);

    // 6. Update Instrumental & High-Frequency Persistence Windows (Phase 4.4, 6.1)
    this.updateTemporalWindows(features);

    // 7. Hierarchical State Transition Engine (Phase 1, 3.2, 6)
    const nextState = this.determineSemanticState(features, directorState);
    this.applyStateTransition(nextState, seed, deltaSeconds);

    // 8. Advance Four-Bar Phrase Choreography Scheduler (Phase 5.1, 5.2)
    this.advanceChoreographyScheduler(seed, deltaSeconds);

    // 9. Modulate Dynamic Acoustic Feature Envelopes (Phase 4)
    this.modulateFeatureEnvelopes(features, deltaSeconds, routingConfig, directorState);

    // 10. Smooth Activation Envelope (Hysteresis & Attack/Release)
    const targetOpacity = this.currentSemanticState !== 'OFF' ? 1.0 : 0.0;
    const attackRate = 6.5;  // ~150ms attack
    const releaseRate = 3.3; // ~300ms release
    if (targetOpacity > this.currentBeamOpacity) {
      this.currentBeamOpacity = Math.min(1.0, this.currentBeamOpacity + deltaSeconds * attackRate);
    } else {
      this.currentBeamOpacity = Math.max(0.0, this.currentBeamOpacity - deltaSeconds * releaseRate);
    }

    const isPermitted = this.currentBeamOpacity > 0.02 && this.currentSemanticState !== 'OFF';

    // 11. Produce Authoritative Decision
    const decision = this.buildDecision(isPermitted, this.activationReason, seed, features, directorState);

    // 12. Rate-Limited Developer Diagnostics Output (Phase 9)
    this.emitDiagnostics(decision, features, time);

    return decision;
  }

  /**
   * Updates monotonic musical measure and phrase counters from BeatGridEngine.
   */
  private updateMusicalGrid(features: AudioFeatures, time: number): void {
    const timingConfidence = features.beatConfidence ?? 0.0;

    if (timingConfidence >= 0.25 && features.beatIndex !== undefined) {
      // Direct alignment with BeatGridEngine authoritative beat counter
      const currentAbsoluteBar = Math.floor(features.beatIndex / 4);
      this.absoluteBarCounter = currentAbsoluteBar;
      this.barInPhraseCounter = (currentAbsoluteBar % 4) + 1; // 1, 2, 3, 4 in 4-bar phrase
      this.phraseCounter = Math.floor(features.beatIndex / 16);
    } else {
      // Conservative time-based continuous fallback when BPM confidence is low
      const bpm = features.estimatedBpm && features.estimatedBpm >= 50 ? features.estimatedBpm : 120;
      const barDuration = (60.0 / bpm) * 4.0;
      const virtualBar = Math.floor(time / barDuration);
      this.absoluteBarCounter = virtualBar;
      this.barInPhraseCounter = (virtualBar % 4) + 1;
      this.phraseCounter = Math.floor(virtualBar / 4);
    }
  }

  /**
   * Phase 3.3: Multi-signal drop confidence calculation combining pre-computed stem
   * analysis, joint multi-stem surges, transient kicks, and downbeat snapping.
   */
  private updateDropConfidence(features: AudioFeatures, directorState?: ShowDirectorState): void {
    let score = 0.0;

    // A. Pre-computed authoritative Demucs continuous drop sections (authoritative context)
    if (features.isTriStemDropActive) {
      score += 0.45;
    }

    // B. ShowDirector section-level confirmation
    if (directorState?.currentSection === 'drop') {
      score += 0.25;
    }

    // C. Joint Multi-Stem Surge (Drums + Bass + Instruments simultaneous surge)
    const kickStem = features.stems?.kick ?? 0.0;
    const bassStem = features.stems?.bass ?? 0.0;
    const instStem = features.stems?.instruments ?? 0.0;
    const jointIntensity = kickStem * 0.42 + bassStem * 0.42 + instStem * 0.16;
    const avgRef = features.trackAverageAmplitude && features.trackAverageAmplitude > 0
      ? features.trackAverageAmplitude
      : 0.32;

    if (kickStem > 0.38 && bassStem > 0.38) {
      score += 0.18;
    }
    if (jointIntensity >= avgRef * 1.15) {
      score += 0.12;
    }

    // D. Real-time audio drop flag & intensity
    if (features.isDrop) {
      score += 0.15;
    }
    if (features.dropIntensity && features.dropIntensity > 0.5) {
      score += Math.min(0.15, features.dropIntensity * 0.15);
    }

    // E. Downbeat transient alignment bonus
    if (features.isKick && (features.isBar || features.isPhrase)) {
      score += 0.05;
    }

    this.dropConfidence = Math.min(1.0, score);
  }

  /**
   * Tracks rolling averages of high frequencies and instrumental sustain across multiple beats.
   */
  private updateTemporalWindows(features: AudioFeatures): void {
    // High-frequency activity index: highMid (500Hz-2kHz), treble (2kHz-16kHz), spectral centroid
    const hfSample = (features.highMid * 0.40) + (features.treble * 0.40) + (features.spectralCentroid * 0.20);
    this.rollingHighFreqTrend.push(hfSample);
    if (this.rollingHighFreqTrend.length > 30) {
      this.rollingHighFreqTrend.shift();
    }

    // Sustained instrumental activity index
    const instSample = features.instrumentalActivity ?? features.stems?.instruments ?? features.midRangeEnergy ?? 0.0;
    this.rollingInstrumentalSustain.push(instSample);
    if (this.rollingInstrumentalSustain.length > 40) {
      this.rollingInstrumentalSustain.shift();
    }
  }

  /**
   * Phase 3.2 & 6: Determines the approved semantic state based on section policy,
   * acoustic evidence, and persistence criteria.
   */
  private determineSemanticState(
    features: AudioFeatures,
    directorState?: ShowDirectorState
  ): LaserSemanticState {
    const currentSection: ShowSection = directorState?.currentSection || 'verse';
    const sectionProgress = directorState?.sectionProgress ?? 0.0;

    // 1. OUTRO / BREAKDOWN POLICY: Complete blackout or gentle release
    if (currentSection === 'outro' || currentSection === 'breakdown') {
      this.dropHoldDuration = 0.0;
      this.activationReason = `${currentSection.toUpperCase()} Section Blackout`;
      return 'OFF';
    }

    // 2. DROP & CLIMAX POLICY (with Hysteresis)
    // Activation threshold: 0.60; Release threshold: 0.38
    const isDropQualified = this.dropConfidence >= 0.60 ||
      (this.dropHoldDuration > 0 && this.dropConfidence >= 0.38 && currentSection === 'drop');

    if (isDropQualified) {
      // Sustain across 0.85s to bridge syncopated drum pauses within the drop section
      this.dropHoldDuration = 0.85;

      // Check for Major Climax Omnidirectional qualification
      const isClimaxQualified =
        this.dropConfidence >= 0.82 &&
        ((features.dropIntensity ?? 0) > 0.78 || (features.globalIntensity ?? 0) > 0.82 || features.mood === 'euphoric-drop') &&
        (features.bass > 0.52 || (features.stems?.bass ?? 0) > 0.50);

      if (isClimaxQualified) {
        this.dropEntranceFrames = 0;
        this.activationReason = `Major Climax Omnidirectional (Intensity: ${(features.globalIntensity ?? 0.9).toFixed(2)})`;
        return 'CLIMAX_OMNIDIRECTIONAL';
      }

      // Check for Confirmed Drop Entrance (first 1-2 beats on downbeat)
      if (this.currentSemanticState !== 'DROP_GROOVE' && this.currentSemanticState !== 'DROP_IMPACT' && this.currentSemanticState !== 'CLIMAX_OMNIDIRECTIONAL') {
        this.dropEntranceFrames = 20; // ~0.35s impact burst on drop downbeat
        this.activationReason = `Confirmed Drop Entrance (Confidence: ${(this.dropConfidence * 100).toFixed(0)}%)`;
        return 'DROP_IMPACT';
      }

      if (this.dropEntranceFrames > 0) {
        this.dropEntranceFrames--;
        return 'DROP_IMPACT';
      }

      this.activationReason = `Sustained Drop Groove (Confidence: ${(this.dropConfidence * 100).toFixed(0)}%)`;
      return 'DROP_GROOVE';
    }

    // Decay drop hold timer outside active drop frames
    if (this.dropHoldDuration > 0) {
      this.dropHoldDuration -= 0.016; // approximate decay
    }

    // 3. BUILDUP POLICY (Phase 4.4, 6.2)
    if (currentSection === 'buildup') {
      // Early buildup (< 45% progress): Off by default to build dynamic anticipation
      if (sectionProgress < 0.45) {
        this.activationReason = 'Early Buildup Hold (Dynamic Contrast)';
        return 'OFF';
      }

      // Late buildup (>= 45% progress): Requires sustained rising high-frequency trend
      const avgHf = this.rollingHighFreqTrend.reduce((a, b) => a + b, 0) / Math.max(1, this.rollingHighFreqTrend.length);
      const isRisingTrend = avgHf > 0.40 && features.rms > 0.28;

      if (isRisingTrend) {
        this.activationReason = `Late Buildup Tension Riser (${Math.round(sectionProgress * 100)}% progress)`;
        return 'BUILD_RISER';
      }

      this.activationReason = 'Buildup Standby (Awaiting Sustained HF Trend)';
      return 'OFF';
    }

    // 4. MELODIC CHORUS / ANTHEM POLICY (Phase 1, 4.5, 6.1)
    // A melodic chorus must not be classified as a drop simply because it is bright or loud
    const avgInstSustain = this.rollingInstrumentalSustain.reduce((a, b) => a + b, 0) /
      Math.max(1, this.rollingInstrumentalSustain.length);

    const isSustainedMelody = avgInstSustain > 0.42 && (features.midRangeEnergy ?? 0) > 0.38;
    const isModerateEnergy = features.rms > 0.24 && features.rms < 0.75;
    const isNotDropContext = this.dropConfidence < 0.40 && currentSection !== 'drop';

    if (isSustainedMelody && isModerateEnergy && isNotDropContext) {
      this.melodicAnthemPersistFrames++;
      // Require sustained evidence across at least 8 consecutive frames (~0.2s)
      if (this.melodicAnthemPersistFrames >= 8) {
        this.activationReason = `Sustained Melodic Anthem (Inst: ${avgInstSustain.toFixed(2)})`;
        return 'MELODIC_ANTHEM';
      }
    } else {
      this.melodicAnthemPersistFrames = Math.max(0, this.melodicAnthemPersistFrames - 2);
    }

    // 5. INTRO & VERSE POLICY
    if (currentSection === 'intro') {
      this.activationReason = 'Intro Blackout';
      return 'OFF';
    }

    // Sparse cinematic directional cue allowed in verse ONLY if instrumental melody is exceptionally sustained
    if (currentSection === 'verse' && avgInstSustain > 0.65 && features.rms > 0.22 && features.rms < 0.50) {
      this.activationReason = 'Sparse Cinematic Directional Verse Motif';
      return 'CINEMATIC_DIRECTIONAL';
    }

    this.activationReason = 'Verse Blackout (Intentional Spacing)';
    return 'OFF';
  }

  /**
   * Applies state changes and initializes smooth pattern transitions.
   */
  private applyStateTransition(nextState: LaserSemanticState, seed: number, _deltaSeconds: number): void {
    if (nextState !== this.currentSemanticState) {
      const oldState = this.currentSemanticState;
      this.currentSemanticState = nextState;

      if (nextState !== 'OFF') {
        // Select an initial pattern compatible with the new state
        const initialPattern = selectChoreographyForArc(
          nextState,
          this.barInPhraseCounter,
          seed,
          this.activePatternId,
          this.phraseCounter
        );

        if (initialPattern !== this.activePatternId) {
          this.prevPatternId = this.activePatternId;
          this.activePatternId = initialPattern;
          this.transitionProgress = 0.0;
        }
      }

      this.logStateTransition(oldState, nextState);
    }
  }

  /**
   * Phase 5: Advances the four-bar phrase choreography scheduler strictly on bar boundaries.
   */
  private advanceChoreographyScheduler(seed: number, deltaSeconds: number): void {
    // Advance smooth cubic hermite pattern blend (0.35s transition)
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + deltaSeconds / 0.35);
    }

    if (this.currentSemanticState === 'OFF') {
      return;
    }

    // Detect phrase transition (every 4 bars)
    if (this.phraseCounter !== this.lastProcessedPhrase) {
      this.lastProcessedPhrase = this.phraseCounter;
    }

    // Detect new bar transition (evaluated once per measure to prevent multi-frame re-triggering)
    if (this.absoluteBarCounter !== this.lastProcessedAbsoluteBar) {
      this.lastProcessedAbsoluteBar = this.absoluteBarCounter;

      // Advance choreography based on the 4-bar arc role (Motif -> Develop -> Tension -> Accent)
      const nextPattern = selectChoreographyForArc(
        this.currentSemanticState,
        this.barInPhraseCounter,
        seed,
        this.activePatternId,
        this.phraseCounter
      );

      if (nextPattern !== this.activePatternId) {
        this.prevPatternId = this.activePatternId;
        this.activePatternId = nextPattern;
        this.transitionProgress = 0.0;
      }
    }
  }

  /**
   * Phase 4: Maps acoustic features to visual parameters (movement speed, beam thickness,
   * spread expansion, beat-gated call-and-response, and kick pulse brightness).
   */
  private modulateFeatureEnvelopes(
    features: AudioFeatures,
    deltaSeconds: number,
    routingConfig?: AudioVisualRoutingConfig,
    directorState?: ShowDirectorState
  ): void {
    const meta = getChoreographyMetadata(this.activePatternId);

    // 1. Kick Transient Pulse Brightness (Attack: Instant, Decay: ~140ms)
    const kickHit = features.isKick ? (features.kickIntensity * (routingConfig?.kickSensitivity ?? 1.0) * 0.85) : 0.0;
    if (kickHit > this.kickImpulseDecay) {
      this.kickImpulseDecay = Math.min(1.0, kickHit);
    } else {
      this.kickImpulseDecay = Math.max(0.0, this.kickImpulseDecay - deltaSeconds * 6.5);
    }

    // 2. Beat-Gated Decay (On/off synchronization for designated DROP_GROOVE profiles)
    if (features.isKick || (features.isBeat && features.onsetStrength > 0.35)) {
      this.beatGateDecay = 1.0;
    } else {
      this.beatGateDecay = Math.max(0.28, this.beatGateDecay - deltaSeconds * 3.8);
    }

    // 3. Continuous Trajectory Movement Speed
    const baseSpeed = meta.defaultSpeedScale;
    const instMultiplier = routingConfig?.instrumentalMovementSpeed ?? 1.0;
    const midRange = features.midRangeEnergy ?? 0.40;
    const instActivity = features.instrumentalActivity ?? features.stems?.instruments ?? 0.50;

    let targetSpeed = (baseSpeed * (0.85 + midRange * 0.80 + instActivity * 0.45) + this.kickImpulseDecay * 0.35) * instMultiplier;

    // Accelerate progressively during late buildup
    if (this.currentSemanticState === 'BUILD_RISER' && directorState) {
      targetSpeed *= (1.0 + directorState.sectionProgress * 0.85);
    } else if (this.currentSemanticState === 'CINEMATIC_DIRECTIONAL' || this.currentSemanticState === 'MELODIC_ANTHEM') {
      targetSpeed = Math.min(targetSpeed, 0.75 * instMultiplier); // Enforce restrained cinematic movement
    }

    // Smooth speed transitions to prevent jerky trajectory jumps
    this.smoothedMovementSpeed += (targetSpeed - this.smoothedMovementSpeed) * Math.min(1.0, deltaSeconds * 5.0);
    this.masterAngle += deltaSeconds * this.smoothedMovementSpeed;
  }

  /**
   * Constructs the immutable LaserShowDecision for the current frame.
   */
  private buildDecision(
    isPermitted: boolean,
    reason: string,
    _seed: number,
    features: AudioFeatures,
    directorState?: ShowDirectorState
  ): LaserShowDecision {
    const meta = getChoreographyMetadata(this.activePatternId);

    // Beam Density: Respects state defaults and user density setting
    let beamDensity = meta.defaultDensity;
    if (this.currentSemanticState === 'BUILD_RISER' && directorState) {
      beamDensity = 0.35 + directorState.sectionProgress * 0.50; // Ramp from 35% up to 85%
    } else if (this.currentSemanticState === 'CINEMATIC_DIRECTIONAL') {
      beamDensity = 0.40; // Sparse beams thrown in deliberate directions
    }

    // Spatial Spread & Thickness Modulated by Bass / Sub-Bass
    const bass = features.bass ?? 0.0;
    const subBass = features.subBass ?? 0.0;
    const bassStem = features.stems?.bass ?? 0.0;
    const beamSpreadMultiplier = 1.0 + Math.min(0.40, bass * 0.22 + subBass * 0.18);
    const beamThicknessMultiplier = 1.0 + Math.min(0.45, subBass * 0.28 + bassStem * 0.20);

    // Upward Elevation Bias (Tilts beams into skyward dome during buildups)
    let elevationBias = 0.0;
    if (this.currentSemanticState === 'BUILD_RISER' && directorState) {
      elevationBias = directorState.sectionProgress * 8.5;
    }

    // Call-and-Response Station Gating Mask
    // In DROP_GROOVE with beat-gating: Alternate Left/Right vs Center on alternating beats
    let activeStationMask: [boolean, boolean, boolean] = [true, true, true];
    const isBeatGated = meta.beatGatedSupport && this.currentSemanticState === 'DROP_GROOVE';

    if (isBeatGated) {
      const beatInBar = (features.beatIndex ?? 0) % 4;
      if (beatInBar === 0 || beatInBar === 2) {
        activeStationMask = [true, false, true];  // Left & Right stations
      } else {
        activeStationMask = [false, true, false]; // Center station
      }
    }

    // Baseline Intensity Opacity
    const baseIntensity = this.currentBeamOpacity * (
      this.currentSemanticState === 'CLIMAX_OMNIDIRECTIONAL' ? 1.0 :
      this.currentSemanticState === 'DROP_GROOVE' ? 0.95 :
      this.currentSemanticState === 'DROP_IMPACT' ? 1.0 :
      this.currentSemanticState === 'BUILD_RISER' ? (0.50 + (directorState?.sectionProgress ?? 0) * 0.45) :
      0.65 // Melodic / Cinematic restrained intensity
    );

    return {
      isPermitted,
      semanticState: this.currentSemanticState,
      patternId: this.activePatternId,
      prevPatternId: this.prevPatternId,
      transitionProgress: this.transitionProgress,
      activationReason: reason,
      confidence: this.dropConfidence,
      movementSpeed: this.smoothedMovementSpeed,
      beamDensity,
      beamIntensity: baseIntensity,
      pulseBrightness: this.kickImpulseDecay,
      beamSpreadMultiplier,
      beamThicknessMultiplier,
      elevationBias,
      activeStationMask,
      isBeatGated,
      beatGateFactor: this.beatGateDecay,
      absoluteBarIndex: this.absoluteBarCounter,
      barInPhrase: this.barInPhraseCounter,
      phraseIndex: this.phraseCounter,
      timingConfidence: features.beatConfidence ?? 0.0,
    };
  }

  /**
   * Logs state transitions cleanly without spamming.
   */
  private logStateTransition(fromState: LaserSemanticState, toState: LaserSemanticState): void {
    const meta = getChoreographyMetadata(this.activePatternId);
    console.debug(
      `[Synwave LaserDirector] ${fromState} -> ${toState} | Reason: ${this.activationReason} | Pattern: #${meta.id} "${meta.name}" (Role: ${meta.roleInFourBar})`
    );
  }

  /**
   * Rate-limited developer diagnostics output throttled to once per 1.5 seconds.
   */
  private emitDiagnostics(decision: LaserShowDecision, features: AudioFeatures, timeSeconds: number): void {
    const now = performance.now();
    const stateSig = `${decision.semanticState}_${decision.patternId}_${decision.barInPhrase}`;

    if (now - this.lastDiagnosticTime > 1500 || stateSig !== this.lastLoggedState) {
      this.lastDiagnosticTime = now;
      this.lastLoggedState = stateSig;

      const meta = getChoreographyMetadata(decision.patternId);
      this.cachedTelemetry = {
        semanticState: decision.semanticState,
        isPermitted: decision.isPermitted,
        activationReason: decision.activationReason,
        dropConfidence: decision.confidence,
        activePatternId: decision.patternId,
        activePatternName: meta.name,
        intendedRole: meta.roleInFourBar,
        barInPhrase: decision.barInPhrase,
        absoluteBar: decision.absoluteBarIndex,
        timingConfidence: decision.timingConfidence,
        bpm: features.estimatedBpm ?? 120,
        isBeatGated: decision.isBeatGated,
        density: decision.beamDensity,
        speed: decision.movementSpeed,
        timestamp: timeSeconds,
      };
    }
  }

  /**
   * Returns current diagnostic telemetry snapshot for DiagnosticOverlay.
   */
  public getDiagnosticTelemetry(): LaserDiagnosticTelemetry | null {
    return this.cachedTelemetry;
  }

  /**
   * Returns currently active master angle for synchronized beam sweeps.
   */
  public getMasterAngle(): number {
    return this.masterAngle;
  }
}
