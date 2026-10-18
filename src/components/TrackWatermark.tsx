/**
 * Synwave Canvas HUD & Track Watermark
 * Elegant, cinematic on-canvas watermark that auto-fades to subtle opacity.
 */

import React, { useEffect, useState } from 'react';
import type { TrackRecord } from '../types';
import { Radio } from 'lucide-react';

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
  const [isFresh, setIsFresh] = useState(true);

  // When track changes, highlight for 5 seconds then settle into subtle watermark
  useEffect(() => {
    setIsFresh(true);
    const timer = setTimeout(() => {
      setIsFresh(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  // Clean title display (truncate if abnormally long)
  const displayTitle = currentTrack.title.length > 50
    ? `${currentTrack.title.substring(0, 48)}...`
    : currentTrack.title;

  return (
    <div className={`track-watermark-hud ${isFresh ? 'fresh' : 'subtle'}`}>
      <div className="hud-header">
        <div className="live-indicator">
          <span className={`live-dot ${isPlaying ? 'pulsing' : ''}`} />
          <Radio size={12} className="live-icon" />
          <span className="live-text">{isPlaying ? 'LIVE' : 'PAUSED'}</span>
        </div>

        {currentSection && (
          <div className="section-pill">
            <span>{currentSection}</span>
          </div>
        )}
      </div>

      <div className="hud-title-wrap">
        <h2 className="hud-title" title={currentTrack.title}>{displayTitle}</h2>
        <p className="hud-artist">{currentTrack.artist}</p>
      </div>
    </div>
  );
};
