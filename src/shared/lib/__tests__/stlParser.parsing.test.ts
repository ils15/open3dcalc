import { describe, it, expect } from "vitest";
import { analyzeMeshFile } from "../stlParser";

/**
 * Cubo [0,s]³ com winding outward consistente. A face y=0 fica com a normal
 * apontando para baixo (0,-1,0) — exatamente o que o estimateSupportVolume
 * conta como overhang. Normais declaradas no arquivo são ignoradas
 * (analyzeMeshFile chama computeVertexNormals), o que importa é a winding.
 */
const CUBE_TRIANGLES: [number, number, number][][] = [
  // z = 0 (normal -Z)
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
  // z = 1 (normal +Z)
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
  // x = 0 (normal -X)
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
  // x = 1 (normal +X)
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
  // y = 0 (normal -Y — overhang)
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
  // y = 1 (normal +Y)
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

function scaleTri(
  tri: [number, number, number][],
  s: number,
): [number, number, number][] {
  return tri.map(
    (v) => [v[0] * s, v[1] * s, v[2] * s] as [number, number, number],
  );
}

function triNormal(tri: [number, number, number][]): [number, number, number] {
  const [a, b, c] = tri;
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** STL ASCII com N facets. Padding inicial garante >= 84 bytes (limite do loader). */
function asciiStl(tris: [number, number, number][][], size = 10): string {
  const lines = ["solid cube"];
  for (const tri of tris) {
    const [nx, ny, nz] = triNormal(tri);
    const s = scaleTri(tri, size);
    lines.push(
      `facet normal ${nx} ${ny} ${nz}`,
      "outer loop",
      `vertex ${s[0][0]} ${s[0][1]} ${s[0][2]}`,
      `vertex ${s[1][0]} ${s[1][1]} ${s[1][2]}`,
      `vertex ${s[2][0]} ${s[2][1]} ${s[2][2]}`,
      "endloop",
      "endfacet",
    );
  }
  lines.push("endsolid cube");
  return lines.join("\n");
}

/** STL binário: header 80 + uint32 count + 50 bytes/facet. */
function binaryStl(tris: [number, number, number][][], size = 10): Uint8Array {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  tris.forEach((tri, i) => {
    const off = 84 + i * 50;
    const [nx, ny, nz] = triNormal(tri);
    dv.setFloat32(off, nx, true);
    dv.setFloat32(off + 4, ny, true);
    dv.setFloat32(off + 8, nz, true);
    scaleTri(tri, size).forEach((v, k) => {
      const b = off + 12 + k * 12;
      dv.setFloat32(b, v[0], true);
      dv.setFloat32(b + 4, v[1], true);
      dv.setFloat32(b + 8, v[2], true);
    });
  });
  return new Uint8Array(buf);
}

function file(content: string | Uint8Array, name: string): File {
  return new File([content as BlobPart], name);
}

describe("analyzeMeshFile — STL", () => {
  it("lê um cubo ASCII e devolve a análise completa", async () => {
    const { analysis, geometry } = await analyzeMeshFile(
      file(asciiStl(CUBE_TRIANGLES), "cube.stl"),
    );
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.vertexCount).toBe(36);
    expect(analysis.dimensions).toEqual({ x: 10, y: 10, z: 10 });
    expect(analysis.volume).toBeCloseTo(1000, 6);
    expect(analysis.surfaceArea).toBeCloseTo(600, 6);
    expect(analysis.boundingBox.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(analysis.boundingBox.max).toEqual({ x: 10, y: 10, z: 10 });
    expect(analysis.integrity.valid).toBe(true);
    expect(analysis.integrity.issues).toHaveLength(0);
    expect(geometry.attributes.position.count).toBe(36);
  });

  it("lê um cubo binário com o mesmo resultado do ASCII", async () => {
    const { analysis } = await analyzeMeshFile(
      file(binaryStl(CUBE_TRIANGLES), "cube.stl"),
    );
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.dimensions).toEqual({ x: 10, y: 10, z: 10 });
    expect(analysis.volume).toBeCloseTo(1000, 6);
    expect(analysis.surfaceArea).toBeCloseTo(600, 6);
    expect(analysis.integrity.valid).toBe(true);
  });

  it("estima volume de suporte quando estimateSupport está ligado", async () => {
    // Cubo de 100 mm: a face y=0 (10.000 mm²) aponta para baixo
    // → 10000 * 0.2 * 0.15 / 1000 = 0,3 cm³. (Malhas pequenas arredondam
    // para 0 — o campo é toFixed(2).)
    const big = asciiStl(CUBE_TRIANGLES, 100);
    const { analysis } = await analyzeMeshFile(file(big, "cube.stl"), {
      estimateSupport: true,
    });
    expect(analysis.supportVolumeCm3).toBeCloseTo(0.3, 2);
    // Sem a flag, o campo fica ausente (não é 0 silencioso).
    const plain = await analyzeMeshFile(file(big, "cube.stl"));
    expect(plain.analysis.supportVolumeCm3).toBeUndefined();
  });

  it("respeita layerHeight/supportDensity customizados no suporte", async () => {
    const big = asciiStl(CUBE_TRIANGLES, 100);
    const { analysis } = await analyzeMeshFile(file(big, "cube.stl"), {
      estimateSupport: true,
      layerHeight: 0.1,
      supportDensity: 0.5,
    });
    // 10000 mm² * 0.1 * 0.5 / 1000 = 0,5 cm³
    expect(analysis.supportVolumeCm3).toBeCloseTo(0.5, 2);
  });

  it("rejeita conteúdo que não é STL com Error processing STL", async () => {
    await expect(
      analyzeMeshFile(file("this is not an stl", "broken.stl")),
    ).rejects.toThrow(/Error processing STL/);
  });

  it("reporta malha sem vértices (STL ASCII sem facets)", async () => {
    // >= 84 bytes para o STLLoader não jogar RangeError no isBinary.
    const empty = "solid empty\n" + " ".repeat(100) + "\nendsolid empty\n";
    const { analysis } = await analyzeMeshFile(file(empty, "empty.stl"));
    expect(analysis.triangleCount).toBe(0);
    expect(analysis.vertexCount).toBe(0);
    expect(analysis.integrity.valid).toBe(false);
    expect(analysis.integrity.issues).toEqual(
      expect.arrayContaining([
        "Model does not contain vertices",
        "Invalid bounding box",
      ]),
    );
  });

  it("propaga falha de leitura do arquivo (reader.onerror)", async () => {
    const Original = globalThis.FileReader;
    // Simula uma falha de I/O: o loader nunca chega a parsear bytes.
    class FailingReader {
      onload: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      readAsArrayBuffer(): void {
        queueMicrotask(() => this.onerror?.(new Error("disk read failed")));
      }
      readAsText(): void {
        queueMicrotask(() => this.onerror?.(new Error("disk read failed")));
      }
    }
    globalThis.FileReader = FailingReader as unknown as typeof FileReader;
    try {
      await expect(
        analyzeMeshFile(file(asciiStl(CUBE_TRIANGLES), "cube.stl")),
      ).rejects.toThrow("Error reading file");
    } finally {
      globalThis.FileReader = Original;
    }
  });
});

describe("analyzeMeshFile — OBJ", () => {
  it("lê um OBJ com uma malha", async () => {
    const obj = [
      "v 0 0 0",
      "v 10 0 0",
      "v 10 10 0",
      "vn 0 0 1",
      "f 1 2 3",
    ].join("\n");
    const { analysis } = await analyzeMeshFile(file(obj, "tri.obj"));
    expect(analysis.triangleCount).toBe(1);
    expect(analysis.dimensions).toEqual({ x: 10, y: 10, z: 0 });
    expect(analysis.integrity.valid).toBe(true);
  });

  it("faz merge de várias malhas OBJ (mergeGeometries)", async () => {
    // Dois triângulos em Z diferentes: sem o merge eles se empilhariam e a
    // dimensão Z seria 0.
    const obj = [
      "o a",
      "v 0 0 0",
      "v 10 0 0",
      "v 10 10 0",
      "vn 0 0 1",
      "f 1 2 3",
      "o b",
      "v 0 0 10",
      "v 10 0 10",
      "v 10 10 10",
      "vn 0 0 1",
      "f 4 5 6",
    ].join("\n");
    const { analysis, geometry } = await analyzeMeshFile(file(obj, "two.obj"));
    expect(analysis.triangleCount).toBe(2);
    expect(analysis.dimensions.z).toBeCloseTo(10, 6);
    // O merge preserva as normais vindas do `vn`.
    expect(geometry.attributes.normal).toBeDefined();
    expect(geometry.attributes.position.count).toBe(6);
  });

  it("rejeita OBJ sem nenhuma geometria", async () => {
    await expect(
      analyzeMeshFile(file("v 0 0 0\nv 1 0 0\n", "empty.obj")),
    ).rejects.toThrow(/Error processing OBJ/);
  });

  it("propaga falha de leitura no OBJ (reader.onerror)", async () => {
    const Original = globalThis.FileReader;
    class FailingReader {
      onload: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      readAsArrayBuffer(): void {
        queueMicrotask(() => this.onerror?.(new Error("disk read failed")));
      }
      readAsText(): void {
        queueMicrotask(() => this.onerror?.(new Error("disk read failed")));
      }
    }
    globalThis.FileReader = FailingReader as unknown as typeof FileReader;
    try {
      await expect(
        analyzeMeshFile(file("v 0 0 0\nf 1 2 3\n", "tri.obj")),
      ).rejects.toThrow("Error reading file");
    } finally {
      globalThis.FileReader = Original;
    }
  });
});

describe("analyzeMeshFile — formato suportado", () => {
  it("rejeita extensão desconhecida com mensagem útil", async () => {
    await expect(
      analyzeMeshFile(file("whatever", "model.ply")),
    ).rejects.toThrow(/Unsupported format: ply/);
  });

  it("rejeita extensão ausente", async () => {
    await expect(analyzeMeshFile(file("x", "noextension"))).rejects.toThrow(
      /Unsupported format/,
    );
  });
});

describe("analyzeMeshFile — guards de topologia (D-EA7)", () => {
  it("cubo íntegra: meshValidation limpo E valores byte-identical", async () => {
    const { analysis } = await analyzeMeshFile(
      file(asciiStl(CUBE_TRIANGLES), "cube.stl"),
    );
    expect(analysis.meshValidation).toEqual({
      windingInconsistent: false,
      nonManifoldEdges: 0,
      openEdges: 0,
      degenerateTriangles: 0,
      partial: false,
    });
    // Contrato inalterado: o aviso NÃO toca na estimativa.
    expect(analysis.integrity.valid).toBe(true);
    // GA-9: malha íntegra → issues permanece vazio (byte-identical).
    expect(analysis.integrity.issues).toHaveLength(0);
    expect(analysis.volume).toBeCloseTo(1000, 6);
    expect(analysis.surfaceArea).toBeCloseTo(600, 6);
  });

  it("cubo aberto (face removida): openEdges > 0 sem alterar o volume", async () => {
    const open = CUBE_TRIANGLES.filter((_, i) => !(i === 2 || i === 3));
    const { analysis } = await analyzeMeshFile(
      file(asciiStl(open), "open-cube.stl"),
    );
    expect(analysis.meshValidation?.openEdges).toBe(4);
    // GA-9 backfill: o sinal topológico também aparece em integrity.issues.
    expect(analysis.integrity.issues).toEqual(["Open edges detected"]);
    // Não-bloqueador: o volume ainda é calculado (não é "corrigido").
    expect(analysis.volume).toBeGreaterThan(0);
  });

  it("face invertida: windingInconsistent true", async () => {
    const flipped = CUBE_TRIANGLES.map((tri, i) =>
      i === 0 ? [tri[0], tri[2], tri[1]] : tri,
    );
    const { analysis } = await analyzeMeshFile(
      file(asciiStl(flipped), "flipped.stl"),
    );
    expect(analysis.meshValidation?.windingInconsistent).toBe(true);
    // GA-9 backfill: winding espelhado em integrity.issues.
    expect(analysis.integrity.issues).toEqual([
      "Inconsistent face winding detected",
    ]);
  });
});
