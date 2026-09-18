import { describe, it, expect } from "vitest";
import { estimateTriangleCount } from "../stlParser";

/**
 * Contagem de triângulos antes do parse pesado (guard de complexidade).
 * O estimador só precisa do header binário ou de uma varredura ASCII — a
 * malha em si nunca é parseada aqui.
 */

/** STL binário canônico: 80 bytes de header + uint32 LE + 50 bytes/facet. */
function binaryStl(triangles: number, declared = triangles): Uint8Array {
  const buf = new ArrayBuffer(84 + triangles * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, declared, true);
  // O conteúdo do payload é irrelevante para a estimativa (o STLLoader
  // recalcula as normais); zeros servem.
  return new Uint8Array(buf);
}

/** STL ASCII com `facets` triângulos (1 linha `facet normal` por triângulo). */
function asciiStl(facets: number): string {
  const lines = ["solid mesh"];
  for (let i = 0; i < facets; i++) {
    lines.push(
      "facet normal 0 0 1",
      "outer loop",
      "vertex 0 0 0",
      "vertex 1 0 0",
      "vertex 1 1 0",
      "endloop",
      "endfacet",
    );
  }
  lines.push("endsolid mesh");
  return lines.join("\n");
}

function file(content: string | Uint8Array, name: string): File {
  return new File([content as BlobPart], name);
}

describe("estimateTriangleCount", () => {
  it("lê a contagem exata do header de um STL binário", async () => {
    await expect(
      estimateTriangleCount(file(binaryStl(12), "cube.stl")),
    ).resolves.toBe(12);
    // 84 bytes de header + 50 por triângulo = contagem grande sem materializar a malha.
    await expect(
      estimateTriangleCount(file(binaryStl(1_500_000), "big.stl")),
    ).resolves.toBe(1_500_000);
  });

  it("conta as linhas `facet` de um STL ASCII em uma passada", async () => {
    await expect(
      estimateTriangleCount(file(asciiStl(12), "cube.stl")),
    ).resolves.toBe(12);
    await expect(
      estimateTriangleCount(file(asciiStl(4096), "many.stl")),
    ).resolves.toBe(4096);
  });

  it("dá a mesma contagem para ASCII e binário equivalentes", async () => {
    const ascii = await estimateTriangleCount(file(asciiStl(64), "a.stl"));
    const binary = await estimateTriangleCount(file(binaryStl(64), "b.stl"));
    expect(binary).toBe(ascii);
    expect(binary).toBe(64);
  });

  it("devolve null para formatos sem contagem barata pré-parse", async () => {
    // OBJ e 3MF (comprimido) só revelam a malha depois do parse; G-code não
    // tem triângulos. Esses caminhos usam o guard pós-análise.
    await expect(
      estimateTriangleCount(file("v 0 0 0\nv 1 0 0", "model.obj")),
    ).resolves.toBeNull();
    await expect(
      estimateTriangleCount(file(new Uint8Array([80, 75, 3, 4]), "model.3mf")),
    ).resolves.toBeNull();
    await expect(
      estimateTriangleCount(file("G1 X10 Y10 E500", "print.gcode")),
    ).resolves.toBeNull();
  });

  it("desconfia de um header binário mentiroso e cai no guard pós-análise", async () => {
    // Header declara 5M de triângulos, mas o payload só tem 12: o tamanho do
    // arquivo não bate (84 + n*50), então a contagem não é confiável. A
    // varredura ASCII posterior não acha `facet` em lixo binário → null.
    await expect(
      estimateTriangleCount(file(binaryStl(12, 5_000_000), "lying.stl")),
    ).resolves.toBeNull();
  });

  it("devolve null para um arquivo sem facets reconhecíveis", async () => {
    await expect(
      estimateTriangleCount(file("not a mesh at all", "broken.stl")),
    ).resolves.toBeNull();
    // Menos de 84 bytes: nem há espaço para o header binário.
    await expect(
      estimateTriangleCount(file(new Uint8Array(40), "tiny.stl")),
    ).resolves.toBeNull();
  });
});
