import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sphere } from "@react-three/drei";

export default function FloatingOrb({ position = [0, 0, 0], color = "#6366f1", speed = 0.4, distort = 0.4 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * speed) * 0.5;
      ref.current.rotation.z = clock.getElapsedTime() * 0.2;
    }
  });

  return (
    <Sphere ref={ref} args={[1, 64, 64]} position={position} scale={1.2}>
      <MeshDistortMaterial
        color={color}
        attach="material"
        distort={distort}
        speed={speed * 2}
        roughness={0.1}
        metalness={0.6}
        transparent
        opacity={0.7}
      />
    </Sphere>
  );
}
