import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import ParticleField from "./ParticleField";
import FloatingOrb from "./FloatingOrb";
import { TextPanel, ImagePanel, VideoPanel } from "./DetectPanels";

const TABS = [
  { id: "text",  label: "📝 Text",  color: "purple" },
  { id: "image", label: "🖼️ Image", color: "cyan"   },
  { id: "video", label: "🎬 Video", color: "teal"   },
];

function Scene() {
  return (
    <>
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#a855f7" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
      <ParticleField count={2500} />
      <FloatingOrb position={[-5, 2, -8]} color="#a855f7" speed={0.3} distort={0.5} />
      <FloatingOrb position={[6, -2, -10]} color="#06b6d4" speed={0.5} distort={0.3} />
      <FloatingOrb position={[0, 4, -12]} color="#6366f1" speed={0.4} distort={0.6} />
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("text");

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans overflow-x-hidden">
      {/* 3D Background Canvas */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 60 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.3}
            maxPolarAngle={Math.PI / 1.5}
            minPolarAngle={Math.PI / 3}
          />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="text-center pt-16 pb-8 px-4">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-1.5 text-purple-300 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI Content Detector
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">
            Real or Fake?
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Upload a <strong className="text-purple-300">video clip</strong>,{" "}
            <strong className="text-cyan-300">photo</strong>, or paste{" "}
            <strong className="text-blue-300">text</strong> — our AI instantly
            analyses whether the content was AI-generated or authentic.
          </p>
        </header>

        {/* Main card */}
        <main className="flex-1 flex items-start justify-center px-4 pb-16">
          <div className="w-full max-w-xl">
            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { icon: "🤖", label: "Deepfake detection" },
                { icon: "📊", label: "Probability score" },
                { icon: "🔍", label: "Detailed indicators" },
                { icon: "⚡", label: "Instant results" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-300 text-xs"
                >
                  {icon} {label}
                </span>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex rounded-2xl bg-white/5 border border-white/10 p-1 mb-6 gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel */}
            <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              {activeTab === "text"  && <TextPanel />}
              {activeTab === "image" && <ImagePanel />}
              {activeTab === "video" && <VideoPanel />}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center pb-6 text-gray-700 text-xs">
          <p>AI Content Detector — heuristic analysis for educational purposes</p>
        </footer>
      </div>
    </div>
  );
}
