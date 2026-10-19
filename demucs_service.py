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

# Cache directory for extracted stem envelopes
CACHE_DIR = Path(".synwave_cache/stems")
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

    def get_cached_result(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve pre-computed stem envelopes from local cache if present."""
        cache_file = CACHE_DIR / f"{file_hash}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[DemucsService] Cache read error for {file_hash}: {e}")
        return None

    def save_cached_result(self, file_hash: str, data: Dict[str, Any]) -> None:
        """Persist computed stem envelopes to local cache."""
        cache_file = CACHE_DIR / f"{file_hash}.json"
        try:
            with open(cache_file, "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"[DemucsService] Cache write error for {file_hash}: {e}")

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

        # Calculate transient kicks from drums stem
        kicks = []
        if "drums" in envelopes:
            drums_arr = np.array(envelopes["drums"])
            # First-order forward difference (onset transient)
            diff = np.diff(drums_arr, prepend=drums_arr[0])
            for i, d in enumerate(diff):
                if d > 0.22 and drums_arr[i] > 0.35:
                    kicks.append(round(i / self.target_fps, 2))

        duration_seconds = round(total_frames / self.target_fps, 2)

        return {
            "fps": self.target_fps,
            "durationSeconds": duration_seconds,
            "stems": envelopes,
            "kickOnsets": kicks,
        }

    def separate_file(self, file_path: str, file_hash: Optional[str] = None) -> Dict[str, Any]:
        """
        Run Demucs separation on an audio file path or return cached result.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Compute hash if not provided
        if not file_hash:
            with open(path, "rb") as f:
                file_hash = self.compute_hash(f.read())

        # Check cache
        cached = self.get_cached_result(file_hash)
        if cached:
            print(f"[DemucsService] Returning cached stems for hash: {file_hash[:10]}...")
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

        # Save to cache
        self.save_cached_result(file_hash, result)

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
