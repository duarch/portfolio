import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

const pieceStyle = {
  radius: 0.12,
  smoothness: 4,
};

// Jigsaw puzzle piece positions to spell "DUAR.CH"
export const puzzlePositions = [
  // D
  { final: [-5.5, 0.8, 0], initial: [-7, 3, -2], color: "#3a86ff" },
  { final: [-5.5, 0, 0], initial: [-8, -2, -1], color: "#3a86ff" },
  { final: [-5.5, -0.8, 0], initial: [-6, -4, -2], color: "#3a86ff" },
  
  // U
  { final: [-3.8, 0.8, 0], initial: [7, 3, -1], color: "#2ecc71" },
  { final: [-3.8, -0.8, 0], initial: [8, -3, -2], color: "#2ecc71" },
  { final: [-3, -0.8, 0], initial: [6, -4, -1], color: "#2ecc71" },
  
  // A
  { final: [-1.5, 0.8, 0], initial: [-2, 5, 2], color: "#f5f5f5" },
  { final: [-1.5, 0, 0], initial: [-3, -5, 1], color: "#f5f5f5" },
  { final: [-0.7, -0.8, 0], initial: [2, -5, 2], color: "#f5f5f5" },
  
  // R
  { final: [0.8, 0.8, 0], initial: [3, 6, -2], color: "#ff6b6b" },
  { final: [0.8, 0, 0], initial: [4, -6, 1], color: "#ff6b6b" },
  { final: [1.6, -0.8, 0], initial: [-4, -6, -1], color: "#ff6b6b" },
  
  // . (dot)
  { final: [2.8, -0.8, 0], initial: [0, 7, 2], color: "#ffd93d" },
  
  // C
  { final: [4, 0.8, 0], initial: [-5, 6, 1], color: "#6c5ce7" },
  { final: [4, 0, 0], initial: [5, 5, -2], color: "#6c5ce7" },
  { final: [4, -0.8, 0], initial: [-6, -5, 2], color: "#6c5ce7" },
  
  // H
  { final: [5.5, 0.8, 0], initial: [9, 4, 1], color: "#fd79a8" },
  { final: [5.5, 0, 0], initial: [-9, -4, -2], color: "#fd79a8" },
  { final: [6.3, 0.8, 0], initial: [7, -6, 2], color: "#fd79a8" },
];

function Pieces({ piecesRef }) {
  return (
    <group>
      {puzzlePositions.map((data, index) => (
        <RoundedBox
          key={index}
          args={[0.7, 0.7, 0.3]}
          position={data.initial}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ]}
          ref={(el) => (piecesRef.current[index] = el)}
          {...pieceStyle}
        >
          <meshStandardMaterial color={data.color} roughness={0.3} metalness={0.1} />
        </RoundedBox>
      ))}
    </group>
  );
}

export default function PuzzleScene({ piecesRef }) {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 50 }}>
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3a86ff" />
      <Pieces piecesRef={piecesRef} />
    </Canvas>
  );
}