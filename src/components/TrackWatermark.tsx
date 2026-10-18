/**
 * Synwave Canvas HUD & Track Watermark
 * On-canvas overlay showing the song title, artist, live beat flash indicator, and current section badge.
 */

import React from 'react';
import type { TrackRecord } from '../types';
import { Sparkles, Radio } from 'lucide-react';

interface TrackWatermarkProps {
  currentTrack: TrackRecord | null;
  currentSection: string;
  isPlaying: boolean;
}

export const TrackWatermark: React.FC<TrackWatermarkProps> = ({
  currentTrack,
  currentSection,
  isPlaying,
}) => {
  if (!currentTrack) return null;

  return (
    <div className="track-watermark-hud">
      <div className="hud-header">
        <div className="live-indicator">
          <span className={`live-dot ${isPlaying ? 'pulsing' : ''}`} />
          <Radio size={13} className="live-icon" />
          <span className="live-text">{isPlaying ? 'LIVE AUDIO' : 'PAUSED'}</span>
        </div>

        {currentSection && (
          <div className="section-pill">
            <Sparkles size={11} />
            <span>{currentSection}</span>
          </div>
        )}
      </div>

      <div className="hud-title-wrap">
        <h1 className="hud-title">{currentTrack.title}</h1>
        <p className="hud-artist">{currentTrack.artist}</p>
      </div>
    </div>
  );
};
