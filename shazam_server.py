"""
Synwave Audio Intelligence & Neural Processing Microservice
- ShazamIO song identification
- Demucs AI 4-stem separation (drums, bass, instruments, vocals)
Runs locally on port 8765 with zero external API credentials required.
"""

import os
import json
import certifi
import hashlib
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shazamio import Shazam

# Ensure macOS uses certifi CA certificates for SSL and enables MPS fallback
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

# Absolute Cache directories for persistent disk caching (.synwave_cache)
BASE_DIR = Path(__file__).resolve().parent
CACHE_BASE_DIR = BASE_DIR / ".synwave_cache"
SHAZAM_CACHE_DIR = CACHE_BASE_DIR / "shazam"
STEMS_CACHE_DIR = CACHE_BASE_DIR / "stems"
TEMP_DIR = CACHE_BASE_DIR / "temp"

# Migrate legacy .syncwave_cache folder if present
legacy_cache_dir = BASE_DIR / ".syncwave_cache"
if legacy_cache_dir.exists() and legacy_cache_dir.is_dir():
    try:
        import shutil
        for sub in ["stems", "shazam"]:
            src_sub = legacy_cache_dir / sub
            dst_sub = CACHE_BASE_DIR / sub
            if src_sub.exists() and src_sub.is_dir():
                dst_sub.mkdir(parents=True, exist_ok=True)
                for f in src_sub.glob("*.json"):
                    dest = dst_sub / f.name
                    if not dest.exists():
                        shutil.copy2(f, dest)
        shutil.rmtree(legacy_cache_dir)
        print("[ShazamServer] Migrated legacy .syncwave_cache to .synwave_cache")
    except Exception as e:
        print(f"[ShazamServer] Legacy cache migration notice: {e}")

# Ensure required cache subdirectories exist on disk
CACHE_BASE_DIR.mkdir(parents=True, exist_ok=True)
SHAZAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
STEMS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

def compute_shazam_cache_keys(
    data: Optional[bytes] = None,
    file_path: Optional[str] = None,
    fingerprint: Optional[str] = None,
    file_hash: Optional[str] = None,
    title: Optional[str] = None,
    artist: Optional[str] = None
) -> List[str]:
    """Generate normalized, filesystem-safe candidate lookup keys for disk cache."""
    keys = []
    if file_hash:
        safe_hash = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in file_hash)
        if safe_hash:
            keys.append(safe_hash)
        keys.append(hashlib.sha256(file_hash.encode("utf-8")).hexdigest())

    if fingerprint:
        safe_fp = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in fingerprint)
        if safe_fp:
            keys.append(safe_fp)
        keys.append(hashlib.sha256(fingerprint.encode("utf-8")).hexdigest())

    if file_path:
        norm_path = file_path.replace("\\", "/").strip().lower()
        keys.append(hashlib.sha256(norm_path.encode("utf-8")).hexdigest())

    if data:
        data_hash = hashlib.sha256(data).hexdigest()
        keys.append(data_hash)

    if title:
        norm_song = f"{title.strip().lower()}:::{artist.strip().lower() if artist else ''}"
        keys.append(f"song_{hashlib.sha256(norm_song.encode('utf-8')).hexdigest()}")

    return list(dict.fromkeys([k for k in keys if k]))

def get_cached_shazam_result(keys: List[str]) -> Optional[Dict[str, Any]]:
    """Look up pre-computed Shazam recognition metadata from disk cache."""
    for key in keys:
        cache_file = SHAZAM_CACHE_DIR / f"{key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    data = json.load(f)
                    if data and data.get("success") and data.get("title"):
                        return data
            except Exception as e:
                print(f"[ShazamServer] Cache read error for {cache_file.name}: {e}")
    return None

def save_cached_shazam_result(keys: List[str], data: Dict[str, Any]) -> None:
    """Persist verified Shazam recognition result to disk cache under candidate keys."""
    SHAZAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {**data, "cached": True}
    for key in keys:
        cache_file = SHAZAM_CACHE_DIR / f"{key}.json"
        try:
            with open(cache_file, "w") as f:
                json.dump(payload, f)
        except Exception as e:
            print(f"[ShazamServer] Cache write error for {cache_file.name}: {e}")

app = FastAPI(title="Synwave Audio Intelligence Service")

# Allow CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

shazam = Shazam()

@app.get("/health")
async def health_check():
    """Health check endpoint to verify service status and MPS hardware acceleration."""
    import torch
    is_mps = torch.backends.mps.is_available() and torch.backends.mps.is_built()
    device = "mps" if is_mps else ("cuda" if torch.cuda.is_available() else "cpu")
    return {
        "status": "ok",
        "service": "Synwave Audio Intelligence Engine",
        "device": device,
        "isMps": is_mps,
        "hardware": "Apple Silicon MPS (Metal Performance Shaders)" if is_mps else "CPU",
        "demucs": True,
        "shazam": True,
    }

def extract_shazam_bpm(track: dict):
    """
    Inspect the raw Shazam response to determine whether a valid, explicit BPM field is available.
    Does NOT assume ShazamIO always provides BPM.
    Validates that the value is numeric and within a plausible tempo range (50.0 to 240.0 BPM).
    """
    if not track or not isinstance(track, dict):
        return None

    candidate_values = []

    # 1. Direct top-level bpm / tempo keys
    for k in ["bpm", "tempo", "beats_per_minute"]:
        if k in track and track[k] is not None:
            candidate_values.append(track[k])

    # 2. Attributes dictionary (common in Apple Music / Shazam catalog schemas)
    attrs = track.get("attributes", {})
    if isinstance(attrs, dict):
        for k in ["bpm", "tempo"]:
            if k in attrs and attrs[k] is not None:
                candidate_values.append(attrs[k])

    # 3. Section metadata array
    for section in track.get("sections", []):
        for meta in section.get("metadata", []):
            title = str(meta.get("title", "")).strip().upper()
            if title in ["BPM", "TEMPO", "BEATS PER MINUTE"]:
                candidate_values.append(meta.get("text"))

    # 4. Parse and validate candidate value
    import re
    for val in candidate_values:
        try:
            if isinstance(val, (int, float)):
                bpm_float = float(val)
            elif isinstance(val, str):
                match = re.search(r"(\d+(\.\d+)?)", val)
                bpm_float = float(match.group(1)) if match else None
            else:
                bpm_float = None

            if bpm_float is not None and 50.0 <= bpm_float <= 240.0:
                return round(bpm_float, 1)
        except (ValueError, TypeError):
            continue

    return None

@app.post("/api/check-shazam-cache")
async def check_shazam_cache(
    fingerprint: str = Form(None),
    fileHash: str = Form(None),
    filePath: str = Form(None),
    songTitle: str = Form(None),
    songArtist: str = Form(None)
):
    """
    Ultra-fast (<5ms) cache verification endpoint. Checks if Shazam recognition
    metadata is already cached on disk in .synwave_cache/shazam/.
    Returns cached recognition immediately without uploading or recognizing audio.
    """
    keys = compute_shazam_cache_keys(
        file_path=filePath,
        fingerprint=fingerprint,
        file_hash=fileHash,
        title=songTitle,
        artist=songArtist
    )
    cached = get_cached_shazam_result(keys)
    if cached:
        return {
            "success": True,
            "cached": True,
            **cached
        }
    return {
        "success": False,
        "cached": False,
        "message": "Shazam recognition not found in .synwave_cache"
    }

@app.post("/api/recognize")
async def recognize_audio(
    file: UploadFile = File(None),
    filePath: str = Form(None),
    fingerprint: str = Form(None),
    fileHash: str = Form(None)
):
    """
    Recognize song title, artist, and verified BPM from an uploaded audio file or local path.
    Checks .synwave_cache/shazam first before initiating network calls.
    Persists successful recognition to .synwave_cache/shazam on disk.
    """
    try:
        data = None
        if file is not None:
            data = await file.read()
            if not data or len(data) == 0:
                raise HTTPException(status_code=400, detail="Empty audio file provided.")
        elif filePath:
            if not os.path.exists(filePath):
                raise HTTPException(status_code=404, detail=f"File not found: {filePath}")
        else:
            raise HTTPException(status_code=400, detail="No file or filePath provided.")

        # 1. Pre-check disk cache before running Shazam recognition
        lookup_keys = compute_shazam_cache_keys(
            data=data,
            file_path=filePath,
            fingerprint=fingerprint,
            file_hash=fileHash
        )
        cached = get_cached_shazam_result(lookup_keys)
        if cached:
            print(f"[ShazamServer] Returning cached recognition from .synwave_cache for '{cached.get('title')}'")
            return {
                **cached,
                "cached": True,
            }

        # 2. Run ShazamIO recognition
        if data is not None:
            out = await shazam.recognize(data)
        else:
            out = await shazam.recognize(filePath)

        track = out.get("track", {})
        title = track.get("title")
        artist = track.get("subtitle")
        album = None
        genres = track.get("genres", {}).get("primary")
        cover_art = track.get("images", {}).get("coverart")

        for section in track.get("sections", []):
            if section.get("type") == "SONG":
                for meta in section.get("metadata", []):
                    if meta.get("title") == "Album":
                        album = meta.get("text")

        verified_bpm = extract_shazam_bpm(track)
        bpm_source = "shazamio" if verified_bpm is not None else None
        bpm_confidence = 1.0 if verified_bpm is not None else None

        if title:
            result = {
                "success": True,
                "title": title,
                "artist": artist or "Unknown Artist",
                "album": album or "Single",
                "genre": genres or "Electronic",
                "coverArt": cover_art,
                "query": f"{title} {artist or ''}".strip(),
                "shazamKey": track.get("key"),
                "bpm": verified_bpm,
                "bpmSource": bpm_source,
                "bpmConfidence": bpm_confidence,
            }

            # Persist to disk cache under all candidate keys
            all_keys = compute_shazam_cache_keys(
                data=data,
                file_path=filePath,
                fingerprint=fingerprint,
                file_hash=fileHash,
                title=title,
                artist=artist
            )
            save_cached_shazam_result(all_keys, result)
            print(f"[ShazamServer] Cached recognition in .synwave_cache/shazam for '{title}' by '{artist}'")

            return {
                **result,
                "cached": False,
            }
        else:
            return {
                "success": False,
                "message": "No Shazam match found for this audio segment.",
                "bpm": None,
                "bpmSource": None,
                "bpmConfidence": None,
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "bpm": None,
            "bpmSource": None,
            "bpmConfidence": None,
        }

@app.post("/api/check-stems-cache")
async def check_stems_cache(
    fileHash: str = Form(None),
    fingerprint: str = Form(None),
    songTitle: str = Form(None),
    songArtist: str = Form(None)
):
    """
    Ultra-fast (<5ms) cache verification endpoint. Checks if Demucs stems are already
    computed and cached on disk for this fileHash, fingerprint, or unique song identity.
    Returns cached stems immediately without uploading the audio file.
    """
    try:
        from demucs_service import get_demucs_service
        service = get_demucs_service()
        song_key = service.get_song_key(songTitle, songArtist) if songTitle else None

        cached = None
        for key in [fingerprint, fileHash]:
            if key:
                cached = service.get_cached_result(key, song_key=song_key)
                if cached:
                    break
        if not cached and song_key:
            cached = service.get_cached_result("", song_key=song_key)

        if cached:
            return {
                "success": True,
                "cached": True,
                "fileHash": fileHash or fingerprint or song_key,
                **cached,
            }
        return {
            "success": False,
            "cached": False,
            "message": "Stems not found in cache",
        }
    except Exception as e:
        return {
            "success": False,
            "cached": False,
            "error": str(e)
        }

@app.post("/api/separate-stems")
async def separate_stems(
    file: UploadFile = File(None),
    filePath: str = Form(None),
    fileHash: str = Form(None),
    fingerprint: str = Form(None),
    songTitle: str = Form(None),
    songArtist: str = Form(None)
):
    """
    Separates 4 stems (drums, bass, instruments, vocals) from the audio file using Demucs.
    Checks multi-tiered local cache (fileHash, fingerprint, song identity) in .synwave_cache/stems
    before running neural inference.
    Returns normalized RMS envelope curves for real-time visualization sync.
    """
    try:
        from demucs_service import get_demucs_service
        service = get_demucs_service()
        song_key = service.get_song_key(songTitle, songArtist) if songTitle else None

        # Check cache immediately with available keys before doing any file I/O
        for candidate_key in [fingerprint, fileHash]:
            if candidate_key:
                cached = service.get_cached_result(candidate_key, song_key=song_key)
                if cached:
                    return {
                        "success": True,
                        "cached": True,
                        "fileHash": candidate_key,
                        **cached,
                    }
        if song_key:
            cached = service.get_cached_result("", song_key=song_key)
            if cached:
                return {
                    "success": True,
                    "cached": True,
                    "fileHash": song_key,
                    **cached,
                }

        if filePath and os.path.exists(filePath):
            result = service.separate_file(filePath, file_hash=fileHash or fingerprint, song_key=song_key)
            return result
        elif file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Empty audio file provided.")
            computed_hash = fileHash or service.compute_hash(data)

            # Check cache with computed byte hash
            cached = service.get_cached_result(computed_hash, song_key=song_key)
            if cached:
                return {
                    "success": True,
                    "cached": True,
                    "fileHash": computed_hash,
                    **cached,
                }

            # Save to temporary path in .synwave_cache/temp for demucs processing
            TEMP_DIR.mkdir(parents=True, exist_ok=True)
            temp_file = TEMP_DIR / f"upload_{computed_hash}.mp3"
            with open(temp_file, "wb") as f:
                f.write(data)

            try:
                result = service.separate_file(str(temp_file), file_hash=computed_hash, song_key=song_key)
                # Also save under fingerprint if provided
                if fingerprint and result.get("success"):
                    service.save_cached_result(fingerprint, result, song_key=song_key)
                return result
            finally:
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                    except Exception:
                        pass
        else:
            raise HTTPException(status_code=400, detail="No file or filePath provided.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/cache/info")
async def get_cache_info():
    """
    Return status and summary of items persisted in .synwave_cache disk store.
    """
    shazam_files = list(SHAZAM_CACHE_DIR.glob("*.json")) if SHAZAM_CACHE_DIR.exists() else []
    stems_files = list(STEMS_CACHE_DIR.glob("*.json")) if STEMS_CACHE_DIR.exists() else []
    return {
        "success": True,
        "cacheDir": str(CACHE_BASE_DIR),
        "exists": CACHE_BASE_DIR.exists(),
        "shazamCount": len(shazam_files),
        "stemsCount": len(stems_files),
        "shazamFiles": [f.name for f in shazam_files[:10]],
        "stemsFiles": [f.name for f in stems_files[:10]],
    }

@app.post("/api/cache/clear")
async def clear_disk_cache():
    """
    Purge all persisted JSON files inside .synwave_cache (both shazam and stems).
    """
    import shutil
    try:
        count = 0
        for sub in [SHAZAM_CACHE_DIR, STEMS_CACHE_DIR, TEMP_DIR]:
            if sub.exists():
                for f in sub.glob("*.json"):
                    f.unlink()
                    count += 1
                for f in sub.glob("upload_*.mp3"):
                    f.unlink()
                    count += 1
        print(f"[ShazamServer] Disk cache purged ({count} files removed from .synwave_cache)")
        return {
            "success": True,
            "message": f"Purged {count} files from .synwave_cache",
            "purgedCount": count
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    # Run locally on port 8765
    uvicorn.run("shazam_server:app", host="127.0.0.1", port=8765, log_level="info")

