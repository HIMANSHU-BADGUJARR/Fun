# Fun — AI Content Detector 🔍

A full-stack **3D web application** that detects whether uploaded content is **AI-generated or real**.

Upload a **video clip**, **photo**, or paste **text** — the platform instantly analyses the content and tells you whether it's authentic or AI-generated.

---

## ✨ Features

- 🖼️ **Image detection** — Analyses EXIF metadata, pixel noise, color distribution, and dimensions to identify AI-generated images (Stable Diffusion, Midjourney, DALL-E, etc.)
- 🎬 **Video detection** — Inspects file entropy, container format, file size patterns, and embedded AI-tool signatures
- 📝 **Text detection** — Examines sentence uniformity, vocabulary richness, filler word density, AI phrase patterns, and paragraph structure
- 🌐 **3D visual experience** — Three.js particle field, animated orbs, and a rotating star field built with React Three Fiber
- 📊 **Detailed results** — AI probability score (0–100%), confidence level, and specific detected indicators
- ⚡ **Instant analysis** — FastAPI backend returns results in milliseconds

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 8 |
| 3D Graphics | Three.js + React Three Fiber + Drei |
| Styling | Tailwind CSS v4 |
| Backend | Python FastAPI + Uvicorn |
| Image Processing | Pillow + NumPy |
| HTTP | Axios |

---

## 🚀 Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

> **Note**: The frontend expects the backend at `http://localhost:8000` by default.  
> Override with: `VITE_API_URL=http://your-api-host npm run dev`

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/detect/text` | Analyse text (form field: `text`) |
| `POST` | `/detect/image` | Analyse image (multipart: `file`) |
| `POST` | `/detect/video` | Analyse video (multipart: `file`) |

### Example response

```json
{
  "type": "text",
  "ai_probability": 0.78,
  "verdict": {
    "verdict": "AI-Generated",
    "confidence": "High",
    "description": "This content shows strong indicators of being AI-generated."
  },
  "indicators": [
    "Contains common AI phrases",
    "Uniform sentence lengths typical of AI"
  ],
  "metrics": { ... }
}
```

---

## ⚠️ Disclaimer

This tool uses **heuristic analysis** — it is designed for educational and awareness purposes. No detection system is 100% accurate. Results should be treated as probability estimates, not definitive verdicts.

---

*Built with ❤️ using React, Three.js, and FastAPI*
