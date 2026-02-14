# Contexto do Projeto

Preciso criar um componente React (`PuzzleScene.jsx`) que renderiza peças de quebra-cabeça 3D interativas usando React Three Fiber(Ou outro, aceito sugestões). O sistema deve carregar SVGs com gradientes, manter proporções corretas, aplicar texturas, e permitir animação das peças.

---

## Requisitos Técnicos

### 1. Estrutura Base do Componente

```javascript
// Componente principal
export default function PuzzleScene({ piecesRef })

// Array de configuração das peças
export const puzzlePositions = [
  { 
    svg: 12,              // Índice do SVG a carregar
    final: [-2.94, -1.55, 0],   // Posição final da animação
    initial: [-7, 3, -2],     // Posição inicial (espalhada)
    color: "#3a86ff",         // Cor do verso da peça
    scale: 1,                 // Escala da peça (mantém proporções)
    depth: 0.1                // Espessura 3D
  },
  { 
    svg: 13,
    final: [3.12, -0.32, 0], 
    initial: [0, 7, 2], 
    color: "#ffd93d",
    scale: 1.035,
    depth: 0.1
  },
  // ... mais peças depois serao adicionadas
]
```

### 2. Sistema de Carregamento de Texturas

**Requisito crítico:** Os SVGs contêm gradientes lineares (ex: `url(#paint0_linear_26_86)`) que o Three.js não consegue interpretar como cores sólidas. (Aceito sugestões de bibliotecas que possam extrair gradientes de SVGs para texturas)

**Solução necessária:** (Ou alternativa viável)
- Carregar SVGs como texturas de imagem (via `Image()`)
- Extrair dimensões reais (width, height) do SVG
- Calcular aspect ratio para manter proporções
- Retornar objeto com: `{ texture, width, height, aspectRatio }`

```javascript
function useSVGTexture(index) {
  // Carrega /assets/puzzle_pieces/simple-puzzle-piece-pattern-${index}.svg
  // Retorna { texture: THREE.Texture, width, height, aspectRatio }
}
```

### 3. Sistema de Proporções Corretas

**Problema a evitar:** PlaneGeometry padrão cria quadrados (2x2), distorcendo peças retangulares.

**Solução:** (Ou alternativa viável)
```javascript
function usePlaneForSVG(svgIndex) {
  const svgData = useSVGTexture(svgIndex);
  
  // Calcular dimensões proporcionais:
  const baseWidth = 2;
  const height = baseWidth / aspectRatio;
  
  // Criar PlaneGeometry com proporções corretas
  return new THREE.PlaneGeometry(baseWidth, height);
}
```

### 4. Renderização de Peças 3D

**Requisitos:**
- ✅ Frente: textura SVG com transparência
- ✅ Verso: cor sólida do `puzzlePositions`
- ✅ Profundidade 3D ajustável via prop `depth`
- ✅ Formato visual único por peça (via alpha channel)
- ✅ Suporte para animação via `ref` no grupo

**Estrutura da peça:**
```javascript
<group ref={ref} position={initial} rotation={random} scale={scale}>
  {/* Frente - textura SVG */}
  <mesh position={[0, 0, depth/2]}>
    <meshStandardMaterial 
      map={texture}
      transparent={true}
      alphaTest={0.5}  // Remove pixels transparentes (forma da peça)
    />
  </mesh>
  
  {/* Verso - cor sólida */}
  <mesh position={[0, 0, -depth/2]} rotation={[0, Math.PI, 0]}>
    <meshStandardMaterial color={backColor} />
  </mesh>
</group>
```

### 5. Componente de Fundo

**Requisitos:**
- Renderiza SVG pattern 0 como fundo estático
- Mesmo sistema de textura + proporções
- Configurável via scale (número único, mantém proporções)
- Posicionado em Z negativo (atrás das peças)

```javascript
<mesh position={[0, 0, -1]} scale={5.25}>
  <meshStandardMaterial 
    map={backgroundTexture}
    transparent={true}
    alphaTest={0.1}
  />
</mesh>
```



### 6. Integração com Sistema de Animação

**Requisito crítico:** Refs devem ser passadas corretamente para permitir animação via GSAP/ScrollTrigger

```javascript
// No componente Pieces
<JigsawPiece
  ref={(el) => {
    if (el) {
      piecesRef.current[index] = el;
    }
  }}
/>
```

---

## Restrições e Regras Importantes

### ❌ O que NÃO fazer:

1. **Não usar ExtrudeGeometry com SVGLoader:**
   - SVGLoader extrai apenas contornos externos
   - Todas as peças ficam com mesmo formato (contorno genérico)
   - Perde gradientes e cores específicas

2. **Não usar cores estáticas na frente:**
   - SVGs têm gradientes complexos
   - Texturas preservam todos os detalhes visuais

3. **Não violar Rules of Hooks:**
   - Todos os hooks (useState, useEffect, useMemo) devem estar no topo
   - Nunca chamar hooks após return condicional
   - Ordem de hooks deve ser sempre a mesma

4. **Não usar scale como array [x, y, z]:**
   - Use número único para manter proporções
   - Geometria já tem proporções corretas via aspect ratio

### ✅ O que fazer:

1. **Carregar SVGs como texturas de imagem**
2. **Usar PlaneGeometry com proporções baseadas em aspect ratio**
3. **Aplicar transparência via alphaTest** (formato da peça)
4. **Dois planos deslocados** para simular 3D
5. **Todos os hooks antes de qualquer return condicional**

---

## Estrutura de Arquivos Esperada

```
/assets/puzzle_pieces/
  ├── simple-puzzle-piece-pattern-0.svg   (fundo)
  ├── simple-puzzle-piece-pattern-12.svg  (peça 1)
  ├── simple-puzzle-piece-pattern-13.svg  (peça 2)
  └── ...

/src/components/
  └── PuzzleScene.jsx  (componente principal)
```

---

## Comportamento Esperado

### Ao carregar:
1. ✅ Texturas carregadas com dimensões corretas logadas no console
2. ✅ Geometrias criadas com proporções corretas
3. ✅ Peças renderizadas com formatos únicos e visíveis
4. ✅ Fundo renderizado atrás das peças
5. ✅ Sombras projetadas corretamente

### Durante execução:
1. ✅ Refs funcionando para animação externa (GSAP)
2. ✅ Peças podem girar em qualquer eixo mantendo formato
3. ✅ Proporções mantidas em qualquer escala
4. ✅ Sem erros de hooks ou renderização

### Console logs esperados:
```
✅ Textura SVG 12 carregada - Dimensões: 192x150
📐 SVG 12: Aspect ratio 1.28 - Geometria: 2x1.56
✅ SVG 12: Renderizando peça com textura - Profundidade: 0.1
[PuzzleScene] Peça 0 registrada: Group {...}
```

---

## Parâmetros Configuráveis

### Por peça (em puzzlePositions):
- `svg`: índice do arquivo SVG
- `initial`: posição inicial [x, y, z]
- `final`: posição final [x, y, z]
- `color`: cor do verso (hex)
- `scale`: tamanho (número único)
- `depth`: espessura 3D (0.05 a 0.2 recomendado)

### Fundo (em BackgroundPattern):
- `position`: [x, y, z] - posicionamento
- `scale`: número único - tamanho
- `rotation`: [x, y, z] - rotação opcional



---

## Compatibilidade

### Formatos de imagem suportados:
- ✅ SVG (atual)
- ✅ PNG (recomendado para transparência)
- ✅ WebP (melhor compressão)
- ❌ JPG (sem canal alpha)

### Para trocar formato:
```javascript
img.src = `/assets/puzzle_pieces/simple-puzzle-piece-pattern-${index}.png`;
```

---

## Performance

### Otimizações implementadas:
- ✅ Geometria simples (PlaneGeometry)
- ✅ Texturas carregadas uma vez (via hooks)
- ✅ useMemo para geometrias clonadas
- ✅ Shadow map de 2048 (balanço qualidade/performance)

### Limites recomendados:
- Máximo 20 peças simultâneas
- Shadow mapSize máximo 2048
- Depth máximo 0.3

---

## Resultado Final Esperado

Um sistema de quebra-cabeça 3D onde:
- ✅ Cada peça tem formato e cores únicos
- ✅ Gradientes SVG preservados perfeitamente
- ✅ Proporções corretas automaticamente (Com possibilidade de ajuste nas pecas e fundo)
- ✅ Profundidade 3D configurável
- ✅ Totalmente animável via refs externas
- ✅ Performance otimizada
- ✅ Código limpo e manutenível