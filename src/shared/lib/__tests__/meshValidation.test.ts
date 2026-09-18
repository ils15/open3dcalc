import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  analyzeMeshTopology,
  MESH_VALIDATION_TRIANGLE_THRESHOLD,
} from "../meshValidation";

/**
 * Cubo [0,1]³ com winding outward consistente — o mesmo fixture validado em
 * stlParser.parsing.test.ts (volume=1, sem issues). Malha de referência
 * íntegra: toda métrica de topologia deve ficar limpa.
 */
const CUBE_TRIANGLES: [number, number, number][][] = [
  // z = 0
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
  [
    [0, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
  ],
  // z = 1
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  // x = 0
  [
    [0, 0, 0],
    [0, 1, 1],
    [0, 1, 0],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
  ],
  // x = 1
  [
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
  ],
  // y = 0
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
  ],
  [
    [0, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
  // y = 1
  [
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [1, 1, 0],
  ],
];

type Tri = [number, number, number][][];

/** Geometria NÃO-indexada, como o STLLoader entrega (vértices duplicados). */
function geometryFromTris(tris: Tri): THREE.BufferGeometry {
  const positions = new Float32Array(tris.length * 9);
  tris.forEach((tri, i) => {
    const o = i * 9;
    tri.forEach((v, k) => {
      positions[o + k * 3] = v[0];
      positions[o + k * 3 + 1] = v[1];
      positions[o + k * 3 + 2] = v[2];
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function geometryIndexed(): THREE.BufferGeometry {
  // Cubo indexado (8 vértices, 12 triângulos) — caminho alternativo do parser.
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  const index = new Uint32Array([
    0,
    2,
    1,
    0,
    3,
    2, // z=0
    4,
    5,
    6,
    4,
    6,
    7, // z=1
    0,
    7,
    3,
    0,
    4,
    7, // x=0
    1,
    2,
    6,
    1,
    6,
    5, // x=1
    0,
    1,
    5,
    0,
    5,
    4, // y=0
    3,
    7,
    6,
    3,
    6,
    2, // y=1
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

describe("analyzeMeshTopology — malha íntegra (baseline)", () => {
  it("cubo fechado e consistente não acorda nenhuma flag", () => {
    const v = analyzeMeshTopology(geometryFromTris(CUBE_TRIANGLES));
    expect(v).toEqual({
      windingInconsistent: false,
      nonManifoldEdges: 0,
      openEdges: 0,
      degenerateTriangles: 0,
      partial: false,
    });
  });

  it("cubo indexado fechado também fica limpo (caminho com index)", () => {
    const v = analyzeMeshTopology(geometryIndexed());
    expect(v.windingInconsistent).toBe(false);
    expect(v.openEdges).toBe(0);
    expect(v.nonManifoldEdges).toBe(0);
    expect(v.degenerateTriangles).toBe(0);
    expect(v.partial).toBe(false);
  });

  it("geometria vazia não quebra", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(0), 3),
    );
    const v = analyzeMeshTopology(geometry);
    expect(v).toEqual({
      windingInconsistent: false,
      nonManifoldEdges: 0,
      openEdges: 0,
      degenerateTriangles: 0,
      partial: false,
    });
  });
});

describe("analyzeMeshTopology — malha aberta (buracos)", () => {
  it("cubo sem a face z=1 → openEdges > 0", () => {
    const open = CUBE_TRIANGLES.filter((_, i) => !(i === 2 || i === 3));
    const v = analyzeMeshTopology(geometryFromTris(open));
    expect(v.openEdges).toBeGreaterThan(0);
    expect(v.openEdges).toBe(4); // as 4 arestas da borda do topo
    expect(v.windingInconsistent).toBe(false);
    expect(v.partial).toBe(false);
  });
});

describe("analyzeMeshTopology — winding inconsistente", () => {
  it("inverter UM triângulo do cubo acorda a flag", () => {
    const flipped: Tri = CUBE_TRIANGLES.map((tri, i) =>
      i === 0 ? [tri[0], tri[2], tri[1]] : tri,
    );
    const v = analyzeMeshTopology(geometryFromTris(flipped));
    expect(v.windingInconsistent).toBe(true);
    // A face invertida não abre a malha nem cria non-manifold.
    expect(v.openEdges).toBe(0);
    expect(v.nonManifoldEdges).toBe(0);
  });

  it("triângulo duplicado (mesmo winding) NÃO vira windingInconsistent", () => {
    const dup: Tri = [...CUBE_TRIANGLES, CUBE_TRIANGLES[0]];
    const v = analyzeMeshTopology(geometryFromTris(dup));
    expect(v.windingInconsistent).toBe(false);
  });
});

describe("analyzeMeshTopology — arestas non-manifold", () => {
  it("triângulo duplicado (3ª face numa aresta) → nonManifoldEdges === 3", () => {
    const dup: Tri = [...CUBE_TRIANGLES, CUBE_TRIANGLES[0]];
    const v = analyzeMeshTopology(geometryFromTris(dup));
    expect(v.nonManifoldEdges).toBe(3);
    expect(v.openEdges).toBe(0);
  });

  it("livro de 3 faces numa aresta comum conta 1 aresta non-manifold", () => {
    const book: Tri = [
      [
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
      [
        [0, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ],
      [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
      ],
    ];
    const v = analyzeMeshTopology(geometryFromTris(book));
    expect(v.nonManifoldEdges).toBe(1);
  });
});

describe("analyzeMeshTopology — triângulos degenerados", () => {
  it("triângulo com 2 vértices iguais → degenerateTriangles === 1", () => {
    const deg: Tri = [
      ...CUBE_TRIANGLES,
      [
        [5, 5, 5],
        [5, 5, 5],
        [6, 5, 5],
      ],
    ];
    const v = analyzeMeshTopology(geometryFromTris(deg));
    expect(v.degenerateTriangles).toBe(1);
  });

  it("triângulo colinear (área zero) também é contado", () => {
    const deg: Tri = [
      ...CUBE_TRIANGLES,
      [
        [5, 5, 5],
        [6, 5, 5],
        [7, 5, 5],
      ],
    ];
    const v = analyzeMeshTopology(geometryFromTris(deg));
    expect(v.degenerateTriangles).toBe(1);
  });
});

describe("analyzeMeshTopology — regressão de chave de aresta", () => {
  it("malha não-indexada de tamanho médio permanece consistente", () => {
    // Regressão D-EA7: a chave canônica da aresta é `lo * stride + hi`. Se o
    // stride variar durante o loop (em vez de fixo = pos.count + 1), arestas
    // iniciais e tardias colidem → falsos non-manifold/openEdges. Uma esfera
    // manifold não-indexada (como o STLLoader entrega) exercita isso.
    const sphere = new THREE.SphereGeometry(20, 96, 48).toNonIndexed();
    expect(sphere.index).toBeNull();
    const v = analyzeMeshTopology(sphere);
    expect(v.openEdges).toBe(0);
    expect(v.nonManifoldEdges).toBe(0);
    expect(v.windingInconsistent).toBe(false);
    expect(v.degenerateTriangles).toBe(0);
    expect(v.partial).toBe(false);
  });
});

describe("analyzeMeshTopology — threshold de memória", () => {
  it("respeita a constante exportada (~1M de triângulos)", () => {
    expect(MESH_VALIDATION_TRIANGLE_THRESHOLD).toBeGreaterThanOrEqual(
      1_000_000,
    );
  });

  it("abaixo do limite faz validação completa (partial=false)", () => {
    const v = analyzeMeshTopology(geometryFromTris(CUBE_TRIANGLES));
    expect(v.partial).toBe(false);
  });

  it("acima do limite pula o edge-map e marca partial=true", () => {
    const triCount = MESH_VALIDATION_TRIANGLE_THRESHOLD + 1;
    const positions = new Float32Array(triCount * 9);
    // Padrão de um triângulo válido, replicado por copyWithin (O(n) memmove).
    positions.set([0, 0, 0, 0, 0, 1, 1, 0, 0]);
    let copied = 9;
    while (copied < positions.length) {
      const n = Math.min(copied, positions.length - copied);
      positions.copyWithin(copied, 0, n);
      copied += n;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    expect(geometry.attributes.position.count / 3).toBe(triCount);

    const start = performance.now();
    const v = analyzeMeshTopology(geometry);
    const elapsed = performance.now() - start;

    expect(v.partial).toBe(true);
    // O edge-map NÃO foi construído → métricas caras permanecem zeradas e o
    // pico de memória fica limitado ao Float32Array. A asserção de tempo é
    // um guard anti-regressão frouxo de propósito (instrumentação de coverage
    // altera o timing); o que ela prova é "não estoura memória/não trava".
    expect(v.openEdges).toBe(0);
    expect(v.nonManifoldEdges).toBe(0);
    expect(v.windingInconsistent).toBe(false);
    expect(elapsed).toBeLessThan(10_000);
  });

  it("threshold injetável: 11 triângulos com limite 10 ficam parciais", () => {
    const tris: Tri = [];
    for (let i = 0; i < 11; i++) tris.push(CUBE_TRIANGLES[0]);
    const v = analyzeMeshTopology(geometryFromTris(tris), 10);
    expect(v.partial).toBe(true);
    // Degenerados continuam baratos e são contados mesmo no modo parcial.
    expect(v.degenerateTriangles).toBe(0);
  });
});
