"""
Synwave Demucs Stem Separation Service
Extracts high-fidelity stems (drums, bass, other/instruments, vocals)
from raw audio using Meta's Demucs (Hybrid Transformer HTDemucs).
Caches separated envelopes locally for instantaneous real-time playback synchronization.
"""

import os
import json
import hashlib
import time
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import torch
from demucs.api import Separator

# Absolute Cache directory for extracted stem envelopes
BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / ".syncwave_cache" / "stems"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class DemucsService:
    def __init__(self, model_name: str = "htdemucs"):
        """
        Initialize Demucs Separator on Apple Silicon MPS if available, otherwise CPU.
        """
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"[DemucsService] Initializing '{model_name}' on device: {self.device}")
        self.separator = Separator(
            model=model_name,
            device=self.device,
            segment=6,
            progress=False,
        )
        self.target_fps = 25  # 25 samples per second (40ms resolution)

    def compute_hash(self, data: bytes) -> str:
        """Compute SHA256 hex digest for byte content."""
        return hashlib.sha256(data).hexdigest()

    def get_song_key(self, title: Optional[str], artist: Optional[str] = None) -> Optional[str]:
        """Compute stable unique song key from normalized title and artist."""
        if not title:
            return None
        norm = f"{title.strip().lower()}:::{artist.strip().lower() if artist else ''}"
        digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        return f"song_{digest}"

    def get_cached_result(self, file_hash: str, song_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve pre-computed stem envelopes from local cache if present by hash, fingerprint, or song identity."""
        candidates = []
        if file_hash:
            # 1. Direct file_hash.json
            safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in file_hash)
            candidates.append(CACHE_DIR / f"{safe_name}.json")
            # 2. SHA256 digest of file_hash (useful for long fingerprints like file:name:size:mtime)
            hash_digest = hashlib.sha256(file_hash.encode("utf-8")).hexdigest()
            candidates.append(CACHE_DIR / f"{hash_digest}.json")
        if song_key:
            # 3. Direct song_key.json
            safe_song = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in song_key)
            candidates.append(CACHE_DIR / f"{safe_song}.json")

        for cache_file in candidates:
            if cache_file.exists():
                try:
                    with open(cache_file, "r") as f:
                        data = json.load(f)
                        if data and "stems" in data:
                            return data
                except Exception as e:
                    print(f"[DemucsService] Cache read error for {cache_file.name}: {e}")
        return None

    def save_cached_result(self, file_hash: str, data: Dict[str, Any], song_key: Optional[str] = None) -> None:
        """Persist computed stem envelopes to local cache under file_hash, fingerprint hash, and song_key."""
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        keys_to_save = set()
        if file_hash:
            safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in file_hash)
            if safe_name:
                keys_to_save.add(safe_name)
            keys_to_save.add(hashlib.sha256(file_hash.encode("utf-8")).hexdigest())
        if song_key:
            safe_song = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in song_key)
            if safe_song:
                keys_to_save.add(safe_song)

        for key in keys_to_save:
            cache_file = CACHE_DIR / f"{key}.json"
            try:
                cache_file.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_file, "w") as f:
                    json.dump(data, f)
            except Exception as e:
                print(f"[DemucsService] Cache write error for {cache_file.name}: {e}")

    def extract_stem_envelopes(self, stems_dict: Dict[str, torch.Tensor], sr: int = 44100) -> Dict[str, Any]:
        """
        Convert multi-channel audio tensors into time-series RMS energy envelopes at target_fps.
        Returns normalized envelopes (0.0 to 1.0) and transient kick detection events.
        """
        hop_length = int(sr / self.target_fps)
        envelopes: Dict[str, list] = {}
        total_frames = 0

        for stem_name, tensor in stems_dict.items():
            # Standardize stem naming: 'other' -> 'instruments'
            key = "instruments" if stem_name == "other" else stem_name

            # Downmix stereo to mono
            mono = tensor.mean(dim=0).cpu().numpy()
            num_frames = len(mono) // hop_length
            if num_frames == 0:
                envelopes[key] = [0.0]
                continue

            total_frames = max(total_frames, num_frames)
            trimmed = mono[:num_frames * hop_length].reshape(num_frames, hop_length)

            # RMS power per 40ms frame
            rms = np.sqrt(np.mean(trimmed ** 2, axis=1) + 1e-9)

            # High percentile normalization to ensure punchy dynamic range without clipping
            p98 = np.percentile(rms, 98) if len(rms) > 0 and np.percentile(rms, 98) > 0 else 1.0
            norm = np.clip(rms / (p98 * 1.15), 0.0, 1.0)

            # Round to 3 decimal places for efficient JSON transmission
            envelopes[key] = [round(float(v), 3) for v in norm]

        # Calculate transient kicks with intensities from drums stem
        kicks = []
        if "drums" in envelopes:
            drums_arr = np.array(envelopes["drums"])
            # First-order forward difference (onset transient)
            diff = np.diff(drums_arr, prepend=drums_arr[0])
            for i, d in enumerate(diff):
                if d > 0.18 and drums_arr[i] > 0.30:
                    kicks.append({
                        "time": round(i / self.target_fps, 2),
                        "intensity": round(float(drums_arr[i]), 3)
                    })

        # Calculate instrumental activity trajectory (level + transient change rate)
        inst_activity = []
        if "instruments" in envelopes:
            inst_arr = np.array(envelopes["instruments"])
            inst_diff = np.abs(np.diff(inst_arr, prepend=inst_arr[0]))
            combined = inst_arr * 0.65 + inst_diff * 3.5
            inst_activity = [round(float(v), 3) for v in np.clip(combined, 0.0, 1.0)]

        # Global pre-computed intensity profile across track timeline
        drums_vec = np.array(envelopes.get("drums", [0]))
        bass_vec = np.array(envelopes.get("bass", [0]))
        inst_vec = np.array(envelopes.get("instruments", [0]))
        voc_vec = np.array(envelopes.get("vocals", [0]))
        min_len = min(len(drums_vec), len(bass_vec), len(inst_vec), len(voc_vec))
        if min_len > 0:
            global_int = np.clip((drums_vec[:min_len] * 0.35 + bass_vec[:min_len] * 0.35 + inst_vec[:min_len] * 0.20 + voc_vec[:min_len] * 0.10), 0.0, 1.0)
            global_intensity = [round(float(v), 3) for v in global_int]
            avg_amplitude = round(float(np.mean(global_int)), 3)
            above_avg_sections = []
            in_sec = False
            sec_start = 0.0
            for i, val in enumerate(global_int):
                t = round(i / self.target_fps, 2)
                is_above = val >= avg_amplitude
                if is_above and not in_sec:
                    in_sec = True
                    sec_start = t
                elif not is_above and in_sec:
                    if t - sec_start >= 0.4:
                        above_avg_sections.append({"startTime": sec_start, "endTime": t})
                    in_sec = False
            if in_sec:
                above_avg_sections.append({"startTime": sec_start, "endTime": round(min_len / self.target_fps, 2)})

            # Tri-STEM Drop Pinpointing:
            # Active when Kick, Bass, and Instruments ALL simultaneously exceed their full-track averages,
            # pinpointing the smaller concentrated peak energy segment (drop)
            avg_drums = float(np.mean(drums_vec[:min_len]))
            avg_bass = float(np.mean(bass_vec[:min_len]))
            avg_inst = float(np.mean(inst_vec[:min_len]))

            tri_drop_mask = (drums_vec[:min_len] > avg_drums) & (bass_vec[:min_len] > avg_bass) & (inst_vec[:min_len] > avg_inst)
            joint_scores = (drums_vec[:min_len] + bass_vec[:min_len] + inst_vec[:min_len]) / 3.0
            qualifying = joint_scores[tri_drop_mask]

            kick_onsets = [k["time"] for k in kicks]

            def find_sudden_spike_time(raw_start: float) -> float:
                start_idx = int(round(raw_start * self.target_fps))
                search_start = max(1, start_idx - int(self.target_fps * 0.20))
                search_end = min(min_len - 1, start_idx + int(self.target_fps * 0.65))

                nearby_kicks = [k for k in kick_onsets if (raw_start - 0.18) <= k <= (raw_start + 0.55)]

                max_surge = -1e9
                max_surge_idx = start_idx
                for j in range(search_start, search_end + 1):
                    surge = (drums_vec[j] - drums_vec[j - 1]) * 1.6 + (bass_vec[j] - bass_vec[j - 1]) * 1.6 + (inst_vec[j] - inst_vec[j - 1])
                    if surge > max_surge:
                        max_surge = surge
                        max_surge_idx = j

                surge_time = round(max_surge_idx / self.target_fps, 3)
                if nearby_kicks:
                    best_kick = min(nearby_kicks, key=lambda k: abs(k - surge_time))
                    if abs(best_kick - surge_time) <= 0.25:
                        return round(best_kick, 3)
                return surge_time

            tri_stem_drop_sections = []
            if len(qualifying) > 0:
                drop_threshold = float(np.percentile(qualifying, 45))
                in_drop = False
                drop_start = 0.0
                for i in range(min_len):
                    is_drop = bool(tri_drop_mask[i] and (joint_scores[i] >= drop_threshold))
                    t = round(i / self.target_fps, 3)
                    if is_drop and not in_drop:
                        in_drop = True
                        drop_start = find_sudden_spike_time(t)
                    elif not is_drop and in_drop:
                        if t - drop_start >= 0.4:
                            tri_stem_drop_sections.append({"startTime": drop_start, "endTime": t})
                        in_drop = False
                if in_drop:
                    tri_stem_drop_sections.append({"startTime": drop_start, "endTime": round(min_len / self.target_fps, 3)})
            else:
                tri_stem_drop_sections = []
        else:
            global_intensity = [0.0]
            avg_amplitude = 0.30
            above_avg_sections = []
            tri_stem_drop_sections = []
            avg_drums = 0.25
            avg_bass = 0.25
            avg_inst = 0.25
            kick_onsets = []

        duration_seconds = round(total_frames / self.target_fps, 2)
        demucs_tempo = self.calculate_tempo_from_kicks(kick_onsets)

        return {
            "fps": self.target_fps,
            "durationSeconds": duration_seconds,
            "stems": envelopes,
            "kickEvents": kicks,
            "kickOnsets": kick_onsets,
            "instrumentalActivity": inst_activity,
            "globalIntensity": global_intensity,
            "averageAmplitude": avg_amplitude,
            "aboveAverageSections": above_avg_sections,
            "triStemDropSections": tri_stem_drop_sections,
            "drumsAverageAmplitude": round(avg_drums, 3),
            "bassAverageAmplitude": round(avg_bass, 3),
            "instAverageAmplitude": round(avg_inst, 3),
            "demucsBpm": demucs_tempo,
        }

    def calculate_tempo_from_kicks(self, onsets: list) -> Dict[str, Any]:
        """
        Calculate BPM from Demucs kick timestamps using multi-interval comb/periodicity analysis.
        Accounts for missed kicks, extra detections, syncopation, and half-time/double-time ambiguities.
        Returns explicit unavailable state if too few kicks or timing is inconsistent.
        """
        import math
        if not onsets or len(onsets) < 8:
            return {
                "bpm": None,
                "candidateBpm": None,
                "confidence": 0.0,
                "source": "unavailable",
                "reason": "Too few kick events detected (N < 8)",
                "matchedKicks": 0,
                "totalKicks": len(onsets) if onsets else 0,
            }

        sorted_onsets = sorted(list(set(onsets)))
        intervals = []

        # Collect intervals across consecutive kicks and skip intervals up to span 4 within 3.2s
        for i in range(len(sorted_onsets)):
            for j in range(i + 1, min(i + 5, len(sorted_onsets))):
                dt = sorted_onsets[j] - sorted_onsets[i]
                if 0.22 <= dt <= 3.2:
                    weight = 1.0 / (j - i)
                    intervals.append((dt, weight))

        if not intervals:
            return {
                "bpm": None,
                "candidateBpm": None,
                "confidence": 0.0,
                "source": "unavailable",
                "reason": "No valid rhythmic intervals within bounds",
                "matchedKicks": 0,
                "totalKicks": len(sorted_onsets),
            }

        sigma = 0.038
        best_bpm = 120.0
        best_score = -1.0
        scores = {}

        # Test spectrum from 65.0 to 190.0 in steps of 0.5 BPM
        for bpm_int in range(130, 381):
            test_bpm = bpm_int * 0.5
            period = 60.0 / test_bpm
            score = 0.0
            for dt, w in intervals:
                k = round(dt / period)
                if 1 <= k <= 4:
                    err = abs(dt - k * period)
                    score += w * math.exp(-(err * err) / (2 * sigma * sigma))
            scores[test_bpm] = score
            if score > best_score:
                best_score = score
                best_bpm = test_bpm

        # Rhythmic ambiguity resolution (half-time / double-time)
        if best_bpm < 85.0 and (best_bpm * 2) in scores:
            if scores[best_bpm * 2] >= 0.70 * best_score:
                best_bpm = best_bpm * 2
                best_score = scores[best_bpm]
        elif best_bpm > 175.0 and (best_bpm / 2) in scores:
            if scores[best_bpm / 2] >= 0.70 * best_score:
                best_bpm = best_bpm / 2
                best_score = scores[best_bpm]

        # Grid alignment verification across all kicks
        period = 60.0 / best_bpm
        phases = [sorted_onsets[0] + (p * 0.01 * period) for p in range(100)]
        best_align = 0
        for ph in phases:
            aligned = sum(1 for t in sorted_onsets if any(abs((t - ph) - k * period) < 0.06 for k in range(-500, 500)))
            if aligned > best_align:
                best_align = aligned

        f_align = best_align / len(sorted_onsets)
        avg_score = sum(scores.values()) / max(1, len(scores))
        contrast = best_score / (avg_score + 1e-6)
        conf = min(1.0, f_align * 0.60 + min(1.0, contrast / 3.5) * 0.40)

        is_reliable = conf >= 0.35 and best_align >= 6

        return {
            "bpm": round(best_bpm, 1) if is_reliable else None,
            "candidateBpm": round(best_bpm, 1),
            "confidence": round(conf, 2),
            "source": "demucs" if is_reliable else "unavailable",
            "matchedKicks": best_align,
            "totalKicks": len(sorted_onsets),
        }

    def separate_file(self, file_path: str, file_hash: Optional[str] = None, song_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Run Demucs separation on an audio file path or return cached result.
        Supports multi-key lookup (file_hash and song_key).
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Compute hash if not provided
        if not file_hash:
            with open(path, "rb") as f:
                file_hash = self.compute_hash(f.read())

        # Check cache
        cached = self.get_cached_result(file_hash, song_key=song_key)
        if cached:
            # Backwards compatibility: calculate and persist demucsBpm if not in old cache
            if "demucsBpm" not in cached:
                onsets = cached.get("kickOnsets") or [k["time"] for k in cached.get("kickEvents", [])]
                cached["demucsBpm"] = self.calculate_tempo_from_kicks(onsets)
                self.save_cached_result(file_hash, cached, song_key=song_key)

            print(f"[DemucsService] Returning cached stems for hash: {file_hash[:10]}... (Demucs BPM: {cached.get('demucsBpm', {}).get('bpm')})")
            return {
                "success": True,
                "cached": True,
                "fileHash": file_hash,
                **cached,
            }

        t0 = time.time()
        print(f"[DemucsService] Separating audio stems with Demucs (device: {self.device})...")
        origin, separated = self.separator.separate_audio_file(path)
        elapsed = time.time() - t0
        print(f"[DemucsService] Demucs separation completed in {elapsed:.2f}s")

        # Extract normalized envelopes
        sr = self.separator.samplerate
        result = self.extract_stem_envelopes(separated, sr=sr)
        result["deviceUsed"] = self.device
        result["separationTimeSeconds"] = round(elapsed, 2)

        # Save to cache under both file_hash and song_key
        self.save_cached_result(file_hash, result, song_key=song_key)

        return {
            "success": True,
            "cached": False,
            "fileHash": file_hash,
            **result,
        }

# Singleton instance
_demucs_service: Optional[DemucsService] = None

def get_demucs_service() -> DemucsService:
    global _demucs_service
    if _demucs_service is None:
        _demucs_service = DemucsService()
    return _demucs_service
