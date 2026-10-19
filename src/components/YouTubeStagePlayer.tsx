/**
 * Synwave Synchronized YouTube Stage Player
 * 
 * Embeds the official YouTube video inside an iframe on the concert stage screen.
 * Volume is strictly muted (0) as the audio runs directly from the input audio file.
 * The video's playback position (timestamp) is continuously synchronized with the audio clock.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Video, Key, X, Check } from 'lucide-react';
import { getYouTubeApiKey, setYouTubeApiKey } from '../services/youtubeService';

interface YouTubeStagePlayerProps {
  videoId: string | null;
  videoTitle?: string;
  currentTime: number;
  isPlaying: boolean;
  onKeySaved?: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  mute: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
}

export const YouTubeStagePlayer: React.FC<YouTubeStagePlayerProps> = ({
  videoId,
  videoTitle,
  currentTime,
  isPlaying,
  onKeySaved,
}) => {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const containerId = 'synwave-yt-iframe-player';
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const isSyncingRef = useRef(false);

  // Check if API key is present
  useEffect(() => {
    const key = getYouTubeApiKey();
    setHasApiKey(!!key);
    setApiKeyInput(key);
  }, []);

  // 1. Load YouTube Iframe API Script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Initialize or reload Player when videoId changes
  useEffect(() => {
    if (!videoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        playerRef.current = null;
        setIsPlayerReady(false);
      }
      return;
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              // Volume MUST be strictly OFF as audio plays from the local audio file
              event.target.mute();
              event.target.setVolume(0);
              setIsPlayerReady(true);

              if (currentTime > 0) {
                event.target.seekTo(currentTime, true);
              }
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: () => {
              // Ensure volume stays permanently muted
              playerRef.current?.mute();
            },
          },
        });
      } catch (err) {
        console.warn('YouTube Iframe Player instantiation warning:', err);
      }
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    };
  }, [videoId]);

  // 3. Play / Pause Synchronization
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      playerRef.current.mute();
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (err) {
      console.warn('YouTube play/pause sync error:', err);
    }
  }, [isPlaying, isPlayerReady]);

  // 4. Continuous Timestamp Synchronization with Audio Clock
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || isSyncingRef.current) return;

    try {
      const ytTime = playerRef.current.getCurrentTime();
      const diff = Math.abs(ytTime - currentTime);

      // Re-align if video timestamp drifts more than 0.35 seconds from audio clock
      if (diff > 0.35) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(currentTime, true);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 300);
      }
    } catch {
      // ignore transient seek exceptions
    }
  }, [currentTime, isPlayerReady]);

  const handleSaveApiKey = () => {
    setYouTubeApiKey(apiKeyInput.trim());
    setHasApiKey(!!apiKeyInput.trim());
    setShowKeyModal(false);
    onKeySaved?.();
  };

  return (
    <>
      {/* YouTube Stage Screen Container */}
      <div
        id="synwave-youtube-stage-screen"
        className={`synwave-youtube-stage-screen ${videoId ? 'active' : ''}`}
      >
        <div id={containerId} className="yt-iframe-target" />

        {/* Video Overlay Info Pill */}
        {videoId && videoTitle && (
          <div className="yt-stage-pill" title={`Synchronized Video: ${videoTitle}`}>
            <Video size={13} className="yt-icon-pulse" />
            <span className="yt-pill-title">{videoTitle}</span>
            <span className="yt-pill-tag">MUTED • SYNCED</span>
          </div>
        )}
      </div>

      {/* API Key Modal Button Trigger if key is missing */}
      {!hasApiKey && (
        <button
          className="btn-yt-key-setup"
          onClick={() => setShowKeyModal(true)}
          title="Configure YouTube Data API v3 Key"
        >
          <Key size={14} />
          <span>Set YouTube API Key</span>
        </button>
      )}

      {/* YouTube API Key Modal */}
      {showKeyModal && (
        <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-cyan-400" />
                <h3 className="modal-title">YouTube Data API v3 Key</h3>
              </div>
              <button className="btn-close" onClick={() => setShowKeyModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                To automatically search and fetch official videos matching the song recognized by Shazam,
                Synwave requires a <strong>Google Cloud YouTube Data API v3 Key</strong>.
              </p>

              <div className="api-key-input-group">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="api-key-help">
                <p>
                  <strong>How to get a free API Key:</strong>
                </p>
                <ol>
                  <li>Go to Google Cloud Console (console.cloud.google.com).</li>
                  <li>Enable <em>YouTube Data API v3</em> in APIs & Services.</li>
                  <li>Under <em>Credentials</em>, click Create Credentials &gt; API Key.</li>
                </ol>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowKeyModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveApiKey}>
                <Check size={16} />
                <span>Save Key</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
