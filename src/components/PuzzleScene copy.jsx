// ==============================
// IMPORTS
// ==============================

import {
  useMemo,
  forwardRef,
  Suspense
} from "react";

import * as THREE from "three";
import { Canvas, useLoader } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

// ==============================
// CONSTANTS
// ==============================

export const puzzlePositions = [
  { 
    svg: 1,
    final: [-5.5, 0.8, 0], 
    initial: [-7, 3, -2], 
    color: "#3a86ff",
    scale: 1
  },
  { 
    svg: 11,
    final: [-5.5, 0.8, 0], 
    initial: [-5.5, 0.8, 0], 
    color: "#3a86ff",
    scale: 1
  },
  { 
    svg: 4,
    final: [-5.32, -0.5, 0], 
    initial: [-8, -2, -1], 
    color: "#ff6b9d",
    scale: 1.25
  },
  { 
    svg: 7,
    final: [-5.5, -2, 0], 
    initial: [-6, -4, -2], 
    color: "#3a86ff",
    scale: 1.23
  },
  { 
    svg: 4,
    final: [-3.8, 0.8, 0], 
    initial: [7, 3, -1], 
    color: "#2ecc71"
  },
  { 
    svg: 5,
    final: [-3.8, -0.8, 0], 
    initial: [8, -3, -2], 
    color: "#2ecc71"
  },
  { 
    svg: 6,
    final: [-3, -0.8, 0], 
    initial: [6, -4, -1], 
    color: "#2ecc71"
  },
  { 
    svg: 7,
    final: [-1.5, 0.8, 0], 
    initial: [-2, 5, 2], 
    color: "#f5f5f5"
  },
  { 
    svg: 8,
    final: [-1.5, 0, 0], 
    initial: [-3, -5, 1], 
    color: "#f5f5f5"
  },
  { 
    svg: 9,
    final: [-0.7, -0.8, 0], 
    initial: [2, -5, 2], 
    color: "#f5f5f5"
  },
  { 
    svg: 1,
    final: [0.8, 0.8, 0], 
    initial: [3, 6, -2], 
    color: "#ff6b6b"
  },
  { 
    svg: 2,
    final: [0.8, 0, 0], 
    initial: [4, -6, 1], 
    color: "#ff6b6b",
  },
  { 
    svg: 3,
    final: [1.6, -0.8, 0], 
    initial: [-4, -6, -1], 
    color: "#ff6b6b"
    },
  { 
    svg: 4,
    final: [2.8, -0.8, 0], 
    initial: [0, 7, 2], 
    color: "#ffd93d"
  },
  { 
    svg: 5,
    final: [4, 0.8, 0], 
    initial: [-5, 6, 1], 
    color: "#6c5ce7"
  },
  { 
    svg: 6,
    final: [4, 0, 0], 
    initial: [5, 5, -2], 
    color: "#6c5ce7"
  },
  { 
    svg: 7,
    final: [4, -0.8, 0], 
    initial: [-6, -5, 2], 
    color: "#6c5ce7"
  },
  { 
    svg: 8,
    final: [5.5, 0.8, 0], 
    initial: [9, 4, 1], 
    color: "#fd79a8"
  },
  { 
    svg: 9,
    final: [5.5, 0, 0], 
    initial: [-9, -4, -2], 
    color: "#fd79a8"
  },
  { 
    svg: 1,
    final: [6.3, 0.8, 0], 
    initial: [7, -6, 2], 
    color: "#fd79a8"
  },
];

// ==============================
// HOOKS
// ==============================


function usePuzzleSVG(index) {
  const data = useLoader(
    SVGLoader,
    `/assets/puzzle_pieces/simple-puzzle-piece-pattern-${index}.svg`
  );

  return useMemo(() => {
    console.log(`\n🔍 SVG ${index}: Processando...`);
    
    const shapes = [];

    data.paths.forEach((path) => {
      const pathShapes = SVGLoader.createShapes(path);
      
      pathShapes.forEach((shape) => {
        // ✨ SOLUÇÃO: Remove os holes problemáticos
        if (shape.holes && shape.holes.length > 0) {
          console.log(`  ⚠️ SVG ${index}: Removendo ${shape.holes.length} hole(s)`);
          shape.holes = [];  // ← LIMPA OS HOLES
        }
        
        shapes.push(shape);
      });
    });

    console.log(`  ✅ SVG ${index}: ${shapes.length} shape(s) processada(s)\n`);
    return shapes;
  }, [data, index]);
}

function usePuzzleGeometry(svgIndex, customScale = 1) {
  const shapes = usePuzzleSVG(svgIndex);

  return useMemo(() => {
    if (!shapes || shapes.length === 0) return null;

    const extrudeSettings = {
      depth: 20,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(
      shapes,
      extrudeSettings
    );

    const scaleFactor = 0.0035 * customScale; // Ajuste fino para o tamanho das peças

    geometry.scale(scaleFactor, -scaleFactor, scaleFactor);
    geometry.center();

    return geometry;
  }, [shapes, customScale]);
}

// ==============================
// COMPONENTS
// ==============================

const JigsawPiece = forwardRef(
  ({ svg, color, position, rotation, scale = 1 }, ref) => {
    const geometry = usePuzzleGeometry(svg, scale);

    if (!geometry) return null;

    return (
      <mesh
        ref={ref}
        geometry={geometry}
        position={position}
        rotation={rotation}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          metalness={0.05}
          side={THREE.DoubleSide}      // ← ADICIONE (renderiza ambos lados)
          emissive={color}             // ← ADICIONE (faz brilhar)
          emissiveIntensity={0.3}
          
        />
      </mesh>
    );
  }
);

JigsawPiece.displayName = 'JigsawPiece';

function Pieces({ piecesRef }) {
  return (
    <group>
      {puzzlePositions.map((data, index) => (
        <JigsawPiece
          key={index}
          svg={data.svg}
          color={data.color}
          position={data.initial}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ]}
          scale={data.scale || 1}
          ref={(el) => {
            if (el) {
              piecesRef.current[index] = el;
              console.log(`[PuzzleScene] Peça ${index} registrada:`, el);
            }
          }}
        />
      ))}
    </group>
  );
}

// Fallback component
function LoadingFallback() {
  return null; // Ou um placeholder se preferir
}

// ==============================
// MAIN COMPONENT
// ==============================

// ✅ AGORA RECEBE piecesRef como prop do App.jsx
export default function PuzzleScene({ piecesRef }) {
  console.log('[PuzzleScene] Renderizando com piecesRef:', piecesRef);

  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 60 }} shadows>
      <color attach="background" args={["#dfd5d5"]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.2}
        castShadow
      />
      <pointLight
        position={[-10, -10, -5]}
        intensity={0.4}
        color="#3a86ff"
      />

      <Suspense fallback={<LoadingFallback />}>
        <Pieces piecesRef={piecesRef} />
      </Suspense>
    </Canvas>
  );
}