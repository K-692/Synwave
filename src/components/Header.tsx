/**
 * Synwave Floating Top Header Component
 * Floating navigation pill buttons directly on the 3D stage window.
 * - Top Left: Permanent clean SYNWAVE brand pill
 * - Center Top: Floating YouTube link input & extraction trigger
 * - Top Right: Floating Console & Telemetry HUD toggles
 */

import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ClipboardPaste,
  SlidersHorizontal,
} from 'lucide-react';

interface HeaderProps {
  currentTrackTitle?: string;
  isRoutingOpen?: boolean;
  isDiagnosticOpen?: boolean;
  activeProfileName?: string;
  isVisible: boolean;
  isLoading?: boolean;
  onToggleRouting?: () => void;
  onToggleDiagnostic?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onYouTubeUrlSubmit?: (url: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRoutingOpen = false,
  isDiagnosticOpen = false,
  isVisible,
  isLoading = false,
  onToggleRouting,
  onToggleDiagnostic,
  onMouseEnter,
  onMouseLeave,
  onYouTubeUrlSubmit,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const isMenuVisible = isVisible || isRoutingOpen || isDiagnosticOpen;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = urlInput.trim();
    if (clean && onYouTubeUrlSubmit && !isLoading) {
      onYouTubeUrlSubmit(clean);
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrlInput(text.trim());
          if (onYouTubeUrlSubmit && !isLoading) {
            onYouTubeUrlSubmit(text.trim());
          }
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  return (
    <header
      className={`synwave-header floating-header ${isMenuVisible ? 'menus-visible visible' : 'menus-hidden'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Top Left: Clean Synwave Logo Pill */}
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

      {/* Center Top: YouTube URL Input Floating Bar (Auto-hides with upper menus) */}
      {onYouTubeUrlSubmit && (
        <div className={`header-center-loader-wrapper menu-anim ${isMenuVisible ? 'visible' : 'hidden'}`}>
          <form
            className="header-youtube-loader floating-pill"
            onSubmit={handleSubmit}
            title="Paste YouTube link to extract audio & run Demucs neural stage separation"
          >
            <div className="header-yt-icon-wrapper" title="YouTube Audio & Video Sync">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="#FF0033" className="yt-icon-svg">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>

            <input
              type="text"
              className="header-youtube-input"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube Link (e.g. https://www.youtube.com/watch?v=...)"
              disabled={isLoading}
              spellCheck={false}
              autoComplete="off"
            />

            {Boolean(navigator.clipboard?.readText) && (
              <button
                type="button"
                className="header-paste-btn"
                onClick={handlePaste}
                title="Paste from clipboard"
                disabled={isLoading}
              >
                <ClipboardPaste size={14} />
              </button>
            )}

            <button
              type="submit"
              className="header-youtube-btn"
              disabled={!urlInput.trim() || isLoading}
              title="Extract audio & run stage concert simulation"
            >
              <span>{isLoading ? 'SYNCING...' : 'SYNC STAGE'}</span>
              <ArrowRight size={13} />
            </button>
          </form>
        </div>
      )}

      {/* Top Right: Floating Console & Telemetry HUD Toggles */}
      <div className={`header-toggles floating-pill menu-anim ${isMenuVisible ? 'visible' : 'hidden'}`}>
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
