/**
 * Synwave Main Application Component
 * Coordinates AudioEngine, VisualEngine, Track Queue, and Auto-Hiding Edge-Attached Controls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { PlayerControls } from './components/PlayerControls';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { InspectorDrawer } from './components/InspectorDrawer';
import { TrackWatermark } from './components/TrackWatermark';
import { AudioEngine } from './audio/AudioEngine';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { VisualEngine } from './visualizer/VisualEngine';
import type {
  QualityPreset,
  RepeatMode,
  TrackRecord,
  VisualSettings,
} from './types';

// Bundled test track configuration from local "My Music" directory
const BUNDLED_TEST_TRACK: TrackRecord = {
  id: 'waves-test-track',
  name: 'Ambyion & Abandoned - Waves.mp3',
  title: 'Waves',
  artist: 'Ambyion & Abandoned',
  album: '4K Music Video',
  duration: 224, // ~3m 44s
  url: '/music/Ambyion & Abandoned - Waves.mp3',
  sizeBytes: 3367827,
  analysisStatus: 'unscanned',
  seed: 133742,
};

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const visualEngineRef = useRef<VisualEngine | null>(null);

  // Playback State
  const [tracks, setTracks] = useState<TrackRecord[]>([BUNDLED_TEST_TRACK]);
  const [currentTrack, setCurrentTrack] = useState<TrackRecord | null>(BUNDLED_TEST_TRACK);
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

  // UI Drawer State
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState('GROOVE');

  // Visual Settings
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    effectIntensity: 1.0,
    cameraSpeed: 1.0,
    bloomGlow: true,
    wireframe: false,
    paletteId: 'cyberpunk-neon',
    quality: 'high',
    directorMode: 'auto',
    activeEffects: [
      'starfield-warp',
      'wireframe-core',
      'waveform-ring',
      'spectrum-bars',
      'audio-ribbons',
      'laser-beams',
      'shockwave-rings',
      'terrain-grid',
      'torus-knot',
      'dna-helix',
      'particle-vortex',
    ],
  });

  const [effectsList, setEffectsList] = useState<
    { id: string; name: string; family: string; enabled: boolean }[]
  >([]);

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

      visualEngine.onCurrentSectionChange = (section) => {
        setCurrentSection(section);
      };

      setEffectsList(visualEngine.getEffectsList());

      // Start continuous Three.js render loop with authoritative media clock
      visualEngine.start(
        () => audioEngine.getLiveFeatures(),
        () => audioEngine.getCurrentTime()
      );
    }

    // Load initial default test track
    loadTrack(BUNDLED_TEST_TRACK, false);

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

      if (audioEngineRef.current) {
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
      audioEngineRef.current.play();
    }
  };

  const handlePreviousTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    loadTrack(tracks[prevIndex], true);
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    let nextIndex = 0;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
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

  const handleUpdateVisualSettings = (newSettings: Partial<VisualSettings>) => {
    setVisualSettings((prev) => ({ ...prev, ...newSettings }));
    if (newSettings.effectIntensity !== undefined) {
      visualEngineRef.current?.setEffectIntensity(newSettings.effectIntensity);
    }
    if (newSettings.cameraSpeed !== undefined) {
      visualEngineRef.current?.setCameraSpeed(newSettings.cameraSpeed);
    }
  };

  const handleToggleEffect = (id: string) => {
    visualEngineRef.current?.toggleEffect(id);
    if (visualEngineRef.current) {
      setEffectsList(visualEngineRef.current.getEffectsList());
    }
  };

  // Ingest Selected Files from Local Disk or Folder
  const handleFilesSelected = (fileList: FileList | File[]) => {
    const newTracks: TrackRecord[] = [];
    const filesArray = Array.from(fileList);

    for (const file of filesArray) {
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)) {
        continue;
      }

      let hash = 0;
      for (let i = 0; i < file.name.length; i++) {
        hash = (hash << 5) - hash + file.name.charCodeAt(i);
        hash |= 0;
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const parts = baseName.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Local Audio';
      const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : baseName;

      const track: TrackRecord = {
        id: `local-${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        title,
        artist,
        album: 'Local Library',
        duration: 0,
        url: URL.createObjectURL(file),
        sizeBytes: file.size,
        file,
        analysisStatus: 'unscanned',
        seed: Math.abs(hash),
      };

      newTracks.push(track);
    }

    if (newTracks.length > 0) {
      setTracks((prev) => [...prev, ...newTracks]);
      loadTrack(newTracks[0], true);
    }
  };

  return (
    <div className="synwave-app">
      {/* Three.js 3D Procedural Canvas */}
      <canvas ref={canvasRef} className="visualizer-canvas" />

      {/* On-Canvas Cinematic Watermark HUD */}
      <TrackWatermark
        currentTrack={currentTrack}
        currentSection={currentSection}
        isPlaying={isPlaying}
      />

      {/* Top Header Bar (Attached flush to window top, auto-hides) */}
      <Header
        currentTrackTitle={currentTrack?.title}
        isPlaylistOpen={isPlaylistOpen}
        isInspectorOpen={isInspectorOpen}
        isVisible={isTopBarVisible}
        onTogglePlaylist={() => setIsPlaylistOpen((prev) => !prev)}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        onFilesSelected={handleFilesSelected}
        onMouseEnter={() => setIsTopBarVisible(true)}
      />

      {/* Left Drawer: Playlist & Library */}
      <PlaylistDrawer
        isOpen={isPlaylistOpen}
        tracks={tracks}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onClose={() => setIsPlaylistOpen(false)}
        onSelectTrack={(t) => loadTrack(t, true)}
        onClearPlaylist={() => setTracks([])}
        onLoadTestTrack={() => {
          if (!tracks.some((t) => t.id === BUNDLED_TEST_TRACK.id)) {
            setTracks((prev) => [...prev, BUNDLED_TEST_TRACK]);
          }
          loadTrack(BUNDLED_TEST_TRACK, true);
        }}
        onDropFiles={handleFilesSelected}
      />

      {/* Right Drawer: Audio & Visual Inspector */}
      <InspectorDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        getLiveFeatures={() =>
          audioEngineRef.current?.getLiveFeatures() || {
            timeSeconds: 0,
            rms: 0,
            bass: 0,
            lowMid: 0,
            highMid: 0,
            treble: 0,
            spectralCentroid: 0.5,
            onsetStrength: 0,
            beatConfidence: 0,
            isBeat: false,
            frequencyData: new Uint8Array(1024),
            timeDomainData: new Uint8Array(1024),
          }
        }
        settings={visualSettings}
        onUpdateSettings={handleUpdateVisualSettings}
        effectsList={effectsList}
        onToggleEffect={handleToggleEffect}
        currentSection={currentSection}
        detectedBpm={currentTrack?.analysis?.estimatedBpm || 0}
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
