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
import { identifyAudioWithShazam } from './services/shazamService';
import { searchYouTubeVideo } from './services/youtubeService';
import type {
  QualityPreset,
  RepeatMode,
  StageProfile,
  TrackRecord,
  VisualSettings,
} from './types';

// Bundled test track configurations from local "My Music" directory
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

  // Festival Window Blinder Flash State
  const [windowFlashOpacity, setWindowFlashOpacity] = useState(0);
  const [windowFlashColor, setWindowFlashColor] = useState('#ffffff');

  // UI Visibility & Auto-Hide State
  const [isTopBarVisible, setIsTopBarVisible] = useState(false);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Console Modal State
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<StageProfile>(
    RoutingStore.getInstance().getActiveProfile()
  );

  // Synchronized YouTube Video & Shazam State
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('');
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState<boolean>(false);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to RoutingStore profile changes
  useEffect(() => {
    const unsub = RoutingStore.getInstance().subscribe((_, prof) => {
      setActiveProfile(prof);
    });
    return unsub;
  }, []);

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
      'thin-lasers',
      'fire-shooters',
      'smoke-machines',
      'shockwave-rings',
      'starfield-warp',
      'terrain-grid',
    ],
  });

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
        setIsBottomBarVisible(false);
      } else if (e.clientY >= bottomThreshold) {
        setIsBottomBarVisible(true);
        setIsTopBarVisible(false);
      } else {
        // If cursor is in the middle of canvas, schedule auto-hide after 1.8 seconds
        hideTimerRef.current = setTimeout(() => {
          setIsTopBarVisible(false);
          setIsBottomBarVisible(false);
        }, 1800);
      }
    };

    const handleMouseLeave = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      setIsTopBarVisible(false);
      setIsBottomBarVisible(false);
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
    };

    if (canvasRef.current) {
      const visualEngine = new VisualEngine(canvasRef.current);
      visualEngineRef.current = visualEngine;

      visualEngine.onWindowFlash = (_opacity, colorHex) => {
        setWindowFlashOpacity(0);
        if (colorHex) setWindowFlashColor(colorHex);
      };

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
        audioEngineRef.current?.setTrackBeatGrid(track.id, analysis.estimatedBpm, analysis.bpmConfidence);
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
  }, [currentTrack?.id, duration]);

  // Handle Track Loading
  const loadTrack = useCallback(
    async (track: TrackRecord, autoPlay = true) => {
      setCurrentTrack(track);
      setCurrentTime(0);

      visualEngineRef.current?.setTrackProfile(track.seed, track.analysis);
      visualEngineRef.current?.setTrackInfo(track.title, track.artist, track.analysis?.descriptors?.mood);
      if (track.duration > 0) {
        visualEngineRef.current?.setTrackDuration(track.duration);
      }

      if (audioEngineRef.current) {
        audioEngineRef.current.setTrackBeatGrid(track.id, track.analysis?.estimatedBpm, track.analysis?.bpmConfidence);
        await audioEngineRef.current.loadTrack(track.url, autoPlay);
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
    if (isPlaying) {
      audioEngineRef.current.pause();
    } else {
      if (!currentTrack && tracks.length > 0) {
        loadTrack(tracks[0], true);
        return;
      }
      audioEngineRef.current.play();
    }
  };

  const handlePreviousTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : 0;
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    loadTrack(tracks[prevIndex], true);
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
    loadTrack(tracks[nextIndex], true);
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

  // Ingest Selected Audio File from Center Screen Click or Drag-and-Drop
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const audioFile = filesArray.find(
      (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)
    );

    if (!audioFile) return;

    let hash = 0;
    for (let i = 0; i < audioFile.name.length; i++) {
      hash = (hash << 5) - hash + audioFile.name.charCodeAt(i);
      hash |= 0;
    }

    const baseName = audioFile.name.replace(/\.[^/.]+$/, '');
    const parts = baseName.split(' - ');
    const initialArtist = parts.length > 1 ? parts[0].trim() : 'Local Audio';
    const initialTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : baseName;

    const track: TrackRecord = {
      id: `local-${audioFile.name}-${audioFile.size}-${audioFile.lastModified}`,
      name: audioFile.name,
      title: initialTitle,
      artist: initialArtist,
      album: 'Local Audio',
      duration: 0,
      url: URL.createObjectURL(audioFile),
      sizeBytes: audioFile.size,
      file: audioFile,
      analysisStatus: 'unscanned',
      seed: Math.abs(hash),
    };

    setTracks([track]);
    await loadTrack(track, true);

    // Reset previous video state
    setCurrentVideoId(null);
    setCurrentVideoTitle('');

    // Trigger ShazamIO identification in parallel
    setIsRecognizing(true);
    try {
      const match = await identifyAudioWithShazam(audioFile);
      if (match.success && match.title) {
        const recognizedTitle = match.title;
        const recognizedArtist = match.artist || initialArtist;

        // Update track metadata and stage screen
        setCurrentTrack((prev) =>
          prev ? { ...prev, title: recognizedTitle, artist: recognizedArtist } : null
        );
        visualEngineRef.current?.setTrackInfo(recognizedTitle, recognizedArtist);

        // Fetch official video from YouTube Data API v3
        const searchQuery = match.query || `${recognizedTitle} ${recognizedArtist}`;
        const ytResult = await searchYouTubeVideo(searchQuery);
        if (ytResult) {
          setCurrentVideoId(ytResult.videoId);
          setCurrentVideoTitle(ytResult.title);
        }
      } else {
        // Fallback search with filename
        const ytResult = await searchYouTubeVideo(`${initialTitle} ${initialArtist}`);
        if (ytResult) {
          setCurrentVideoId(ytResult.videoId);
          setCurrentVideoTitle(ytResult.title);
        }
      }
    } catch (err) {
      console.warn('Shazam / YouTube pipeline error:', err);
    } finally {
      setIsRecognizing(false);
    }
  };

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

  // 4. Keyboard Show Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.code === 'Digit1') {
        e.preventDefault();
        RoutingStore.getInstance().setProfile('festival-mainstage');
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        RoutingStore.getInstance().setProfile('industrial-underground');
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        RoutingStore.getInstance().setProfile('rock-arena');
      } else if (e.code === 'Digit4') {
        e.preventDefault();
        RoutingStore.getInstance().setProfile('cinematic-ambient');
      } else if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setIsDiagnosticOpen((prev) => !prev);
      } else if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsRoutingOpen((prev) => !prev);
      } else if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const currentCfg = RoutingStore.getInstance().getConfig();
        RoutingStore.getInstance().updateConfig({
          disablePyrotechnics: !currentCfg.disablePyrotechnics,
        });
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const currentCfg = RoutingStore.getInstance().getConfig();
        RoutingStore.getInstance().updateConfig({
          reducedFlash: !currentCfg.reducedFlash,
        });
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const seekTarget = Math.max(0, currentTime - 5);
        handleSeek(seekTarget);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const seekTarget = Math.min(duration || 9999, currentTime + 5);
        handleSeek(seekTarget);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration]);

  return (
    <div className="synwave-app">
      {/* Three.js 3D Procedural Canvas */}
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        onDoubleClick={handleToggleFullscreen}
        title="Double-click to toggle fullscreen (or press 'F', Space to Play/Pause)"
      />

      {/* Festival Window Blinder Strobe Flash */}
      <div
        className="festival-window-blinder"
        style={{
          opacity: windowFlashOpacity,
          backgroundColor: windowFlashColor,
        }}
      />

      {/* Top Header Bar (Attached flush to window top, auto-hides) */}
      <Header
        currentTrackTitle={currentTrack?.title}
        isRoutingOpen={isRoutingOpen}
        isDiagnosticOpen={isDiagnosticOpen}
        activeProfileName={STAGE_PROFILES[activeProfile]?.name}
        isVisible={isTopBarVisible}
        onToggleRouting={() => setIsRoutingOpen((prev) => !prev)}
        onToggleDiagnostic={() => setIsDiagnosticOpen((prev) => !prev)}
        onMouseEnter={() => setIsTopBarVisible(true)}
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

      {/* Center Screen Interactive Click & Drag-Drop Target */}
      <div
        className={`stage-center-drop-target ${isDraggingOverScreen ? 'drag-hover' : ''} ${currentVideoId ? 'has-video' : ''}`}
        onClick={() => audioFileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOverScreen(true);
        }}
        onDragLeave={() => setIsDraggingOverScreen(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOverScreen(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelected(e.dataTransfer.files);
          }
        }}
        title="Click center screen or drag & drop music file here to play"
      >
        <input
          type="file"
          ref={audioFileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesSelected(e.target.files);
            }
          }}
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          style={{ display: 'none' }}
        />

        {isRecognizing && (
          <div className="shazam-recognizing-badge">
            <span className="shazam-pulse-dot" />
            <span>IDENTIFYING WITH SHAZAM...</span>
          </div>
        )}
      </div>

      {/* Synchronized YouTube Iframe Stage Screen Player */}
      <YouTubeStagePlayer
        videoId={currentVideoId}
        videoTitle={currentVideoTitle}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onKeySaved={() => {
          if (currentTrack) {
            searchYouTubeVideo(`${currentTrack.title} ${currentTrack.artist}`).then((res) => {
              if (res) {
                setCurrentVideoId(res.videoId);
                setCurrentVideoTitle(res.title);
              }
            });
          }
        }}
      />

      {/* Bottom Transport Player Dock (Attached flush to window bottom, auto-hides) */}
      <PlayerControls
        currentTrack={currentTrack}
        isPlaying={isPlaying}
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
