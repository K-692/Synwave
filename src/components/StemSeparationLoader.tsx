/**
 * Synwave Demucs Neural Stem Separation Loader
 * Displayed while ShazamIO recognizes audio and Demucs extracts 4 audio stems
 * (drums, bass, instruments, vocals) with animated stem meters and hardware acceleration status.
 */

import React, { useEffect, useState } from 'react';
import { Cpu, Disc3, Mic2, Music, Radio, Sparkles } from 'lucide-react';

interface StemSeparationLoaderProps {
  isVisible: boolean;
  songTitle?: string;
  songArtist?: string;
  statusText?: string;
  phase?: 'recognizing' | 'extracting';
}

export const StemSeparationLoader: React.FC<StemSeparationLoaderProps> = ({
  isVisible,
  songTitle,
  songArtist,
  statusText = 'Separating neural stems with Demucs HTDemucs...',
  phase = 'extracting',
}) => {
  const [dots, setDots] = useState('');
  const [activeStemIdx, setActiveStemIdx] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      setActiveStemIdx((prev) => (prev + 1) % 4);
    }, 450);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const stems = [
    { name: 'DRUMS / KICKS', desc: 'Kick blinders, flame cannons, screen shake', icon: Disc3, color: '#ff3366' },
    { name: 'BASS / SUB', desc: 'Top bass laser machines, stage floor wash', icon: Cpu, color: '#00f0ff' },
    { name: 'INSTRUMENTS', desc: 'Rig laser sweeps, atmospheric fill lights', icon: Music, color: '#7928ca' },
    { name: 'VOCALS', desc: 'Perimeter cross-stage scissor lights, screen glow', icon: Mic2, color: '#ffea00' },
  ];

  const isRecognizing = phase === 'recognizing';

  return (
    <div className="demucs-loader-backdrop" role="dialog" aria-modal="true" aria-label="Audio Processing Status">
      <div className="demucs-loader-card glass-panel">
        {/* Glow Header */}
        <div className="demucs-loader-header">
          <div className="demucs-badge">
            {isRecognizing ? (
              <>
                <Radio size={14} className="neon-cyan-icon animate-pulse" />
                <span>SHAZAMIO • ACOUSTIC FINGERPRINT RECOGNITION</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="neon-cyan-icon" />
                <span>DEMUCS v4 • NEURAL STEM SEPARATION</span>
              </>
            )}
          </div>

          <h2 className="demucs-title">
            {isRecognizing ? (
              `IDENTIFYING TRACK WITH SHAZAMIO${dots}`
            ) : songTitle ? (
              `EXTRACTING STAGE STEMS — ${songTitle.toUpperCase()}${dots}`
            ) : (
              `EXTRACTING STAGE STEMS${dots}`
            )}
          </h2>

          <p className="demucs-subtitle">
            {isRecognizing ? (
              <span className="demucs-recognizing-hint">
                Listening to acoustic waveform & resolving song metadata...
              </span>
            ) : songTitle ? (
              <>
                <span className="demucs-track-name">{songTitle}</span>
                {songArtist && <span className="demucs-track-artist"> — {songArtist}</span>}
              </>
            ) : (
              <span className="demucs-track-name">Preparing Demucs neural models</span>
            )}
          </p>
        </div>

        {/* 4 Stems Status Grid */}
        <div className="demucs-stems-grid">
          {stems.map((stem, idx) => {
            const Icon = stem.icon;
            const isActive = isRecognizing ? true : activeStemIdx === idx;
            return (
              <div
                key={stem.name}
                className={`demucs-stem-card ${isActive ? 'active' : ''}`}
                style={{
                  borderColor: isActive ? stem.color : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isActive ? `0 0 20px ${stem.color}33` : 'none',
                }}
              >
                <div className="stem-icon-wrapper" style={{ color: stem.color }}>
                  <Icon size={18} />
                </div>
                <div className="stem-info">
                  <div className="stem-name" style={{ color: isActive ? stem.color : '#f8fafc' }}>
                    {stem.name}
                  </div>
                  <div className="stem-desc">{stem.desc}</div>
                </div>
                <div className="stem-pulse-indicator">
                  <span
                    className={`stem-dot ${isActive ? 'pulse' : ''}`}
                    style={{ backgroundColor: stem.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Animated Progress Bar */}
        <div className="demucs-progress-wrapper">
          <div className="demucs-progress-track">
            <div className="demucs-progress-fill" />
          </div>
          <div className="demucs-status-row">
            <span className="demucs-status-label">{statusText}</span>
            <span className="demucs-acceleration-badge">APPLE MPS / GPU ACCELERATED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
