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
import { clearAllSynwaveCaches } from '../services/demucsService';

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
  const [cacheStatus, setCacheStatus] = useState<{ exists: boolean; shazamCount: number; stemsCount: number; isOnline: boolean } | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Query microservice disk cache status
    fetch('http://127.0.0.1:8765/api/cache/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCacheStatus({
            exists: data.exists,
            shazamCount: data.shazamCount,
            stemsCount: data.stemsCount,
            isOnline: true,
          });
        }
      })
      .catch(() => {
        setCacheStatus({
          exists: false,
          shazamCount: 0,
          stemsCount: 0,
          isOnline: false,
        });
      });

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
            <span className="metric-name">RESOLVED BPM</span>
            <span className="metric-value highlight">
              {features.bpmSource === 'unavailable' ? 'UNAVAILABLE' : `${features.estimatedBpm.toFixed(1)} BPM`}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">BPM PROVENANCE</span>
            <span className="metric-value">
              {features.bpmSource === 'shazamio' && <span style={{ color: '#34d399', fontWeight: 700 }}>SHAZAMIO [VERIFIED]</span>}
              {features.bpmSource === 'demucs' && <span style={{ color: '#22d3ee', fontWeight: 700 }}>DEMUCS [KICKS]</span>}
              {(!features.bpmSource || features.bpmSource === 'unavailable') && <span style={{ color: '#fbbf24' }}>UNAVAILABLE</span>}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">TEMPO CONFIDENCE</span>
            <span className="metric-value">{Math.round((features.bpmConfidence ?? features.beatConfidence ?? 0) * 100)}%</span>
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
          <div className="metric-row">
            <span className="metric-name">ACTIVE SPOTLIGHTS</span>
            <span className="metric-value highlight">
              {RoutingStore.getInstance().getConfig().spotlightCount ?? 3} Fixtures (Symmetrical BPM-Mapped)
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">WHITE SKY SPOTLIGHTS</span>
            <span className="metric-value highlight" style={{ color: '#ffffff' }}>
              Dual Flanks (Left & Right) · Upward Sky Beams
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">PERIMETER BASS RIG</span>
            <span className="metric-value text-muted-val" style={{ fontSize: '0.75rem' }}>
              12 Fixtures (360° Continuous Bass-Driven Rotation)
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">STAGE CHOREOGRAPHY</span>
            <span className="metric-value highlight" style={{ fontSize: '0.75rem' }}>
              {directorState?.choreographyPattern || 'Festival Mainstage'}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-name">TRACK AVG AMPLITUDE</span>
            <span className="metric-value">
              {features.trackAverageAmplitude !== undefined ? `${features.trackAverageAmplitude.toFixed(3)} Ref` : '0.300 Ref'}
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
            <span className="metric-name">HARDWARE ACCEL</span>
            <span className="metric-value highlight" style={{ color: '#00f0ff' }}>
              APPLE SILICON MPS (METAL)
            </span>
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
          <div className="metric-row">
            <span className="metric-name">DISK STORE</span>
            <span className="metric-value highlight" style={{ color: cacheStatus?.isOnline ? '#34d399' : '#f59e0b' }}>
              {cacheStatus?.isOnline
                ? `.synwave_cache (${cacheStatus.stemsCount} stems, ${cacheStatus.shazamCount} shazam)`
                : 'OFFLINE (Browser Cache Active)'}
            </span>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '4px 8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                borderRadius: '4px',
                cursor: isClearingCache ? 'wait' : 'pointer',
              }}
              disabled={isClearingCache}
              onClick={async () => {
                setIsClearingCache(true);
                await clearAllSynwaveCaches();
                setCacheStatus({ exists: true, shazamCount: 0, stemsCount: 0, isOnline: true });
                setIsClearingCache(false);
              }}
              title="Purge .synwave_cache on disk, IndexedDB stems, and localStorage recognition"
            >
              {isClearingCache ? 'PURGING...' : 'PURGE ALL CACHES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
