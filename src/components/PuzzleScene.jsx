// ==============================
// IMPORTS
// ==============================

import { useMemo, forwardRef, Suspense } from "react";

import * as THREE from "three";
import { Canvas, useLoader } from "@react-three/fiber";

// ==============================
// WORLD CONFIGURATION
// ==============================

// Controla proporção estrutural real do puzzle
const PUZZLE_BASE_WIDTH = 12;

// Controla zoom geral do mundo 3D
const WORLD_SCALE = 5;

// Controla escala do background SVG independente das peças
const BACKGROUND_SCALE = 3;

// ==============================
// CONFIGURAÇÃO DAS PEÇAS
// ==============================

export const puzzlePositions = [
  {
    svg: 12,
    final: [-4.75, -2.599, 0],
    initial: [-7, 3, -2],
    color: "#3a86ff",
    scale: 0.283,
    depth: 0.12,
  },
  {
    svg: 13,
    final: [5.058, -0.513, 0],
    initial: [0, 7, 2],
    color: "#3a86ff",
    scale: 0.283,
    depth: 0.12,
  },
  // Adicione as demais seguindo o mesmo padrão
];

// ==============================
// HOOK: SVG → TEXTURA
// ==============================

function useSVGTexture(index) {
  const texture = useLoader(
    THREE.TextureLoader,
    `/assets/puzzle_pieces/simple-puzzle-piece-pattern-${index}.svg`,
  );

  return useMemo(() => {
    if (!texture?.image) return null;

    const width = texture.image.width;
    const height = texture.image.height;
    const aspectRatio = width / height;

    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return { texture, aspectRatio };
  }, [texture, index]);
}

// ==============================
// HOOK: Plane proporcional global
// ==============================

function usePlaneForSVG(index) {
  const svgData = useSVGTexture(index);

  return useMemo(() => {
    if (!svgData) return null;

    const { aspectRatio, texture } = svgData;

    const height = PUZZLE_BASE_WIDTH / aspectRatio;

    const geometry = new THREE.PlaneGeometry(PUZZLE_BASE_WIDTH, height);

    return { geometry, texture };
  }, [svgData, index]);
}

// ==============================
// COMPONENTE: Peça
// ==============================

const JigsawPiece = forwardRef(
  ({ svg, color, initial, scale = 1, depth = 0.1 }, ref) => {
    const planeData = usePlaneForSVG(svg);

    if (!planeData) return null;

    const { geometry, texture } = planeData;

    return (
      <group
        ref={ref}
        position={initial}
        scale={scale}
        rotation={[
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ]}
      >
        {/* FRENTE */}
        <mesh
          geometry={geometry}
          position={[0, 0, depth / 2]}
          castShadow
          receiveShadow
        >
          <meshBasicMaterial map={texture} transparent alphaTest={0.09} />
        </mesh>

        {/* VERSO */}
        <mesh
          geometry={geometry}
          position={[0, 0, -depth / 2]}
          rotation={[0, Math.PI, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  },
);

JigsawPiece.displayName = "JigsawPiece";

// ==============================
// COMPONENTE: Todas as Peças
// ==============================

function Pieces({ piecesRef }) {
  return (
    <group>
      {puzzlePositions.map((data, index) => (
        <JigsawPiece
          key={index}
          svg={data.svg}
          color={data.color}
          initial={data.initial}
          scale={data.scale || 1}
          depth={data.depth || 0.1}
          ref={(el) => {
            if (el) {
              piecesRef.current[index] = el;
            }
          }}
        />
      ))}
    </group>
  );
}

// ==============================
// COMPONENTE: Background
// ==============================

function BackgroundPattern() {
  const planeData = usePlaneForSVG(0);

  if (!planeData) return null;

  const { geometry, texture } = planeData;

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, -1]}
      scale={BACKGROUND_SCALE}
      receiveShadow
    >
      <meshBasicMaterial map={texture} transparent alphaTest={0.09} />
    </mesh>
  );
}

// ==============================
// MAIN COMPONENT
// ==============================

export default function PuzzleScene({ piecesRef }) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 40],
        fov: 50,
        aspect: 1816 / 690,
      }}
      shadows
      style={{ width: "100%", height: "100%", display: "block" }}
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ camera, gl }) => {
        camera.aspect = 1816 / 690;
        camera.updateProjectionMatrix();
        gl.setSize(gl.domElement.width, gl.domElement.height, false);
      }}
    >
      <color attach="background" args={["#dfd5d5"]} />

      {/* Luzes */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[20, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Suspense fallback={null}>
        {/* WORLD SCALE CONTROLLER */}
        <group scale={WORLD_SCALE}>
          <BackgroundPattern />
          <Pieces piecesRef={piecesRef} />
        </group>
      </Suspense>
    </Canvas>
  );
}
