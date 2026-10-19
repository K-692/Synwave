/**
 * Synwave Audio-to-Visual Routing Console
 * 
 * Allows users to customize how audio features influence the 3D concert stage:
 * - Select Stage Profiles (Festival Mainstage, Industrial Underground, Rock Arena, Cinematic Ambient)
 * - Fine-tune Kick Sensitivity, Bass-to-Beam, Vocal-to-Screen, Pyro Thresholds, and Laser Density
 * - Toggle individual effect families (Lights, Lasers, Flames, Smoke, Stage Screen)
 * - Configure safety and accessibility (Reduced Flash, Disable Pyrotechnics, Camera Shake)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Sliders,
  Flame,
  Lightbulb,
  Cloud,
  Tv,
  Zap,
  Shield,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { RoutingStore, STAGE_PROFILES } from '../visualizer/director/RoutingStore';
import type { AudioVisualRoutingConfig, StageProfile } from '../types';

interface RoutingConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoutingConsole: React.FC<RoutingConsoleProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AudioVisualRoutingConfig>(
    RoutingStore.getInstance().getConfig()
  );
  const [activeProfile, setActiveProfile] = useState<StageProfile>(
    RoutingStore.getInstance().getActiveProfile()
  );

  useEffect(() => {
    const routingStore = RoutingStore.getInstance();
    const unsubscribe = routingStore.subscribe((cfg, prof) => {
      setConfig(cfg);
      setActiveProfile(prof);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleSliderChange = (
    key: keyof Omit<AudioVisualRoutingConfig, 'enabledEffects' | 'reducedFlash' | 'disablePyrotechnics'>,
    value: number
  ) => {
    RoutingStore.getInstance().updateConfig({ [key]: value });
  };

  const handleToggleEffect = (family: keyof AudioVisualRoutingConfig['enabledEffects']) => {
    RoutingStore.getInstance().toggleEffect(family);
  };

  const handleToggleSafety = (key: 'reducedFlash' | 'disablePyrotechnics') => {
    RoutingStore.getInstance().updateConfig({ [key]: !config[key] });
  };

  const handleReset = () => {
    RoutingStore.getInstance().resetToProfileDefault();
  };

  return (
    <div className="synwave-routing-overlay" onClick={onClose}>
      <div
        className="synwave-routing-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="routing-modal-header">
          <div className="routing-header-title">
            <Sliders size={20} className="neon-cyan-icon" />
            <div>
              <h3>AUDIO-TO-VISUAL ROUTING CONSOLE</h3>
              <p>Calibrate stage sensitivity, effect families, and procedural concert profiles</p>
            </div>
          </div>

          <div className="routing-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReset}
              title="Reset sliders to stage profile defaults"
            >
              <RotateCcw size={14} />
              <span>Reset Profile</span>
            </button>
            <button className="btn-icon btn-sm" onClick={onClose} title="Close Console">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="routing-modal-body">
          {/* Section 1: Active Stage Mode */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Sparkles size={16} />
              <span>ACTIVE STAGE MODE</span>
            </h4>
            <div className="profile-grid">
              {(Object.keys(STAGE_PROFILES) as StageProfile[]).map((profKey) => {
                const prof = STAGE_PROFILES[profKey];
                const isActive = activeProfile === profKey;
                return (
                  <div
                    key={profKey}
                    className={`profile-card ${isActive ? 'active' : ''}`}
                    style={{
                      borderColor: prof.accentColor,
                    }}
                  >
                    <div className="profile-card-top">
                      <span className="profile-name" style={{ color: prof.accentColor }}>
                        {prof.name}
                      </span>
                      <span className="profile-badge">ACTIVE</span>
                    </div>
                    <span className="profile-subtitle">{prof.subtitle}</span>
                    <p className="profile-desc">{prof.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Master Effect Family Toggles */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Zap size={16} />
              <span>STAGE EFFECT FAMILIES</span>
            </h4>
            <div className="effect-toggles-grid">
              <button
                className={`effect-toggle-pill ${config.enabledEffects.lights ? 'active' : ''}`}
                onClick={() => handleToggleEffect('lights')}
              >
                <Lightbulb size={16} />
                <span>Moving Head Lights</span>
              </button>

              <button
                className={`effect-toggle-pill ${config.enabledEffects.lasers ? 'active' : ''}`}
                onClick={() => handleToggleEffect('lasers')}
              >
                <Zap size={16} />
                <span>Heavyweight Lasers</span>
              </button>

              <button
                className={`effect-toggle-pill ${config.enabledEffects.flames && !config.disablePyrotechnics ? 'active' : ''}`}
                onClick={() => handleToggleEffect('flames')}
                disabled={config.disablePyrotechnics}
              >
                <Flame size={16} />
                <span>Flame Cannons</span>
              </button>

              <button
                className={`effect-toggle-pill ${config.enabledEffects.smoke ? 'active' : ''}`}
                onClick={() => handleToggleEffect('smoke')}
              >
                <Cloud size={16} />
                <span>Cryo Smoke & Haze</span>
              </button>

              <button
                className={`effect-toggle-pill ${config.enabledEffects.screen ? 'active' : ''}`}
                onClick={() => handleToggleEffect('screen')}
              >
                <Tv size={16} />
                <span>Jumbotron Screen</span>
              </button>
            </div>
          </div>

          {/* Section 3: Audio-to-Visual Mappings & Sensitivity */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Sliders size={16} />
              <span>AUDIO SIGNAL MAPPING & SENSITIVITY</span>
            </h4>
            <div className="sliders-grid">
              {/* Kick Sensitivity */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Kick Sensitivity</span>
                  <span className="slider-val">{config.kickSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={config.kickSensitivity}
                  onChange={(e) => handleSliderChange('kickSensitivity', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Controls drum kick blinder flash and flame burst triggers</span>
              </div>

              {/* Bass to Beam Intensity */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Bass-to-Beam Intensity</span>
                  <span className="slider-val">{config.bassToBeamIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={config.bassToBeamIntensity}
                  onChange={(e) => handleSliderChange('bassToBeamIntensity', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Modulates moving-head beam thickness and floor wash radiance</span>
              </div>

              {/* Vocal to Screen Glow */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Vocal-to-Screen Glow</span>
                  <span className="slider-val">{config.vocalToScreenGlow.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={config.vocalToScreenGlow}
                  onChange={(e) => handleSliderChange('vocalToScreenGlow', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Drives stage screen ambient flare and cryo plume velocity</span>
              </div>

              {/* Pyro Trigger Threshold */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Pyro Trigger Threshold</span>
                  <span className="slider-val">{config.pyroThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={config.pyroThreshold}
                  onChange={(e) => handleSliderChange('pyroThreshold', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Higher values require massive festival drops to ignite flames</span>
              </div>

              {/* Laser Density */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Laser Density & Beams</span>
                  <span className="slider-val">{config.laserDensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={config.laserDensity}
                  onChange={(e) => handleSliderChange('laserDensity', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Adjusts active laser projector count and volumetric sheath</span>
              </div>

              {/* Colouring Spotlight Count */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Colouring Spotlights</span>
                  <span className="slider-val">{config.spotlightCount ?? 3} Fixtures</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={config.spotlightCount ?? 3}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    RoutingStore.getInstance().setSpotlightCount(count);
                  }}
                />
                <span className="slider-hint">Number of active colour-tinted spotlights sweeping the stage (default: 3)</span>
              </div>

              {/* Effect Decay */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Effect Envelope Decay</span>
                  <span className="slider-val">{config.effectDecay.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={config.effectDecay}
                  onChange={(e) => handleSliderChange('effectDecay', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Shapes the attack and release curve of blinder and fire bursts</span>
              </div>
            </div>
          </div>

          {/* Section 4: Safety & Accessibility Controls */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Shield size={16} />
              <span>SAFETY & ACCESSIBILITY CONTROLS</span>
            </h4>
            <div className="safety-grid">
              {/* Reduced Flash Toggle */}
              <div
                className={`safety-card ${config.reducedFlash ? 'active' : ''}`}
                onClick={() => handleToggleSafety('reducedFlash')}
              >
                <div className="safety-card-header">
                  <EyeOff size={18} />
                  <span className="safety-title">Reduced Flash Mode</span>
                  <span className={`safety-toggle-indicator ${config.reducedFlash ? 'on' : 'off'}`}>
                    {config.reducedFlash ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="safety-desc">Tones down high-contrast blinder strobing for light sensitivity</p>
              </div>

              {/* Disable Pyrotechnics Toggle */}
              <div
                className={`safety-card ${config.disablePyrotechnics ? 'active' : ''}`}
                onClick={() => handleToggleSafety('disablePyrotechnics')}
              >
                <div className="safety-card-header">
                  <Flame size={18} />
                  <span className="safety-title">Disable Pyrotechnics</span>
                  <span className={`safety-toggle-indicator ${config.disablePyrotechnics ? 'on' : 'off'}`}>
                    {config.disablePyrotechnics ? 'DISABLED' : 'ENABLED'}
                  </span>
                </div>
                <p className="safety-desc">Completely deactivates all 8 stage flamethrowers across all presets</p>
              </div>

              {/* Camera Shake Slider */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Camera Shake Intensity</span>
                  <span className="slider-val">{config.cameraShakeStrength.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={config.cameraShakeStrength}
                  onChange={(e) => handleSliderChange('cameraShakeStrength', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Chest-thump vibration on heavy kicks (set to 0 for locked camera)</span>
              </div>

              {/* Max Brightness Limit */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Max Brightness Ceiling</span>
                  <span className="slider-val">{Math.round(config.maxBrightnessLimit * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={config.maxBrightnessLimit}
                  onChange={(e) => handleSliderChange('maxBrightnessLimit', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Prevents venue overexposure and enforces global lumen ceiling</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
