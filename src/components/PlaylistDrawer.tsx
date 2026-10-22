/**
 * Synwave Stage Playlist Drawer
 * 
 * Displays all processed YouTube stage songs with Demucs neural stems,
 * live thumbnail previews, BPM tags, and instant single-click concert loading.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ListMusic,
  RotateCw,
  Play,
  Volume2,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { PlaylistItem } from '../services/youtubeAudioService';

interface PlaylistDrawerProps {
  isOpen: boolean;
  playlist: PlaylistItem[];
  currentVideoId?: string | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSelectSong: (item: PlaylistItem) => void;
  onRefreshPlaylist?: () => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  isOpen,
  playlist,
  currentVideoId,
  isPlaying,
  isLoading = false,
  onClose,
  onSelectSong,
  onRefreshPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRefresh = async () => {
    if (onRefreshPlaylist && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefreshPlaylist();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const formatDuration = (secs?: number): string => {
    if (!secs || isNaN(secs) || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredPlaylist = playlist.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.videoId && t.videoId.toLowerCase().includes(q))
    );
  });

  return (
    <aside className={`drawer-panel drawer-right glass-panel playlist-drawer ${isOpen ? 'open' : ''}`}>
      {/* Drawer Header */}
      <div className="drawer-header playlist-drawer-header">
        <div className="drawer-title-group">
          <div className="playlist-icon-halo">
            <ListMusic size={18} className="drawer-icon" />
          </div>
          <div className="playlist-title-texts">
            <span className="drawer-title">STAGE PLAYLIST</span>
            <span className="playlist-subtitle">Processed YouTube Tracks</span>
          </div>
          <span className="drawer-badge">{playlist.length}</span>
        </div>

        <div className="playlist-header-actions">
          {onRefreshPlaylist && (
            <button
              className={`btn-icon btn-refresh ${isRefreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh playlist from cache"
              disabled={isRefreshing}
            >
              <RotateCw size={15} />
            </button>
          )}
          <button className="btn-icon" onClick={onClose} title="Close playlist (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="drawer-search-bar playlist-search-bar">
        <div className="search-input-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search processed songs or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Playlist Items List */}
      <div className="drawer-content playlist-scroll-content">
        {filteredPlaylist.length === 0 ? (
          <div className="playlist-empty-state">
            <div className="empty-halo">
              <ListMusic size={36} className="empty-icon" />
            </div>
            <p className="empty-title">
              {searchQuery ? 'No Matching Tracks Found' : 'No Processed Songs Yet'}
            </p>
            <p className="empty-subtitle">
              {searchQuery
                ? 'Try searching with a different title or creator name.'
                : 'Whenever you paste a YouTube link in the top bar, it will be automatically processed and saved here permanently.'}
            </p>
          </div>
        ) : (
          <div className="playlist-cards-list">
            {filteredPlaylist.map((item) => {
              const isCurrent = Boolean(currentVideoId && item.videoId === currentVideoId);

              return (
                <div
                  key={item.videoId}
                  className={`playlist-song-card ${isCurrent ? 'active' : ''} ${isLoading ? 'processing' : ''}`}
                  onClick={() => !isLoading && onSelectSong(item)}
                  title={isLoading ? 'Stage media is loading...' : `Load "${item.title}" into Synwave`}
                >
                  {/* Thumbnail Aperture */}
                  <div className="playlist-thumb-box">
                    <img
                      src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`}
                      alt={item.title}
                      className="playlist-thumb-img"
                      loading="lazy"
                    />
                    <div className="playlist-thumb-duration">
                      {formatDuration(item.duration || item.durationSeconds)}
                    </div>

                    {isCurrent && isPlaying ? (
                      <div className="playlist-thumb-overlay playing">
                        <div className="soundwave-bar bar-1" />
                        <div className="soundwave-bar bar-2" />
                        <div className="soundwave-bar bar-3" />
                      </div>
                    ) : (
                      <div className="playlist-thumb-overlay hover-play">
                        <Play size={16} className="thumb-play-icon" />
                      </div>
                    )}
                  </div>

                  {/* Metadata Body */}
                  <div className="playlist-info-box">
                    <div className="playlist-song-title-row">
                      <span className="playlist-song-title" title={item.title}>
                        {item.title}
                      </span>
                    </div>

                    <div className="playlist-song-artist-row">
                      <span className="playlist-song-artist" title={item.artist}>
                        {item.artist}
                      </span>
                    </div>

                    <div className="playlist-tags-row">
                      {isCurrent && (
                        <span className="tag-pill tag-live" title="Currently mounted on stage">
                          <Volume2 size={10} />
                          <span>ON STAGE</span>
                        </span>
                      )}

                      {item.hasStems !== false && (
                        <span className="tag-pill tag-stems" title="Demucs 4-Stem Envelopes Ready">
                          <Zap size={9} />
                          <span>STEMS</span>
                        </span>
                      )}

                      {Boolean(item.bpm) && (
                        <span className="tag-pill tag-bpm" title="Authoritative Neural BPM">
                          <span>{item.bpm} BPM</span>
                        </span>
                      )}

                      <span className="tag-pill tag-fast" title="Sub-10ms instant cache hit">
                        <Sparkles size={9} />
                        <span>FAST LOAD</span>
                      </span>
                    </div>
                  </div>

                  {/* External YouTube link quick action */}
                  <div className="playlist-actions-box">
                    <a
                      href={item.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-external-link"
                      onClick={(e) => e.stopPropagation()}
                      title="Open on YouTube in new tab"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer Footer Status */}
      <div className="playlist-drawer-footer">
        <span className="footer-status-text">
          Instant cache hits &bull; Click any track to load directly into the stage
        </span>
      </div>
    </aside>
  );
};
