/**
 * Synwave Audio & Visual Inspector Drawer
 * Real-time audio telemetry, 64-band FFT canvas, oscilloscope, and procedural effect toggles.
 */

import React, { useEffect, useRef } from 'react';
import {
  X,
  Activity,
  Sliders,
  Layers,
  Zap,
  Gauge,
  Eye,
} from 'lucide-react';
import type { AudioFeatures, VisualSettings } from '../types';

interface InspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  getLiveFeatures: () => AudioFeatures;
  settings: VisualSettings;
  onUpdateSettings: (settings: Partial<VisualSettings>) => void;
  effectsList: { id: string; name: string; family: string; enabled: boolean }[];
  onToggleEffect: (id: string) => void;
  currentSection: string;
  detectedBpm: number;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  isOpen,
  onClose,
  getLiveFeatures,
  settings,
  onUpdateSettings,
  effectsList,
  onToggleEffect,
  currentSection,
  detectedBpm,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  // Meter refs to update DOM directly for 60fps performance without React re-render lag
  const rmsMeterRef = useRef<HTMLDivElement>(null);
  const bassMeterRef = useRef<HTMLDivElement>(null);
  const midMeterRef = useRef<HTMLDivElement>(null);
  const trebleMeterRef = useRef<HTMLDivElement>(null);
  const centroidMeterRef = useRef<HTMLDivElement>(null);
  const beatPillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let animId: number;

    const renderTelemetry = () => {
      const features = getLiveFeatures();

      // 1. Update Gauges
      if (rmsMeterRef.current) {
        rmsMeterRef.current.style.width = `${Math.min(100, features.rms * 100)}%`;
      }
      if (bassMeterRef.current) {
        bassMeterRef.current.style.width = `${Math.min(100, features.bass * 100)}%`;
      }
      if (midMeterRef.current) {
        midMeterRef.current.style.width = `${Math.min(100, features.lowMid * 100)}%`;
      }
      if (trebleMeterRef.current) {
        trebleMeterRef.current.style.width = `${Math.min(100, features.treble * 100)}%`;
      }
      if (centroidMeterRef.current) {
        centroidMeterRef.current.style.width = `${Math.min(100, features.spectralCentroid * 100)}%`;
      }
      if (beatPillRef.current) {
        if (features.isBeat) {
          beatPillRef.current.classList.add('flash-beat');
        } else {
          beatPillRef.current.classList.remove('flash-beat');
        }
      }

      // 2. Render FFT Spectrum Canvas
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const ctx = specCanvas.getContext('2d');
        if (ctx) {
          const w = specCanvas.width;
          const h = specCanvas.height;
          ctx.clearRect(0, 0, w, h);

          const barCount = 48;
          const barWidth = w / barCount - 1;
          const step = Math.floor(features.frequencyData.length / barCount / 2);

          for (let i = 0; i < barCount; i++) {
            const val = features.frequencyData[i * step] / 255;
            const barHeight = val * h;
            const x = i * (barWidth + 1);

            const grad = ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, '#00f0ff');
            grad.addColorStop(0.6, '#b800ff');
            grad.addColorStop(1, '#ff007f');

            ctx.fillStyle = grad;
            ctx.fillRect(x, h - barHeight, barWidth, barHeight);
          }
        }
      }

      // 3. Render Oscilloscope Waveform Canvas
      const waveCanvas = waveCanvasRef.current;
      if (waveCanvas) {
        const ctx = waveCanvas.getContext('2d');
        if (ctx) {
          const w = waveCanvas.width;
          const h = waveCanvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.lineWidth = 2;
          ctx.strokeStyle = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00f0ff';
          ctx.beginPath();

          const sliceWidth = w / features.timeDomainData.length;
          let x = 0;

          for (let i = 0; i < features.timeDomainData.length; i++) {
            const v = features.timeDomainData[i] / 128.0;
            const y = (v * h) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      animId = requestAnimationFrame(renderTelemetry);
    };

    animId = requestAnimationFrame(renderTelemetry);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, getLiveFeatures]);

  return (
    <aside className={`drawer-panel drawer-right glass-panel ${isOpen ? 'open' : ''}`}>
      <div className="drawer-header">
        <div className="drawer-title-group">
          <Activity size={18} className="drawer-icon" />
          <span className="drawer-title">SIGNAL & VISUAL INSPECTOR</span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close inspector">
          <X size={18} />
        </button>
      </div>

      <div className="drawer-content inspector-scroll">
        {/* Section 1: Live Telemetry */}
        <div className="inspector-section">
          <div className="section-title">
            <Gauge size={15} />
            <span>REAL-TIME AUDIO SIGNALS</span>
          </div>

          {/* Status Badges */}
          <div className="inspector-badges-row">
            <div className="metric-chip">
              <span className="chip-label">BPM</span>
              <span className="chip-value">{detectedBpm > 0 ? detectedBpm : '128 (EST)'}</span>
            </div>

            <div className="metric-chip">
              <span className="chip-label">SECTION</span>
              <span className="chip-value text-accent">{currentSection || 'ACTIVE'}</span>
            </div>

            <div ref={beatPillRef} className="beat-indicator-pill">
              <Zap size={12} />
              <span>BEAT</span>
            </div>
          </div>

          {/* Real-time Spectrum Visualizer */}
          <div className="telemetry-box">
            <div className="telemetry-label">FREQUENCY SPECTRUM (FFT 2048)</div>
            <canvas ref={spectrumCanvasRef} width={280} height={70} className="telemetry-canvas" />
          </div>

          {/* Real-time Oscilloscope */}
          <div className="telemetry-box">
            <div className="telemetry-label">OSCILLOSCOPE (PCM TIME-DOMAIN)</div>
            <canvas ref={waveCanvasRef} width={280} height={50} className="telemetry-canvas" />
          </div>

          {/* Frequency Meters */}
          <div className="meters-grid">
            <div className="meter-row">
              <span className="meter-label">LOUDNESS (RMS)</span>
              <div className="meter-track">
                <div ref={rmsMeterRef} className="meter-fill meter-cyan" />
              </div>
            </div>

            <div className="meter-row">
              <span className="meter-label">SUB / BASS (20-250 Hz)</span>
              <div className="meter-track">
                <div ref={bassMeterRef} className="meter-fill meter-magenta" />
              </div>
            </div>

            <div className="meter-row">
              <span className="meter-label">MID-RANGE (250-2kHz)</span>
              <div className="meter-track">
                <div ref={midMeterRef} className="meter-fill meter-amber" />
              </div>
            </div>

            <div className="meter-row">
              <span className="meter-label">TREBLE (2k-16kHz)</span>
              <div className="meter-track">
                <div ref={trebleMeterRef} className="meter-fill meter-blue" />
              </div>
            </div>

            <div className="meter-row">
              <span className="meter-label">SPECTRAL BRIGHTNESS</span>
              <div className="meter-track">
                <div ref={centroidMeterRef} className="meter-fill meter-green" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Visual Parameters */}
        <div className="inspector-section">
          <div className="section-title">
            <Sliders size={15} />
            <span>CHOREOGRAPHY PARAMETERS</span>
          </div>

          {/* Effect Intensity */}
          <div className="slider-control-group">
            <div className="slider-label-row">
              <span>Effect Intensity</span>
              <span className="slider-value">{settings.effectIntensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.effectIntensity}
              onChange={(e) => onUpdateSettings({ effectIntensity: parseFloat(e.target.value) })}
              className="range-slider"
            />
          </div>

          {/* Camera Motion Speed */}
          <div className="slider-control-group">
            <div className="slider-label-row">
              <span>Camera Orbit Speed</span>
              <span className="slider-value">{settings.cameraSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={settings.cameraSpeed}
              onChange={(e) => onUpdateSettings({ cameraSpeed: parseFloat(e.target.value) })}
              className="range-slider"
            />
          </div>
        </div>

        {/* Section 3: Effect Modules Toggle */}
        <div className="inspector-section">
          <div className="section-title">
            <Layers size={15} />
            <span>MODULAR EFFECT CATALOGUE</span>
          </div>

          <div className="effects-toggle-list">
            {effectsList.map((effect) => (
              <label key={effect.id} className="effect-toggle-item">
                <input
                  type="checkbox"
                  checked={effect.enabled}
                  onChange={() => onToggleEffect(effect.id)}
                  className="checkbox-custom"
                />
                <div className="effect-toggle-info">
                  <span className="effect-name">{effect.name}</span>
                  <span className="effect-family">{effect.family}</span>
                </div>
                <Eye size={14} className={`effect-eye ${effect.enabled ? 'active' : ''}`} />
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
