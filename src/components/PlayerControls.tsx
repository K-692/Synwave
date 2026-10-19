/**
 * Synwave Transport & Player Controls
 * Floating bottom control pills directly over the 3D stage window (zero solid container background).
 * Includes:
 * - Minimalist sleek seek slider
 * - YouTube API track info button ('i') beside song name with metadata modal
 * - Dynamic ready play button that prominently appears when loading finishes
 * - Apple Silicon MPS hardware accelerated quality preset
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
  Info,
  X,
  ExternalLink,
  Calendar,
  User,
  Music,
  Video,
} from 'lucide-react';
import type { QualityPreset, RepeatMode, TrackRecord } from '../types';
import { SongTimeline } from './SongTimeline';

interface PlayerControlsProps {
  currentTrack: TrackRecord | null;
  videoTitle?: string;
  isPlaying: boolean;
  isAudioReady?: boolean;
  isVideoReady?: boolean;
  isVideoLoading?: boolean;
  currentTime: number;
  duration: number;
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
  videoTitle,
  isPlaying,
  isAudioReady = true,
  isVideoReady = true,
  isVideoLoading = false,
  currentTime,
  duration,
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
  const [showInfoModal, setShowInfoModal] = useState(false);

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

  const isPlayAllowed = !isVideoLoading && (isVideoReady || !currentTrack) && isAudioReady;

  return (
    <>
      <div
        className={`player-dock floating-dock ${isVisible ? 'visible' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Minimalist Floating Seek Slider */}
        <div className="dock-timeline-wrapper">
          <SongTimeline
            currentTime={currentTime}
            duration={duration}
            analysis={currentTrack?.analysis}
            onSeek={onSeek}
          />
        </div>

        <div className="dock-content">
          {/* Left: Floating Track Pill with 'i' Info Button */}
          <div className="dock-left floating-pill">
            <div className={`track-disc ${isPlaying ? 'spinning' : ''}`}>
              <Disc3 size={30} className="disc-icon" />
              <div className="disc-center" />
            </div>
            <div className="track-meta">
              <div className="track-title-row">
                <span className="track-title" title={currentTrack?.title || 'No Track Selected'}>
                  {currentTrack?.title || 'Ready to Play'}
                </span>
                {currentTrack && (
                  <button
                    className="btn-track-info-icon"
                    onClick={() => setShowInfoModal(true)}
                    title="View Official YouTube Track Metadata"
                  >
                    <Info size={14} />
                  </button>
                )}
              </div>
              <span className="track-artist">
                {currentTrack?.artist || 'Select or Drop Audio to Begin'}
              </span>
              {videoTitle && (
                <div className="track-video-indicator" title={`Synchronized Stage Video: ${videoTitle}`}>
                  <Video size={10} className="video-indicator-icon" />
                  <span className="video-indicator-title">{videoTitle}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Floating Transport Capsule */}
          <div className="dock-center floating-pill">
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

              {/* Prominent Play Button - Glows ready when loading finishes */}
              <button
                className={`btn-play-pause ${!isPlayAllowed ? 'disabled' : ''} ${!isPlaying && isPlayAllowed && currentTrack ? 'ready-pulse' : ''}`}
                onClick={isPlayAllowed ? onPlayPause : undefined}
                disabled={!isPlayAllowed}
                title={
                  !isPlayAllowed
                    ? isVideoLoading
                      ? 'Loading stage video... Please wait'
                      : !isAudioReady
                      ? 'Loading audio track... Please wait'
                      : 'Preparing media...'
                    : isPlaying
                    ? 'Pause'
                    : 'Play'
                }
              >
                {isVideoLoading ? (
                  <div className="btn-play-spinner" />
                ) : isPlaying ? (
                  <Pause size={22} />
                ) : (
                  <Play size={22} className="play-icon-offset" />
                )}
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

          {/* Right: Floating Utilities Pill */}
          <div className="dock-right floating-pill">
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

            {/* Quality Preset - Apple Silicon MPS / GPU */}
            <div className="quality-selector-wrap" title="Render Quality Preset (Apple Silicon MPS / GPU Accelerated)">
              <Cpu size={15} className="quality-icon" />
              <select
                value={quality}
                onChange={(e) => onSelectQuality(e.target.value as QualityPreset)}
                className="dock-select"
              >
                <option value="low">Low (Battery Saver)</option>
                <option value="medium">60 FPS (CPU Standard)</option>
                <option value="high">Apple Silicon MPS (Accelerated)</option>
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

      {/* YouTube Music Metadata Information Modal */}
      {showInfoModal && currentTrack && (
        <div className="synwave-info-modal-backdrop" onClick={() => setShowInfoModal(false)}>
          <div className="synwave-info-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <div className="info-header-title">
                <Music size={18} className="neon-cyan-icon" />
                <h3>YOUTUBE MUSIC METADATA</h3>
              </div>
              <button
                className="btn-icon btn-sm"
                onClick={() => setShowInfoModal(false)}
                title="Close Metadata Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="info-modal-body">
              <div className="info-field">
                <span className="info-label">
                  <Music size={14} /> MUSIC NAME
                </span>
                <span className="info-value highlight">{currentTrack.title}</span>
              </div>

              <div className="info-field">
                <span className="info-label">
                  <User size={14} /> ARTIST / CHANNEL
                </span>
                <span className="info-value">{currentTrack.artist}</span>
              </div>

              {videoTitle && (
                <div className="info-field">
                  <span className="info-label">
                    <Video size={14} /> STAGE VIDEO MATCH
                  </span>
                  <span className="info-value highlight-cyan">{videoTitle}</span>
                </div>
              )}

              <div className="info-field">
                <span className="info-label">PRODUCER</span>
                <span className="info-value">{currentTrack.producer || 'Official Production'}</span>
              </div>

              <div className="info-field">
                <span className="info-label">
                  <Calendar size={14} /> RELEASE DATE
                </span>
                <span className="info-value">{currentTrack.releaseDate || 'N/A'}</span>
              </div>

              {currentTrack.youtubeVideoId && (
                <div className="info-field">
                  <span className="info-label">YOUTUBE SOURCE</span>
                  <a
                    href={`https://www.youtube.com/watch?v=${currentTrack.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="info-link"
                  >
                    <span>Watch on YouTube</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {currentTrack.description && (
                <div className="info-field desc-field">
                  <span className="info-label">DESCRIPTION & CREDITS</span>
                  <p className="info-desc">{currentTrack.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
