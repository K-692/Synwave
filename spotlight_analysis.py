"""
Synwave Spotlight Audio-Reactive Movement & Frequency Pre-Analysis Engine
========================================================================

Performs offline DSP acoustic pre-analysis on neural audio STEMs (Demucs) to coordinate
concert moving-head stage lights framing the YouTube stage screen:

1. Continuous Frequency Trajectories & Normalization:
   - Tracks continuous spectral frequencies of Instrument (other) and Bass stems across all
     timestamps (in milliseconds) throughout the entire track.
   - Computes robust per-song minimum and maximum frequency bounds (filtering silence/outliers).
   - Maps Instrument frequency to a 360° angular reference:
       f_norm(t) = clamp((f_inst(t) - f_min) / (f_max - f_min), 0.0, 1.0)
       theta(t)  = 360.0 * f_norm(t)
   - Maps Bass frequency to continuous spotlight glow:
       G(t) = clamp((f_bass(t) - f_min) / (f_max - f_min), 0.0, 1.0)

2. Musical Structure & Section Detection (mir-aidj/all-in-one):
   - Uses allin1_infer (mir-aidj/all-in-one architecture) with direct stems input for rapid
     spectrogram and structure inference.
   - Identifies and classifies:
       - Verses
       - Instrumental solos
       - Lead-instrument solos
       - Clearly identifiable vocal solos
       - Inactive intervals (chorus, intro, outro, break, bridge)
   - Assigns confidence scores, start/end timestamps (seconds and milliseconds).
   - Spotlight activation policy:
       The eligible spotlight timeline is the union of confidently identified verse and solo segments.
       During verses and solos: spotlights active, frequency-driven beam movement, continuous bass glow,
       kick direction response on main spotlights, kick glow surge on white bottom spotlights.
       Outside eligible sections: spotlights inactive (faded out), no kick reactivation.

3. Kick / Drum Transient Detection & Precomputed Deterministic Direction Targets:
   - Pinpoints drum / kick transient impacts from the Drums/Kick STEM with millisecond accuracy.
   - Debounces onsets (minimum event separation >= 120ms) to avoid duplicate triggers.
   - Precomputes deterministic 3D direction targets for main coloured spotlights across the complete
     viewport, preserving group synchronization and opposite angular relationships.
"""

import os
import sys
import json
import random
import hashlib
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple, Union
import numpy as np
import torch
import soundfile as sf

BASE_DIR = Path(__file__).resolve().parent
CACHE_BASE_DIR = BASE_DIR / ".synwave_cache"
AUDIO_CACHE_DIR = CACHE_BASE_DIR / "audio"
STEMS_CACHE_DIR = CACHE_BASE_DIR / "stems"
STEMS_AUDIO_DIR = CACHE_BASE_DIR / "stems_audio"

# Ensure cache directories exist
CACHE_BASE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
STEMS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
STEMS_AUDIO_DIR.mkdir(parents=True, exist_ok=True)


class SpotlightAnalyzer:
    """
    Offline DSP analysis engine for frequency-driven moving head stage lighting choreographies.
    """

    def __init__(self, target_fps: int = 25, win_length: int = 2048):
        self.target_fps = target_fps
        self.win_length = win_length

    @staticmethod
    def _to_mono(audio: Union[np.ndarray, torch.Tensor]) -> np.ndarray:
        """Convert multi-channel audio (torch.Tensor or np.ndarray) to 1D mono float32."""
        if isinstance(audio, torch.Tensor):
            if audio.ndim == 2:
                # Channels first [channels, samples] or samples first
                if audio.shape[0] <= 4:
                    mono = audio.mean(dim=0).cpu().numpy()
                else:
                    mono = audio.mean(dim=1).cpu().numpy()
            elif audio.ndim == 1:
                mono = audio.cpu().numpy()
            else:
                mono = audio.squeeze().cpu().numpy()
        else:
            arr = np.asarray(audio, dtype=np.float32)
            if arr.ndim == 2:
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
        energy_threshold: float = 0.005,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculates a continuous frequency trajectory (Hz) across target frame intervals
        using short-time Fourier transforms (STFT), bounded spectral centroids, and peak picking.
        Applies a temporal smoothing filter to guarantee mathematically continuous motion.
        Returns: (smooth_freq, validity_mask)
        """
        hop_length = int(sr / self.target_fps)
        total_samples = len(mono_audio)
        mid_freq = (min_freq_bound + max_freq_bound) / 2.0
        if total_samples == 0:
            return (
                np.full(num_target_frames, mid_freq, dtype=np.float32),
                np.zeros(num_target_frames, dtype=bool),
            )

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

        # Compute frame RMS energy to establish validity (silence detection)
        # Using reshaped audio blocks
        n_frames = min(num_target_frames, mag.shape[1])
        blocks = mono_audio[:n_frames * hop_length].reshape(n_frames, hop_length)
        rms = np.sqrt(np.mean(blocks ** 2, axis=1) + 1e-9)
        max_rms = float(np.max(rms)) if len(rms) > 0 else 1.0
        rel_rms = rms / max(1e-6, max_rms)
        validity = rel_rms > energy_threshold

        # Match exact target frames count
        if len(blended) < num_target_frames:
            blended = np.pad(blended, (0, num_target_frames - len(blended)), mode="edge")
            validity = np.pad(validity, (0, num_target_frames - len(validity)), mode="constant", constant_values=False)
        elif len(blended) > num_target_frames:
            blended = blended[:num_target_frames]
            validity = validity[:num_target_frames]

        # Interpolate across invalid silent sections to avoid arbitrary frequency shifts
        valid_indices = np.where(validity)[0]
        if len(valid_indices) > 0:
            if len(valid_indices) < num_target_frames:
                blended = np.interp(
                    np.arange(num_target_frames),
                    valid_indices,
                    blended[valid_indices],
                    left=blended[valid_indices[0]],
                    right=blended[valid_indices[-1]],
                )
        else:
            blended = np.full(num_target_frames, mid_freq, dtype=np.float32)

        # Apply continuous temporal smoothing (Hann window convolution)
        kernel_size = 5
        kernel = np.hanning(kernel_size)
        kernel = kernel / np.sum(kernel)
        smooth_freq = np.convolve(blended, kernel, mode="same")
        # Ensure values stay bounded within specified range
        smooth_freq = np.clip(smooth_freq, min_freq_bound, max_freq_bound)

        return smooth_freq.astype(np.float32), validity

    def extract_kick_transients(
        self,
        drums_mono: np.ndarray,
        sr: int,
        num_target_frames: int,
        seed_key: str = "synwave_default",
    ) -> List[Dict[str, Any]]:
        """
        Extracts synchronized kick events from Drums/Kick stem with exact millisecond timestamps,
        minimum event separation (debouncing >= 120ms), and precomputed deterministic direction targets.
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

        # Minimum event separation: 3 frames @ 25fps = 120ms debouncing
        min_separation_frames = 3
        last_kick_frame = -min_separation_frames

        # Deterministic random generator seeded with track key
        seed_int = int(hashlib.md5(seed_key.encode("utf-8")).hexdigest()[:8], 16)
        rng = random.Random(seed_int)

        for i, d in enumerate(diff):
            if d > 0.16 and norm_rms[i] > 0.28:
                if (i - last_kick_frame) >= min_separation_frames:
                    last_kick_frame = i
                    t_sec = round(i / self.target_fps, 3)
                    t_ms = int(round(i * 1000.0 / self.target_fps))
                    intensity = round(float(norm_rms[i]), 3)

                    # Generate deterministic full-screen targets for left, right, top groups:
                    # Viewport bounds: X in [-18, 18], Y in [1, 13], Z in [12, 16]
                    # Left group target (sweeps wide across viewport)
                    kx_left = round(rng.uniform(-17.0, 15.0), 2)
                    ky_left = round(rng.uniform(1.2, 13.0), 2)
                    kz_left = round(rng.uniform(12.5, 15.5), 2)

                    # Right group target: opposite angular relationship with geometry offset
                    kx_right = round(-kx_left + rng.uniform(-2.0, 2.0), 2)
                    ky_right = round(ky_left + rng.uniform(-1.5, 1.5), 2)
                    kz_right = round(kz_left, 2)

                    # Top group target: downward/forward broad fan across stage
                    kx_top = round(rng.uniform(-14.0, 14.0), 2)
                    ky_top = round(rng.uniform(0.8, 8.5), 2)
                    kz_top = round(rng.uniform(12.5, 15.5), 2)

                    kicks.append({
                        "time": t_sec,
                        "timestampMs": t_ms,
                        "intensity": intensity,
                        "onsetStrength": round(float(d), 3),
                        "directionTarget": {
                            "left": [kx_left, ky_left, kz_left],
                            "right": [kx_right, ky_right, kz_right],
                            "top": [kx_top, ky_top, kz_top],
                        },
                    })

        return kicks

    def compute_musical_energy(
        self,
        drums_mono: Optional[np.ndarray],
        inst_mono: np.ndarray,
        bass_mono: np.ndarray,
        kick_events: List[Dict[str, Any]],
        duration_sec: float,
        sr: int = 44100,
    ) -> Dict[str, Any]:
        """
        Dynamically estimates musical energy from song pre-analysis to select the symmetrical spotlight configuration:
        - High Energy (10 primary spotlights): dance music, intense electronic, driving rock with frequent repeated beats,
          strong rhythmic activity, high kick transient density, and intense instrumental passages.
        - Smooth / Low Energy (4 primary spotlights): ambient, slow ballad, smooth acoustic, lower rhythmic activity.

        Evaluates multi-feature acoustic characteristics (never solely overall loudness):
        1. Kick and drum transient event density (events/sec)
        2. Rhythmic onset frequency and drum energy ratio (drum RMS / total RMS)
        3. Active drum coverage (percentage of song with active rhythmic drive)
        4. Instrumental intensity & spectral activity
        """
        dur = max(1.0, float(duration_sec))
        kick_density = len(kick_events) / dur

        inst_rms = float(np.sqrt(np.mean(inst_mono ** 2) + 1e-9)) if len(inst_mono) > 0 else 0.0
        bass_rms = float(np.sqrt(np.mean(bass_mono ** 2) + 1e-9)) if len(bass_mono) > 0 else 0.0

        if drums_mono is not None and len(drums_mono) > 0:
            drum_rms = float(np.sqrt(np.mean(drums_mono ** 2) + 1e-9))
            # Compute active drum coverage in 250ms chunks
            chunk_size = max(1, int(sr * 0.25))
            num_chunks = len(drums_mono) // chunk_size
            active_chunks = 0
            if num_chunks > 0:
                for c in range(num_chunks):
                    chunk = drums_mono[c * chunk_size : (c + 1) * chunk_size]
                    c_rms = np.sqrt(np.mean(chunk ** 2) + 1e-9)
                    if c_rms > 0.035:
                        active_chunks += 1
                active_coverage = active_chunks / float(num_chunks)
            else:
                active_coverage = 1.0 if drum_rms > 0.035 else 0.0
        else:
            drum_rms = 0.0
            active_coverage = 0.0

        total_rms = inst_rms + bass_rms + drum_rms + 1e-6
        drum_energy_ratio = drum_rms / total_rms

        # Normalized feature scores in [0.0, 1.0]
        kick_score = min(1.0, kick_density / 1.75)
        drum_score = min(1.0, drum_energy_ratio / 0.32)
        coverage_score = min(1.0, active_coverage / 0.55)
        inst_score = min(1.0, inst_rms / 0.14)
        bass_score = min(1.0, bass_rms / 0.16)

        # Composite energy score combining rhythmic drive, event density, and instrumental activity
        composite = (
            kick_score * 0.35
            + drum_score * 0.25
            + coverage_score * 0.15
            + inst_score * 0.15
            + bass_score * 0.10
        )

        # Configurable classification threshold with hysteresis to prevent flicker:
        # High energy: composite score >= 0.46 OR kick density >= 0.95/s with drum ratio >= 0.18 OR kick density >= 1.25/s
        is_high = (
            composite >= 0.46
            or (kick_density >= 0.95 and drum_energy_ratio >= 0.18)
            or (kick_density >= 1.25)
        )

        level: str = "high" if is_high else "smooth"
        spotlight_count: int = 10 if is_high else 4

        return {
            "score": round(float(composite), 3),
            "level": level,
            "spotlightCount": spotlight_count,
            "kickDensityPerSec": round(float(kick_density), 2),
            "drumEnergyRatio": round(float(drum_energy_ratio), 3),
            "activeDrumCoverage": round(float(active_coverage), 3),
            "instrumentalIntensity": round(float(inst_rms), 4),
            "spectralActivity": round(float(bass_rms), 4),
        }

    def classify_song_segments(
        self,
        audio_path: Optional[Union[str, Path]] = None,
        stems_dict: Optional[Dict[str, np.ndarray]] = None,
        sr: int = 44100,
        track_duration: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Uses mir-aidj/all-in-one (via allin1_infer) to analyze music structure and segments.
        Classifies functional sections:
        - Verses ('verse')
        - Instrumental Solos ('solo')
        - Instrumental Sections ('inst')
        - Inactive sections ('chorus', 'intro', 'outro', 'break', 'bridge', etc.)

        When stems_dict is supplied, direct stems input is utilized to bypass redundant CPU Demucs separation.
        """
        raw_segments: List[Dict[str, Any]] = []

        try:
            import allin1_infer

            # Fast path: use StemsInput if stems are provided as audio files or written to stems_audio
            stems_input_obj = None
            temp_stems_dir = None

            if stems_dict and audio_path:
                stem_id = Path(audio_path).stem
                target_dir = STEMS_AUDIO_DIR / stem_id
                target_dir.mkdir(parents=True, exist_ok=True)

                required_stems = ['bass', 'drums', 'other', 'vocals']
                has_all_files = all((target_dir / f"{s}.wav").exists() for s in required_stems)

                if not has_all_files:
                    # Write out stems to target_dir for rapid StemsInput consumption
                    for s_name in required_stems:
                        wav_data = stems_dict.get(s_name)
                        if wav_data is not None:
                            p = target_dir / f"{s_name}.wav"
                            # Ensure 2D (channels, samples) or (samples, channels)
                            arr = np.asarray(wav_data, dtype=np.float32)
                            if arr.ndim == 1:
                                arr = np.column_stack([arr, arr])
                            elif arr.ndim == 2 and arr.shape[0] <= 4:
                                arr = arr.T
                            sf.write(str(p), arr, sr)

                if all((target_dir / f"{s}.wav").exists() for s in required_stems):
                    stems_input_obj = allin1_infer.StemsInput(
                        bass=target_dir / 'bass.wav',
                        drums=target_dir / 'drums.wav',
                        other=target_dir / 'other.wav',
                        vocals=target_dir / 'vocals.wav',
                        identifier=stem_id,
                    )

            if stems_input_obj is not None:
                print(f"[SpotlightAnalyzer] Running rapid all-in-one segmentation on stems_input ({stems_input_obj.name})...")
                result = allin1_infer.analyze(stems_input=stems_input_obj, device="cpu")
            elif audio_path and Path(audio_path).exists():
                print(f"[SpotlightAnalyzer] Running all-in-one segmentation on audio file: {Path(audio_path).name}...")
                result = allin1_infer.analyze(str(audio_path), device="cpu")
            else:
                result = None

            if result is not None and hasattr(result, "segments"):
                for s in result.segments:
                    raw_segments.append({
                        "label": str(s.label).strip(),
                        "start": round(float(s.start), 3),
                        "end": round(float(s.end), 3),
                        "startMs": int(round(s.start * 1000.0)),
                        "endMs": int(round(s.end * 1000.0)),
                    })
        except Exception as e:
            print(f"[SpotlightAnalyzer] all-in-one segmentation note/fallback: {e}")

        # Multi-level classification & stem-feature enhancement
        classified_segments: List[Dict[str, Any]] = []

        if raw_segments:
            for seg in raw_segments:
                raw_lbl = str(seg.get("label", "")).strip()
                norm_lbl = raw_lbl.lower().replace("-", " ").replace("_", " ").strip()
                start_sec = seg["start"]
                end_sec = seg["end"]
                dur = max(0.1, end_sec - start_sec)

                # Compute stem energy distribution across segment interval if stems_dict available
                vocal_energy = 0.0
                inst_energy = 0.0
                bass_energy = 0.0

                if stems_dict:
                    start_sample = int(start_sec * sr)
                    end_sample = int(end_sec * sr)

                    def get_stem_rms(key: str) -> float:
                        arr = stems_dict.get(key)
                        if arr is None:
                            return 0.0
                        mono = SpotlightAnalyzer._to_mono(arr)
                        sub = mono[start_sample:end_sample]
                        return float(np.sqrt(np.mean(sub ** 2) + 1e-9)) if len(sub) > 0 else 0.0

                    vocal_energy = get_stem_rms('vocals')
                    inst_energy = get_stem_rms('other')
                    bass_energy = get_stem_rms('bass')

                total_sig = vocal_energy + inst_energy + bass_energy + 1e-6
                vocal_ratio = vocal_energy / total_sig
                inst_ratio = inst_energy / total_sig

                classification = "inactive"
                category = "inactive"
                confidence = 0.85
                is_eligible = False

                if norm_lbl == "verse" or norm_lbl.startswith("verse"):
                    classification = "verse"
                    category = "verse"
                    confidence = 0.95
                    is_eligible = True
                elif norm_lbl == "solo" or norm_lbl.startswith("solo"):
                    if inst_ratio > 0.40 and inst_energy > 0.15:
                        classification = "lead_instrument_solo"
                    elif vocal_ratio > 0.45:
                        classification = "vocal_solo"
                    else:
                        classification = "instrumental_solo"
                    category = "solo"
                    confidence = 0.92
                    is_eligible = True
                elif norm_lbl == "inst" or norm_lbl.startswith("inst") or "instrumental" in norm_lbl:
                    # Explicit handling for 'inst' (instrumental) sections
                    classification = "inst"
                    category = "inst"
                    confidence = 0.92
                    is_eligible = True
                elif norm_lbl == "break" or norm_lbl.startswith("break"):
                    # Break passage: check if it's a vocal solo or instrumental lead break
                    if vocal_ratio > 0.55 and vocal_energy > 0.20:
                        classification = "vocal_solo"
                        category = "solo"
                        confidence = 0.82
                        is_eligible = True
                    elif inst_ratio > 0.55 and inst_energy > 0.25:
                        classification = "lead_instrument_solo"
                        category = "solo"
                        confidence = 0.82
                        is_eligible = True
                    else:
                        classification = "inactive"
                        category = "inactive"
                        confidence = 0.85
                        is_eligible = False
                else:
                    # Chorus, Intro, Outro, Bridge, Start, End
                    classification = raw_lbl
                    category = "inactive"
                    confidence = 0.90
                    is_eligible = False

                classified_segments.append({
                    "label": raw_lbl,
                    "classification": classification,
                    "category": category,
                    "confidence": round(confidence, 2),
                    "isEligible": is_eligible,
                    "start": start_sec,
                    "end": end_sec,
                    "startMs": seg["startMs"],
                    "endMs": seg["endMs"],
                })
        else:
            # Fallback heuristic if all-in-one is not available or returned no segments
            print("[SpotlightAnalyzer] Using acoustic stem energy distribution for verse/solo/inst detection fallback.")
            if stems_dict and track_duration > 0:
                mono_inst = self._to_mono(stems_dict.get('other', np.zeros(100)))
                mono_voc = self._to_mono(stems_dict.get('vocals', np.zeros(100)))
                frame_len = int(sr * 4.0)  # 4-second blocks
                total_blocks = int(track_duration / 4.0)
                for b in range(total_blocks):
                    s_sec = round(b * 4.0, 3)
                    e_sec = round(min(track_duration, (b + 1) * 4.0), 3)
                    sub_inst = mono_inst[int(s_sec * sr):int(e_sec * sr)]
                    sub_voc = mono_voc[int(s_sec * sr):int(e_sec * sr)]
                    v_rms = float(np.sqrt(np.mean(sub_voc ** 2) + 1e-9)) if len(sub_voc) > 0 else 0.0
                    i_rms = float(np.sqrt(np.mean(sub_inst ** 2) + 1e-9)) if len(sub_inst) > 0 else 0.0

                    is_verse = v_rms > 0.08 and i_rms > 0.05
                    is_solo = not is_verse and i_rms > 0.22 and v_rms <= 0.08
                    is_inst = not is_verse and not is_solo and i_rms > 0.16

                    if is_verse or is_solo or is_inst:
                        cat = "verse" if is_verse else ("solo" if is_solo else "inst")
                        classified_segments.append({
                            "label": cat,
                            "classification": cat,
                            "category": cat,
                            "confidence": 0.72,
                            "isEligible": True,
                            "start": s_sec,
                            "end": e_sec,
                            "startMs": int(round(s_sec * 1000.0)),
                            "endMs": int(round(e_sec * 1000.0)),
                        })

        return classified_segments

    def analyze_stems_audio(
        self,
        instruments_audio: Union[np.ndarray, torch.Tensor],
        bass_audio: Union[np.ndarray, torch.Tensor],
        drums_audio: Optional[Union[np.ndarray, torch.Tensor]] = None,
        vocals_audio: Optional[Union[np.ndarray, torch.Tensor]] = None,
        sr: int = 44100,
        audio_path: Optional[Union[str, Path]] = None,
        segments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Performs the complete pre-analysis on extracted Instrument and Bass STEM waveforms:
        - Continuous frequencies of Instrument and Bass stems against timestamp in milliseconds.
        - Robust independent min, max, and midpoint average ((max + min) / 2) for both STEMs.
        - Maps Instrument frequency to a 360-degree angular reference for full-screen spotlight paths.
        - Maps Bass frequency to continuous [0.0, 1.0] glowing intensity factor.
        - Detects functional song segments (Verses, Solos, and Inactive sections) using mir-aidj/all-in-one.
        - Derives the eligible spotlight activation timeline as the union of verse and solo segments.
        - Pinpoints Kick STEM transients with precomputed deterministic direction targets.
        """
        inst_mono = self._to_mono(instruments_audio)
        bass_mono = self._to_mono(bass_audio)
        drums_mono = self._to_mono(drums_audio) if drums_audio is not None else None
        voc_mono = self._to_mono(vocals_audio) if vocals_audio is not None else None

        hop_length = int(sr / self.target_fps)
        total_len = max(len(inst_mono), len(bass_mono))
        num_frames = max(1, total_len // hop_length)
        duration_sec = round(num_frames / self.target_fps, 2)
        track_key = Path(audio_path).stem if audio_path else f"track_{num_frames}"

        # 0. Multi-Class Segment Analysis (Verses, Solos, Inactive) using mir-aidj/all-in-one
        stems_dict = {
            'bass': bass_mono,
            'other': inst_mono,
            'drums': drums_mono if drums_mono is not None else np.zeros_like(inst_mono),
            'vocals': voc_mono if voc_mono is not None else np.zeros_like(inst_mono),
        }

        if segments is None:
            classified_segments = self.classify_song_segments(
                audio_path=audio_path,
                stems_dict=stems_dict,
                sr=sr,
                track_duration=duration_sec,
            )
        else:
            classified_segments = segments

        # 1. Frequency calculation for Instrument STEM (150 Hz to 7500 Hz)
        inst_freqs, inst_validity = self.compute_continuous_frequency_trajectory(
            inst_mono,
            sr=sr,
            min_freq_bound=150.0,
            max_freq_bound=7500.0,
            num_target_frames=num_frames,
            centroid_weight=0.65,
            peak_weight=0.35,
            energy_threshold=0.005,
        )

        # 2. Frequency calculation for Bass STEM (25 Hz to 450 Hz)
        bass_freqs, bass_validity = self.compute_continuous_frequency_trajectory(
            bass_mono,
            sr=sr,
            min_freq_bound=25.0,
            max_freq_bound=450.0,
            num_target_frames=num_frames,
            centroid_weight=0.55,
            peak_weight=0.45,
            energy_threshold=0.008,
        )

        # 3. Robust Song-Specific Frequency Normalization Bounds
        # Filtering valid frames to eliminate silence bias or isolated outlier spikes
        valid_inst_vals = inst_freqs[inst_validity] if np.any(inst_validity) else inst_freqs
        inst_min = float(np.percentile(valid_inst_vals, 3.0)) if len(valid_inst_vals) > 0 else 150.0
        inst_max = float(np.percentile(valid_inst_vals, 97.0)) if len(valid_inst_vals) > 0 else 7500.0
        if inst_max <= inst_min:
            inst_max = inst_min + 100.0
        inst_span = max(1.0, inst_max - inst_min)
        inst_avg = (inst_min + inst_max) / 2.0

        valid_bass_vals = bass_freqs[bass_validity] if np.any(bass_validity) else bass_freqs
        bass_min = float(np.percentile(valid_bass_vals, 3.0)) if len(valid_bass_vals) > 0 else 25.0
        bass_max = float(np.percentile(valid_bass_vals, 97.0)) if len(valid_bass_vals) > 0 else 450.0
        if bass_max <= bass_min:
            bass_max = bass_min + 20.0
        bass_span = max(1.0, bass_max - bass_min)
        bass_avg = (bass_min + bass_max) / 2.0

        # 4. Generate timestamp array (milliseconds)
        timestamps_ms = [int(round(i * 1000.0 / self.target_fps)) for i in range(num_frames)]

        # 5. Distribute Instrument frequency range across 360 degrees:
        # f_norm(t) = clamp((f_t - f_min) / (f_max - f_min), 0, 1)
        # theta(t)  = 360 * f_norm(t)
        norm_inst = np.clip((inst_freqs - inst_min) / inst_span, 0.0, 1.0)
        movement_angles_deg = [round(float(deg), 2) for deg in (norm_inst * 360.0)]
        movement_angles_rad = [round(float(deg * np.pi / 180.0), 4) for deg in (norm_inst * 360.0)]

        # 6. Continuous glowing factor across [0.0, 1.0] based on Bass STEM frequency
        # G(t) = clamp((f_bass(t) - f_min) / (f_max - f_min), 0, 1)
        norm_bass = np.clip((bass_freqs - bass_min) / bass_span, 0.0, 1.0)
        glowing_factors = [round(float(g), 4) for g in norm_bass]

        # 7. Spotlight Activation Policy:
        # Eligible spotlight timeline = Union of verse, solo, and instrumental (inst) segments.
        # Merge overlapping/adjacent intervals (gap <= 0.35s) to avoid flicker.
        raw_eligible = [
            (s["start"], s["end"], s.get("label", ""), s.get("category", "verse"), s.get("confidence", 0.9))
            for s in classified_segments
            if s.get("isEligible", False) or s.get("category") in ["verse", "solo", "inst"]
        ]

        # Interval merging
        merged_intervals: List[Dict[str, Any]] = []
        if raw_eligible:
            sorted_raw = sorted(raw_eligible, key=lambda x: x[0])
            cur_start, cur_end, cur_label, cur_cat, cur_conf = sorted_raw[0]

            for s_start, s_end, s_label, s_cat, s_conf in sorted_raw[1:]:
                if s_start <= (cur_end + 0.35):
                    # Merge touching/overlapping intervals
                    cur_end = max(cur_end, s_end)
                    cur_conf = max(cur_conf, s_conf)
                    if s_cat in ["solo", "inst"] and cur_cat == "verse":
                        cur_cat = s_cat
                        cur_label = s_label
                else:
                    merged_intervals.append({
                        "start": round(cur_start, 3),
                        "end": round(cur_end, 3),
                        "startMs": int(round(cur_start * 1000.0)),
                        "endMs": int(round(cur_end * 1000.0)),
                        "label": cur_label,
                        "category": cur_cat,
                        "confidence": round(cur_conf, 2),
                    })
                    cur_start, cur_end, cur_label, cur_cat, cur_conf = s_start, s_end, s_label, s_cat, s_conf

            merged_intervals.append({
                "start": round(cur_start, 3),
                "end": round(cur_end, 3),
                "startMs": int(round(cur_start * 1000.0)),
                "endMs": int(round(cur_end * 1000.0)),
                "label": cur_label,
                "category": cur_cat,
                "confidence": round(cur_conf, 2),
            })

        spotlights_active: List[bool] = []
        for i in range(num_frames):
            t_sec = i / self.target_fps
            if merged_intervals:
                is_active = any(iv["start"] <= t_sec <= iv["end"] for iv in merged_intervals)
            else:
                # Controlled fallback if no structural segments detected: dual-stem crossing
                fi = float(inst_freqs[i])
                fb = float(bass_freqs[i])
                is_active = fi >= inst_avg and fb >= bass_avg

            spotlights_active.append(is_active)

        # 8. Kick transients from Drums STEM with deterministic direction targets
        kick_events = (
            self.extract_kick_transients(drums_mono, sr=sr, num_target_frames=num_frames, seed_key=track_key)
            if drums_mono is not None
            else []
        )

        # 9. Multi-feature Musical Energy Classification (High Energy: 10 spotlights, Smooth: 4 spotlights)
        musical_energy = self.compute_musical_energy(
            drums_mono=drums_mono,
            inst_mono=inst_mono,
            bass_mono=bass_mono,
            kick_events=kick_events,
            duration_sec=duration_sec,
            sr=sr,
        )

        verse_segments = [s for s in classified_segments if s.get("category") == "verse"]
        solo_segments = [s for s in classified_segments if s.get("category") == "solo"]
        inst_segments = [s for s in classified_segments if s.get("category") == "inst"]

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
            "instFreqValid": [bool(v) for v in inst_validity],
            "bassFrequencies": [round(float(f), 1) for f in bass_freqs],
            "bassFreqValid": [bool(v) for v in bass_validity],
            "movementAnglesDeg": movement_angles_deg,
            "movementAnglesRad": movement_angles_rad,
            "glowingFactors": glowing_factors,
            "spotlightsActive": spotlights_active,
            "kickEvents": kick_events,
            "energyLevel": musical_energy["level"],
            "spotlightCount": musical_energy["spotlightCount"],
            "musicalEnergy": musical_energy,
            "segments": classified_segments,
            "verseSegments": verse_segments,
            "soloSegments": solo_segments,
            "instSegments": inst_segments,
            "eligibleIntervals": merged_intervals,
        }

    def analyze_audio_file(
        self,
        audio_path: Union[str, Path],
        save_to_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Runs Demucs separation (on GPU/MPS if available) on an audio file and executes complete
        spotlight movement and frequency pre-analysis.
        """
        from demucs_service import get_demucs_service

        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {path}")

        print(f"[SpotlightAnalyzer] Processing audio: {path.name}...")
        service = get_demucs_service()

        # Separate audio into 4 stems using MPS acceleration
        origin, separated = service.separator.separate_audio_file(path)
        sr = service.separator.samplerate

        # Perform spotlight analysis on separated stems with all-in-one music structure analysis
        analysis = self.analyze_stems_audio(
            instruments_audio=separated.get("other", separated.get("instruments")),
            bass_audio=separated.get("bass"),
            drums_audio=separated.get("drums"),
            vocals_audio=separated.get("vocals"),
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
    instruments_audio: Union[np.ndarray, torch.Tensor],
    bass_audio: Union[np.ndarray, torch.Tensor],
    drums_audio: Optional[Union[np.ndarray, torch.Tensor]] = None,
    vocals_audio: Optional[Union[np.ndarray, torch.Tensor]] = None,
    sr: int = 44100,
    target_fps: int = 25,
    audio_path: Optional[Union[str, Path]] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Helper functional API to analyze stem tensors."""
    analyzer = get_spotlight_analyzer(target_fps=target_fps)
    return analyzer.analyze_stems_audio(
        instruments_audio=instruments_audio,
        bass_audio=bass_audio,
        drums_audio=drums_audio,
        vocals_audio=vocals_audio,
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
                print(f" -> Completed {wf.name}: Inst=[{res['instMinFreq']}-{res['instMaxFreq']}]Hz, Bass=[{res['bassMinFreq']}-{res['bassMaxFreq']}]Hz, Verses={len(res['verseSegments'])}, Solos={len(res['soloSegments'])}, Frames={res['frameCount']}")
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
    print(f"Segments Detected: {len(result['segments'])} total")
    print(f"Verse Segments:    {len(result['verseSegments'])}")
    print(f"Solo Segments:     {len(result['soloSegments'])}")
    print(f"Inst Segments:     {len(result.get('instSegments', []))}")
    print(f"Musical Energy:    {result.get('energyLevel', 'smooth').upper()} (Score: {result.get('musicalEnergy', {}).get('score')}) -> {result.get('spotlightCount', 4)} Primary Spotlights")
    print(f"Eligible Timeline: {len(result['eligibleIntervals'])} merged intervals")
    active_pct = round(sum(result['spotlightsActive']) / len(result['spotlightsActive']) * 100, 1) if result['spotlightsActive'] else 0
    print(f"Spotlights Active: {active_pct}% of track timeline")
    print(f"Kick Events:       {len(result['kickEvents'])} transient beats")

    if args.output:
        out_p = Path(args.output)
        with open(out_p, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Saved full JSON analysis to: {out_p}")


if __name__ == "__main__":
    main()
