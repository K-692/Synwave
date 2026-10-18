/**
 * Synwave Transport & Player Controls
 * Bottom dock featuring seek bar with section markers, transport controls,
 * volume, palette selector, quality presets, and screenshot capture.
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Camera,
  Maximize2,
  Minimize2,
  Palette,
  Disc3,
  Cpu,
  Compass,
} from 'lucide-react';
import type { DirectorMode, QualityPreset, RepeatMode, TrackRecord } from '../types';
import { COLOR_PALETTES } from '../visualizer/palettes';

interface PlayerControlsProps {
  currentTrack: TrackRecord | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  selectedPaletteId: string;
  quality: QualityPreset;
  directorMode: DirectorMode;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onSelectPalette: (paletteId: string) => void;
  onSelectQuality: (quality: QualityPreset) => void;
  onToggleDirectorMode: () => void;
  onTakeSnapshot: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeatMode,
  selectedPaletteId,
  quality,
  directorMode,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onSelectPalette,
  onSelectQuality,
  onToggleDirectorMode,
  onTakeSnapshot,
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverPosition(e.clientX - rect.left);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="player-dock glass-panel">
      {/* Seek Progress Bar with Section Indicators */}
      <div
        className="seek-bar-container"
        onMouseMove={handleSeekMouseMove}
        onMouseLeave={() => setHoverTime(null)}
        onClick={handleSeekClick}
      >
        <div className="seek-track">
          <div
            className="seek-progress"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Render section markers if pre-analyzed */}
          {currentTrack?.analysis?.sections.map((sec, idx) => (
            <div
              key={idx}
              className={`section-marker marker-${sec.type}`}
              style={{ left: `${(sec.startTime / (duration || 1)) * 100}%` }}
              title={`${sec.label} (${formatTime(sec.startTime)})`}
            />
          ))}

          {/* Thumb handle */}
          <div
            className="seek-thumb"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Hover Time Tooltip */}
        {hoverTime !== null && (
          <div
            className="seek-tooltip"
            style={{ left: `${hoverPosition}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      <div className="dock-content">
        {/* Left: Track Information */}
        <div className="dock-left">
          <div className={`track-disc ${isPlaying ? 'spinning' : ''}`}>
            <Disc3 size={34} className="disc-icon" />
            <div className="disc-center" />
          </div>
          <div className="track-meta">
            <span className="track-title" title={currentTrack?.title || 'No Track Selected'}>
              {currentTrack?.title || 'Ready to Play'}
            </span>
            <span className="track-artist">
              {currentTrack?.artist || 'Synwave Audio Visualizer'}
            </span>
          </div>
        </div>

        {/* Center: Transport Controls */}
        <div className="dock-center">
          <div className="transport-buttons">
            <button
              className={`btn-control-icon ${shuffle ? 'active' : ''}`}
              onClick={onToggleShuffle}
              title="Shuffle queue"
            >
              <Shuffle size={16} />
            </button>

            <button
              className="btn-control-icon"
              onClick={onPrevious}
              title="Previous Track"
            >
              <SkipBack size={18} />
            </button>

            <button
              className="btn-play-pause"
              onClick={onPlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="play-icon-offset" />}
            </button>

            <button
              className="btn-control-icon"
              onClick={onNext}
              title="Next Track"
            >
              <SkipForward size={18} />
            </button>

            <button
              className={`btn-control-icon ${repeatMode !== 'off' ? 'active' : ''}`}
              onClick={onToggleRepeat}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span className="time-sep">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Sound, Visual Controls & Utilities */}
        <div className="dock-right">
          {/* Volume */}
          <div className="volume-control">
            <button
              className="btn-control-icon"
              onClick={onToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>

          {/* Director Mode Pill */}
          <button
            className={`btn-pill ${directorMode === 'auto' ? 'active' : ''}`}
            onClick={onToggleDirectorMode}
            title="Toggle Autonomous Director Mode (AI dynamic camera & effect transitions)"
          >
            <Compass size={14} />
            <span>{directorMode === 'auto' ? 'DIRECTOR: AUTO' : 'DIRECTOR: MANUAL'}</span>
          </button>

          {/* Color Palette Selector */}
          <div className="palette-selector-wrap" title="Select Color Scheme">
            <Palette size={16} className="palette-icon" />
            <select
              value={selectedPaletteId}
              onChange={(e) => onSelectPalette(e.target.value)}
              className="dock-select"
            >
              {COLOR_PALETTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Preset */}
          <div className="quality-selector-wrap" title="Render Quality Preset">
            <Cpu size={16} className="quality-icon" />
            <select
              value={quality}
              onChange={(e) => onSelectQuality(e.target.value as QualityPreset)}
              className="dock-select"
            >
              <option value="low">Low (Battery)</option>
              <option value="medium">Medium</option>
              <option value="high">High (60 FPS)</option>
              <option value="ultra">Ultra (Max GPU)</option>
            </select>
          </div>

          {/* Snapshot Button */}
          <button
            className="btn-control-icon"
            onClick={onTakeSnapshot}
            title="Take High-Resolution Screenshot Snapshot"
          >
            <Camera size={17} />
          </button>

          {/* Fullscreen */}
          <button
            className="btn-control-icon"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
};
