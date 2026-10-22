"""
Synwave Spotlight Audio-Reactive Movement & Frequency Pre-Analysis Engine
========================================================================

Performs offline DSP acoustic pre-analysis on neural audio STEMs (Demucs) to coordinate
concert moving-head stage lights framing the YouTube stage screen:

1. Frequency Extraction:
   - Tracks continuous spectral frequencies of Instrument and Bass stems across all
     timestamps (in milliseconds) throughout the entire track.
   - Computes global min, max, and midpoint average ((max + min) / 2) frequencies.

2. 360° Angular Distribution:
   - Distributes the continuous Instrument frequency range into full [0°, 360°] rotation angles.
   - Synchronizes Left side spotlights together.
   - Synchronizes Right side spotlights together with opposite rotation angles (-θ).
   - Synchronizes Top side spotlights together.

3. Activation Threshold Logic:
   - Evaluates simultaneous threshold crossing: when both Instrument and Bass frequencies
     cross and rise above their respective average frequencies ((max + min) / 2) at the same
     time, all spotlights (including the 2 bottom white sky spotlights) turn ON.
   - Before this initial crossing, spotlights remain OFF.
   - When both frequencies drop below their respective averages, spotlights turn OFF.

4. Continuous Bass Glowing Factor:
   - Maps continuous Bass STEM frequency between min (0.0) and max (1.0).
   - Ensures continuous, silky-smooth glowing intensity across the timeline.

5. Kick STEM Transients:
   - Pinpoints drum / kick transient impacts from the Drums/Kick STEM.
   - Used by stage lights to snap to synchronized random projection directions and trigger
     intense white flash flare bursts on the 2 bottom white sky spotlights.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import torch

BASE_DIR = Path(__file__).resolve().parent
CACHE_BASE_DIR = BASE_DIR / ".synwave_cache"
AUDIO_CACHE_DIR = CACHE_BASE_DIR / "audio"
STEMS_CACHE_DIR = CACHE_BASE_DIR / "stems"


class SpotlightAnalyzer:
    """
    Offline DSP analysis engine for frequency-driven moving head stage lighting choreographies.
    """

    def __init__(self, target_fps: int = 25, win_length: int = 2048):
        self.target_fps = target_fps
        self.win_length = win_length

    @staticmethod
    def _to_mono(audio: np.ndarray | torch.Tensor) -> np.ndarray:
        """Convert multi-channel audio (torch.Tensor or np.ndarray) to 1D mono float32."""
        if isinstance(audio, torch.Tensor):
            if audio.ndim == 2:
                mono = audio.mean(dim=0).cpu().numpy()
            elif audio.ndim == 1:
                mono = audio.cpu().numpy()
            else:
                mono = audio.squeeze().cpu().numpy()
        else:
            arr = np.asarray(audio, dtype=np.float32)
            if arr.ndim == 2:
                # Average across channels
                mono = np.mean(arr, axis=0 if arr.shape[0] <= 4 else 1)
            else:
                mono = arr.flatten()
        return mono.astype(np.float32)

    def compute_continuous_frequency_trajectory(
        self,
        mono_audio: np.ndarray,
        sr: int,
        min_freq_bound: float,
        max_freq_bound: float,
        num_target_frames: int,
        centroid_weight: float = 0.65,
        peak_weight: float = 0.35,
    ) -> np.ndarray:
        """
        Calculates a continuous frequency trajectory (Hz) across target frame intervals
        using short-time Fourier transforms (STFT), bounded spectral centroids, and peak picking.
        Applies a temporal smoothing filter to guarantee mathematically continuous motion.
        """
        hop_length = int(sr / self.target_fps)
        total_samples = len(mono_audio)
        if total_samples == 0:
            return np.full(num_target_frames, (min_freq_bound + max_freq_bound) / 2.0, dtype=np.float32)

        # Pad or trim to fit num_target_frames
        expected_samples = num_target_frames * hop_length
        if total_samples < expected_samples:
            mono_audio = np.pad(mono_audio, (0, expected_samples - total_samples))
        elif total_samples > expected_samples:
            mono_audio = mono_audio[:expected_samples]

        tensor_mono = torch.from_numpy(mono_audio).unsqueeze(0)
        win = torch.hann_window(self.win_length)

        # Vectorized STFT computation
        spec = torch.stft(
            tensor_mono,
            n_fft=self.win_length,
            hop_length=hop_length,
            win_length=self.win_length,
            window=win,
            return_complex=True,
        )
        mag = torch.abs(spec[0]).cpu().numpy()  # shape: [n_bins, n_stft_frames]
        freq_bins = np.fft.rfftfreq(self.win_length, d=1.0 / sr)

        # Restrict to specified spectral band
        band_mask = (freq_bins >= min_freq_bound) & (freq_bins <= max_freq_bound)
        band_bins = freq_bins[band_mask]
        band_mag = mag[band_mask, :]

        # Spectral power per frame
        power = np.sum(band_mag, axis=0) + 1e-9
        # Spectral centroid
        centroids = np.sum(band_bins[:, None] * band_mag, axis=0) / power

        # Dominant peak frequency
        peak_indices = np.argmax(band_mag, axis=0)
        peaks = band_bins[peak_indices]

        # Blend centroid and peak for rich harmonic sensitivity
        blended = centroid_weight * centroids + peak_weight * peaks

        # Match exact target frames count
        if len(blended) < num_target_frames:
            blended = np.pad(blended, (0, num_target_frames - len(blended)), mode="edge")
        elif len(blended) > num_target_frames:
            blended = blended[:num_target_frames]

        # Apply continuous temporal smoothing (Hann window convolution)
        kernel_size = 5
        kernel = np.hanning(kernel_size)
        kernel = kernel / np.sum(kernel)
        smooth_freq = np.convolve(blended, kernel, mode="same")

        return smooth_freq.astype(np.float32)

    def extract_kick_transients(
        self,
        drums_mono: np.ndarray,
        sr: int,
        num_target_frames: int,
    ) -> List[Dict[str, Any]]:
        """
        Extracts synchronized kick events from Drums/Kick stem with exact millisecond timestamps.
        """
        hop_length = int(sr / self.target_fps)
        total_samples = len(drums_mono)
        if total_samples < hop_length * 2:
            return []

        num_frames = min(num_target_frames, total_samples // hop_length)
        trimmed = drums_mono[:num_frames * hop_length].reshape(num_frames, hop_length)

        # RMS energy envelope per frame
        rms = np.sqrt(np.mean(trimmed ** 2, axis=1) + 1e-9)
        p98 = np.percentile(rms, 98) if len(rms) > 0 and np.percentile(rms, 98) > 0 else 1.0
        norm_rms = np.clip(rms / (p98 * 1.15), 0.0, 1.0)

        # Transient detection via forward difference
        diff = np.diff(norm_rms, prepend=norm_rms[0])
        kicks: List[Dict[str, Any]] = []

        for i, d in enumerate(diff):
            if d > 0.16 and norm_rms[i] > 0.28:
                t_sec = round(i / self.target_fps, 3)
                t_ms = int(round(i * 1000.0 / self.target_fps))
                kicks.append({
                    "time": t_sec,
                    "timestampMs": t_ms,
                    "intensity": round(float(norm_rms[i]), 3),
                })

        return kicks

    def analyze_song_segments(self, audio_path: str | Path) -> List[Dict[str, Any]]:
        """
        Uses mir-aidj/all-in-one (allin1_infer) to find timestamps of particular segments in a song.
        Extracts functional music structure segments (verse, chorus, bridge, break, inst, etc.).
        """
        path = Path(audio_path)
        if not path.exists():
            return []

        try:
            try:
                import allin1_infer as allin1_mod
            except ImportError:
                import allin1 as allin1_mod

            print(f"[SpotlightAnalyzer] Running all-in-one music structure segmentation on {path.name}...")
            result = allin1_mod.analyze(str(path), device="cpu")
            segments: List[Dict[str, Any]] = []
            for s in result.segments:
                segments.append({
                    "label": s.label,
                    "start": round(float(s.start), 3),
                    "end": round(float(s.end), 3),
                    "startMs": int(round(s.start * 1000.0)),
                    "endMs": int(round(s.end * 1000.0)),
                })
            verse_count = sum(1 for s in segments if str(s.get("label", "")).lower() == "verse")
            print(f"[SpotlightAnalyzer] all-in-one detected {len(segments)} segments ({verse_count} verses).")
            return segments
        except Exception as e:
            print(f"[SpotlightAnalyzer] Note: all-in-one segmentation skipped or error: {e}")
            return []

    def analyze_stems_audio(
        self,
        instruments_audio: np.ndarray | torch.Tensor,
        bass_audio: np.ndarray | torch.Tensor,
        drums_audio: Optional[np.ndarray | torch.Tensor] = None,
        sr: int = 44100,
        audio_path: Optional[str | Path] = None,
        segments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Performs the complete pre-analysis on extracted Instrument and Bass STEM waveforms:
        - Continuous frequencies of Instrument and Bass stems against timestamp in milliseconds.
        - Computes min, max, and midpoint average ((max + min) / 2) for both STEMs.
        - Distributes Instrument frequency across 360 degrees for spotlight movements.
        - Uses all-in-one (mir-aidj/all-in-one) to detect song segments:
          The spotlights should get turned on ONLY in verses.
        - Maps continuous Bass frequency to [0.0, 1.0] glowing intensity factor.
        - Pinpoints Kick STEM transients for synchronized random beam directions.
        """
        inst_mono = self._to_mono(instruments_audio)
        bass_mono = self._to_mono(bass_audio)
        drums_mono = self._to_mono(drums_audio) if drums_audio is not None else None

        hop_length = int(sr / self.target_fps)
        total_len = max(len(inst_mono), len(bass_mono))
        num_frames = max(1, total_len // hop_length)
        duration_sec = round(num_frames / self.target_fps, 2)

        # 0. Segment Analysis using mir-aidj/all-in-one (if audio_path is provided and segments not already supplied)
        if segments is None and audio_path is not None:
            segments = self.analyze_song_segments(audio_path)

        # 1. Frequency calculation for Instrument STEM (150 Hz to 7500 Hz)
        inst_freqs = self.compute_continuous_frequency_trajectory(
            inst_mono,
            sr=sr,
            min_freq_bound=150.0,
            max_freq_bound=7500.0,
            num_target_frames=num_frames,
            centroid_weight=0.65,
            peak_weight=0.35,
        )

        # 2. Frequency calculation for Bass STEM (25 Hz to 450 Hz)
        bass_freqs = self.compute_continuous_frequency_trajectory(
            bass_mono,
            sr=sr,
            min_freq_bound=25.0,
            max_freq_bound=450.0,
            num_target_frames=num_frames,
            centroid_weight=0.55,
            peak_weight=0.45,
        )

        # 3. Find max, min, and average ((max + min) / 2) values
        inst_min = float(np.min(inst_freqs))
        inst_max = float(np.max(inst_freqs))
        inst_span = max(1.0, inst_max - inst_min)
        inst_avg = (inst_min + inst_max) / 2.0

        bass_min = float(np.min(bass_freqs))
        bass_max = float(np.max(bass_freqs))
        bass_span = max(1.0, bass_max - bass_min)
        bass_avg = (bass_min + bass_max) / 2.0

        # 4. Generate timestamp array (milliseconds)
        timestamps_ms = [int(round(i * 1000.0 / self.target_fps)) for i in range(num_frames)]

        # 5. Distribute Instrument frequency range across 360 degrees (remember 1)
        # norm_inst maps smoothly from 0.0 to 1.0; multiplied by 360 degrees
        norm_inst = np.clip((inst_freqs - inst_min) / inst_span, 0.0, 1.0)
        movement_angles_deg = [round(float(deg), 2) for deg in (norm_inst * 360.0)]

        # Secondary 360° distribution for bass (for dual-frequency visual dynamics)
        norm_bass = np.clip((bass_freqs - bass_min) / bass_span, 0.0, 1.0)
        bass_angles_deg = [round(float(deg), 2) for deg in (norm_bass * 360.0)]

        # 6. Continuous glowing factor across [0.0, 1.0] based on Bass STEM frequency
        # Min frequency -> 0.0, Max frequency -> 1.0. Continuous across timeline.
        glowing_factors = [round(float(g), 4) for g in norm_bass]

        # 7. Activation state:
        # "Use this github https://github.com/mir-aidj/all-in-one to find out timestamp of particular
        #  segments in a song. The spotlights should get turned on only in verses."
        verse_intervals = [
            (s["start"], s["end"])
            for s in (segments or [])
            if str(s.get("label", "")).lower() == "verse"
        ]

        spotlights_active: List[bool] = []
        for i in range(num_frames):
            t_sec = i / self.target_fps
            if verse_intervals:
                # Active strictly when current timestamp is within any verse segment
                is_active = any(v_start <= t_sec <= v_end for v_start, v_end in verse_intervals)
            else:
                # Fallback if no verse annotations available: dual-stem average crossing
                fi = float(inst_freqs[i])
                fb = float(bass_freqs[i])
                is_active = fi >= inst_avg and fb >= bass_avg

            spotlights_active.append(is_active)

        # 8. Kick transients from Drums STEM
        kick_events = (
            self.extract_kick_transients(drums_mono, sr=sr, num_target_frames=num_frames)
            if drums_mono is not None
            else []
        )

        return {
            "fps": self.target_fps,
            "durationSeconds": duration_sec,
            "frameCount": num_frames,
            "instMinFreq": round(inst_min, 2),
            "instMaxFreq": round(inst_max, 2),
            "instAvgFreq": round(inst_avg, 2),
            "bassMinFreq": round(bass_min, 2),
            "bassMaxFreq": round(bass_max, 2),
            "bassAvgFreq": round(bass_avg, 2),
            "timestampsMs": timestamps_ms,
            "instFrequencies": [round(float(f), 1) for f in inst_freqs],
            "bassFrequencies": [round(float(f), 1) for f in bass_freqs],
            "movementAnglesDeg": movement_angles_deg,
            "bassAnglesDeg": bass_angles_deg,
            "glowingFactors": glowing_factors,
            "spotlightsActive": spotlights_active,
            "kickEvents": kick_events,
            "segments": segments or [],
            "verseSegments": [s for s in (segments or []) if str(s.get("label", "")).lower() == "verse"],
        }

    def analyze_audio_file(
        self,
        audio_path: str | Path,
        save_to_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Runs Demucs separation on an audio file and executes complete spotlight movement analysis.
        """
        from demucs_service import get_demucs_service

        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {path}")

        print(f"[SpotlightAnalyzer] Processing audio: {path.name}...")
        service = get_demucs_service()

        # Separate audio into 4 stems
        origin, separated = service.separator.separate_audio_file(path)
        sr = service.separator.samplerate

        # Perform spotlight analysis on separated stems with all-in-one song segment analysis
        analysis = self.analyze_stems_audio(
            instruments_audio=separated["other"],
            bass_audio=separated["bass"],
            drums_audio=separated["drums"],
            sr=sr,
            audio_path=path,
        )

        if save_to_cache:
            from demucs_service import load_stems_index
            index = load_stems_index()
            cache_id = path.stem
            candidates = [
                STEMS_CACHE_DIR / f"stems_{cache_id}.json",
                STEMS_CACHE_DIR / index.get(cache_id, ""),
                STEMS_CACHE_DIR / index.get(cache_id.replace("yt_", ""), ""),
            ]
            saved = False
            for stems_file in candidates:
                if stems_file.name and stems_file.exists():
                    try:
                        with open(stems_file, "r") as f:
                            data = json.load(f)
                        data["spotlightAnalysis"] = analysis
                        with open(stems_file, "w") as f:
                            json.dump(data, f)
                        print(f"[SpotlightAnalyzer] Updated cached stems with spotlight analysis: {stems_file.name}")
                        saved = True
                        break
                    except Exception as e:
                        print(f"[SpotlightAnalyzer] Note updating cache: {e}")
            if not saved:
                # Save standalone spotlight analysis file for this track
                out_path = STEMS_CACHE_DIR / f"spotlight_{cache_id}.json"
                try:
                    with open(out_path, "w") as f:
                        json.dump(analysis, f)
                    print(f"[SpotlightAnalyzer] Saved standalone spotlight analysis: {out_path.name}")
                except Exception as e:
                    print(f"[SpotlightAnalyzer] Note saving spotlight file: {e}")

        return analysis


# Global analyzer singleton
_spotlight_analyzer: Optional[SpotlightAnalyzer] = None


def get_spotlight_analyzer(target_fps: int = 25) -> SpotlightAnalyzer:
    global _spotlight_analyzer
    if _spotlight_analyzer is None or _spotlight_analyzer.target_fps != target_fps:
        _spotlight_analyzer = SpotlightAnalyzer(target_fps=target_fps)
    return _spotlight_analyzer


def analyze_spotlight_stems(
    instruments_audio: np.ndarray | torch.Tensor,
    bass_audio: np.ndarray | torch.Tensor,
    drums_audio: Optional[np.ndarray | torch.Tensor] = None,
    sr: int = 44100,
    target_fps: int = 25,
    audio_path: Optional[str | Path] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Helper functional API to analyze stem tensors."""
    analyzer = get_spotlight_analyzer(target_fps=target_fps)
    return analyzer.analyze_stems_audio(
        instruments_audio=instruments_audio,
        bass_audio=bass_audio,
        drums_audio=drums_audio,
        sr=sr,
        audio_path=audio_path,
        segments=segments,
    )


def main():
    """Command-line execution interface."""
    parser = argparse.ArgumentParser(
        description="Synwave Stage Spotlights Movement & Frequency Pre-Analysis"
    )
    parser.add_argument("audio_path", nargs="?", help="Path to WAV/MP3 audio file to analyze")
    parser.add_argument("--cache-id", help="Analyze cached WAV file by cache ID (e.g. yt_4IHDZ4_8oN0)")
    parser.add_argument("--all-cache", action="store_true", help="Batch analyze all WAV files in .synwave_cache/audio")
    parser.add_argument("--fps", type=int, default=25, help="Sampling rate FPS (default: 25)")
    parser.add_argument("--output", help="Save result to specified JSON output path")

    args = parser.parse_args()
    analyzer = get_spotlight_analyzer(target_fps=args.fps)

    if args.all_cache:
        wav_files = list(AUDIO_CACHE_DIR.glob("*.wav"))
        print(f"[SpotlightAnalyzer] Found {len(wav_files)} WAV tracks in cache.")
        for wf in wav_files:
            try:
                res = analyzer.analyze_audio_file(wf, save_to_cache=True)
                print(f" -> Completed {wf.name}: Inst Avg={res['instAvgFreq']}Hz, Bass Avg={res['bassAvgFreq']}Hz, Frames={res['frameCount']}")
            except Exception as e:
                print(f" -> Error analyzing {wf.name}: {e}")
        return

    target_path = None
    if args.cache_id:
        cand = AUDIO_CACHE_DIR / f"{args.cache_id}.wav"
        if not cand.exists():
            cand = AUDIO_CACHE_DIR / f"yt_{args.cache_id}.wav"
        target_path = cand
    elif args.audio_path:
        target_path = Path(args.audio_path)

    if not target_path or not target_path.exists():
        print("Error: Please provide a valid audio file or --cache-id / --all-cache.")
        sys.exit(1)

    result = analyzer.analyze_audio_file(target_path, save_to_cache=True)
    print("\n--- Synwave Spotlight Pre-Analysis Summary ---")
    print(f"File: {target_path.name}")
    print(f"Duration: {result['durationSeconds']}s ({result['frameCount']} frames @ {result['fps']} FPS)")
    print(f"Instrument STEM: Min={result['instMinFreq']}Hz, Max={result['instMaxFreq']}Hz, Avg={result['instAvgFreq']}Hz")
    print(f"Bass STEM:       Min={result['bassMinFreq']}Hz, Max={result['bassMaxFreq']}Hz, Avg={result['bassAvgFreq']}Hz")
    active_pct = round(sum(result['spotlightsActive']) / len(result['spotlightsActive']) * 100, 1)
    print(f"Spotlights Active: {active_pct}% of track timeline")
    print(f"Kick Events: {len(result['kickEvents'])} transient beats")

    if args.output:
        out_p = Path(args.output)
        with open(out_p, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Saved full JSON analysis to: {out_p}")


if __name__ == "__main__":
    main()
