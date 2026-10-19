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

@app.post("/api/recognize")
async def recognize_audio(
    file: UploadFile = File(None),
    filePath: str = Form(None)
):
    """
    Recognize song title and artist from an uploaded audio file or local path.
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
            }
        else:
            return {
                "success": False,
                "message": "No Shazam match found for this audio segment.",
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/separate-stems")
async def separate_stems(
    file: UploadFile = File(None),
    filePath: str = Form(None),
    fileHash: str = Form(None)
):
    """
    Separates 4 stems (drums, bass, instruments, vocals) from the audio file using Demucs.
    Returns normalized RMS envelope curves for real-time visualization sync.
    """
    try:
        from demucs_service import get_demucs_service
        service = get_demucs_service()

        if filePath and os.path.exists(filePath):
            result = service.separate_file(filePath, fileHash)
            return result
        elif file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Empty audio file provided.")
            computed_hash = fileHash or service.compute_hash(data)

            # Check cache before writing to disk
            cached = service.get_cached_result(computed_hash)
            if cached:
                return {
                    "success": True,
                    "cached": True,
                    "fileHash": computed_hash,
                    **cached,
                }

            # Save to temporary path for demucs processing
            temp_dir = Path(".synwave_cache/temp")
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file = temp_dir / f"upload_{computed_hash}.mp3"
            with open(temp_file, "wb") as f:
                f.write(data)

            try:
                result = service.separate_file(str(temp_file), computed_hash)
                return result
            finally:
                if temp_file.exists():
                    temp_file.unlink()
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
