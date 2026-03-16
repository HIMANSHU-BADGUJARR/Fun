"""
AI Content Detection API
Detects whether uploaded content (text, images, videos) is AI-generated or real.
"""

import os
import io
import re
import math
import hashlib
import tempfile
import statistics
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np
import aiofiles

app = FastAPI(
    title="AI Content Detector",
    description="Detects whether content is AI-generated or real",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Text detection helpers
# ---------------------------------------------------------------------------

AI_PHRASES = [
    "as an ai", "i am an ai", "i'm an ai", "as a language model",
    "i cannot provide", "i'm unable to", "i am unable to",
    "certainly!", "certainly,", "of course!", "absolutely!",
    "i'd be happy to", "i would be happy to",
    "it is important to note", "it's important to note",
    "it is worth noting", "it's worth noting",
    "in conclusion,", "in summary,", "to summarize,",
    "furthermore,", "moreover,", "additionally,",
    "it is essential", "it's essential",
    "i understand that", "please note that",
    "feel free to", "don't hesitate",
]

FILLER_WORDS = [
    "very", "really", "quite", "rather", "somewhat",
    "basically", "essentially", "generally", "typically",
    "usually", "often", "always", "never",
]


def analyze_text(text: str) -> dict:
    """Heuristic analysis to estimate if text is AI-generated."""
    if not text or len(text.strip()) < 10:
        return {"error": "Text too short for analysis"}

    text_lower = text.lower()
    words = text_lower.split()
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]

    if not sentences:
        return {"error": "Could not parse sentences"}

    scores = {}

    # 1. AI phrase detection
    ai_phrase_hits = sum(1 for phrase in AI_PHRASES if phrase in text_lower)
    scores["ai_phrases"] = min(ai_phrase_hits / 3.0, 1.0)

    # 2. Sentence length uniformity (AI tends toward uniform sentence lengths)
    sent_lengths = [len(s.split()) for s in sentences]
    if len(sent_lengths) > 1:
        avg_len = statistics.mean(sent_lengths)
        stdev_len = statistics.stdev(sent_lengths) if len(sent_lengths) > 1 else 0
        cv = stdev_len / avg_len if avg_len > 0 else 0
        # Low CV → uniform → more AI-like
        scores["uniformity"] = max(0.0, 1.0 - cv)
    else:
        scores["uniformity"] = 0.5

    # 3. Vocabulary richness (type-token ratio)
    unique_words = len(set(words))
    ttr = unique_words / len(words) if words else 0
    # AI tends toward moderate TTR; very low or very high indicates real text
    scores["vocabulary"] = 1.0 - abs(ttr - 0.55) * 2.0
    scores["vocabulary"] = max(0.0, min(1.0, scores["vocabulary"]))

    # 4. Filler word density
    filler_count = sum(1 for w in words if w in FILLER_WORDS)
    filler_ratio = filler_count / len(words) if words else 0
    # High filler density can indicate AI padding
    scores["filler_density"] = min(filler_ratio * 10, 1.0)

    # 5. Punctuation regularity
    comma_ratio = text.count(",") / max(len(sentences), 1)
    # AI tends to use commas regularly
    scores["punctuation"] = min(comma_ratio / 3.0, 1.0)

    # 6. Paragraph structure (AI often uses very structured paragraphs)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) > 1:
        para_lengths = [len(p.split()) for p in paragraphs]
        para_stdev = statistics.stdev(para_lengths) if len(para_lengths) > 1 else 0
        para_avg = statistics.mean(para_lengths)
        para_cv = para_stdev / para_avg if para_avg > 0 else 1
        scores["structure"] = max(0.0, 1.0 - para_cv * 0.8)
    else:
        scores["structure"] = 0.3

    # Weighted average
    weights = {
        "ai_phrases": 0.30,
        "uniformity": 0.20,
        "vocabulary": 0.15,
        "filler_density": 0.10,
        "punctuation": 0.15,
        "structure": 0.10,
    }
    ai_score = sum(scores[k] * weights[k] for k in weights)

    indicators = []
    if scores["ai_phrases"] > 0.3:
        indicators.append("Contains common AI phrases")
    if scores["uniformity"] > 0.6:
        indicators.append("Uniform sentence lengths typical of AI")
    if scores["vocabulary"] > 0.6:
        indicators.append("Vocabulary richness consistent with AI output")
    if scores["filler_density"] > 0.3:
        indicators.append("High density of filler/transition words")
    if scores["punctuation"] > 0.5:
        indicators.append("Regular comma usage pattern")
    if scores["structure"] > 0.6:
        indicators.append("Highly structured paragraph layout")

    return {
        "ai_probability": round(ai_score, 3),
        "indicators": indicators,
        "metrics": {k: round(v, 3) for k, v in scores.items()},
        "word_count": len(words),
        "sentence_count": len(sentences),
    }


# ---------------------------------------------------------------------------
# Image detection helpers
# ---------------------------------------------------------------------------

def analyze_image(image_bytes: bytes, filename: str) -> dict:
    """Heuristic analysis to estimate if an image is AI-generated."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    scores = {}
    indicators = []

    width, height = img.size

    # 1. Check for common AI image dimensions (often perfectly square or powers of 2)
    is_square = width == height
    is_power_of_2 = (width & (width - 1) == 0) and (height & (height - 1) == 0)
    is_common_ai_size = (width, height) in [
        (512, 512), (768, 768), (1024, 1024),
        (512, 768), (768, 512), (1024, 768), (768, 1024),
        (1024, 1024), (2048, 2048),
    ]
    scores["dimensions"] = 0.7 if is_common_ai_size else (0.4 if is_square else 0.1)
    if is_common_ai_size:
        indicators.append(f"Image dimensions ({width}×{height}) match common AI generation sizes")

    # 2. Metadata analysis
    exif_data = {}
    try:
        exif_data = dict(img.getexif() or {})
    except Exception:
        pass

    has_camera_make = any(tag_id in exif_data for tag_id in [271, 272])  # Make, Model
    has_gps = 34853 in exif_data  # GPS tag
    has_datetime = 36867 in exif_data  # DateTimeOriginal

    if has_camera_make:
        scores["metadata"] = 0.05
        indicators.append("Contains real camera EXIF metadata")
    elif not exif_data:
        scores["metadata"] = 0.6
        indicators.append("No EXIF metadata (common in AI-generated images)")
    else:
        scores["metadata"] = 0.4

    # 3. Pixel-level noise analysis
    img_rgb = img.convert("RGB")
    arr = np.array(img_rgb, dtype=np.float32)

    # Compute noise in high-frequency components
    if arr.shape[0] > 8 and arr.shape[1] > 8:
        # Sample noise using differences between neighboring pixels
        h_diff = np.abs(np.diff(arr, axis=1))
        v_diff = np.abs(np.diff(arr, axis=0))
        noise_h = float(np.mean(h_diff))
        noise_v = float(np.mean(v_diff))
        avg_noise = (noise_h + noise_v) / 2.0

        # AI images tend to have very smooth or artificially textured noise
        # Real photos: noise ~5-20; very smooth AI images: <5; over-processed: >25
        if avg_noise < 4.0:
            scores["noise"] = 0.75
            indicators.append("Unusually smooth pixel transitions (AI-typical)")
        elif avg_noise > 30.0:
            scores["noise"] = 0.3
            indicators.append("High noise level (consistent with real camera sensor)")
        else:
            scores["noise"] = 0.4
    else:
        scores["noise"] = 0.5

    # 4. Color distribution (AI images often have distinctive color patterns)
    r_chan = arr[:, :, 0].flatten()
    g_chan = arr[:, :, 1].flatten()
    b_chan = arr[:, :, 2].flatten()

    # Check color channel correlations (AI often has high inter-channel correlation)
    r_mean, g_mean, b_mean = float(np.mean(r_chan)), float(np.mean(g_chan)), float(np.mean(b_chan))
    channel_balance = 1.0 - (max(r_mean, g_mean, b_mean) - min(r_mean, g_mean, b_mean)) / 255.0
    scores["color_balance"] = 0.5 * channel_balance  # Slight AI indicator if balanced

    # 5. Saturation analysis
    img_hsv = img.convert("HSV") if hasattr(img, "convert") else None
    try:
        img_hsv = img_rgb.convert("HSV")
        hsv_arr = np.array(img_hsv, dtype=np.float32)
        saturation = hsv_arr[:, :, 1]
        sat_mean = float(np.mean(saturation))
        sat_std = float(np.std(saturation))
        # AI images often have uniformly high saturation
        if sat_mean > 150 and sat_std < 50:
            scores["saturation"] = 0.7
            indicators.append("Uniformly high saturation (AI-typical)")
        else:
            scores["saturation"] = 0.3
    except Exception:
        scores["saturation"] = 0.4

    weights = {
        "dimensions": 0.25,
        "metadata": 0.30,
        "noise": 0.20,
        "color_balance": 0.10,
        "saturation": 0.15,
    }
    ai_score = sum(scores[k] * weights[k] for k in weights)

    return {
        "ai_probability": round(ai_score, 3),
        "indicators": indicators,
        "metrics": {k: round(v, 3) for k, v in scores.items()},
        "image_info": {
            "width": width,
            "height": height,
            "mode": img.mode,
            "format": img.format,
            "has_exif": bool(exif_data),
        },
    }


# ---------------------------------------------------------------------------
# Video detection helpers
# ---------------------------------------------------------------------------

def analyze_video(video_bytes: bytes, filename: str) -> dict:
    """
    Heuristic video analysis. Samples key bytes to detect AI generation patterns.
    For a production system this would use CV2 + deep learning models.
    """
    indicators = []
    scores = {}

    # 1. File size heuristics
    file_size = len(video_bytes)

    # 2. Entropy analysis (AI videos often have different entropy patterns)
    sample = video_bytes[: min(65536, len(video_bytes))]
    byte_counts = [0] * 256
    for b in sample:
        byte_counts[b] += 1
    entropy = 0.0
    n = len(sample)
    for count in byte_counts:
        if count > 0:
            p = count / n
            entropy -= p * math.log2(p)

    # Typical MP4/video entropy: 7.5–8.0 (highly compressed)
    if entropy > 7.9:
        scores["entropy"] = 0.35
    elif entropy < 6.0:
        scores["entropy"] = 0.65
        indicators.append("Unusual file entropy pattern")
    else:
        scores["entropy"] = 0.45

    # 3. Header/container analysis
    header = video_bytes[:12]
    is_mp4 = header[4:8] in [b"ftyp", b"moov", b"mdat"]
    is_webm = video_bytes[:4] == b"\x1a\x45\xdf\xa3"

    if is_mp4 or is_webm:
        scores["format"] = 0.4  # Real container format
    else:
        scores["format"] = 0.5

    # 4. File size analysis
    # AI-generated videos tend to be specific lengths from generation tools
    # Small clips: <5MB often AI; large files: more likely real
    size_mb = file_size / (1024 * 1024)
    if size_mb < 1:
        scores["filesize"] = 0.6
        indicators.append("Small file size common in AI-generated clips")
    elif size_mb > 50:
        scores["filesize"] = 0.25
        indicators.append("Large file size consistent with real camera footage")
    else:
        scores["filesize"] = 0.45

    # 5. Look for known AI generation tool signatures in metadata
    video_str = video_bytes[:2048].decode("latin-1", errors="replace").lower()
    ai_signatures = [
        "stable diffusion", "sora", "runway", "pika", "kling",
        "gen-2", "gen2", "midjourney", "dall-e", "deepfake",
        "faceswap", "roop", "synthesia", "heygen", "d-id",
    ]
    found_sig = [sig for sig in ai_signatures if sig in video_str]
    if found_sig:
        scores["signature"] = 0.9
        indicators.append(f"AI tool signature detected: {', '.join(found_sig)}")
    else:
        scores["signature"] = 0.4

    weights = {
        "entropy": 0.20,
        "format": 0.10,
        "filesize": 0.25,
        "signature": 0.45,
    }
    ai_score = sum(scores[k] * weights[k] for k in weights)

    return {
        "ai_probability": round(ai_score, 3),
        "indicators": indicators,
        "metrics": {k: round(v, 3) for k, v in scores.items()},
        "video_info": {
            "file_size_mb": round(size_mb, 2),
            "entropy": round(entropy, 3),
        },
    }


# ---------------------------------------------------------------------------
# Classification helper
# ---------------------------------------------------------------------------

def classify(ai_probability: float) -> dict:
    """Convert probability to human-readable verdict."""
    if ai_probability >= 0.75:
        return {
            "verdict": "AI-Generated",
            "confidence": "High",
            "color": "red",
            "description": "This content shows strong indicators of being AI-generated.",
        }
    elif ai_probability >= 0.55:
        return {
            "verdict": "Likely AI-Generated",
            "confidence": "Medium",
            "color": "orange",
            "description": "This content shows moderate indicators of being AI-generated.",
        }
    elif ai_probability >= 0.40:
        return {
            "verdict": "Uncertain",
            "confidence": "Low",
            "color": "yellow",
            "description": "Cannot determine with confidence. Content shows mixed signals.",
        }
    elif ai_probability >= 0.25:
        return {
            "verdict": "Likely Real",
            "confidence": "Medium",
            "color": "lightgreen",
            "description": "This content shows moderate indicators of being real/authentic.",
        }
    else:
        return {
            "verdict": "Real / Authentic",
            "confidence": "High",
            "color": "green",
            "description": "This content shows strong indicators of being real and authentic.",
        }


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"message": "AI Content Detector API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/detect/text")
async def detect_text(text: str = Form(...)):
    """Detect if submitted text is AI-generated."""
    if len(text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Text must be at least 10 characters")
    if len(text) > 50_000:
        raise HTTPException(status_code=400, detail="Text must be under 50,000 characters")

    result = analyze_text(text)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    verdict = classify(result["ai_probability"])
    return {
        "type": "text",
        "ai_probability": result["ai_probability"],
        "verdict": verdict,
        "indicators": result["indicators"],
        "metrics": result["metrics"],
        "stats": {
            "word_count": result["word_count"],
            "sentence_count": result["sentence_count"],
        },
    }


@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    """Detect if an uploaded image is AI-generated."""
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"}
    content_type = file.content_type or ""
    if content_type not in allowed:
        # Try by extension
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload an image (JPEG, PNG, WebP, etc.)",
            )

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    result = analyze_image(contents, file.filename or "image")
    verdict = classify(result["ai_probability"])
    return {
        "type": "image",
        "filename": file.filename,
        "ai_probability": result["ai_probability"],
        "verdict": verdict,
        "indicators": result["indicators"],
        "metrics": result["metrics"],
        "image_info": result["image_info"],
    }


@app.post("/detect/video")
async def detect_video(file: UploadFile = File(...)):
    """Detect if an uploaded video is AI-generated."""
    allowed_exts = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a video (MP4, WebM, MOV, etc.)",
        )

    contents = await file.read()
    if len(contents) > 200 * 1024 * 1024:  # 200 MB limit
        raise HTTPException(status_code=400, detail="Video too large (max 200MB)")

    result = analyze_video(contents, file.filename or "video")
    verdict = classify(result["ai_probability"])
    return {
        "type": "video",
        "filename": file.filename,
        "ai_probability": result["ai_probability"],
        "verdict": verdict,
        "indicators": result["indicators"],
        "metrics": result["metrics"],
        "video_info": result["video_info"],
    }
