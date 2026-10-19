/**
 * Synwave Header Component
 * Top navigation bar attached to window edge with auto-hide behavior.
 * Includes the Load Audio File container relocated to the top bar.
 */

import React, { useRef, useState } from 'react';
import {
  Activity,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';

interface HeaderProps {
  currentTrackTitle?: string;
  isRoutingOpen?: boolean;
  isDiagnosticOpen?: boolean;
  activeProfileName?: string;
  isVisible: boolean;
  onToggleRouting?: () => void;
  onToggleDiagnostic?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFilesSelected?: (files: FileList | File[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTrackTitle,
  isRoutingOpen = false,
  isDiagnosticOpen = false,
  activeProfileName,
  isVisible,
  onToggleRouting,
  onToggleDiagnostic,
  onMouseEnter,
  onMouseLeave,
  onFilesSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <header
      className={`synwave-header glass-panel ${isVisible || isRoutingOpen || isDiagnosticOpen ? 'visible' : ''}`}
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
              {currentTrackTitle.length > 28
                ? `${currentTrackTitle.substring(0, 28)}...`
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

      {/* Top Bar Load Audio File Container */}
      {onFilesSelected && (
        <div
          className={`header-audio-loader ${isDragging ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onFilesSelected(e.dataTransfer.files);
            }
          }}
          title="Click to select or drag & drop audio file to pre-process & play"
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFilesSelected(e.target.files);
              }
            }}
          />
          <Upload size={14} className="header-upload-icon" />
          <span className="header-upload-text">LOAD AUDIO / DROP FILE</span>
        </div>
      )}

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
      </div>
    </header>
  );
};
