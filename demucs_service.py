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
from typing import Dict, Any, Optional, List
import numpy as np
import torch
from demucs.api import Separator

# Absolute Cache directory for extracted stem envelopes
BASE_DIR = Path(__file__).resolve().parent
CACHE_BASE_DIR = BASE_DIR / ".synwave_cache"
CACHE_DIR = CACHE_BASE_DIR / "stems"
STEMS_INDEX_FILE = CACHE_DIR / "index.json"

# Migrate legacy .syncwave_cache folder if present
legacy_cache_dir = BASE_DIR / ".syncwave_cache"
if legacy_cache_dir.exists() and legacy_cache_dir.is_dir():
    try:
        import shutil
        legacy_stems = legacy_cache_dir / "stems"
        if legacy_stems.exists() and legacy_stems.is_dir():
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            for f in legacy_stems.glob("*.json"):
                dest = CACHE_DIR / f.name
                if not dest.exists():
                    shutil.copy2(f, dest)
        shutil.rmtree(legacy_cache_dir)
        print("[DemucsService] Migrated legacy .syncwave_cache to .synwave_cache")
    except Exception as e:
        print(f"[DemucsService] Legacy cache migration notice: {e}")

CACHE_DIR.mkdir(parents=True, exist_ok=True)

def load_stems_index() -> Dict[str, str]:
    """Load the alias-to-canonical-stem-file mapping from index.json."""
    if STEMS_INDEX_FILE.exists():
        try:
            with open(STEMS_INDEX_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            print(f"[DemucsService] Error loading index.json: {e}")
    return {}

def save_stems_index(index: Dict[str, str]) -> None:
    """Save the alias-to-canonical-stem-file mapping to index.json."""
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STEMS_INDEX_FILE, "w") as f:
            json.dump(index, f, indent=2)
    except Exception as e:
        print(f"[DemucsService] Error writing index.json: {e}")

def migrate_legacy_stems_cache() -> None:
    """
    Consolidate legacy/duplicated stem files in .synwave_cache/stems into
    single canonical stems_{hash}.json files with index.json.
    Purges duplicated un-prefixed files so .synwave_cache/stems only contains
    distinct 'stems_*.json' and 'index.json'.
    """
    if not CACHE_DIR.exists():
        return
    index = load_stems_index()
    index_changed = False

    # 1. Convert any un-prefixed .json to stems_*.json
    for f in list(CACHE_DIR.glob("*.json")):
        if f.name == "index.json" or f.name.startswith("stems_"):
            continue
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
            if not isinstance(data, dict):
                f.unlink()
                continue
            # If accidentally a shazam metadata file ended up in stems, remove it
            if "stems" not in data:
                f.unlink()
                continue

            # Identify canonical key from song identity or SHA256 hex digest
            canon_key = None
            if f.name.startswith("song_") and len(f.stem) > 5:
                canon_key = f.stem[5:]
            elif len(f.stem) == 64 and all(c in "0123456789abcdef" for c in f.stem.lower()):
                canon_key = f.stem.lower()
            else:
                canon_key = hashlib.sha256(f.stem.encode("utf-8")).hexdigest()

            canonical_filename = f"stems_{canon_key}.json"
            canonical_path = CACHE_DIR / canonical_filename

            # Tag with service and type for explicit identification
            data["service"] = "demucs"
            data["type"] = "stem_envelopes"

            # Write canonical file if not already present or if the current one is larger
            if not canonical_path.exists() or canonical_path.stat().st_size < f.stat().st_size:
                with open(canonical_path, "w") as out_fp:
                    json.dump(data, out_fp)

            # Register alias in index
            index[f.stem] = canonical_filename
            index[canon_key] = canonical_filename
            index_changed = True

            # Remove redundant duplicate file
            f.unlink()
        except Exception as e:
            print(f"[DemucsService] Error migrating {f.name}: {e}")

    # 2. Content-based deduplication among all stems_*.json files
    # Group files that have identical audio stem envelopes and keep only ONE file per track
    content_groups: Dict[str, List[Path]] = {}
    for f in list(CACHE_DIR.glob("stems_*.json")):
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
            if not isinstance(data, dict) or "stems" not in data:
                f.unlink()
                continue
            # Fingerprint the envelopes (drums + duration + frame count)
            drums = data.get("stems", {}).get("drums", [])
            dur = data.get("durationSeconds", 0)
            sig = f"{dur}_{len(drums)}_{drums[:60]}"
            sig_hash = hashlib.sha256(sig.encode("utf-8")).hexdigest()
            content_groups.setdefault(sig_hash, []).append(f)
        except Exception as e:
            print(f"[DemucsService] Error hashing {f.name}: {e}")

    for sig_hash, files in content_groups.items():
        if len(files) > 1:
            # Pick best canonical file (prefer one matching an index key, like a song_key)
            best = None
            for cand in files:
                for k, v in index.items():
                    if v == cand.name and (k.startswith("song_") or len(k) == 64):
                        best = cand
                        break
                if best:
                    break
            if not best:
                best = files[0]

            canonical_name = best.name
            for other in files:
                if other != best:
                    # Update all index entries that pointed to other
                    other_raw = other.stem.replace("stems_", "")
                    index[other_raw] = canonical_name
                    index[other.stem] = canonical_name
                    for k, v in list(index.items()):
                        if v == other.name:
                            index[k] = canonical_name
                    try:
                        other.unlink()
                        index_changed = True
                    except Exception as e:
                        print(f"[DemucsService] Error removing duplicate {other.name}: {e}")

    # 3. Recalculate drop sections for any cached files that have empty or fragmented micro-sections
    for f in list(CACHE_DIR.glob("stems_*.json")):
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
            if not isinstance(data, dict) or "stems" not in data:
                continue
            drops = data.get("triStemDropSections", [])
            needs_update = len(drops) == 0 or all((sec.get("endTime", 0) - sec.get("startTime", 0)) < 1.5 for sec in drops)
            if needs_update:
                stems = data.get("stems", {})
                drums_vec = np.array(stems.get("drums", []))
                bass_vec = np.array(stems.get("bass", []))
                inst_vec = np.array(stems.get("instruments", []))
                fps = data.get("fps", 25)
                kick_onsets = data.get("kickOnsets") or [k["time"] for k in data.get("kickEvents", [])]
                min_len = min(len(drums_vec), len(bass_vec), len(inst_vec))
                if min_len >= fps * 5:
                    win = max(5, int(fps * 1.5))
                    kernel = np.ones(win) / win
                    d_smooth = np.convolve(drums_vec[:min_len], kernel, mode='same')
                    b_smooth = np.convolve(bass_vec[:min_len], kernel, mode='same')
                    i_smooth = np.convolve(inst_vec[:min_len], kernel, mode='same')
                    avg_d = float(np.mean(drums_vec[:min_len]))
                    avg_b = float(np.mean(bass_vec[:min_len]))
                    avg_i = float(np.mean(inst_vec[:min_len]))
                    joint = d_smooth * 0.40 + b_smooth * 0.40 + i_smooth * 0.20
                    avg_j = avg_d * 0.40 + avg_b * 0.40 + avg_i * 0.20
                    is_drop = (joint > avg_j * 1.10) & ((d_smooth > avg_d * 0.85) | (b_smooth > avg_b * 0.85))

                    new_drops = []
                    in_d = False
                    start_f = 0
                    g_count = 0
                    g_limit = int(fps * 2.0)
                    for i in range(min_len):
                        if is_drop[i]:
                            if not in_d:
                                in_d = True
                                start_f = i
                            g_count = 0
                        else:
                            if in_d:
                                g_count += 1
                                if g_count > g_limit:
                                    end_f = i - g_count
                                    if (end_f - start_f) / fps >= 3.0:
                                        t_start = round(start_f / fps, 2)
                                        nearby = [k for k in kick_onsets if (t_start - 0.25) <= k <= (t_start + 0.65)]
                                        snapped = min(nearby, key=lambda k: abs(k - t_start)) if nearby else t_start
                                        new_drops.append({"startTime": round(snapped, 3), "endTime": round(end_f / fps, 2)})
                                    in_d = False
                                    g_count = 0
                    if in_d:
                        end_f = min_len - 1
                        if (end_f - start_f) / fps >= 3.0:
                            t_start = round(start_f / fps, 2)
                            nearby = [k for k in kick_onsets if (t_start - 0.25) <= k <= (t_start + 0.65)]
                            snapped = min(nearby, key=lambda k: abs(k - t_start)) if nearby else t_start
                            new_drops.append({"startTime": round(snapped, 3), "endTime": round(end_f / fps, 2)})

                    if len(new_drops) > 0:
                        data["triStemDropSections"] = new_drops
                        with open(f, "w") as out_fp:
                            json.dump(data, out_fp)
                        print(f"[DemucsService] Refreshed drop sections for {f.name}: {len(new_drops)} sections")
        except Exception as e:
            print(f"[DemucsService] Error refreshing drops for {f.name}: {e}")

    if index_changed:
        save_stems_index(index)
        print("[DemucsService] Successfully consolidated stems cache into distinct canonical stems_*.json files.")

# Execute one-time consolidation on module load
migrate_legacy_stems_cache()

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

    def get_canonical_id(self, file_hash: Optional[str] = None, song_key: Optional[str] = None) -> str:
        """Derive a single canonical 64-char hex ID for the track."""
        if song_key and song_key.startswith("song_") and len(song_key) > 5:
            return song_key[5:]
        if file_hash:
            if len(file_hash) == 64 and all(c in "0123456789abcdef" for c in file_hash.lower()):
                return file_hash.lower()
            return hashlib.sha256(file_hash.encode("utf-8")).hexdigest()
        return hashlib.sha256(str(time.time()).encode("utf-8")).hexdigest()

    def register_alias(self, alias: str, canonical_filename: str) -> None:
        """Register an alias lookup key in index.json pointing to canonical stems file."""
        if not alias or not canonical_filename:
            return
        index = load_stems_index()
        safe_alias = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in alias)
        index[alias] = canonical_filename
        if safe_alias and safe_alias != alias:
            index[safe_alias] = canonical_filename
        index[hashlib.sha256(alias.encode("utf-8")).hexdigest()] = canonical_filename
        save_stems_index(index)

    def get_cached_result(self, file_hash: str, song_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Retrieve pre-computed stem envelopes from local cache if present.
        Prioritizes index.json, then canonical stems_{id}.json.
        Guarantees that retrieved data is genuine Demucs stem envelopes.
        """
        candidates = []
        if file_hash:
            candidates.append(file_hash)
            safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in file_hash)
            if safe_name:
                candidates.append(safe_name)
            candidates.append(hashlib.sha256(file_hash.encode("utf-8")).hexdigest())
        if song_key:
            candidates.append(song_key)
            safe_song = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in song_key)
            if safe_song:
                candidates.append(safe_song)

        # 1. Lookup in index.json
        index = load_stems_index()
        for key in candidates:
            if key in index:
                target_file = CACHE_DIR / index[key]
                if target_file.exists():
                    try:
                        with open(target_file, "r") as f:
                            data = json.load(f)
                            # Verification: must contain stem envelopes
                            if data and "stems" in data:
                                return data
                    except Exception as e:
                        print(f"[DemucsService] Cache read error for {target_file.name}: {e}")

        # 2. Direct probe for canonical stems_{key}.json
        for key in candidates:
            target_file = CACHE_DIR / f"stems_{key}.json"
            if target_file.exists():
                try:
                    with open(target_file, "r") as f:
                        data = json.load(f)
                        if data and "stems" in data:
                            index[key] = target_file.name
                            save_stems_index(index)
                            return data
                except Exception as e:
                    print(f"[DemucsService] Cache read error for {target_file.name}: {e}")

        # 3. Fallback: check legacy un-prefixed file and migrate it on the fly
        for key in candidates:
            legacy_file = CACHE_DIR / f"{key}.json"
            if legacy_file.exists() and legacy_file.name != "index.json":
                try:
                    with open(legacy_file, "r") as f:
                        data = json.load(f)
                        if data and "stems" in data:
                            canon_id = self.get_canonical_id(file_hash=file_hash, song_key=song_key)
                            canonical_filename = f"stems_{canon_id}.json"
                            canonical_file = CACHE_DIR / canonical_filename
                            data["service"] = "demucs"
                            data["type"] = "stem_envelopes"
                            with open(canonical_file, "w") as out_f:
                                json.dump(data, out_f)
                            index[key] = canonical_filename
                            save_stems_index(index)
                            try:
                                legacy_file.unlink()
                            except Exception:
                                pass
                            return data
                except Exception as e:
                    print(f"[DemucsService] Legacy cache fallback error for {legacy_file.name}: {e}")

        return None

    def save_cached_result(
        self,
        file_hash: str,
        data: Dict[str, Any],
        song_key: Optional[str] = None,
        fingerprint: Optional[str] = None
    ) -> str:
        """
        Persist computed stem envelopes to local cache as a SINGLE canonical file 'stems_{id}.json'.
        Registers candidate aliases (file_hash, song_key, fingerprint) in index.json.
        Avoids file duplication on disk.
        """
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        canon_id = self.get_canonical_id(file_hash=file_hash, song_key=song_key)
        canonical_filename = f"stems_{canon_id}.json"
        canonical_file = CACHE_DIR / canonical_filename

        # Explicit payload tags for clarity
        data["service"] = "demucs"
        data["type"] = "stem_envelopes"

        try:
            with open(canonical_file, "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"[DemucsService] Cache write error for {canonical_file.name}: {e}")
            return canonical_filename

        # Update index with all alias keys
        index = load_stems_index()
        aliases = set()
        if file_hash:
            aliases.add(file_hash)
            safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in file_hash)
            if safe_name:
                aliases.add(safe_name)
            aliases.add(hashlib.sha256(file_hash.encode("utf-8")).hexdigest())
        if song_key:
            aliases.add(song_key)
            safe_song = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in song_key)
            if safe_song:
                aliases.add(safe_song)
        if fingerprint:
            aliases.add(fingerprint)
            safe_fp = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in fingerprint)
            if safe_fp:
                aliases.add(safe_fp)
            aliases.add(hashlib.sha256(fingerprint.encode("utf-8")).hexdigest())
        aliases.add(canon_id)

        for alias in aliases:
            index[alias] = canonical_filename

        save_stems_index(index)
        return canonical_filename

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

            # Robust Multi-STEM Drop Pinpointing:
            # Uses windowed moving-average envelope followers (1.5s window) and musical gap bridging (2.0s)
            # to guarantee that drop sections are accurately detected and continuous across rhythmic off-beats.
            avg_drums = float(np.mean(drums_vec[:min_len]))
            avg_bass = float(np.mean(bass_vec[:min_len]))
            avg_inst = float(np.mean(inst_vec[:min_len]))

            # Windowed rolling envelope follower (~1.5s window = 37 frames at 25fps)
            win = max(5, int(self.target_fps * 1.5))
            kernel = np.ones(win) / win
            d_smooth = np.convolve(drums_vec[:min_len], kernel, mode='same')
            b_smooth = np.convolve(bass_vec[:min_len], kernel, mode='same')
            i_smooth = np.convolve(inst_vec[:min_len], kernel, mode='same')

            # Weighted joint energy envelope (drums + bass heavy, balanced by instruments)
            joint = d_smooth * 0.40 + b_smooth * 0.40 + i_smooth * 0.20
            avg_joint = avg_drums * 0.40 + avg_bass * 0.40 + avg_inst * 0.20

            # Drop frame criteria: Joint energy elevated above average AND primary rhythmic stems active
            is_drop_frame = (joint > avg_joint * 1.10) & ((d_smooth > avg_drums * 0.85) | (b_smooth > avg_bass * 0.85))

            kick_onsets = [k["time"] for k in kicks]

            def find_sudden_spike_time(raw_start: float) -> float:
                start_idx = int(round(raw_start * self.target_fps))
                search_start = max(1, start_idx - int(self.target_fps * 0.25))
                search_end = min(min_len - 1, start_idx + int(self.target_fps * 0.65))

                nearby_kicks = [k for k in kick_onsets if (raw_start - 0.25) <= k <= (raw_start + 0.65)]

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
                    if abs(best_kick - surge_time) <= 0.30:
                        return round(best_kick, 3)
                return surge_time

            tri_stem_drop_sections = []
            in_drop = False
            start_frame = 0
            gap_count = 0
            gap_limit = int(self.target_fps * 2.0)  # Bridge gaps up to 2.0s across off-beats and drum fills

            for i in range(min_len):
                if is_drop_frame[i]:
                    if not in_drop:
                        in_drop = True
                        start_frame = i
                    gap_count = 0
                else:
                    if in_drop:
                        gap_count += 1
                        if gap_count > gap_limit:
                            end_frame = i - gap_count
                            duration_sec = (end_frame - start_frame) / self.target_fps
                            if duration_sec >= 3.0:
                                raw_start_sec = round(start_frame / self.target_fps, 3)
                                snapped_start = find_sudden_spike_time(raw_start_sec)
                                tri_stem_drop_sections.append({
                                    "startTime": snapped_start,
                                    "endTime": round(end_frame / self.target_fps, 2)
                                })
                            in_drop = False
                            gap_count = 0

            if in_drop:
                end_frame = min_len - 1
                if (end_frame - start_frame) / self.target_fps >= 3.0:
                    raw_start_sec = round(start_frame / self.target_fps, 3)
                    snapped_start = find_sudden_spike_time(raw_start_sec)
                    tri_stem_drop_sections.append({
                        "startTime": snapped_start,
                        "endTime": round(end_frame / self.target_fps, 2)
                    })
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

    def separate_file(
        self,
        file_path: str,
        file_hash: Optional[str] = None,
        song_key: Optional[str] = None,
        fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run Demucs separation on an audio file path or return cached result.
        Supports multi-key lookup (file_hash, fingerprint, and song_key) with index.json mapping.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Compute hash if not provided
        if not file_hash:
            with open(path, "rb") as f:
                file_hash = self.compute_hash(f.read())

        # Check cache across all available keys
        cached = None
        for key in [fingerprint, file_hash]:
            if key:
                cached = self.get_cached_result(key, song_key=song_key)
                if cached:
                    break
        if not cached and song_key:
            cached = self.get_cached_result("", song_key=song_key)

        if cached:
            # Backwards compatibility: calculate and persist demucsBpm if not in old cache
            if "demucsBpm" not in cached:
                onsets = cached.get("kickOnsets") or [k["time"] for k in cached.get("kickEvents", [])]
                cached["demucsBpm"] = self.calculate_tempo_from_kicks(onsets)
                self.save_cached_result(file_hash, cached, song_key=song_key, fingerprint=fingerprint)
            elif fingerprint:
                # Ensure fingerprint alias is registered
                canon_id = self.get_canonical_id(file_hash=file_hash, song_key=song_key)
                self.register_alias(fingerprint, f"stems_{canon_id}.json")

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

        # Save to cache as a single canonical stems_{id}.json with index aliases
        self.save_cached_result(file_hash, result, song_key=song_key, fingerprint=fingerprint)

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
