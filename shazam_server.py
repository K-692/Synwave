"""
Synwave Shazam Recognition Microservice
Local lightweight FastAPI service utilizing ShazamIO to identify songs
from raw audio files without requiring any API keys or external credentials.
"""

import os
import certifi
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shazamio import Shazam

# Ensure macOS uses certifi CA certificates for SSL
os.environ["SSL_CERT_FILE"] = certifi.where()

app = FastAPI(title="Synwave Shazam Recognition Service")

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
    """Health check endpoint to verify service status."""
    return {"status": "ok", "service": "Synwave ShazamIO Engine"}

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
            # Read uploaded file bytes
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

        # Extract album name if present in sections metadata
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

if __name__ == "__main__":
    import uvicorn
    # Run locally on port 8765
    uvicorn.run("shazam_server:app", host="127.0.0.1", port=8765, log_level="info")
