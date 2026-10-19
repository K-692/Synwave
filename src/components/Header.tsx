/**
 * Synwave Header Component
 * Top navigation bar attached to window edge with auto-hide behavior.
 */

import React from 'react';
import {
  Activity,
  SlidersHorizontal,
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
}) => {
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
