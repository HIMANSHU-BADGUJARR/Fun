import React, { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const VERDICT_STYLES = {
  "AI-Generated":       { bg: "bg-red-500/20",        border: "border-red-500",        text: "text-red-400",        icon: "🤖" },
  "Likely AI-Generated":{ bg: "bg-orange-500/20",      border: "border-orange-500",     text: "text-orange-400",     icon: "⚠️" },
  "Uncertain":          { bg: "bg-yellow-500/20",      border: "border-yellow-500",     text: "text-yellow-400",     icon: "❓" },
  "Likely Real":        { bg: "bg-lime-500/20",        border: "border-lime-500",       text: "text-lime-400",       icon: "✅" },
  "Real / Authentic":   { bg: "bg-green-500/20",       border: "border-green-500",      text: "text-green-400",      icon: "✅" },
};

function ProbabilityBar({ value }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? "bg-red-500" :
    pct >= 55 ? "bg-orange-500" :
    pct >= 40 ? "bg-yellow-500" :
    pct >= 25 ? "bg-lime-500" :
    "bg-green-500";

  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">AI Probability</span>
        <span className="font-bold text-white">{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
        <div
          className={`${color} h-4 rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ResultCard({ result }) {
  if (!result) return null;
  const style = VERDICT_STYLES[result.verdict?.verdict] || VERDICT_STYLES["Uncertain"];
  return (
    <div className={`mt-6 p-5 rounded-2xl border ${style.bg} ${style.border} backdrop-blur-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{style.icon}</span>
        <div>
          <div className={`text-xl font-bold ${style.text}`}>{result.verdict?.verdict}</div>
          <div className="text-gray-400 text-sm">Confidence: {result.verdict?.confidence}</div>
        </div>
      </div>
      <p className="text-gray-300 text-sm mb-3">{result.verdict?.description}</p>

      <ProbabilityBar value={result.ai_probability} />

      {result.indicators && result.indicators.length > 0 && (
        <div className="mt-4">
          <div className="text-gray-400 text-sm font-semibold mb-2">Detected Indicators:</div>
          <ul className="space-y-1">
            {result.indicators.map((ind, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-purple-400 mt-0.5">•</span>
                {ind}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.stats && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Object.entries(result.stats).map(([k, v]) => (
            <div key={k} className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-white font-bold">{v}</div>
              <div className="text-gray-500 text-xs capitalize">{k.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      )}

      {result.image_info && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-white font-bold">{result.image_info.width}×{result.image_info.height}</div>
            <div className="text-gray-500 text-xs">Dimensions</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-white font-bold">{result.image_info.has_exif ? "Yes" : "No"}</div>
            <div className="text-gray-500 text-xs">Has EXIF</div>
          </div>
        </div>
      )}

      {result.video_info && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-white font-bold">{result.video_info.file_size_mb} MB</div>
            <div className="text-gray-500 text-xs">File Size</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-white font-bold">{result.video_info.entropy}</div>
            <div className="text-gray-500 text-xs">Entropy</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Text Panel ----
export function TextPanel() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("text", text);
      const res = await axios.post(`${API_BASE}/detect/text`, form);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="block text-gray-300 text-sm font-medium mb-2">
        Paste text to analyze
      </label>
      <textarea
        className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-600"
        placeholder="Paste any text here — an article, social media post, essay, email, etc."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-gray-600 text-xs">{text.length.toLocaleString()} chars</span>
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? "Analyzing…" : "Detect"}
        </button>
      </div>
      {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      <ResultCard result={result} />
    </div>
  );
}

// ---- Image Panel ----
export function ImagePanel() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API_BASE}/detect/image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("image-input").click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-purple-400 bg-purple-500/10" : "border-white/20 hover:border-purple-500/50"
        }`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
        ) : (
          <>
            <div className="text-4xl mb-3">🖼️</div>
            <div className="text-gray-300 text-sm">Drag & drop an image, or click to browse</div>
            <div className="text-gray-600 text-xs mt-1">JPEG, PNG, WebP, GIF — max 20MB</div>
          </>
        )}
        <input
          id="image-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      {file && (
        <div className="mt-3 flex justify-between items-center">
          <span className="text-gray-500 text-xs truncate">{file.name}</span>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="ml-3 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "Analyzing…" : "Detect"}
          </button>
        </div>
      )}
      {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      <ResultCard result={result} />
    </div>
  );
}

// ---- Video Panel ----
export function VideoPanel() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API_BASE}/detect/video`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("video-input").click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-cyan-400 bg-cyan-500/10" : "border-white/20 hover:border-cyan-500/50"
        }`}
      >
        {preview ? (
          <video src={preview} className="max-h-48 mx-auto rounded-xl" controls />
        ) : (
          <>
            <div className="text-4xl mb-3">🎬</div>
            <div className="text-gray-300 text-sm">Drag & drop a video, or click to browse</div>
            <div className="text-gray-600 text-xs mt-1">MP4, WebM, MOV, AVI — max 200MB</div>
          </>
        )}
        <input
          id="video-input"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      {file && (
        <div className="mt-3 flex justify-between items-center">
          <span className="text-gray-500 text-xs truncate">{file.name}</span>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="ml-3 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "Analyzing…" : "Detect"}
          </button>
        </div>
      )}
      {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      <ResultCard result={result} />
    </div>
  );
}
