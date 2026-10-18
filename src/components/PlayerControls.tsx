/**
 * Synwave Transport & Player Controls
 * Bottom dock attached to window bottom edge with auto-hide behavior.
 */

import React, { useState, useEffect } from 'react';
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
  Maximize2,
  Minimize2,
  Disc3,
  Cpu,
} from 'lucide-react';
import type { QualityPreset, RepeatMode, TrackRecord } from '../types';
import { SongTimeline } from './SongTimeline';

interface PlayerControlsProps {
  currentTrack: TrackRecord | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentSection?: string;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  quality: QualityPreset;
  isVisible: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onSelectQuality: (quality: QualityPreset) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  currentSection,
  volume,
  isMuted,
  shuffle,
  repeatMode,
  quality,
  isVisible,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onSelectQuality,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFull) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  return (
    <div
      className={`player-dock glass-panel ${isVisible ? 'visible' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Synchronized Song Timeline with Waveform Peaks & Section Zones */}
      <SongTimeline
        currentTime={currentTime}
        duration={duration}
        analysis={currentTrack?.analysis}
        currentSection={currentSection}
        onSeek={onSeek}
      />

      <div className="dock-content">
        {/* Left: Track Information */}
        <div className="dock-left">
          <div className={`track-disc ${isPlaying ? 'spinning' : ''}`}>
            <Disc3 size={32} className="disc-icon" />
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

        {/* Right: Sound & Display Utilities */}
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

          {/* Quality Preset */}
          <div className="quality-selector-wrap" title="Render Quality Preset">
            <Cpu size={15} className="quality-icon" />
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
