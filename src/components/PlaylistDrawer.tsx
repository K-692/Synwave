/**
 * Synwave Playlist & Library Drawer
 * Slide-out drawer with track searching, queue management, analysis status pills, and drag-and-drop.
 */

import React, { useState } from 'react';
import {
  X,
  Search,
  Music2,
  Trash2,
  Clock,
  HardDrive,
  Sparkles,
  Play,
  Volume2,
} from 'lucide-react';
import type { TrackRecord } from '../types';

interface PlaylistDrawerProps {
  isOpen: boolean;
  tracks: TrackRecord[];
  currentTrackId?: string;
  isPlaying: boolean;
  onClose: () => void;
  onSelectTrack: (track: TrackRecord) => void;
  onClearPlaylist: () => void;
  onLoadTestTrack: () => void;
  onDropFiles: (files: FileList | File[]) => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  isOpen,
  tracks,
  currentTrackId,
  isPlaying,
  onClose,
  onSelectTrack,
  onClearPlaylist,
  onLoadTestTrack,
  onDropFiles,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const formatDuration = (secs: number): string => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredTracks = tracks.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
    );
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside
      className={`drawer-panel drawer-left glass-panel ${isOpen ? 'open' : ''} ${
        isDragOver ? 'drag-over' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drawer Header */}
      <div className="drawer-header">
        <div className="drawer-title-group">
          <Music2 size={18} className="drawer-icon" />
          <span className="drawer-title">TRACK QUEUE</span>
          <span className="drawer-badge">{tracks.length}</span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close drawer">
          <X size={18} />
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="drawer-search-bar">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        {tracks.length > 0 && (
          <button
            className="btn-icon"
            onClick={onClearPlaylist}
            title="Clear Queue"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Track List */}
      <div className="drawer-content track-list-scroll">
        {filteredTracks.length === 0 ? (
          <div className="empty-state">
            <Music2 size={40} className="empty-icon" />
            <p className="empty-title">Queue is Empty</p>
            <p className="empty-subtitle">
              Drag & drop audio files here or use the buttons in the top bar.
            </p>
            <button className="btn btn-accent mt-3" onClick={onLoadTestTrack}>
              <Sparkles size={16} />
              <span>Load Demo: Waves</span>
            </button>
          </div>
        ) : (
          filteredTracks.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <div
                key={track.id}
                className={`track-item ${isCurrent ? 'track-current' : ''}`}
                onClick={() => onSelectTrack(track)}
              >
                <div className="track-item-index">
                  {isCurrent && isPlaying ? (
                    <Volume2 size={16} className="now-playing-icon" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="track-item-info">
                  <div className="track-item-title-row">
                    <span className="track-item-title" title={track.title}>
                      {track.title}
                    </span>
                    {track.analysisStatus === 'ready' && (
                      <span className="status-badge-mini ready" title="Pre-analysis complete">
                        READY
                      </span>
                    )}
                    {track.analysisStatus === 'analysing' && (
                      <span className="status-badge-mini analysing" title="Analysing in background...">
                        ANALYSING
                      </span>
                    )}
                  </div>
                  <div className="track-item-sub-row">
                    <span className="track-item-artist">{track.artist}</span>
                    <span className="track-item-dot">•</span>
                    <span className="track-item-meta">
                      <Clock size={11} /> {formatDuration(track.duration)}
                    </span>
                    {track.sizeBytes > 0 && (
                      <>
                        <span className="track-item-dot">•</span>
                        <span className="track-item-meta">
                          <HardDrive size={11} /> {formatSize(track.sizeBytes)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="track-item-action">
                  <button className="btn-play-mini" title="Play track">
                    <Play size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drag Overlay Hint */}
      {isDragOver && (
        <div className="drag-drop-overlay">
          <Sparkles size={36} className="bounce" />
          <span>Drop to import music files into Synwave</span>
        </div>
      )}
    </aside>
  );
};
