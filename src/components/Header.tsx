/**
 * Synwave Header Component
 * Top navigation bar attached to window edge with auto-hide behavior.
 */

import React, { useRef } from 'react';
import {
  FolderOpen,
  FileAudio,
  Sliders,
  ListMusic,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';

interface HeaderProps {
  currentTrackTitle?: string;
  isPlaylistOpen: boolean;
  isInspectorOpen: boolean;
  isRoutingOpen?: boolean;
  isDiagnosticOpen?: boolean;
  activeProfileName?: string;
  isVisible: boolean;
  onTogglePlaylist: () => void;
  onToggleInspector: () => void;
  onToggleRouting?: () => void;
  onToggleDiagnostic?: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTrackTitle,
  isPlaylistOpen,
  isInspectorOpen,
  isRoutingOpen = false,
  isDiagnosticOpen = false,
  activeProfileName,
  isVisible,
  onTogglePlaylist,
  onToggleInspector,
  onToggleRouting,
  onToggleDiagnostic,
  onFilesSelected,
  onMouseEnter,
  onMouseLeave,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <header
      className={`synwave-header glass-panel ${isVisible || isPlaylistOpen || isInspectorOpen || isRoutingOpen || isDiagnosticOpen ? 'visible' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Brand */}
      <div className="header-brand">
        <div className="brand-logo">
          <img src="/icon.png" alt="Synwave App Icon" className="brand-logo-img" />
          <div className="brand-pulse-ring" />
        </div>
        <div className="brand-text">
          <span className="brand-title">SYNWAVE</span>
          {currentTrackTitle && (
            <span className="brand-subtitle" title={currentTrackTitle}>
              {currentTrackTitle.length > 32
                ? `${currentTrackTitle.substring(0, 32)}...`
                : currentTrackTitle}
            </span>
          )}
        </div>

        {/* Active Stage Profile Badge */}
        {activeProfileName && (
          <div
            className="header-profile-badge"
            onClick={onToggleRouting}
            title="Active Stage Profile (Click to open Routing Console)"
          >
            <span className="profile-indicator-dot" />
            <span>{activeProfileName}</span>
          </div>
        )}
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
      </div>

      {/* Right Drawer & Console Toggles */}
      <div className="header-toggles">
        {onToggleRouting && (
          <button
            className={`btn-icon ${isRoutingOpen ? 'active' : ''}`}
            onClick={onToggleRouting}
            title="Audio-to-Visual Routing Console (Hotkey: C)"
          >
            <SlidersHorizontal size={18} />
          </button>
        )}

        {onToggleDiagnostic && (
          <button
            className={`btn-icon ${isDiagnosticOpen ? 'active' : ''}`}
            onClick={onToggleDiagnostic}
            title="Real-Time Telemetry & Synchronization HUD (Hotkey: D)"
          >
            <Activity size={18} />
          </button>
        )}

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
