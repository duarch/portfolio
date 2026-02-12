import { useRef, useMemo, forwardRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

// ========== CONFIGURAÇÕES ==========
const PW = 0.7;
const PH = 0.7;
const THICK = 0.3;
const NECK_WIDTH_F = 0.3;
const TAB_SIZE_F = 0.25;

// ========== UTILITÁRIOS ==========
function generateEdgeTypes(seed) {
  const rand = (n) => {
    const x = Math.sin(n) * 10000;
    return x - Math.floor(x);
  };
  return {
    top: rand(seed * 4) < 0.5,
    bottom: rand(seed * 4 + 1) < 0.5,
    left: rand(seed * 4 + 2) < 0.5,
    right: rand(seed * 4 + 3) < 0.5,
  };
}

function generateEdgeCurve(isTab) {
  const sign = isTab ? 1 : -1;
  return (t, length, perpSign) => {
    const neckWidth = length * NECK_WIDTH_F;
    const tabDepth = length * TAB_SIZE_F * sign * perpSign;
    if (t < 0.5 - neckWidth / length / 2 || t > 0.5 + neckWidth / length / 2)
      return { along: t, perp: 0 };
    const localT = (t - (0.5 - neckWidth / length / 2)) / (neckWidth / length);
    return {
      along: t,
      perp: 4 * Math.abs(tabDepth) * localT * (1 - localT) * Math.sign(tabDepth),
    };
  };
}

function createPieceShape(edgeTypes) {
  const shape = new THREE.Shape();
  const segments = 32;

  function addCurvedEdge(x1, y1, x2, y2, curveFunc, perpSign) {
    if (!curveFunc) {
      shape.lineTo(x2, y2);
      return;
    }
    const dx = x2 - x1,
      dy = y2 - y1,
      length = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / length,
      dirY = dy / length,
      perpX = -dirY * perpSign,
      perpY = dirX * perpSign;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments,
        curve = curveFunc(t, length, 1);
      shape.lineTo(
        x1 + dirX * curve.along * length + perpX * curve.perp,
        y1 + dirY * curve.along * length + perpY * curve.perp
      );
    }
  }

  shape.moveTo(-PW / 2, -PH / 2);
  addCurvedEdge(-PW / 2, -PH / 2, PW / 2, -PH / 2, edgeTypes.bottom ? generateEdgeCurve(true) : null, 1);
  addCurvedEdge(PW / 2, -PH / 2, PW / 2, PH / 2, edgeTypes.right ? generateEdgeCurve(true) : null, 1);
  addCurvedEdge(PW / 2, PH / 2, -PW / 2, PH / 2, edgeTypes.top ? generateEdgeCurve(true) : null, -1);
  addCurvedEdge(-PW / 2, PH / 2, -PW / 2, -PH / 2, edgeTypes.left ? generateEdgeCurve(true) : null, -1);
  return shape;
}

function createPieceGeometry(shape) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: THICK * 0.03,
    bevelEnabled: true,
    bevelThickness: THICK * 0.2,
    bevelSize: THICK * 0.2,
    bevelSegments: 20,
  });
  geometry.translate(0, 0, -THICK / 2);
  geometry.computeVertexNormals();
  return geometry;
}

// ========== COMPONENTE JIGSAW PIECE COM FORWARD REF ==========
const JigsawPiece = forwardRef(({ edgeTypes, color, position, rotation }, ref) => {
  const geometry = useMemo(() => {
    const shape = createPieceShape(edgeTypes);
    return createPieceGeometry(shape);
  }, [edgeTypes]);

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
});

JigsawPiece.displayName = 'JigsawPiece';

// ========== DADOS DAS PEÇAS (INALTERADO) ==========
export const puzzlePositions = [
  { final: [-5.5, 0.8, 0], initial: [-7, 3, -2], color: "#3a86ff" },
  { final: [-5.5, 0, 0], initial: [-8, -2, -1], color: "#3a86ff" },
  { final: [-5.5, -0.8, 0], initial: [-6, -4, -2], color: "#3a86ff" },
  { final: [-3.8, 0.8, 0], initial: [7, 3, -1], color: "#2ecc71" },
  { final: [-3.8, -0.8, 0], initial: [8, -3, -2], color: "#2ecc71" },
  { final: [-3, -0.8, 0], initial: [6, -4, -1], color: "#2ecc71" },
  { final: [-1.5, 0.8, 0], initial: [-2, 5, 2], color: "#f5f5f5" },
  { final: [-1.5, 0, 0], initial: [-3, -5, 1], color: "#f5f5f5" },
  { final: [-0.7, -0.8, 0], initial: [2, -5, 2], color: "#f5f5f5" },
  { final: [0.8, 0.8, 0], initial: [3, 6, -2], color: "#ff6b6b" },
  { final: [0.8, 0, 0], initial: [4, -6, 1], color: "#ff6b6b" },
  { final: [1.6, -0.8, 0], initial: [-4, -6, -1], color: "#ff6b6b" },
  { final: [2.8, -0.8, 0], initial: [0, 7, 2], color: "#ffd93d" },
  { final: [4, 0.8, 0], initial: [-5, 6, 1], color: "#6c5ce7" },
  { final: [4, 0, 0], initial: [5, 5, -2], color: "#6c5ce7" },
  { final: [4, -0.8, 0], initial: [-6, -5, 2], color: "#6c5ce7" },
  { final: [5.5, 0.8, 0], initial: [9, 4, 1], color: "#fd79a8" },
  { final: [5.5, 0, 0], initial: [-9, -4, -2], color: "#fd79a8" },
  { final: [6.3, 0.8, 0], initial: [7, -6, 2], color: "#fd79a8" },
];

// ========== COMPONENTE DE AGRUPAMENTO ==========
function Pieces({ piecesRef }) {
  return (
    <group>
      {puzzlePositions.map((data, index) => {
        // edgeTypes gerado dentro do map, mas agora estável (seed = index)
        const edgeTypes = generateEdgeTypes(index);
        return (
          <JigsawPiece
            key={index}
            edgeTypes={edgeTypes}
            color={data.color}
            position={data.initial}
            rotation={[
              Math.random() * Math.PI,
              Math.random() * Math.PI,
              Math.random() * Math.PI,
            ]}
            ref={(el) => (piecesRef.current[index] = el)}
          />
        );
      })}
    </group>
  );
}

// ========== CENA PRINCIPAL (INALTERADA) ==========
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