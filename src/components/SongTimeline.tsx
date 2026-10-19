/**
 * Synwave Synchronized Song Timeline
 * 
 * Clean, minimalist interactive progress slider:
 * - Ultra-sleek glowing timeline track (bar spectrum removed per user request)
 * - Active playhead progress fill with glowing thumb handle
 * - Clickable & draggable seekbar with hover timestamp tooltip
 */

import React, { useState, useRef } from 'react';
import type { TrackAnalysis } from '../types';

interface SongTimelineProps {
  currentTime: number;
  duration: number;
  analysis?: TrackAnalysis | null;
  onSeek: (timeSeconds: number) => void;
}

export const SongTimeline: React.FC<SongTimelineProps> = ({
  currentTime,
  duration,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const dur = duration > 0 ? duration : 240;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / dur) * 100));

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * dur);
    setHoverX(e.clientX - rect.left);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * dur);
  };

  return (
    <div
      ref={containerRef}
      className="synwave-song-timeline clean-slider"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverTime(null)}
      title="Click anywhere to seek track position"
    >
      {/* Background Track Rail */}
      <div className="timeline-rail">
        {/* Active Playhead Progress Fill */}
        <div className="timeline-progress-fill" style={{ width: `${progressPercent}%` }}>
          <div className="timeline-playhead-handle" />
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoverTime !== null && (
        <div className="timeline-hover-indicator" style={{ left: `${hoverX}px` }}>
          <div className="timeline-hover-line" />
          <div className="timeline-hover-badge">{formatTime(hoverTime)}</div>
        </div>
      )}
    </div>
  );
};
