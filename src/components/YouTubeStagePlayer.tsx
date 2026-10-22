/**
 * Synwave Synchronized YouTube Stage Player
 * 
 * Embeds the official YouTube video inside an iframe on the concert stage screen.
 * Volume is strictly muted (0) as the audio runs directly from the input audio file.
 * The video's playback position (timestamp) is continuously synchronized with the audio clock.
 */

import React, { useEffect, useRef, useState } from 'react';

interface YouTubeStagePlayerProps {
  videoId: string | null;
  currentTime: number;
  isPlaying: boolean;
  onPlayerReady?: (ready: boolean) => void;
  getAudioCurrentTime?: () => number;
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
            onPlaybackQualityChange?: (event: { data: string }) => void;
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
  setPlaybackQuality?: (suggestedQuality: string) => void;
  getPlaybackQuality?: () => string;
  getAvailableQualityLevels?: () => string[];
}

/**
 * Enforces highest video resolution up to 1K (1080p / 720p).
 * Prioritizes 'hd1080' (1080p Full HD / 1K) and 'hd720' (720p HD),
 * while strictly capping out resolutions > 1K (e.g. 'highres'/1440p/4K)
 * to maintain peak smoothness on the concert stage.
 */
function enforceHighestResolutionTill1K(player: YTPlayerInstance | null | undefined): void {
  if (!player) return;
  try {
    if (typeof player.getAvailableQualityLevels === 'function') {
      const levels = player.getAvailableQualityLevels();
      if (Array.isArray(levels) && levels.length > 0) {
        // Available quality levels in descending order:
        // ['highres', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny']
        // Select the highest resolution up to 1K:
        const allowed1KLevels = ['hd1080', 'hd720', 'large', 'medium', 'small'];
        const best1K = allowed1KLevels.find((lvl) => levels.includes(lvl));
        if (best1K && typeof player.setPlaybackQuality === 'function') {
          player.setPlaybackQuality(best1K);
          return;
        }
      }
    }
    if (typeof player.setPlaybackQuality === 'function') {
      player.setPlaybackQuality('hd1080');
    }
  } catch {
    // ignore
  }
}

export const YouTubeStagePlayer: React.FC<YouTubeStagePlayerProps> = ({
  videoId,
  currentTime,
  isPlaying,
  onPlayerReady,
  getAudioCurrentTime,
}) => {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const containerId = 'synwave-yt-iframe-player';
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isSyncingRef = useRef(false);
  const lastSyncTimestampRef = useRef(0);

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
      onPlayerReady?.(true);
      return;
    }

    setIsPlayerReady(false);
    onPlayerReady?.(false);

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

      // Ensure target element exists in DOM before initializing (recreates if destroyed)
      if (cropContainerRef.current && !document.getElementById(containerId)) {
        const div = document.createElement('div');
        div.id = containerId;
        div.className = 'yt-iframe-target';
        cropContainerRef.current.appendChild(div);
      }

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
            vq: 'hd1080',
          },
          events: {
            onReady: (event) => {
              // Volume MUST be strictly OFF as audio plays from the local audio file
              event.target.mute();
              event.target.setVolume(0);

              // Enforce highest playback resolution up to 1K (1080p/720p)
              enforceHighestResolutionTill1K(event.target);

              // Phase 15: Captions default-off inspection
              try {
                const target = event.target as unknown as {
                  unloadModule?: (module: string) => void;
                  setOption?: (module: string, option: string, value: unknown) => void;
                };
                if (typeof target.unloadModule === 'function') {
                  target.unloadModule('captions');
                }
                if (typeof target.setOption === 'function') {
                  target.setOption('captions', 'track', {});
                }
              } catch {
                // Ignore unsupported commands without crashing
              }

              setIsPlayerReady(true);
              onPlayerReady?.(true);

              const initialTime = getAudioCurrentTime ? getAudioCurrentTime() : currentTime;
              if (initialTime > 0) {
                event.target.seekTo(initialTime, true);
              }
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onPlaybackQualityChange: (event: { data: string }) => {
              // If YouTube attempts to promote beyond 1K (e.g. 'highres'), cap it back to 1K
              if (event.data === 'highres' && playerRef.current) {
                enforceHighestResolutionTill1K(playerRef.current);
              }
            },
            onError: (err) => {
              console.warn('[YouTubeStagePlayer] Video embedding failure or restriction:', err);
              setIsPlayerReady(true);
              onPlayerReady?.(true);
            },
            onStateChange: (event) => {
              playerRef.current?.mute();
              // Enforce 1080p/720p on buffer and playback starts
              if (event.data === 1 || event.data === 3) {
                enforceHighestResolutionTill1K(playerRef.current);
              }
              // High-precision sync anchor: When video begins playing (state 1), lock instantly to master audio clock
              if (event.data === 1 && getAudioCurrentTime) {
                try {
                  const masterTime = getAudioCurrentTime();
                  const ytTime = playerRef.current?.getCurrentTime() ?? 0;
                  if (Math.abs(ytTime - masterTime) > 0.08) {
                    playerRef.current?.seekTo(masterTime, true);
                  }
                } catch {
                  // ignore
                }
              }
            },
          },
        });
      } catch (err) {
        console.warn('YouTube Iframe Player instantiation warning:', err);
        setIsPlayerReady(true);
        onPlayerReady?.(true);
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
        const masterTime = getAudioCurrentTime ? getAudioCurrentTime() : currentTime;
        playerRef.current.seekTo(masterTime, true);
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (err) {
      console.warn('YouTube play/pause sync error:', err);
    }
  }, [isPlaying, isPlayerReady]);

  // 4. Continuous High-Frequency Drift Monitor (Tight audio-video alignment)
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || !isPlaying) return;

    const syncInterval = setInterval(() => {
      if (isSyncingRef.current || !playerRef.current) return;
      const now = performance.now();
      if (now - lastSyncTimestampRef.current < 250) return; // Prevent rapid seek storms

      try {
        const masterTime = getAudioCurrentTime ? getAudioCurrentTime() : currentTime;
        const ytTime = playerRef.current.getCurrentTime();
        const drift = ytTime - masterTime;

        // Snap into sync if drift exceeds 140ms
        if (Math.abs(drift) > 0.14) {
          isSyncingRef.current = true;
          lastSyncTimestampRef.current = now;
          playerRef.current.seekTo(masterTime, true);
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 200);
        }
      } catch {
        // ignore transient seek errors
      }
    }, 100);

    return () => clearInterval(syncInterval);
  }, [isPlaying, isPlayerReady, getAudioCurrentTime, currentTime]);

  // 5. Seek / Large Jump Synchronization with Audio Clock
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || isSyncingRef.current) return;

    try {
      const ytTime = playerRef.current.getCurrentTime();
      const diff = Math.abs(ytTime - currentTime);

      // Snap immediately if large seek occurred (> 0.4s)
      if (diff > 0.40) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(currentTime, true);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 200);
      }
    } catch {
      // ignore
    }
  }, [currentTime, isPlayerReady]);

  // Phase 15 & 18: Render clean iframe container with standard centered 16:9 cropping to hide captions
  return (
    <div
      id="synwave-youtube-stage-screen"
      className={`synwave-youtube-stage-screen ${videoId ? 'active' : ''}`}
    >
      <div ref={cropContainerRef} className="yt-crop-container">
        <div id={containerId} className="yt-iframe-target" />
      </div>
    </div>
  );
};
