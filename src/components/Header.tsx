/**
 * Synwave Header Component
 * Top navigation bar with file/folder pickers, quick demo track loader, and drawer toggles.
 */

import React, { useRef } from 'react';
import {
  FolderOpen,
  FileAudio,
  Sliders,
  ListMusic,
  Activity,
  Sparkles,
} from 'lucide-react';
import type { AnalysisStatus } from '../types';

interface HeaderProps {
  currentTrackTitle?: string;
  analysisStatus: AnalysisStatus;
  isPlaylistOpen: boolean;
  isInspectorOpen: boolean;
  onTogglePlaylist: () => void;
  onToggleInspector: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onLoadTestTrack: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTrackTitle,
  analysisStatus,
  isPlaylistOpen,
  isInspectorOpen,
  onTogglePlaylist,
  onToggleInspector,
  onFilesSelected,
  onLoadTestTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  const getStatusBadge = () => {
    switch (analysisStatus) {
      case 'analysing':
        return <span className="status-badge status-analysing"><Activity size={12} className="spin" /> ANALYSING</span>;
      case 'ready':
        return <span className="status-badge status-ready"><Sparkles size={12} /> SYNC READY</span>;
      case 'partial':
        return <span className="status-badge status-partial">LIVE FALLBACK</span>;
      default:
        return null;
    }
  };

  return (
    <header className="synwave-header glass-panel">
      {/* Brand */}
      <div className="header-brand">
        <div className="brand-logo">
          <img src="/icon.png" alt="Synwave App Icon" className="brand-logo-img" />
          <div className="brand-pulse-ring" />
        </div>
        <div className="brand-text">
          <span className="brand-title">SYNWAVE</span>
          <span className="brand-subtitle">
            {currentTrackTitle ? `PLAYING: ${currentTrackTitle.toUpperCase()}` : 'PROCEDURAL VISUALIZER'}
          </span>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        multiple
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileChange}
        // @ts-expect-error webkitdirectory is standard for folder picking in Chromium/Webkit
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: 'none' }}
      />

      {/* Center Actions */}
      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          title="Open audio file from local disk"
        >
          <FileAudio size={16} />
          <span>Open File</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => folderInputRef.current?.click()}
          title="Import music folder"
        >
          <FolderOpen size={16} />
          <span>Open Folder</span>
        </button>

        <button
          className="btn btn-accent"
          onClick={onLoadTestTrack}
          title="Load test track from My Music folder"
        >
          <Sparkles size={16} />
          <span>My Music: Waves</span>
        </button>

        {getStatusBadge()}
      </div>

      {/* Right Drawer Toggles */}
      <div className="header-toggles">
        <button
          className={`btn-icon ${isPlaylistOpen ? 'active' : ''}`}
          onClick={onTogglePlaylist}
          title="Toggle Playlist & Library"
        >
          <ListMusic size={19} />
        </button>

        <button
          className={`btn-icon ${isInspectorOpen ? 'active' : ''}`}
          onClick={onToggleInspector}
          title="Toggle Audio & Visual Inspector"
        >
          <Sliders size={19} />
        </button>
      </div>
    </header>
  );
};
