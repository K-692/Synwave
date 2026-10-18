/**
 * Synwave Synchronized Song Timeline
 * 
 * Interactive track timeline displaying:
 * - Waveform amplitude silhouette
 * - Detected beat & bar tick marks
 * - Colored section blocks (INTRO, VERSE, BUILDUP, DROP, BREAKDOWN, OUTRO)
 * - Clickable seekbar with hover timestamp tooltip
 * - Visual cue indicators for drops and major stage events
 */

import React, { useState, useRef, useMemo } from 'react';
import type { TrackAnalysis, SectionEvent } from '../types';

interface SongTimelineProps {
  currentTime: number;
  duration: number;
  analysis?: TrackAnalysis | null;
  currentSection?: string;
  onSeek: (timeSeconds: number) => void;
}

export const SongTimeline: React.FC<SongTimelineProps> = ({
  currentTime,
  duration,
  analysis,
  currentSection,
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

  // Pre-generate waveform columns from analysis or fallback envelope
  const waveformBars = useMemo(() => {
    const barCount = 120;
    const bars: number[] = [];

    if (analysis && analysis.frames && analysis.frames.length > 0) {
      const step = analysis.frames.length / barCount;
      for (let i = 0; i < barCount; i++) {
        const frameIndex = Math.min(analysis.frames.length - 1, Math.floor(i * step));
        const frame = analysis.frames[frameIndex];
        bars.push(Math.max(0.12, Math.min(1.0, frame.rms * 0.7 + frame.bass * 0.3)));
      }
    } else {
      // Procedural synthetic festival structure curve
      for (let i = 0; i < barCount; i++) {
        const norm = i / barCount;
        let h = 0.25;
        if (norm < 0.12) h = 0.2 + norm * 0.5; // Intro
        else if (norm < 0.35) h = 0.45 + Math.sin(i * 0.8) * 0.15; // Verse 1
        else if (norm < 0.48) h = 0.35 + (norm - 0.35) * 4.0; // Buildup 1
        else if (norm < 0.65) h = 0.85 + Math.sin(i * 1.2) * 0.15; // DROP 1
        else if (norm < 0.75) h = 0.25 + Math.sin(i * 0.4) * 0.1; // Breakdown
        else if (norm < 0.85) h = 0.4 + (norm - 0.75) * 4.5; // Buildup 2
        else if (norm < 0.95) h = 0.92 + Math.sin(i * 1.5) * 0.08; // DROP 2
        else h = 0.2; // Outro
        bars.push(Math.max(0.12, Math.min(1.0, h)));
      }
    }
    return bars;
  }, [analysis]);

  // Section segments
  const sections: SectionEvent[] = useMemo(() => {
    if (analysis && analysis.sections && analysis.sections.length > 0) {
      return analysis.sections;
    }
    // Default estimated section layout for duration
    return [
      { startTime: 0, endTime: dur * 0.12, type: 'intro', label: 'INTRO', energyLevel: 0.3 },
      { startTime: dur * 0.12, endTime: dur * 0.36, type: 'breakdown', label: 'VERSE', energyLevel: 0.5 },
      { startTime: dur * 0.36, endTime: dur * 0.48, type: 'build', label: 'BUILDUP', energyLevel: 0.75 },
      { startTime: dur * 0.48, endTime: dur * 0.68, type: 'drop', label: 'DROP 1', energyLevel: 1.0 },
      { startTime: dur * 0.68, endTime: dur * 0.78, type: 'breakdown', label: 'BREAKDOWN', energyLevel: 0.4 },
      { startTime: dur * 0.78, endTime: dur * 0.92, type: 'drop', label: 'DROP 2', energyLevel: 1.0 },
      { startTime: dur * 0.92, endTime: dur, type: 'outro', label: 'OUTRO', energyLevel: 0.25 },
    ];
  }, [analysis, dur]);

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

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'drop':
        return 'rgba(255, 0, 85, 0.25)';
      case 'build':
        return 'rgba(255, 170, 0, 0.22)';
      case 'intro':
        return 'rgba(56, 189, 248, 0.18)';
      case 'breakdown':
        return 'rgba(168, 85, 247, 0.18)';
      case 'outro':
        return 'rgba(99, 102, 241, 0.18)';
      default:
        return 'rgba(255, 255, 255, 0.08)';
    }
  };

  const getSectionBorderColor = (type: string) => {
    switch (type) {
      case 'drop':
        return 'rgba(255, 0, 85, 0.6)';
      case 'build':
        return 'rgba(255, 170, 0, 0.5)';
      case 'intro':
        return 'rgba(56, 189, 248, 0.4)';
      case 'breakdown':
        return 'rgba(168, 85, 247, 0.4)';
      default:
        return 'rgba(255, 255, 255, 0.15)';
    }
  };

  return (
    <div
      ref={containerRef}
      className="synwave-song-timeline"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverTime(null)}
      title="Click anywhere to seek track position"
    >
      {/* 1. Colored Section Background Blocks */}
      <div className="timeline-sections-layer">
        {sections.map((sec, idx) => {
          const leftPct = (sec.startTime / dur) * 100;
          const widthPct = Math.max(1, ((sec.endTime - sec.startTime) / dur) * 100);
          return (
            <div
              key={idx}
              className="timeline-section-block"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: getSectionColor(sec.type),
                borderRight: `1px solid ${getSectionBorderColor(sec.type)}`,
              }}
            >
              <span className="timeline-section-label">{sec.label}</span>
            </div>
          );
        })}
      </div>

      {/* 2. Waveform Amplitude Peak Bars */}
      <div className="timeline-waveform-layer">
        {waveformBars.map((amp, i) => {
          const barPct = (i / waveformBars.length) * 100;
          const isPlayed = barPct <= progressPercent;
          return (
            <div
              key={i}
              className={`waveform-bar ${isPlayed ? 'played' : ''}`}
              style={{
                height: `${Math.round(amp * 100)}%`,
              }}
            />
          );
        })}
      </div>

      {/* 3. Active Playhead Progress Fill */}
      <div className="timeline-progress-fill" style={{ width: `${progressPercent}%` }}>
        <div className="timeline-playhead-handle" />
      </div>

      {/* 4. Hover Tooltip */}
      {hoverTime !== null && (
        <div className="timeline-hover-indicator" style={{ left: `${hoverX}px` }}>
          <div className="timeline-hover-line" />
          <div className="timeline-hover-badge">{formatTime(hoverTime)}</div>
        </div>
      )}

      {/* Active Section Tag Pill */}
      {currentSection && (
        <div className="timeline-current-section-badge">
          {currentSection}
        </div>
      )}
    </div>
  );
};
