/**
 * Synwave Floating Top Header Component
 * Floating navigation pill buttons directly on the 3D stage window (zero solid container background).
 * - Top Left: Permanent clean SYNWAVE logo (no audio name inside logo)
 * - Center Top: Centered Load Audio / Drop File button
 * - Top Right: Floating Console & Telemetry HUD Toggles
 */

import React, { useRef, useState } from 'react';
import {
  Activity,
  Key,
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
  onOpenKeySettings?: () => void;
  isKeyModalOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isRoutingOpen = false,
  isDiagnosticOpen = false,
  isVisible,
  onToggleRouting,
  onToggleDiagnostic,
  onMouseEnter,
  onMouseLeave,
  onFilesSelected,
  onOpenKeySettings,
  isKeyModalOpen = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isMenuVisible = isVisible || isRoutingOpen || isDiagnosticOpen;

  return (
    <header
      className={`synwave-header floating-header ${isMenuVisible ? 'menus-visible visible' : 'menus-hidden'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Top Left: Clean Synwave Logo Pill (Permanently visible; dims smoothly when menus hide) */}
      <div
        className={`header-brand floating-pill ${isMenuVisible ? 'full-opacity' : 'dimmed'}`}
        title="Synwave Procedural Concert Stage"
      >
        <div className="brand-logo">
          <img src="/icon.png" alt="Synwave App Icon" className="brand-logo-img" />
          <div className="brand-pulse-ring" />
        </div>
        <span className="brand-title">SYNWAVE</span>
      </div>

      {/* Center Top: Load Audio File Floating Pill (Auto-hides with upper menus) */}
      {onFilesSelected && (
        <div className={`header-center-loader-wrapper menu-anim ${isMenuVisible ? 'visible' : 'hidden'}`}>
          <div
            className={`header-audio-loader floating-pill ${isDragging ? 'drag-over' : ''}`}
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
            <Upload size={14} className="header-upload-icon neon-cyan-icon" />
            <span className="header-upload-text">LOAD AUDIO / DROP FILE</span>
          </div>
        </div>
      )}

      {/* Top Right: Floating Drawer & Console Toggles (Auto-hides with upper menus) */}
      <div className={`header-toggles floating-pill menu-anim ${isMenuVisible ? 'visible' : 'hidden'}`}>
        {onOpenKeySettings && (
          <button
            className={`btn-icon ${isKeyModalOpen ? 'active' : ''}`}
            onClick={onOpenKeySettings}
            title="YouTube Data API Key & Validation Gate"
          >
            <Key size={18} />
          </button>
        )}

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
