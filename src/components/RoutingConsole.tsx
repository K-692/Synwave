/**
 * Synwave Audio-to-Visual Routing Console
 * 
 * Comprehensive calibration console for the 3D concert stage:
 * - Drums & Kicks: Screen Shake (YouTube iframe only), Screen Flash Strobe, Kick Sensitivity
 * - Bass Spectrum: 360° Perimeter Light Rotation Speed, Bass-to-Beam Radiance, Flash Color Saturation, Envelope Decay
 * - Instruments: 360° Downward Instrument Lasers Sweep Speed & Beam Density
 * - Spotlights: Fixture Count (1-8), Thumbnail Palette Tuning, Global Brightness Ceiling
 * - Master Toggles: Moving Head Lights & 360° Rig, Downward Instrument Lasers
 * - Safety & Accessibility: Reduced Flash Mode
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Sliders,
  Lightbulb,
  Zap,
  Shield,
  EyeOff,
  Disc3,
  Waves,
  Music,
  Activity,
} from 'lucide-react';
import { RoutingStore } from '../visualizer/director/RoutingStore';
import type { AudioVisualRoutingConfig } from '../types';

interface RoutingConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoutingConsole: React.FC<RoutingConsoleProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AudioVisualRoutingConfig>(
    RoutingStore.getInstance().getConfig()
  );

  useEffect(() => {
    const routingStore = RoutingStore.getInstance();
    const unsubscribe = routingStore.subscribe((cfg) => {
      setConfig(cfg);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleSliderChange = (
    key: keyof Omit<AudioVisualRoutingConfig, 'enabledEffects' | 'reducedFlash'>,
    value: number
  ) => {
    RoutingStore.getInstance().updateConfig({ [key]: value });
  };

  const handleToggleEffect = (family: keyof AudioVisualRoutingConfig['enabledEffects']) => {
    RoutingStore.getInstance().toggleEffect(family);
  };

  const handleToggleSafety = (key: 'reducedFlash') => {
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
              <p>Calibrate neural stem triggers, 360° perimeter bass rig, 360° downward instrument lasers, and screen blinders</p>
            </div>
          </div>

          <div className="routing-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReset}
              title="Reset sliders to stage defaults"
            >
              <RotateCcw size={14} />
              <span>Reset Defaults</span>
            </button>
            <button className="btn-icon btn-sm" onClick={onClose} title="Close Console">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="routing-modal-body">
          {/* Section 1: Master Effect Family Toggles */}
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
                <span>Moving Head Lights & 360° Screen Rig</span>
              </button>

              <button
                className={`effect-toggle-pill ${config.enabledEffects.lasers ? 'active' : ''}`}
                onClick={() => handleToggleEffect('lasers')}
              >
                <Zap size={16} />
                <span>360° Downward Instrument Lasers</span>
              </button>
            </div>
          </div>

          {/* Section 2: Drums & Kicks Routing Engine */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Disc3 size={16} />
              <span>DRUMS & KICK ROUTING (SCREEN IMPACT & BLINDERS)</span>
            </h4>
            <div className="sliders-grid">
              {/* YouTube Screen Shake Intensity */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>YouTube Screen Shake</span>
                  <span className="slider-val">{(config.screenShakeIntensity ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.05"
                  value={config.screenShakeIntensity ?? 1.0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleSliderChange('screenShakeIntensity', val);
                  }}
                />
                <span className="slider-hint">Drums/kick displacement strictly on the YouTube stage screen (window stays steady)</span>
              </div>

              {/* Screen Flash Strobe Intensity */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Kick Screen Flash Strobe</span>
                  <span className="slider-val">{(config.screenFlashIntensity ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.05"
                  value={config.screenFlashIntensity ?? 1.0}
                  onChange={(e) => handleSliderChange('screenFlashIntensity', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Full-window blinder strobe flash activated on heavy kicks</span>
              </div>

              {/* Kick Sensitivity */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Kick Trigger Sensitivity</span>
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
                <span className="slider-hint">Controls drum kick threshold for flash strobing</span>
              </div>
            </div>
          </div>

          {/* Section 3: Bass Spectrum & 360° Perimeter Rig */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Waves size={16} />
              <span>BASS SPECTRUM & 360° SCREEN LIGHTS</span>
            </h4>
            <div className="sliders-grid">
              {/* 360° Perimeter Rotation Speed */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>360° Perimeter Lights Bass Speed</span>
                  <span className="slider-val">{(config.perimeterBassRotationSpeed ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={config.perimeterBassRotationSpeed ?? 1.0}
                  onChange={(e) => handleSliderChange('perimeterBassRotationSpeed', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Manipulates continuous 360° rotation speed based on bass frequency</span>
              </div>

              {/* Bass to Beam Radiance */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Bass-to-Beam Radiance</span>
                  <span className="slider-val">{config.bassToBeamIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={config.bassToBeamIntensity}
                  onChange={(e) => handleSliderChange('bassToBeamIntensity', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Modulates moving-head beam thickness, floor wash, and perimeter radiance</span>
              </div>

              {/* Screen Flash Color Saturation */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Flash Color Saturation</span>
                  <span className="slider-val">{(config.screenFlashColorSaturation ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={config.screenFlashColorSaturation ?? 1.0}
                  onChange={(e) => handleSliderChange('screenFlashColorSaturation', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Low bass produces crisp white strobe; high bass blends video thumbnail gradients</span>
              </div>

              {/* Effect Envelope Decay */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Effect Envelope Decay</span>
                  <span className="slider-val">{config.effectDecay.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={config.effectDecay}
                  onChange={(e) => handleSliderChange('effectDecay', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Shapes release decay rate for bass beams and kick flash strobing</span>
              </div>
            </div>
          </div>

          {/* Section 4: 360° Downward Instrument Lasers */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Music size={16} />
              <span>360° DOWNWARD INSTRUMENT LASERS</span>
            </h4>
            <div className="sliders-grid">
              {/* Instrumental Movement Speed */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>360° Conical Sweep Speed</span>
                  <span className="slider-val">{(config.instrumentalMovementSpeed ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={config.instrumentalMovementSpeed ?? 1.0}
                  onChange={(e) => handleSliderChange('instrumentalMovementSpeed', parseFloat(e.target.value))}
                />
                <span className="slider-hint">Higher instrumental frequency increases 360° conical rotation rate towards the stage floor</span>
              </div>

              {/* Laser Density */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Laser Beam Density</span>
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
                <span className="slider-hint">Adjusts active razor beam count from the 3 top laser stations</span>
              </div>
            </div>
          </div>

          {/* Section 5: Stage Spotlights & Palette Configuration */}
          <div className="routing-section">
            <h4 className="routing-section-heading">
              <Activity size={16} />
              <span>STAGE SPOTLIGHTS & THUMBNAIL PALETTE</span>
            </h4>
            <div className="sliders-grid">
              {/* Colouring Spotlight Active Count */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Active Spotlights</span>
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
                <span className="slider-hint">Active colour-tinted spotlights placed symmetrically on Top, Left, and Right of YouTube player</span>
              </div>

              {/* Min Spotlight Count (BPM <= 70) */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Min Spotlights (BPM ≤ 70)</span>
                  <span className="slider-val">{config.minSpotlightCount ?? 1} Fixtures</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={config.minSpotlightCount ?? 1}
                  onChange={(e) => {
                    const min = parseInt(e.target.value, 10);
                    const max = config.maxSpotlightCount ?? 7;
                    RoutingStore.getInstance().setSpotlightCountLimits(min, max);
                  }}
                />
                <span className="slider-hint">Spawn count floor for calm, low-tempo tracks below 70 BPM</span>
              </div>

              {/* Max Spotlight Count (BPM >= 160) */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Max Spotlights (BPM ≥ 160)</span>
                  <span className="slider-val">{config.maxSpotlightCount ?? 7} Fixtures</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="8"
                  step="1"
                  value={config.maxSpotlightCount ?? 7}
                  onChange={(e) => {
                    const max = parseInt(e.target.value, 10);
                    const min = config.minSpotlightCount ?? 1;
                    RoutingStore.getInstance().setSpotlightCountLimits(min, max);
                  }}
                />
                <span className="slider-hint">Spawn count ceiling for high-intensity, high-tempo tracks at or above 160 BPM</span>
              </div>

              {/* Max Brightness Limit */}
              <div className="slider-control">
                <div className="slider-label-row">
                  <span>Global Lumen Ceiling</span>
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
                <span className="slider-hint">Prevents venue overexposure and enforces global concert lumen ceiling</span>
              </div>
            </div>
          </div>

          {/* Section 6: Safety & Accessibility Controls */}
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
                <p className="safety-desc">Tones down high-contrast blinder strobing for photosensitive viewers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
