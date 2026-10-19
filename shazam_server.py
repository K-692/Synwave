"""
Synwave Audio Intelligence & Neural Processing Microservice
- ShazamIO song identification
- Demucs AI 4-stem separation (drums, bass, instruments, vocals)
Runs locally on port 8765 with zero external API credentials required.
"""

import os
import certifi
import asyncio
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shazamio import Shazam

# Ensure macOS uses certifi CA certificates for SSL and enables MPS fallback
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

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

@app.post("/api/recognize")
async def recognize_audio(
    file: UploadFile = File(None),
    filePath: str = Form(None)
):
    """
    Recognize song title, artist, and verified BPM from an uploaded audio file or local path.
    """
    try:
        data = None
        if file is not None:
            data = await file.read()
            if not data or len(data) == 0:
                raise HTTPException(status_code=400, detail="Empty audio file provided.")
            out = await shazam.recognize(data)
        elif filePath:
            if not os.path.exists(filePath):
                raise HTTPException(status_code=404, detail=f"File not found: {filePath}")
            out = await shazam.recognize(filePath)
        else:
            raise HTTPException(status_code=400, detail="No file or filePath provided.")

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
            return {
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
    Checks multi-tiered local cache (fileHash, fingerprint, song identity) before running neural inference.
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

            # Save to temporary path for demucs processing
            temp_dir = Path(__file__).resolve().parent / ".syncwave_cache" / "temp"
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file = temp_dir / f"upload_{computed_hash}.mp3"
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

if __name__ == "__main__":
    import uvicorn
    # Run locally on port 8765
    uvicorn.run("shazam_server:app", host="127.0.0.1", port=8765, log_level="info")
