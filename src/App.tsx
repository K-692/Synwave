/**
 * Synwave Main Application Component
 * Coordinates AudioEngine, VisualEngine, Track Queue, and Auto-Hiding Edge-Attached Controls.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { PlayerControls } from './components/PlayerControls';
import { YouTubeStagePlayer } from './components/YouTubeStagePlayer';
import { AudioEngine } from './audio/AudioEngine';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { VisualEngine } from './visualizer/VisualEngine';
import { RoutingConsole } from './components/RoutingConsole';
import { DiagnosticOverlay } from './components/DiagnosticOverlay';
import { RoutingStore, STAGE_PROFILES } from './visualizer/director/RoutingStore';
import { detectHardwareProfile } from './utils/hardwareDetector';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import {
  processYouTubeUrl,
  extractYouTubeVideoId,
  fetchProcessedPlaylist,
  saveTrackToLocalPlaylist,
  type PlaylistItem,
} from './services/youtubeAudioService';
import { extractThumbnailColors } from './services/thumbnailColorService';
import { StemSeparationLoader } from './components/StemSeparationLoader';
import { separateAudioWithDemucs, getTrackFingerprint } from './services/demucsService';
import { resolveTrackBpm, mapBpmToSpotlightCount } from './services/tempoService';
import type {
  DemucsStemData,
  QualityPreset,
  RepeatMode,
  StageProfile,
  TrackRecord,
  VisualSettings,
} from './types';

// Bundled demo test track configurations
const BUNDLED_TEST_TRACKS: TrackRecord[] = [
  {
    id: 'feel-something-track',
    name: 'ILLENIUM, Excision, I Prevail - Feel Something.mp3',
    title: 'Feel Something',
    artist: 'ILLENIUM, Excision, I Prevail',
    album: 'Festival Melodic Dubstep',
    duration: 219,
    url: '/music/Feel Something.mp3',
    sizeBytes: 5296941,
    analysisStatus: 'unscanned',
    seed: 99482,
  },
  {
    id: 'aaloshyo-track',
    name: 'Aaloshyo (আলস্য) - Anupam Roy.mp3',
    title: 'Aaloshyo (আলস্য)',
    artist: 'Anupam Roy & SVF',
    album: 'Calm Melodic Acoustic',
    duration: 296,
    url: '/music/Aaloshyo.mp3',
    sizeBytes: 7122861,
    analysisStatus: 'unscanned',
    seed: 48271,
  },
  {
    id: 'waves-test-track',
    name: 'Ambyion & Abandoned - Waves.mp3',
    title: 'Waves',
    artist: 'Ambyion & Abandoned',
    album: 'Melodic Wave / Chill',
    duration: 224,
    url: '/music/Ambyion & Abandoned - Waves.mp3',
    sizeBytes: 3367827,
    analysisStatus: 'unscanned',
    seed: 133742,
  },
];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const visualEngineRef = useRef<VisualEngine | null>(null);

  // Detect Host Hardware Capabilities (GPU / Apple MPS vs CPU Fallback)
  const hardwareProfile = useMemo(() => detectHardwareProfile(), []);

  // Playback State (Default null: no track auto-selected on launch)
  const [tracks, setTracks] = useState<TrackRecord[]>(BUNDLED_TEST_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<TrackRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  // UI Visibility & Auto-Hide State
  const [isTopBarVisible, setIsTopBarVisible] = useState(false);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Phase 9: Audio/Video Media Readiness & Playback Gate Tracking
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);

  // Synchronous refs for event listeners and timers
  const isAudioReadyRef = useRef(false);
  const isVideoReadyRef = useRef(false);
  const isVideoLoadingRef = useRef(false);
  const isSeparatingStemsRef = useRef(false);
  const hasPlaybackStartedRef = useRef(false);
  const isBothMediaReadyRef = useRef(false);

  // Console Modal State
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activeProfile, setActiveProfile] = useState<StageProfile>(
    RoutingStore.getInstance().getActiveProfile()
  );

  // Synchronized YouTube Video & Loading Gate State
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isSeparatingStems, setIsSeparatingStems] = useState<boolean>(false);
  const [separationStatus, setSeparationStatus] = useState<string>('');
  const [stemLoaderPhase, setStemLoaderPhase] = useState<'extracting' | 'extracting_audio' | 'extracting_stems'>('extracting');
  const [stemLoaderTitle, setStemLoaderTitle] = useState<string>('');
  const [stemLoaderArtist, setStemLoaderArtist] = useState<string>('');

  // Phase 13: Active Pipeline Tracker to prevent race conditions during rapid track switching
  const activePipelineTrackIdRef = useRef<string | null>(null);

  // Track when both media sources (audio and video) are fully loaded and ready
  const isBothMediaReady = Boolean(
    currentTrack &&
    isAudioReady &&
    isVideoReady &&
    !isVideoLoading &&
    !isSeparatingStems
  );

  // Sync refs with state values for event listeners and timers
  useEffect(() => {
    isAudioReadyRef.current = isAudioReady;
    isVideoReadyRef.current = isVideoReady;
    isVideoLoadingRef.current = isVideoLoading;
    isSeparatingStemsRef.current = isSeparatingStems;
    hasPlaybackStartedRef.current = hasPlaybackStarted;
    isBothMediaReadyRef.current = isBothMediaReady;
  }, [isAudioReady, isVideoReady, isVideoLoading, isSeparatingStems, hasPlaybackStarted, isBothMediaReady]);


  // Subscribe to RoutingStore profile and config changes
  useEffect(() => {
    const unsub = RoutingStore.getInstance().subscribe((cfg, prof) => {
      setActiveProfile(prof);
      if (cfg.spotlightCount) {
        visualEngineRef.current?.setSpotlightCount(cfg.spotlightCount);
      }
    });
    return unsub;
  }, []);

  // Fetch previously processed playlist from backend and localStorage cache
  const refreshPlaylist = useCallback(async () => {
    try {
      const items = await fetchProcessedPlaylist();
      if (items.length > 0) {
        setPlaylist(items);
      }
    } catch (err) {
      console.warn('[App] Error fetching playlist:', err);
    }
  }, []);

  useEffect(() => {
    refreshPlaylist();
  }, [refreshPlaylist]);

  // Synchronize visual engine stage screen with video state and extract thumbnail colors
  useEffect(() => {
    visualEngineRef.current?.setVideoActive(!!currentVideoId);
    if (currentVideoId) {
      extractThumbnailColors(currentVideoId)
        .then((extracted) => {
          if (extracted) {
            visualEngineRef.current?.setSongPalette(extracted);
            if (extracted.spotlightColors.length > 0) {
              visualEngineRef.current?.setCustomSpotlightColors(extracted.spotlightColors);
            }
            setCurrentTrack((prev) => (prev ? { ...prev, extractedColors: extracted } : prev));
          }
        })
        .catch((err) => {
          console.warn('[App] Error extracting thumbnail colors:', err);
        });
    } else {
      visualEngineRef.current?.setSongPalette(null);
      visualEngineRef.current?.setCustomSpotlightColors(null);
    }
  }, [currentVideoId]);

  // Visual Settings: Default to GPU/MPS if present, otherwise 60 FPS standard
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    effectIntensity: 1.0,
    cameraSpeed: 1.0,
    bloomGlow: true,
    wireframe: false,
    paletteId: 'cyberpunk-neon',
    quality: hardwareProfile.recommendedQuality,
    directorMode: 'auto',
    activeEffects: [
      'stage-structure',
      'stage-lights',
      'fire-shooters',
      'shockwave-rings',
      'starfield-warp',
      'terrain-grid',
    ],
  });

  // Phase 9: Automatically reveal bottom menu once both media sources are ready, and keep it visible until playback begins
  useEffect(() => {
    if (isBothMediaReady && !hasPlaybackStarted) {
      setIsBottomBarVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [isBothMediaReady, hasPlaybackStarted]);

  // 1. Mouse Hover & Auto-Hide Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const topThreshold = 65;
      const bottomThreshold = window.innerHeight - 75;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (e.clientY <= topThreshold) {
        setIsTopBarVisible(true);
        // If playback has already started, hide the bottom bar when hovering top
        if (hasPlaybackStartedRef.current) {
          setIsBottomBarVisible(false);
        }
      } else if (e.clientY >= bottomThreshold) {
        setIsBottomBarVisible(true);
        setIsTopBarVisible(false);
      } else {
        // If cursor is in the middle of canvas:
        // Phase 9: Keep bottom menu visible if both media are ready and playback has not yet begun
        if (!hasPlaybackStartedRef.current && isBothMediaReadyRef.current) {
          setIsTopBarVisible(false);
          setIsBottomBarVisible(true);
          return;
        }

        // Normal auto-hide after playback has begun
        hideTimerRef.current = window.setTimeout(() => {
          setIsTopBarVisible(false);
          if (hasPlaybackStartedRef.current) {
            setIsBottomBarVisible(false);
          }
        }, 1800);
      }
    };

    const handleMouseLeave = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setIsTopBarVisible(false);
      // Phase 9: Keep bottom menu visible if both media are ready and playback has not yet begun
      if (hasPlaybackStartedRef.current) {
        setIsBottomBarVisible(false);
      } else if (isBothMediaReadyRef.current) {
        setIsBottomBarVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // 2. Initialize Audio Engine and Visual Engine
  useEffect(() => {
    const audioEngine = new AudioEngine();
    audioEngineRef.current = audioEngine;

    audioEngine.onTimeUpdate = (curr, dur) => {
      setCurrentTime(curr);
      if (dur > 0) setDuration(dur);
    };

    audioEngine.onPlayStateChange = (playing) => {
      setIsPlaying(playing);
      visualEngineRef.current?.setIsPlaying(playing);
      if (playing) {
        setHasPlaybackStarted(true);
        hasPlaybackStartedRef.current = true;
      }
    };

    audioEngine.onAudioReady = () => {
      setIsAudioReady(true);
      isAudioReadyRef.current = true;
    };

    audioEngine.onPlaybackStarted = () => {
      setHasPlaybackStarted(true);
      hasPlaybackStartedRef.current = true;
    };

    if (canvasRef.current) {
      const visualEngine = new VisualEngine(canvasRef.current);
      visualEngineRef.current = visualEngine;

      visualEngine.onWindowFlash = (opacity, bgCss) => {
        const el = document.getElementById('festival-window-blinder');
        if (el) {
          el.style.opacity = opacity > 0.005 ? opacity.toFixed(3) : '0';
          if (bgCss) {
            el.style.background = bgCss;
          }
        }
      };

      // Synchronize DOM YouTube video iframe position with 3D camera kicks & drops
      visualEngine.onStageShake = (shakeXPixels, shakeYPixels) => {
        const el = document.getElementById('synwave-youtube-stage-screen');
        if (el) {
          if (shakeXPixels !== 0 || shakeYPixels !== 0) {
            el.style.transform = `translate(calc(-50% + ${shakeXPixels.toFixed(2)}px), calc(-50% + ${shakeYPixels.toFixed(2)}px))`;
          } else {
            el.style.transform = 'translate(-50%, -50%)';
          }
        }
      };

      // Set initial spotlight count from routing store
      const initialSpotlightCount = RoutingStore.getInstance().getConfig().spotlightCount || 3;
      visualEngine.setSpotlightCount(initialSpotlightCount);

      // Start continuous Three.js render loop with authoritative media clock
      visualEngine.start(
        () => audioEngine.getLiveFeatures(),
        () => audioEngine.getCurrentTime()
      );
      // Initialize visual engine with hardware-detected quality preset
      visualEngine.setQuality(detectHardwareProfile().recommendedQuality);
    }

    return () => {
      audioEngine.dispose();
      visualEngineRef.current?.dispose();
    };
  }, []);

  // 3. Background Track Analysis Trigger
  const triggerBackgroundAnalysis = useCallback(async (track: TrackRecord) => {
    if (track.analysisStatus === 'ready' || track.analysisStatus === 'analysing') {
      return;
    }

    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, analysisStatus: 'analysing' } : t))
    );

    try {
      const analysis = await AudioAnalyzer.analyzeTrack(
        track.id,
        track.file || track.url
      );

      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id
            ? {
                ...t,
                analysisStatus: 'ready',
                duration: t.duration || analysis.durationSeconds,
                analysis,
              }
            : t
        )
      );

      if (currentTrack?.id === track.id) {
        visualEngineRef.current?.setTrackProfile(track.seed, analysis);
        visualEngineRef.current?.setTrackInfo(track.title, track.artist, analysis.descriptors?.mood);
        visualEngineRef.current?.setTrackDuration(analysis.durationSeconds);
        audioEngineRef.current?.setTrackAnalysis(analysis);
        // Only set beat grid if resolved from ShazamIO or Demucs kicks (do not overwrite with crude estimate)
        const resolved = resolveTrackBpm(track.id, null, currentTrack.demucsStems || track.demucsStems);
        if (resolved.source !== 'unavailable') {
          track.bpm = resolved.bpm;
          track.bpmSource = resolved.source;
          track.bpmConfidence = resolved.confidence;
          audioEngineRef.current?.setTrackBeatGrid(
            track.id,
            resolved.bpm ?? undefined,
            resolved.confidence,
            resolved.source
          );
          const routingCfg = RoutingStore.getInstance().getConfig();
          if (routingCfg.autoBpmSpotlightSpawning !== false && resolved.bpm) {
            const count = mapBpmToSpotlightCount(resolved.bpm, routingCfg.minSpotlightCount, routingCfg.maxSpotlightCount);
            visualEngineRef.current?.setSpotlightCount(count);
            RoutingStore.getInstance().setSpotlightCount(count);
          }
        }
        if (!duration && analysis.durationSeconds > 0) {
          setDuration(analysis.durationSeconds);
        }
      }
    } catch (err) {
      console.warn('Analysis fallback for track:', track.name, err);
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, analysisStatus: 'partial' } : t))
      );
    }
  }, [currentTrack?.id, currentTrack?.demucsStems, duration]);

  // Handle Track Loading
  const loadTrack = useCallback(
    async (track: TrackRecord, autoPlay = false) => {
      // Phase 13: Track pipeline ownership to prevent race conditions during rapid track switching
      const pipelineTrackId = track.id;
      activePipelineTrackIdRef.current = pipelineTrackId;

      setCurrentTrack(track);
      setCurrentTime(0);
      setHasPlaybackStarted(false);
      hasPlaybackStartedRef.current = false;
      setIsAudioReady(false);
      isAudioReadyRef.current = false;

      if (track.youtubeVideoId) {
        setCurrentVideoId(track.youtubeVideoId);
        setIsVideoReady(false);
        setIsVideoLoading(true);
        if (track.extractedColors) {
          visualEngineRef.current?.setSongPalette(track.extractedColors);
          if (track.extractedColors.spotlightColors.length > 0) {
            visualEngineRef.current?.setCustomSpotlightColors(track.extractedColors.spotlightColors);
          }
        } else {
          // Reset song palette immediately so previous track's colors never bleed into the new track
          visualEngineRef.current?.setSongPalette(null);
          visualEngineRef.current?.setCustomSpotlightColors(null);
        }
      } else {
        setIsVideoReady(true);
        setIsVideoLoading(false);
        visualEngineRef.current?.setSongPalette(null);
        visualEngineRef.current?.setCustomSpotlightColors(null);
      }

      visualEngineRef.current?.setTrackProfile(track.seed, track.analysis);
      visualEngineRef.current?.setTrackInfo(track.title, track.artist, track.analysis?.descriptors?.mood);
      if (track.duration > 0) {
        visualEngineRef.current?.setTrackDuration(track.duration);
      }

      if (audioEngineRef.current) {
        audioEngineRef.current.setTrackAnalysis(track.analysis || null);
        // Resolve BPM with priority: Demucs kick intervals -> unavailable
        const resolvedBpm = resolveTrackBpm(track.id, null, track.demucsStems);
        track.bpm = resolvedBpm.bpm;
        track.bpmSource = resolvedBpm.source;
        track.bpmConfidence = resolvedBpm.confidence;

        audioEngineRef.current.setTrackBeatGrid(
          track.id,
          resolvedBpm.bpm ?? undefined,
          resolvedBpm.confidence,
          resolvedBpm.source
        );

        // Update spotlight count according to resolved track BPM
        const routingCfg = RoutingStore.getInstance().getConfig();
        if (routingCfg.autoBpmSpotlightSpawning !== false && resolvedBpm.bpm) {
          const count = mapBpmToSpotlightCount(resolvedBpm.bpm, routingCfg.minSpotlightCount, routingCfg.maxSpotlightCount);
          visualEngineRef.current?.setSpotlightCount(count);
          RoutingStore.getInstance().setSpotlightCount(count);
        }

        // Load Demucs neural stems (from cache or track record)
        if (track.demucsStems) {
          audioEngineRef.current.setDemucsStems(track.demucsStems);
        } else if (track.file || track.url) {
          (async () => {
            const stems = await separateAudioWithDemucs(track.file || track.url, {
              fingerprint: getTrackFingerprint(track.file || track.url),
              songTitle: track.title,
              songArtist: track.artist,
            });
            if (activePipelineTrackIdRef.current !== pipelineTrackId) return;
            if (stems) {
              track.demucsStems = stems;
              audioEngineRef.current?.setDemucsStems(stems);
              // Re-resolve BPM now that Demucs kick stems are available
              const updatedBpm = resolveTrackBpm(track.id, null, stems);
              if (updatedBpm.source !== 'unavailable') {
                track.bpm = updatedBpm.bpm;
                track.bpmSource = updatedBpm.source;
                track.bpmConfidence = updatedBpm.confidence;
                audioEngineRef.current?.setTrackBeatGrid(
                  track.id,
                  updatedBpm.bpm ?? undefined,
                  updatedBpm.confidence,
                  updatedBpm.source
                );
                const cfg = RoutingStore.getInstance().getConfig();
                if (cfg.autoBpmSpotlightSpawning !== false && updatedBpm.bpm) {
                  const count = mapBpmToSpotlightCount(updatedBpm.bpm, cfg.minSpotlightCount, cfg.maxSpotlightCount);
                  visualEngineRef.current?.setSpotlightCount(count);
                  RoutingStore.getInstance().setSpotlightCount(count);
                }
              }
            }
          })().catch((err) => console.warn('[App] Pipeline load error in loadTrack:', err));
        }
        await audioEngineRef.current.loadTrack(track.url, autoPlay);
        if (activePipelineTrackIdRef.current !== pipelineTrackId) return;
        if (audioEngineRef.current.isAudioReady()) {
          setIsAudioReady(true);
          isAudioReadyRef.current = true;
        }
        visualEngineRef.current?.setIsPlaying(autoPlay);
      }

      triggerBackgroundAnalysis(track);
    },
    [triggerBackgroundAnalysis]
  );

  // Auto-advance when track ends
  useEffect(() => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.onTrackEnded = () => {
      if (repeatMode === 'one') {
        audioEngineRef.current?.seek(0);
        audioEngineRef.current?.play();
      } else {
        handleNextTrack();
      }
    };
  }, [repeatMode, tracks, currentTrack]);


  // 4. Transport Handlers
  const handlePlayPause = () => {
    if (!audioEngineRef.current) return;
    const isCurrentlyPlaying = audioEngineRef.current.isPlaying() || isPlaying;
    if (isCurrentlyPlaying) {
      audioEngineRef.current.pause();
      visualEngineRef.current?.setIsPlaying(false);
      setIsPlaying(false);
    } else {
      // User cannot play the music if stage media (audio or video) is still loading
      if (isVideoLoading || (!isVideoReady && currentTrack) || (!isAudioReady && currentTrack)) {
        console.warn('[App] Playback gated: Stage media is currently loading. Wait until loaded.');
        return;
      }
      if (!currentTrack && tracks.length > 0) {
        loadTrack(tracks[0], false);
        return;
      }
      audioEngineRef.current.play();
    }
  };

  const handlePreviousTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : 0;
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    loadTrack(tracks[prevIndex], false);
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    let nextIndex = 0;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;
      nextIndex = (currentIndex + 1) % tracks.length;
    }
    loadTrack(tracks[nextIndex], false);
  };

  const handleSeek = (timeSeconds: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.seek(timeSeconds);
      setCurrentTime(timeSeconds);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(false);
    audioEngineRef.current?.setVolume(vol);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioEngineRef.current?.setMute(nextMute);
  };

  const handleToggleShuffle = () => {
    setShuffle((prev) => !prev);
  };

  const handleToggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  const handleSelectQuality = (quality: QualityPreset) => {
    setVisualSettings((prev) => ({ ...prev, quality }));
    visualEngineRef.current?.setQuality(quality);
  };

  // Ingest YouTube URL from Header, paste, or drop
  const handleYouTubeUrlSubmit = useCallback(async (rawUrl: string) => {
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      console.warn('[App] Invalid YouTube URL provided:', rawUrl);
      return;
    }

    const trackId = `yt-${videoId}`;
    const pipelineTrackId = trackId;
    activePipelineTrackIdRef.current = pipelineTrackId;

    // 1. Immediately mount video in YouTube stage player (muted)
    setCurrentVideoId(videoId);
    setCurrentVideoTitle('Loading Stage Feed...');
    setIsVideoReady(false);
    setIsVideoLoading(true);
    setIsAudioReady(false);
    isAudioReadyRef.current = false;
    setHasPlaybackStarted(false);
    hasPlaybackStartedRef.current = false;
    setIsBottomBarVisible(false);

    // Stop current playback while new stage track is prepared
    audioEngineRef.current?.pause();
    visualEngineRef.current?.setIsPlaying(false);
    setIsPlaying(false);

    // 2. Activate Stage STEMs & Audio Extraction Loader
    setIsSeparatingStems(true);
    setStemLoaderPhase('extracting');
    setStemLoaderTitle(`YouTube Stage Feed (${videoId})`);
    setStemLoaderArtist('Direct Audio Extraction');
    setSeparationStatus('Extracting audio stream with yt-dlp & FFmpeg...');

    try {
      const result = await processYouTubeUrl(rawUrl, (status) => {
        if (activePipelineTrackIdRef.current !== pipelineTrackId) return;
        setSeparationStatus(status);
      });

      if (activePipelineTrackIdRef.current !== pipelineTrackId) return;

      if (!result.success) {
        console.error('[App] Failed to process YouTube audio:', result.error);
        setSeparationStatus(`Failed: ${result.error || 'Audio extraction error'}`);
        setIsSeparatingStems(false);
        return;
      }

      let hash = 0;
      for (let i = 0; i < videoId.length; i++) {
        hash = (hash << 5) - hash + videoId.charCodeAt(i);
        hash |= 0;
      }

      // Build authoritative Demucs stem data object ensuring envelopes, fps and kick events are fully populated
      const fullDemucsStems: DemucsStemData | undefined = (result.stems && (result.stems.stems || (result.stems as unknown as { drums?: number[] }).drums))
        ? {
            fps: result.stems.fps || (result as unknown as { fps?: number }).fps || 25,
            durationSeconds: result.stems.durationSeconds || result.durationSeconds || result.duration || 0,
            stems: result.stems.stems || (result.stems as unknown as DemucsStemData['stems']),
            kickEvents: result.stems.kickEvents || result.kickEvents || [],
            kickOnsets: result.stems.kickOnsets || result.kickOnsets || [],
            instrumentalActivity: result.stems.instrumentalActivity || result.instrumentalActivity || [],
            globalIntensity: result.stems.globalIntensity || result.globalIntensity || [],
            demucsBpm: result.stems.demucsBpm || result.demucsBpm,
            averageAmplitude: result.stems.averageAmplitude || result.averageAmplitude,
            aboveAverageSections: result.stems.aboveAverageSections || result.aboveAverageSections || [],
            triStemDropSections: result.stems.triStemDropSections || result.triStemDropSections || [],
          }
        : undefined;

      const track: TrackRecord = {
        id: trackId,
        name: `${result.title}.wav`,
        title: result.title,
        artist: result.artist,
        album: 'YouTube Concert Stage',
        duration: result.duration || result.durationSeconds || 0,
        url: result.audioUrl,
        sizeBytes: 0,
        analysisStatus: 'unscanned',
        recognitionStatus: 'ready',
        seed: Math.abs(hash),
        youtubeVideoId: videoId,
        youtubeUrl: rawUrl,
        demucsStems: fullDemucsStems,
      };

      setTracks([track]);
      setCurrentTrack(track);
      setCurrentVideoTitle(result.title);
      visualEngineRef.current?.setTrackInfo(result.title, result.artist);

      // Resolve BPM from Demucs neural kick stems
      const resolvedBpm = resolveTrackBpm(track.id, null, result.stems);
      track.bpm = resolvedBpm.bpm;
      track.bpmSource = resolvedBpm.source;
      track.bpmConfidence = resolvedBpm.confidence;
      if (audioEngineRef.current) {
        audioEngineRef.current.setTrackBeatGrid(
          track.id,
          resolvedBpm.bpm ?? undefined,
          resolvedBpm.confidence,
          resolvedBpm.source
        );
      }
      const routingCfg = RoutingStore.getInstance().getConfig();
      if (routingCfg.autoBpmSpotlightSpawning !== false && resolvedBpm.bpm) {
        const count = mapBpmToSpotlightCount(
          resolvedBpm.bpm,
          routingCfg.minSpotlightCount,
          routingCfg.maxSpotlightCount
        );
        visualEngineRef.current?.setSpotlightCount(count);
        RoutingStore.getInstance().setSpotlightCount(count);
      }

      // Update persistent stage playlist with freshly processed track
      const playlistItem: PlaylistItem = {
        videoId,
        title: result.title,
        artist: result.artist,
        duration: result.duration || result.durationSeconds || 0,
        audioUrl: result.audioUrl,
        youtubeUrl: rawUrl,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        hasDemucsStems: Boolean(fullDemucsStems && fullDemucsStems.stems),
        bpm: resolvedBpm.bpm ?? undefined,
        processedAt: Date.now(),
      };
      saveTrackToLocalPlaylist(playlistItem);
      setPlaylist((prev) => {
        const withoutCurrent = prev.filter((item) => item.videoId !== videoId);
        return [playlistItem, ...withoutCurrent];
      });

      // Load extracted audio endpoint into AudioEngine
      await loadTrack(track, false);
      if (activePipelineTrackIdRef.current !== pipelineTrackId) return;

      setTimeout(() => {
        if (activePipelineTrackIdRef.current === pipelineTrackId) {
          setIsVideoLoading(false);
          setIsVideoReady(true);
        }
      }, 3000);
    } catch (err) {
      console.error('[App] Error processing YouTube URL:', err);
      if (activePipelineTrackIdRef.current === pipelineTrackId) {
        setSeparationStatus('Audio extraction failed. Check console.');
      }
    } finally {
      if (activePipelineTrackIdRef.current === pipelineTrackId) {
        setIsSeparatingStems(false);
      }
    }
  }, [loadTrack]);

  // Ingest song selected directly from the stage playlist drawer
  const handleSelectPlaylistItem = useCallback((item: PlaylistItem) => {
    setIsPlaylistOpen(false);
    if (item.videoId === currentVideoId) {
      if (!isPlaying) {
        audioEngineRef.current?.play();
      }
      return;
    }
    handleYouTubeUrlSubmit(item.youtubeUrl);
  }, [currentVideoId, isPlaying, handleYouTubeUrlSubmit]);

  // Global window paste handler to automatically capture YouTube links pasted anywhere
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
        e.preventDefault();
        handleYouTubeUrlSubmit(text.trim());
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleYouTubeUrlSubmit]);

  const handleToggleFullscreen = async () => {
    try {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFull) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }

      // Ensure instant and delayed canvas re-bleed sizing across browser fullscreen animations
      visualEngineRef.current?.triggerResize();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  // 4. Stable references for keyboard listeners to prevent listener churn and stale closures
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const handlePlayPauseRef = useRef(handlePlayPause);
  const handleToggleFullscreenRef = useRef(handleToggleFullscreen);
  const handleSeekRef = useRef(handleSeek);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    handlePlayPauseRef.current = handlePlayPause;
    handleToggleFullscreenRef.current = handleToggleFullscreen;
    handleSeekRef.current = handleSeek;
  });

  // 5. Global Keyboard Show Controls (Permanent registration on window with capture)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Never hijack keys when user is typing in form inputs, textareas, or contenteditable elements
      const tagName = target.tagName ? target.tagName.toUpperCase() : '';
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const isEditable = target.isContentEditable || target.getAttribute?.('contenteditable') === 'true';

      if (isInput || isEditable) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        // Ignore Space key events originating from buttons or controls that already implement
        // their own Space-bar activation, preventing duplicate toggles or state conflicts
        if (target.closest('button, [role="button"]')) {
          return;
        }

        e.preventDefault();
        handlePlayPauseRef.current();
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreenRef.current();
      } else if (e.code === 'Digit1') {
        e.preventDefault();
        RoutingStore.getInstance().setProfile('festival-mainstage');
      } else if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setIsDiagnosticOpen((prev) => !prev);
      } else if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsRoutingOpen((prev) => !prev);
      } else if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsPlaylistOpen((prev) => !prev);
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const currentCfg = RoutingStore.getInstance().getConfig();
        RoutingStore.getInstance().updateConfig({
          reducedFlash: !currentCfg.reducedFlash,
        });
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const seekTarget = Math.max(0, currentTimeRef.current - 5);
        handleSeekRef.current(seekTarget);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const seekTarget = Math.min(durationRef.current || 9999, currentTimeRef.current + 5);
        handleSeekRef.current(seekTarget);
      }
    };

    // Reclaim window focus when user interacts back with the visualizer after iframe focus
    const handleReclaimFocus = () => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        window.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('pointerdown', handleReclaimFocus, { passive: true });
    window.addEventListener('mousemove', handleReclaimFocus, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('pointerdown', handleReclaimFocus);
      window.removeEventListener('mousemove', handleReclaimFocus);
    };
  }, []);

  return (
    <div
      className="synwave-app"
      onDoubleClick={handleToggleFullscreen}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
          handleYouTubeUrlSubmit(text.trim());
        }
      }}
    >
      {/* Synchronized YouTube Iframe Stage Screen Player (Sent back behind 3D canvas) */}
      <YouTubeStagePlayer
        videoId={currentVideoId}
        currentTime={currentTime}
        isPlaying={isPlaying}
        getAudioCurrentTime={() => audioEngineRef.current?.getCurrentTime() ?? currentTime}
        onPlayerReady={(ready) => {
          setIsVideoReady(ready);
          if (ready) {
            setIsVideoLoading(false);
          }
        }}
      />

      {/* Three.js 3D Procedural Canvas (Runs on top of YouTube video with transparent WebGL) */}
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        title="Double-click to toggle fullscreen (or press 'F', Space to Play/Pause)"
      />

      {/* Festival Window Blinder Strobe Flash */}
      <div
        id="festival-window-blinder"
        className="festival-window-blinder"
      />

      {/* Top Header Bar (Attached flush to window top, auto-hides) */}
      <Header
        currentTrackTitle={currentTrack?.title}
        isRoutingOpen={isRoutingOpen}
        isDiagnosticOpen={isDiagnosticOpen}
        isPlaylistOpen={isPlaylistOpen}
        playlistCount={playlist.length}
        activeProfileName={STAGE_PROFILES[activeProfile]?.name}
        isVisible={isTopBarVisible}
        isLoading={isSeparatingStems || isVideoLoading}
        onToggleRouting={() => setIsRoutingOpen((prev) => !prev)}
        onToggleDiagnostic={() => setIsDiagnosticOpen((prev) => !prev)}
        onTogglePlaylist={() => setIsPlaylistOpen((prev) => !prev)}
        onMouseEnter={() => setIsTopBarVisible(true)}
        onYouTubeUrlSubmit={handleYouTubeUrlSubmit}
      />

      {/* Stage Processed Tracks Playlist Drawer */}
      <PlaylistDrawer
        isOpen={isPlaylistOpen}
        playlist={playlist}
        currentVideoId={currentVideoId}
        isPlaying={isPlaying}
        isLoading={isSeparatingStems || isVideoLoading}
        onClose={() => setIsPlaylistOpen(false)}
        onSelectSong={handleSelectPlaylistItem}
        onRefreshPlaylist={refreshPlaylist}
      />

      {/* Audio-to-Visual Routing Console Modal */}
      <RoutingConsole
        isOpen={isRoutingOpen}
        onClose={() => setIsRoutingOpen(false)}
      />

      {/* Telemetry & Synchronization HUD Diagnostic Overlay */}
      <DiagnosticOverlay
        isVisible={isDiagnosticOpen}
        getLiveFeatures={() =>
          audioEngineRef.current?.getLiveFeatures() || {
            timeSeconds: 0,
            rms: 0,
            bass: 0,
            subBass: 0,
            lowMid: 0,
            highMid: 0,
            treble: 0,
            spectralCentroid: 0.5,
            onsetStrength: 0,
            beatConfidence: 0,
            isBeat: false,
            isKick: false,
            kickIntensity: 0,
            isDrop: false,
            dropIntensity: 0,
            musicMode: 'festival',
            mood: 'euphoric-drop',
            stems: {
              kick: 0,
              bass: 0,
              instruments: 0,
              vocals: 0,
            },
            estimatedBpm: 128,
            bpmSource: 'unavailable',
            bpmConfidence: 0.0,
            beatIndex: 0,
            barIndex: 1,
            beatPhase: 0,
            isBar: false,
            isPhrase: false,
            frequencyData: new Uint8Array(1024),
            timeDomainData: new Uint8Array(1024),
          }
        }
        getDirectorState={() => visualEngineRef.current?.getDirectorState() ?? null}
        onClose={() => setIsDiagnosticOpen(false)}
      />

      {/* Demucs Neural Stem Separation Pre-Processing Loader */}
      <StemSeparationLoader
        isVisible={isSeparatingStems}
        songTitle={stemLoaderTitle || currentTrack?.title}
        songArtist={stemLoaderArtist || currentTrack?.artist}
        statusText={separationStatus}
        phase={stemLoaderPhase}
      />

      {/* Bottom Transport Player Dock (Attached flush to window bottom, auto-hides) */}
      <PlayerControls
        currentTrack={currentTrack}
        videoTitle={currentVideoTitle}
        isPlaying={isPlaying}
        isAudioReady={isAudioReady}
        isVideoReady={isVideoReady}
        isVideoLoading={isVideoLoading}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        quality={visualSettings.quality}
        isVisible={isBottomBarVisible}
        onPlayPause={handlePlayPause}
        onPrevious={handlePreviousTrack}
        onNext={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onSelectQuality={handleSelectQuality}
        onMouseEnter={() => setIsBottomBarVisible(true)}
      />
    </div>
  );
};

export default App;
