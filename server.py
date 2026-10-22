"""
Synwave YouTube & Neural Demucs Audio Microservice
- Extracts high-fidelity WAV audio from YouTube links using yt-dlp & ffmpeg
- Runs Meta Demucs v4 HTDemucs for 4-stem source separation on Apple Silicon MPS
- Streams audio and caches all stems and metadata under .synwave_cache
"""

import os
import re
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from fastapi import FastAPI, HTTPException, Request, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import torch
import yt_dlp

# Enable PyTorch MPS fallback for operations not natively implemented on Metal
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

# Base and cache directories
BASE_DIR = Path(__file__).resolve().parent
CACHE_BASE_DIR = BASE_DIR / ".synwave_cache"
AUDIO_CACHE_DIR = CACHE_BASE_DIR / "audio"
STEMS_CACHE_DIR = CACHE_BASE_DIR / "stems"
META_CACHE_DIR = CACHE_BASE_DIR / "metadata"
INDEX_FILE = CACHE_BASE_DIR / "index.json"

# Ensure all cache subdirectories exist
CACHE_BASE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
STEMS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
META_CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Synwave YouTube & Neural Demucs Microservice",
    version="2.0.0",
    description="High-performance YouTube audio extraction and neural Demucs stem separation microservice",
)

# Enable CORS for local Vite development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_youtube_url(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts canonical YouTube video ID and standard watch URL from any YouTube link format.
    Supports standard, short, embed, music, and raw ID formats.
    """
    if not url or not isinstance(url, str):
        return None, None

    clean_url = url.strip()
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?\/]|$)",
        r"youtu\.be\/([0-9A-Za-z_-]{11})",
        r"embed\/([0-9A-Za-z_-]{11})",
        r"shorts\/([0-9A-Za-z_-]{11})",
        r"^([0-9A-Za-z_-]{11})$",
    ]

    for p in patterns:
        m = re.search(p, clean_url)
        if m:
            video_id = m.group(1)
            canonical = f"https://www.youtube.com/watch?v={video_id}"
            return video_id, canonical

    return None, None

def load_cache_index() -> Dict[str, str]:
    """Load the mapping of YouTube URLs and aliases to unique cache IDs from index.json."""
    if INDEX_FILE.exists():
        try:
            with open(INDEX_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            print(f"[Server] Error reading index.json: {e}")
    return {}

def save_cache_index(index: Dict[str, str]) -> None:
    """Save the YouTube link index mapping to index.json."""
    try:
        with open(INDEX_FILE, "w") as f:
            json.dump(index, f, indent=2)
    except Exception as e:
        print(f"[Server] Error writing index.json: {e}")

def get_unique_identifier(video_id: str) -> str:
    """Computes unique cache key for a YouTube video ID."""
    return f"yt_{video_id}"

def get_or_fetch_metadata(video_id: str, canonical_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves or automatically populates track metadata for a YouTube video.
    Reads persistent meta_{unique_id}.json if present; otherwise queries free YouTube oEmbed
    and Demucs duration cache without requiring any API keys.
    """
    unique_id = get_unique_identifier(video_id)
    meta_path = META_CACHE_DIR / f"meta_{unique_id}.json"

    if meta_path.exists():
        try:
            with open(meta_path, "r") as mf:
                data = json.load(mf)
                if data and data.get("title") and not data.get("title").startswith("YouTube Video ("):
                    return data
        except Exception:
            pass

    title = f"YouTube Video ({video_id})"
    artist = "YouTube Creator"
    thumbnail = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"
    duration = 0

    # Query YouTube oEmbed standard (open public endpoint, no API key required)
    try:
        import urllib.request
        import ssl
        ctx = ssl._create_unverified_context()
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=3.0) as res:
            oe = json.loads(res.read().decode())
            if oe.get("title"):
                title = oe["title"]
            if oe.get("author_name"):
                artist = oe["author_name"]
            if oe.get("thumbnail_url"):
                thumbnail = oe["thumbnail_url"]
    except Exception:
        pass

    # Retrieve pre-computed duration from Demucs stem cache if available
    try:
        from demucs_service import get_demucs_service
        stems = get_demucs_service().get_cached_result(file_hash=unique_id, song_key=canonical_url)
        if stems and "durationSeconds" in stems:
            duration = round(stems["durationSeconds"])
    except Exception:
        pass

    meta_info = {
        "title": title,
        "artist": artist,
        "uploader": artist,
        "duration": duration,
        "thumbnailUrl": thumbnail,
        "videoId": video_id,
        "uniqueId": unique_id,
        "url": canonical_url or f"https://www.youtube.com/watch?v={video_id}",
    }

    try:
        META_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(meta_path, "w") as mf:
            json.dump(meta_info, mf, indent=2)
    except Exception as e:
        print(f"[Server] Meta save warning for {video_id}: {e}")

    return meta_info

@app.get("/health")
async def health_check():
    """Health check endpoint reporting hardware acceleration and service status."""
    mps_available = torch.backends.mps.is_available()
    cuda_available = torch.cuda.is_available()
    device = "mps" if mps_available else ("cuda" if cuda_available else "cpu")

    return {
        "status": "online",
        "service": "Synwave YouTube & Neural Demucs Microservice",
        "version": "2.0.0",
        "device": device,
        "mps_available": mps_available,
        "hardware_accel": "APPLE SILICON MPS (METAL)" if mps_available else ("NVIDIA CUDA" if cuda_available else "CPU (FALLBACK)"),
        "cache_dir": str(CACHE_BASE_DIR),
    }

@app.post("/api/youtube/process")
async def process_youtube(
    request: Request,
    url: Optional[str] = Body(None, embed=True),
    youtubeUrl: Optional[str] = Form(None),
):
    """
    Main ingestion endpoint for YouTube link workflow:
    1. Parses YouTube URL & extracts video ID.
    2. Uses YouTube link as the unique identifier for .synwave_cache.
    3. Checks local cache for pre-extracted WAV and Demucs stems (<10ms cache hit).
    4. On cache miss: extracts best-quality audio to WAV with yt-dlp & runs Demucs neural separation.
    5. Returns metadata, Demucs stems envelopes, kick events, BPM, and audio streaming endpoint.
    """
    # Accept URL from JSON body or Form data
    raw_url = url or youtubeUrl
    if not raw_url:
        try:
            body = await request.json()
            raw_url = body.get("url") or body.get("youtubeUrl")
        except Exception:
            pass

    if not raw_url or not isinstance(raw_url, str):
        raise HTTPException(
            status_code=400,
            detail="Missing YouTube URL. Please provide a valid YouTube link (e.g., https://www.youtube.com/watch?v=...)",
        )

    video_id, canonical_url = parse_youtube_url(raw_url)
    if not video_id or not canonical_url:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse a valid YouTube Video ID from: '{raw_url}'. Please check the URL format.",
        )

    unique_id = get_unique_identifier(video_id)
    wav_path = AUDIO_CACHE_DIR / f"{unique_id}.wav"
    stems_path = STEMS_CACHE_DIR / f"stems_{unique_id}.json"
    meta_path = META_CACHE_DIR / f"meta_{unique_id}.json"

    # ---------------------------------------------------------
    # 1. Ultra-fast Cache Hit Check (<10ms)
    # ---------------------------------------------------------
    cached_stems = None
    if stems_path.exists():
        try:
            with open(stems_path, "r") as sf:
                cached_stems = json.load(sf)
        except Exception:
            pass
    if not cached_stems:
        try:
            from demucs_service import get_demucs_service
            cached_stems = get_demucs_service().get_cached_result(file_hash=unique_id, song_key=canonical_url)
        except Exception:
            pass

    if wav_path.exists() and cached_stems and cached_stems.get("stems"):
        try:
            meta_data = {}
            if meta_path.exists():
                try:
                    with open(meta_path, "r") as mf:
                        meta_data = json.load(mf)
                except Exception:
                    pass

            title = meta_data.get("title") or f"YouTube Video ({video_id})"
            artist = meta_data.get("artist") or meta_data.get("uploader") or "YouTube Stage"
            thumbnail = meta_data.get("thumbnailUrl") or f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"
            duration = meta_data.get("duration", cached_stems.get("durationSeconds", 0))

            print(f"[Server] Cache HIT for YouTube link: {canonical_url} (ID: {video_id})")
            return {
                "success": True,
                "cached": True,
                "youtubeUrl": canonical_url,
                "videoId": video_id,
                "uniqueId": unique_id,
                "title": title,
                "artist": artist,
                "durationSeconds": duration,
                "thumbnailUrl": thumbnail,
                "audioUrl": f"http://127.0.0.1:8765/api/audio/{video_id}",
                "stems": cached_stems,  # Full DemucsStemData with fps, envelopes, kick events, BPM
                "kickEvents": cached_stems.get("kickEvents", []),
                "kickOnsets": cached_stems.get("kickOnsets", []),
                "instrumentalActivity": cached_stems.get("instrumentalActivity", []),
                "globalIntensity": cached_stems.get("globalIntensity", []),
                "averageAmplitude": cached_stems.get("averageAmplitude", 0.3),
                "aboveAverageSections": cached_stems.get("aboveAverageSections", []),
                "triStemDropSections": cached_stems.get("triStemDropSections", []),
                "demucsBpm": cached_stems.get("demucsBpm", {}),
            }
        except Exception as e:
            print(f"[Server] Cache read warning: {e}. Re-processing audio.")

    # ---------------------------------------------------------
    # 2. Extract Audio via yt-dlp & FFmpeg
    # ---------------------------------------------------------
    print(f"[Server] Cache MISS. Extracting audio from YouTube: {canonical_url}...")
    temp_template = str(AUDIO_CACHE_DIR / f"temp_{video_id}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": temp_template,
        "noplaylist": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(canonical_url, download=True)
    except Exception as e:
        print(f"[Server] yt-dlp extraction error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract audio from YouTube: {str(e)}",
        )

    # yt-dlp saves output to temp_template with .wav
    expected_wav = AUDIO_CACHE_DIR / f"temp_{video_id}.wav"
    if expected_wav.exists():
        if wav_path.exists():
            wav_path.unlink()
        expected_wav.rename(wav_path)
    elif not wav_path.exists():
        # Check if any temp file for this video was created
        matching = list(AUDIO_CACHE_DIR.glob(f"*{video_id}*.wav"))
        if matching:
            matching[0].rename(wav_path)
        else:
            raise HTTPException(
                status_code=500,
                detail="Audio extraction completed but target WAV file was not generated.",
            )

    title = info.get("title") or f"YouTube Video ({video_id})"
    uploader = info.get("uploader") or info.get("channel") or "YouTube Creator"
    duration = float(info.get("duration") or 0)
    thumbnail = info.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"

    meta_payload = {
        "youtubeUrl": canonical_url,
        "videoId": video_id,
        "title": title,
        "artist": uploader,
        "duration": duration,
        "thumbnailUrl": thumbnail,
        "description": info.get("description", "")[:500],
    }

    try:
        with open(meta_path, "w") as mf:
            json.dump(meta_payload, mf, indent=2)
    except Exception as e:
        print(f"[Server] Notice saving metadata: {e}")

    # ---------------------------------------------------------
    # 3. Neural Source Separation via Meta Demucs v4
    # ---------------------------------------------------------
    print(f"[Server] Running Meta Demucs v4 separation on extracted WAV ({wav_path.name})...")
    from demucs_service import get_demucs_service
    service = get_demucs_service()

    stems_result = service.separate_file(
        str(wav_path),
        file_hash=unique_id,
        song_key=canonical_url,
    )

    if not stems_result or not stems_result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Demucs stem separation failed: {stems_result.get('error', 'Unknown error')}",
        )

    # Write meta cache and direct stems alias for instant future cache hits
    try:
        with open(meta_path, "w") as mf:
            json.dump({
                "title": title,
                "artist": uploader,
                "uploader": uploader,
                "duration": duration,
                "thumbnailUrl": thumbnail,
                "videoId": video_id,
                "url": canonical_url,
            }, mf, indent=2)
    except Exception as e:
        print(f"[Server] Meta save note: {e}")

    try:
        if not stems_path.exists():
            with open(stems_path, "w") as sf:
                json.dump(stems_result, sf)
    except Exception as e:
        print(f"[Server] Stems alias save note: {e}")

    # Update index.json to map aliases
    index = load_cache_index()
    index[raw_url] = unique_id
    index[canonical_url] = unique_id
    index[video_id] = unique_id
    save_cache_index(index)

    print(f"[Server] Successfully processed and cached YouTube track: '{title}' by '{uploader}'")

    return {
        "success": True,
        "cached": False,
        "youtubeUrl": canonical_url,
        "videoId": video_id,
        "uniqueId": unique_id,
        "title": title,
        "artist": uploader,
        "durationSeconds": stems_result.get("durationSeconds", duration),
        "thumbnailUrl": thumbnail,
        "audioUrl": f"http://127.0.0.1:8765/api/audio/{video_id}",
        "stems": stems_result,  # Complete DemucsStemData with fps, envelopes, kickEvents, BPM
        "kickEvents": stems_result.get("kickEvents", []),
        "kickOnsets": stems_result.get("kickOnsets", []),
        "instrumentalActivity": stems_result.get("instrumentalActivity", []),
        "globalIntensity": stems_result.get("globalIntensity", []),
        "averageAmplitude": stems_result.get("averageAmplitude", 0.3),
        "aboveAverageSections": stems_result.get("aboveAverageSections", []),
        "triStemDropSections": stems_result.get("triStemDropSections", []),
        "demucsBpm": stems_result.get("demucsBpm", {}),
    }

@app.get("/api/audio/{video_id}")
async def get_audio_stream(video_id: str):
    """
    Serves the extracted high-fidelity WAV audio file for browser Web Audio API playback.
    Includes explicit CORS headers for MediaElementAudioSourceNode compatibility.
    """
    clean_id = video_id.strip()
    wav_path = AUDIO_CACHE_DIR / f"yt_{clean_id}.wav"

    if not wav_path.exists():
        # Fallback search
        matching = list(AUDIO_CACHE_DIR.glob(f"*{clean_id}*.wav"))
        if matching:
            wav_path = matching[0]
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Extracted audio for YouTube video '{clean_id}' not found. Please process it first.",
            )

    return FileResponse(
        path=str(wav_path),
        media_type="audio/wav",
        filename=f"youtube_{clean_id}.wav",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.get("/api/playlist")
async def get_playlist():
    """
    Returns all songs that have been processed and cached in .synwave_cache.
    Scans extracted audio files, resolves metadata & Demucs stem status, and returns a sorted playlist.
    """
    playlist = []
    seen_ids = set()

    # Discover all extracted audio tracks (yt_{video_id}.wav) sorted newest first
    audio_files = sorted(
        list(AUDIO_CACHE_DIR.glob("yt_*.wav")),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )

    for af in audio_files:
        raw_name = af.stem  # e.g. yt_dhOaQfjRrKI
        vid = raw_name[3:] if raw_name.startswith("yt_") else raw_name
        if vid in seen_ids:
            continue
        seen_ids.add(vid)

        canonical_url = f"https://www.youtube.com/watch?v={vid}"
        meta = get_or_fetch_metadata(vid, canonical_url)

        # Check Demucs stem separation availability
        from demucs_service import get_demucs_service
        stems = get_demucs_service().get_cached_result(file_hash=f"yt_{vid}", song_key=canonical_url)

        duration = meta.get("duration", 0)
        if not duration and stems and "durationSeconds" in stems:
            duration = round(stems["durationSeconds"])
            meta["duration"] = duration

        bpm = None
        if stems and stems.get("demucsBpm"):
            bpm = stems["demucsBpm"].get("bpm")

        playlist.append({
            "videoId": vid,
            "uniqueId": f"yt_{vid}",
            "title": meta.get("title", f"YouTube Track ({vid})"),
            "artist": meta.get("artist") or meta.get("uploader", "YouTube Creator"),
            "duration": duration,
            "durationSeconds": stems.get("durationSeconds", duration) if stems else duration,
            "thumbnailUrl": meta.get("thumbnailUrl") or f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg",
            "youtubeUrl": canonical_url,
            "audioUrl": f"http://127.0.0.1:8765/api/audio/{vid}",
            "cached": True,
            "hasStems": bool(stems and stems.get("stems")),
            "bpm": bpm,
            "processedAt": af.stat().st_mtime,
        })

    return {
        "success": True,
        "count": len(playlist),
        "tracks": playlist,
    }

@app.get("/api/cache/info")
async def cache_info():
    """Returns telemetry on persistent .synwave_cache storage."""
    audio_files = list(AUDIO_CACHE_DIR.glob("*.wav"))
    stems_files = list(STEMS_CACHE_DIR.glob("*.json"))
    meta_files = list(META_CACHE_DIR.glob("*.json"))

    total_audio_bytes = sum(f.stat().st_size for f in audio_files)
    total_stems_bytes = sum(f.stat().st_size for f in stems_files)

    return {
        "audioTracksCount": len(audio_files),
        "stemsCount": len(stems_files),
        "metaCount": len(meta_files),
        "audioStorageMb": round(total_audio_bytes / (1024 * 1024), 2),
        "stemsStorageMb": round(total_stems_bytes / (1024 * 1024), 2),
        "cacheDirectory": str(CACHE_BASE_DIR),
    }

@app.post("/api/cache/clear")
async def clear_cache():
    """Clears cached audio, stems, and metadata from disk."""
    cleared = 0
    for folder in [AUDIO_CACHE_DIR, STEMS_CACHE_DIR, META_CACHE_DIR]:
        for f in folder.glob("*.*"):
            try:
                f.unlink()
                cleared += 1
            except Exception:
                pass
    if INDEX_FILE.exists():
        try:
            INDEX_FILE.unlink()
            cleared += 1
        except Exception:
            pass
    return {"success": True, "clearedFiles": cleared}

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 65)
    print("  SYNWAVE YOUTUBE AUDIO EXTRACTION & NEURAL DEMUCS SERVICE")
    print("  Port: 8765 | Apple Silicon Metal (MPS) Acceleration Enabled")
    print("=" * 65 + "\n")
    uvicorn.run("server:app", host="127.0.0.1", port=8765, log_level="info")
