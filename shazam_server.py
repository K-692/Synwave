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
SHAZAM_INDEX_FILE = SHAZAM_CACHE_DIR / "index.json"

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

def load_shazam_index() -> Dict[str, str]:
    """Load the alias-to-canonical-shazam-file mapping from index.json."""
    if SHAZAM_INDEX_FILE.exists():
        try:
            with open(SHAZAM_INDEX_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            print(f"[ShazamServer] Error loading shazam index.json: {e}")
    return {}

def save_shazam_index(index: Dict[str, str]) -> None:
    """Save the alias-to-canonical-shazam-file mapping to index.json."""
    try:
        SHAZAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(SHAZAM_INDEX_FILE, "w") as f:
            json.dump(index, f, indent=2)
    except Exception as e:
        print(f"[ShazamServer] Error writing shazam index.json: {e}")

def get_canonical_shazam_id(
    title: Optional[str] = None,
    artist: Optional[str] = None,
    keys: Optional[List[str]] = None
) -> str:
    """Compute a single canonical 64-char hex ID for song recognition metadata."""
    if title:
        norm = f"{title.strip().lower()}:::{artist.strip().lower() if artist else ''}"
        return hashlib.sha256(norm.encode("utf-8")).hexdigest()
    if keys:
        for k in keys:
            if k.startswith("song_") and len(k) > 5:
                return k[5:]
            if len(k) == 64 and all(c in "0123456789abcdef" for c in k.lower()):
                return k.lower()
        return hashlib.sha256(keys[0].encode("utf-8")).hexdigest()
    import time
    return hashlib.sha256(str(time.time()).encode("utf-8")).hexdigest()

def migrate_legacy_shazam_cache() -> None:
    """
    Consolidate legacy/duplicated shazam files in .synwave_cache/shazam into
    single canonical shazam_{hash}.json files with index.json.
    Purges duplicated un-prefixed files so .synwave_cache/shazam only contains
    'shazam_*.json' and 'index.json'.
    """
    if not SHAZAM_CACHE_DIR.exists():
        return
    index = load_shazam_index()
    index_changed = False
    for f in list(SHAZAM_CACHE_DIR.glob("*.json")):
        if f.name == "index.json" or f.name.startswith("shazam_"):
            continue
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
            if not isinstance(data, dict):
                f.unlink()
                continue
            # If stems file was accidentally placed here, move to stems directory
            if "stems" in data and not data.get("title"):
                import shutil
                dest = STEMS_CACHE_DIR / f.name
                if not dest.exists():
                    shutil.copy2(f, dest)
                f.unlink()
                continue

            if not data.get("title"):
                f.unlink()
                continue

            canon_id = get_canonical_shazam_id(data.get("title"), data.get("artist"), [f.stem])
            canonical_filename = f"shazam_{canon_id}.json"
            canonical_path = SHAZAM_CACHE_DIR / canonical_filename

            # Tag with service and type for explicit identification
            data["service"] = "shazam"
            data["type"] = "song_metadata"
            data["cached"] = True

            if not canonical_path.exists():
                with open(canonical_path, "w") as out_fp:
                    json.dump(data, out_fp)

            index[f.stem] = canonical_filename
            index[canon_id] = canonical_filename
            norm_song = f"{data['title'].strip().lower()}:::{data.get('artist', '').strip().lower()}"
            index[f"song_{hashlib.sha256(norm_song.encode('utf-8')).hexdigest()}"] = canonical_filename
            index_changed = True

            f.unlink()
        except Exception as e:
            print(f"[ShazamServer] Error migrating {f.name}: {e}")

    if index_changed:
        save_shazam_index(index)
        print("[ShazamServer] Successfully consolidated shazam cache into canonical shazam_*.json files.")

# Execute one-time consolidation on module load
migrate_legacy_shazam_cache()

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
    """
    Look up pre-computed Shazam recognition metadata from disk cache.
    Checks index.json, then canonical shazam_{key}.json.
    Ensures retrieved data contains song metadata and NEVER stem envelopes.
    """
    index = load_shazam_index()

    # 1. Check index.json lookup
    for key in keys:
        if key in index:
            cache_file = SHAZAM_CACHE_DIR / index[key]
            if cache_file.exists():
                try:
                    with open(cache_file, "r") as f:
                        data = json.load(f)
                        if data and data.get("title") and "stems" not in data:
                            return data
                except Exception as e:
                    print(f"[ShazamServer] Cache read error for {cache_file.name}: {e}")

    # 2. Check canonical shazam_{key}.json
    for key in keys:
        cache_file = SHAZAM_CACHE_DIR / f"shazam_{key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    data = json.load(f)
                    if data and data.get("title") and "stems" not in data:
                        index[key] = cache_file.name
                        save_shazam_index(index)
                        return data
            except Exception as e:
                print(f"[ShazamServer] Cache read error for {cache_file.name}: {e}")

    # 3. Fallback: check legacy un-prefixed file and migrate it
    for key in keys:
        cache_file = SHAZAM_CACHE_DIR / f"{key}.json"
        if cache_file.exists() and cache_file.name != "index.json":
            try:
                with open(cache_file, "r") as f:
                    data = json.load(f)
                    if data and data.get("title") and "stems" not in data:
                        canon_id = get_canonical_shazam_id(data.get("title"), data.get("artist"), keys)
                        canonical_filename = f"shazam_{canon_id}.json"
                        canonical_path = SHAZAM_CACHE_DIR / canonical_filename
                        data["service"] = "shazam"
                        data["type"] = "song_metadata"
                        data["cached"] = True
                        with open(canonical_path, "w") as out_f:
                            json.dump(data, out_f)
                        index[key] = canonical_filename
                        save_shazam_index(index)
                        try:
                            cache_file.unlink()
                        except Exception:
                            pass
                        return data
            except Exception as e:
                print(f"[ShazamServer] Legacy shazam fallback error for {cache_file.name}: {e}")

    return None

def save_cached_shazam_result(keys: List[str], data: Dict[str, Any]) -> str:
    """
    Persist verified Shazam recognition result to disk cache as a SINGLE canonical file 'shazam_{id}.json'.
    Registers candidate lookup keys in index.json.
    Eliminates duplicated files on disk.
    """
    SHAZAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    canon_id = get_canonical_shazam_id(data.get("title"), data.get("artist"), keys)
    canonical_filename = f"shazam_{canon_id}.json"
    canonical_file = SHAZAM_CACHE_DIR / canonical_filename

    payload = {
        "service": "shazam",
        "type": "song_metadata",
        **data,
        "cached": True
    }

    try:
        with open(canonical_file, "w") as f:
            json.dump(payload, f)
    except Exception as e:
        print(f"[ShazamServer] Cache write error for {canonical_file.name}: {e}")
        return canonical_filename

    # Register all candidate keys in index
    index = load_shazam_index()
    for key in keys:
        if key:
            index[key] = canonical_filename

    index[canon_id] = canonical_filename
    if data.get("title"):
        norm_song = f"{data['title'].strip().lower()}:::{data.get('artist', '').strip().lower()}"
        index[f"song_{hashlib.sha256(norm_song.encode('utf-8')).hexdigest()}"] = canonical_filename
        index[f"title_{data['title'].strip().lower()}"] = canonical_filename

    save_shazam_index(index)
    return canonical_filename

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
            result = service.separate_file(
                filePath,
                file_hash=fileHash or fingerprint,
                song_key=song_key,
                fingerprint=fingerprint
            )
            return result
        elif file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Empty audio file provided.")
            computed_hash = fileHash or service.compute_hash(data)

            # Check cache with computed byte hash
            cached = service.get_cached_result(computed_hash, song_key=song_key)
            if cached:
                if fingerprint:
                    canon_id = service.get_canonical_id(file_hash=computed_hash, song_key=song_key)
                    service.register_alias(fingerprint, f"stems_{canon_id}.json")
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
                result = service.separate_file(
                    str(temp_file),
                    file_hash=computed_hash,
                    song_key=song_key,
                    fingerprint=fingerprint
                )
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
    Counts distinct canonical tracks (shazam_*.json and stems_*.json) excluding index.json.
    """
    shazam_files = [f for f in SHAZAM_CACHE_DIR.glob("shazam_*.json")] if SHAZAM_CACHE_DIR.exists() else []
    stems_files = [f for f in STEMS_CACHE_DIR.glob("stems_*.json")] if STEMS_CACHE_DIR.exists() else []
    return {
        "success": True,
        "cacheDir": str(CACHE_BASE_DIR),
        "exists": CACHE_BASE_DIR.exists(),
        "shazamCount": len(shazam_files),
        "stemsCount": len(stems_files),
        "shazamFiles": [f.name for f in sorted(shazam_files, key=lambda x: x.name)[:10]],
        "stemsFiles": [f.name for f in sorted(stems_files, key=lambda x: x.name)[:10]],
    }

@app.post("/api/cache/clear")
async def clear_disk_cache():
    """
    Purge all persisted JSON files inside .synwave_cache (both shazam and stems).
    Resets index.json for both services.
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

        # Re-save empty index.json files
        save_shazam_index({})
        from demucs_service import save_stems_index
        save_stems_index({})

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

