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
} from 'lucide-react';

interface HeaderProps {
  currentTrackTitle?: string;
  isPlaylistOpen: boolean;
  isInspectorOpen: boolean;
  isVisible: boolean;
  onTogglePlaylist: () => void;
  onToggleInspector: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTrackTitle,
  isPlaylistOpen,
  isInspectorOpen,
  isVisible,
  onTogglePlaylist,
  onToggleInspector,
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
      className={`synwave-header glass-panel ${isVisible || isPlaylistOpen || isInspectorOpen ? 'visible' : ''}`}
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
              {currentTrackTitle.length > 36
                ? `${currentTrackTitle.substring(0, 36)}...`
                : currentTrackTitle}
            </span>
          )}
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
