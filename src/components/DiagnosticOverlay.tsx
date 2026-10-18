/**
 * Synwave Real-Time Audio & Telemetry Diagnostic Overlay
 * 
 * Heads-Up Display (HUD) displaying:
 * - Live BPM, Beat Grid Confidence, Beat & Bar Index, Beat Phase Progress
 * - Procedural Show Director Section & Active Choreography Pattern
 * - Multi-band Spectral Energy (Sub-Bass, Bass, RMS, Centroid, Onset Strength)
 * - 4-Channel Real-time STEM separation levels
 * - Mode 1 (Instant Reactive Analysis) vs Mode 2 (AI Stem Separation)
 * - Active Stage Profile and FPS performance
 */

import React, { useState, useEffect, useRef } from 'react';
import type { AudioFeatures, ShowDirectorState } from '../types';
import { RoutingStore } from '../visualizer/director/RoutingStore';

interface DiagnosticOverlayProps {
  isVisible: boolean;
  getLiveFeatures: () => AudioFeatures;
  getDirectorState: () => ShowDirectorState | null;
  onClose: () => void;
}

export const DiagnosticOverlay: React.FC<DiagnosticOverlayProps> = ({
  isVisible,
  getLiveFeatures,
  getDirectorState,
  onClose,
}) => {
  const [fps, setFps] = useState(60);
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [directorState, setDirectorState] = useState<ShowDirectorState | null>(null);
  const [activeProfile, setActiveProfile] = useState(RoutingStore.getInstance().getActiveProfile());

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const updateLoop = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 500) {
        const delta = (now - lastFpsTimeRef.current) / 1000;
        setFps(Math.round(frameCountRef.current / delta));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      setFeatures(getLiveFeatures());
      setDirectorState(getDirectorState());
      setActiveProfile(RoutingStore.getInstance().getActiveProfile());

      rafRef.current = requestAnimationFrame(updateLoop);
    };

    rafRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, getLiveFeatures, getDirectorState]);

  if (!isVisible || !features) return null;

  return (
    <div className="synwave-diagnostic-overlay glass-panel">
      {/* Header */}
      <div className="diagnostic-header">
        <div className="diagnostic-title">
          <span className="diagnostic-live-dot" />
          <span>SYNCHRONIZATION & TELEMETRY HUD</span>
        </div>
        <button className="diagnostic-close-btn" onClick={onClose} title="Close HUD (Hotkey: D)">
          ✕
        </button>
      </div>

      {/* Grid of Telemetry */}
      <div className="diagnostic-grid">
        {/* Panel 1: Beat Grid & Tempo */}
        <div className="diagnostic-panel">
          <div className="panel-title">BEAT GRID & TEMPO</div>
          <div className="metric-row">
            <span className="metric-name">ESTIMATED BPM</span>
            <span className="metric-value highlight">{features.estimatedBpm.toFixed(1)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">BEAT CONFIDENCE</span>
            <span className="metric-value">{Math.round((features.beatConfidence || 0) * 100)}%</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">BEAT INDEX</span>
            <span className="metric-value">#{features.beatIndex || 0}</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">BAR / PHRASE</span>
            <span className="metric-value">Bar {features.barIndex || 1} • {features.isPhrase ? 'PHRASE' : features.isBar ? 'DOWNBEAT' : 'BEAT'}</span>
          </div>

          {/* Continuous Beat Phase Bar */}
          <div className="phase-bar-wrapper">
            <span className="phase-bar-label">BEAT PHASE (0.0 → 1.0)</span>
            <div className="phase-bar-track">
              <div
                className="phase-bar-fill"
                style={{ width: `${Math.round(features.beatPhase * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Procedural Show Director */}
        <div className="diagnostic-panel">
          <div className="panel-title">SHOW DIRECTOR & PROFILE</div>
          <div className="metric-row">
            <span className="metric-name">ACTIVE SECTION</span>
            <span className="metric-value section-tag">
              {directorState?.currentSection.toUpperCase() || 'VERSE'}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">STAGE PROFILE</span>
            <span className="metric-value profile-tag">
              {activeProfile.toUpperCase()}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">CHOREOGRAPHY</span>
            <span className="metric-value text-muted-val">
              {directorState?.choreographyPattern || 'Rhythmic Pulse'}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">ENERGY INTENSITY</span>
            <span className="metric-value highlight">
              {directorState?.intensityMultiplier.toFixed(2)}x
            </span>
          </div>

          {/* Section Progress */}
          <div className="phase-bar-wrapper">
            <span className="phase-bar-label">SECTION PROGRESS</span>
            <div className="phase-bar-track">
              <div
                className="phase-bar-fill section-fill"
                style={{ width: `${Math.round((directorState?.sectionProgress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Panel 3: Real-Time 4-STEM Separation */}
        <div className="diagnostic-panel">
          <div className="panel-title">4-CHANNEL STEM DECOMPOSITION</div>
          <div className="stem-meter-row">
            <span className="stem-name">KICK</span>
            <div className="stem-bar-track">
              <div className="stem-bar-fill kick" style={{ width: `${Math.round(features.stems.kick * 100)}%` }} />
            </div>
            <span className="stem-val">{features.stems.kick.toFixed(2)}</span>
          </div>

          <div className="stem-meter-row">
            <span className="stem-name">BASS</span>
            <div className="stem-bar-track">
              <div className="stem-bar-fill bass" style={{ width: `${Math.round(features.stems.bass * 100)}%` }} />
            </div>
            <span className="stem-val">{features.stems.bass.toFixed(2)}</span>
          </div>

          <div className="stem-meter-row">
            <span className="stem-name">INST</span>
            <div className="stem-bar-track">
              <div className="stem-bar-fill inst" style={{ width: `${Math.round(features.stems.instruments * 100)}%` }} />
            </div>
            <span className="stem-val">{features.stems.instruments.toFixed(2)}</span>
          </div>

          <div className="stem-meter-row">
            <span className="stem-name">VOCAL</span>
            <div className="stem-bar-track">
              <div className="stem-bar-fill vocals" style={{ width: `${Math.round(features.stems.vocals * 100)}%` }} />
            </div>
            <span className="stem-val">{features.stems.vocals.toFixed(2)}</span>
          </div>
        </div>

        {/* Panel 4: Analysis Engine & Hardware Performance */}
        <div className="diagnostic-panel">
          <div className="panel-title">ENGINE & PERFORMANCE</div>
          <div className="metric-row">
            <span className="metric-name">ACTIVE MODE</span>
            <span className="metric-value highlight">Mode 1: Instant Reactive</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">FPS RENDERING</span>
            <span className="metric-value highlight">{fps} FPS</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">ONSET TRANSIENT</span>
            <span className="metric-value">{features.onsetStrength.toFixed(2)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">SPECTRAL BRIGHTNESS</span>
            <span className="metric-value">{features.spectralCentroid.toFixed(2)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-name">DROP CLIMAX</span>
            <span className="metric-value highlight" style={{ color: features.isDrop ? '#ff0055' : '#64748b' }}>
              {features.isDrop ? '⚡ DETECTED' : 'QUIET'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
